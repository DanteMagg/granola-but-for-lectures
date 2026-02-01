// Renderer process logger
// Bridges to main process logger via IPC for persistent file logging

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerOptions {
  /** Whether to also output to browser console (default: true in dev) */
  console?: boolean
  /** Source identifier for log entries */
  source?: string
}

// Check if we're in development mode
const isDev = typeof import.meta !== 'undefined' && 
  (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true

class RendererLogger {
  private options: LoggerOptions

  constructor(options: LoggerOptions = {}) {
    this.options = {
      console: options.console ?? isDev,
      source: options.source,
    }
  }

  private async log(level: LogLevel, message: string, data?: unknown): Promise<void> {
    const source = this.options.source || 'renderer'

    // Output to console if enabled
    if (this.options.console) {
      const formattedMsg = `[${source}] ${message}`
      switch (level) {
        case 'debug':
          console.debug(formattedMsg, data ?? '')
          break
        case 'info':
          console.info(formattedMsg, data ?? '')
          break
        case 'warn':
          console.warn(formattedMsg, data ?? '')
          break
        case 'error':
          console.error(formattedMsg, data ?? '')
          break
      }
    }

    // Send to main process for file logging
    try {
      if (window.electronAPI?.logsWrite) {
        await window.electronAPI.logsWrite(level, message, data)
      }
    } catch {
      // Silently fail if IPC is not available
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data)
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data)
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data)
  }

  error(message: string, error?: unknown): void {
    const data = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error
    this.log('error', message, data)
  }

  /** Create a child logger with a specific source */
  child(source: string): RendererLogger {
    return new RendererLogger({
      ...this.options,
      source,
    })
  }
}

// Default logger instance
export const log = new RendererLogger()

// Factory for creating component-specific loggers
export function createLogger(source: string): RendererLogger {
  return new RendererLogger({ source })
}
