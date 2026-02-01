/**
 * Advanced tests for sessionStore
 * Covers concurrent saves, autosave debouncing, large session handling, and edge cases
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useSessionStore } from '../renderer/stores/sessionStore'
import { useSlideStore } from '../renderer/stores/slideStore'
import { createMockUIState, createMockSession, createMockSlide, createMockNote } from './helpers/mockData'
import { AUTOSAVE_INTERVAL_MS } from '@shared/constants'

// Reset store helper
const resetStore = () => {
  useSessionStore.setState({
    session: null,
    sessionList: [],
    ui: createMockUIState(),
    isLoading: false,
    isSaving: false,
    error: null,
  })
  useSlideStore.getState().reset()
}

describe('sessionStore - Advanced Tests', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Default mock setup
    window.electronAPI = {
      ...window.electronAPI,
      saveSession: vi.fn().mockResolvedValue(undefined),
      loadSession: vi.fn().mockResolvedValue(null),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      listSessions: vi.fn().mockResolvedValue([]),
    } as any
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('concurrent save handling', () => {
    it('should handle multiple saves by waiting for previous', async () => {
      // This test verifies that saves don't overlap incorrectly
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      
      useSessionStore.setState({
        session: createMockSession({ id: 'test-1', name: 'Test' }),
      })
      
      const { saveSession } = useSessionStore.getState()
      
      // Sequential saves
      await saveSession()
      await saveSession()
      
      // Both should have completed
      expect(window.electronAPI.saveSession).toHaveBeenCalledTimes(2)
    })

    it('should retry save if previous save failed', async () => {
      window.electronAPI.saveSession = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined)
      
      useSessionStore.setState({
        session: createMockSession({ id: 'test-1' }),
      })
      
      const { saveSession } = useSessionStore.getState()
      
      // First save fails - error handler returns user-friendly message
      await saveSession()
      expect(useSessionStore.getState().error).toEqual({
        message: 'Failed to save session',
        type: 'save',
      })
      
      // Second save should work
      await saveSession()
      
      expect(window.electronAPI.saveSession).toHaveBeenCalledTimes(2)
    })

    it('should set isSaving flag during save', async () => {
      let resolveSave!: () => void
      window.electronAPI.saveSession = vi.fn().mockImplementation(() => 
        new Promise<void>((resolve) => { resolveSave = resolve })
      )
      
      useSessionStore.setState({
        session: createMockSession({ id: 'test-1' }),
      })
      
      const { saveSession } = useSessionStore.getState()
      
      const savePromise = saveSession()
      
      // Wait a tick for the promise to start
      await vi.advanceTimersByTimeAsync(0)
      
      // Should be saving
      expect(useSessionStore.getState().isSaving).toBe(true)
      
      resolveSave()
      await savePromise
      
      // Should no longer be saving
      expect(useSessionStore.getState().isSaving).toBe(false)
    })
  })

  describe('autosave debouncing', () => {
    it('should debounce rapid changes', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, updateNote } = useSessionStore.getState()
      await createSession('Test')
      
      const setSlideMock = vi.fn()
      useSessionStore.setState(state => ({
        ...state,
        session: state.session ? {
          ...state.session,
          slides: [createMockSlide({ id: 'slide-1' })],
        } : null,
      }))
      
      vi.clearAllMocks() // Clear calls from createSession
      
      // Make multiple rapid updates
      updateNote('slide-1', 'Note 1', 'Note 1')
      updateNote('slide-1', 'Note 2', 'Note 2')
      updateNote('slide-1', 'Note 3', 'Note 3')
      updateNote('slide-1', 'Note 4', 'Note 4')
      updateNote('slide-1', 'Note 5', 'Note 5')
      
      // Should not have saved yet
      expect(window.electronAPI.saveSession).not.toHaveBeenCalled()
      
      // Advance past autosave interval
      await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS + 100)
      
      // Should have saved once (debounced)
      expect(window.electronAPI.saveSession).toHaveBeenCalledTimes(1)
    })

    it('should reset debounce timer on new changes', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, updateNote } = useSessionStore.getState()
      await createSession('Test')
      
      useSessionStore.setState(state => ({
        ...state,
        session: state.session ? {
          ...state.session,
          slides: [createMockSlide({ id: 'slide-1' })],
        } : null,
      }))
      
      vi.clearAllMocks()
      
      // First update
      updateNote('slide-1', 'Note 1', 'Note 1')
      
      // Wait half the interval
      await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS / 2)
      
      // Another update - should reset timer
      updateNote('slide-1', 'Note 2', 'Note 2')
      
      // Wait another half interval (total: 1.5x interval from first change)
      await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS / 2)
      
      // Should not have saved yet (timer was reset)
      expect(window.electronAPI.saveSession).not.toHaveBeenCalled()
      
      // Wait the rest of the interval
      await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS / 2 + 100)
      
      // Now should have saved
      expect(window.electronAPI.saveSession).toHaveBeenCalledTimes(1)
    })
  })

  describe('large session handling', () => {
    it('should handle session with many slides', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      // Create session with 100 slides
      const manySlides = Array.from({ length: 100 }, (_, i) => 
        createMockSlide({ id: `slide-${i}`, index: i })
      )
      
      useSessionStore.setState({
        session: createMockSession({
          slides: manySlides,
        }),
      })
      
      // Also sync to slideStore since saveSession syncs from domain stores
      useSlideStore.getState().setSlides(manySlides)
      
      const { saveSession } = useSessionStore.getState()
      await saveSession()
      
      expect(window.electronAPI.saveSession).toHaveBeenCalled()
      
      // Verify the session was serialized with all slides
      const savedData = JSON.parse(
        (window.electronAPI.saveSession as ReturnType<typeof vi.fn>).mock.calls[0][1]
      )
      expect(savedData.slides.length).toBe(100)
    })

    it('should handle session with many notes', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      // Create notes for 50 slides
      const notes: Record<string, any> = {}
      for (let i = 0; i < 50; i++) {
        notes[`slide-${i}`] = createMockNote({
          id: `note-${i}`,
          slideId: `slide-${i}`,
          content: `<p>Long note content for slide ${i}. ${'Lorem ipsum '.repeat(100)}</p>`,
          plainText: `Long note content for slide ${i}. ${'Lorem ipsum '.repeat(100)}`,
        })
      }
      
      useSessionStore.setState({
        session: createMockSession({
          slides: Array.from({ length: 50 }, (_, i) => 
            createMockSlide({ id: `slide-${i}`, index: i })
          ),
          notes,
        }),
      })
      
      const { saveSession } = useSessionStore.getState()
      await saveSession()
      
      expect(window.electronAPI.saveSession).toHaveBeenCalled()
    })

    it('should handle session with large transcripts', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      
      // Create transcripts with many segments
      const transcripts: Record<string, any[]> = {}
      for (let i = 0; i < 10; i++) {
        transcripts[`slide-${i}`] = Array.from({ length: 100 }, (_, j) => ({
          id: `seg-${i}-${j}`,
          slideId: `slide-${i}`,
          text: `Segment ${j} of slide ${i}. This is some transcript text.`,
          startTime: j * 5000,
          endTime: (j + 1) * 5000,
          confidence: 0.9,
        }))
      }
      
      useSessionStore.setState({
        session: createMockSession({
          slides: Array.from({ length: 10 }, (_, i) => 
            createMockSlide({ id: `slide-${i}`, index: i })
          ),
          transcripts,
        }),
      })
      
      const { saveSession } = useSessionStore.getState()
      await saveSession()
      
      expect(window.electronAPI.saveSession).toHaveBeenCalled()
    })
  })

  describe('session list refresh', () => {
    it('should handle refresh errors gracefully', async () => {
      window.electronAPI.listSessions = vi.fn().mockRejectedValue(new Error('Network error'))
      
      const { refreshSessionList } = useSessionStore.getState()
      await refreshSessionList()
      
      const state = useSessionStore.getState()
      // Error handler returns user-friendly message
      expect(state.error).toEqual({
        message: 'Failed to load sessions',
        type: 'list',
      })
    })

    it('should update sessionList on successful refresh', async () => {
      const mockSessions = [
        { id: '1', name: 'Session 1', createdAt: '2024-01-01', updatedAt: '2024-01-02', slideCount: 5 },
        { id: '2', name: 'Session 2', createdAt: '2024-01-03', updatedAt: '2024-01-04', slideCount: 10 },
      ]
      
      window.electronAPI.listSessions = vi.fn().mockResolvedValue(mockSessions)
      
      const { refreshSessionList } = useSessionStore.getState()
      await refreshSessionList()
      
      const state = useSessionStore.getState()
      expect(state.sessionList).toEqual(mockSessions)
      expect(state.error).toBeNull()
    })
  })

  describe('session load with migration', () => {
    it('should migrate old session format', async () => {
      const oldFormatSession = {
        id: 'old-session',
        name: 'Old Session',
        slides: [],
        notes: {},
        transcripts: {},
        aiConversations: [],
        currentSlideIndex: 0,
        isRecording: false,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        // Missing: schemaVersion, enhancedNotes, phase, totalRecordingDuration
      }
      
      window.electronAPI.loadSession = vi.fn().mockResolvedValue(JSON.stringify(oldFormatSession))
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      
      const { loadSession } = useSessionStore.getState()
      await loadSession('old-session')
      
      const state = useSessionStore.getState()
      
      // Should have migrated fields
      expect(state.session?.schemaVersion).toBe(1)
      expect(state.session?.enhancedNotes).toEqual({})
      expect(state.session?.phase).toBe('idle')
      expect(state.session?.totalRecordingDuration).toBe(0)
      
      // Should have saved the migrated session
      expect(window.electronAPI.saveSession).toHaveBeenCalled()
    })

    it('should handle corrupted session data', async () => {
      window.electronAPI.loadSession = vi.fn().mockResolvedValue('invalid json {{{')
      
      const { loadSession } = useSessionStore.getState()
      await loadSession('corrupted-session')
      
      const state = useSessionStore.getState()
      expect(state.error).toEqual({
        message: expect.any(String),
        type: 'load',
      })
    })
  })

  describe('updatedAt tracking', () => {
    it('should update updatedAt timestamp on save', async () => {
      const originalDate = '2024-01-01T00:00:00.000Z'
      
      useSessionStore.setState({
        session: createMockSession({
          updatedAt: originalDate,
        }),
      })
      
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      
      const { saveSession } = useSessionStore.getState()
      await saveSession()
      
      const state = useSessionStore.getState()
      expect(state.session?.updatedAt).not.toBe(originalDate)
      expect(new Date(state.session!.updatedAt).getTime()).toBeGreaterThan(
        new Date(originalDate).getTime()
      )
    })
  })

  describe('feedback handling', () => {
    it('should set feedback and trigger immediate save', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      useSessionStore.setState({
        session: createMockSession({ id: 'test-1' }),
      })
      
      vi.clearAllMocks()
      
      const { setFeedback } = useSessionStore.getState()
      await setFeedback(5, 'Great app!')
      
      const state = useSessionStore.getState()
      expect(state.session?.feedback).toEqual({
        rating: 5,
        feedback: 'Great app!',
        submittedAt: expect.any(String),
      })
      
      // Should have saved immediately (not debounced)
      expect(window.electronAPI.saveSession).toHaveBeenCalled()
    })

    it('should handle save error during feedback', async () => {
      window.electronAPI.saveSession = vi.fn().mockRejectedValue(new Error('Save failed'))
      
      useSessionStore.setState({
        session: createMockSession({ id: 'test-1' }),
      })
      
      const { setFeedback } = useSessionStore.getState()
      
      // Should not throw
      await expect(setFeedback(4, 'Good')).resolves.not.toThrow()
      
      // Feedback should still be set
      expect(useSessionStore.getState().session?.feedback?.rating).toBe(4)
    })
  })

  describe('recording duration tracking', () => {
    it('should accumulate recording duration', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      useSessionStore.setState({
        session: createMockSession({
          totalRecordingDuration: 0,
        }),
      })
      
      const { addRecordingDuration } = useSessionStore.getState()
      
      addRecordingDuration(30000)
      expect(useSessionStore.getState().session?.totalRecordingDuration).toBe(30000)
      
      addRecordingDuration(60000)
      expect(useSessionStore.getState().session?.totalRecordingDuration).toBe(90000)
      
      addRecordingDuration(15000)
      expect(useSessionStore.getState().session?.totalRecordingDuration).toBe(105000)
    })

    it('should trigger autosave after adding duration', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      
      useSessionStore.setState({
        session: createMockSession({ id: 'test-1' }),
      })
      
      vi.clearAllMocks()
      
      const { addRecordingDuration } = useSessionStore.getState()
      addRecordingDuration(30000)
      
      // Should not have saved immediately
      expect(window.electronAPI.saveSession).not.toHaveBeenCalled()
      
      // Advance past autosave interval
      await vi.advanceTimersByTimeAsync(AUTOSAVE_INTERVAL_MS + 100)
      
      expect(window.electronAPI.saveSession).toHaveBeenCalled()
    })
  })

  describe('phase transitions', () => {
    it('should transition from recording to processing on stop', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      useSessionStore.setState({
        session: createMockSession({
          isRecording: true,
          phase: 'recording',
        }),
      })
      
      const { setRecording } = useSessionStore.getState()
      setRecording(false)
      
      const state = useSessionStore.getState()
      expect(state.session?.isRecording).toBe(false)
      expect(state.session?.phase).toBe('processing')
    })

    it('should transition to recording phase when starting', async () => {
      useSessionStore.setState({
        session: createMockSession({
          isRecording: false,
          phase: 'idle',
        }),
      })
      
      const { setRecording } = useSessionStore.getState()
      setRecording(true)
      
      const state = useSessionStore.getState()
      expect(state.session?.isRecording).toBe(true)
      expect(state.session?.phase).toBe('recording')
    })
  })

  describe('slide timing during recording', () => {
    it('should track slide view times during recording', async () => {
      const now = Date.now()
      vi.setSystemTime(now)
      
      const slides = [
        createMockSlide({ id: 'slide-0', index: 0 }),
        createMockSlide({ id: 'slide-1', index: 1 }),
        createMockSlide({ id: 'slide-2', index: 2 }),
      ]
      
      useSessionStore.setState({
        session: createMockSession({
          isRecording: true,
          slides,
          currentSlideIndex: 0,
        }),
      })
      
      // Also sync to slideStore since setCurrentSlide delegates there
      useSlideStore.getState().setSlides(slides)
      useSlideStore.setState({ currentSlideIndex: 0 })
      
      const { setCurrentSlide } = useSessionStore.getState()
      
      // Navigate to slide 1
      vi.setSystemTime(now + 5000)
      setCurrentSlide(1)
      
      const state = useSessionStore.getState()
      
      // Slide 0 should have viewedUntil set
      expect(state.session?.slides[0].viewedUntil).toBe(now + 5000)
      
      // Slide 1 should have viewedAt set
      expect(state.session?.slides[1].viewedAt).toBe(now + 5000)
    })

    it('should not track timing when not recording', async () => {
      const now = Date.now()
      vi.setSystemTime(now)
      
      const slides = [
        createMockSlide({ id: 'slide-0', index: 0 }),
        createMockSlide({ id: 'slide-1', index: 1 }),
      ]
      
      useSessionStore.setState({
        session: createMockSession({
          isRecording: false,
          slides,
          currentSlideIndex: 0,
        }),
      })
      
      // Also sync to slideStore since setCurrentSlide delegates there
      useSlideStore.getState().setSlides(slides)
      useSlideStore.setState({ currentSlideIndex: 0 })
      
      const { setCurrentSlide } = useSessionStore.getState()
      
      setCurrentSlide(1)
      
      const state = useSessionStore.getState()
      expect(state.session?.slides[0].viewedUntil).toBeUndefined()
      expect(state.session?.slides[1].viewedAt).toBeUndefined()
    })
  })
})

