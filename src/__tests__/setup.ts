import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock window.electronAPI
const mockElectronAPI = {
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  deleteSession: vi.fn(),
  listSessions: vi.fn().mockResolvedValue([]),
  openPdfDialog: vi.fn(),
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

// Suppress console errors in tests (optional, comment out for debugging)
// vi.spyOn(console, 'error').mockImplementation(() => {})

