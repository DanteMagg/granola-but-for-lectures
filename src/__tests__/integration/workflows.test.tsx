/**
 * Integration tests for complete workflows
 * These tests simulate user journeys through the application
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import { useSlideStore } from '../../renderer/stores/slideStore'
import { createMockSlide } from '../helpers/mockData'
import type { Session, EnhancedNote } from '@shared/types'

// Mock all electron APIs
beforeEach(() => {
  vi.clearAllMocks()
  
  // Reset the stores (both sessionStore and slideStore since they're coupled)
  useSessionStore.setState({
    session: null,
    sessionList: [],
    isLoading: false,
    isSaving: false,
    error: null,
  })
  useSlideStore.getState().reset()

  // Mock comprehensive electronAPI
  window.electronAPI = {
    // Session management
    loadSession: vi.fn().mockResolvedValue(null),
    saveSession: vi.fn().mockResolvedValue(true),
    deleteSession: vi.fn().mockResolvedValue(true),
    listSessions: vi.fn().mockResolvedValue([]),
    
    // PDF handling
    openPdfDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/path/to/lecture.pdf'] }),
    
    // Audio
    saveAudio: vi.fn().mockResolvedValue('/path/to/audio'),
    deleteAudio: vi.fn().mockResolvedValue(true),
    
    // Whisper
    whisperGetInfo: vi.fn().mockResolvedValue({
      loaded: true,
      exists: true,
      modelName: 'base.en',
      availableModels: [{ name: 'base', size: '142 MB', downloaded: true }],
    }),
    whisperInit: vi.fn().mockResolvedValue(true),
    whisperTranscribe: vi.fn().mockResolvedValue({
      text: 'Transcribed lecture content',
      segments: [
        { text: 'Welcome to the lecture', start: 0, end: 2000, confidence: 0.95 },
      ],
    }),
    whisperDownloadModel: vi.fn().mockResolvedValue({ success: true }),
    whisperCancelDownload: vi.fn().mockResolvedValue(true),
    onWhisperDownloadProgress: vi.fn().mockReturnValue(() => {}),

    // LLM
    llmGetInfo: vi.fn().mockResolvedValue({
      loaded: true,
      exists: true,
      modelName: 'tinyllama-1.1b',
      contextLength: 2048,
      availableModels: [{ name: 'tinyllama-1.1b', size: '670 MB', contextLength: 2048, downloaded: true }],
    }),
    llmInit: vi.fn().mockResolvedValue(true),
    llmGenerate: vi.fn().mockResolvedValue({
      text: 'Enhanced notes combining user input and transcript.',
      tokensUsed: 100,
      finishReason: 'stop',
    }),
    llmGenerateStream: vi.fn().mockResolvedValue({
      text: 'Streaming response',
      tokensUsed: 50,
      finishReason: 'stop',
    }),
    llmDownloadModel: vi.fn().mockResolvedValue({ success: true }),
    llmCancelDownload: vi.fn().mockResolvedValue(true),
    onLLMDownloadProgress: vi.fn().mockReturnValue(() => {}),
    onLLMChunk: vi.fn().mockReturnValue(() => {}),

    // Export
    exportPdf: vi.fn().mockResolvedValue({ success: true, path: '/path/to/export.pdf' }),
    exportMarkdown: vi.fn().mockResolvedValue({ success: true, path: '/path/to/export.md' }),

    // Logging
    logsGetAll: vi.fn().mockResolvedValue('Application logs'),
    logsClear: vi.fn().mockResolvedValue(true),
    log: vi.fn(),
    
    // Menu
    onMenuAction: vi.fn().mockReturnValue(() => {}),
  } as any
})

describe('Integration Tests', () => {
  describe('Session Workflow', () => {
    it('should create a new session', async () => {
      const { createSession } = useSessionStore.getState()
      
      await act(async () => {
        await createSession()
      })
      
      const { session } = useSessionStore.getState()
      expect(session).toBeTruthy()
      expect(session?.id).toBeDefined()
      expect(session?.slides).toEqual([])
    })

    it('should create session with custom name', async () => {
      const { createSession } = useSessionStore.getState()
      
      await act(async () => {
        await createSession('My Lecture Notes')
      })
      
      const { session } = useSessionStore.getState()
      expect(session?.name).toBe('My Lecture Notes')
    })

    it('should save and restore session name', async () => {
      const { createSession, setSessionName } = useSessionStore.getState()
      
      await act(async () => {
        await createSession()
      })
      
      act(() => {
        setSessionName('Updated Name')
      })
      
      const { session } = useSessionStore.getState()
      expect(session?.name).toBe('Updated Name')
    })
  })

  describe('Slide Management Workflow', () => {
    it('should set slides to session', async () => {
      const { createSession, setSlides } = useSessionStore.getState()
      
      await act(async () => {
        await createSession()
      })
      
      const mockSlides = [createMockSlide({ id: 'slide-1', index: 0 })]
      
      act(() => {
        setSlides(mockSlides)
      })
      
      const { session } = useSessionStore.getState()
      expect(session?.slides.length).toBe(1)
      expect(session?.slides[0].id).toBe('slide-1')
    })

    it('should navigate between slides', async () => {
      const { createSession, setSlides, setCurrentSlide } = useSessionStore.getState()
      
      await act(async () => {
        await createSession()
      })
      
      const slides = [
        createMockSlide({ id: 'slide-1', index: 0 }),
        createMockSlide({ id: 'slide-2', index: 1 }),
        createMockSlide({ id: 'slide-3', index: 2 }),
      ]
      
      act(() => {
        setSlides(slides)
        // Also sync to slideStore since setCurrentSlide delegates there
        useSlideStore.getState().setSlides(slides)
      })
      
      act(() => {
        setCurrentSlide(1)
      })
      
      const { session } = useSessionStore.getState()
      expect(session?.currentSlideIndex).toBe(1)
      
      act(() => {
        setCurrentSlide(2)
      })
      
      expect(useSessionStore.getState().session?.currentSlideIndex).toBe(2)
    })

    it('should navigate with next/prev functions', async () => {
      const { createSession, setSlides, nextSlide, prevSlide } = useSessionStore.getState()
      
      await act(async () => {
        await createSession()
      })
      
      const slides = [
        createMockSlide({ id: 'slide-1', index: 0 }),
        createMockSlide({ id: 'slide-2', index: 1 }),
        createMockSlide({ id: 'slide-3', index: 2 }),
      ]
      
      act(() => {
        setSlides(slides)
        // Also sync to slideStore since navigation delegates there
        useSlideStore.getState().setSlides(slides)
      })
      
      expect(useSessionStore.getState().session?.currentSlideIndex).toBe(0)
      
      act(() => {
        nextSlide()
      })
      
      expect(useSessionStore.getState().session?.currentSlideIndex).toBe(1)
      
      act(() => {
        nextSlide()
      })
      
      expect(useSessionStore.getState().session?.currentSlideIndex).toBe(2)
      
      act(() => {
        prevSlide()
      })
      
      expect(useSessionStore.getState().session?.currentSlideIndex).toBe(1)
    })
  })

  describe('Notes Workflow', () => {
    it('should add and update notes for a slide', async () => {
      const { createSession, setSlides, updateNote } = useSessionStore.getState()
      
      await act(async () => {
        await createSession()
      })
      
      act(() => {
        setSlides([createMockSlide({ id: 'slide-1', index: 0 })])
      })
      
      act(() => {
        updateNote('slide-1', '<p>My lecture notes</p>', 'My lecture notes')
      })
      
      const { session } = useSessionStore.getState()
      expect(session?.notes['slide-1']).toBeTruthy()
      expect(session?.notes['slide-1'].plainText).toBe('My lecture notes')
    })

    it('should preserve notes when switching slides', async () => {
      const { createSession, setSlides, updateNote, setCurrentSlide } = useSessionStore.getState()
      
      await act(async () => {
        await createSession()
      })
      
      const slides = [
        createMockSlide({ id: 'slide-1', index: 0 }),
        createMockSlide({ id: 'slide-2', index: 1 }),
      ]
      
      act(() => {
        setSlides(slides)
        useSlideStore.getState().setSlides(slides)
      })
      
      act(() => {
        updateNote('slide-1', '<p>Notes for slide 1</p>', 'Notes for slide 1')
        setCurrentSlide(1)
        updateNote('slide-2', '<p>Notes for slide 2</p>', 'Notes for slide 2')
        setCurrentSlide(0)
      })
      
      const { session } = useSessionStore.getState()
      expect(session?.notes['slide-1'].plainText).toBe('Notes for slide 1')
      expect(session?.notes['slide-2'].plainText).toBe('Notes for slide 2')
    })
  })

  describe('Transcript Workflow', () => {
    it('should add transcript segments to a slide', async () => {
      const { createSession, setSlides, addTranscriptSegment } = useSessionStore.getState()
      
      await act(async () => {
        await createSession()
      })
      
      act(() => {
        setSlides([createMockSlide({ id: 'slide-1', index: 0 })])
      })
      
      act(() => {
        addTranscriptSegment('slide-1', {
          text: 'Welcome to the lecture',
          startTime: 0,
          endTime: 2000,
          confidence: 0.95,
        })
        
        addTranscriptSegment('slide-1', {
          text: 'Today we will discuss algorithms',
          startTime: 2000,
          endTime: 5000,
          confidence: 0.92,
        })
      })
      
      const { session } = useSessionStore.getState()
      expect(session?.transcripts['slide-1'].length).toBe(2)
      expect(session?.transcripts['slide-1'][0].text).toBe('Welcome to the lecture')
    })
  })

  describe('Recording Workflow', () => {
    it('should toggle recording state', async () => {
      const { createSession, setSlides, setRecording, setRecordingStartTime } = useSessionStore.getState()
      
      await act(async () => {
        await createSession()
      })
      
      act(() => {
        setSlides([createMockSlide({ id: 'slide-1', index: 0 })])
      })
      
      // Start recording
      act(() => {
        setRecording(true)
        setRecordingStartTime(Date.now())
      })
      
      expect(useSessionStore.getState().session?.isRecording).toBe(true)
      expect(useSessionStore.getState().session?.recordingStartTime).toBeTruthy()
      
      // Stop recording
      act(() => {
        setRecording(false)
        setRecordingStartTime(null)
      })
      
      expect(useSessionStore.getState().session?.isRecording).toBe(false)
    })

    it('should track total recording duration', async () => {
      const { createSession, setSlides, addRecordingDuration } = useSessionStore.getState()
      
      await act(async () => {
        await createSession()
      })
      
      act(() => {
        setSlides([createMockSlide({ id: 'slide-1', index: 0 })])
      })
      
      act(() => {
        addRecordingDuration(30000) // 30 seconds
        addRecordingDuration(60000) // 60 seconds
      })
      
      const { session } = useSessionStore.getState()
      expect(session?.totalRecordingDuration).toBe(90000)
    })
  })

  describe('Enhancement Workflow', () => {
    it('should set enhanced notes for a slide', async () => {
      const { createSession, setSlides, setEnhancedNote } = useSessionStore.getState()
      
      await act(async () => {
        await createSession()
      })
      
      act(() => {
        setSlides([createMockSlide({ id: 'slide-1', index: 0 })])
      })
      
      const enhancedNote: EnhancedNote = {
        id: 'enhanced-1',
        slideId: 'slide-1',
        content: 'AI-enhanced notes combining user input and transcript',
        plainText: 'AI-enhanced notes combining user input and transcript',
        enhancedAt: new Date().toISOString(),
        status: 'complete',
      }
      
      act(() => {
        setEnhancedNote('slide-1', enhancedNote)
      })
      
      const { session } = useSessionStore.getState()
      expect(session?.enhancedNotes?.['slide-1']).toBeTruthy()
      expect(session?.enhancedNotes?.['slide-1'].status).toBe('complete')
    })

    it('should track session phase through enhancement', async () => {
      const { createSession, setSessionPhase } = useSessionStore.getState()
      
      await act(async () => {
        await createSession()
      })
      
      // Progress through phases
      const phases: Array<Session['phase']> = ['idle', 'recording', 'ready_to_enhance', 'enhancing', 'enhanced']
      
      for (const phase of phases) {
        act(() => {
          setSessionPhase(phase)
        })
        expect(useSessionStore.getState().session?.phase).toBe(phase)
      }
    })
  })

  describe('AI Chat Workflow', () => {
    it('should add AI messages to conversation', async () => {
      const { createSession, addAIMessage } = useSessionStore.getState()
      
      await act(async () => {
        await createSession()
      })
      
      // Add user message (creates new conversation)
      act(() => {
        addAIMessage(null, {
          role: 'user',
          content: 'What is this slide about?',
        })
      })
      
      let { session } = useSessionStore.getState()
      expect(session?.aiConversations.length).toBe(1)
      expect(session?.aiConversations[0].messages.length).toBe(1)
      
      // Get conversation ID
      const convId = session?.aiConversations[0].id
      
      // Add assistant message
      act(() => {
        addAIMessage(convId!, {
          role: 'assistant',
          content: 'This slide discusses the fundamentals of algorithms.',
        })
      })
      
      session = useSessionStore.getState().session
      expect(session?.aiConversations[0].messages.length).toBe(2)
    })
  })

  describe('UI State Workflow', () => {
    it('should manage UI state independently of session', async () => {
      const { createSession, setUIState } = useSessionStore.getState()
      
      await act(async () => {
        await createSession()
      })
      
      // Toggle various UI states
      act(() => {
        setUIState({ showAIChat: true })
      })
      
      expect(useSessionStore.getState().ui.showAIChat).toBe(true)
      
      act(() => {
        setUIState({ showExportModal: true, showAIChat: false })
      })
      
      const { ui } = useSessionStore.getState()
      expect(ui.showExportModal).toBe(true)
      expect(ui.showAIChat).toBe(false)
    })
  })

  describe('Complete Lecture Workflow', () => {
    it('should simulate a complete lecture session', async () => {
      const store = useSessionStore.getState()
      
      // 1. Create session
      await act(async () => {
        await store.createSession('CS101 - Introduction to Algorithms')
      })
      
      // 2. Add slides (simulating PDF import)
      const slides = [
        createMockSlide({ id: 'slide-1', index: 0, extractedText: 'What is an Algorithm?' }),
        createMockSlide({ id: 'slide-2', index: 1, extractedText: 'Time Complexity' }),
        createMockSlide({ id: 'slide-3', index: 2, extractedText: 'Space Complexity' }),
      ]
      act(() => {
        useSessionStore.getState().setSlides(slides)
        useSlideStore.getState().setSlides(slides)
      })
      
      // 3. Start recording
      act(() => {
        const s = useSessionStore.getState()
        s.setRecording(true)
        s.setRecordingStartTime(Date.now())
        s.setSessionPhase('recording')
      })
      
      // 4. Add transcripts and notes while recording
      act(() => {
        const s = useSessionStore.getState()
        // Slide 1 transcript and notes
        s.addTranscriptSegment('slide-1', {
          text: 'An algorithm is a step-by-step procedure',
          startTime: 0,
          endTime: 3000,
          confidence: 0.95,
        })
        s.updateNote('slide-1', '<p>Algorithm = procedure</p>', 'Algorithm = procedure')
        
        // Navigate to slide 2
        s.setCurrentSlide(1)
        
        // Slide 2 transcript and notes
        s.addTranscriptSegment('slide-2', {
          text: 'Big O notation measures algorithm efficiency',
          startTime: 3000,
          endTime: 6000,
          confidence: 0.93,
        })
        s.updateNote('slide-2', '<p>Big O = efficiency</p>', 'Big O = efficiency')
      })
      
      // 5. Stop recording
      act(() => {
        const s = useSessionStore.getState()
        s.setRecording(false)
        s.setRecordingStartTime(null)
        s.addRecordingDuration(60000)
        s.setSessionPhase('ready_to_enhance')
      })
      
      // 6. Enhance notes
      act(() => {
        const s = useSessionStore.getState()
        s.setSessionPhase('enhancing')
        
        s.setEnhancedNote('slide-1', {
          id: 'enhanced-1',
          slideId: 'slide-1',
          content: 'An algorithm is a step-by-step procedure for solving problems. Key insight: procedure.',
          plainText: 'An algorithm is a step-by-step procedure for solving problems. Key insight: procedure.',
          enhancedAt: new Date().toISOString(),
          status: 'complete',
        })
        
        s.setEnhancedNote('slide-2', {
          id: 'enhanced-2',
          slideId: 'slide-2',
          content: 'Big O notation measures algorithm efficiency. Used to compare algorithms.',
          plainText: 'Big O notation measures algorithm efficiency. Used to compare algorithms.',
          enhancedAt: new Date().toISOString(),
          status: 'complete',
        })
        
        s.setSessionPhase('enhanced')
      })
      
      // Verify final state
      const { session } = useSessionStore.getState()
      
      expect(session?.name).toBe('CS101 - Introduction to Algorithms')
      expect(session?.slides.length).toBe(3)
      expect(session?.phase).toBe('enhanced')
      expect(session?.totalRecordingDuration).toBe(60000)
      expect(Object.keys(session?.notes || {}).length).toBe(2)
      expect(Object.keys(session?.transcripts || {}).length).toBe(2)
      expect(Object.keys(session?.enhancedNotes || {}).length).toBe(2)
    })
  })
})
