import { useSessionStore } from '../stores/sessionStore'
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { useState } from 'react'

export function SlideViewer() {
  const { session, nextSlide, prevSlide } = useSessionStore()
  const [isFullscreen, setIsFullscreen] = useState(false)

  if (!session || session.slides.length === 0) {
    return null
  }

  const currentSlide = session.slides[session.currentSlideIndex]
  const totalSlides = session.slides.length
  const currentIndex = session.currentSlideIndex + 1

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  return (
    <div 
      className="flex-1 flex flex-col overflow-hidden bg-zinc-100/50 rounded-lg group"
      role="region"
      aria-label="Slide viewer"
    >
      {/* Slide display - takes maximum space */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden p-2">
        {currentSlide && (
          <img
            key={currentSlide.id}
            src={`data:image/png;base64,${currentSlide.imageData}`}
            alt={`Slide ${currentIndex} of ${totalSlides}${currentSlide.extractedText ? `: ${currentSlide.extractedText.slice(0, 100)}...` : ''}`}
            className="max-w-full max-h-full object-contain shadow-xl rounded-lg animate-fade-in transition-transform duration-300"
          />
        )}

        {/* Fullscreen button - show on hover */}
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 rounded-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-105"
          title="Toggle fullscreen"
        >
          <Maximize2 className="w-4 h-4 text-white" aria-hidden="true" />
        </button>

        {/* Navigation overlays - minimal, show on hover */}
        <button
          onClick={prevSlide}
          disabled={session.currentSlideIndex === 0}
          aria-label={`Previous slide (currently on slide ${currentIndex} of ${totalSlides})`}
          className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full backdrop-blur-sm transition-all duration-300 disabled:opacity-0 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100 hover:scale-110"
          title="Previous slide (←)"
        >
          <ChevronLeft className="w-5 h-5 text-white" aria-hidden="true" />
        </button>

        <button
          onClick={nextSlide}
          disabled={session.currentSlideIndex === totalSlides - 1}
          aria-label={`Next slide (currently on slide ${currentIndex} of ${totalSlides})`}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full backdrop-blur-sm transition-all duration-300 disabled:opacity-0 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100 hover:scale-110"
          title="Next slide (→)"
        >
          <ChevronRight className="w-5 h-5 text-white" aria-hidden="true" />
        </button>

        {/* Slide counter - bottom center, subtle */}
        <nav 
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0"
          aria-label="Slide navigation"
        >
          <button
            onClick={prevSlide}
            disabled={session.currentSlideIndex === 0}
            aria-label="Previous slide"
            className="p-0.5 hover:bg-white/20 rounded-full transition-colors disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4 text-white" aria-hidden="true" />
          </button>
          <span 
            className="text-sm text-white font-medium tabular-nums min-w-[4rem] text-center"
            aria-live="polite"
            aria-atomic="true"
          >
            {currentIndex} / {totalSlides}
          </span>
          <button
            onClick={nextSlide}
            disabled={session.currentSlideIndex === totalSlides - 1}
            aria-label="Next slide"
            className="p-0.5 hover:bg-white/20 rounded-full transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-white" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </div>
  )
}
