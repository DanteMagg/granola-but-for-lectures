import { useEffect, useState } from 'react'
import { Sparkles, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import { useSessionStore } from '../stores/sessionStore'
import { useNoteEnhancement } from '../hooks/useNoteEnhancement'

interface EnhanceNotesButtonProps {
  variant?: 'full' | 'compact'
  className?: string
}

/**
 * Button component that appears after recording stops
 * Allows user to enhance all notes with AI (Granola-style)
 */
export function EnhanceNotesButton({ 
  variant = 'full',
  className 
}: EnhanceNotesButtonProps) {
  const { session } = useSessionStore()
  const { 
    enhanceAllSlides, 
    cancelEnhancement, 
    progress, 
    isLLMAvailable,
    checkLLMStatus 
  } = useNoteEnhancement()
  
  const [showWarning, setShowWarning] = useState(false)

  // Check LLM status on mount
  useEffect(() => {
    checkLLMStatus()
  }, [checkLLMStatus])

  // Don't show if no session or still recording
  if (!session || session.isRecording) {
    return null
  }

  // Only show in ready_to_enhance or processing phase
  const showButton = session.phase === 'ready_to_enhance' || session.phase === 'processing'
  const isEnhancing = session.phase === 'enhancing' || progress.status === 'enhancing'
  const isEnhanced = session.phase === 'enhanced' || progress.status === 'complete'

  // Count slides with content to enhance
  const slidesWithContent = session.slides.filter(slide => {
    const hasTranscript = (session.transcripts[slide.id]?.length || 0) > 0
    const hasNotes = session.notes[slide.id]?.plainText?.trim().length > 0
    return hasTranscript || hasNotes
  }).length

  // Count already enhanced slides
  const enhancedCount = Object.values(session.enhancedNotes || {}).filter(
    note => note.status === 'complete'
  ).length

  const handleEnhance = async () => {
    if (!isLLMAvailable) {
      setShowWarning(true)
      return
    }
    setShowWarning(false)
    await enhanceAllSlides()
  }

  // Compact variant for header/toolbar
  if (variant === 'compact') {
    if (isEnhanced) {
      return (
        <div className={clsx('flex items-center gap-1.5 text-xs text-green-600', className)}>
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Enhanced</span>
        </div>
      )
    }

    if (isEnhancing) {
      return (
        <div className={clsx('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>{progress.currentSlide}/{progress.totalSlides}</span>
        </div>
      )
    }

    if (!showButton) return null

    return (
      <button
        onClick={handleEnhance}
        disabled={!isLLMAvailable || slidesWithContent === 0}
        className={clsx(
          'btn btn-sm btn-primary flex items-center gap-1.5',
          !isLLMAvailable && 'opacity-50 cursor-not-allowed',
          className
        )}
        title={!isLLMAvailable ? 'Load an AI model in Settings first' : 'Enhance notes with AI'}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Enhance</span>
      </button>
    )
  }

  // Full variant - prominent call to action
  if (isEnhanced) {
    return (
      <div className={clsx(
        'bg-green-50 border border-green-200 rounded-xl p-4 text-center',
        className
      )}>
        <div className="flex items-center justify-center gap-2 text-green-700 mb-2">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Notes Enhanced!</span>
        </div>
        <p className="text-sm text-green-600">
          {enhancedCount} slide{enhancedCount !== 1 ? 's' : ''} enhanced with AI.
          Switch to "Enhanced" view to see the results.
        </p>
      </div>
    )
  }

  if (isEnhancing) {
    return (
      <div className={clsx(
        'bg-zinc-50 border border-zinc-200 rounded-xl p-6 text-center',
        className
      )}>
        <div className="flex items-center justify-center gap-3 mb-4">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
          <span className="text-lg font-medium text-foreground">Enhancing Notes...</span>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-zinc-200 rounded-full h-2 mb-3">
          <div 
            className="bg-zinc-900 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(progress.currentSlide / progress.totalSlides) * 100}%` }}
          />
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          Processing slide {progress.currentSlide} of {progress.totalSlides}
        </p>
        
        <button
          onClick={cancelEnhancement}
          className="btn btn-ghost btn-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (!showButton) return null

  return (
    <div className={clsx(
      'bg-gradient-to-br from-zinc-50 to-zinc-100 border border-zinc-200 rounded-xl p-6 text-center',
      className
    )}>
      {/* Warning if LLM not available */}
      {showWarning && !isLLMAvailable && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700 text-left">
            No AI model loaded. Go to Settings → AI Model to download and load a model first.
          </p>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 mb-3">
        <Sparkles className="w-6 h-6 text-zinc-700" />
        <h3 className="text-lg font-semibold text-foreground">Enhance Your Notes</h3>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
        AI will merge your notes with the lecture transcript to create comprehensive, 
        study-ready notes for each slide.
      </p>

      <div className="text-xs text-muted-foreground mb-4">
        {slidesWithContent} slide{slidesWithContent !== 1 ? 's' : ''} with content to enhance
      </div>

      <button
        onClick={handleEnhance}
        disabled={!isLLMAvailable || slidesWithContent === 0}
        className={clsx(
          'btn btn-primary btn-lg flex items-center gap-2 mx-auto',
          (!isLLMAvailable || slidesWithContent === 0) && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Sparkles className="w-4 h-4" />
        <span>Enhance All Notes</span>
      </button>

      {slidesWithContent === 0 && (
        <p className="text-xs text-muted-foreground mt-3">
          No notes or transcript to enhance. Take some notes or record audio first.
        </p>
      )}
    </div>
  )
}

