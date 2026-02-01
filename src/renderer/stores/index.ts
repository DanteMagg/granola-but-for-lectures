/**
 * Store Exports
 * Central export point for all Zustand stores
 */

// Main session store (handles persistence and session lifecycle)
export { useSessionStore } from './sessionStore'
export type { SessionError } from './sessionStore'

// Domain stores (handle specific data domains)
export { useSlideStore } from './slideStore'
export { useNotesStore } from './notesStore'
export { useTranscriptStore } from './transcriptStore'
export { useAIStore } from './aiStore'
export { useUIStore } from './uiStore'

// Toast store
export { useToastStore, toast } from './toastStore'

