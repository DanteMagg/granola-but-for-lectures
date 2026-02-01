import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock window.electronAPI
const mockElectronAPI = {
  // Session operations
  loadSession: vi.fn(),
  saveSession: vi.fn().mockResolvedValue(true),
  deleteSession: vi.fn().mockResolvedValue(true),
  listSessions: vi.fn().mockResolvedValue([]),
  
  // Dialog
  openPdfDialog: vi.fn(),
  
  // Audio
  saveAudio: vi.fn().mockResolvedValue('/path/to/audio'),
  deleteAudio: vi.fn().mockResolvedValue(true),
  
  // Slide images
  saveSlideImage: vi.fn().mockResolvedValue('/path/to/image'),
  loadSlideImage: vi.fn().mockResolvedValue(null),
  deleteSlideImage: vi.fn().mockResolvedValue(true),
  
  // Paths
  getPaths: vi.fn().mockResolvedValue({ userData: '/user/data', sessions: '/sessions' }),
  
  // Export
  exportPdf: vi.fn().mockResolvedValue('/path/to/export.pdf'),
  generatePdf: vi.fn().mockResolvedValue(true),
  
  // Whisper
  whisperInit: vi.fn().mockResolvedValue(true),
  whisperTranscribe: vi.fn().mockResolvedValue({ text: '', segments: [] }),
  whisperGetInfo: vi.fn().mockResolvedValue({ loaded: false, modelPath: '', modelName: '', exists: false, language: 'en', availableModels: [] }),
  whisperGetModels: vi.fn().mockResolvedValue([]),
  whisperSetModel: vi.fn().mockResolvedValue(true),
  whisperDownloadModel: vi.fn().mockResolvedValue({ success: true }),
  whisperCancelDownload: vi.fn().mockResolvedValue(true),
  onWhisperDownloadProgress: vi.fn().mockReturnValue(() => {}),
  
  // LLM
  llmInit: vi.fn().mockResolvedValue(true),
  llmGenerate: vi.fn().mockResolvedValue({ text: '', tokensUsed: 0, finishReason: 'stop' }),
  llmGenerateStream: vi.fn().mockResolvedValue({ text: '', tokensUsed: 0, finishReason: 'stop' }),
  llmGetInfo: vi.fn().mockResolvedValue({ loaded: false, modelPath: '', modelName: '', exists: false, contextLength: 2048, availableModels: [] }),
  llmGetModels: vi.fn().mockResolvedValue([]),
  llmSetModel: vi.fn().mockResolvedValue(true),
  llmUnload: vi.fn().mockResolvedValue(true),
  llmDownloadModel: vi.fn().mockResolvedValue({ success: true }),
  llmCancelDownload: vi.fn().mockResolvedValue(true),
  onLLMDownloadProgress: vi.fn().mockReturnValue(() => {}),
  onLLMChunk: vi.fn().mockReturnValue(() => {}),
  
  // Logging
  logsGet: vi.fn().mockResolvedValue(''),
  logsGetAll: vi.fn().mockResolvedValue(''),
  logsClear: vi.fn().mockResolvedValue(true),
  logsGetPath: vi.fn().mockResolvedValue('/logs'),
  logsWrite: vi.fn().mockResolvedValue(true),
  
  // Legacy (for backwards compatibility with old tests)
  onMenuAction: vi.fn(),
  sendAudioChunk: vi.fn(),
  startTranscription: vi.fn(),
  stopTranscription: vi.fn(),
  onTranscriptionResult: vi.fn(),
  getModelsPath: vi.fn(),
  downloadModel: vi.fn(),
  checkModelExists: vi.fn(),
  sendLLMPrompt: vi.fn(),
  onLLMResponse: vi.fn(),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// Mock focus
HTMLElement.prototype.focus = vi.fn()

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock toast store for error handler
vi.mock('../renderer/stores/toastStore', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    toast: {
      success: vi.fn().mockReturnValue('toast-id'),
      error: vi.fn().mockReturnValue('toast-id'),
      info: vi.fn().mockReturnValue('toast-id'),
      warning: vi.fn().mockReturnValue('toast-id'),
      shortcut: vi.fn().mockReturnValue('toast-id'),
    },
  }
})

// Suppress console errors in tests (optional, comment out for debugging)
// vi.spyOn(console, 'error').mockImplementation(() => {})

