import { ipcMain, app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import * as https from 'https'
import * as http from 'http'
import * as crypto from 'crypto'
import { log } from '../logger.js'
import { WorkerManager } from '../workers/worker-manager.js'
import { validateAudioInput, ALLOWED_WHISPER_MODELS, validateModelName } from '../security.js'

// Whisper integration bridge
// Uses worker thread for CPU-intensive transcription to prevent blocking IPC

/**
 * Verify file integrity using SHA256 hash
 */
async function verifyFileHash(filePath: string, expectedHash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => {
      const calculatedHash = hash.digest('hex')
      const matches = calculatedHash === expectedHash
      if (!matches) {
        log.warn('Hash verification failed', { 
          expected: expectedHash, 
          calculated: calculatedHash,
          filePath 
        }, 'security')
      }
      resolve(matches)
    })
    stream.on('error', reject)
  })
}

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

// Model information with SHA256 hashes for integrity verification
// Hashes from: https://huggingface.co/ggerganov/whisper.cpp/tree/main
const WHISPER_MODELS: Record<string, { url: string; size: string; filename: string; sha256?: string }> = {
  'tiny': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
    size: '75 MB',
    filename: 'ggml-tiny.bin',
    sha256: 'be07e048e1e599ad46341c8d2a135645097a538221678b7acdd1b1919c6e1b21',
  },
  'tiny.en': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin',
    size: '75 MB',
    filename: 'ggml-tiny.en.bin',
    sha256: '921e4cf8f1f5078d9c605a3ce5a94a958b58e5d0f7ad49bc126c5f8b4cf2c9f8',
  },
  'base': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    size: '142 MB',
    filename: 'ggml-base.bin',
    sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
  },
  'base.en': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin',
    size: '142 MB',
    filename: 'ggml-base.en.bin',
    sha256: 'a03779c86df3323075f5e796b5b488d80369c6f25e0c27de282b51b535219fe4',
  },
  'small': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
    size: '466 MB',
    filename: 'ggml-small.bin',
    sha256: '1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1c5ee3de6e',
  },
  'small.en': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin',
    size: '466 MB',
    filename: 'ggml-small.en.bin',
    // sha256 not verified - remove to skip hash verification for this model
  },
  'medium': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
    size: '1.5 GB',
    filename: 'ggml-medium.bin',
    sha256: '6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208',
  },
  'medium.en': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.en.bin',
    size: '1.5 GB',
    filename: 'ggml-medium.en.bin',
    // sha256 not verified - remove to skip hash verification for this model
  },
}

// Skip hash verification in development (hashes may not be finalized)
const SKIP_HASH_VERIFICATION = process.env.NODE_ENV !== 'production' && !app.isPackaged

// Minimum expected file sizes for model validation (in bytes)
const MODEL_MIN_SIZES: Record<string, number> = {
  'tiny': 70 * 1024 * 1024,      // ~75 MB
  'tiny.en': 70 * 1024 * 1024,
  'base': 130 * 1024 * 1024,     // ~142 MB
  'base.en': 130 * 1024 * 1024,
  'small': 450 * 1024 * 1024,    // ~466 MB
  'small.en': 450 * 1024 * 1024,
  'medium': 1400 * 1024 * 1024,  // ~1.5 GB
  'medium.en': 1400 * 1024 * 1024,
}

class WhisperBridge {
  private config: WhisperConfig
  private isLoaded: boolean = false
  private modelPath: string
  private whisperModule: any = null
  private downloadAbortController: AbortController | null = null
  private workerManager: WorkerManager | null = null
  private useWorker: boolean = true

  constructor() {
    const userDataPath = app.getPath('userData')
    this.modelPath = path.join(userDataPath, 'models', 'whisper')

    this.config = {
      modelPath: path.join(this.modelPath, 'ggml-base.en.bin'),
      modelName: 'base.en',
      language: 'en',
      sampleRate: 16000,
    }

    // Clean up any stale temp files from previous sessions on startup
    this.cleanupTempFiles()
  }

  /**
   * Start the worker thread for background transcription
   */
  private async startWorker(): Promise<boolean> {
    if (this.workerManager?.ready) {
      return true
    }

    try {
      this.workerManager = new WorkerManager('./whisper-worker.js', 'whisper')
      const started = await this.workerManager.start()
      
      if (started) {
        // Initialize the worker with the model
        const result = await this.workerManager.send<{ success: boolean }>('init', {
          modelPath: this.config.modelPath,
          modelName: this.config.modelName,
        })
        return result.success
      }
    } catch (error) {
      log.warn('Failed to start Whisper worker, falling back to main thread', error, 'whisper')
      this.useWorker = false
    }
    return false
  }

  /**
   * Clean up stale whisper temp files from previous sessions
   */
  private async cleanupTempFiles(): Promise<void> {
    try {
      const tempDir = app.getPath('temp')
      const files = await fsPromises.readdir(tempDir)
      const whisperFiles = files.filter(f => f.startsWith('whisper-') && f.endsWith('.wav'))

      for (const file of whisperFiles) {
        try {
          const filePath = path.join(tempDir, file)
          const stats = await fsPromises.stat(filePath)
          // Only delete files older than 1 hour
          const ageMs = Date.now() - stats.mtime.getTime()
          if (ageMs > 60 * 60 * 1000) {
            await fsPromises.unlink(filePath)
            log.debug('Cleaned up stale temp file', { file }, 'whisper')
          }
        } catch { /* ignore individual file errors */ }
      }
    } catch (error) {
      log.debug('Temp file cleanup failed (non-critical)', error, 'whisper')
    }
  }

  async initialize(): Promise<boolean> {
    // Check if model exists
    if (!fs.existsSync(this.config.modelPath)) {
      log.info('Whisper model not found', { path: this.config.modelPath }, 'whisper')
      return false
    }

    // Validate model file size
    const stats = fs.statSync(this.config.modelPath)
    const minSize = MODEL_MIN_SIZES[this.config.modelName] || 50 * 1024 * 1024
    if (stats.size < minSize) {
      log.error('Model file too small, likely incomplete download', {
        size: stats.size,
        expectedMin: minSize,
        modelName: this.config.modelName
      }, 'whisper')
      return false
    }

    // Try to start worker thread first (non-blocking transcription)
    if (this.useWorker) {
      const workerStarted = await this.startWorker()
      if (workerStarted) {
        this.isLoaded = true
        log.info('Whisper initialized with worker thread', {
          model: this.config.modelName,
          size: stats.size
        }, 'whisper')
        return true
      }
    }

    // Fallback to main thread (blocks IPC during transcription)
    try {
      // Dynamic import of whisper-node
      this.whisperModule = await this.loadWhisperModule()
      if (this.whisperModule) {
        this.isLoaded = true
        log.info('Whisper initialized (main thread fallback)', {
          model: this.config.modelName,
          size: stats.size
        }, 'whisper')
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
      // Cast to any for flexible property access since module structure varies
      const whisperNode: any = await import('whisper-node')
      log.debug('whisper-node module structure', {
        keys: Object.keys(whisperNode),
        hasDefault: 'default' in whisperNode,
        defaultType: typeof whisperNode.default,
      }, 'whisper')

      // whisper-node exports the function as default
      // In ES modules, it might be whisperNode.default.default or just whisperNode.default
      const whisperFn = whisperNode.default?.default || whisperNode.default || whisperNode.whisper || whisperNode

      if (typeof whisperFn === 'function') {
        return whisperFn
      }

      // If it's still not a function, check if it has a transcribe or whisper method
      if (typeof whisperFn?.transcribe === 'function') {
        return whisperFn.transcribe.bind(whisperFn)
      }
      if (typeof whisperFn?.whisper === 'function') {
        return whisperFn.whisper.bind(whisperFn)
      }

      log.warn('whisper-node module did not export expected function', {
        type: typeof whisperFn,
        keys: whisperFn ? Object.keys(whisperFn) : []
      }, 'whisper')
      return null
    } catch (e) {
      log.debug('whisper-node not available', e, 'whisper')
      return null
    }
  }

  async transcribe(audioBuffer: Buffer, options?: { tempDir?: string }): Promise<TranscriptionResult> {
    if (!this.isLoaded) {
      log.debug('Whisper not loaded, using fallback', undefined, 'whisper')
      return this.fallbackTranscribe()
    }

    const tempDir = options?.tempDir || app.getPath('temp')

    // Use worker thread if available (non-blocking)
    if (this.workerManager?.ready) {
      try {
        log.debug('Running Whisper transcription in worker', undefined, 'whisper')
        const result = await this.workerManager.send<TranscriptionResult>('transcribe', {
          audioBase64: audioBuffer.toString('base64'),
          tempDir,
        })
        return result
      } catch (error) {
        log.error('Worker transcription failed, trying main thread', error, 'whisper')
        // Fall through to main thread
      }
    }

    // Main thread fallback (blocks IPC)
    if (!this.whisperModule || typeof this.whisperModule !== 'function') {
      log.error('whisperModule is not a function', {
        type: typeof this.whisperModule,
        value: this.whisperModule ? String(this.whisperModule).substring(0, 100) : 'null'
      }, 'whisper')
      return this.fallbackTranscribe()
    }

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

      log.debug('Running Whisper transcription (main thread)', { 
        file: tempFile,
        modelPath: this.config.modelPath,
        moduleType: typeof this.whisperModule
      }, 'whisper')
      
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

    // Check if already downloaded with proper size validation
    if (fs.existsSync(destPath)) {
      const stats = await fsPromises.stat(destPath)
      const minSize = MODEL_MIN_SIZES[modelName] || 50 * 1024 * 1024 // Default 50MB min
      if (stats.size >= minSize) {
        log.info('Model already exists', { modelName, path: destPath, size: stats.size }, 'whisper')
        // Update config to use this model
        this.config.modelPath = destPath
        this.config.modelName = modelName
        return { success: true }
      } else {
        log.warn('Existing model file too small, re-downloading', {
          modelName,
          actualSize: stats.size,
          expectedMin: minSize
        }, 'whisper')
        // Delete incomplete file
        try {
          await fsPromises.unlink(destPath)
        } catch { /* ignore */ }
      }
    }

    log.info('Downloading Whisper model', { modelName, url: modelInfo.url }, 'whisper')

    // Create abort controller for cancellation
    this.downloadAbortController = new AbortController()

    // Retry configuration
    const maxRetries = 3
    const baseDelayMs = 2000

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.downloadFile(modelInfo.url, destPath, onProgress)

        // Security: Verify file hash if available
        if (modelInfo.sha256 && !SKIP_HASH_VERIFICATION) {
          log.info('Verifying model hash', { modelName }, 'security')
          const isValid = await verifyFileHash(destPath, modelInfo.sha256)
          if (!isValid) {
            await fsPromises.unlink(destPath)
            log.error('Model hash verification failed', { modelName }, 'security')
            return { success: false, error: 'Downloaded file failed integrity check. Please try again.' }
          }
          log.info('Model hash verified successfully', { modelName }, 'security')
        }

        // Update config to use new model
        this.config.modelPath = destPath
        this.config.modelName = modelName

        // Re-initialize with new model
        this.isLoaded = false
        await this.initialize()

        return { success: true }
      } catch (error: any) {
        // Don't retry if user cancelled
        if (error.name === 'AbortError' || error.message === 'Download cancelled') {
          try {
            await fsPromises.unlink(destPath)
          } catch { /* ignore */ }
          log.info('Model download cancelled', { modelName }, 'whisper')
          this.downloadAbortController = null
          return { success: false, error: 'Download cancelled' }
        }

        // Check if we should retry
        const isLastAttempt = attempt === maxRetries
        const isNetworkError = error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          error.code === 'ENOTFOUND' ||
          error.message?.includes('network') ||
          error.message?.includes('socket') ||
          error.message?.includes('Incomplete download')

        if (isLastAttempt || !isNetworkError) {
          log.error('Model download failed', { error, attempt, maxRetries }, 'whisper')
          this.downloadAbortController = null
          return { success: false, error: error.message || 'Download failed' }
        }

        // Clean up partial download before retry
        try {
          await fsPromises.unlink(destPath)
        } catch { /* ignore */ }

        // Exponential backoff: 2s, 4s, 8s
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1)
        log.info('Download failed, retrying', { attempt, maxRetries, delayMs, error: error.message }, 'whisper')
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }

    this.downloadAbortController = null
    return { success: false, error: 'Download failed after retries' }
  }

  cancelDownload(): void {
    if (this.downloadAbortController) {
      this.downloadAbortController.abort()
    }
  }

  private downloadFile(
    url: string,
    destPath: string,
    onProgress?: (downloaded: number, total: number) => void,
    redirectCount: number = 0
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (redirectCount > 10) {
        reject(new Error('Too many redirects'))
        return
      }

      const handleResponse = (response: http.IncomingMessage) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            log.debug('Following redirect', { redirectUrl: redirectUrl.substring(0, 100) }, 'whisper')
            this.downloadFile(redirectUrl, destPath, onProgress, redirectCount + 1)
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

        log.info('Download started', { totalSize, destPath }, 'whisper')

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
          log.info('Download complete', { downloadedSize, totalSize, destPath }, 'whisper')

          // Verify download completeness
          if (totalSize > 0 && downloadedSize < totalSize * 0.99) {
            fsPromises.unlink(destPath).catch(() => {})
            reject(new Error(`Incomplete download: got ${downloadedSize} of ${totalSize} bytes`))
            return
          }

          resolve()
        })

        writeStream.on('error', (err) => {
          log.error('Write stream error', err, 'whisper')
          fsPromises.unlink(destPath).catch(() => {}) // Clean up on error
          reject(err)
        })

        response.on('error', (err) => {
          log.error('Response stream error', err, 'whisper')
          writeStream.close()
          fsPromises.unlink(destPath).catch(() => {})
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

      request.on('error', (err) => {
        log.error('Request error', err, 'whisper')
        reject(err)
      })
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
        
        // Update worker if running
        if (this.workerManager?.ready) {
          try {
            await this.workerManager.send('setModel', {
              modelPath: newPath,
              modelName,
            })
          } catch (error) {
            log.warn('Failed to update worker model', error, 'whisper')
          }
        }
        
        return await this.initialize()
      }
    }
    return false
  }

  async deleteModel(): Promise<boolean> {
    try {
      await fsPromises.rm(this.modelPath, { recursive: true, force: true })
      this.isLoaded = false
      log.info('Whisper model deleted', { path: this.modelPath }, 'whisper')
      return true
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.error('Failed to delete model', e, 'whisper')
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
    // Security: Validate audio input size and format
    const validation = validateAudioInput(audioBase64)
    if (!validation.valid) {
      log.warn('Invalid audio input rejected', { error: validation.error }, 'security')
      throw new Error(validation.error || 'Invalid audio input')
    }
    
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
    // Security: Validate model name against allowlist
    if (!validateModelName(modelName, ALLOWED_WHISPER_MODELS, 'whisper')) {
      throw new Error(`Invalid model name: ${modelName}`)
    }
    return await bridge.setModel(modelName)
  })

  ipcMain.handle('whisper:downloadModel', async (event, modelName: string) => {
    // Security: Validate model name against allowlist
    if (!validateModelName(modelName, ALLOWED_WHISPER_MODELS, 'whisper')) {
      return { success: false, error: `Invalid model name: ${modelName}` }
    }
    
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
