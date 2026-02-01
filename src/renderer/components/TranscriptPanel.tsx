import { useSessionStore } from '../stores/sessionStore'
import { MessageSquare, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { clsx } from 'clsx'
import { TRANSCRIPTION_CONFIG } from '@shared/constants'

export function TranscriptPanel() {
  const { session, ui } = useSessionStore()
  const [isExpanded, setIsExpanded] = useState(true)

  if (!session || session.slides.length === 0) {
    return null
  }

  const currentSlide = session.slides[session.currentSlideIndex]
  const transcripts = currentSlide ? session.transcripts[currentSlide.id] || [] : []

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return (
    <div 
      className="border-t border-border bg-zinc-50/30 flex-shrink-0 transition-all duration-300 ease-in-out"
      style={{ maxHeight: isExpanded ? '180px' : '36px' }}
    >
      {/* Compact Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-100/80 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
            Transcript
          </span>
          {transcripts.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-zinc-200/50 px-1.5 py-0.5 rounded-full group-hover:bg-zinc-200 transition-colors">
              {transcripts.length}
            </span>
          )}
          {session.isRecording && (
            <span className="flex items-center gap-1.5 text-[10px] text-red-600 font-medium bg-red-50 px-1.5 py-0.5 rounded-full border border-red-100">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
              </span>
              Live
            </span>
          )}
        </div>
        <ChevronDown className={clsx(
          "w-3.5 h-3.5 text-muted-foreground transition-transform duration-300",
          !isExpanded && "rotate-180"
        )} />
      </button>

      {/* Compact Transcript content */}
      <div className={clsx(
        "px-3 pb-2 overflow-y-auto transition-opacity duration-300",
        isExpanded ? "opacity-100" : "opacity-0 invisible"
      )} style={{ maxHeight: '140px' }}>
        {transcripts.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground">
                {session.isRecording 
                  ? 'Listening...'
                  : 'No transcript yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {transcripts.map((segment, index) => (
                <div 
                  key={segment.id} 
                  className={clsx(
                    'transcript-segment text-xs',
                    index === transcripts.length - 1 && session.isRecording && 'active',
                    segment.confidence < TRANSCRIPTION_CONFIG.LOW_CONFIDENCE_THRESHOLD && 'opacity-70'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[9px] text-zinc-400 font-mono mt-0.5 flex-shrink-0 w-6 text-right">
                      {formatTime(segment.startTime)}
                    </span>
                    <p className={clsx(
                      'flex-1 leading-relaxed',
                      segment.confidence < TRANSCRIPTION_CONFIG.LOW_CONFIDENCE_THRESHOLD 
                        ? 'text-muted-foreground italic' 
                        : 'text-foreground'
                    )}>
                      {segment.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  )
}
