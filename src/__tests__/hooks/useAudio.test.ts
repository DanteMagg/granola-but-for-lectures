import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAudio } from '../../renderer/hooks/useAudio'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import { createMockSession, createMockSlide } from '../helpers/mockData'

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

describe('useAudio', () => {
  const mockSetRecording = vi.fn()
  const mockAddTranscriptSegment = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    mockUseSessionStore.mockReturnValue({
      session: createMockSession({
        slides: [createMockSlide({ id: 'slide-1' })],
        isRecording: false,
        currentSlideIndex: 0,
      }),
      setRecording: mockSetRecording,
      addTranscriptSegment: mockAddTranscriptSegment,
    } as any)

    // Mock window.electronAPI
    window.electronAPI = {
      ...window.electronAPI,
      whisperGetInfo: vi.fn().mockResolvedValue({
        loaded: true,
        exists: true,
        modelPath: '/path/to/model',
        modelName: 'base.en',
        language: 'en',
        availableModels: [
          { name: 'tiny', size: '75 MB', downloaded: false },
          { name: 'base', size: '142 MB', downloaded: true },
        ],
      }),
      whisperInit: vi.fn().mockResolvedValue(true),
      whisperTranscribe: vi.fn().mockResolvedValue({
        text: 'Transcribed text',
        segments: [
          { text: 'Transcribed text', start: 0, end: 1000, confidence: 0.95 },
        ],
      }),
      whisperDownloadModel: vi.fn().mockResolvedValue({ success: true }),
      whisperCancelDownload: vi.fn().mockResolvedValue(true),
      whisperSetModel: vi.fn().mockResolvedValue(true),
      onWhisperDownloadProgress: vi.fn().mockReturnValue(() => {}),
      saveAudio: vi.fn().mockResolvedValue('/path/to/audio'),
    } as any
  })

  describe('initialization', () => {
    it('should fetch whisper info on mount', async () => {
      const { result } = renderHook(() => useAudio())
      
      await waitFor(() => {
        expect(window.electronAPI.whisperGetInfo).toHaveBeenCalled()
        expect(result.current.whisperInfo).toBeTruthy()
      })
    })

    it('should have correct initial state', async () => {
      const { result } = renderHook(() => useAudio())
      
      expect(result.current.isRecording).toBe(false)
      expect(result.current.isPaused).toBe(false)
      expect(result.current.duration).toBe(0)
      expect(result.current.audioLevel).toBe(0)
      expect(result.current.error).toBeNull()
    })
  })

  describe('whisper management', () => {
    it('should initialize whisper', async () => {
      const { result } = renderHook(() => useAudio())
      
      let success: boolean = false
      await act(async () => {
        success = await result.current.initWhisper()
      })
      
      expect(window.electronAPI.whisperInit).toHaveBeenCalled()
      expect(success).toBe(true)
    })

    it('should download whisper model', async () => {
      const { result } = renderHook(() => useAudio())
      
      let downloadResult: { success: boolean; error?: string } = { success: false }
      await act(async () => {
        downloadResult = await result.current.downloadWhisperModel('small')
      })
      
      expect(window.electronAPI.whisperDownloadModel).toHaveBeenCalledWith('small')
      expect(downloadResult.success).toBe(true)
    })

    it('should cancel whisper download', async () => {
      const { result } = renderHook(() => useAudio())
      
      await act(async () => {
        await result.current.cancelWhisperDownload()
      })
      
      expect(window.electronAPI.whisperCancelDownload).toHaveBeenCalled()
    })

    it('should set whisper model', async () => {
      const { result } = renderHook(() => useAudio())
      
      let success: boolean = false
      await act(async () => {
        success = await result.current.setWhisperModel('medium')
      })
      
      expect(window.electronAPI.whisperSetModel).toHaveBeenCalledWith('medium')
      expect(success).toBe(true)
    })

    it('should refresh whisper info', async () => {
      const { result } = renderHook(() => useAudio())
      
      await act(async () => {
        await result.current.refreshWhisperInfo()
      })
      
      expect(window.electronAPI.whisperGetInfo).toHaveBeenCalled()
    })
  })

  describe('whisper info state', () => {
    it('should populate whisper info from API', async () => {
      const { result } = renderHook(() => useAudio())
      
      await waitFor(() => {
        expect(result.current.whisperInfo).toEqual({
          loaded: true,
          exists: true,
          modelPath: '/path/to/model',
          modelName: 'base.en',
          language: 'en',
          availableModels: [
            { name: 'tiny', size: '75 MB', downloaded: false },
            { name: 'base', size: '142 MB', downloaded: true },
          ],
        })
      })
    })
  })

  describe('error handling', () => {
    it('should handle whisper init failure', async () => {
      window.electronAPI.whisperInit = vi.fn().mockRejectedValue(new Error('Init failed'))

      const { result } = renderHook(() => useAudio())
      
      let success: boolean = true
      await act(async () => {
        success = await result.current.initWhisper()
      })
      
      expect(success).toBe(false)
    })

    it('should handle download failure', async () => {
      window.electronAPI.whisperDownloadModel = vi.fn().mockRejectedValue(new Error('Download failed'))

      const { result } = renderHook(() => useAudio())
      
      let downloadResult: { success: boolean; error?: string }
      await act(async () => {
        downloadResult = await result.current.downloadWhisperModel('small')
      })
      
      expect(downloadResult!.success).toBe(false)
      expect(downloadResult!.error).toBe('Download failed')
    })
  })

  describe('recording state from session', () => {
    it('should reflect session recording state', async () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          slides: [createMockSlide()],
          isRecording: true,
        }),
        setRecording: mockSetRecording,
        addTranscriptSegment: mockAddTranscriptSegment,
      } as any)

      const { result } = renderHook(() => useAudio())
      
      expect(result.current.isRecording).toBe(true)
    })
  })
})

