/**
 * Centralized Error Handler
 * Provides consistent error handling across the application with toast notifications
 */
import { toast } from '../stores/toastStore'
import { createLogger } from './logger'

const log = createLogger('errorHandler')

// Error categories for different handling strategies
export type ErrorCategory = 
  | 'session'      // Session CRUD errors
  | 'audio'        // Recording/transcription errors
  | 'ai'           // AI model errors
  | 'export'       // Export errors
  | 'network'      // Network/download errors
  | 'permission'   // Permission errors
  | 'validation'   // Validation errors
  | 'unknown'      // Uncategorized errors

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

interface ErrorContext {
  category: ErrorCategory
  operation: string
  details?: Record<string, unknown>
  silent?: boolean  // Don't show toast
  severity?: ErrorSeverity
}

interface ErrorResult {
  handled: boolean
  message: string
  toastId?: string
}

// User-friendly error messages by category
const ERROR_MESSAGES: Record<ErrorCategory, Record<string, string>> = {
  session: {
    load: 'Failed to load session',
    save: 'Failed to save session',
    delete: 'Failed to delete session',
    list: 'Failed to load sessions',
    default: 'Session error occurred',
  },
  audio: {
    permission: 'Microphone access denied',
    recording: 'Recording failed',
    transcription: 'Transcription failed',
    default: 'Audio error occurred',
  },
  ai: {
    init: 'Failed to initialize AI model',
    generate: 'AI generation failed',
    download: 'Model download failed',
    default: 'AI error occurred',
  },
  export: {
    pdf: 'PDF export failed',
    path: 'Invalid export location',
    default: 'Export error occurred',
  },
  network: {
    download: 'Download failed',
    timeout: 'Request timed out',
    offline: 'No internet connection',
    default: 'Network error occurred',
  },
  permission: {
    microphone: 'Microphone permission required',
    file: 'File access denied',
    default: 'Permission denied',
  },
  validation: {
    input: 'Invalid input',
    format: 'Invalid format',
    default: 'Validation error',
  },
  unknown: {
    default: 'An unexpected error occurred',
  },
}

// Get user-friendly message for an error
function getUserMessage(category: ErrorCategory, operation: string): string {
  const categoryMessages = ERROR_MESSAGES[category]
  return categoryMessages[operation] || categoryMessages.default
}

// Determine if error should be shown to user based on severity
function shouldShowToast(severity: ErrorSeverity, silent?: boolean): boolean {
  if (silent) return false
  // Always show medium and above
  return severity !== 'low'
}

// Determine toast type based on severity
function getToastType(severity: ErrorSeverity): 'error' | 'warning' | 'info' {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error'
    case 'medium':
      return 'warning'
    case 'low':
      return 'info'
  }
}

// Determine toast duration based on severity
function getToastDuration(severity: ErrorSeverity): number {
  switch (severity) {
    case 'critical':
      return 10000 // 10 seconds
    case 'high':
      return 6000  // 6 seconds
    case 'medium':
      return 4000  // 4 seconds
    case 'low':
      return 2000  // 2 seconds
  }
}

/**
 * Handle an error with consistent logging and user notification
 */
export function handleError(error: unknown, context: ErrorContext): ErrorResult {
  const { category, operation, details, silent, severity = 'medium' } = context
  
  // Extract error message
  const errorMessage = error instanceof Error 
    ? error.message 
    : typeof error === 'string' 
      ? error 
      : 'Unknown error'
  
  // Get user-friendly message
  const userMessage = getUserMessage(category, operation)
  
  // Log the error
  log.error(`[${category}:${operation}] ${errorMessage}`, {
    category,
    operation,
    details,
    severity,
    originalError: error,
  })
  
  // Show toast if appropriate
  let toastId: string | undefined
  if (shouldShowToast(severity, silent)) {
    const toastType = getToastType(severity)
    const duration = getToastDuration(severity)
    
    // Include technical details for high/critical errors
    const toastMessage = severity === 'critical' || severity === 'high'
      ? errorMessage
      : undefined
    
    toastId = toast[toastType](userMessage, toastMessage, duration)
  }
  
  return {
    handled: true,
    message: userMessage,
    toastId,
  }
}

/**
 * Create an error handler for a specific category
 */
export function createErrorHandler(category: ErrorCategory) {
  return (error: unknown, operation: string, options?: Partial<Omit<ErrorContext, 'category' | 'operation'>>) => {
    return handleError(error, {
      category,
      operation,
      ...options,
    })
  }
}

// Pre-configured error handlers for common categories
export const sessionError = createErrorHandler('session')
export const audioError = createErrorHandler('audio')
export const aiError = createErrorHandler('ai')
export const exportError = createErrorHandler('export')
export const networkError = createErrorHandler('network')

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: Omit<ErrorContext, 'details'>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      handleError(error, {
        ...context,
        details: { args },
      })
      throw error // Re-throw for caller to handle if needed
    }
  }) as T
}

/**
 * Create a try-catch wrapper that handles errors silently (for fire-and-forget operations)
 */
export function silentCatch<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: Omit<ErrorContext, 'details' | 'silent'>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      handleError(error, {
        ...context,
        details: { args },
        silent: true,
      })
      return undefined
    }
  }) as T
}

/**
 * Global error boundary handler for uncaught errors
 */
export function setupGlobalErrorHandling(): void {
  // Handle uncaught promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    handleError(event.reason, {
      category: 'unknown',
      operation: 'unhandledRejection',
      severity: 'high',
      details: { type: 'unhandledRejection' },
    })
  })

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    handleError(event.error || event.message, {
      category: 'unknown',
      operation: 'uncaughtError',
      severity: 'high',
      details: {
        type: 'uncaughtError',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    })
  })
}

