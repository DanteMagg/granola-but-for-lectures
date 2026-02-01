import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  Session,
  Slide,
  Note,
  EnhancedNote,
  TranscriptSegment,
  AIConversation,
  AIMessage,
  UIState,
  SessionPhase,
} from '@shared/types'
import { AUTOSAVE_INTERVAL_MS, UI_DEFAULTS } from '@shared/constants'
import { createLogger } from '../lib/logger'
import { validateSession, migrateSession, CURRENT_SCHEMA_VERSION } from '../lib/sessionValidator'

const log = createLogger('sessionStore')

export type SessionError = {
  message: string
  type: 'load' | 'save' | 'delete' | 'list'
} | null

interface SessionStore {
  // Current session
  session: Session | null

  // Session list for sidebar
  sessionList: Array<{
    id: string
    name: string
    createdAt: string
    updatedAt: string
    slideCount: number
  }>

  // UI state
  ui: UIState

  // Loading states
  isLoading: boolean
  isSaving: boolean

  // Error state - exposed so UI can display errors
  error: SessionError
  clearError: () => void

  // Actions
  createSession: (name?: string) => Promise<Session>
  loadSession: (sessionId: string) => Promise<void>
  saveSession: () => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  refreshSessionList: () => Promise<void>

  // Slide actions
  setSlides: (slides: Slide[]) => void
  setCurrentSlide: (index: number) => void
  nextSlide: () => void
  prevSlide: () => void

  // Note actions
  updateNote: (slideId: string, content: string, plainText: string) => void

  // Transcript actions
  addTranscriptSegment: (
    slideId: string,
    segment: Omit<TranscriptSegment, 'id' | 'slideId'>
  ) => void

  // Recording actions
  setRecording: (isRecording: boolean) => void
  setRecordingStartTime: (time: number | null) => void

  // Session phase actions (Granola-style workflow)
  setSessionPhase: (phase: SessionPhase) => void
  
  // Enhanced notes actions
  setEnhancedNote: (slideId: string, note: EnhancedNote) => void
  updateEnhancedNoteStatus: (slideId: string, status: EnhancedNote['status'], error?: string) => void

  // AI actions
  addAIMessage: (
    conversationId: string | null,
    message: Omit<AIMessage, 'id' | 'timestamp'>
  ) => string
  updateAIMessage: (
    conversationId: string | null,
    messageId: string,
    content: string
  ) => void

  // UI actions
  setUIState: (updates: Partial<UIState>) => void

  // Session metadata
  setSessionName: (name: string) => void
  setPdfFileName: (fileName: string) => void

  // Feedback
  setFeedback: (rating: number, feedback: string) => void
  addRecordingDuration: (duration: number) => void
}

const createEmptySession = (name?: string): Session => ({
  id: uuidv4(),
  name: name || 'Untitled Session',
  slides: [],
  notes: {},
  enhancedNotes: {},
  transcripts: {},
  aiConversations: [],
  currentSlideIndex: 0,
  isRecording: false,
  phase: 'idle',
  totalRecordingDuration: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  schemaVersion: CURRENT_SCHEMA_VERSION,
})

const defaultUIState: UIState = {
  sidebarCollapsed: false,
  transcriptPanelHeight: UI_DEFAULTS.TRANSCRIPT_PANEL_HEIGHT,
  notesPanelWidth: UI_DEFAULTS.NOTES_PANEL_WIDTH,
  showAIChat: false,
  aiChatContext: 'current-slide',
  showExportModal: false,
  showSettingsModal: false,
  showShortcutsHelp: false,
  showSearchModal: false,
  showFeedbackModal: false,
  showLiveTranscript: false,  // Hide transcript during recording by default (Granola-style)
  showEnhancedNotes: true,    // Show enhanced notes when available
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  sessionList: [],
  ui: defaultUIState,
  isLoading: false,
  isSaving: false,
  error: null,

  clearError: () => set({ error: null }),

  createSession: async (name?: string) => {
    const session = createEmptySession(name)
    set({ session, isLoading: false, error: null })

    // Save immediately
    await get().saveSession()
    await get().refreshSessionList()

    return session
  },

  loadSession: async (sessionId: string) => {
    set({ isLoading: true, error: null })

    try {
      const data = await window.electronAPI.loadSession(sessionId)
      if (data) {
        const parsed = JSON.parse(data)
        
        // Validate session data
        const validation = validateSession(parsed)
        
        if (validation.warnings.length > 0) {
          log.warn('Session validation warnings', validation.warnings)
        }
        
        // Use recovered session if there were issues, otherwise use parsed data
        let session: Session = validation.recovered || parsed
        
        // Migrate to current schema version if needed
        if (!session.schemaVersion || session.schemaVersion < CURRENT_SCHEMA_VERSION) {
          log.info(`Migrating session from version ${session.schemaVersion || 0} to ${CURRENT_SCHEMA_VERSION}`)
          session = migrateSession(session)
          // Save migrated session
          try {
            await window.electronAPI.saveSession(session.id, JSON.stringify(session))
            log.info('Migrated session saved successfully')
          } catch (saveError) {
            log.warn('Could not save migrated session', saveError)
          }
        }
        
        set({ session, isLoading: false })
      } else {
        set({
          isLoading: false,
          error: { message: 'Session not found', type: 'load' },
        })
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load session'
      log.error('Failed to load session', error)
      set({ isLoading: false, error: { message, type: 'load' } })
    }
  },

  saveSession: async () => {
    const { session } = get()
    if (!session) return

    set({ isSaving: true })

    try {
      const updatedSession = {
        ...session,
        updatedAt: new Date().toISOString(),
      }

      await window.electronAPI.saveSession(
        session.id,
        JSON.stringify(updatedSession)
      )
      set({ session: updatedSession, isSaving: false, error: null })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save session'
      log.error('Failed to save session', error)
      set({ isSaving: false, error: { message, type: 'save' } })
    }
  },

  deleteSession: async (sessionId: string) => {
    set({ error: null })

    try {
      await window.electronAPI.deleteSession(sessionId)

      // If we deleted the current session, clear it
      const { session } = get()
      if (session?.id === sessionId) {
        set({ session: null })
      }

      await get().refreshSessionList()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete session'
      log.error('Failed to delete session', error)
      set({ error: { message, type: 'delete' } })
    }
  },

  refreshSessionList: async () => {
    try {
      const sessions = await window.electronAPI.listSessions()
      set({ sessionList: sessions })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to refresh session list'
      log.error('Failed to refresh session list', error)
      set({ error: { message, type: 'list' } })
    }
  },

  setSlides: (slides: Slide[]) => {
    set(state => ({
      session: state.session
        ? {
            ...state.session,
            slides,
            currentSlideIndex: 0,
          }
        : null,
    }))

    // Trigger autosave
    scheduleAutosave(get)
  },

  setCurrentSlide: (index: number) => {
    set(state => {
      if (!state.session) return state
      const maxIndex = state.session.slides.length - 1
      const validIndex = Math.max(0, Math.min(index, maxIndex))
      const now = Date.now()
      
      // Track slide timing during recording (for transcript-slide association)
      const updatedSlides = state.session.slides.map((slide, i) => {
        if (state.session!.isRecording) {
          // Mark current slide as viewed until now
          if (i === state.session!.currentSlideIndex && !slide.viewedUntil) {
            return { ...slide, viewedUntil: now }
          }
          // Mark new slide as started viewing now
          if (i === validIndex && !slide.viewedAt) {
            return { ...slide, viewedAt: now }
          }
        }
        return slide
      })

      return {
        session: {
          ...state.session,
          slides: updatedSlides,
          currentSlideIndex: validIndex,
        },
      }
    })
  },

  nextSlide: () => {
    const { session, setCurrentSlide } = get()
    if (session && session.currentSlideIndex < session.slides.length - 1) {
      setCurrentSlide(session.currentSlideIndex + 1)
    }
  },

  prevSlide: () => {
    const { session, setCurrentSlide } = get()
    if (session && session.currentSlideIndex > 0) {
      setCurrentSlide(session.currentSlideIndex - 1)
    }
  },

  updateNote: (slideId: string, content: string, plainText: string) => {
    set(state => {
      if (!state.session) return state

      const existingNote = state.session.notes[slideId]
      const now = new Date().toISOString()

      const note: Note = existingNote
        ? { ...existingNote, content, plainText, updatedAt: now }
        : {
            id: uuidv4(),
            slideId,
            content,
            plainText,
            createdAt: now,
            updatedAt: now,
          }

      return {
        session: {
          ...state.session,
          notes: {
            ...state.session.notes,
            [slideId]: note,
          },
        },
      }
    })

    // Trigger autosave
    scheduleAutosave(get)
  },

  addTranscriptSegment: (
    slideId: string,
    segment: Omit<TranscriptSegment, 'id' | 'slideId'>
  ) => {
    set(state => {
      if (!state.session) return state

      const fullSegment: TranscriptSegment = {
        ...segment,
        id: uuidv4(),
        slideId,
      }

      const existingSegments = state.session.transcripts[slideId] || []

      return {
        session: {
          ...state.session,
          transcripts: {
            ...state.session.transcripts,
            [slideId]: [...existingSegments, fullSegment],
          },
        },
      }
    })

    // Trigger autosave
    scheduleAutosave(get)
  },

  setRecording: (isRecording: boolean) => {
    set(state => {
      if (!state.session) return state
      
      // Determine the new phase based on recording state
      let newPhase: SessionPhase = state.session.phase
      if (isRecording) {
        newPhase = 'recording'
      } else if (state.session.phase === 'recording') {
        // Stopped recording - transition to processing, then ready_to_enhance
        newPhase = 'processing'
      }
      
      return {
        session: {
          ...state.session,
          isRecording,
          phase: newPhase,
        },
      }
    })
  },

  setRecordingStartTime: (time: number | null) => {
    set(state => ({
      session: state.session
        ? {
            ...state.session,
            recordingStartTime: time ?? undefined,
          }
        : null,
    }))
  },

  setSessionPhase: (phase: SessionPhase) => {
    set(state => ({
      session: state.session
        ? {
            ...state.session,
            phase,
          }
        : null,
    }))
    scheduleAutosave(get)
  },

  setEnhancedNote: (slideId: string, note: EnhancedNote) => {
    set(state => {
      if (!state.session) return state
      return {
        session: {
          ...state.session,
          enhancedNotes: {
            ...state.session.enhancedNotes,
            [slideId]: note,
          },
        },
      }
    })
    scheduleAutosave(get)
  },

  updateEnhancedNoteStatus: (slideId: string, status: EnhancedNote['status'], error?: string) => {
    set(state => {
      if (!state.session) return state
      const existingNote = state.session.enhancedNotes[slideId]
      if (!existingNote) return state
      
      return {
        session: {
          ...state.session,
          enhancedNotes: {
            ...state.session.enhancedNotes,
            [slideId]: {
              ...existingNote,
              status,
              error,
            },
          },
        },
      }
    })
    scheduleAutosave(get)
  },

  addAIMessage: (
    conversationId: string | null,
    message: Omit<AIMessage, 'id' | 'timestamp'>
  ) => {
    const fullMessage: AIMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    }

    set(state => {
      if (!state.session) return state

      let conversations = [...state.session.aiConversations]

      if (conversationId) {
        // Add to existing conversation
        conversations = conversations.map(conv =>
          conv.id === conversationId
            ? { ...conv, messages: [...conv.messages, fullMessage] }
            : conv
        )
      } else {
        // Create new conversation
        const newConversation: AIConversation = {
          id: uuidv4(),
          sessionId: state.session.id,
          messages: [fullMessage],
          createdAt: new Date().toISOString(),
        }
        conversations.push(newConversation)
      }

      return {
        session: {
          ...state.session,
          aiConversations: conversations,
        },
      }
    })

    // Trigger autosave
    scheduleAutosave(get)

    return fullMessage.id
  },

  updateAIMessage: (
    conversationId: string | null,
    messageId: string,
    content: string
  ) => {
    set(state => {
      if (!state.session) return state

      const conversations = state.session.aiConversations.map(conv => {
        // Find the conversation containing this message
        const hasMessage = conv.messages.some(m => m.id === messageId)
        if (!hasMessage && conv.id !== conversationId) return conv

        return {
          ...conv,
          messages: conv.messages.map(m =>
            m.id === messageId ? { ...m, content } : m
          ),
        }
      })

      return {
        session: {
          ...state.session,
          aiConversations: conversations,
        },
      }
    })
  },

  setUIState: (updates: Partial<UIState>) => {
    set(state => ({
      ui: {
        ...state.ui,
        ...updates,
      },
    }))
  },

  setSessionName: (name: string) => {
    set(state => ({
      session: state.session
        ? {
            ...state.session,
            name,
          }
        : null,
    }))

    scheduleAutosave(get)
  },

  setPdfFileName: (fileName: string) => {
    set(state => ({
      session: state.session
        ? {
            ...state.session,
            pdfFileName: fileName,
          }
        : null,
    }))
  },

  setFeedback: (rating: number, feedback: string) => {
    set(state => ({
      session: state.session
        ? {
            ...state.session,
            feedback: {
              rating,
              feedback,
              submittedAt: new Date().toISOString(),
            },
            updatedAt: new Date().toISOString(),
          }
        : null,
    }))
    // Save immediately after setting feedback
    get().saveSession()
  },

  addRecordingDuration: (duration: number) => {
    set(state => ({
      session: state.session
        ? {
            ...state.session,
            totalRecordingDuration: (state.session.totalRecordingDuration || 0) + duration,
          }
        : null,
    }))
  },
}))

// Helper to schedule autosave with debounce
function scheduleAutosave(get: () => SessionStore) {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
  }

  autosaveTimer = setTimeout(() => {
    get().saveSession()
  }, AUTOSAVE_INTERVAL_MS)
}
