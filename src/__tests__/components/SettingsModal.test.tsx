import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsModal } from '../../renderer/components/SettingsModal'

// Mock the useAccessibility hook
vi.mock('../../renderer/hooks/useAccessibility', () => ({
  useAccessibility: () => ({
    highContrast: false,
    autoDeleteAudio: false,
    setHighContrast: vi.fn(),
    setAutoDeleteAudio: vi.fn(),
  }),
}))

describe('SettingsModal', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock window.electronAPI
    window.electronAPI = {
      ...window.electronAPI,
      whisperGetInfo: vi.fn().mockResolvedValue({
        loaded: false,
        exists: false,
        modelPath: '/path/to/whisper',
        modelName: '',
        language: 'en',
        availableModels: [
          { name: 'tiny', size: '75 MB', downloaded: false },
          { name: 'base', size: '142 MB', downloaded: false },
          { name: 'small', size: '466 MB', downloaded: false },
        ],
      }),
      llmGetInfo: vi.fn().mockResolvedValue({
        loaded: false,
        exists: false,
        modelPath: '/path/to/llm',
        modelName: '',
        contextLength: 2048,
        availableModels: [
          { name: 'tinyllama-1.1b', size: '670 MB', contextLength: 2048, downloaded: false },
          { name: 'phi-2', size: '1.6 GB', contextLength: 2048, downloaded: false },
        ],
      }),
      whisperInit: vi.fn().mockResolvedValue(true),
      llmInit: vi.fn().mockResolvedValue(true),
      whisperDownloadModel: vi.fn().mockResolvedValue({ success: true }),
      llmDownloadModel: vi.fn().mockResolvedValue({ success: true }),
      whisperCancelDownload: vi.fn().mockResolvedValue(true),
      llmCancelDownload: vi.fn().mockResolvedValue(true),
      onWhisperDownloadProgress: vi.fn().mockReturnValue(() => {}),
      onLLMDownloadProgress: vi.fn().mockReturnValue(() => {}),
      logsGetAll: vi.fn().mockResolvedValue('Log content here'),
      logsClear: vi.fn().mockResolvedValue(true),
    } as any

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })

    // Mock alert/confirm
    global.alert = vi.fn()
    global.confirm = vi.fn().mockReturnValue(true)
  })

  describe('rendering', () => {
    it('should render modal with header', () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    it('should render all tabs', () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      expect(screen.getByText('AI Models')).toBeInTheDocument()
      expect(screen.getByText('Accessibility')).toBeInTheDocument()
      expect(screen.getByText('Storage')).toBeInTheDocument()
      expect(screen.getByText('About')).toBeInTheDocument()
    })

    it('should default to AI Models tab', () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      expect(screen.getByText('Whisper (Speech-to-Text)')).toBeInTheDocument()
      expect(screen.getByText('Local LLM (AI Assistant)')).toBeInTheDocument()
    })
  })

  describe('tab navigation', () => {
    it('should switch to Accessibility tab', async () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      const accessibilityTab = screen.getByText('Accessibility')
      fireEvent.click(accessibilityTab)
      
      await waitFor(() => {
        expect(screen.getByText('High Contrast Mode')).toBeInTheDocument()
        expect(screen.getByText('Auto-delete Audio Files')).toBeInTheDocument()
      })
    })

    it('should switch to Storage tab', async () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      const storageTab = screen.getByText('Storage')
      fireEvent.click(storageTab)
      
      await waitFor(() => {
        expect(screen.getByText('Data Location')).toBeInTheDocument()
        expect(screen.getByText('Debug Logs')).toBeInTheDocument()
      })
    })

    it('should switch to About tab', async () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      const aboutTab = screen.getByText('About')
      fireEvent.click(aboutTab)
      
      await waitFor(() => {
        expect(screen.getByText('Lecture Note Companion')).toBeInTheDocument()
        expect(screen.getByText('Version 0.1.0')).toBeInTheDocument()
      })
    })
  })

  describe('AI Models tab', () => {
    it('should show Whisper model section', async () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      await waitFor(() => {
        expect(screen.getByText('Whisper (Speech-to-Text)')).toBeInTheDocument()
        expect(screen.getByText('Local transcription using OpenAI\'s Whisper model')).toBeInTheDocument()
      })
    })

    it('should show LLM model section', async () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      await waitFor(() => {
        expect(screen.getByText('Local LLM (AI Assistant)')).toBeInTheDocument()
        expect(screen.getByText('Local language model for contextual AI chat')).toBeInTheDocument()
      })
    })

    it('should show download buttons for models', async () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      await waitFor(() => {
        const downloadButtons = screen.getAllByText('Download')
        expect(downloadButtons.length).toBeGreaterThan(0)
      })
    })

    it('should trigger Whisper download', async () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      await waitFor(() => {
        const downloadButtons = screen.getAllByRole('button', { name: /Download/i })
        fireEvent.click(downloadButtons[0])
      })
      
      await waitFor(() => {
        expect(window.electronAPI.whisperDownloadModel).toHaveBeenCalled()
      })
    })

    it('should show model quality recommendations', async () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      await waitFor(() => {
        expect(screen.getByText(/For lecture halls/)).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility tab', () => {
    it('should have toggle switches', async () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      const accessibilityTab = screen.getByText('Accessibility')
      fireEvent.click(accessibilityTab)
      
      await waitFor(() => {
        const switches = screen.getAllByRole('switch')
        expect(switches.length).toBe(2) // High contrast and Auto-delete audio
      })
    })
  })

  describe('Storage tab', () => {
    it('should show data location', async () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      const storageTab = screen.getByText('Storage')
      fireEvent.click(storageTab)
      
      await waitFor(() => {
        expect(screen.getByText(/Application Support/)).toBeInTheDocument()
      })
    })

    it('should have view logs button', async () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      const storageTab = screen.getByText('Storage')
      fireEvent.click(storageTab)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /View Logs/i })).toBeInTheDocument()
      })
    })

    it('should show log viewer when view logs clicked', async () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      const storageTab = screen.getByText('Storage')
      fireEvent.click(storageTab)
      
      await waitFor(() => {
        const viewButton = screen.getByRole('button', { name: /View Logs/i })
        fireEvent.click(viewButton)
      })
      
      await waitFor(() => {
        expect(window.electronAPI.logsGetAll).toHaveBeenCalled()
        expect(screen.getByText('Refresh')).toBeInTheDocument()
        expect(screen.getByText('Copy')).toBeInTheDocument()
      })
    })

    it('should copy logs to clipboard when copy button clicked', async () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      const storageTab = screen.getByText('Storage')
      fireEvent.click(storageTab)
      
      // Open log viewer
      await waitFor(() => {
        const viewButton = screen.getByRole('button', { name: /View Logs/i })
        fireEvent.click(viewButton)
      })
      
      // Wait for logs to load then copy
      await waitFor(() => {
        const copyButton = screen.getByRole('button', { name: /Copy/i })
        fireEvent.click(copyButton)
      })
      
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Log content here')
      })
    })

    it('should have clear logs button in log viewer', async () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      const storageTab = screen.getByText('Storage')
      fireEvent.click(storageTab)
      
      // Open log viewer
      await waitFor(() => {
        const viewButton = screen.getByRole('button', { name: /View Logs/i })
        fireEvent.click(viewButton)
      })
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Clear/i })).toBeInTheDocument()
      })
    })

    it('should clear logs when confirmed', async () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      const storageTab = screen.getByText('Storage')
      fireEvent.click(storageTab)
      
      // Open log viewer
      await waitFor(() => {
        const viewButton = screen.getByRole('button', { name: /View Logs/i })
        fireEvent.click(viewButton)
      })
      
      await waitFor(() => {
        const clearButton = screen.getByRole('button', { name: /Clear/i })
        fireEvent.click(clearButton)
      })
      
      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalled()
        expect(window.electronAPI.logsClear).toHaveBeenCalled()
      })
    })
  })

  describe('modal behavior', () => {
    it('should close when overlay clicked', () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      const overlay = document.querySelector('.modal-overlay')!
      fireEvent.click(overlay)
      
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should close when X button clicked', () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      const closeButton = screen.getByLabelText('Close settings')
      fireEvent.click(closeButton)
      
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should not close when modal content clicked', () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      const modalContent = document.querySelector('.modal-content')!
      fireEvent.click(modalContent)
      
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('model status display', () => {
    it('should show "Not installed" when model not downloaded', async () => {
      render(<SettingsModal onClose={mockOnClose} />)
      
      await waitFor(() => {
        const notInstalledBadges = screen.getAllByText('Not installed')
        expect(notInstalledBadges.length).toBeGreaterThan(0)
      })
    })

    it('should show "Downloaded" when model exists but not loaded', async () => {
      window.electronAPI.whisperGetInfo = vi.fn().mockResolvedValue({
        loaded: false,
        exists: true,
        modelName: 'small',
        availableModels: [
          { name: 'small', size: '466 MB', downloaded: true },
        ],
      })

      render(<SettingsModal onClose={mockOnClose} />)
      
      await waitFor(() => {
        const downloadedElements = screen.getAllByText('Downloaded')
        expect(downloadedElements.length).toBeGreaterThan(0)
      })
    })

    it('should show "Loaded" when model is loaded', async () => {
      window.electronAPI.whisperGetInfo = vi.fn().mockResolvedValue({
        loaded: true,
        exists: true,
        modelName: 'small',
        availableModels: [
          { name: 'small', size: '466 MB', downloaded: true },
        ],
      })

      render(<SettingsModal onClose={mockOnClose} />)
      
      await waitFor(() => {
        expect(screen.getByText('Loaded')).toBeInTheDocument()
      })
    })

    it('should show Load button for downloaded but not loaded models', async () => {
      window.electronAPI.whisperGetInfo = vi.fn().mockResolvedValue({
        loaded: false,
        exists: true,
        modelName: 'small',
        availableModels: [
          { name: 'small', size: '466 MB', downloaded: true },
        ],
      })

      render(<SettingsModal onClose={mockOnClose} />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Load' })).toBeInTheDocument()
      })
    })
  })
})

