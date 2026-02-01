import { contextBridge, ipcRenderer } from 'electron'

// Export data structure for PDF generation
export interface ExportData {
  sessionName: string
  exportedAt: string
  slides: Array<{
    index: number
    imageData: string | null
    note: string | null
    transcript: string | null
  }>
}

// Whisper types
export interface TranscriptionResult {
  text: string
  segments: Array<{
    start: number
    end: number
    text: string
    confidence: number
  }>
}

export interface WhisperModelInfo {
  loaded: boolean
  modelPath: string
  modelName: string
  exists: boolean
  language: string
  availableModels: Array<{
    name: string
    size: string
    downloaded: boolean
  }>
}

export interface WhisperModel {
  name: string
  size: string
  downloaded: boolean
  path: string
}

export interface DownloadProgress {
  modelName: string
  downloaded: number
  total: number
  percent: number
}

// LLM types
export interface GenerateRequest {
  prompt: string
  context?: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  stream?: boolean
}

export interface GenerateResponse {
  text: string
  tokensUsed: number
  finishReason: 'stop' | 'length' | 'error'
}

export interface LLMModelInfo {
  loaded: boolean
  modelPath: string
  modelName: string
  exists: boolean
  contextLength: number
  availableModels: Array<{
    name: string
    size: string
    contextLength: number
    downloaded: boolean
  }>
}

export interface LLMModel {
  name: string
  size: string
  contextLength: number
  downloaded: boolean
  path: string
}

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog operations
  openPdfDialog: () => ipcRenderer.invoke('dialog:openPdf'),
  
  // Session operations
  saveSession: (sessionId: string, data: string) => 
    ipcRenderer.invoke('session:save', sessionId, data),
  loadSession: (sessionId: string) => 
    ipcRenderer.invoke('session:load', sessionId),
  listSessions: () => 
    ipcRenderer.invoke('session:list'),
  deleteSession: (sessionId: string) => 
    ipcRenderer.invoke('session:delete', sessionId),
  
  // Audio operations
  saveAudio: (sessionId: string, audioData: string, slideIndex: number) =>
    ipcRenderer.invoke('audio:save', sessionId, audioData, slideIndex),
  deleteAudio: (sessionId: string, slideIndex: number) =>
    ipcRenderer.invoke('audio:delete', sessionId, slideIndex),
  
  // App paths
  getPaths: () => ipcRenderer.invoke('app:getPaths'),
  
  // Export
  exportPdf: (sessionId: string) => ipcRenderer.invoke('export:pdf', sessionId),
  generatePdf: (filePath: string, exportData: ExportData) =>
    ipcRenderer.invoke('export:generatePdf', filePath, exportData),
  
  // ==========================================
  // Slide Image operations (Lazy Loading)
  // ==========================================
  
  saveSlideImage: (sessionId: string, slideId: string, imageData: string): Promise<string> =>
    ipcRenderer.invoke('slide:saveImage', sessionId, slideId, imageData),
  
  loadSlideImage: (sessionId: string, slideId: string): Promise<string | null> =>
    ipcRenderer.invoke('slide:loadImage', sessionId, slideId),
  
  deleteSlideImage: (sessionId: string, slideId: string): Promise<boolean> =>
    ipcRenderer.invoke('slide:deleteImage', sessionId, slideId),
  
  // ==========================================
  // Whisper (Speech-to-Text) operations
  // ==========================================
  
  whisperInit: () => ipcRenderer.invoke('whisper:init'),
  
  whisperTranscribe: (audioBase64: string): Promise<TranscriptionResult> =>
    ipcRenderer.invoke('whisper:transcribe', audioBase64),
  
  whisperGetInfo: (): Promise<WhisperModelInfo> =>
    ipcRenderer.invoke('whisper:getInfo'),
  
  whisperGetModels: (): Promise<WhisperModel[]> =>
    ipcRenderer.invoke('whisper:getModels'),
  
  whisperSetModel: (modelName: string): Promise<boolean> =>
    ipcRenderer.invoke('whisper:setModel', modelName),
  
  whisperDownloadModel: (modelName: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('whisper:downloadModel', modelName),
  
  whisperCancelDownload: (): Promise<boolean> =>
    ipcRenderer.invoke('whisper:cancelDownload'),
  
  // Whisper download progress listener
  onWhisperDownloadProgress: (callback: (progress: { modelName: string; downloaded: number; total: number; percent: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: { modelName: string; downloaded: number; total: number; percent: number }) => callback(progress)
    ipcRenderer.on('whisper:downloadProgress', handler)
    // Return unsubscribe function
    return () => ipcRenderer.removeListener('whisper:downloadProgress', handler)
  },
  
  // ==========================================
  // LLM (Language Model) operations
  // ==========================================
  
  llmInit: () => ipcRenderer.invoke('llm:init'),
  
  llmGenerate: (request: GenerateRequest): Promise<GenerateResponse> =>
    ipcRenderer.invoke('llm:generate', request),
  
  llmGenerateStream: (request: GenerateRequest): Promise<GenerateResponse> =>
    ipcRenderer.invoke('llm:generateStream', request),
  
  llmGetInfo: (): Promise<LLMModelInfo> =>
    ipcRenderer.invoke('llm:getInfo'),
  
  llmGetModels: (): Promise<LLMModel[]> =>
    ipcRenderer.invoke('llm:getModels'),
  
  llmSetModel: (modelName: string): Promise<boolean> =>
    ipcRenderer.invoke('llm:setModel', modelName),
  
  llmUnload: (): Promise<boolean> =>
    ipcRenderer.invoke('llm:unload'),
  
  llmDownloadModel: (modelName: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('llm:downloadModel', modelName),
  
  llmCancelDownload: (): Promise<boolean> =>
    ipcRenderer.invoke('llm:cancelDownload'),
  
  // LLM download progress listener
  onLLMDownloadProgress: (callback: (progress: { modelName: string; downloaded: number; total: number; percent: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: { modelName: string; downloaded: number; total: number; percent: number }) => callback(progress)
    ipcRenderer.on('llm:downloadProgress', handler)
    return () => ipcRenderer.removeListener('llm:downloadProgress', handler)
  },
  
  // LLM streaming text listener
  onLLMChunk: (callback: (chunk: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: string) => callback(chunk)
    ipcRenderer.on('llm:chunk', handler)
    return () => ipcRenderer.removeListener('llm:chunk', handler)
  },

  // ==========================================
  // Logging operations
  // ==========================================

  logsGet: () => ipcRenderer.invoke('logs:get'),
  logsGetAll: () => ipcRenderer.invoke('logs:getAll'),
  logsClear: () => ipcRenderer.invoke('logs:clear'),
  logsGetPath: () => ipcRenderer.invoke('logs:getPath'),
  logsWrite: (level: string, message: string, data?: unknown) =>
    ipcRenderer.invoke('logs:write', level, message, data),
})

// Type definitions for the exposed API
export interface ElectronAPI {
  // Dialog
  openPdfDialog: () => Promise<{
    fileName: string
    filePath: string
    data: string
  } | null>
  
  // Sessions
  saveSession: (sessionId: string, data: string) => Promise<boolean>
  loadSession: (sessionId: string) => Promise<string | null>
  listSessions: () => Promise<
    Array<{
      id: string
      name: string
      createdAt: string
      updatedAt: string
      slideCount: number
    }>
  >
  deleteSession: (sessionId: string) => Promise<boolean>
  
  // Audio
  saveAudio: (
    sessionId: string,
    audioData: string,
    slideIndex: number
  ) => Promise<string>
  deleteAudio: (sessionId: string, slideIndex: number) => Promise<boolean>
  
  // Paths
  getPaths: () => Promise<{ userData: string; sessions: string }>
  
  // Export
  exportPdf: (sessionId: string) => Promise<string | null>
  generatePdf: (filePath: string, exportData: ExportData) => Promise<boolean>
  
  // Slide Images (Lazy Loading)
  saveSlideImage: (sessionId: string, slideId: string, imageData: string) => Promise<string>
  loadSlideImage: (sessionId: string, slideId: string) => Promise<string | null>
  deleteSlideImage: (sessionId: string, slideId: string) => Promise<boolean>
  
  // Whisper
  whisperInit: () => Promise<boolean>
  whisperTranscribe: (audioBase64: string) => Promise<TranscriptionResult>
  whisperGetInfo: () => Promise<WhisperModelInfo>
  whisperGetModels: () => Promise<WhisperModel[]>
  whisperSetModel: (modelName: string) => Promise<boolean>
  whisperDownloadModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
  whisperCancelDownload: () => Promise<boolean>
  onWhisperDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void
  
  // LLM
  llmInit: () => Promise<boolean>
  llmGenerate: (request: GenerateRequest) => Promise<GenerateResponse>
  llmGenerateStream: (request: GenerateRequest) => Promise<GenerateResponse>
  llmGetInfo: () => Promise<LLMModelInfo>
  llmGetModels: () => Promise<LLMModel[]>
  llmSetModel: (modelName: string) => Promise<boolean>
  llmUnload: () => Promise<boolean>
  llmDownloadModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
  llmCancelDownload: () => Promise<boolean>
  onLLMDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void
  onLLMChunk: (callback: (chunk: string) => void) => () => void

  // Logging
  logsGet: () => Promise<string>
  logsGetAll: () => Promise<string>
  logsClear: () => Promise<boolean>
  logsGetPath: () => Promise<string>
  logsWrite: (level: string, message: string, data?: unknown) => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
