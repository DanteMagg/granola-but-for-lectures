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
      
      // Should show current slide image
      const slideImage = screen.getByAltText('Slide 1')
      expect(slideImage).toBeInTheDocument()
      expect(slideImage).toHaveAttribute('src', 'data:image/png;base64,base64-image-data-0')
    })

    it('should display correct slide counter', () => {
      setupSessionWithSlides(10, 4) // 10 slides, current is 5th (index 4)
      
      render(<SlideViewer />)
      
      // Input should show current slide number (1-indexed)
      const input = screen.getByRole('spinbutton')
      expect(input).toHaveValue(5)
      
      // Should show total
      expect(screen.getByText('/ 10')).toBeInTheDocument()
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
      
      // Click the bottom bar next button (use getAllBy and get second one which is in control bar)
      const nextButtons = screen.getAllByRole('button', { name: /Next/i })
      // The second button is in the controls bar (has text "Next")
      const controlBarNextButton = nextButtons.find(btn => btn.textContent?.includes('Next'))
      fireEvent.click(controlBarNextButton!)
      
      expect(nextSlideSpy).toHaveBeenCalled()
    })

    it('should call prevSlide when prev button clicked', () => {
      setupSessionWithSlides(5, 2)
      
      const prevSlideSpy = vi.fn()
      useSessionStore.setState({ prevSlide: prevSlideSpy })
      
      render(<SlideViewer />)
      
      // Click the bottom bar prev button
      const prevButtons = screen.getAllByRole('button', { name: /Prev/i })
      const controlBarPrevButton = prevButtons.find(btn => btn.textContent?.includes('Prev'))
      fireEvent.click(controlBarPrevButton!)
      
      expect(prevSlideSpy).toHaveBeenCalled()
    })

    it('should navigate via input field', () => {
      setupSessionWithSlides(5, 0)
      
      const setCurrentSlideSpy = vi.fn()
      useSessionStore.setState({ setCurrentSlide: setCurrentSlideSpy })
      
      render(<SlideViewer />)
      
      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '3' } })
      
      // Should convert to 0-indexed
      expect(setCurrentSlideSpy).toHaveBeenCalledWith(2)
    })
  })

  describe('slide display', () => {
    it('should update displayed slide when index changes', () => {
      setupSessionWithSlides(5, 0)
      
      const { rerender } = render(<SlideViewer />)
      
      // Initially showing slide 1
      expect(screen.getByAltText('Slide 1')).toHaveAttribute(
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
      
      expect(screen.getByAltText('Slide 3')).toHaveAttribute(
        'src',
        'data:image/png;base64,base64-image-data-2'
      )
    })
  })

  describe('keyboard hints', () => {
    it('should show keyboard navigation hints', () => {
      setupSessionWithSlides(5)
      
      render(<SlideViewer />)
      
      expect(screen.getByText('←')).toBeInTheDocument()
      expect(screen.getByText('→')).toBeInTheDocument()
      expect(screen.getByText('to navigate')).toBeInTheDocument()
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
