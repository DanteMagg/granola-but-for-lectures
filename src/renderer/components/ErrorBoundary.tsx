import React from 'react'
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
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

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[200px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
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

