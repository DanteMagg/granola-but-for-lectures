import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EnhanceNotesButton } from '../../renderer/components/EnhanceNotesButton'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import { useNoteEnhancement } from '../../renderer/hooks/useNoteEnhancement'
import { createMockSession, createMockSlide, createMockNote } from '../helpers/mockData'
import type { TranscriptSegment, EnhancedNote } from '@shared/types'

// Mock the stores and hooks
vi.mock('../../renderer/stores/sessionStore')
vi.mock('../../renderer/hooks/useNoteEnhancement')

const mockUseSessionStore = vi.mocked(useSessionStore)
const mockUseNoteEnhancement = vi.mocked(useNoteEnhancement)

describe('EnhanceNotesButton', () => {
  const mockEnhanceAllSlides = vi.fn()
  const mockCancelEnhancement = vi.fn()
  const mockCheckLLMStatus = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockCheckLLMStatus.mockResolvedValue(true)
    
    mockUseNoteEnhancement.mockReturnValue({
      enhanceSlide: vi.fn(),
      enhanceAllSlides: mockEnhanceAllSlides,
      cancelEnhancement: mockCancelEnhancement,
      progress: { currentSlide: 0, totalSlides: 0, status: 'idle' },
      isLLMAvailable: true,
      checkLLMStatus: mockCheckLLMStatus,
    })
  })

  describe('visibility', () => {
    it('should not render when no session', () => {
      mockUseSessionStore.mockReturnValue({
        session: null,
      } as any)

      const { container } = render(<EnhanceNotesButton />)
      expect(container.firstChild).toBeNull()
    })

    it('should not render when recording', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ isRecording: true }),
      } as any)

      const { container } = render(<EnhanceNotesButton />)
      expect(container.firstChild).toBeNull()
    })

    it('should not render when phase is idle', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ phase: 'idle', isRecording: false }),
      } as any)

      const { container } = render(<EnhanceNotesButton />)
      expect(container.firstChild).toBeNull()
    })

    it('should render when phase is ready_to_enhance', () => {
      const slides = [createMockSlide({ id: 'slide-1' })]
      const segments: TranscriptSegment[] = [
        { id: 'seg-1', slideId: 'slide-1', text: 'Test', startTime: 0, endTime: 1000, confidence: 0.9 },
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          phase: 'ready_to_enhance',
          isRecording: false,
          slides,
          transcripts: { 'slide-1': segments },
        }),
      } as any)

      render(<EnhanceNotesButton />)
      expect(screen.getByText('Enhance Your Notes')).toBeInTheDocument()
    })
  })

  describe('full variant', () => {
    it('should show enhancement CTA with slide count', () => {
      const slides = [
        createMockSlide({ id: 'slide-1' }),
        createMockSlide({ id: 'slide-2' }),
      ]
      const segments: TranscriptSegment[] = [
        { id: 'seg-1', slideId: 'slide-1', text: 'Test', startTime: 0, endTime: 1000, confidence: 0.9 },
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          phase: 'ready_to_enhance',
          isRecording: false,
          slides,
          transcripts: { 'slide-1': segments },
          notes: { 'slide-2': createMockNote({ slideId: 'slide-2' }) },
        }),
      } as any)

      render(<EnhanceNotesButton />)
      
      expect(screen.getByText('Enhance Your Notes')).toBeInTheDocument()
      expect(screen.getByText(/2 slides with content to enhance/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Enhance All Notes/i })).toBeInTheDocument()
    })

    it('should call enhanceAllSlides when button clicked', async () => {
      const slides = [createMockSlide({ id: 'slide-1' })]
      const segments: TranscriptSegment[] = [
        { id: 'seg-1', slideId: 'slide-1', text: 'Test', startTime: 0, endTime: 1000, confidence: 0.9 },
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          phase: 'ready_to_enhance',
          isRecording: false,
          slides,
          transcripts: { 'slide-1': segments },
        }),
      } as any)

      render(<EnhanceNotesButton />)
      
      const button = screen.getByRole('button', { name: /Enhance All Notes/i })
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(mockEnhanceAllSlides).toHaveBeenCalled()
      })
    })
  })

  describe('enhancing state', () => {
    it('should show progress during enhancement', () => {
      mockUseNoteEnhancement.mockReturnValue({
        enhanceSlide: vi.fn(),
        enhanceAllSlides: mockEnhanceAllSlides,
        cancelEnhancement: mockCancelEnhancement,
        progress: { currentSlide: 3, totalSlides: 10, status: 'enhancing' },
        isLLMAvailable: true,
        checkLLMStatus: mockCheckLLMStatus,
      })

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          phase: 'enhancing',
          isRecording: false,
          slides: [createMockSlide()],
        }),
      } as any)

      render(<EnhanceNotesButton />)
      
      expect(screen.getByText('Enhancing Notes...')).toBeInTheDocument()
      expect(screen.getByText('Processing slide 3 of 10')).toBeInTheDocument()
    })

    it('should show cancel button during enhancement', () => {
      mockUseNoteEnhancement.mockReturnValue({
        enhanceSlide: vi.fn(),
        enhanceAllSlides: mockEnhanceAllSlides,
        cancelEnhancement: mockCancelEnhancement,
        progress: { currentSlide: 3, totalSlides: 10, status: 'enhancing' },
        isLLMAvailable: true,
        checkLLMStatus: mockCheckLLMStatus,
      })

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          phase: 'enhancing',
          isRecording: false,
          slides: [createMockSlide()],
        }),
      } as any)

      render(<EnhanceNotesButton />)
      
      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)
      
      expect(mockCancelEnhancement).toHaveBeenCalled()
    })
  })

  describe('enhanced state', () => {
    it('should show success message when enhancement complete', () => {
      const enhancedNote: EnhancedNote = {
        id: 'en-1',
        slideId: 'slide-1',
        content: 'Enhanced content',
        plainText: 'Enhanced content',
        enhancedAt: new Date().toISOString(),
        status: 'complete',
      }

      mockUseNoteEnhancement.mockReturnValue({
        enhanceSlide: vi.fn(),
        enhanceAllSlides: mockEnhanceAllSlides,
        cancelEnhancement: mockCancelEnhancement,
        progress: { currentSlide: 1, totalSlides: 1, status: 'complete' },
        isLLMAvailable: true,
        checkLLMStatus: mockCheckLLMStatus,
      })

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          phase: 'enhanced',
          isRecording: false,
          slides: [createMockSlide({ id: 'slide-1' })],
          enhancedNotes: { 'slide-1': enhancedNote },
        }),
      } as any)

      render(<EnhanceNotesButton />)
      
      expect(screen.getByText('Notes Enhanced!')).toBeInTheDocument()
      expect(screen.getByText(/1 slide enhanced with AI/)).toBeInTheDocument()
    })
  })

  describe('compact variant', () => {
    it('should render compact button', () => {
      const slides = [createMockSlide({ id: 'slide-1' })]
      const segments: TranscriptSegment[] = [
        { id: 'seg-1', slideId: 'slide-1', text: 'Test', startTime: 0, endTime: 1000, confidence: 0.9 },
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          phase: 'ready_to_enhance',
          isRecording: false,
          slides,
          transcripts: { 'slide-1': segments },
        }),
      } as any)

      render(<EnhanceNotesButton variant="compact" />)
      
      expect(screen.getByRole('button', { name: /Enhance/i })).toBeInTheDocument()
    })

    it('should show progress in compact mode', () => {
      mockUseNoteEnhancement.mockReturnValue({
        enhanceSlide: vi.fn(),
        enhanceAllSlides: mockEnhanceAllSlides,
        cancelEnhancement: mockCancelEnhancement,
        progress: { currentSlide: 3, totalSlides: 10, status: 'enhancing' },
        isLLMAvailable: true,
        checkLLMStatus: mockCheckLLMStatus,
      })

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          phase: 'enhancing',
          isRecording: false,
          slides: [createMockSlide()],
        }),
      } as any)

      render(<EnhanceNotesButton variant="compact" />)
      
      expect(screen.getByText('3/10')).toBeInTheDocument()
    })

    it('should show enhanced status in compact mode', () => {
      const enhancedNote: EnhancedNote = {
        id: 'en-1',
        slideId: 'slide-1',
        content: 'Enhanced',
        plainText: 'Enhanced',
        enhancedAt: new Date().toISOString(),
        status: 'complete',
      }

      mockUseNoteEnhancement.mockReturnValue({
        enhanceSlide: vi.fn(),
        enhanceAllSlides: mockEnhanceAllSlides,
        cancelEnhancement: mockCancelEnhancement,
        progress: { currentSlide: 1, totalSlides: 1, status: 'complete' },
        isLLMAvailable: true,
        checkLLMStatus: mockCheckLLMStatus,
      })

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          phase: 'enhanced',
          isRecording: false,
          slides: [createMockSlide({ id: 'slide-1' })],
          enhancedNotes: { 'slide-1': enhancedNote },
        }),
      } as any)

      render(<EnhanceNotesButton variant="compact" />)
      
      expect(screen.getByText('Enhanced')).toBeInTheDocument()
    })
  })
})
