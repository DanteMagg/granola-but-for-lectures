import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ShortcutsHelpModal } from '../../renderer/components/ShortcutsHelpModal'
import { useSessionStore } from '../../renderer/stores/sessionStore'

// Mock the session store
vi.mock('../../renderer/stores/sessionStore', () => ({
  useSessionStore: vi.fn(),
}))

// Mock useFocusTrap
vi.mock('../../renderer/hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ current: null }),
}))

describe('ShortcutsHelpModal', () => {
  const mockSetUIState = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useSessionStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      setUIState: mockSetUIState,
    })
  })

  describe('rendering', () => {
    it('should render modal with title', () => {
      render(<ShortcutsHelpModal />)

      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument()
    })

    it('should render all shortcut categories', () => {
      render(<ShortcutsHelpModal />)

      expect(screen.getByText('Navigation')).toBeInTheDocument()
      expect(screen.getByText('Recording & AI')).toBeInTheDocument()
      expect(screen.getByText('General')).toBeInTheDocument()
    })

    it('should render navigation shortcuts', () => {
      render(<ShortcutsHelpModal />)

      expect(screen.getByText('Previous slide')).toBeInTheDocument()
      expect(screen.getByText('Next slide')).toBeInTheDocument()
      expect(screen.getByText('Focus notes editor')).toBeInTheDocument()
    })

    it('should render recording shortcuts', () => {
      render(<ShortcutsHelpModal />)

      expect(screen.getByText('Toggle recording')).toBeInTheDocument()
      expect(screen.getByText('Toggle AI chat')).toBeInTheDocument()
    })

    it('should render general shortcuts', () => {
      render(<ShortcutsHelpModal />)

      expect(screen.getByText('New session')).toBeInTheDocument()
      expect(screen.getByText('Search slides & notes')).toBeInTheDocument()
      expect(screen.getByText('Save session')).toBeInTheDocument()
      expect(screen.getByText('Export to PDF')).toBeInTheDocument()
      expect(screen.getByText('Import PDF')).toBeInTheDocument()
      expect(screen.getByText('Open settings')).toBeInTheDocument()
      expect(screen.getByText('Toggle sidebar')).toBeInTheDocument()
      expect(screen.getByText('Show keyboard shortcuts')).toBeInTheDocument()
      expect(screen.getByText('Close modal / Cancel')).toBeInTheDocument()
    })

    it('should render keyboard keys in kbd elements', () => {
      const { container } = render(<ShortcutsHelpModal />)

      const kbdElements = container.querySelectorAll('kbd')
      expect(kbdElements.length).toBeGreaterThan(0)
    })

    it('should render footer note about shortcuts', () => {
      render(<ShortcutsHelpModal />)

      expect(screen.getByText('Shortcuts are disabled when typing in text fields')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have dialog role', () => {
      render(<ShortcutsHelpModal />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should have aria-modal attribute', () => {
      render(<ShortcutsHelpModal />)

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    })

    it('should have aria-labelledby pointing to title', () => {
      render(<ShortcutsHelpModal />)

      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-labelledby', 'shortcuts-modal-title')
      expect(screen.getByText('Keyboard Shortcuts')).toHaveAttribute('id', 'shortcuts-modal-title')
    })

    it('should have close button with aria-label', () => {
      render(<ShortcutsHelpModal />)

      expect(screen.getByLabelText('Close')).toBeInTheDocument()
    })
  })

  describe('user interactions', () => {
    it('should close modal when close button is clicked', () => {
      render(<ShortcutsHelpModal />)

      fireEvent.click(screen.getByLabelText('Close'))

      expect(mockSetUIState).toHaveBeenCalledWith({ showShortcutsHelp: false })
    })

    it('should close modal when overlay is clicked', () => {
      render(<ShortcutsHelpModal />)

      // Click on the overlay (modal-overlay class element)
      const overlay = screen.getByRole('dialog').parentElement
      fireEvent.click(overlay!)

      expect(mockSetUIState).toHaveBeenCalledWith({ showShortcutsHelp: false })
    })

    it('should not close modal when content is clicked', () => {
      render(<ShortcutsHelpModal />)

      fireEvent.click(screen.getByRole('dialog'))

      expect(mockSetUIState).not.toHaveBeenCalled()
    })
  })

  describe('shortcut key display', () => {
    it('should display arrow keys correctly', () => {
      render(<ShortcutsHelpModal />)

      expect(screen.getByText('←')).toBeInTheDocument()
      expect(screen.getByText('→')).toBeInTheDocument()
    })

    it('should display modifier keys with plus separator', () => {
      render(<ShortcutsHelpModal />)

      // Find a shortcut with multiple keys like ⌘ + N
      const cmdElements = screen.getAllByText('⌘')
      expect(cmdElements.length).toBeGreaterThan(0)
      
      // Plus signs should separate keys
      const plusSigns = screen.getAllByText('+')
      expect(plusSigns.length).toBeGreaterThan(0)
    })

    it('should display single key shortcuts in kbd elements', () => {
      render(<ShortcutsHelpModal />)

      // Find kbd elements specifically (not text that might appear elsewhere)
      const kbdElements = screen.getAllByText((content, element) => {
        return element?.tagName === 'KBD' && ['N', 'R', 'A', '?', 'Esc'].includes(content)
      })
      
      expect(kbdElements.length).toBeGreaterThanOrEqual(5)
    })
  })
})

