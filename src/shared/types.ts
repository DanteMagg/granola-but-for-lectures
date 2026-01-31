// Core data types for Lecture Note Companion

export interface Slide {
  id: string
  index: number
  imageData: string  // Base64 encoded image
  width: number
  height: number
  extractedText?: string
}

export interface Note {
  id: string
  slideId: string
  content: string  // HTML content from rich text editor
  plainText: string
  createdAt: string
  updatedAt: string
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
  transcripts: Record<string, TranscriptSegment[]>  // keyed by slideId
  aiConversations: AIConversation[]
  currentSlideIndex: number
  isRecording: boolean
  recordingStartTime?: number
  createdAt: string
  updatedAt: string
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
}

// Export options
export interface ExportOptions {
  includeSlides: boolean
  includeNotes: boolean
  includeTranscripts: boolean
  slideRange: 'all' | 'current' | 'custom'
  customRange?: { start: number; end: number }
}

