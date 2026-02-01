import React from 'react'
import { AlertTriangle, RefreshCw, Copy, Check, FileText, MessageSquare, Settings, Layout } from 'lucide-react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  /** Name of the section for better error messages */
  section?: 'sidebar' | 'slides' | 'notes' | 'transcript' | 'settings' | 'ai-chat' | 'export'
  /** Callback when user clicks retry */
  onRetry?: () => void
  /** Compact mode for smaller sections */
  compact?: boolean
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  copied: boolean
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorInfo: React.ErrorInfo | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, copied: false }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
    this.errorInfo = errorInfo
    
    // Log error to file
    if (window.electronAPI?.logsWrite) {
      window.electronAPI.logsWrite('error', 'React Error Boundary caught error', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      })
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, copied: false })
    this.errorInfo = null
  }

  handleCopyError = async () => {
    const errorDetails = this.buildErrorReport()
    
    try {
      // Try to get logs as well
      let logs = ''
      if (window.electronAPI?.logsGetAll) {
        try {
          logs = await window.electronAPI.logsGetAll()
        } catch {
          logs = '[Could not retrieve logs]'
        }
      }

      const fullReport = `${errorDetails}\n\n=== APPLICATION LOGS ===\n${logs}`
      await navigator.clipboard.writeText(fullReport)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    } catch {
      // Fallback to just error details
      try {
        await navigator.clipboard.writeText(errorDetails)
        this.setState({ copied: true })
        setTimeout(() => this.setState({ copied: false }), 2000)
      } catch (e) {
        console.error('Failed to copy error:', e)
      }
    }
  }

  buildErrorReport = (): string => {
    const { error } = this.state
    const lines = [
      '=== ERROR REPORT ===',
      `Timestamp: ${new Date().toISOString()}`,
      `App Version: 0.1.0`,
      `Platform: ${navigator.platform}`,
      '',
      '=== ERROR ===',
      `Message: ${error?.message || 'Unknown error'}`,
      '',
      '=== STACK TRACE ===',
      error?.stack || 'No stack trace available',
      '',
      '=== COMPONENT STACK ===',
      this.errorInfo?.componentStack || 'No component stack available',
    ]
    return lines.join('\n')
  }

  getSectionInfo = () => {
    const sectionMap: Record<string, { icon: typeof AlertTriangle; title: string; message: string }> = {
      sidebar: {
        icon: Layout,
        title: 'Session list unavailable',
        message: 'Could not load your sessions. Your data is safe.',
      },
      slides: {
        icon: FileText,
        title: 'Slide viewer error',
        message: 'Could not display the slide. Try navigating to another slide.',
      },
      notes: {
        icon: FileText,
        title: 'Notes panel error',
        message: 'Could not load the notes editor. Your notes are saved.',
      },
      transcript: {
        icon: MessageSquare,
        title: 'Transcript error',
        message: 'Could not display the transcript.',
      },
      settings: {
        icon: Settings,
        title: 'Settings error',
        message: 'Could not load settings. Try reopening.',
      },
      'ai-chat': {
        icon: MessageSquare,
        title: 'AI Chat error',
        message: 'Could not connect to AI. Check model status in Settings.',
      },
      export: {
        icon: FileText,
        title: 'Export error',
        message: 'Could not export your notes. Try again.',
      },
    }
    return this.props.section ? sectionMap[this.props.section] : null
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const sectionInfo = this.getSectionInfo()
      const IconComponent = sectionInfo?.icon || AlertTriangle

      // Compact mode for smaller sections
      if (this.props.compact) {
        return (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 text-red-600 mb-2">
              <IconComponent className="w-4 h-4" />
              <span className="text-sm font-medium">{sectionInfo?.title || 'Error'}</span>
            </div>
            <p className="text-xs text-red-500 mb-3">
              {sectionInfo?.message || this.state.error?.message || 'Something went wrong'}
            </p>
            <button
              onClick={() => {
                this.handleReset()
                this.props.onRetry?.()
              }}
              className="btn btn-sm text-xs bg-red-100 text-red-700 hover:bg-red-200"
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </button>
          </div>
        )
      }

      return (
        <div className="min-h-[200px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <IconComponent className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              {sectionInfo?.title || 'Something went wrong'}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {sectionInfo?.message || this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  this.handleReset()
                  this.props.onRetry?.()
                }}
                className="btn btn-secondary btn-md"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
              <button
                onClick={this.handleCopyError}
                className="btn btn-ghost btn-md"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Error Report
                  </>
                )}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-4">
              Copy the error report to help with troubleshooting
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * HOC to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  section?: ErrorBoundaryProps['section'],
  compact?: boolean
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary section={section} compact={compact}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}

// Hook for functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)

  const handleError = React.useCallback((error: Error) => {
    console.error('Error handled:', error)
    setError(error)
  }, [])

  const clearError = React.useCallback(() => {
    setError(null)
  }, [])

  return { error, handleError, clearError }
}

