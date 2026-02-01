// Test helper for creating mock data with all required fields
import type { Session, Slide, Note, UIState } from '@shared/types'

export const createMockSlide = (overrides?: Partial<Slide>): Slide => ({
  id: 'slide-1',
  index: 0,
  imageData: 'base64-image-data',
  width: 1920,
  height: 1080,
  extractedText: 'Slide text content',
  ...overrides,
})

export const createMockNote = (overrides?: Partial<Note>): Note => ({
  id: 'note-1',
  slideId: 'slide-1',
  content: '<p>Test note</p>',
  plainText: 'Test note',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

export const createMockSession = (overrides?: Partial<Session>): Session => ({
  id: 'session-1',
  name: 'Test Session',
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
  schemaVersion: 1,
  ...overrides,
})

export const createMockUIState = (overrides?: Partial<UIState>): UIState => ({
  sidebarCollapsed: false,
  transcriptPanelHeight: 200,
  notesPanelWidth: 350,
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
  ...overrides,
})

