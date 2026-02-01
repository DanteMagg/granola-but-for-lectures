import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AudioRecorder } from '../../renderer/components/AudioRecorder'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import { createMockSession, createMockSlide, createMockUIState } from '../helpers/mockData'

// Mock the stores and hooks
vi.mock('../../renderer/stores/sessionStore')
vi.mock('../../renderer/hooks/useAccessibility', () => ({
  useAccessibility: () => ({
    autoDeleteAudio: false,
  }),
}))

// Mock event listeners
const mockAddEventListener = vi.fn()
const mockRemoveEventListener = vi.fn()

const mockUseSessionStore = vi.mocked(useSessionStore)

describe('AudioRecorder', () => {
  const mockSetRecording = vi.fn()
  const mockSetRecordingStartTime = vi.fn()
  const mockAddTranscriptSegment = vi.fn()
  const mockAddRecordingDuration = vi.fn()
  const mockSetUIState = vi.fn()
  const mockSetSessionPhase = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock window event listeners
    window.addEventListener = mockAddEventListener
    window.removeEventListener = mockRemoveEventListener

    // Mock window.electronAPI
    window.electronAPI = {
      ...window.electronAPI,
      whisperGetInfo: vi.fn().mockResolvedValue({
        loaded: true,
        exists: true,
        modelName: 'base.en',
      }),
      whisperTranscribe: vi.fn().mockResolvedValue({
        text: 'Test transcription',
        segments: [],
      }),
      saveAudio: vi.fn().mockResolvedValue('/path/to/audio'),
      deleteAudio: vi.fn().mockResolvedValue(true),
    } as any
  })

  const setupMockStore = (overrides: Record<string, any> = {}) => {
    const slides = overrides.slides || [createMockSlide()]
    const session = createMockSession({
      slides,
      isRecording: overrides.isRecording ?? false,
      ...overrides,
    })

    mockUseSessionStore.mockReturnValue({
      session,
      ui: createMockUIState({ showLiveTranscript: false, ...overrides.ui }),
      setRecording: mockSetRecording,
      setRecordingStartTime: mockSetRecordingStartTime,
      addTranscriptSegment: mockAddTranscriptSegment,
      addRecordingDuration: mockAddRecordingDuration,
      setUIState: mockSetUIState,
      setSessionPhase: mockSetSessionPhase,
    } as any)

    return session
  }

  describe('visibility', () => {
    it('should not render when no session', () => {
      mockUseSessionStore.mockReturnValue({
        session: null,
        ui: createMockUIState(),
        setRecording: mockSetRecording,
        setRecordingStartTime: mockSetRecordingStartTime,
        addTranscriptSegment: mockAddTranscriptSegment,
        addRecordingDuration: mockAddRecordingDuration,
        setUIState: mockSetUIState,
        setSessionPhase: mockSetSessionPhase,
      } as any)

      const { container } = render(<AudioRecorder />)
      expect(container.firstChild).toBeNull()
    })

    it('should not render when session has no slides', () => {
      setupMockStore({ slides: [] })

      const { container } = render(<AudioRecorder />)
      expect(container.firstChild).toBeNull()
    })

    it('should render when session has slides', () => {
      setupMockStore()

      render(<AudioRecorder />)
      expect(screen.getByTitle(/Start recording/i)).toBeInTheDocument()
    })
  })

  describe('recording controls', () => {
    it('should show record button when not recording', () => {
      setupMockStore({ isRecording: false })

      render(<AudioRecorder />)
      expect(screen.getByTitle('Start recording (R)')).toBeInTheDocument()
    })

    it('should show stop button when recording', () => {
      setupMockStore({ isRecording: true })

      render(<AudioRecorder />)
      expect(screen.getByTitle('Stop recording')).toBeInTheDocument()
    })

    it('should show pause button when recording', () => {
      setupMockStore({ isRecording: true })

      render(<AudioRecorder />)
      expect(screen.getByTitle('Pause')).toBeInTheDocument()
    })
  })

  describe('transcript toggle', () => {
    it('should show transcript toggle when recording', () => {
      setupMockStore({ isRecording: true })

      render(<AudioRecorder />)
      
      expect(screen.getByTitle('Show live transcript')).toBeInTheDocument()
    })

    it('should toggle live transcript visibility', () => {
      setupMockStore({ isRecording: true })

      render(<AudioRecorder />)
      
      const toggleButton = screen.getByTitle('Show live transcript')
      fireEvent.click(toggleButton)
      
      expect(mockSetUIState).toHaveBeenCalledWith({ showLiveTranscript: true })
    })
  })

  describe('audio level visualization', () => {
    it('should show audio level bars when recording', () => {
      setupMockStore({ isRecording: true })

      render(<AudioRecorder />)
      
      // Should have audio level bar container
      const container = document.querySelector('.flex.items-center.gap-0\\.5')
      expect(container).toBeInTheDocument()
    })
  })

  describe('duration display', () => {
    it('should show duration when recording', () => {
      setupMockStore({ isRecording: true })

      render(<AudioRecorder />)
      
      // Duration display should be present (shows 0:00 initially)
      expect(screen.getByText(/\d+:\d{2}/)).toBeInTheDocument()
    })
  })

  describe('whisper status', () => {
    it('should check whisper status on mount', async () => {
      setupMockStore()

      render(<AudioRecorder />)
      
      await waitFor(() => {
        expect(window.electronAPI.whisperGetInfo).toHaveBeenCalled()
      })
    })
  })
})
