/**
 * Whisper Worker Thread
 * Handles CPU-intensive transcription in a separate thread to prevent blocking the main process
 */
import { parentPort, workerData } from 'worker_threads'
import * as path from 'path'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'

interface TranscriptionSegment {
  start: number
  end: number
  text: string
  confidence: number
}

interface TranscriptionResult {
  text: string
  segments: TranscriptionSegment[]
}

interface WorkerMessage {
  type: 'transcribe' | 'init' | 'setModel'
  payload: any
  id: string
}

interface WorkerResponse {
  type: 'result' | 'error' | 'ready'
  id: string
  payload: any
}

// Worker state
let whisperModule: any = null
let isLoaded = false
let config = {
  modelPath: '',
  modelName: 'base.en',
  language: 'en',
}

async function loadWhisperModule(): Promise<any> {
  try {
    const whisperNode: any = await import('whisper-node')
    const whisperFn = whisperNode.default?.default || whisperNode.default || whisperNode.whisper || whisperNode

    if (typeof whisperFn === 'function') {
      return whisperFn
    }

    if (typeof whisperFn?.transcribe === 'function') {
      return whisperFn.transcribe.bind(whisperFn)
    }
    if (typeof whisperFn?.whisper === 'function') {
      return whisperFn.whisper.bind(whisperFn)
    }

    return null
  } catch (e) {
    return null
  }
}

async function initialize(modelPath: string, modelName: string): Promise<boolean> {
  if (!fs.existsSync(modelPath)) {
    return false
  }

  config.modelPath = modelPath
  config.modelName = modelName

  try {
    whisperModule = await loadWhisperModule()
    if (whisperModule) {
      isLoaded = true
      return true
    }
  } catch (error) {
    isLoaded = false
  }

  return false
}

function fallbackTranscribe(): TranscriptionResult {
  return {
    text: '[Transcription requires Whisper model. Download from Settings.]',
    segments: [{
      start: 0,
      end: 5000,
      text: '[Whisper model not loaded]',
      confidence: 0,
    }],
  }
}

async function transcribe(audioBuffer: Buffer, tempDir: string): Promise<TranscriptionResult> {
  if (!isLoaded || !whisperModule || typeof whisperModule !== 'function') {
    return fallbackTranscribe()
  }

  const tempFile = path.join(tempDir, `whisper-worker-${Date.now()}.wav`)

  try {
    await fsPromises.writeFile(tempFile, audioBuffer)

    const whisperOptions = {
      modelName: config.modelName,
      modelPath: config.modelPath,
      whisperOptions: {
        language: config.language,
        word_timestamps: true,
        gen_file_txt: false,
        gen_file_subtitle: false,
        gen_file_vtt: false,
      }
    }

    const result = await whisperModule(tempFile, whisperOptions)

    if (Array.isArray(result)) {
      const segments: TranscriptionSegment[] = result.map((seg: any, index: number) => ({
        start: seg.start || (index * 1000),
        end: seg.end || ((index + 1) * 1000),
        text: seg.speech || seg.text || '',
        confidence: seg.confidence || 0.9,
      }))

      const fullText = segments.map(s => s.text).join(' ').trim()

      return {
        text: fullText,
        segments: segments.filter(s => s.text.trim().length > 0),
      }
    }

    if (typeof result === 'string') {
      return {
        text: result,
        segments: [{
          start: 0,
          end: 5000,
          text: result,
          confidence: 0.9,
        }],
      }
    }

    if (result && typeof result === 'object') {
      const text = result.text || result.transcription || ''
      return {
        text,
        segments: [{
          start: 0,
          end: 5000,
          text,
          confidence: 0.9,
        }],
      }
    }

    return fallbackTranscribe()
  } catch (error) {
    return fallbackTranscribe()
  } finally {
    try {
      await fsPromises.unlink(tempFile)
    } catch { /* ignore cleanup errors */ }
  }
}

// Message handler
if (parentPort) {
  parentPort.on('message', async (message: WorkerMessage) => {
    const { type, payload, id } = message

    try {
      switch (type) {
        case 'init': {
          const success = await initialize(payload.modelPath, payload.modelName)
          parentPort!.postMessage({
            type: 'result',
            id,
            payload: { success }
          } as WorkerResponse)
          break
        }

        case 'transcribe': {
          const audioBuffer = Buffer.from(payload.audioBase64, 'base64')
          const result = await transcribe(audioBuffer, payload.tempDir)
          parentPort!.postMessage({
            type: 'result',
            id,
            payload: result
          } as WorkerResponse)
          break
        }

        case 'setModel': {
          config.modelPath = payload.modelPath
          config.modelName = payload.modelName
          isLoaded = false
          const success = await initialize(payload.modelPath, payload.modelName)
          parentPort!.postMessage({
            type: 'result',
            id,
            payload: { success }
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

