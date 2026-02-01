/**
 * Slide Store
 * Handles slide navigation and slide-specific state
 */
import { create } from 'zustand'
import type { Slide } from '@shared/types'

interface SlideStore {
  // Slides data (reference to session slides)
  slides: Slide[]
  currentSlideIndex: number
  
  // Actions
  setSlides: (slides: Slide[]) => void
  setCurrentSlide: (index: number) => void
  nextSlide: () => void
  prevSlide: () => void
  updateSlide: (slideId: string, updates: Partial<Slide>) => void
  getCurrentSlide: () => Slide | null
  
  // Recording-aware slide tracking
  markSlideViewed: (index: number, timestamp: number) => void
  markSlideLeft: (index: number, timestamp: number) => void
  
  // Reset
  reset: () => void
}

export const useSlideStore = create<SlideStore>((set, get) => ({
  slides: [],
  currentSlideIndex: 0,

  setSlides: (slides: Slide[]) => {
    set({ slides, currentSlideIndex: 0 })
  },

  setCurrentSlide: (index: number) => {
    const { slides } = get()
    const maxIndex = slides.length - 1
    const validIndex = Math.max(0, Math.min(index, maxIndex))
    set({ currentSlideIndex: validIndex })
  },

  nextSlide: () => {
    const { slides, currentSlideIndex, setCurrentSlide } = get()
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlide(currentSlideIndex + 1)
    }
  },

  prevSlide: () => {
    const { currentSlideIndex, setCurrentSlide } = get()
    if (currentSlideIndex > 0) {
      setCurrentSlide(currentSlideIndex - 1)
    }
  },

  updateSlide: (slideId: string, updates: Partial<Slide>) => {
    set(state => ({
      slides: state.slides.map(slide =>
        slide.id === slideId ? { ...slide, ...updates } : slide
      ),
    }))
  },

  getCurrentSlide: () => {
    const { slides, currentSlideIndex } = get()
    return slides[currentSlideIndex] || null
  },

  markSlideViewed: (index: number, timestamp: number) => {
    set(state => ({
      slides: state.slides.map((slide, i) =>
        i === index && !slide.viewedAt
          ? { ...slide, viewedAt: timestamp }
          : slide
      ),
    }))
  },

  markSlideLeft: (index: number, timestamp: number) => {
    set(state => ({
      slides: state.slides.map((slide, i) =>
        i === index && !slide.viewedUntil
          ? { ...slide, viewedUntil: timestamp }
          : slide
      ),
    }))
  },

  reset: () => {
    set({ slides: [], currentSlideIndex: 0 })
  },
}))

