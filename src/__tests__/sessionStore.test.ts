import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useSessionStore } from '../renderer/stores/sessionStore'
import type { Slide, Session } from '@shared/types'
import { createMockUIState, createMockSession } from './helpers/mockData'

// Helper to reset store between tests
const resetStore = () => {
  useSessionStore.setState({
    session: null,
    sessionList: [],
    ui: createMockUIState(),
    isLoading: false,
    isSaving: false,
    error: null,
  })
}

// Mock slides for testing
const createMockSlides = (count: number): Slide[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `slide-${i}`,
    index: i,
    imageData: `base64-image-${i}`,
    width: 1920,
    height: 1080,
    extractedText: `Slide ${i} content`,
  }))

describe('sessionStore', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  describe('createSession', () => {
    it('should create a new session with default name', async () => {
      const { createSession } = useSessionStore.getState()
      
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const session = await createSession()
      
      expect(session).toBeDefined()
      expect(session.name).toBe('Untitled Session')
      expect(session.slides).toEqual([])
      expect(session.notes).toEqual({})
      expect(session.transcripts).toEqual({})
      expect(session.aiConversations).toEqual([])
      expect(session.currentSlideIndex).toBe(0)
      expect(session.isRecording).toBe(false)
    })

    it('should create a session with custom name', async () => {
      const { createSession } = useSessionStore.getState()
      
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const session = await createSession('My Lecture')
      
      expect(session.name).toBe('My Lecture')
    })

    it('should save session immediately after creation', async () => {
      const { createSession } = useSessionStore.getState()
      
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      await createSession('Test Session')
      
      expect(window.electronAPI.saveSession).toHaveBeenCalled()
    })
  })

  describe('loadSession', () => {
    it('should load an existing session', async () => {
      const mockSession: Session = createMockSession({
        id: 'test-id',
        name: 'Loaded Session',
        slides: createMockSlides(3),
      })
      
      window.electronAPI.loadSession = vi.fn().mockResolvedValue(JSON.stringify(mockSession))
      
      const { loadSession } = useSessionStore.getState()
      await loadSession('test-id')
      
      const state = useSessionStore.getState()
      expect(state.session).toEqual(mockSession)
      expect(state.isLoading).toBe(false)
    })

    it('should set error when session not found', async () => {
      window.electronAPI.loadSession = vi.fn().mockResolvedValue(null)
      
      const { loadSession } = useSessionStore.getState()
      await loadSession('nonexistent-id')
      
      const state = useSessionStore.getState()
      expect(state.session).toBeNull()
      expect(state.error).toEqual({ message: 'Session not found', type: 'load' })
    })

    it('should handle load errors gracefully', async () => {
      window.electronAPI.loadSession = vi.fn().mockRejectedValue(new Error('Load failed'))
      
      const { loadSession } = useSessionStore.getState()
      await loadSession('test-id')
      
      const state = useSessionStore.getState()
      // Error handler returns user-friendly message
      expect(state.error).toEqual({ message: 'Failed to load session', type: 'load' })
    })
  })

  describe('saveSession', () => {
    it('should save the current session', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, saveSession } = useSessionStore.getState()
      await createSession('Test')
      
      vi.clearAllMocks()
      await saveSession()
      
      expect(window.electronAPI.saveSession).toHaveBeenCalled()
      const state = useSessionStore.getState()
      expect(state.isSaving).toBe(false)
    })

    it('should not save if no session exists', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      
      const { saveSession } = useSessionStore.getState()
      await saveSession()
      
      expect(window.electronAPI.saveSession).not.toHaveBeenCalled()
    })

    it('should handle save errors', async () => {
      window.electronAPI.saveSession = vi.fn()
        .mockResolvedValueOnce(undefined) // For createSession
        .mockRejectedValueOnce(new Error('Save failed'))
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, saveSession } = useSessionStore.getState()
      await createSession('Test')
      
      await saveSession()
      
      const state = useSessionStore.getState()
      // Error handler returns user-friendly message
      expect(state.error).toEqual({ message: 'Failed to save session', type: 'save' })
    })
  })

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      window.electronAPI.deleteSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { deleteSession } = useSessionStore.getState()
      await deleteSession('session-to-delete')
      
      expect(window.electronAPI.deleteSession).toHaveBeenCalledWith('session-to-delete')
    })

    it('should clear current session if deleted', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.deleteSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, deleteSession } = useSessionStore.getState()
      const session = await createSession('To Delete')
      
      await deleteSession(session.id)
      
      const state = useSessionStore.getState()
      expect(state.session).toBeNull()
    })

    it('should handle delete errors', async () => {
      window.electronAPI.deleteSession = vi.fn().mockRejectedValue(new Error('Delete failed'))
      
      const { deleteSession } = useSessionStore.getState()
      await deleteSession('test-id')
      
      const state = useSessionStore.getState()
      // Error handler returns user-friendly message
      expect(state.error).toEqual({ message: 'Failed to delete session', type: 'delete' })
    })
  })

  describe('setSlides', () => {
    it('should set slides and reset current index', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, setSlides } = useSessionStore.getState()
      await createSession('Test')
      
      const mockSlides = createMockSlides(5)
      setSlides(mockSlides)
      
      const state = useSessionStore.getState()
      expect(state.session?.slides).toEqual(mockSlides)
      expect(state.session?.currentSlideIndex).toBe(0)
    })

    it('should trigger autosave', async () => {
      // Use fake timers only for this specific test
      vi.useFakeTimers()

      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])

      const { createSession, setSlides } = useSessionStore.getState()

      // Run createSession with real timers behavior
      await vi.runAllTimersAsync()
      await createSession('Test')
      await vi.runAllTimersAsync()

      vi.clearAllMocks()
      setSlides(createMockSlides(3))

      // Autosave is scheduled after 3000ms (AUTOSAVE_INTERVAL_MS)
      await vi.advanceTimersByTimeAsync(3000)

      // Wait for any pending promises to resolve
      await vi.runAllTimersAsync()

      expect(window.electronAPI.saveSession).toHaveBeenCalled()

      // Restore real timers
      vi.useRealTimers()
    })
  })

  describe('setCurrentSlide', () => {
    it('should set valid slide index', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, setSlides, setCurrentSlide } = useSessionStore.getState()
      await createSession('Test')
      setSlides(createMockSlides(5))
      
      setCurrentSlide(3)
      
      const state = useSessionStore.getState()
      expect(state.session?.currentSlideIndex).toBe(3)
    })

    it('should clamp index to valid range', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, setSlides, setCurrentSlide } = useSessionStore.getState()
      await createSession('Test')
      setSlides(createMockSlides(5))
      
      setCurrentSlide(10) // Beyond max
      expect(useSessionStore.getState().session?.currentSlideIndex).toBe(4)
      
      setCurrentSlide(-5) // Below min
      expect(useSessionStore.getState().session?.currentSlideIndex).toBe(0)
    })
  })

  describe('nextSlide', () => {
    it('should advance to next slide', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, setSlides, nextSlide } = useSessionStore.getState()
      await createSession('Test')
      setSlides(createMockSlides(5))
      
      nextSlide()
      expect(useSessionStore.getState().session?.currentSlideIndex).toBe(1)
      
      nextSlide()
      expect(useSessionStore.getState().session?.currentSlideIndex).toBe(2)
    })

    it('should not advance past last slide', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, setSlides, setCurrentSlide, nextSlide } = useSessionStore.getState()
      await createSession('Test')
      setSlides(createMockSlides(5))
      setCurrentSlide(4) // Last slide
      
      nextSlide()
      expect(useSessionStore.getState().session?.currentSlideIndex).toBe(4)
    })
  })

  describe('prevSlide', () => {
    it('should go to previous slide', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, setSlides, setCurrentSlide, prevSlide } = useSessionStore.getState()
      await createSession('Test')
      setSlides(createMockSlides(5))
      setCurrentSlide(3)
      
      prevSlide()
      expect(useSessionStore.getState().session?.currentSlideIndex).toBe(2)
      
      prevSlide()
      expect(useSessionStore.getState().session?.currentSlideIndex).toBe(1)
    })

    it('should not go before first slide', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, setSlides, prevSlide } = useSessionStore.getState()
      await createSession('Test')
      setSlides(createMockSlides(5))
      
      prevSlide()
      expect(useSessionStore.getState().session?.currentSlideIndex).toBe(0)
    })
  })

  describe('updateNote', () => {
    it('should create a new note for a slide', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, setSlides, updateNote } = useSessionStore.getState()
      await createSession('Test')
      setSlides(createMockSlides(3))
      
      updateNote('slide-0', '<p>Test note</p>', 'Test note')
      
      const state = useSessionStore.getState()
      const note = state.session?.notes['slide-0']
      
      expect(note).toBeDefined()
      expect(note?.content).toBe('<p>Test note</p>')
      expect(note?.plainText).toBe('Test note')
      expect(note?.slideId).toBe('slide-0')
    })

    it('should update an existing note', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, setSlides, updateNote } = useSessionStore.getState()
      await createSession('Test')
      setSlides(createMockSlides(3))
      
      updateNote('slide-0', '<p>First note</p>', 'First note')
      const firstNoteId = useSessionStore.getState().session?.notes['slide-0']?.id
      
      updateNote('slide-0', '<p>Updated note</p>', 'Updated note')
      
      const state = useSessionStore.getState()
      const note = state.session?.notes['slide-0']
      
      expect(note?.id).toBe(firstNoteId) // Same note, updated
      expect(note?.content).toBe('<p>Updated note</p>')
    })
  })

  describe('addTranscriptSegment', () => {
    it('should add a transcript segment to a slide', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, setSlides, addTranscriptSegment } = useSessionStore.getState()
      await createSession('Test')
      setSlides(createMockSlides(3))
      
      addTranscriptSegment('slide-0', {
        text: 'Hello world',
        startTime: 0,
        endTime: 1000,
        confidence: 0.95,
      })
      
      const state = useSessionStore.getState()
      const segments = state.session?.transcripts['slide-0']
      
      expect(segments).toHaveLength(1)
      expect(segments?.[0].text).toBe('Hello world')
      expect(segments?.[0].slideId).toBe('slide-0')
    })

    it('should append multiple segments', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, setSlides, addTranscriptSegment } = useSessionStore.getState()
      await createSession('Test')
      setSlides(createMockSlides(3))
      
      addTranscriptSegment('slide-0', {
        text: 'First segment',
        startTime: 0,
        endTime: 1000,
        confidence: 0.95,
      })
      
      addTranscriptSegment('slide-0', {
        text: 'Second segment',
        startTime: 1000,
        endTime: 2000,
        confidence: 0.90,
      })
      
      const state = useSessionStore.getState()
      const segments = state.session?.transcripts['slide-0']
      
      expect(segments).toHaveLength(2)
    })
  })

  describe('addAIMessage', () => {
    it('should create a new conversation with first message', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, addAIMessage } = useSessionStore.getState()
      await createSession('Test')
      
      const messageId = addAIMessage(null, {
        role: 'user',
        content: 'What is this slide about?',
      })
      
      expect(messageId).toBeDefined()
      
      const state = useSessionStore.getState()
      expect(state.session?.aiConversations).toHaveLength(1)
      expect(state.session?.aiConversations[0].messages).toHaveLength(1)
      expect(state.session?.aiConversations[0].messages[0].content).toBe('What is this slide about?')
    })

    it('should add message to existing conversation', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, addAIMessage } = useSessionStore.getState()
      await createSession('Test')
      
      // Create conversation
      addAIMessage(null, { role: 'user', content: 'Question 1' })
      
      const conversationId = useSessionStore.getState().session?.aiConversations[0].id
      
      // Add to existing
      addAIMessage(conversationId!, { role: 'assistant', content: 'Answer 1' })
      
      const state = useSessionStore.getState()
      expect(state.session?.aiConversations).toHaveLength(1)
      expect(state.session?.aiConversations[0].messages).toHaveLength(2)
    })
  })

  describe('setUIState', () => {
    it('should update UI state', () => {
      const { setUIState } = useSessionStore.getState()
      
      setUIState({ sidebarCollapsed: true })
      expect(useSessionStore.getState().ui.sidebarCollapsed).toBe(true)
      
      setUIState({ showAIChat: true, aiChatContext: 'all-slides' })
      const state = useSessionStore.getState()
      expect(state.ui.showAIChat).toBe(true)
      expect(state.ui.aiChatContext).toBe('all-slides')
    })
  })

  describe('setSessionName', () => {
    it('should update session name', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, setSessionName } = useSessionStore.getState()
      await createSession('Original Name')
      
      setSessionName('New Name')
      
      expect(useSessionStore.getState().session?.name).toBe('New Name')
    })
  })

  describe('clearError', () => {
    it('should clear error state', () => {
      useSessionStore.setState({ error: { message: 'Test error', type: 'load' } })
      
      const { clearError } = useSessionStore.getState()
      clearError()
      
      expect(useSessionStore.getState().error).toBeNull()
    })
  })

  describe('setRecording', () => {
    it('should update recording state', async () => {
      window.electronAPI.saveSession = vi.fn().mockResolvedValue(undefined)
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([])
      
      const { createSession, setRecording } = useSessionStore.getState()
      await createSession('Test')
      
      setRecording(true)
      expect(useSessionStore.getState().session?.isRecording).toBe(true)
      
      setRecording(false)
      expect(useSessionStore.getState().session?.isRecording).toBe(false)
    })
  })
})

