import { useSessionStore } from '../stores/sessionStore'
import { clsx } from 'clsx'
import { FileText, MessageSquare } from 'lucide-react'

export function SlideThumbList() {
  const { session, setCurrentSlide } = useSessionStore()

  if (!session || session.slides.length === 0) {
    return null
  }

  return (
    <div className="w-44 flex-shrink-0 panel flex flex-col overflow-hidden bg-white">
      <div className="panel-header">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Slides
        </span>
        <span className="text-xs text-muted-foreground font-mono">
          {session.slides.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {session.slides.map((slide, index) => {
          const isActive = index === session.currentSlideIndex
          const hasNote = session.notes[slide.id]?.plainText?.trim()
          const hasTranscript = session.transcripts[slide.id]?.length > 0

          return (
            <button
              key={slide.id}
              onClick={() => setCurrentSlide(index)}
              className={clsx(
                'slide-thumb w-full group',
                isActive && 'active'
              )}
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-zinc-100 rounded-sm overflow-hidden relative">
                <img
                  src={`data:image/png;base64,${slide.imageData}`}
                  alt={`Slide ${index + 1}`}
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
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
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <FileText className="w-3 h-3" />
                    </div>
                  )}
                  {hasTranscript && (
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                      <MessageSquare className="w-3 h-3" />
                    </div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
