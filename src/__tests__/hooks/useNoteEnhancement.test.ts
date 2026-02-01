import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNoteEnhancement } from '../../renderer/hooks/useNoteEnhancement'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import { createMockSession, createMockSlide, createMockNote } from '../helpers/mockData'
import type { TranscriptSegment } from '@shared/types'

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}))

// Store mock data that will be returned by both hook and getState
let mockStoreData: any = null

// Mock the store - need to mock both the hook and getState()
vi.mock('../../renderer/stores/sessionStore', () => ({
  useSessionStore: Object.assign(
    vi.fn(() => mockStoreData),
    {
      getState: vi.fn(() => mockStoreData),
    }
  ),
}))

const mockUseSessionStore = vi.mocked(useSessionStore)

describe('useNoteEnhancement', () => {
  const mockSetEnhancedNote = vi.fn()
  const mockUpdateEnhancedNoteStatus = vi.fn()
  const mockSetSessionPhase = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    const slides = [
      createMockSlide({ id: 'slide-1', index: 0, extractedText: 'Slide 1 content' }),
      createMockSlide({ id: 'slide-2', index: 1, extractedText: 'Slide 2 content' }),
    ]

    const transcripts: Record<string, TranscriptSegment[]> = {
      'slide-1': [
        { id: 't1', slideId: 'slide-1', text: 'Transcript for slide 1', startTime: 0, endTime: 1000, confidence: 0.9 },
      ],
    }

    // Set up mock data that will be returned by both hook and getState()
    mockStoreData = {
      session: createMockSession({
        slides,
        notes: {
          'slide-1': createMockNote({ slideId: 'slide-1', plainText: 'User notes 1' }),
          'slide-2': createMockNote({ slideId: 'slide-2', plainText: 'User notes 2' }),
        },
        transcripts,
      }),
      setEnhancedNote: mockSetEnhancedNote,
      updateEnhancedNoteStatus: mockUpdateEnhancedNoteStatus,
      setSessionPhase: mockSetSessionPhase,
    }

    // Update the mock to return our data
    mockUseSessionStore.mockReturnValue(mockStoreData)
    ;(useSessionStore as any).getState = vi.fn(() => mockStoreData)

    // Mock window.electronAPI
    window.electronAPI = {
      ...window.electronAPI,
      llmGetInfo: vi.fn().mockResolvedValue({
        loaded: true,
        exists: true,
        modelName: 'tinyllama-1.1b',
      }),
      llmGenerate: vi.fn().mockResolvedValue({
        text: 'Enhanced note content from AI',
        tokensUsed: 100,
        finishReason: 'stop',
      }),
    } as any
  })

  describe('checkLLMStatus', () => {
    it('should return true when LLM is loaded', async () => {
      const { result } = renderHook(() => useNoteEnhancement())
      
      let status: boolean = false
      await act(async () => {
        status = await result.current.checkLLMStatus()
      })
      
      expect(status).toBe(true)
      expect(result.current.isLLMAvailable).toBe(true)
    })

    it('should return false when LLM is not loaded', async () => {
      window.electronAPI.llmGetInfo = vi.fn().mockResolvedValue({
        loaded: false,
        exists: false,
      })

      const { result } = renderHook(() => useNoteEnhancement())
      
      let status: boolean = true
      await act(async () => {
        status = await result.current.checkLLMStatus()
      })
      
      expect(status).toBe(false)
      expect(result.current.isLLMAvailable).toBe(false)
    })
  })

  describe('enhanceSlide', () => {
    it('should enhance a single slide', async () => {
      const { result } = renderHook(() => useNoteEnhancement())
      
      await act(async () => {
        await result.current.enhanceSlide('slide-1')
      })
      
      expect(window.electronAPI.llmGenerate).toHaveBeenCalled()
      
      // Should create the initial pending note and then update with completed
      expect(mockSetEnhancedNote).toHaveBeenCalledTimes(2)
      
      // Second call should have completed note
      const lastCall = mockSetEnhancedNote.mock.calls[1]
      expect(lastCall[0]).toBe('slide-1')
      expect(lastCall[1].status).toBe('complete')
      expect(lastCall[1].content).toBe('Enhanced note content from AI')
    })

    it('should not enhance if LLM is not available', async () => {
      window.electronAPI.llmGetInfo = vi.fn().mockResolvedValue({
        loaded: false,
        exists: false,
      })

      const { result } = renderHook(() => useNoteEnhancement())
      
      await act(async () => {
        await result.current.enhanceSlide('slide-1')
      })
      
      expect(window.electronAPI.llmGenerate).not.toHaveBeenCalled()
    })

    it('should handle errors during enhancement', async () => {
      window.electronAPI.llmGenerate = vi.fn().mockRejectedValue(new Error('LLM error'))

      const { result } = renderHook(() => useNoteEnhancement())
      
      await act(async () => {
        await result.current.enhanceSlide('slide-1')
      })
      
      expect(mockUpdateEnhancedNoteStatus).toHaveBeenCalledWith('slide-1', 'error', 'LLM error')
    })
  })

  describe('enhanceAllSlides', () => {
    it('should enhance all slides with content', async () => {
      const { result } = renderHook(() => useNoteEnhancement())
      
      await act(async () => {
        await result.current.enhanceAllSlides()
      })
      
      // Should have called LLM for each slide with content (2 slides have notes)
      expect(window.electronAPI.llmGenerate).toHaveBeenCalledTimes(2)
      
      // Should set session phase
      expect(mockSetSessionPhase).toHaveBeenCalledWith('enhancing')
      expect(mockSetSessionPhase).toHaveBeenCalledWith('enhanced')
    })

    it('should track progress', async () => {
      const { result } = renderHook(() => useNoteEnhancement())
      
      expect(result.current.progress.status).toBe('idle')
      
      await act(async () => {
        await result.current.enhanceAllSlides()
      })
      
      expect(result.current.progress.status).toBe('complete')
      expect(result.current.progress.currentSlide).toBe(2)
      expect(result.current.progress.totalSlides).toBe(2)
    })

    it('should not start if LLM is not available', async () => {
      window.electronAPI.llmGetInfo = vi.fn().mockResolvedValue({
        loaded: false,
        exists: false,
      })

      const { result } = renderHook(() => useNoteEnhancement())
      
      await act(async () => {
        await result.current.enhanceAllSlides()
      })
      
      expect(result.current.progress.status).toBe('error')
      expect(result.current.progress.error).toContain('LLM not available')
    })
  })

  describe('cancelEnhancement', () => {
    it('should cancel ongoing enhancement', async () => {
      const { result } = renderHook(() => useNoteEnhancement())
      
      act(() => {
        result.current.cancelEnhancement()
      })
      
      expect(result.current.progress.status).toBe('idle')
    })
  })

  describe('initial state', () => {
    it('should have correct initial progress state', () => {
      const { result } = renderHook(() => useNoteEnhancement())
      
      expect(result.current.progress).toEqual({
        currentSlide: 0,
        totalSlides: 0,
        status: 'idle',
      })
    })

    it('should have correct initial LLM availability state', () => {
      const { result } = renderHook(() => useNoteEnhancement())
      
      expect(result.current.isLLMAvailable).toBe(false) // Before checkLLMStatus is called
    })
  })
})

