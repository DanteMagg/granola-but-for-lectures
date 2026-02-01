// Browser mock for Electron API
// Used for testing in browser during development

import type { ElectronAPI, GenerateRequest, GenerateResponse } from '../../preload'

const STORAGE_KEY = 'lecture-note-companion-sessions'

// In-memory session storage for browser testing
function getStoredSessions(): Record<string, string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function setStoredSessions(sessions: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
}

// Simulated LLM responses for browser testing
function generateMockLLMResponse(request: GenerateRequest): string {
  const prompt = request.prompt.toLowerCase()
  
  if (prompt.includes('summarize') || prompt.includes('summary')) {
    if (request.context) {
      return `## Summary\n\nBased on the provided content, here are the key points:\n\n1. **Main Topic**: The lecture covers important concepts.\n2. **Key Details**: Several important details were discussed.\n3. **Conclusion**: Understanding these concepts is essential.\n\n*Note: This is a simulated response for browser testing.*`
    }
    return "Please provide some content (notes, transcript, or navigate to a slide) for me to summarize."
  }
  
  if (prompt.includes('explain') || prompt.includes('what is') || prompt.includes('how does')) {
    return `## Explanation\n\nLet me explain this concept:\n\n**Overview**: This is a simulated explanation for browser testing.\n\n**Key Points**:\n- Point 1: Important detail\n- Point 2: Another consideration\n- Point 3: Final note\n\nWould you like me to elaborate on any specific aspect?`
  }
  
  if (prompt.includes('quiz') || prompt.includes('test') || prompt.includes('question')) {
    return `## Practice Questions\n\n1. **Question 1**: What is the main concept discussed?\n2. **Question 2**: How does this relate to previous topics?\n3. **Question 3**: Can you provide an example?\n\n*These are simulated questions for browser testing.*`
  }
  
  return `I received your question: "${request.prompt}"\n\nThis is a **simulated response** for browser testing. In the actual app with a downloaded LLM model, you would receive intelligent, context-aware answers.\n\n*Model context: ${request.context ? 'Context provided' : 'No context'}*`
}

export const browserMockAPI: ElectronAPI = {
  openPdfDialog: async () => {
    // In browser, we can use a file input
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.pdf'
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) {
          resolve(null)
          return
        }

        const reader = new FileReader()
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1]
          resolve({
            fileName: file.name,
            filePath: file.name,
            data: base64,
          })
        }
        reader.readAsDataURL(file)
      }

      input.oncancel = () => resolve(null)
      input.click()
    })
  },

  saveSession: async (sessionId: string, data: string) => {
    const sessions = getStoredSessions()
    sessions[sessionId] = data
    setStoredSessions(sessions)
    return true
  },

  loadSession: async (sessionId: string) => {
    const sessions = getStoredSessions()
    return sessions[sessionId] || null
  },

  listSessions: async () => {
    const sessions = getStoredSessions()
    return Object.entries(sessions)
      .map(([id, dataStr]) => {
        try {
          const data = JSON.parse(dataStr)
          return {
            id,
            name: data.name || 'Untitled Session',
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
            slideCount: data.slides?.length || 0,
          }
        } catch {
          return null
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  },

  deleteSession: async (sessionId: string) => {
    const sessions = getStoredSessions()
    delete sessions[sessionId]
    setStoredSessions(sessions)
    return true
  },

  saveAudio: async (_sessionId: string, _audioData: string, slideIndex: number) => {
    // In browser, just return a fake path
    return `audio-slide-${slideIndex}.webm`
  },

  deleteAudio: async (_sessionId: string, _slideIndex: number) => {
    // In browser, no-op
    console.log('[Mock] Delete audio')
    return true
  },

  getPaths: async () => {
    return {
      userData: '/browser-mock/userData',
      sessions: '/browser-mock/sessions',
    }
  },

  exportPdf: async (sessionId: string) => {
    return `lecture-notes-${sessionId}.pdf`
  },
  
  generatePdf: async () => {
    return true
  },

  // ==========================================
  // Whisper (Speech-to-Text) operations
  // ==========================================

  whisperInit: async () => {
    console.log('[Mock] Whisper init')
    return false
  },

  whisperTranscribe: async (_audioBase64: string) => {
    console.log('[Mock] Whisper transcribe')
    return {
      text: '[Mock transcription - Whisper not available in browser]',
      segments: [{
        start: 0,
        end: 5000,
        text: '[Mock transcription]',
        confidence: 0.5
      }]
    }
  },

  whisperGetInfo: async () => {
    return {
      loaded: false,
      modelPath: '/mock/path/whisper',
      modelName: 'small',
      exists: false,
      language: 'en',
      availableModels: [
        { name: 'tiny', size: '75 MB', downloaded: false },
        { name: 'base', size: '142 MB', downloaded: false },
        { name: 'small', size: '466 MB', downloaded: false },
        { name: 'medium', size: '1.5 GB', downloaded: false },
      ]
    }
  },

  whisperGetModels: async () => {
    return [
      { name: 'tiny', size: '75 MB', downloaded: false, path: '/mock/path/tiny' },
      { name: 'base', size: '142 MB', downloaded: false, path: '/mock/path/base' },
      { name: 'small', size: '466 MB', downloaded: false, path: '/mock/path/small' },
    ]
  },

  whisperSetModel: async (_modelName: string) => {
    console.log('[Mock] Whisper set model:', _modelName)
    return true
  },

  whisperDownloadModel: async (_modelName: string) => {
    console.log('[Mock] Whisper download model:', _modelName)
    return { success: true }
  },

  whisperCancelDownload: async () => {
    console.log('[Mock] Whisper cancel download')
    return true
  },

  onWhisperDownloadProgress: (_callback) => {
    // Mock: no-op, return unsubscribe function
    return () => {}
  },

  // ==========================================
  // LLM (Language Model) operations
  // ==========================================

  llmInit: async () => {
    console.log('[Mock] LLM init')
    return true // Simulate that LLM is available for browser testing
  },

  llmGenerate: async (request: GenerateRequest): Promise<GenerateResponse> => {
    console.log('[Mock] LLM generate:', request.prompt.substring(0, 50))
    
    // Simulate some delay
    await new Promise(resolve => setTimeout(resolve, 800))
    
    return {
      text: generateMockLLMResponse(request),
      tokensUsed: 150,
      finishReason: 'stop'
    }
  },

  llmGenerateStream: async (request: GenerateRequest): Promise<GenerateResponse> => {
    console.log('[Mock] LLM generate stream:', request.prompt.substring(0, 50))
    
    // For browser mock, just return the full response (no actual streaming)
    await new Promise(resolve => setTimeout(resolve, 800))
    
    return {
      text: generateMockLLMResponse(request),
      tokensUsed: 150,
      finishReason: 'stop'
    }
  },

  llmGetInfo: async () => {
    return {
      loaded: true, // Simulate as loaded for browser testing
      modelPath: '/mock/path/llm',
      modelName: 'mock-llm',
      exists: true, // Simulate as available for browser testing
      contextLength: 4096,
      availableModels: [
        { name: 'tinyllama-1.1b', size: '670 MB', contextLength: 2048, downloaded: true },
        { name: 'phi-2', size: '1.6 GB', contextLength: 2048, downloaded: false },
        { name: 'llama-3.2-1b', size: '775 MB', contextLength: 8192, downloaded: false },
      ]
    }
  },

  llmGetModels: async () => {
    return [
      { name: 'tinyllama-1.1b', size: '670 MB', contextLength: 2048, downloaded: true, path: '/mock/tinyllama' },
      { name: 'phi-2', size: '1.6 GB', contextLength: 2048, downloaded: false, path: '/mock/phi-2' },
    ]
  },

  llmSetModel: async (_modelName: string) => {
    console.log('[Mock] LLM set model:', _modelName)
    return true
  },

  llmUnload: async () => {
    console.log('[Mock] LLM unload')
    return true
  },

  llmDownloadModel: async (_modelName: string) => {
    console.log('[Mock] LLM download model:', _modelName)
    return { success: true }
  },

  llmCancelDownload: async () => {
    console.log('[Mock] LLM cancel download')
    return true
  },

  onLLMDownloadProgress: (_callback) => {
    // Mock: no-op, return unsubscribe function
    return () => {}
  },

  onLLMChunk: (_callback) => {
    // Mock: no-op, return unsubscribe function
    return () => {}
  },

  // ==========================================
  // Logging operations (browser mock)
  // ==========================================
  
  logsGet: async () => {
    return '[Browser Mock] Logs not available in browser mode'
  },

  logsGetAll: async () => {
    return '[Browser Mock] Logs not available in browser mode'
  },

  logsClear: async () => {
    console.log('[Mock] Clear logs')
    return true
  },

  logsGetPath: async () => {
    return '/mock/path/logs'
  },

  logsWrite: async (level: string, message: string, data?: unknown) => {
    console.log(`[Mock Log ${level}] ${message}`, data)
    return true
  },
}

// Initialize browser mock if not in Electron
export function initBrowserMock() {
  if (typeof window !== 'undefined' && !window.electronAPI) {
    console.log('Running in browser mode - using mock API')
    ;(window as any).electronAPI = browserMockAPI
  }
}
