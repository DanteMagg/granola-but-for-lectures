import { useState } from 'react'
import { X, Star, Clock, FileText, MessageSquare, Mic } from 'lucide-react'
import { clsx } from 'clsx'

interface SessionStats {
  slidesReviewed: number
  totalSlides: number
  notesWritten: number
  transcriptSegments: number
  recordingDuration: number // in ms
}

interface SessionFeedbackModalProps {
  stats: SessionStats
  onSubmit: (rating: number, feedback: string) => void
  onSkip: () => void
}

export function SessionFeedbackModal({ stats, onSubmit, onSkip }: SessionFeedbackModalProps) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [feedback, setFeedback] = useState('')

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    return `${minutes}m ${seconds % 60}s`
  }

  const handleSubmit = () => {
    onSubmit(rating, feedback)
  }

  return (
    <div className="modal-overlay" onClick={onSkip}>
      <div 
        className="modal-content max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-zinc-50 to-white">
          <h2 className="text-lg font-semibold text-foreground tracking-tight">
            Session Complete!
          </h2>
          <button
            onClick={onSkip}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Stats Summary */}
        <div className="p-6 border-b border-border bg-zinc-50/30">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Session Summary
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-border">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {formatDuration(stats.recordingDuration)}
                </p>
                <p className="text-xs text-muted-foreground">Recording time</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-border">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {stats.slidesReviewed}/{stats.totalSlides}
                </p>
                <p className="text-xs text-muted-foreground">Slides reviewed</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-border">
              <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {stats.notesWritten}
                </p>
                <p className="text-xs text-muted-foreground">Notes written</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-border">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                <Mic className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {stats.transcriptSegments}
                </p>
                <p className="text-xs text-muted-foreground">Transcript segments</p>
              </div>
            </div>
          </div>
        </div>

        {/* Rating */}
        <div className="p-6">
          <h3 className="text-sm font-medium text-foreground mb-3">
            How was your experience?
          </h3>
          
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star 
                  className={clsx(
                    'w-8 h-8 transition-colors',
                    (hoveredRating || rating) >= star
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-zinc-200'
                  )} 
                />
              </button>
            ))}
          </div>

          {/* Feedback text */}
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Any feedback? (optional)"
            className="w-full input resize-none h-20"
          />

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={onSkip}
              className="btn btn-secondary btn-md flex-1"
            >
              Skip
            </button>
            <button
              onClick={handleSubmit}
              className="btn btn-primary btn-md flex-1"
              disabled={rating === 0}
            >
              Submit
            </button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-4">
            Your feedback helps improve the app. All data stays local.
          </p>
        </div>
      </div>
    </div>
  )
}

