// Application constants

export const APP_NAME = 'Lecture Note Companion'
export const APP_VERSION = '0.1.0'

// Storage keys
export const STORAGE_KEYS = {
  UI_STATE: 'ui-state',
  RECENT_SESSIONS: 'recent-sessions',
  USER_PREFERENCES: 'user-preferences',
} as const

// Audio recording settings
export const AUDIO_CONFIG = {
  SAMPLE_RATE: 16000,  // 16kHz for Whisper compatibility
  CHANNELS: 1,  // Mono
  BITS_PER_SAMPLE: 16,
  MIME_TYPE: 'audio/webm;codecs=opus',
  CHUNK_INTERVAL_MS: 5000,  // Send chunks every 5 seconds for real-time transcription
} as const

// PDF processing
export const PDF_CONFIG = {
  MAX_SLIDE_WIDTH: 1920,
  MAX_SLIDE_HEIGHT: 1080,
  THUMBNAIL_WIDTH: 160,
  THUMBNAIL_HEIGHT: 90,
  SUPPORTED_FORMATS: ['pdf'],
} as const

// AI settings
export const AI_CONFIG = {
  MAX_CONTEXT_LENGTH: 4096,
  MAX_RESPONSE_LENGTH: 2048,
  TEMPERATURE: 0.7,
  CONTEXT_TYPES: ['current-slide', 'all-slides', 'all-notes'] as const,
} as const

// Transcription settings
export const TRANSCRIPTION_CONFIG = {
  // Minimum confidence score to include transcription (0-1)
  CONFIDENCE_THRESHOLD: 0.5,
  // Confidence below this shows "low confidence" warning (0-1)
  LOW_CONFIDENCE_THRESHOLD: 0.8,
  // Minimum audio duration in ms before sending for transcription
  MIN_CHUNK_DURATION_MS: 2000,
} as const

// UI defaults
export const UI_DEFAULTS = {
  SIDEBAR_WIDTH: 200,
  NOTES_PANEL_WIDTH: 350,
  TRANSCRIPT_PANEL_HEIGHT: 200,
  MIN_PANEL_SIZE: 150,
  MAX_PANEL_SIZE: 600,
} as const

// Keyboard shortcuts
export const SHORTCUTS = {
  NEXT_SLIDE: 'ArrowRight',
  PREV_SLIDE: 'ArrowLeft',
  TOGGLE_RECORDING: 'r',
  TOGGLE_AI_CHAT: 'a',
  SAVE: 'Meta+s',
  EXPORT: 'Meta+e',
  IMPORT_PDF: 'Meta+o',
} as const

// Autosave interval
export const AUTOSAVE_INTERVAL_MS = 3000

