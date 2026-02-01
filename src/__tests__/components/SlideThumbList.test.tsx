import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlideThumbList } from '../../renderer/components/SlideThumbList'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import { createMockSession, createMockSlide, createMockNote } from '../helpers/mockData'
import type { TranscriptSegment } from '@shared/types'

// Mock the store
vi.mock('../../renderer/stores/sessionStore')

const mockUseSessionStore = vi.mocked(useSessionStore)

describe('SlideThumbList', () => {
  const mockSetCurrentSlide = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should not render when there is no session', () => {
      mockUseSessionStore.mockReturnValue({
        session: null,
        setCurrentSlide: mockSetCurrentSlide,
      } as any)

      const { container } = render(<SlideThumbList />)
      expect(container.firstChild).toBeNull()
    })

    it('should not render when session has no slides', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ slides: [] }),
        setCurrentSlide: mockSetCurrentSlide,
      } as any)

      const { container } = render(<SlideThumbList />)
      expect(container.firstChild).toBeNull()
    })

    it('should render slide count in header', () => {
      const slides = [
        createMockSlide({ id: 'slide-1', index: 0 }),
        createMockSlide({ id: 'slide-2', index: 1 }),
        createMockSlide({ id: 'slide-3', index: 2 }),
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ slides }),
        setCurrentSlide: mockSetCurrentSlide,
      } as any)

      render(<SlideThumbList />)
      
      expect(screen.getByText('Slides')).toBeInTheDocument()
      // The count is in a span with specific styling in the header
      const header = screen.getByText('Slides').closest('.panel-header')!
      expect(header).toHaveTextContent('3')
    })

    it('should render all slide thumbnails', () => {
      const slides = [
        createMockSlide({ id: 'slide-1', index: 0 }),
        createMockSlide({ id: 'slide-2', index: 1 }),
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ slides }),
        setCurrentSlide: mockSetCurrentSlide,
      } as any)

      render(<SlideThumbList />)
      
      expect(screen.getByRole('tab', { name: /Slide 1/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /Slide 2/i })).toBeInTheDocument()
    })
  })

  describe('active slide', () => {
    it('should mark current slide as active', () => {
      const slides = [
        createMockSlide({ id: 'slide-1', index: 0 }),
        createMockSlide({ id: 'slide-2', index: 1 }),
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ slides, currentSlideIndex: 1 }),
        setCurrentSlide: mockSetCurrentSlide,
      } as any)

      render(<SlideThumbList />)
      
      const slide1 = screen.getByRole('tab', { name: /Slide 1/i })
      const slide2 = screen.getByRole('tab', { name: /Slide 2/i })
      
      expect(slide1).not.toHaveAttribute('aria-current')
      expect(slide2).toHaveAttribute('aria-current', 'true')
    })

    it('should have proper tabIndex for keyboard navigation', () => {
      const slides = [
        createMockSlide({ id: 'slide-1', index: 0 }),
        createMockSlide({ id: 'slide-2', index: 1 }),
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ slides, currentSlideIndex: 0 }),
        setCurrentSlide: mockSetCurrentSlide,
      } as any)

      render(<SlideThumbList />)
      
      const slide1 = screen.getByRole('tab', { name: /Slide 1/i })
      const slide2 = screen.getByRole('tab', { name: /Slide 2/i })
      
      expect(slide1).toHaveAttribute('tabIndex', '0')
      expect(slide2).toHaveAttribute('tabIndex', '-1')
    })
  })

  describe('indicators', () => {
    it('should show note indicator for slides with notes', () => {
      const slides = [
        createMockSlide({ id: 'slide-1', index: 0 }),
        createMockSlide({ id: 'slide-2', index: 1 }),
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          slides,
          notes: {
            'slide-1': createMockNote({ slideId: 'slide-1', plainText: 'Some notes' }),
          },
        }),
        setCurrentSlide: mockSetCurrentSlide,
      } as any)

      render(<SlideThumbList />)
      
      const slide1 = screen.getByRole('tab', { name: /Slide 1, has notes/i })
      expect(slide1).toBeInTheDocument()
    })

    it('should show transcript indicator for slides with transcripts', () => {
      const slides = [
        createMockSlide({ id: 'slide-1', index: 0 }),
        createMockSlide({ id: 'slide-2', index: 1 }),
      ]

      const segments: TranscriptSegment[] = [
        { id: 'seg-1', slideId: 'slide-2', text: 'Hello', startTime: 0, endTime: 1000, confidence: 0.9 },
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          slides,
          transcripts: {
            'slide-2': segments,
          },
        }),
        setCurrentSlide: mockSetCurrentSlide,
      } as any)

      render(<SlideThumbList />)
      
      const slide2 = screen.getByRole('tab', { name: /Slide 2, has transcript/i })
      expect(slide2).toBeInTheDocument()
    })

    it('should show both indicators when slide has notes and transcript', () => {
      const slides = [
        createMockSlide({ id: 'slide-1', index: 0 }),
      ]

      const segments: TranscriptSegment[] = [
        { id: 'seg-1', slideId: 'slide-1', text: 'Hello', startTime: 0, endTime: 1000, confidence: 0.9 },
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          slides,
          notes: {
            'slide-1': createMockNote({ slideId: 'slide-1', plainText: 'Notes' }),
          },
          transcripts: {
            'slide-1': segments,
          },
        }),
        setCurrentSlide: mockSetCurrentSlide,
      } as any)

      render(<SlideThumbList />)
      
      const slide1 = screen.getByRole('tab', { name: /Slide 1, has notes, has transcript/i })
      expect(slide1).toBeInTheDocument()
    })

    it('should not show note indicator for empty notes', () => {
      const slides = [
        createMockSlide({ id: 'slide-1', index: 0 }),
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({
          slides,
          notes: {
            'slide-1': createMockNote({ slideId: 'slide-1', plainText: '   ' }), // whitespace only
          },
        }),
        setCurrentSlide: mockSetCurrentSlide,
      } as any)

      render(<SlideThumbList />)
      
      // Should not include "has notes" in aria-label
      const slide1 = screen.getByRole('tab', { name: 'Slide 1' })
      expect(slide1).toBeInTheDocument()
    })
  })

  describe('click behavior', () => {
    it('should call setCurrentSlide when thumbnail is clicked', () => {
      const slides = [
        createMockSlide({ id: 'slide-1', index: 0 }),
        createMockSlide({ id: 'slide-2', index: 1 }),
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ slides }),
        setCurrentSlide: mockSetCurrentSlide,
      } as any)

      render(<SlideThumbList />)
      
      const slide2 = screen.getByRole('tab', { name: /Slide 2/i })
      fireEvent.click(slide2)
      
      expect(mockSetCurrentSlide).toHaveBeenCalledWith(1)
    })
  })

  describe('accessibility', () => {
    it('should have proper navigation role', () => {
      const slides = [
        createMockSlide({ id: 'slide-1', index: 0 }),
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ slides }),
        setCurrentSlide: mockSetCurrentSlide,
      } as any)

      render(<SlideThumbList />)
      
      const nav = screen.getByRole('tablist')
      expect(nav).toHaveAttribute('aria-label', 'Slide navigation')
    })

    it('should have proper aria-labels for slides', () => {
      const slides = [
        createMockSlide({ id: 'slide-1', index: 0 }),
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ slides }),
        setCurrentSlide: mockSetCurrentSlide,
      } as any)

      render(<SlideThumbList />)
      
      const slide = screen.getByRole('tab', { name: 'Slide 1' })
      expect(slide).toBeInTheDocument()
    })

    it('should have proper alt text for slide images', () => {
      const slides = [
        createMockSlide({ id: 'slide-1', index: 0 }),
      ]

      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ slides }),
        setCurrentSlide: mockSetCurrentSlide,
      } as any)

      render(<SlideThumbList />)
      
      const img = screen.getByAltText('Slide 1')
      expect(img).toBeInTheDocument()
    })
  })
})

