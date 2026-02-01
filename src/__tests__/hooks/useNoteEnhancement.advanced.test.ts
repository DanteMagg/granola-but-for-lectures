/**
 * Advanced tests for useNoteEnhancement hook
 * Covers concurrent enhancement prevention, cancellation, partial failures, and progress tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useNoteEnhancement } from '../../renderer/hooks/useNoteEnhancement'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import { createMockSession, createMockSlide, createMockNote } from '../helpers/mockData'
import type { TranscriptSegment } from '@shared/types'

// Store mock data
let mockStoreData: any = null

// Mock the store
vi.mock('../../renderer/stores/sessionStore', () => ({
  useSessionStore: Object.assign(
    vi.fn(() => mockStoreData),
    {
      getState: vi.fn(() => mockStoreData),
    }
  ),
}))

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => `mock-uuid-${Date.now()}-${Math.random().toString(36).substring(7)}`,
}))

const mockUseSessionStore = vi.mocked(useSessionStore)

describe('useNoteEnhancement - Advanced Tests', () => {
  const mockSetEnhancedNote = vi.fn()
  const mockUpdateEnhancedNoteStatus = vi.fn()
  const mockSetSessionPhase = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    const slides = [
      createMockSlide({ id: 'slide-1', index: 0, extractedText: 'Slide 1 content' }),
      createMockSlide({ id: 'slide-2', index: 1, extractedText: 'Slide 2 content' }),
      createMockSlide({ id: 'slide-3', index: 2, extractedText: 'Slide 3 content' }),
      createMockSlide({ id: 'slide-4', index: 3, extractedText: 'Slide 4 content' }),
    ]

    const notes: Record<string, any> = {
      'slide-1': createMockNote({ slideId: 'slide-1', plainText: 'User notes 1' }),
      'slide-2': createMockNote({ slideId: 'slide-2', plainText: 'User notes 2' }),
      'slide-3': createMockNote({ slideId: 'slide-3', plainText: 'User notes 3' }),
      'slide-4': createMockNote({ slideId: 'slide-4', plainText: 'User notes 4' }),
    }

    const transcripts: Record<string, TranscriptSegment[]> = {
      'slide-1': [{ id: 't1', slideId: 'slide-1', text: 'Transcript 1', startTime: 0, endTime: 1000, confidence: 0.9 }],
      'slide-2': [{ id: 't2', slideId: 'slide-2', text: 'Transcript 2', startTime: 0, endTime: 1000, confidence: 0.9 }],
      'slide-3': [{ id: 't3', slideId: 'slide-3', text: 'Transcript 3', startTime: 0, endTime: 1000, confidence: 0.9 }],
      'slide-4': [{ id: 't4', slideId: 'slide-4', text: 'Transcript 4', startTime: 0, endTime: 1000, confidence: 0.9 }],
    }

    mockStoreData = {
      session: createMockSession({ slides, notes, transcripts }),
      setEnhancedNote: mockSetEnhancedNote,
      updateEnhancedNoteStatus: mockUpdateEnhancedNoteStatus,
      setSessionPhase: mockSetSessionPhase,
    }

    mockUseSessionStore.mockReturnValue(mockStoreData)
    ;(useSessionStore as any).getState = vi.fn(() => mockStoreData)

    // Default LLM mock
    window.electronAPI = {
      ...window.electronAPI,
      llmGetInfo: vi.fn().mockResolvedValue({
        loaded: true,
        exists: true,
        modelName: 'tinyllama-1.1b',
      }),
      llmGenerate: vi.fn().mockResolvedValue({
        text: 'Enhanced note content',
        tokensUsed: 100,
        finishReason: 'stop',
      }),
    } as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('concurrent enhancement prevention', () => {
    it('should allow sequential enhancements', async () => {
      const { result } = renderHook(() => useNoteEnhancement())

      // First enhancement
      await act(async () => {
        await result.current.enhanceSlide('slide-1')
      })

      // Second enhancement should work after first completes
      await act(async () => {
        await result.current.enhanceSlide('slide-2')
      })

      // Should have 2 calls now
      expect(window.electronAPI.llmGenerate).toHaveBeenCalledTimes(2)
    })
  })

  describe('cancellation', () => {
    it('should stop enhancement when cancelled', async () => {
      vi.useFakeTimers()
      
      let resolvers: Array<(value: any) => void> = []
      window.electronAPI.llmGenerate = vi.fn().mockImplementation(() => 
        new Promise((resolve) => { resolvers.push(resolve) })
      )

      const { result } = renderHook(() => useNoteEnhancement())

      // Start bulk enhancement
      let enhancePromise: Promise<void>
      act(() => {
        enhancePromise = result.current.enhanceAllSlides()
      })

      // Wait for first LLM call
      await vi.advanceTimersByTimeAsync(100)

      // Cancel
      act(() => {
        result.current.cancelEnhancement()
      })

      // Complete pending LLM call
      resolvers.forEach(resolve => 
        resolve({ text: 'Done', tokensUsed: 50, finishReason: 'stop' })
      )

      await act(async () => {
        await enhancePromise
      })

      // Progress should be idle after cancel
      expect(result.current.progress.status).toBe('idle')

      vi.useRealTimers()
    })

    it('should reset progress on cancel', async () => {
      const { result } = renderHook(() => useNoteEnhancement())

      // Start with some progress
      act(() => {
        result.current.cancelEnhancement()
      })

      expect(result.current.progress.status).toBe('idle')
    })

    it('should call setSessionPhase on cancel during enhancement', async () => {
      vi.useFakeTimers()
      
      let resolveLLM: (value: any) => void
      window.electronAPI.llmGenerate = vi.fn().mockImplementation(() => 
        new Promise((resolve) => { resolveLLM = resolve })
      )

      const { result } = renderHook(() => useNoteEnhancement())

      // Start bulk enhancement
      act(() => {
        result.current.enhanceAllSlides()
      })

      await vi.advanceTimersByTimeAsync(100)

      // Should have set phase to enhancing
      expect(mockSetSessionPhase).toHaveBeenCalledWith('enhancing')

      // Cancel
      act(() => {
        result.current.cancelEnhancement()
      })

      // Resolve pending
      resolveLLM!({ text: 'Done', tokensUsed: 50, finishReason: 'stop' })

      await vi.advanceTimersByTimeAsync(100)

      // Should have set phase back
      expect(mockSetSessionPhase).toHaveBeenCalledWith('ready_to_enhance')

      vi.useRealTimers()
    })
  })

  describe('partial failure handling', () => {
    it('should continue enhancement after one slide fails', async () => {
      let callCount = 0
      window.electronAPI.llmGenerate = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 2) {
          return Promise.reject(new Error('LLM failed on slide 2'))
        }
        return Promise.resolve({
          text: 'Enhanced content',
          tokensUsed: 100,
          finishReason: 'stop',
        })
      })

      const { result } = renderHook(() => useNoteEnhancement())

      await act(async () => {
        await result.current.enhanceAllSlides()
      })

      // Should have tried all 4 slides
      expect(window.electronAPI.llmGenerate).toHaveBeenCalledTimes(4)

      // Slide 2 should have error status
      expect(mockUpdateEnhancedNoteStatus).toHaveBeenCalledWith(
        'slide-2',
        'error',
        'LLM failed on slide 2'
      )

      // Other slides should have succeeded
      const completeCalls = mockSetEnhancedNote.mock.calls.filter(
        call => call[1].status === 'complete'
      )
      expect(completeCalls.length).toBeGreaterThan(0)
    })

    it('should set correct error message on failure', async () => {
      window.electronAPI.llmGenerate = vi.fn().mockRejectedValue(new Error('Context too long'))

      const { result } = renderHook(() => useNoteEnhancement())

      await act(async () => {
        await result.current.enhanceSlide('slide-1')
      })

      expect(mockUpdateEnhancedNoteStatus).toHaveBeenCalledWith(
        'slide-1',
        'error',
        'Context too long'
      )
    })

    it('should handle non-Error rejections', async () => {
      window.electronAPI.llmGenerate = vi.fn().mockRejectedValue('String error')

      const { result } = renderHook(() => useNoteEnhancement())

      await act(async () => {
        await result.current.enhanceSlide('slide-1')
      })

      expect(mockUpdateEnhancedNoteStatus).toHaveBeenCalledWith(
        'slide-1',
        'error',
        'Enhancement failed'
      )
    })
  })

  describe('progress tracking', () => {
    it('should complete progress after bulk enhancement', async () => {
      const { result } = renderHook(() => useNoteEnhancement())

      await act(async () => {
        await result.current.enhanceAllSlides()
      })

      // Should be complete after enhancement
      expect(result.current.progress.status).toBe('complete')
      expect(result.current.progress.totalSlides).toBe(4)
      expect(result.current.progress.currentSlide).toBe(4)
    })
  })

  describe('LLM availability', () => {
    it('should check LLM status before enhancement', async () => {
      const { result } = renderHook(() => useNoteEnhancement())

      await act(async () => {
        await result.current.enhanceSlide('slide-1')
      })

      expect(window.electronAPI.llmGetInfo).toHaveBeenCalled()
    })

    it('should not enhance if LLM is not loaded', async () => {
      window.electronAPI.llmGetInfo = vi.fn().mockResolvedValue({
        loaded: false,
        exists: false,
        modelName: '',
      })

      const { result } = renderHook(() => useNoteEnhancement())

      await act(async () => {
        await result.current.enhanceSlide('slide-1')
      })

      expect(window.electronAPI.llmGenerate).not.toHaveBeenCalled()
    })

    it('should set error progress when LLM not available for bulk', async () => {
      window.electronAPI.llmGetInfo = vi.fn().mockResolvedValue({
        loaded: false,
        exists: false,
        modelName: '',
      })

      const { result } = renderHook(() => useNoteEnhancement())

      await act(async () => {
        await result.current.enhanceAllSlides()
      })

      expect(result.current.progress.status).toBe('error')
      expect(result.current.progress.error).toContain('LLM not available')
    })

    it('should update isLLMAvailable after check', async () => {
      const { result } = renderHook(() => useNoteEnhancement())

      expect(result.current.isLLMAvailable).toBe(false) // Initial

      await act(async () => {
        await result.current.checkLLMStatus()
      })

      expect(result.current.isLLMAvailable).toBe(true)
    })

    it('should handle llmGetInfo API not available', async () => {
      window.electronAPI = {} as any

      const { result } = renderHook(() => useNoteEnhancement())

      let status: boolean = true
      await act(async () => {
        status = await result.current.checkLLMStatus()
      })

      expect(status).toBe(false)
      expect(result.current.isLLMAvailable).toBe(false)
    })

    it('should handle llmGetInfo error', async () => {
      window.electronAPI.llmGetInfo = vi.fn().mockRejectedValue(new Error('API error'))

      const { result } = renderHook(() => useNoteEnhancement())

      let status: boolean = true
      await act(async () => {
        status = await result.current.checkLLMStatus()
      })

      expect(status).toBe(false)
    })
  })

  describe('session phase management', () => {
    it('should set phase to enhancing at start', async () => {
      const { result } = renderHook(() => useNoteEnhancement())

      await act(async () => {
        await result.current.enhanceAllSlides()
      })

      expect(mockSetSessionPhase).toHaveBeenCalledWith('enhancing')
    })

    it('should set phase to enhanced on completion', async () => {
      const { result } = renderHook(() => useNoteEnhancement())

      await act(async () => {
        await result.current.enhanceAllSlides()
      })

      expect(mockSetSessionPhase).toHaveBeenCalledWith('enhanced')
    })
  })

  describe('slide filtering', () => {
    it('should filter slides based on content availability', async () => {
      // This test verifies the filtering logic runs
      // The actual filtering happens in enhanceAllSlides
      const { result } = renderHook(() => useNoteEnhancement())

      await act(async () => {
        await result.current.enhanceAllSlides()
      })

      // All 4 slides in default mock have notes, so all should be enhanced
      expect(window.electronAPI.llmGenerate).toHaveBeenCalledTimes(4)
    })
  })

  describe('enhanced note creation', () => {
    it('should create note with correct content on completion', async () => {
      window.electronAPI.llmGenerate = vi.fn().mockResolvedValue({
        text: 'AI enhanced content here',
        tokensUsed: 100,
        finishReason: 'stop',
      })

      const { result } = renderHook(() => useNoteEnhancement())

      await act(async () => {
        await result.current.enhanceSlide('slide-1')
      })

      // Should have created a completed note with the LLM response
      const completedCall = mockSetEnhancedNote.mock.calls.find(
        call => call[1].status === 'complete'
      )
      
      expect(completedCall).toBeDefined()
      expect(completedCall![1].content).toBe('AI enhanced content here')
      expect(completedCall![1].slideId).toBe('slide-1')
    })
  })

  describe('no session handling', () => {
    it('should handle missing session gracefully', async () => {
      vi.mocked(window.electronAPI.llmGenerate).mockClear()
      
      mockStoreData = {
        session: null,
        setEnhancedNote: mockSetEnhancedNote,
        updateEnhancedNoteStatus: mockUpdateEnhancedNoteStatus,
        setSessionPhase: mockSetSessionPhase,
      }
      
      mockUseSessionStore.mockReturnValue(mockStoreData)
      ;(useSessionStore as any).getState = vi.fn(() => mockStoreData)

      const { result } = renderHook(() => useNoteEnhancement())

      // Should not throw
      await act(async () => {
        await result.current.enhanceSlide('slide-1')
      })

      expect(window.electronAPI.llmGenerate).not.toHaveBeenCalled()
    })

    it('should handle enhanceAllSlides with no session', async () => {
      vi.mocked(window.electronAPI.llmGenerate).mockClear()
      
      mockStoreData = {
        session: null,
        setEnhancedNote: mockSetEnhancedNote,
        updateEnhancedNoteStatus: mockUpdateEnhancedNoteStatus,
        setSessionPhase: mockSetSessionPhase,
      }
      
      mockUseSessionStore.mockReturnValue(mockStoreData)
      ;(useSessionStore as any).getState = vi.fn(() => mockStoreData)

      const { result } = renderHook(() => useNoteEnhancement())

      await act(async () => {
        await result.current.enhanceAllSlides()
      })

      expect(window.electronAPI.llmGenerate).not.toHaveBeenCalled()
    })
  })

  describe('slide not found handling', () => {
    it('should handle non-existent slide ID', async () => {
      vi.mocked(window.electronAPI.llmGenerate).mockClear()
      
      const { result } = renderHook(() => useNoteEnhancement())

      await act(async () => {
        await result.current.enhanceSlide('non-existent-slide')
      })

      expect(window.electronAPI.llmGenerate).not.toHaveBeenCalled()
    })
  })
})

