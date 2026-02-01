import { ipcMain, app, BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import * as https from 'https'
import * as http from 'http'
import { log } from '../logger.js'

// Local LLM integration bridge
// Uses node-llama-cpp for actual inference

interface LLMConfig {
  modelPath: string
  modelName: string
  contextLength: number
  temperature: number
  maxTokens: number
}

interface GenerateRequest {
  prompt: string
  context?: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  stream?: boolean
}

interface GenerateResponse {
  text: string
  tokensUsed: number
  finishReason: 'stop' | 'length' | 'error'
}

// Available models with download URLs
const LLM_MODELS: Record<string, { url: string; size: string; filename: string; contextLength: number }> = {
  'tinyllama-1.1b': {
    url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    size: '670 MB',
    filename: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
    contextLength: 2048,
  },
  'phi-2': {
    url: 'https://huggingface.co/TheBloke/phi-2-GGUF/resolve/main/phi-2.Q4_K_M.gguf',
    size: '1.6 GB',
    filename: 'phi-2.Q4_K_M.gguf',
    contextLength: 2048,
  },
  'mistral-7b-instruct': {
    url: 'https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf',
    size: '4.4 GB',
    filename: 'mistral-7b-instruct-v0.2.Q4_K_M.gguf',
    contextLength: 8192,
  },
  'llama-3.2-1b': {
    url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    size: '775 MB',
    filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    contextLength: 8192,
  },
  'llama-3.2-3b': {
    url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    size: '2.0 GB',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    contextLength: 8192,
  },
}

class LLMBridge {
  private config: LLMConfig
  private isLoaded: boolean = false
  private modelPath: string
  private llama: any = null
  private model: any = null
  private context: any = null
  private session: any = null
  private downloadAbortController: AbortController | null = null

  constructor() {
    const userDataPath = app.getPath('userData')
    this.modelPath = path.join(userDataPath, 'models', 'llm')
    
    this.config = {
      modelPath: path.join(this.modelPath, 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf'),
      modelName: 'tinyllama-1.1b',
      contextLength: 2048,
      temperature: 0.7,
      maxTokens: 1024,
    }
  }

  async initialize(): Promise<boolean> {
    // Check if model exists
    if (!fs.existsSync(this.config.modelPath)) {
      log.info('LLM model not found', { path: this.config.modelPath }, 'llm')
      return false
    }

    try {
      // Dynamic import of node-llama-cpp
      const llamaModule = await import('node-llama-cpp')
      
      if (llamaModule) {
        const { getLlama } = llamaModule

        log.debug('Initializing Llama runtime', undefined, 'llm')
        this.llama = await getLlama()

        log.debug('Loading model', { path: this.config.modelPath }, 'llm')
        this.model = await this.llama.loadModel({
          modelPath: this.config.modelPath,
        })

        log.debug('Creating context', { contextLength: this.config.contextLength }, 'llm')
        this.context = await this.model.createContext({
          contextSize: this.config.contextLength,
        })
        
        // Create a chat session
        const { LlamaChatSession } = llamaModule
        this.session = new LlamaChatSession({
          contextSequence: this.context.getSequence(),
          systemPrompt: this.getDefaultSystemPrompt(),
        })
        
        this.isLoaded = true
        log.info('LLM initialized', { model: this.config.modelName }, 'llm')
        return true
      }
    } catch (error) {
      log.error('Failed to initialize LLM', error, 'llm')
      this.isLoaded = false
    }
    
    return false
  }

  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    if (!this.isLoaded || !this.session) {
      return this.fallbackGenerate(request)
    }

    try {
      const prompt = this.buildPrompt(request)

      log.debug('Generating response', { promptPreview: prompt.substring(0, 100) }, 'llm')

      const response = await this.session.prompt(prompt, {
        maxTokens: request.maxTokens || this.config.maxTokens,
        temperature: request.temperature || this.config.temperature,
      })

      return {
        text: response,
        tokensUsed: Math.ceil(response.length / 4), // Rough estimate
        finishReason: 'stop',
      }
    } catch (error) {
      log.error('Generation error', error, 'llm')
      return {
        text: `Error generating response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        tokensUsed: 0,
        finishReason: 'error',
      }
    }
  }

  async generateStream(
    request: GenerateRequest,
    onChunk: (chunk: string) => void
  ): Promise<GenerateResponse> {
    if (!this.isLoaded || !this.session) {
      const fallback = this.fallbackGenerate(request)
      onChunk(fallback.text)
      return fallback
    }

    try {
      const prompt = this.buildPrompt(request)
      let fullResponse = ''
      let tokensUsed = 0

      log.debug('Starting streaming generation', undefined, 'llm')

      const response = await this.session.prompt(prompt, {
        maxTokens: request.maxTokens || this.config.maxTokens,
        temperature: request.temperature || this.config.temperature,
        onTextChunk: (chunk: string) => {
          fullResponse += chunk
          tokensUsed++
          onChunk(chunk)
        },
      })

      return {
        text: response || fullResponse,
        tokensUsed,
        finishReason: 'stop',
      }
    } catch (error) {
      log.error('Stream generation error', error, 'llm')
      const errorMsg = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      onChunk(errorMsg)
      return {
        text: errorMsg,
        tokensUsed: 0,
        finishReason: 'error',
      }
    }
  }

  private buildPrompt(request: GenerateRequest): string {
    let prompt = request.prompt
    
    // Add context if provided
    if (request.context) {
      prompt = `Context from lecture:\n${request.context}\n\nQuestion: ${request.prompt}`
    }
    
    return prompt
  }

  private getDefaultSystemPrompt(): string {
    return `You are a helpful AI assistant for a lecture note-taking application. 
You help students understand their lecture content, summarize notes, explain concepts, and answer questions about the material.
Be concise, accurate, and educational in your responses.
When the user provides lecture context (slides, notes, transcripts), use that information to give relevant answers.`
  }

  private fallbackGenerate(request: GenerateRequest): GenerateResponse {
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

  async downloadModel(
    modelName: string = 'tinyllama-1.1b',
    onProgress?: (downloaded: number, total: number) => void
  ): Promise<{ success: boolean; error?: string }> {
    const modelInfo = LLM_MODELS[modelName]
    if (!modelInfo) {
      return { success: false, error: `Unknown model: ${modelName}` }
    }

    // Create models directory
    await fsPromises.mkdir(this.modelPath, { recursive: true })

    const destPath = path.join(this.modelPath, modelInfo.filename)

    // Check if already downloaded
    if (fs.existsSync(destPath)) {
      const stats = await fsPromises.stat(destPath)
      if (stats.size > 100000000) { // At least 100MB
        log.info('Model already exists', { modelName, path: destPath }, 'llm')
        // Update config
        this.config.modelPath = destPath
        this.config.modelName = modelName
        this.config.contextLength = modelInfo.contextLength
        return { success: true }
      }
    }

    log.info('Downloading LLM model', { modelName, url: modelInfo.url }, 'llm')

    // Create abort controller for cancellation
    this.downloadAbortController = new AbortController()

    try {
      await this.downloadFile(modelInfo.url, destPath, onProgress)
      
      // Update config to use new model
      this.config.modelPath = destPath
      this.config.modelName = modelName
      this.config.contextLength = modelInfo.contextLength
      
      // Reinitialize with new model
      await this.unload()
      await this.initialize()
      
      return { success: true }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message === 'Download cancelled') {
        try {
          await fsPromises.unlink(destPath)
        } catch { /* ignore */ }
        log.info('Model download cancelled', { modelName }, 'llm')
        return { success: false, error: 'Download cancelled' }
      }
      log.error('Model download failed', error, 'llm')
      return { success: false, error: error.message || 'Download failed' }
    } finally {
      this.downloadAbortController = null
    }
  }

  cancelDownload(): void {
    if (this.downloadAbortController) {
      this.downloadAbortController.abort()
    }
  }

  private downloadFile(
    url: string,
    destPath: string,
    onProgress?: (downloaded: number, total: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const handleResponse = (response: http.IncomingMessage) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            log.debug('Following redirect', { redirectUrl }, 'llm')
            this.downloadFile(redirectUrl, destPath, onProgress)
              .then(resolve)
              .catch(reject)
            return
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
          return
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10)
        let downloadedSize = 0

        const writeStream = fs.createWriteStream(destPath)
        
        response.on('data', (chunk: Buffer) => {
          downloadedSize += chunk.length
          if (onProgress) {
            onProgress(downloadedSize, totalSize)
          }
        })

        response.pipe(writeStream)

        writeStream.on('finish', () => {
          writeStream.close()
          resolve()
        })

        writeStream.on('error', (err) => {
          fs.unlink(destPath, () => {})
          reject(err)
        })

        // Handle abort
        if (this.downloadAbortController) {
          this.downloadAbortController.signal.addEventListener('abort', () => {
            response.destroy()
            writeStream.close()
            reject(new Error('Download cancelled'))
          })
        }
      }

      const protocol = url.startsWith('https') ? https : http
      const request = protocol.get(url, handleResponse)
      
      request.on('error', reject)
    })
  }

  async setModel(modelName: string): Promise<boolean> {
    const modelInfo = LLM_MODELS[modelName]
    if (!modelInfo) {
      return false
    }
    
    const newPath = path.join(this.modelPath, modelInfo.filename)
    if (!fs.existsSync(newPath)) {
      return false
    }
    
    // Unload current model
    await this.unload()
    
    this.config.modelPath = newPath
    this.config.modelName = modelName
    this.config.contextLength = modelInfo.contextLength
    
    return await this.initialize()
  }

  async unload(): Promise<void> {
    if (this.session) {
      try {
        // Session doesn't need explicit disposal in newer versions
        this.session = null
      } catch { /* ignore */ }
    }
    if (this.context) {
      try {
        await this.context.dispose()
      } catch { /* ignore */ }
    }
    if (this.model) {
      try {
        await this.model.dispose()
      } catch { /* ignore */ }
    }
    this.isLoaded = false
    this.model = null
    this.context = null
    this.session = null
  }

  async deleteModel(): Promise<boolean> {
    try {
      await this.unload()
      if (fs.existsSync(this.modelPath)) {
        fs.rmSync(this.modelPath, { recursive: true, force: true })
        log.info('LLM model deleted', { path: this.modelPath }, 'llm')
        return true
      }
    } catch (e) {
      log.error('Error deleting model', e, 'llm')
    }
    return false
  }

  getModelInfo() {
    let size = 0
    if (fs.existsSync(this.config.modelPath)) {
      try {
        size = fs.statSync(this.config.modelPath).size
      } catch {}
    }

    return {
      loaded: this.isLoaded,
      modelPath: this.config.modelPath,
      modelName: this.config.modelName,
      exists: fs.existsSync(this.config.modelPath),
      contextLength: this.config.contextLength,
      size,
      availableModels: Object.entries(LLM_MODELS).map(([name, info]) => ({
        name,
        size: info.size,
        contextLength: info.contextLength,
        downloaded: fs.existsSync(path.join(this.modelPath, info.filename)),
      })),
    }
  }

  getAvailableModels() {
    return Object.entries(LLM_MODELS).map(([name, info]) => ({
      name,
      size: info.size,
      contextLength: info.contextLength,
      downloaded: fs.existsSync(path.join(this.modelPath, info.filename)),
      path: path.join(this.modelPath, info.filename),
    }))
  }
}

// Singleton instance
let llmBridge: LLMBridge | null = null

export function getLLMBridge(): LLMBridge {
  if (!llmBridge) {
    llmBridge = new LLMBridge()
  }
  return llmBridge
}

// Register IPC handlers
export function registerLLMHandlers() {
  const bridge = getLLMBridge()

  ipcMain.handle('llm:init', async () => {
    return await bridge.initialize()
  })

  ipcMain.handle('llm:generate', async (_event, request: GenerateRequest) => {
    return await bridge.generate(request)
  })

  ipcMain.handle('llm:generateStream', async (event, request: GenerateRequest) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    
    return await bridge.generateStream(request, (chunk: string) => {
      if (window && !window.isDestroyed()) {
        window.webContents.send('llm:chunk', chunk)
      }
    })
  })

  ipcMain.handle('llm:getInfo', async () => {
    return bridge.getModelInfo()
  })

  ipcMain.handle('llm:getModels', async () => {
    return bridge.getAvailableModels()
  })

  ipcMain.handle('llm:setModel', async (_event, modelName: string) => {
    return await bridge.setModel(modelName)
  })

  ipcMain.handle('llm:unload', async () => {
    await bridge.unload()
    return true
  })

  ipcMain.handle('llm:downloadModel', async (event, modelName: string) => {
    const result = await bridge.downloadModel(modelName, (downloaded, total) => {
      const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0
      event.sender.send('llm:downloadProgress', {
        modelName,
        downloaded,
        total,
        percent,
      })
    })

    return result
  })

  ipcMain.handle('llm:deleteModel', async () => {
    return await bridge.deleteModel()
  })

  ipcMain.handle('llm:cancelDownload', async () => {
    bridge.cancelDownload()
    return true
  })
}
