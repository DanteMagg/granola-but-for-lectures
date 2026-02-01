import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ErrorBoundary, withErrorBoundary, useErrorHandler } from '../../renderer/components/ErrorBoundary'
import React from 'react'

// Component that throws an error
const ThrowingComponent = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>No error</div>
}

// Component that throws on click
const ThrowOnClickComponent = () => {
  const [shouldThrow, setShouldThrow] = React.useState(false)
  if (shouldThrow) {
    throw new Error('Clicked error')
  }
  return <button onClick={() => setShouldThrow(true)}>Click to throw</button>
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Suppress console.error for error boundary tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render children when there is no error', () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      )

      expect(screen.getByText('Child content')).toBeInTheDocument()
    })

    it('should render fallback when provided and error occurs', () => {
      render(
        <ErrorBoundary fallback={<div>Custom fallback</div>}>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Custom fallback')).toBeInTheDocument()
    })

    it('should render default error UI when no fallback provided', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    it('should render compact mode error UI', () => {
      render(
        <ErrorBoundary compact>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })

  describe('section-specific error messages', () => {
    it('should show sidebar section error', () => {
      render(
        <ErrorBoundary section="sidebar">
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Session list unavailable')).toBeInTheDocument()
      expect(screen.getByText('Could not load your sessions. Your data is safe.')).toBeInTheDocument()
    })

    it('should show slides section error', () => {
      render(
        <ErrorBoundary section="slides">
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Slide viewer error')).toBeInTheDocument()
    })

    it('should show notes section error', () => {
      render(
        <ErrorBoundary section="notes">
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Notes panel error')).toBeInTheDocument()
    })

    it('should show transcript section error', () => {
      render(
        <ErrorBoundary section="transcript">
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Transcript error')).toBeInTheDocument()
    })

    it('should show settings section error', () => {
      render(
        <ErrorBoundary section="settings">
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Settings error')).toBeInTheDocument()
    })

    it('should show ai-chat section error', () => {
      render(
        <ErrorBoundary section="ai-chat">
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('AI Chat error')).toBeInTheDocument()
    })

    it('should show export section error', () => {
      render(
        <ErrorBoundary section="export">
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Export error')).toBeInTheDocument()
    })
  })

  describe('user interactions', () => {
    it('should call onRetry and reset on Try again click', async () => {
      const onRetry = vi.fn()
      const { rerender } = render(
        <ErrorBoundary onRetry={onRetry}>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      fireEvent.click(screen.getByText('Try again'))

      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('should call onRetry in compact mode', () => {
      const onRetry = vi.fn()
      render(
        <ErrorBoundary compact onRetry={onRetry}>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      fireEvent.click(screen.getByText('Retry'))

      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('should copy error report to clipboard', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      })

      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      fireEvent.click(screen.getByText('Copy Error Report'))

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalled()
      })

      // Should show copied state
      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument()
      })
    })
  })

  describe('error logging', () => {
    it('should log error to electronAPI when available', () => {
      const logsWriteMock = vi.fn()
      window.electronAPI = {
        ...window.electronAPI,
        logsWrite: logsWriteMock,
      }

      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(logsWriteMock).toHaveBeenCalledWith(
        'error',
        'React Error Boundary caught error',
        expect.objectContaining({
          message: 'Test error message',
        })
      )
    })
  })

  describe('error recovery', () => {
    it('should reset error state when try again is clicked', () => {
      // Use a stateful wrapper to control throwing
      let shouldThrow = true
      const ControlledComponent = () => {
        if (shouldThrow) {
          throw new Error('Controlled error')
        }
        return <div>Recovered successfully</div>
      }

      const { rerender } = render(
        <ErrorBoundary>
          <ControlledComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      // Set flag to not throw on next render
      shouldThrow = false

      // Click try again to reset boundary state
      fireEvent.click(screen.getByText('Try again'))

      // After reset, boundary re-renders children
      expect(screen.getByText('Recovered successfully')).toBeInTheDocument()
    })
  })
})

describe('withErrorBoundary HOC', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('should wrap component with error boundary', () => {
    const WrappedComponent = withErrorBoundary(ThrowingComponent)

    render(<WrappedComponent />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('should apply section prop', () => {
    const WrappedComponent = withErrorBoundary(ThrowingComponent, 'notes')

    render(<WrappedComponent />)

    expect(screen.getByText('Notes panel error')).toBeInTheDocument()
  })

  it('should apply compact prop', () => {
    const WrappedComponent = withErrorBoundary(ThrowingComponent, undefined, true)

    render(<WrappedComponent />)

    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })
})

describe('useErrorHandler hook', () => {
  const TestComponent = () => {
    const { error, handleError, clearError } = useErrorHandler()

    return (
      <div>
        {error && <div data-testid="error">{error.message}</div>}
        <button onClick={() => handleError(new Error('Hook error'))}>
          Trigger error
        </button>
        <button onClick={clearError}>Clear error</button>
      </div>
    )
  }

  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('should handle errors', () => {
    render(<TestComponent />)

    expect(screen.queryByTestId('error')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Trigger error'))

    expect(screen.getByTestId('error')).toHaveTextContent('Hook error')
  })

  it('should clear errors', () => {
    render(<TestComponent />)

    fireEvent.click(screen.getByText('Trigger error'))
    expect(screen.getByTestId('error')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Clear error'))
    expect(screen.queryByTestId('error')).not.toBeInTheDocument()
  })
})

