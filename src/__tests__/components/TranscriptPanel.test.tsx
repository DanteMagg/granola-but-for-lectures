import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TranscriptPanel } from '../../renderer/components/TranscriptPanel'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import { createMockSession, createMockSlide } from '../helpers/mockData'
import type { TranscriptSegment } from '@shared/types'

// Mock the store
vi.mock('../../renderer/stores/sessionStore')

const mockUseSessionStore = vi.mocked(useSessionStore)

describe('TranscriptPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should not render when there is no session', () => {
      mockUseSessionStore.mockReturnValue({
        session: null,
        ui: { transcriptPanelHeight: 200 },
      } as any)

      const { container } = render(<TranscriptPanel />)
      expect(container.firstChild).toBeNull()
    })

    it('should not render when session has no slides', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ slides: [] }),
        ui: { transcriptPanelHeight: 200 },
      } as any)

      const { container } = render(<TranscriptPanel />)
      expect(container.firstChild).toBeNull()
    })

    it('should render transcript header with segment count', () => {
      const slide = createMockSlide({ id: 'slide-1' })
      const segments: TranscriptSegment[] = [
        { id: 'seg-1', slideId: 'slide-1', text: 'Hello world', startTime: 0, endTime: 1000, confidence: 0.95 },
        { id: 'seg-2', slideId: 'slide-1', text: 'This is a test', startTime: 1000, endTime: 2000, confidence: 0.9 },
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          slides: [slide],
          transcripts: { 'slide-1': segments },
          currentSlideIndex: 0,
        }),
        ui: { transcriptPanelHeight: 200 },
      } as any)

      render(<TranscriptPanel />)
      
      expect(screen.getByText('Transcript')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // segment count badge
    })

    it('should show recording indicator when recording', () => {
      const slide = createMockSlide({ id: 'slide-1' })
      
      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          slides: [slide],
          transcripts: {},
          currentSlideIndex: 0,
          isRecording: true,
        }),
        ui: { transcriptPanelHeight: 200 },
      } as any)

      render(<TranscriptPanel />)
      
      expect(screen.getByText('Live')).toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('should show empty state when no transcripts exist', () => {
      const slide = createMockSlide({ id: 'slide-1' })
      
      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          slides: [slide],
          transcripts: {},
          currentSlideIndex: 0,
          isRecording: false,
        }),
        ui: { transcriptPanelHeight: 200 },
      } as any)

      render(<TranscriptPanel />)
      
      expect(screen.getByText('No transcript yet')).toBeInTheDocument()
    })

    it('should show listening message when recording but no transcript yet', () => {
      const slide = createMockSlide({ id: 'slide-1' })
      
      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          slides: [slide],
          transcripts: {},
          currentSlideIndex: 0,
          isRecording: true,
        }),
        ui: { transcriptPanelHeight: 200 },
      } as any)

      render(<TranscriptPanel />)
      
      expect(screen.getByText('Listening...')).toBeInTheDocument()
    })
  })

  describe('transcript segments', () => {
    it('should display transcript segments with timestamps', () => {
      const slide = createMockSlide({ id: 'slide-1' })
      const segments: TranscriptSegment[] = [
        { id: 'seg-1', slideId: 'slide-1', text: 'Hello world', startTime: 0, endTime: 1000, confidence: 0.95 },
        { id: 'seg-2', slideId: 'slide-1', text: 'This is a test', startTime: 65000, endTime: 70000, confidence: 0.9 },
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          slides: [slide],
          transcripts: { 'slide-1': segments },
          currentSlideIndex: 0,
        }),
        ui: { transcriptPanelHeight: 200 },
      } as any)

      render(<TranscriptPanel />)
      
      expect(screen.getByText('Hello world')).toBeInTheDocument()
      expect(screen.getByText('This is a test')).toBeInTheDocument()
      expect(screen.getByText('0:00')).toBeInTheDocument() // First timestamp
      expect(screen.getByText('1:05')).toBeInTheDocument() // Second timestamp (65 seconds)
    })

    it('should show low confidence styling for low confidence segments', () => {
      const slide = createMockSlide({ id: 'slide-1' })
      const segments: TranscriptSegment[] = [
        { id: 'seg-1', slideId: 'slide-1', text: 'Unclear audio', startTime: 0, endTime: 1000, confidence: 0.6 },
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          slides: [slide],
          transcripts: { 'slide-1': segments },
          currentSlideIndex: 0,
        }),
        ui: { transcriptPanelHeight: 200 },
      } as any)

      render(<TranscriptPanel />)
      
      const segmentText = screen.getByText('Unclear audio')
      expect(segmentText).toBeInTheDocument()
      // Low confidence segments have italic styling
      expect(segmentText).toHaveClass('italic')
    })
  })

  describe('collapse/expand', () => {
    it('should toggle expand/collapse when header is clicked', () => {
      const slide = createMockSlide({ id: 'slide-1' })
      
      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          slides: [slide],
          transcripts: {},
          currentSlideIndex: 0,
        }),
        ui: { transcriptPanelHeight: 200 },
      } as any)

      render(<TranscriptPanel />)
      
      // Initially expanded, so empty state message should be visible
      expect(screen.getByText('No transcript yet')).toBeInTheDocument()
      
      // Click the header button to collapse (the whole header is now a button)
      const headerButton = screen.getByText('Transcript').closest('button')!
      fireEvent.click(headerButton)
      
      // Content should have hidden classes
      // Get the wrapper div (p -> div.text-center -> div.overflow-y-auto)
      const contentText = screen.getByText('No transcript yet')
      const wrapper = contentText.parentElement?.parentElement
      expect(wrapper).toHaveClass('opacity-0')
      expect(wrapper).toHaveClass('invisible')
      
      // Click header again to expand
      fireEvent.click(headerButton)
      
      // Content should be visible again
      expect(wrapper).toHaveClass('opacity-100')
      expect(wrapper).not.toHaveClass('invisible')
    })
  })

  describe('time formatting', () => {
    it('should format timestamps correctly', () => {
      const slide = createMockSlide({ id: 'slide-1' })
      const segments: TranscriptSegment[] = [
        { id: 'seg-1', slideId: 'slide-1', text: 'Test 1', startTime: 0, endTime: 1000, confidence: 0.95 },
        { id: 'seg-2', slideId: 'slide-1', text: 'Test 2', startTime: 59000, endTime: 60000, confidence: 0.95 },
        { id: 'seg-3', slideId: 'slide-1', text: 'Test 3', startTime: 3661000, endTime: 3700000, confidence: 0.95 }, // 61 minutes, 1 second
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          slides: [slide],
          transcripts: { 'slide-1': segments },
          currentSlideIndex: 0,
        }),
        ui: { transcriptPanelHeight: 200 },
      } as any)

      render(<TranscriptPanel />)
      
      expect(screen.getByText('0:00')).toBeInTheDocument()
      expect(screen.getByText('0:59')).toBeInTheDocument()
      expect(screen.getByText('61:01')).toBeInTheDocument()
    })
  })
})

