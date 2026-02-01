/**
 * LLM Worker Thread
 * Handles CPU-intensive LLM inference in a separate thread to prevent blocking the main process
 */
import { parentPort } from 'worker_threads'
import * as fs from 'fs'

interface GenerateRequest {
  prompt: string
  context?: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
}

interface GenerateResponse {
  text: string
  tokensUsed: number
  finishReason: 'stop' | 'length' | 'error'
}

interface WorkerMessage {
  type: 'init' | 'generate' | 'generateStream' | 'setModel' | 'unload'
  payload: any
  id: string
}

interface WorkerResponse {
  type: 'result' | 'error' | 'chunk' | 'ready'
  id: string
  payload: any
}

// Worker state
let llama: any = null
let model: any = null
let context: any = null
let session: any = null
let isLoaded = false
let config = {
  modelPath: '',
  modelName: 'tinyllama-1.1b',
  contextLength: 2048,
  temperature: 0.7,
  maxTokens: 1024,
}

function getDefaultSystemPrompt(): string {
  return `You are a helpful AI assistant for a lecture note-taking application. 
You help students understand their lecture content, summarize notes, explain concepts, and answer questions about the material.
Be concise, accurate, and educational in your responses.
When the user provides lecture context (slides, notes, transcripts), use that information to give relevant answers.`
}

function buildPrompt(request: GenerateRequest): string {
  let prompt = request.prompt
  if (request.context) {
    prompt = `Context from lecture:\n${request.context}\n\nQuestion: ${request.prompt}`
  }
  return prompt
}

function fallbackGenerate(request: GenerateRequest): GenerateResponse {
  const prompt = request.prompt.toLowerCase()
  let response = ''

  if (prompt.includes('summarize') || prompt.includes('summary')) {
    response = `I'd be happy to summarize this content for you.\n\n`
    if (request.context) {
      response += `Based on the lecture content provided:\n\n`
      response += `The material covers several key topics. To get a proper AI-powered summary, please download a local LLM model from Settings.\n\n`
      response += `For now, here's the raw content I can see:\n${request.context.substring(0, 500)}...`
    } else {
      response += `Please provide some lecture content (notes, transcript, or navigate to a slide) for me to summarize.`
    }
  } else if (prompt.includes('explain') || prompt.includes('what is') || prompt.includes('how does')) {
    response = `To explain this concept properly, I would need the local LLM model to be loaded.\n\n`
    response += `You can download a model like TinyLlama (~670MB) from Settings for offline AI assistance.\n\n`
    response += `In the meantime, I can help you navigate your notes or find specific content.`
  } else if (prompt.includes('quiz') || prompt.includes('test') || prompt.includes('question')) {
    response = `I can generate practice questions once the local LLM is set up.\n\n`
    response += `For now, here's a general study tip: Review each slide and try to explain the main concept in your own words.`
  } else {
    response = `I received your question: "${request.prompt}"\n\n`
    response += `To provide intelligent answers, please download a local LLM model from Settings.\n\n`
    response += `Available models:\n`
    response += `• TinyLlama 1.1B (~670MB) - Fast, good for summaries\n`
    response += `• Phi-2 (~1.6GB) - Better reasoning\n`
    response += `• Llama 3.2 1B (~775MB) - Latest architecture\n`
  }

  return {
    text: response,
    tokensUsed: 0,
    finishReason: 'stop',
  }
}

async function initialize(modelPath: string, modelName: string, contextLength: number): Promise<boolean> {
  if (!fs.existsSync(modelPath)) {
    return false
  }

  const stats = fs.statSync(modelPath)
  if (stats.size < 500 * 1024 * 1024) {
    return false
  }

  config.modelPath = modelPath
  config.modelName = modelName
  config.contextLength = contextLength

  try {
    const llamaModule = await import('node-llama-cpp')
    
    if (llamaModule) {
      const { getLlama, LlamaChatSession } = llamaModule

      llama = await getLlama()
      model = await llama.loadModel({
        modelPath: config.modelPath,
      })

      context = await model.createContext({
        contextSize: config.contextLength,
      })
      
      session = new LlamaChatSession({
        contextSequence: context.getSequence(),
        systemPrompt: getDefaultSystemPrompt(),
      })
      
      isLoaded = true
      return true
    }
  } catch (error: any) {
    isLoaded = false
  }
  
  return false
}

async function generate(request: GenerateRequest): Promise<GenerateResponse> {
  if (!isLoaded || !session) {
    return fallbackGenerate(request)
  }

  try {
    const prompt = buildPrompt(request)
    const response = await session.prompt(prompt, {
      maxTokens: request.maxTokens || config.maxTokens,
      temperature: request.temperature || config.temperature,
    })

    return {
      text: response,
      tokensUsed: Math.ceil(response.length / 4),
      finishReason: 'stop',
    }
  } catch (error: any) {
    return {
      text: `Error generating response: ${error.message || 'Unknown error'}`,
      tokensUsed: 0,
      finishReason: 'error',
    }
  }
}

async function generateStream(
  request: GenerateRequest,
  sendChunk: (chunk: string) => void
): Promise<GenerateResponse> {
  if (!isLoaded || !session) {
    const fallback = fallbackGenerate(request)
    sendChunk(fallback.text)
    return fallback
  }

  try {
    const prompt = buildPrompt(request)
    let fullResponse = ''
    let tokensUsed = 0

    const response = await session.prompt(prompt, {
      maxTokens: request.maxTokens || config.maxTokens,
      temperature: request.temperature || config.temperature,
      onTextChunk: (chunk: string) => {
        fullResponse += chunk
        tokensUsed++
        sendChunk(chunk)
      },
    })

    return {
      text: response || fullResponse,
      tokensUsed,
      finishReason: 'stop',
    }
  } catch (error: any) {
    const errorMsg = `Error: ${error.message || 'Unknown error'}`
    sendChunk(errorMsg)
    return {
      text: errorMsg,
      tokensUsed: 0,
      finishReason: 'error',
    }
  }
}

async function unload(): Promise<void> {
  if (session) {
    try { session = null } catch { /* ignore */ }
  }
  if (context) {
    try { await context.dispose() } catch { /* ignore */ }
  }
  if (model) {
    try { await model.dispose() } catch { /* ignore */ }
  }
  isLoaded = false
  model = null
  context = null
  session = null
}

// Message handler
if (parentPort) {
  parentPort.on('message', async (message: WorkerMessage) => {
    const { type, payload, id } = message

    try {
      switch (type) {
        case 'init': {
          const success = await initialize(payload.modelPath, payload.modelName, payload.contextLength)
          parentPort!.postMessage({
            type: 'result',
            id,
            payload: { success }
          } as WorkerResponse)
          break
        }

        case 'generate': {
          const result = await generate(payload)
          parentPort!.postMessage({
            type: 'result',
            id,
            payload: result
          } as WorkerResponse)
          break
        }

        case 'generateStream': {
          const result = await generateStream(payload, (chunk: string) => {
            parentPort!.postMessage({
              type: 'chunk',
              id,
              payload: { chunk }
            } as WorkerResponse)
          })
          parentPort!.postMessage({
            type: 'result',
            id,
            payload: result
          } as WorkerResponse)
          break
        }

        case 'setModel': {
          await unload()
          const success = await initialize(payload.modelPath, payload.modelName, payload.contextLength)
          parentPort!.postMessage({
            type: 'result',
            id,
            payload: { success }
          } as WorkerResponse)
          break
        }

        case 'unload': {
          await unload()
          parentPort!.postMessage({
            type: 'result',
            id,
            payload: { success: true }
          } as WorkerResponse)
          break
        }

        default:
          parentPort!.postMessage({
            type: 'error',
            id,
            payload: { error: `Unknown message type: ${type}` }
          } as WorkerResponse)
      }
    } catch (error: any) {
      parentPort!.postMessage({
        type: 'error',
        id,
        payload: { error: error.message || 'Worker error' }
      } as WorkerResponse)
    }
  })

  // Signal ready
  parentPort.postMessage({ type: 'ready', id: 'init', payload: {} })
}

