// Core data types for Lecture Note Companion

// Session phases for the Granola-style workflow
export type SessionPhase = 
  | 'idle'              // No active session or reviewing old session
  | 'recording'         // Actively capturing audio
  | 'processing'        // Finishing transcription after recording stopped
  | 'ready_to_enhance'  // Recording done, enhancement available
  | 'enhancing'         // AI enhancement in progress
  | 'enhanced'          // Enhancement complete
  | 'reviewing'         // User reviewing/editing enhanced notes

export interface Slide {
  id: string
  index: number
  imageData: string  // Base64 encoded image
  width: number
  height: number
  extractedText?: string
  // Timing for slide context (when was this slide active during recording)
  viewedAt?: number       // Timestamp when user navigated to this slide
  viewedUntil?: number    // Timestamp when user left this slide
}

export interface Note {
  id: string
  slideId: string
  content: string  // HTML content from rich text editor
  plainText: string
  createdAt: string
  updatedAt: string
}

// Enhanced notes created by AI merging user notes + transcript
export interface EnhancedNote {
  id: string
  slideId: string
  content: string           // HTML content (enhanced)
  plainText: string
  originalNoteId?: string   // Reference to the original user note
  enhancedAt: string
  status: 'pending' | 'generating' | 'complete' | 'error' | 'accepted' | 'rejected'
  error?: string
}

export interface TranscriptSegment {
  id: string
  slideId: string
  text: string
  startTime: number  // ms from session start
  endTime: number
  confidence: number
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  slideContext?: string  // Which slide(s) were in context
  timestamp: string
}

export interface AIConversation {
  id: string
  sessionId: string
  messages: AIMessage[]
  createdAt: string
}

export interface Session {
  id: string
  name: string
  pdfFileName?: string
  slides: Slide[]
  notes: Record<string, Note>  // keyed by slideId
  enhancedNotes: Record<string, EnhancedNote>  // keyed by slideId - AI-enhanced versions
  transcripts: Record<string, TranscriptSegment[]>  // keyed by slideId
  aiConversations: AIConversation[]
  currentSlideIndex: number
  isRecording: boolean
  recordingStartTime?: number
  phase: SessionPhase  // Current workflow phase
  feedback?: SessionFeedback
  totalRecordingDuration?: number // Total ms recorded
  createdAt: string
  updatedAt: string
  schemaVersion?: number  // Schema version for migrations
}

export interface SessionListItem {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  slideCount: number
}

// Recording state
export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  startTime: number | null
  duration: number
  audioLevel: number
}

// UI State
export interface UIState {
  sidebarCollapsed: boolean
  transcriptPanelHeight: number
  notesPanelWidth: number
  showAIChat: boolean
  aiChatContext: 'current-slide' | 'all-slides' | 'all-notes'
  showExportModal: boolean
  showSettingsModal: boolean
  showShortcutsHelp: boolean
  showSearchModal: boolean
  showFeedbackModal: boolean
  // Granola-style: hide transcript during recording by default
  showLiveTranscript: boolean
  // Show enhanced notes vs original in review mode
  showEnhancedNotes: boolean
}

// Session feedback
export interface SessionFeedback {
  rating: number
  feedback: string
  submittedAt: string
}

// Export options
export interface ExportOptions {
  includeSlides: boolean
  includeNotes: boolean
  includeTranscripts: boolean
  slideRange: 'all' | 'current' | 'custom'
  customRange?: { start: number; end: number }
}

