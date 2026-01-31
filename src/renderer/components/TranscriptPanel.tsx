import { useSessionStore } from '../stores/sessionStore'
import { MessageSquare, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { clsx } from 'clsx'
import { TRANSCRIPTION_CONFIG } from '@shared/constants'

export function TranscriptPanel() {
  const { session, ui, setUIState } = useSessionStore()
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
      className="border-t border-border bg-white"
      style={{ height: isExpanded ? ui.transcriptPanelHeight : 'auto' }}
    >
      {/* Header */}
      <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-zinc-50/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Transcript
          </span>
          {transcripts.length > 0 && (
            <span className="text-xs text-muted-foreground bg-zinc-100 px-1.5 py-0.5 rounded-full">
              {transcripts.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {session.isRecording && (
            <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              Recording
            </span>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-zinc-100 rounded transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Transcript content */}
      {isExpanded && (
        <div className="p-4 overflow-y-auto" style={{ height: ui.transcriptPanelHeight - 45 }}>
          {transcripts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-5 h-5 text-zinc-300" />
              </div>
              <p className="text-sm text-muted-foreground">
                {session.isRecording 
                  ? 'Listening for speech...'
                  : 'No transcript for this slide yet.'}
              </p>
              {!session.isRecording && (
                <p className="text-xs text-zinc-400 mt-1">
                  Start recording to capture lecture audio.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {transcripts.map((segment, index) => (
                <div 
                  key={segment.id} 
                  className={clsx(
                    'transcript-segment group',
                    index === transcripts.length - 1 && session.isRecording && 'active',
                    segment.confidence < TRANSCRIPTION_CONFIG.LOW_CONFIDENCE_THRESHOLD && 'opacity-70'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-[10px] text-zinc-400 font-mono mt-1 flex-shrink-0 w-8 text-right group-hover:text-zinc-500 transition-colors">
                      {formatTime(segment.startTime)}
                    </span>
                    <div className="flex-1">
                      <p className={clsx(
                        'text-sm leading-relaxed',
                        segment.confidence < TRANSCRIPTION_CONFIG.LOW_CONFIDENCE_THRESHOLD 
                          ? 'text-muted-foreground italic' 
                          : 'text-foreground'
                      )}>
                        {segment.text}
                      </p>
                      {segment.confidence < TRANSCRIPTION_CONFIG.LOW_CONFIDENCE_THRESHOLD && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 mt-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Low confidence ({Math.round(segment.confidence * 100)}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
