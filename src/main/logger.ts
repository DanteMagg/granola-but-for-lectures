import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: unknown
  source?: string
}

const MAX_LOG_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_LOG_FILES = 5

class Logger {
  private logDir: string
  private logFile: string
  private initialized = false
  private writeQueue: string[] = []
  private isWriting = false

  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs')
    this.logFile = path.join(this.logDir, 'app.log')
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      await fsPromises.mkdir(this.logDir, { recursive: true })
      this.initialized = true
      this.info('Logger initialized', { logDir: this.logDir })
    } catch (error) {
      console.error('Failed to initialize logger:', error)
    }
  }

  private formatEntry(entry: LogEntry): string {
    const { timestamp, level, message, data, source } = entry
    const sourceStr = source ? `[${source}]` : ''
    const dataStr = data ? ` ${JSON.stringify(data)}` : ''
    return `${timestamp} [${level.toUpperCase()}]${sourceStr} ${message}${dataStr}\n`
  }

  private async write(entry: LogEntry): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }

    const line = this.formatEntry(entry)
    
    // Add to queue
    this.writeQueue.push(line)
    
    // Process queue if not already writing
    if (!this.isWriting) {
      await this.processQueue()
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) return

    this.isWriting = true
    
    try {
      // Check if log rotation is needed
      await this.rotateIfNeeded()

      // Write all queued entries
      const lines = this.writeQueue.splice(0)
      const content = lines.join('')
      
      await fsPromises.appendFile(this.logFile, content, 'utf-8')
    } catch (error) {
      console.error('Failed to write log:', error)
    } finally {
      this.isWriting = false
      
      // Process any new entries added while writing
      if (this.writeQueue.length > 0) {
        await this.processQueue()
      }
    }
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const stats = await fsPromises.stat(this.logFile)
      
      if (stats.size >= MAX_LOG_SIZE) {
        await this.rotate()
      }
    } catch (error) {
      // File doesn't exist, no rotation needed
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Error checking log size:', error)
      }
    }
  }

  private async rotate(): Promise<void> {
    try {
      // Delete oldest log file if we have too many
      const oldestFile = path.join(this.logDir, `app.${MAX_LOG_FILES}.log`)
      try {
        await fsPromises.unlink(oldestFile)
      } catch { /* File might not exist */ }

      // Shift all log files
      for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
        const oldPath = path.join(this.logDir, `app.${i}.log`)
        const newPath = path.join(this.logDir, `app.${i + 1}.log`)
        try {
          await fsPromises.rename(oldPath, newPath)
        } catch { /* File might not exist */ }
      }

      // Rename current log file
      const newPath = path.join(this.logDir, 'app.1.log')
      await fsPromises.rename(this.logFile, newPath)
      
      this.info('Log rotated')
    } catch (error) {
      console.error('Log rotation failed:', error)
    }
  }

  private createEntry(level: LogLevel, message: string, data?: unknown, source?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      source,
    }
  }

  debug(message: string, data?: unknown, source?: string): void {
    const entry = this.createEntry('debug', message, data, source)
    console.log(this.formatEntry(entry).trim())
    this.write(entry).catch(console.error)
  }

  info(message: string, data?: unknown, source?: string): void {
    const entry = this.createEntry('info', message, data, source)
    console.log(this.formatEntry(entry).trim())
    this.write(entry).catch(console.error)
  }

  warn(message: string, data?: unknown, source?: string): void {
    const entry = this.createEntry('warn', message, data, source)
    console.warn(this.formatEntry(entry).trim())
    this.write(entry).catch(console.error)
  }

  error(message: string, error?: unknown, source?: string): void {
    const data = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error
    const entry = this.createEntry('error', message, data, source)
    console.error(this.formatEntry(entry).trim())
    this.write(entry).catch(console.error)
  }

  async getLogContent(): Promise<string> {
    try {
      return await fsPromises.readFile(this.logFile, 'utf-8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return ''
      }
      throw error
    }
  }

  async getAllLogs(): Promise<string> {
    const logs: string[] = []

    try {
      // Read current log
      try {
        const current = await fsPromises.readFile(this.logFile, 'utf-8')
        logs.push(`=== Current Log ===\n${current}`)
      } catch { /* File might not exist */ }

      // Read rotated logs
      for (let i = 1; i <= MAX_LOG_FILES; i++) {
        const file = path.join(this.logDir, `app.${i}.log`)
        try {
          const content = await fsPromises.readFile(file, 'utf-8')
          logs.push(`=== Log ${i} (older) ===\n${content}`)
        } catch { /* File might not exist */ }
      }

      return logs.join('\n\n')
    } catch (error) {
      console.error('Error reading logs:', error)
      return ''
    }
  }

  async clearLogs(): Promise<void> {
    try {
      // Delete current log
      try {
        await fsPromises.unlink(this.logFile)
      } catch { /* File might not exist */ }

      // Delete rotated logs
      for (let i = 1; i <= MAX_LOG_FILES; i++) {
        const file = path.join(this.logDir, `app.${i}.log`)
        try {
          await fsPromises.unlink(file)
        } catch { /* File might not exist */ }
      }

      this.info('Logs cleared')
    } catch (error) {
      console.error('Error clearing logs:', error)
    }
  }

  getLogPath(): string {
    return this.logDir
  }
}

// Singleton instance
export const logger = new Logger()

// Convenience functions
export const log = {
  debug: (msg: string, data?: unknown, source?: string) => logger.debug(msg, data, source),
  info: (msg: string, data?: unknown, source?: string) => logger.info(msg, data, source),
  warn: (msg: string, data?: unknown, source?: string) => logger.warn(msg, data, source),
  error: (msg: string, err?: unknown, source?: string) => logger.error(msg, err, source),
}

