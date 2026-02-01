import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ToastContainer } from '../../renderer/components/Toast'
import { useToastStore } from '../../renderer/stores/toastStore'

describe('Toast', () => {
  beforeEach(() => {
    // Clear any existing toasts
    useToastStore.getState().clearAll()
  })

  describe('ToastContainer', () => {
    it('should not render when there are no toasts', () => {
      const { container } = render(<ToastContainer />)
      expect(container.firstChild).toBeNull()
    })

    it('should render toasts when they exist', () => {
      const { addToast } = useToastStore.getState()
      
      act(() => {
        addToast({
          type: 'success',
          title: 'Success!',
          message: 'Operation completed',
          duration: 0, // No auto-dismiss
        })
      })

      render(<ToastContainer />)
      
      expect(screen.getByText('Success!')).toBeInTheDocument()
      expect(screen.getByText('Operation completed')).toBeInTheDocument()
    })

    it('should render multiple toasts', () => {
      const { addToast } = useToastStore.getState()
      
      act(() => {
        addToast({ type: 'success', title: 'First', duration: 0 })
        addToast({ type: 'error', title: 'Second', duration: 0 })
        addToast({ type: 'info', title: 'Third', duration: 0 })
      })

      render(<ToastContainer />)
      
      expect(screen.getByText('First')).toBeInTheDocument()
      expect(screen.getByText('Second')).toBeInTheDocument()
      expect(screen.getByText('Third')).toBeInTheDocument()
    })
  })

  describe('toast types', () => {
    it('should render success toast with correct styling', () => {
      const { addToast } = useToastStore.getState()
      
      act(() => {
        addToast({ type: 'success', title: 'Success Toast', duration: 0 })
      })

      render(<ToastContainer />)
      
      const toast = screen.getByText('Success Toast').closest('[role="alert"]')
      expect(toast).toHaveClass('bg-green-50')
    })

    it('should render error toast with correct styling', () => {
      const { addToast } = useToastStore.getState()
      
      act(() => {
        addToast({ type: 'error', title: 'Error Toast', duration: 0 })
      })

      render(<ToastContainer />)
      
      const toast = screen.getByText('Error Toast').closest('[role="alert"]')
      expect(toast).toHaveClass('bg-red-50')
    })

    it('should render warning toast with correct styling', () => {
      const { addToast } = useToastStore.getState()
      
      act(() => {
        addToast({ type: 'warning', title: 'Warning Toast', duration: 0 })
      })

      render(<ToastContainer />)
      
      const toast = screen.getByText('Warning Toast').closest('[role="alert"]')
      expect(toast).toHaveClass('bg-amber-50')
    })

    it('should render info toast with correct styling', () => {
      const { addToast } = useToastStore.getState()
      
      act(() => {
        addToast({ type: 'info', title: 'Info Toast', duration: 0 })
      })

      render(<ToastContainer />)
      
      const toast = screen.getByText('Info Toast').closest('[role="alert"]')
      expect(toast).toHaveClass('bg-blue-50')
    })

    it('should render shortcut toast with compact styling', () => {
      const { addToast } = useToastStore.getState()
      
      act(() => {
        addToast({ 
          type: 'shortcut', 
          title: 'Saved', 
          shortcutKey: '⌘S',
          duration: 0 
        })
      })

      render(<ToastContainer />)
      
      const toast = screen.getByText('Saved').closest('[role="status"]')
      expect(toast).toHaveClass('bg-zinc-50')
      expect(screen.getByText('⌘S')).toBeInTheDocument()
    })
  })

  describe('toast store', () => {
    it('should add toast with generated id', () => {
      const { addToast } = useToastStore.getState()
      
      act(() => {
        addToast({ type: 'success', title: 'Test' })
      })
      
      const state = useToastStore.getState()
      expect(state.toasts.length).toBe(1)
      expect(state.toasts[0].id).toBeDefined()
    })

    it('should remove toast by id', () => {
      const { addToast, removeToast } = useToastStore.getState()
      
      act(() => {
        addToast({ type: 'success', title: 'Test' })
      })
      
      const toastId = useToastStore.getState().toasts[0].id
      
      act(() => {
        removeToast(toastId)
      })
      
      expect(useToastStore.getState().toasts.length).toBe(0)
    })

    it('should clear all toasts', () => {
      const { addToast, clearAll } = useToastStore.getState()
      
      act(() => {
        addToast({ type: 'success', title: 'Test 1' })
        addToast({ type: 'error', title: 'Test 2' })
      })
      
      expect(useToastStore.getState().toasts.length).toBe(2)
      
      act(() => {
        clearAll()
      })
      
      expect(useToastStore.getState().toasts.length).toBe(0)
    })
  })

  describe('accessibility', () => {
    it('should have proper role for regular toasts', () => {
      const { addToast } = useToastStore.getState()
      
      act(() => {
        addToast({ type: 'error', title: 'Error', duration: 0 })
      })

      render(<ToastContainer />)
      
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('should have proper role for shortcut toasts', () => {
      const { addToast } = useToastStore.getState()
      
      act(() => {
        addToast({ type: 'shortcut', title: 'Action', duration: 0 })
      })

      render(<ToastContainer />)
      
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })
})
