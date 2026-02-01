/**
 * UI Store
 * Handles UI state with localStorage persistence
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UIState } from '@shared/types'
import { UI_DEFAULTS } from '@shared/constants'

// Persisted UI preferences (survive app restart)
interface PersistedUIState {
  sidebarCollapsed: boolean
  transcriptPanelHeight: number
  notesPanelWidth: number
  showLiveTranscript: boolean
  showEnhancedNotes: boolean
  showSlideList: boolean
}

// Transient UI state (reset on app restart)
interface TransientUIState {
  showAIChat: boolean
  aiChatContext: 'current-slide' | 'all-slides' | 'all-notes'
  showExportModal: boolean
  showSettingsModal: boolean
  showShortcutsHelp: boolean
  showSearchModal: boolean
  showFeedbackModal: boolean
}

interface UIStore extends PersistedUIState, TransientUIState {
  // Combined setter for backwards compatibility
  setUIState: (updates: Partial<UIState>) => void
  
  // Individual setters for common operations
  toggleSidebar: () => void
  toggleAIChat: () => void
  toggleSlideList: () => void
  
  // Modal helpers
  openModal: (modal: 'export' | 'settings' | 'shortcuts' | 'search' | 'feedback') => void
  closeModal: (modal: 'export' | 'settings' | 'shortcuts' | 'search' | 'feedback') => void
  closeAllModals: () => void
  
  // Reset transient state
  resetTransient: () => void
}

const defaultPersistedState: PersistedUIState = {
  sidebarCollapsed: false,
  transcriptPanelHeight: UI_DEFAULTS.TRANSCRIPT_PANEL_HEIGHT,
  notesPanelWidth: UI_DEFAULTS.NOTES_PANEL_WIDTH,
  showLiveTranscript: false,
  showEnhancedNotes: true,
  showSlideList: true,
}

const defaultTransientState: TransientUIState = {
  showAIChat: false,
  aiChatContext: 'current-slide',
  showExportModal: false,
  showSettingsModal: false,
  showShortcutsHelp: false,
  showSearchModal: false,
  showFeedbackModal: false,
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      ...defaultPersistedState,
      ...defaultTransientState,

      setUIState: (updates: Partial<UIState>) => {
        set(updates)
      },

      toggleSidebar: () => {
        set(state => ({ sidebarCollapsed: !state.sidebarCollapsed }))
      },

      toggleAIChat: () => {
        set(state => ({ showAIChat: !state.showAIChat }))
      },

      toggleSlideList: () => {
        set(state => ({ showSlideList: !state.showSlideList }))
      },

      openModal: (modal) => {
        const modalMap = {
          export: 'showExportModal',
          settings: 'showSettingsModal',
          shortcuts: 'showShortcutsHelp',
          search: 'showSearchModal',
          feedback: 'showFeedbackModal',
        } as const
        set({ [modalMap[modal]]: true })
      },

      closeModal: (modal) => {
        const modalMap = {
          export: 'showExportModal',
          settings: 'showSettingsModal',
          shortcuts: 'showShortcutsHelp',
          search: 'showSearchModal',
          feedback: 'showFeedbackModal',
        } as const
        set({ [modalMap[modal]]: false })
      },

      closeAllModals: () => {
        set({
          showExportModal: false,
          showSettingsModal: false,
          showShortcutsHelp: false,
          showSearchModal: false,
          showFeedbackModal: false,
          showAIChat: false,
        })
      },

      resetTransient: () => {
        set(defaultTransientState)
      },
    }),
    {
      name: 'lecture-notes-ui',
      // Only persist the UI preferences, not modal states
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        transcriptPanelHeight: state.transcriptPanelHeight,
        notesPanelWidth: state.notesPanelWidth,
        showLiveTranscript: state.showLiveTranscript,
        showEnhancedNotes: state.showEnhancedNotes,
        showSlideList: state.showSlideList,
      }),
    }
  )
)

