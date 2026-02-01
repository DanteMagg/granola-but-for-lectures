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
import { sessionError } from '../lib/errorHandler'
import { useSlideStore } from './slideStore'
import { useNotesStore } from './notesStore'
import { useTranscriptStore } from './transcriptStore'
import { useAIStore } from './aiStore'
import { useUIStore } from './uiStore'

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

  // UI state (delegated to uiStore, kept for backwards compatibility)
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

  // Slide actions (delegated to slideStore)
  setSlides: (slides: Slide[]) => void
  setCurrentSlide: (index: number) => void
  nextSlide: () => void
  prevSlide: () => void

  // Note actions (delegated to notesStore)
  updateNote: (slideId: string, content: string, plainText: string) => void

  // Transcript actions (delegated to transcriptStore)
  addTranscriptSegment: (
    slideId: string,
    segment: Omit<TranscriptSegment, 'id' | 'slideId'>
  ) => void

  // Recording actions
  setRecording: (isRecording: boolean) => void
  setRecordingStartTime: (time: number | null) => void

  // Session phase actions (Granola-style workflow)
  setSessionPhase: (phase: SessionPhase) => void
  
  // Enhanced notes actions (delegated to notesStore)
  setEnhancedNote: (slideId: string, note: EnhancedNote) => void
  updateEnhancedNoteStatus: (slideId: string, status: EnhancedNote['status'], error?: string) => void

  // AI actions (delegated to aiStore)
  addAIMessage: (
    conversationId: string | null,
    message: Omit<AIMessage, 'id' | 'timestamp'>
  ) => string
  updateAIMessage: (
    conversationId: string | null,
    messageId: string,
    content: string
  ) => void

  // UI actions (delegated to uiStore)
  setUIState: (updates: Partial<UIState>) => void

  // Session metadata
  setSessionName: (name: string) => void
  setPdfFileName: (fileName: string) => void

  // Feedback
  setFeedback: (rating: number, feedback: string) => Promise<void>
  addRecordingDuration: (duration: number) => void

  // Cleanup
  cleanup: () => void
  
  // Sync helpers for domain stores
  syncToDomainStores: () => void
  syncFromDomainStores: () => Session | null
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
  showSlideList: true,        // Show slide thumbnails by default
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null
let saveInProgress: Promise<void> | null = null

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: null,
  sessionList: [],
  ui: defaultUIState,
  isLoading: false,
  isSaving: false,
  error: null,

  clearError: () => set({ error: null }),

  // Sync session data to domain stores
  syncToDomainStores: () => {
    const { session } = get()
    if (!session) {
      // Reset all domain stores
      useSlideStore.getState().reset()
      useNotesStore.getState().reset()
      useTranscriptStore.getState().reset()
      useAIStore.getState().reset()
      return
    }
    
    // Sync to domain stores
    useSlideStore.getState().setSlides(session.slides)
    useSlideStore.setState({ currentSlideIndex: session.currentSlideIndex })
    useNotesStore.getState().setNotes(session.notes)
    useNotesStore.getState().setEnhancedNotes(session.enhancedNotes)
    useTranscriptStore.getState().setTranscripts(session.transcripts)
    useAIStore.getState().setConversations(session.aiConversations, session.id)
  },

  // Sync from domain stores back to session
  syncFromDomainStores: () => {
    const { session } = get()
    if (!session) return null
    
    const slideState = useSlideStore.getState()
    const notesState = useNotesStore.getState()
    const transcriptState = useTranscriptStore.getState()
    const aiState = useAIStore.getState()
    
    return {
      ...session,
      slides: slideState.slides,
      currentSlideIndex: slideState.currentSlideIndex,
      notes: notesState.notes,
      enhancedNotes: notesState.enhancedNotes,
      transcripts: transcriptState.transcripts,
      aiConversations: aiState.conversations,
    }
  },

  createSession: async (name?: string) => {
    const session = createEmptySession(name)
    set({ session, isLoading: false, error: null })
    
    // Sync to domain stores
    get().syncToDomainStores()

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
        
        // Sync to domain stores
        get().syncToDomainStores()
      } else {
        set({
          isLoading: false,
          error: { message: 'Session not found', type: 'load' },
        })
      }
    } catch (error) {
      const result = sessionError(error, 'load', { severity: 'high' })
      set({ isLoading: false, error: { message: result.message, type: 'load' } })
    }
  },

  saveSession: async () => {
    const { session, isSaving, syncFromDomainStores } = get()
    if (!session) return

    // Capture the current session's updatedAt to detect if data changed during pending save
    const sessionAtCallTime = session.updatedAt

    // If a save is already in progress, wait for it to complete
    if (isSaving && saveInProgress) {
      try {
        await saveInProgress
        // Check if session changed while we were waiting - if so, need to save again
        const currentSession = get().session
        if (currentSession && currentSession.updatedAt === sessionAtCallTime) {
          // Session hasn't changed since this save was requested, skip
          return
        }
        // Session changed while waiting, continue with new save
      } catch {
        // Previous save failed, continue with this one
      }
    }

    set({ isSaving: true })

    saveInProgress = (async () => {
      try {
        // Sync from domain stores to get latest data
        const syncedSession = syncFromDomainStores()
        const sessionToSave = syncedSession || session
        
        const updatedSession = {
          ...sessionToSave,
          updatedAt: new Date().toISOString(),
        }

        // Yield to the event loop before heavy JSON serialization
        // This prevents blocking the UI during autosave
        // Using queueMicrotask allows the event loop to process pending work
        await new Promise<void>(resolve => queueMicrotask(resolve))

        // Serialize session - can be heavy for large sessions
        const serialized = JSON.stringify(updatedSession)

        await window.electronAPI.saveSession(
          session.id,
          serialized
        )
        set({ session: updatedSession, isSaving: false, error: null })
      } catch (error) {
        const result = sessionError(error, 'save', { severity: 'medium' })
        set({ isSaving: false, error: { message: result.message, type: 'save' } })
        throw error // Re-throw for internal queue handling
      } finally {
        saveInProgress = null
      }
    })()

    // Await but catch errors - they're already handled in state
    try {
      await saveInProgress
    } catch {
      // Error already set in state, don't throw to caller
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
      const result = sessionError(error, 'delete', { severity: 'medium' })
      set({ error: { message: result.message, type: 'delete' } })
    }
  },

  refreshSessionList: async () => {
    try {
      const sessions = await window.electronAPI.listSessions()
      set({ sessionList: sessions })
    } catch (error) {
      const result = sessionError(error, 'list', { severity: 'low' })
      set({ error: { message: result.message, type: 'list' } })
    }
  },

  setSlides: (slides: Slide[]) => {
    // Update domain store
    useSlideStore.getState().setSlides(slides)
    
    // Update session
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
    const { session } = get()
    if (!session) return
    
    const now = Date.now()
    const slideStore = useSlideStore.getState()
    
    // Track slide timing during recording
    if (session.isRecording) {
      slideStore.markSlideLeft(session.currentSlideIndex, now)
      slideStore.markSlideViewed(index, now)
    }
    
    // Update domain store
    slideStore.setCurrentSlide(index)
    
    // Get fresh state after the update (zustand returns immutable state)
    const updatedSlideStore = useSlideStore.getState()
    
    // Sync back to session
    set(state => {
      if (!state.session) return state
      return {
        session: {
          ...state.session,
          slides: updatedSlideStore.slides,
          currentSlideIndex: updatedSlideStore.currentSlideIndex,
        },
      }
    })
  },

  nextSlide: () => {
    useSlideStore.getState().nextSlide()
    const slideStore = useSlideStore.getState()
    set(state => ({
      session: state.session
        ? { ...state.session, currentSlideIndex: slideStore.currentSlideIndex }
        : null,
    }))
  },

  prevSlide: () => {
    useSlideStore.getState().prevSlide()
    const slideStore = useSlideStore.getState()
    set(state => ({
      session: state.session
        ? { ...state.session, currentSlideIndex: slideStore.currentSlideIndex }
        : null,
    }))
  },

  updateNote: (slideId: string, content: string, plainText: string) => {
    // Update domain store
    useNotesStore.getState().updateNote(slideId, content, plainText)
    
    // Sync to session
    const notesState = useNotesStore.getState()
    set(state => {
      if (!state.session) return state
      return {
        session: {
          ...state.session,
          notes: notesState.notes,
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
    // Update domain store
    useTranscriptStore.getState().addTranscriptSegment(slideId, segment)
    
    // Sync to session
    const transcriptState = useTranscriptStore.getState()
    set(state => {
      if (!state.session) return state
      return {
        session: {
          ...state.session,
          transcripts: transcriptState.transcripts,
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
    // Update domain store
    useNotesStore.getState().setEnhancedNote(slideId, note)
    
    // Sync to session
    const notesState = useNotesStore.getState()
    set(state => {
      if (!state.session) return state
      return {
        session: {
          ...state.session,
          enhancedNotes: notesState.enhancedNotes,
        },
      }
    })
    scheduleAutosave(get)
  },

  updateEnhancedNoteStatus: (slideId: string, status: EnhancedNote['status'], error?: string) => {
    // Update domain store
    useNotesStore.getState().updateEnhancedNoteStatus(slideId, status, error)
    
    // Sync to session
    const notesState = useNotesStore.getState()
    set(state => {
      if (!state.session) return state
      return {
        session: {
          ...state.session,
          enhancedNotes: notesState.enhancedNotes,
        },
      }
    })
    scheduleAutosave(get)
  },

  addAIMessage: (
    conversationId: string | null,
    message: Omit<AIMessage, 'id' | 'timestamp'>
  ) => {
    // Update domain store
    const { messageId, conversationId: newConvId } = useAIStore.getState().addMessage(conversationId, message)
    
    // Sync to session
    const aiState = useAIStore.getState()
    set(state => {
      if (!state.session) return state
      
      // Update session ID on conversations
      const conversations = aiState.conversations.map(c => ({
        ...c,
        sessionId: state.session!.id,
      }))
      
      return {
        session: {
          ...state.session,
          aiConversations: conversations,
        },
      }
    })

    // Trigger autosave
    scheduleAutosave(get)

    return messageId
  },

  updateAIMessage: (
    conversationId: string | null,
    messageId: string,
    content: string
  ) => {
    // Update domain store
    if (conversationId) {
      useAIStore.getState().updateMessage(conversationId, messageId, content)
    }
    
    // Sync to session
    const aiState = useAIStore.getState()
    set(state => {
      if (!state.session) return state
      return {
        session: {
          ...state.session,
          aiConversations: aiState.conversations,
        },
      }
    })
  },

  setUIState: (updates: Partial<UIState>) => {
    // Update domain store (persisted)
    useUIStore.getState().setUIState(updates)
    
    // Keep local copy in sync for backwards compatibility
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

  setFeedback: async (rating: number, feedback: string) => {
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
    // Save immediately after setting feedback - await to ensure it completes
    try {
      await get().saveSession()
    } catch (error) {
      log.error('Failed to save feedback', error)
    }
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
    // Trigger autosave to persist recording duration
    scheduleAutosave(get)
  },

  cleanup: () => {
    // Clear pending autosave timer to prevent memory leaks and stale saves
    if (autosaveTimer) {
      clearTimeout(autosaveTimer)
      autosaveTimer = null
    }
    // Clear any pending save promise
    saveInProgress = null
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
