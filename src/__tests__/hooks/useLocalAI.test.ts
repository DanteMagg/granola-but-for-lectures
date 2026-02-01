import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLocalAI } from '../../renderer/hooks/useLocalAI'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import { createMockSession, createMockSlide, createMockNote } from '../helpers/mockData'

// Mock the store
vi.mock('../../renderer/stores/sessionStore')
vi.mock('../../renderer/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

const mockUseSessionStore = vi.mocked(useSessionStore)

describe('useLocalAI', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock session
    mockUseSessionStore.mockReturnValue({
      session: createMockSession({
        slides: [createMockSlide({ id: 'slide-1', extractedText: 'Slide content' })],
        notes: { 'slide-1': createMockNote({ slideId: 'slide-1', plainText: 'User notes' }) },
        transcripts: { 'slide-1': [{ id: 't1', slideId: 'slide-1', text: 'Transcript text', startTime: 0, endTime: 1000, confidence: 0.9 }] },
      }),
    } as any)

    // Mock window.electronAPI
    window.electronAPI = {
      ...window.electronAPI,
      llmGetInfo: vi.fn().mockResolvedValue({
        loaded: true,
        exists: true,
        modelPath: '/path/to/model',
        modelName: 'tinyllama-1.1b',
        contextLength: 2048,
        availableModels: [
          { name: 'tinyllama-1.1b', size: '670 MB', contextLength: 2048, downloaded: true },
        ],
      }),
      llmInit: vi.fn().mockResolvedValue(true),
      llmGenerate: vi.fn().mockResolvedValue({
        text: 'AI response',
        tokensUsed: 50,
        finishReason: 'stop',
      }),
      llmGenerateStream: vi.fn().mockResolvedValue({
        text: 'Streaming AI response',
        tokensUsed: 60,
        finishReason: 'stop',
      }),
      llmDownloadModel: vi.fn().mockResolvedValue({ success: true }),
      llmCancelDownload: vi.fn().mockResolvedValue(true),
      llmSetModel: vi.fn().mockResolvedValue(true),
      onLLMDownloadProgress: vi.fn().mockReturnValue(() => {}),
      onLLMChunk: vi.fn().mockReturnValue(() => {}),
    } as any
  })

  describe('initialization', () => {
    it('should fetch model info on mount', async () => {
      const { result } = renderHook(() => useLocalAI())
      
      await waitFor(() => {
        expect(window.electronAPI.llmGetInfo).toHaveBeenCalled()
      })
      
      expect(result.current.modelInfo).toBeTruthy()
    })

    it('should indicate when model is loaded', async () => {
      const { result } = renderHook(() => useLocalAI())
      
      await waitFor(() => {
        expect(result.current.isModelLoaded).toBe(true)
      })
    })

    it('should indicate when model is not loaded', async () => {
      window.electronAPI.llmGetInfo = vi.fn().mockResolvedValue({
        loaded: false,
        exists: false,
        modelName: '',
      })

      const { result } = renderHook(() => useLocalAI())
      
      await waitFor(() => {
        expect(result.current.isModelLoaded).toBe(false)
      })
    })
  })

  describe('sendMessage', () => {
    it('should send message to LLM', async () => {
      const { result } = renderHook(() => useLocalAI())
      
      let response: string = ''
      await act(async () => {
        response = await result.current.sendMessage('Test question')
      })
      
      expect(window.electronAPI.llmGenerate).toHaveBeenCalled()
      expect(response).toBe('AI response')
    })

    it('should set loading state while processing', async () => {
      const { result } = renderHook(() => useLocalAI())
      
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('sendMessageStream', () => {
    it('should send streaming message to LLM', async () => {
      const { result } = renderHook(() => useLocalAI())
      
      let response: string = ''
      await act(async () => {
        response = await result.current.sendMessageStream('Test question')
      })
      
      expect(window.electronAPI.llmGenerateStream).toHaveBeenCalled()
      expect(response).toBe('Streaming AI response')
    })

    it('should call onChunk callback setup', async () => {
      const onChunk = vi.fn()
      
      const { result } = renderHook(() => useLocalAI())
      
      await act(async () => {
        await result.current.sendMessageStream('Test', undefined, onChunk)
      })
      
      expect(window.electronAPI.onLLMChunk).toHaveBeenCalled()
    })
  })

  describe('model management', () => {
    it('should initialize model', async () => {
      const { result } = renderHook(() => useLocalAI())
      
      let success: boolean = false
      await act(async () => {
        success = await result.current.initModel()
      })
      
      expect(window.electronAPI.llmInit).toHaveBeenCalled()
      expect(success).toBe(true)
    })

    it('should download model', async () => {
      const { result } = renderHook(() => useLocalAI())
      
      let downloadResult: { success: boolean; error?: string } = { success: false }
      await act(async () => {
        downloadResult = await result.current.downloadModel('phi-2')
      })
      
      expect(window.electronAPI.llmDownloadModel).toHaveBeenCalledWith('phi-2')
      expect(downloadResult.success).toBe(true)
    })

    it('should cancel download', async () => {
      const { result } = renderHook(() => useLocalAI())
      
      await act(async () => {
        await result.current.cancelDownload()
      })
      
      expect(window.electronAPI.llmCancelDownload).toHaveBeenCalled()
    })

    it('should set model', async () => {
      const { result } = renderHook(() => useLocalAI())
      
      let success: boolean = false
      await act(async () => {
        success = await result.current.setModel('phi-2')
      })
      
      expect(window.electronAPI.llmSetModel).toHaveBeenCalledWith('phi-2')
      expect(success).toBe(true)
    })
  })

  describe('initial state', () => {
    it('should have correct initial isLoading state', () => {
      const { result } = renderHook(() => useLocalAI())
      expect(result.current.isLoading).toBe(false)
    })

    it('should have correct initial error state', () => {
      const { result } = renderHook(() => useLocalAI())
      expect(result.current.error).toBeNull()
    })

    it('should have correct initial downloadProgress state', () => {
      const { result } = renderHook(() => useLocalAI())
      expect(result.current.downloadProgress).toBeNull()
    })
  })
})
