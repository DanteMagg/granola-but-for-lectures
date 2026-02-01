import { ipcMain, app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import * as https from 'https'
import * as http from 'http'
import { log } from '../logger.js'

// Whisper integration bridge
// Uses whisper-node for actual transcription

interface WhisperConfig {
  modelPath: string
  modelName: string
  language: string
  sampleRate: number
}

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

// Model information
const WHISPER_MODELS: Record<string, { url: string; size: string; filename: string }> = {
  'tiny': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    size: '75 MB',
    filename: 'ggml-tiny.bin'
  },
  'tiny.en': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
    size: '75 MB',
    filename: 'ggml-tiny.en.bin'
  },
  'base': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    size: '142 MB',
    filename: 'ggml-base.bin'
  },
  'base.en': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
    size: '142 MB',
    filename: 'ggml-base.en.bin'
  },
  'small': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    size: '466 MB',
    filename: 'ggml-small.bin'
  },
  'small.en': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
    size: '466 MB',
    filename: 'ggml-small.en.bin'
  },
  'medium': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    size: '1.5 GB',
    filename: 'ggml-medium.bin'
  },
  'medium.en': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin',
    size: '1.5 GB',
    filename: 'ggml-medium.en.bin'
  },
}

class WhisperBridge {
  private config: WhisperConfig
  private isLoaded: boolean = false
  private modelPath: string
  private whisperModule: any = null
  private downloadAbortController: AbortController | null = null

  constructor() {
    const userDataPath = app.getPath('userData')
    this.modelPath = path.join(userDataPath, 'models', 'whisper')
    
    this.config = {
      modelPath: path.join(this.modelPath, 'ggml-base.en.bin'),
      modelName: 'base.en',
      language: 'en',
      sampleRate: 16000,
    }
  }

  async initialize(): Promise<boolean> {
    // Check if model exists
    if (!fs.existsSync(this.config.modelPath)) {
      log.info('Whisper model not found', { path: this.config.modelPath }, 'whisper')
      return false
    }

    try {
      // Dynamic import of whisper-node
      this.whisperModule = await this.loadWhisperModule()
      if (this.whisperModule) {
        this.isLoaded = true
        log.info('Whisper initialized', { model: this.config.modelName }, 'whisper')
        return true
      }
    } catch (error) {
      log.error('Failed to initialize Whisper', error, 'whisper')
    }
    
    return false
  }

  private async loadWhisperModule(): Promise<any> {
    try {
      // Try to dynamically import whisper-node
      const whisperNode = await import('whisper-node')
      return whisperNode.default || whisperNode
    } catch (e) {
      log.debug('whisper-node not available', e, 'whisper')
      return null
    }
  }

  async transcribe(audioBuffer: Buffer, options?: { tempDir?: string }): Promise<TranscriptionResult> {
    if (!this.isLoaded || !this.whisperModule) {
      log.debug('Whisper not loaded, using fallback', undefined, 'whisper')
      return this.fallbackTranscribe()
    }

    const tempDir = options?.tempDir || app.getPath('temp')
    const tempFile = path.join(tempDir, `whisper-${Date.now()}.wav`)

    try {
      // Write audio buffer to temp file
      // whisper-node expects a WAV file path
      await fsPromises.writeFile(tempFile, audioBuffer)

      // Configure whisper-node options
      const whisperOptions = {
        modelName: this.config.modelName,
        modelPath: this.config.modelPath,
        whisperOptions: {
          language: this.config.language,
          word_timestamps: true,
          gen_file_txt: false,
          gen_file_subtitle: false,
          gen_file_vtt: false,
        }
      }

      log.debug('Running Whisper transcription', { file: tempFile }, 'whisper')
      
      // Run transcription
      const result = await this.whisperModule(tempFile, whisperOptions)

      // Parse result based on whisper-node output format
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

      // Handle string result
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

      // Handle object result
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

      return this.fallbackTranscribe()
    } catch (error) {
      log.error('Transcription error', error, 'whisper')
      return this.fallbackTranscribe()
    } finally {
      // Clean up temp file
      try {
        await fsPromises.unlink(tempFile)
      } catch { /* ignore cleanup errors */ }
    }
  }

  private fallbackTranscribe(): TranscriptionResult {
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

  async downloadModel(
    modelName: string = 'base.en',
    onProgress?: (downloaded: number, total: number) => void
  ): Promise<{ success: boolean; error?: string }> {
    const modelInfo = WHISPER_MODELS[modelName]
    if (!modelInfo) {
      return { success: false, error: `Unknown model: ${modelName}` }
    }

    // Create models directory
    await fsPromises.mkdir(this.modelPath, { recursive: true })

    const destPath = path.join(this.modelPath, modelInfo.filename)

    // Check if already downloaded
    if (fs.existsSync(destPath)) {
      const stats = await fsPromises.stat(destPath)
      if (stats.size > 1000000) { // At least 1MB
        log.info('Model already exists', { modelName, path: destPath }, 'whisper')
        // Update config to use this model
        this.config.modelPath = destPath
        this.config.modelName = modelName
        return { success: true }
      }
    }

    log.info('Downloading Whisper model', { modelName, url: modelInfo.url }, 'whisper')

    // Create abort controller for cancellation
    this.downloadAbortController = new AbortController()

    try {
      await this.downloadFile(modelInfo.url, destPath, onProgress)
      
      // Update config to use new model
      this.config.modelPath = destPath
      this.config.modelName = modelName
      
      // Re-initialize with new model
      this.isLoaded = false
      await this.initialize()
      
      return { success: true }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message === 'Download cancelled') {
        // Clean up partial download
        try {
          await fsPromises.unlink(destPath)
        } catch { /* ignore */ }
        log.info('Model download cancelled', { modelName }, 'whisper')
        return { success: false, error: 'Download cancelled' }
      }
      log.error('Model download failed', error, 'whisper')
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
            log.debug('Following redirect', { redirectUrl }, 'whisper')
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
          fs.unlink(destPath, () => {}) // Clean up on error
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
    const modelInfo = WHISPER_MODELS[modelName]
    if (modelInfo) {
      const newPath = path.join(this.modelPath, modelInfo.filename)
      if (fs.existsSync(newPath)) {
        this.config.modelPath = newPath
        this.config.modelName = modelName
        this.isLoaded = false // Need to reinitialize
        return await this.initialize()
      }
    }
    return false
  }

  async deleteModel(): Promise<boolean> {
    if (fs.existsSync(this.modelPath)) {
      try {
        fs.rmSync(this.modelPath, { recursive: true, force: true })
        this.isLoaded = false
        log.info('Whisper model deleted', { path: this.modelPath }, 'whisper')
        return true
      } catch (e) {
        log.error('Failed to delete model', e, 'whisper')
        return false
      }
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
      language: this.config.language,
      size,
      availableModels: Object.entries(WHISPER_MODELS).map(([name, info]) => ({
        name,
        size: info.size,
        downloaded: fs.existsSync(path.join(this.modelPath, info.filename)),
      })),
    }
  }

  getAvailableModels() {
    return Object.entries(WHISPER_MODELS).map(([name, info]) => ({
      name,
      size: info.size,
      downloaded: fs.existsSync(path.join(this.modelPath, info.filename)),
      path: path.join(this.modelPath, info.filename),
    }))
  }
}

// Singleton instance
let whisperBridge: WhisperBridge | null = null

export function getWhisperBridge(): WhisperBridge {
  if (!whisperBridge) {
    whisperBridge = new WhisperBridge()
  }
  return whisperBridge
}

// Register IPC handlers
export function registerWhisperHandlers() {
  const bridge = getWhisperBridge()

  ipcMain.handle('whisper:init', async () => {
    return await bridge.initialize()
  })

  ipcMain.handle('whisper:transcribe', async (_event, audioBase64: string) => {
    const audioBuffer = Buffer.from(audioBase64, 'base64')
    return await bridge.transcribe(audioBuffer)
  })

  ipcMain.handle('whisper:getInfo', async () => {
    return bridge.getModelInfo()
  })

  ipcMain.handle('whisper:getModels', async () => {
    return bridge.getAvailableModels()
  })

  ipcMain.handle('whisper:setModel', async (_event, modelName: string) => {
    return await bridge.setModel(modelName)
  })

  ipcMain.handle('whisper:downloadModel', async (event, modelName: string) => {
    const result = await bridge.downloadModel(modelName, (downloaded, total) => {
      const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0
      event.sender.send('whisper:downloadProgress', {
        modelName,
        downloaded,
        total,
        percent,
      })
    })

    return result
  })

  ipcMain.handle('whisper:deleteModel', async () => {
    return await bridge.deleteModel()
  })

  ipcMain.handle('whisper:cancelDownload', async () => {
    bridge.cancelDownload()
    return true
  })
}
