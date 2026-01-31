import { useSessionStore } from '../stores/sessionStore'
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { useState } from 'react'

export function SlideViewer() {
  const { session, setCurrentSlide, nextSlide, prevSlide } = useSessionStore()
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
    <div className="flex-1 flex flex-col panel overflow-hidden bg-zinc-50/50">
      {/* Slide display */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden p-4">
        {currentSlide && (
          <img
            src={`data:image/png;base64,${currentSlide.imageData}`}
            alt={`Slide ${currentIndex}`}
            className="max-w-full max-h-full object-contain shadow-lg rounded-md"
          />
        )}

        {/* Fullscreen button */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-white rounded-md shadow-sm border border-border transition-colors backdrop-blur-sm opacity-0 group-hover:opacity-100"
          title="Toggle fullscreen"
        >
          <Maximize2 className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Navigation overlays */}
        <button
          onClick={prevSlide}
          disabled={session.currentSlideIndex === 0}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white rounded-full shadow-md border border-border transition-all disabled:opacity-0 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          title="Previous slide (←)"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>

        <button
          onClick={nextSlide}
          disabled={session.currentSlideIndex === totalSlides - 1}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/90 hover:bg-white rounded-full shadow-md border border-border transition-all disabled:opacity-0 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
          title="Next slide (→)"
        >
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Controls bar */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between bg-white">
        <div className="flex items-center gap-2">
          <button
            onClick={prevSlide}
            disabled={session.currentSlideIndex === 0}
            className="btn btn-ghost btn-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>
          <button
            onClick={nextSlide}
            disabled={session.currentSlideIndex === totalSlides - 1}
            className="btn btn-ghost btn-sm"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Slide counter */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={totalSlides}
            value={currentIndex}
            onChange={(e) => setCurrentSlide(parseInt(e.target.value) - 1)}
            className="w-12 text-center text-sm bg-zinc-50 border border-input rounded-md px-2 py-1 focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all"
          />
          <span className="text-sm text-muted-foreground">/ {totalSlides}</span>
        </div>

        {/* Keyboard hints */}
        <div className="text-[10px] text-muted-foreground hidden md:flex items-center gap-2">
          <kbd className="kbd">←</kbd>
          <kbd className="kbd">→</kbd>
          <span>to navigate</span>
        </div>
      </div>
    </div>
  )
}
