/**
 * Worker Manager
 * Manages worker thread lifecycle and communication
 */
import { Worker } from 'worker_threads'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { log } from '../logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface PendingRequest {
  resolve: (value: any) => void
  reject: (error: Error) => void
  onChunk?: (chunk: string) => void
}

export class WorkerManager {
  private worker: Worker | null = null
  private pendingRequests: Map<string, PendingRequest> = new Map()
  private requestId = 0
  private workerPath: string
  private workerName: string
  private isReady = false
  private readyPromise: Promise<void>
  private readyResolve!: () => void

  constructor(workerPath: string, workerName: string) {
    this.workerPath = workerPath
    this.workerName = workerName
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve
    })
  }

  async start(): Promise<boolean> {
    try {
      // Resolve worker path relative to this file's directory
      const resolvedPath = path.resolve(__dirname, this.workerPath)
      
      log.info(`Starting ${this.workerName} worker`, { path: resolvedPath }, 'worker')
      
      this.worker = new Worker(resolvedPath, {
        execArgv: ['--experimental-specifier-resolution=node']
      })

      this.worker.on('message', (message) => {
        this.handleMessage(message)
      })

      this.worker.on('error', (error) => {
        log.error(`${this.workerName} worker error`, error, 'worker')
        this.handleWorkerError(error)
      })

      this.worker.on('exit', (code) => {
        log.info(`${this.workerName} worker exited`, { code }, 'worker')
        if (code !== 0) {
          this.handleWorkerError(new Error(`Worker exited with code ${code}`))
        }
        this.worker = null
        this.isReady = false
      })

      // Wait for worker to be ready
      await this.readyPromise
      return true
    } catch (error) {
      log.error(`Failed to start ${this.workerName} worker`, error, 'worker')
      return false
    }
  }

  private handleMessage(message: any): void {
    const { type, id, payload } = message

    if (type === 'ready') {
      this.isReady = true
      this.readyResolve()
      log.info(`${this.workerName} worker ready`, undefined, 'worker')
      return
    }

    const pending = this.pendingRequests.get(id)
    if (!pending) {
      log.warn(`Received response for unknown request`, { id, type }, 'worker')
      return
    }

    switch (type) {
      case 'result':
        pending.resolve(payload)
        this.pendingRequests.delete(id)
        break

      case 'error':
        pending.reject(new Error(payload.error || 'Worker error'))
        this.pendingRequests.delete(id)
        break

      case 'chunk':
        // Streaming chunk - don't remove from pending
        if (pending.onChunk) {
          pending.onChunk(payload.chunk)
        }
        break
    }
  }

  private handleWorkerError(error: Error): void {
    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(error)
    }
    this.pendingRequests.clear()
  }

  async send<T>(type: string, payload: any, onChunk?: (chunk: string) => void): Promise<T> {
    if (!this.worker || !this.isReady) {
      throw new Error(`${this.workerName} worker not ready`)
    }

    const id = `${this.workerName}-${++this.requestId}`

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject, onChunk })
      this.worker!.postMessage({ type, payload, id })
    })
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate()
      this.worker = null
      this.isReady = false
    }
  }

  get ready(): boolean {
    return this.isReady
  }
}

