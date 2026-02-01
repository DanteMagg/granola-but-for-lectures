import { memo, useCallback, useMemo } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { clsx } from 'clsx'
import { FileText, MessageSquare } from 'lucide-react'
import type { Slide } from '@shared/types'

// Memoized thumbnail component for performance
interface SlideThumbProps {
  slide: Slide
  index: number
  isActive: boolean
  hasNote: boolean
  hasTranscript: boolean
  onSelect: (index: number) => void
}

const SlideThumb = memo(function SlideThumb({
  slide,
  index,
  isActive,
  hasNote,
  hasTranscript,
  onSelect,
}: SlideThumbProps) {
  const handleClick = useCallback(() => {
    onSelect(index)
  }, [index, onSelect])

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'slide-thumb w-full group',
        isActive && 'active'
      )}
      aria-label={`Slide ${index + 1}${hasNote ? ', has notes' : ''}${hasTranscript ? ', has transcript' : ''}`}
      aria-current={isActive ? 'true' : undefined}
      role="tab"
      tabIndex={isActive ? 0 : -1}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-zinc-100 rounded-sm overflow-hidden relative">
        <img
          src={`data:image/png;base64,${slide.imageData}`}
          alt={`Slide ${index + 1}`}
          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          loading="lazy"
        />
        
        {/* Number Badge */}
        <div className={clsx(
          "absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium backdrop-blur-sm",
          isActive ? "bg-zinc-900/90 text-white" : "bg-black/50 text-white"
        )}>
          {index + 1}
        </div>
      </div>

      {/* Indicators */}
      {(hasNote || hasTranscript) && (
        <div className="mt-1.5 flex items-center gap-2 px-1">
          {hasNote && (
            <div className="flex items-center gap-1 text-[10px] text-zinc-500" aria-label="Has notes">
              <FileText className="w-3 h-3" aria-hidden="true" />
            </div>
          )}
          {hasTranscript && (
            <div className="flex items-center gap-1 text-[10px] text-zinc-500" aria-label="Has transcript">
              <MessageSquare className="w-3 h-3" aria-hidden="true" />
            </div>
          )}
        </div>
      )}
    </button>
  )
})

export function SlideThumbList() {
  const { session, setCurrentSlide } = useSessionStore()

  // Memoize the slide data to prevent unnecessary re-renders
  const slideData = useMemo(() => {
    if (!session) return []
    return session.slides.map((slide, index) => ({
      slide,
      index,
      isActive: index === session.currentSlideIndex,
      hasNote: Boolean(session.notes[slide.id]?.plainText?.trim()),
      hasTranscript: (session.transcripts[slide.id]?.length || 0) > 0,
    }))
  }, [session?.slides, session?.currentSlideIndex, session?.notes, session?.transcripts])

  const handleSelect = useCallback((index: number) => {
    setCurrentSlide(index)
  }, [setCurrentSlide])

  if (!session || session.slides.length === 0) {
    return null
  }

  return (
    <nav
      className="w-44 flex-shrink-0 panel flex flex-col overflow-hidden bg-white"
      role="tablist"
      aria-label="Slide navigation"
    >
      <div className="panel-header">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Slides
        </span>
        <span className="text-xs text-muted-foreground font-mono" aria-label={`${session.slides.length} total slides`}>
          {session.slides.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3" role="presentation">
        {slideData.map(({ slide, index, isActive, hasNote, hasTranscript }) => (
          <SlideThumb
            key={slide.id}
            slide={slide}
            index={index}
            isActive={isActive}
            hasNote={hasNote}
            hasTranscript={hasTranscript}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </nav>
  )
}
