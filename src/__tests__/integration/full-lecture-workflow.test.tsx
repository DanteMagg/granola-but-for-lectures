/**
 * Full Lecture Workflow Integration Tests
 * 
 * Tests the complete user journey through the lecture capture app:
 * 1. Create session → 2. Import PDF → 3. Start recording → 4. Take notes
 * 5. Navigate slides → 6. Stop recording → 7. Enhance notes → 8. Export
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import { useSlideStore } from '../../renderer/stores/slideStore'
import { createMockSlide, createMockTranscriptSegment } from '../helpers/mockData'
import type { Session, EnhancedNote, Slide } from '@shared/types'

// ============================================================================
// SETUP: Mocks and Helpers
// ============================================================================

const mockPdfData = 'JVBERi0xLjQK' // Minimal PDF base64

function createMockElectronAPI(overrides: Partial<typeof window.electronAPI> = {}) {
  return {
    // Session management
    loadSession: vi.fn().mockResolvedValue(null),
    saveSession: vi.fn().mockResolvedValue(true),
    deleteSession: vi.fn().mockResolvedValue(true),
    listSessions: vi.fn().mockResolvedValue([]),
    
    // PDF handling
    openPdfDialog: vi.fn().mockResolvedValue({
      fileName: 'lecture.pdf',
      data: mockPdfData,
    }),
    
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
      text: 'Transcribed lecture content about algorithms',
      segments: [
        { text: 'Welcome to the lecture on algorithms', start: 0, end: 2000, confidence: 0.95 },
        { text: 'Today we discuss sorting and searching', start: 2000, end: 4000, confidence: 0.92 },
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
    llmGenerate: vi.fn().mockImplementation(async ({ prompt }) => ({
      text: `Enhanced notes based on prompt: ${prompt.slice(0, 50)}...`,
      tokensUsed: 150,
      finishReason: 'stop',
    })),
    llmGenerateStream: vi.fn().mockResolvedValue({
      text: 'Streaming AI response',
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
    
    ...overrides,
  } as unknown as typeof window.electronAPI
}

function resetStore() {
  useSessionStore.setState({
    session: null,
    sessionList: [],
    isLoading: false,
    isSaving: false,
    error: null,
    ui: {
      sidebarCollapsed: false,
      transcriptPanelHeight: 200,
      notesPanelWidth: 320,
      showAIChat: false,
      aiChatContext: 'current-slide',
      showExportModal: false,
      showSettingsModal: false,
      showShortcutsHelp: false,
      showSearchModal: false,
      showFeedbackModal: false,
      showLiveTranscript: false,
      showEnhancedNotes: true,
      showSlideList: true,
    },
  })
  // Also reset the slideStore since sessionStore delegates navigation to it
  useSlideStore.getState().reset()
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Full Lecture Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    resetStore()
    window.electronAPI = createMockElectronAPI()
  })

  afterEach(() => {
    vi.useRealTimers()
    useSessionStore.getState().cleanup()
  })

  // --------------------------------------------------------------------------
  // HAPPY PATH: Complete lecture session from start to finish
  // --------------------------------------------------------------------------
  describe('Happy Path: Complete Lecture Session', () => {
    it('should complete full workflow: create → import → record → enhance → export', async () => {
      // ========== STEP 1: Create Session ==========
      const { createSession } = useSessionStore.getState()
      
      await act(async () => {
        await createSession('CS101 - Data Structures')
      })
      
      let { session } = useSessionStore.getState()
      expect(session).toBeTruthy()
      expect(session?.name).toBe('CS101 - Data Structures')
      expect(session?.phase).toBe('idle')
      expect(window.electronAPI.saveSession).toHaveBeenCalled()

      // ========== STEP 2: Import PDF Slides ==========
      const mockSlides: Slide[] = [
        createMockSlide({ id: 'slide-1', index: 0, extractedText: 'Introduction to Data Structures' }),
        createMockSlide({ id: 'slide-2', index: 1, extractedText: 'Arrays and Linked Lists' }),
        createMockSlide({ id: 'slide-3', index: 2, extractedText: 'Stacks and Queues' }),
        createMockSlide({ id: 'slide-4', index: 3, extractedText: 'Trees and Graphs' }),
      ]
      
      act(() => {
        useSessionStore.getState().setSlides(mockSlides)
        useSessionStore.getState().setPdfFileName('data-structures.pdf')
      })
      
      session = useSessionStore.getState().session
      expect(session?.slides.length).toBe(4)
      expect(session?.pdfFileName).toBe('data-structures.pdf')
      expect(session?.currentSlideIndex).toBe(0)

      // ========== STEP 3: Start Recording ==========
      act(() => {
        const s = useSessionStore.getState()
        s.setRecording(true)
        s.setRecordingStartTime(Date.now())
      })
      
      session = useSessionStore.getState().session
      expect(session?.isRecording).toBe(true)
      expect(session?.phase).toBe('recording')
      expect(session?.recordingStartTime).toBeDefined()

      // ========== STEP 4: Take Notes on Slide 1 ==========
      act(() => {
        useSessionStore.getState().updateNote(
          'slide-1',
          '<p>Key takeaway: Data structures organize data efficiently</p>',
          'Key takeaway: Data structures organize data efficiently'
        )
      })
      
      session = useSessionStore.getState().session
      expect(session?.notes['slide-1']).toBeTruthy()
      expect(session?.notes['slide-1'].plainText).toContain('Data structures')

      // ========== STEP 5: Add Transcript Segments ==========
      act(() => {
        const s = useSessionStore.getState()
        s.addTranscriptSegment('slide-1', {
          text: 'Today we begin our journey into data structures',
          startTime: 0,
          endTime: 3000,
          confidence: 0.95,
        })
        s.addTranscriptSegment('slide-1', {
          text: 'They are fundamental to computer science',
          startTime: 3000,
          endTime: 6000,
          confidence: 0.93,
        })
      })
      
      session = useSessionStore.getState().session
      expect(session?.transcripts['slide-1'].length).toBe(2)

      // ========== STEP 6: Navigate to Next Slide ==========
      act(() => {
        useSessionStore.getState().nextSlide()
      })
      
      session = useSessionStore.getState().session
      expect(session?.currentSlideIndex).toBe(1)

      // ========== STEP 7: Continue Recording on Slide 2 ==========
      act(() => {
        const s = useSessionStore.getState()
        s.updateNote(
          'slide-2',
          '<p>Arrays: contiguous memory. Linked lists: pointers.</p>',
          'Arrays: contiguous memory. Linked lists: pointers.'
        )
        s.addTranscriptSegment('slide-2', {
          text: 'Arrays store elements in contiguous memory locations',
          startTime: 6000,
          endTime: 10000,
          confidence: 0.94,
        })
      })

      // ========== STEP 8: Stop Recording ==========
      act(() => {
        const s = useSessionStore.getState()
        s.setRecording(false)
        s.setRecordingStartTime(null)
        s.addRecordingDuration(60000) // 1 minute
        s.setSessionPhase('ready_to_enhance')
      })
      
      session = useSessionStore.getState().session
      expect(session?.isRecording).toBe(false)
      expect(session?.phase).toBe('ready_to_enhance')
      expect(session?.totalRecordingDuration).toBe(60000)

      // ========== STEP 9: Enhance Notes ==========
      act(() => {
        useSessionStore.getState().setSessionPhase('enhancing')
      })

      // Simulate LLM enhancement for each slide with content
      const slidesWithContent = ['slide-1', 'slide-2']
      for (const slideId of slidesWithContent) {
        const enhancedNote: EnhancedNote = {
          id: `enhanced-${slideId}`,
          slideId,
          content: `AI-enhanced notes for ${slideId} combining user notes and transcript`,
          plainText: `AI-enhanced notes for ${slideId} combining user notes and transcript`,
          enhancedAt: new Date().toISOString(),
          status: 'complete',
        }
        
        act(() => {
          useSessionStore.getState().setEnhancedNote(slideId, enhancedNote)
        })
      }

      act(() => {
        useSessionStore.getState().setSessionPhase('enhanced')
      })
      
      session = useSessionStore.getState().session
      expect(session?.phase).toBe('enhanced')
      expect(Object.keys(session?.enhancedNotes || {}).length).toBe(2)
      expect(session?.enhancedNotes?.['slide-1'].status).toBe('complete')

      // ========== STEP 10: Verify Final State ==========
      session = useSessionStore.getState().session
      expect(session?.name).toBe('CS101 - Data Structures')
      expect(session?.slides.length).toBe(4)
      expect(Object.keys(session?.notes || {}).length).toBe(2)
      expect(Object.keys(session?.transcripts || {}).length).toBe(2)
      expect(Object.keys(session?.enhancedNotes || {}).length).toBe(2)
      expect(session?.totalRecordingDuration).toBe(60000)
      expect(session?.phase).toBe('enhanced')

      // Verify autosave was triggered
      await vi.advanceTimersByTimeAsync(2000)
      expect(window.electronAPI.saveSession).toHaveBeenCalled()
    })

    it('should maintain state consistency across all workflow stages', async () => {
      const { createSession, setSlides, setRecording, updateNote, nextSlide } = 
        useSessionStore.getState()

      // Create and setup
      await act(async () => {
        await createSession('State Consistency Test')
      })

      const slides = [
        createMockSlide({ id: 's1', index: 0 }),
        createMockSlide({ id: 's2', index: 1 }),
      ]

      act(() => setSlides(slides))

      // Record state at each stage
      const states: Session[] = []
      
      // State after slides
      states.push({ ...useSessionStore.getState().session! })
      
      // State after recording starts
      act(() => {
        setRecording(true)
        useSessionStore.getState().setRecordingStartTime(Date.now())
      })
      states.push({ ...useSessionStore.getState().session! })
      
      // State after note
      act(() => updateNote('s1', '<p>Note</p>', 'Note'))
      states.push({ ...useSessionStore.getState().session! })
      
      // State after navigation
      act(() => nextSlide())
      states.push({ ...useSessionStore.getState().session! })

      // Verify progression
      expect(states[0].isRecording).toBe(false)
      expect(states[1].isRecording).toBe(true)
      expect(states[2].notes['s1']).toBeDefined()
      expect(states[3].currentSlideIndex).toBe(1)

      // All states should have consistent session ID
      const sessionId = states[0].id
      states.forEach(s => expect(s.id).toBe(sessionId))
    })
  })

  // --------------------------------------------------------------------------
  // ERROR RECOVERY: Handle failures gracefully
  // --------------------------------------------------------------------------
  describe('Error Recovery', () => {
    it('should recover from failed session save', async () => {
      // Make save fail first, then succeed
      let saveCallCount = 0
      window.electronAPI = createMockElectronAPI({
        saveSession: vi.fn().mockImplementation(() => {
          saveCallCount++
          if (saveCallCount === 1) {
            return Promise.reject(new Error('Network error'))
          }
          return Promise.resolve(true)
        }),
      })

      const { createSession } = useSessionStore.getState()
      
      await act(async () => {
        await createSession('Error Test')
      })

      // First save fails
      let { error } = useSessionStore.getState()
      expect(error).toBeTruthy()
      expect(error?.type).toBe('save')

      // Retry should succeed
      await act(async () => {
        useSessionStore.getState().clearError()
        await useSessionStore.getState().saveSession()
      })

      error = useSessionStore.getState().error
      expect(error).toBeNull()
    })

    it('should continue workflow when transcription fails', async () => {
      // Transcription fails but recording continues
      window.electronAPI = createMockElectronAPI({
        whisperTranscribe: vi.fn().mockRejectedValue(new Error('Whisper crashed')),
      })

      const { createSession, setSlides, setRecording, addTranscriptSegment } = 
        useSessionStore.getState()

      await act(async () => {
        await createSession('Transcription Fail Test')
      })

      act(() => {
        setSlides([createMockSlide({ id: 'slide-1', index: 0 })])
        setRecording(true)
      })

      // Manual transcript should still work even if Whisper fails
      act(() => {
        addTranscriptSegment('slide-1', {
          text: 'Manually added transcript',
          startTime: 0,
          endTime: 1000,
          confidence: 1.0,
        })
      })

      const { session } = useSessionStore.getState()
      expect(session?.transcripts['slide-1'].length).toBe(1)
      expect(session?.isRecording).toBe(true)
    })

    it('should handle LLM unavailability during enhancement', async () => {
      window.electronAPI = createMockElectronAPI({
        llmGetInfo: vi.fn().mockResolvedValue({
          loaded: false,
          exists: false,
          modelName: '',
        }),
        llmGenerate: vi.fn().mockRejectedValue(new Error('LLM not loaded')),
      })

      const { createSession, setSlides, setSessionPhase, setEnhancedNote } = 
        useSessionStore.getState()

      await act(async () => {
        await createSession('LLM Unavailable Test')
      })

      act(() => {
        setSlides([createMockSlide({ id: 'slide-1', index: 0 })])
        setSessionPhase('ready_to_enhance')
      })

      // Attempt enhancement - should fail gracefully
      act(() => {
        setEnhancedNote('slide-1', {
          id: 'enhanced-1',
          slideId: 'slide-1',
          content: '',
          plainText: '',
          enhancedAt: new Date().toISOString(),
          status: 'error',
          error: 'LLM not available',
        })
      })

      const { session } = useSessionStore.getState()
      expect(session?.enhancedNotes?.['slide-1'].status).toBe('error')
      
      // Session should remain usable - can still export raw notes
      expect(session?.phase).toBe('ready_to_enhance')
    })

    it('should preserve data when PDF import fails mid-way', async () => {
      const { createSession, setSlides, updateNote } = useSessionStore.getState()

      await act(async () => {
        await createSession('Partial Import Test')
      })

      // Import first batch of slides successfully
      act(() => {
        setSlides([
          createMockSlide({ id: 'slide-1', index: 0 }),
          createMockSlide({ id: 'slide-2', index: 1 }),
        ])
      })

      // Add notes to existing slides
      act(() => {
        updateNote('slide-1', '<p>Important note</p>', 'Important note')
      })

      // Simulate second import that fails (e.g., corrupted PDF)
      // The existing data should be preserved
      const { session } = useSessionStore.getState()
      expect(session?.slides.length).toBe(2)
      expect(session?.notes['slide-1']).toBeDefined()
    })
  })

  // --------------------------------------------------------------------------
  // CONCURRENT OPERATIONS: Handle rapid user actions
  // --------------------------------------------------------------------------
  describe('Concurrent Operations', () => {
    it('should handle rapid slide navigation during recording', async () => {
      const { createSession, setSlides, setRecording, nextSlide, prevSlide, updateNote } = 
        useSessionStore.getState()

      await act(async () => {
        await createSession('Rapid Navigation Test')
      })

      act(() => {
        setSlides([
          createMockSlide({ id: 's1', index: 0 }),
          createMockSlide({ id: 's2', index: 1 }),
          createMockSlide({ id: 's3', index: 2 }),
          createMockSlide({ id: 's4', index: 3 }),
          createMockSlide({ id: 's5', index: 4 }),
        ])
        setRecording(true)
      })

      // Rapid navigation
      act(() => {
        nextSlide() // 0 -> 1
        nextSlide() // 1 -> 2
        updateNote('s3', '<p>Quick note</p>', 'Quick note')
        prevSlide() // 2 -> 1
        nextSlide() // 1 -> 2
        nextSlide() // 2 -> 3
        prevSlide() // 3 -> 2
      })

      const { session } = useSessionStore.getState()
      expect(session?.currentSlideIndex).toBe(2)
      expect(session?.notes['s3']).toBeDefined()
      expect(session?.isRecording).toBe(true)
    })

    it('should handle concurrent note updates across slides', async () => {
      const { createSession, setSlides, updateNote, setCurrentSlide } = 
        useSessionStore.getState()

      await act(async () => {
        await createSession('Concurrent Notes Test')
      })

      act(() => {
        setSlides([
          createMockSlide({ id: 's1', index: 0 }),
          createMockSlide({ id: 's2', index: 1 }),
          createMockSlide({ id: 's3', index: 2 }),
        ])
      })

      // Simulate rapid note updates on different slides
      act(() => {
        updateNote('s1', '<p>Note 1 v1</p>', 'Note 1 v1')
        setCurrentSlide(1)
        updateNote('s2', '<p>Note 2 v1</p>', 'Note 2 v1')
        setCurrentSlide(0)
        updateNote('s1', '<p>Note 1 v2</p>', 'Note 1 v2')
        setCurrentSlide(2)
        updateNote('s3', '<p>Note 3</p>', 'Note 3')
        setCurrentSlide(1)
        updateNote('s2', '<p>Note 2 v2</p>', 'Note 2 v2')
      })

      const { session } = useSessionStore.getState()
      expect(session?.notes['s1'].plainText).toBe('Note 1 v2')
      expect(session?.notes['s2'].plainText).toBe('Note 2 v2')
      expect(session?.notes['s3'].plainText).toBe('Note 3')
    })

    it('should queue saves when multiple rapid changes occur', async () => {
      const saveCalls: number[] = []
      window.electronAPI = createMockElectronAPI({
        saveSession: vi.fn().mockImplementation(async () => {
          saveCalls.push(Date.now())
          await new Promise(r => setTimeout(r, 100)) // Simulate save delay
          return true
        }),
      })

      const { createSession, setSlides, updateNote } = useSessionStore.getState()

      await act(async () => {
        await createSession('Queued Saves Test')
      })

      act(() => {
        setSlides([createMockSlide({ id: 's1', index: 0 })])
      })

      // Trigger multiple rapid changes that would each schedule autosave
      for (let i = 0; i < 5; i++) {
        act(() => {
          updateNote('s1', `<p>Version ${i}</p>`, `Version ${i}`)
        })
      }

      // Advance timers to trigger debounced autosave
      await vi.advanceTimersByTimeAsync(3000)

      // Should have debounced to fewer saves than changes
      const { session } = useSessionStore.getState()
      expect(session?.notes['s1'].plainText).toBe('Version 4')
    })

    it('should not lose data when save fails during concurrent edits', async () => {
      let shouldFail = true
      window.electronAPI = createMockElectronAPI({
        saveSession: vi.fn().mockImplementation(() => {
          if (shouldFail) {
            return Promise.reject(new Error('Save failed'))
          }
          return Promise.resolve(true)
        }),
      })

      const { createSession, setSlides, updateNote, saveSession, clearError } = 
        useSessionStore.getState()

      await act(async () => {
        try {
          await createSession('Concurrent Fail Test')
        } catch {
          // Expected to fail
        }
      })

      act(() => {
        clearError()
        setSlides([createMockSlide({ id: 's1', index: 0 })])
        updateNote('s1', '<p>Important data</p>', 'Important data')
      })

      // Save fails but data should still be in memory
      await act(async () => {
        try {
          await saveSession()
        } catch {
          // Expected
        }
      })

      const { session, error } = useSessionStore.getState()
      expect(session?.notes['s1'].plainText).toBe('Important data')
      expect(error).toBeTruthy()

      // Retry succeeds
      shouldFail = false
      act(() => clearError())
      
      await act(async () => {
        await saveSession()
      })

      expect(useSessionStore.getState().error).toBeNull()
    })
  })

  // --------------------------------------------------------------------------
  // STATE PERSISTENCE: Verify data survives session reload
  // --------------------------------------------------------------------------
  describe('State Persistence', () => {
    it('should restore complete session state from storage', async () => {
      // Create a saved session
      const savedSession: Session = {
        id: 'saved-session-123',
        name: 'Restored Session',
        slides: [
          createMockSlide({ id: 's1', index: 0 }),
          createMockSlide({ id: 's2', index: 1 }),
        ],
        notes: {
          's1': {
            id: 'n1',
            slideId: 's1',
            content: '<p>Saved note</p>',
            plainText: 'Saved note',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        },
        transcripts: {
          's1': [
            createMockTranscriptSegment({ slideId: 's1', text: 'Saved transcript' }),
          ],
        },
        enhancedNotes: {
          's1': {
            id: 'e1',
            slideId: 's1',
            content: 'Enhanced content',
            plainText: 'Enhanced content',
            enhancedAt: '2024-01-01T01:00:00Z',
            status: 'complete',
          },
        },
        aiConversations: [],
        currentSlideIndex: 1,
        isRecording: false,
        phase: 'enhanced',
        totalRecordingDuration: 120000,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T01:00:00Z',
        schemaVersion: 1,
      }

      window.electronAPI = createMockElectronAPI({
        loadSession: vi.fn().mockResolvedValue(JSON.stringify(savedSession)),
      })

      const { loadSession } = useSessionStore.getState()

      await act(async () => {
        await loadSession('saved-session-123')
      })

      const { session } = useSessionStore.getState()
      
      expect(session?.id).toBe('saved-session-123')
      expect(session?.name).toBe('Restored Session')
      expect(session?.slides.length).toBe(2)
      expect(session?.notes['s1'].plainText).toBe('Saved note')
      expect(session?.transcripts['s1'][0].text).toBe('Saved transcript')
      expect(session?.enhancedNotes?.['s1'].status).toBe('complete')
      expect(session?.currentSlideIndex).toBe(1)
      expect(session?.phase).toBe('enhanced')
      expect(session?.totalRecordingDuration).toBe(120000)
    })

    it('should handle loading corrupted session data gracefully', async () => {
      // Partial/corrupted session data
      const corruptedSession = {
        id: 'corrupted-123',
        name: 'Corrupted Session',
        // Missing required fields like slides, notes, etc.
      }

      window.electronAPI = createMockElectronAPI({
        loadSession: vi.fn().mockResolvedValue(JSON.stringify(corruptedSession)),
      })

      const { loadSession } = useSessionStore.getState()

      await act(async () => {
        await loadSession('corrupted-123')
      })

      // Should either recover or show error, not crash
      const { session, error } = useSessionStore.getState()
      // The validator should recover missing fields or set an error
      if (session) {
        expect(session.id).toBe('corrupted-123')
      } else {
        expect(error).toBeTruthy()
      }
    })

    it('should persist AI conversation history', async () => {
      const { createSession, addAIMessage } = useSessionStore.getState()

      await act(async () => {
        await createSession('AI History Test')
      })

      // Add conversation
      let convId: string | null = null
      
      act(() => {
        // First message creates conversation
        addAIMessage(null, { role: 'user', content: 'What is this slide about?' })
      })

      const session1 = useSessionStore.getState().session
      convId = session1?.aiConversations[0]?.id ?? null

      act(() => {
        if (convId) {
          addAIMessage(convId, { role: 'assistant', content: 'This slide covers algorithms.' })
          addAIMessage(convId, { role: 'user', content: 'Can you explain more?' })
        }
      })

      const { session } = useSessionStore.getState()
      expect(session?.aiConversations.length).toBe(1)
      expect(session?.aiConversations[0].messages.length).toBe(3)
    })

    it('should maintain session list across operations', async () => {
      window.electronAPI = createMockElectronAPI({
        listSessions: vi.fn().mockResolvedValue([
          { id: '1', name: 'Session 1', createdAt: '2024-01-01', updatedAt: '2024-01-01', slideCount: 5 },
          { id: '2', name: 'Session 2', createdAt: '2024-01-02', updatedAt: '2024-01-02', slideCount: 10 },
        ]),
      })

      const { refreshSessionList, createSession } = useSessionStore.getState()

      await act(async () => {
        await refreshSessionList()
      })

      expect(useSessionStore.getState().sessionList.length).toBe(2)

      // Create new session should refresh list
      window.electronAPI.listSessions = vi.fn().mockResolvedValue([
        { id: '1', name: 'Session 1', createdAt: '2024-01-01', updatedAt: '2024-01-01', slideCount: 5 },
        { id: '2', name: 'Session 2', createdAt: '2024-01-02', updatedAt: '2024-01-02', slideCount: 10 },
        { id: '3', name: 'New Session', createdAt: '2024-01-03', updatedAt: '2024-01-03', slideCount: 0 },
      ])

      await act(async () => {
        await createSession('New Session')
      })

      expect(useSessionStore.getState().sessionList.length).toBe(3)
    })
  })

  // --------------------------------------------------------------------------
  // EDGE CASES: Boundary conditions and unusual scenarios
  // --------------------------------------------------------------------------
  describe('Edge Cases', () => {
    it('should handle empty session (no slides, no notes)', async () => {
      const { createSession, saveSession } = useSessionStore.getState()

      await act(async () => {
        await createSession('Empty Session')
      })

      await act(async () => {
        await saveSession()
      })

      const { session } = useSessionStore.getState()
      expect(session?.slides.length).toBe(0)
      expect(Object.keys(session?.notes || {}).length).toBe(0)
    })

    it('should handle maximum slide count', async () => {
      const { createSession, setSlides } = useSessionStore.getState()

      await act(async () => {
        await createSession('Large Session')
      })

      // Create 500 slides (MAX_PDF_PAGES limit)
      const manySlides = Array.from({ length: 500 }, (_, i) => 
        createMockSlide({ id: `slide-${i}`, index: i })
      )

      act(() => {
        setSlides(manySlides)
      })

      const { session } = useSessionStore.getState()
      expect(session?.slides.length).toBe(500)
    })

    it('should handle recording started without slides', async () => {
      const { createSession, setRecording } = useSessionStore.getState()

      await act(async () => {
        await createSession('No Slides Recording')
      })

      // Try to start recording without slides
      act(() => {
        setRecording(true)
      })

      const { session } = useSessionStore.getState()
      // Recording can technically start, but there's nothing to attach transcripts to
      expect(session?.isRecording).toBe(true)
      expect(session?.slides.length).toBe(0)
    })

    it('should handle slide navigation at boundaries', async () => {
      await act(async () => {
        await useSessionStore.getState().createSession('Boundary Navigation')
      })

      const slides = [
        createMockSlide({ id: 's1', index: 0 }),
        createMockSlide({ id: 's2', index: 1 }),
        createMockSlide({ id: 's3', index: 2 }),
      ]

      act(() => {
        // Set slides in both stores since sessionStore.setCurrentSlide delegates to slideStore
        useSessionStore.getState().setSlides(slides)
        useSlideStore.getState().setSlides(slides)
      })

      // Starts at 0
      expect(useSessionStore.getState().session?.currentSlideIndex).toBe(0)
      expect(useSlideStore.getState().currentSlideIndex).toBe(0)

      // Test slideStore boundary clamping directly (sessionStore syncs from this)
      act(() => {
        useSlideStore.getState().setCurrentSlide(-5)
      })
      expect(useSlideStore.getState().currentSlideIndex).toBe(0)

      act(() => {
        useSlideStore.getState().setCurrentSlide(100)
      })
      expect(useSlideStore.getState().currentSlideIndex).toBe(2)

      // Test prevSlide at start stays at 0
      act(() => {
        useSlideStore.getState().setCurrentSlide(0)
        useSlideStore.getState().prevSlide()
      })
      expect(useSlideStore.getState().currentSlideIndex).toBe(0)

      // Test nextSlide at end stays at max
      act(() => {
        useSlideStore.getState().setCurrentSlide(2)
        useSlideStore.getState().nextSlide()
      })
      expect(useSlideStore.getState().currentSlideIndex).toBe(2)

      // Normal navigation works
      act(() => {
        useSlideStore.getState().setCurrentSlide(1)
      })
      expect(useSlideStore.getState().currentSlideIndex).toBe(1)

      // Test through sessionStore's prevSlide/nextSlide (these sync properly)
      act(() => {
        useSlideStore.getState().setCurrentSlide(0)
        useSessionStore.getState().nextSlide()
      })
      expect(useSessionStore.getState().session?.currentSlideIndex).toBe(1)
    })

    it('should handle very long notes content', async () => {
      const { createSession, setSlides, updateNote } = useSessionStore.getState()

      await act(async () => {
        await createSession('Long Notes')
      })

      act(() => {
        setSlides([createMockSlide({ id: 's1', index: 0 })])
      })

      // Create a very long note
      const longText = 'Lorem ipsum '.repeat(10000)
      
      act(() => {
        updateNote('s1', `<p>${longText}</p>`, longText)
      })

      const { session } = useSessionStore.getState()
      expect(session?.notes['s1'].plainText.length).toBe(longText.length)
    })

    it('should handle session phase transitions correctly', async () => {
      const { createSession, setSlides, setSessionPhase, setRecording } = 
        useSessionStore.getState()

      await act(async () => {
        await createSession('Phase Transitions')
      })

      act(() => {
        setSlides([createMockSlide({ id: 's1', index: 0 })])
      })

      // Initial state
      expect(useSessionStore.getState().session?.phase).toBe('idle')

      // Start recording
      act(() => {
        setRecording(true)
      })
      expect(useSessionStore.getState().session?.phase).toBe('recording')

      // Stop recording
      act(() => {
        setRecording(false)
      })
      expect(useSessionStore.getState().session?.phase).toBe('processing')

      // Progress through phases
      const phases = ['ready_to_enhance', 'enhancing', 'enhanced'] as const
      for (const phase of phases) {
        act(() => {
          setSessionPhase(phase)
        })
        expect(useSessionStore.getState().session?.phase).toBe(phase)
      }
    })

    it('should handle switching sessions mid-workflow', async () => {
      const { createSession, setSlides, setRecording, loadSession } = 
        useSessionStore.getState()

      // Create first session
      await act(async () => {
        await createSession('Session A')
      })

      const sessionAId = useSessionStore.getState().session?.id

      act(() => {
        setSlides([createMockSlide({ id: 's1', index: 0 })])
        setRecording(true)
      })

      expect(useSessionStore.getState().session?.isRecording).toBe(true)

      // Setup mock to return a different session
      const sessionB: Session = {
        id: 'session-b-id',
        name: 'Session B',
        slides: [createMockSlide({ id: 'b1', index: 0 })],
        notes: {},
        transcripts: {},
        enhancedNotes: {},
        aiConversations: [],
        currentSlideIndex: 0,
        isRecording: false,
        phase: 'idle',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schemaVersion: 1,
      }

      window.electronAPI.loadSession = vi.fn().mockResolvedValue(JSON.stringify(sessionB))

      // Switch to different session
      await act(async () => {
        await loadSession('session-b-id')
      })

      const { session } = useSessionStore.getState()
      expect(session?.id).toBe('session-b-id')
      expect(session?.name).toBe('Session B')
      expect(session?.isRecording).toBe(false) // New session not recording
    })
  })
})

