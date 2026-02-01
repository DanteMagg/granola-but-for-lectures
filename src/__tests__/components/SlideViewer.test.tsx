import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlideViewer } from '../../renderer/components/SlideViewer'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import type { Slide } from '@shared/types'
import { createMockUIState, createMockSession } from '../helpers/mockData'

// Reset store helper
const resetStore = () => {
  useSessionStore.setState({
    session: null,
    sessionList: [],
    ui: createMockUIState(),
    isLoading: false,
    isSaving: false,
    error: null,
  })
}

// Mock slides for testing
const createMockSlides = (count: number): Slide[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `slide-${i}`,
    index: i,
    imageData: `base64-image-data-${i}`,
    width: 1920,
    height: 1080,
    extractedText: `Slide ${i + 1} content`,
  }))

// Helper to set up session with slides
const setupSessionWithSlides = (slideCount: number, currentIndex = 0) => {
  const slides = createMockSlides(slideCount)
  useSessionStore.setState({
    session: createMockSession({
      slides,
      currentSlideIndex: currentIndex,
    }),
  })
  return slides
}

describe('SlideViewer', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render nothing when no session exists', () => {
      const { container } = render(<SlideViewer />)
      expect(container.firstChild).toBeNull()
    })

    it('should render nothing when session has no slides', () => {
      useSessionStore.setState({
        session: createMockSession({ slides: [] }),
      })
      
      const { container } = render(<SlideViewer />)
      expect(container.firstChild).toBeNull()
    })

    it('should render slide viewer with slides', () => {
      setupSessionWithSlides(5)
      
      render(<SlideViewer />)
      
      // Should show current slide image (alt text includes extracted text)
      const slideImage = screen.getByAltText(/Slide 1 of 5/)
      expect(slideImage).toBeInTheDocument()
      expect(slideImage).toHaveAttribute('src', 'data:image/png;base64,base64-image-data-0')
    })

    it('should display correct slide counter', () => {
      setupSessionWithSlides(10, 4) // 10 slides, current is 5th (index 4)
      
      render(<SlideViewer />)
      
      // Should show slide counter (format: "5 / 10")
      expect(screen.getByText('5 / 10')).toBeInTheDocument()
    })
  })

  describe('navigation buttons', () => {
    it('should disable prev button on first slide', () => {
      setupSessionWithSlides(5, 0)
      
      render(<SlideViewer />)
      
      // Find prev buttons (there are 2: overlay and bottom bar)
      const prevButtons = screen.getAllByTitle(/Previous slide/i)
      prevButtons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })

    it('should disable next button on last slide', () => {
      setupSessionWithSlides(5, 4) // Last slide
      
      render(<SlideViewer />)
      
      const nextButtons = screen.getAllByTitle(/Next slide/i)
      nextButtons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })

    it('should enable both buttons on middle slides', () => {
      setupSessionWithSlides(5, 2) // Middle slide
      
      render(<SlideViewer />)
      
      const prevButtons = screen.getAllByTitle(/Previous slide/i)
      const nextButtons = screen.getAllByTitle(/Next slide/i)
      
      prevButtons.forEach(button => {
        expect(button).not.toBeDisabled()
      })
      nextButtons.forEach(button => {
        expect(button).not.toBeDisabled()
      })
    })
  })

  describe('navigation actions', () => {
    it('should call nextSlide when next button clicked', () => {
      setupSessionWithSlides(5, 0)
      
      const nextSlideSpy = vi.fn()
      useSessionStore.setState({ nextSlide: nextSlideSpy })
      
      render(<SlideViewer />)
      
      // Click the next button (by title)
      const nextButtons = screen.getAllByTitle(/Next slide/i)
      fireEvent.click(nextButtons[0])
      
      expect(nextSlideSpy).toHaveBeenCalled()
    })

    it('should call prevSlide when prev button clicked', () => {
      setupSessionWithSlides(5, 2)
      
      const prevSlideSpy = vi.fn()
      useSessionStore.setState({ prevSlide: prevSlideSpy })
      
      render(<SlideViewer />)
      
      // Click the prev button (by title)
      const prevButtons = screen.getAllByTitle(/Previous slide/i)
      fireEvent.click(prevButtons[0])
      
      expect(prevSlideSpy).toHaveBeenCalled()
    })
  })

  describe('slide display', () => {
    it('should update displayed slide when index changes', () => {
      setupSessionWithSlides(5, 0)
      
      const { rerender } = render(<SlideViewer />)
      
      // Initially showing slide 1 (alt text includes "of X" and extracted text)
      expect(screen.getByAltText(/Slide 1 of 5/)).toHaveAttribute(
        'src',
        'data:image/png;base64,base64-image-data-0'
      )
      
      // Update to slide 3
      useSessionStore.setState(state => ({
        session: state.session ? {
          ...state.session,
          currentSlideIndex: 2,
        } : null,
      }))
      
      rerender(<SlideViewer />)
      
      expect(screen.getByAltText(/Slide 3 of 5/)).toHaveAttribute(
        'src',
        'data:image/png;base64,base64-image-data-2'
      )
    })
  })

  describe('keyboard hints', () => {
    it('should have navigation buttons with keyboard hints in title', () => {
      setupSessionWithSlides(5)
      
      render(<SlideViewer />)
      
      // Navigation buttons have keyboard hints in their titles
      expect(screen.getByTitle('Previous slide (←)')).toBeInTheDocument()
      expect(screen.getByTitle('Next slide (→)')).toBeInTheDocument()
    })
  })

  describe('fullscreen toggle', () => {
    it('should have fullscreen button', () => {
      setupSessionWithSlides(5)
      
      render(<SlideViewer />)
      
      const fullscreenButton = screen.getByTitle('Toggle fullscreen')
      expect(fullscreenButton).toBeInTheDocument()
    })
  })
})
