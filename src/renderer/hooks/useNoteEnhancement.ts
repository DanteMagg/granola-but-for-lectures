import { useState, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useSessionStore } from '../stores/sessionStore'
import type { EnhancedNote, Slide, TranscriptSegment } from '@shared/types'
import { 
  generateEnhancePrompt, 
  getEnhanceSystemPrompt,
  type EnhanceNotesContext 
} from '@shared/prompts/enhance-notes'

interface EnhancementProgress {
  currentSlide: number
  totalSlides: number
  status: 'idle' | 'enhancing' | 'complete' | 'error'
  error?: string
}

interface UseNoteEnhancementReturn {
  // Single slide enhancement
  enhanceSlide: (slideId: string) => Promise<void>
  
  // Bulk enhancement
  enhanceAllSlides: () => Promise<void>
  
  // Cancel ongoing enhancement
  cancelEnhancement: () => void
  
  // Progress tracking
  progress: EnhancementProgress
  
  // Is LLM available
  isLLMAvailable: boolean
  
  // Check LLM status
  checkLLMStatus: () => Promise<boolean>
}

/**
 * Hook for enhancing notes using the LLM
 * Implements the Granola-style note merging workflow
 */
export function useNoteEnhancement(): UseNoteEnhancementReturn {
  const { 
    session, 
    setEnhancedNote, 
    updateEnhancedNoteStatus,
    setSessionPhase 
  } = useSessionStore()
  
  const [progress, setProgress] = useState<EnhancementProgress>({
    currentSlide: 0,
    totalSlides: 0,
    status: 'idle',
  })
  
  const [isLLMAvailable, setIsLLMAvailable] = useState(false)
  const cancelledRef = useRef(false)
  const enhancingRef = useRef(false)

  /**
   * Check if the LLM is loaded and available
   */
  const checkLLMStatus = useCallback(async (): Promise<boolean> => {
    try {
      if (!window.electronAPI?.llmGetInfo) {
        setIsLLMAvailable(false)
        return false
      }
      
      const info = await window.electronAPI.llmGetInfo()
      const available = info.loaded && info.exists
      setIsLLMAvailable(available)
      return available
    } catch (err) {
      console.error('Failed to check LLM status:', err)
      setIsLLMAvailable(false)
      return false
    }
  }, [])

  /**
   * Get transcript text for a slide (reads fresh from store to avoid stale closures)
   */
  const getSlideTranscript = useCallback((slideId: string): string => {
    const currentSession = useSessionStore.getState().session
    if (!currentSession) return ''
    const segments = currentSession.transcripts[slideId] || []
    return segments.map((s: TranscriptSegment) => s.text).join(' ')
  }, [])

  /**
   * Get user notes for a slide (reads fresh from store to avoid stale closures)
   */
  const getSlideNotes = useCallback((slideId: string): string => {
    const currentSession = useSessionStore.getState().session
    if (!currentSession) return ''
    const note = currentSession.notes[slideId]
    return note?.plainText || ''
  }, [])

  /**
   * Enhance a single slide's notes
   */
  const enhanceSlide = useCallback(async (slideId: string): Promise<void> => {
    // Get fresh session from store to avoid stale closures
    const currentSession = useSessionStore.getState().session
    if (!currentSession || enhancingRef.current) return

    const slide = currentSession.slides.find((s: Slide) => s.id === slideId)
    if (!slide) return

    // Check LLM availability
    const available = await checkLLMStatus()
    if (!available) {
      console.error('LLM not available for enhancement')
      return
    }

    enhancingRef.current = true
    cancelledRef.current = false

    // Create pending enhanced note
    const enhancedNote: EnhancedNote = {
      id: uuidv4(),
      slideId,
      content: '',
      plainText: '',
      originalNoteId: currentSession.notes[slideId]?.id,
      enhancedAt: new Date().toISOString(),
      status: 'generating',
    }
    setEnhancedNote(slideId, enhancedNote)

    try {
      // Build context for the prompt
      const context: EnhanceNotesContext = {
        slideText: slide.extractedText || '',
        slideIndex: slide.index + 1, // 1-based for display
        totalSlides: currentSession.slides.length,
        userNotes: getSlideNotes(slideId),
        transcript: getSlideTranscript(slideId),
      }

      const prompt = generateEnhancePrompt(context)
      const systemPrompt = getEnhanceSystemPrompt()

      // Call LLM
      const response = await window.electronAPI.llmGenerate({
        prompt,
        systemPrompt,
        maxTokens: 2048,
        temperature: 0.7,
      })

      if (cancelledRef.current) {
        updateEnhancedNoteStatus(slideId, 'pending')
        return
      }

      // Update enhanced note with result
      const completedNote: EnhancedNote = {
        ...enhancedNote,
        content: response.text,
        plainText: response.text, // For now, same as content (could strip markdown)
        status: 'complete',
      }
      setEnhancedNote(slideId, completedNote)

    } catch (err) {
      console.error('Enhancement error:', err)
      updateEnhancedNoteStatus(
        slideId,
        'error',
        err instanceof Error ? err.message : 'Enhancement failed'
      )
    } finally {
      enhancingRef.current = false
    }
  }, [checkLLMStatus, getSlideNotes, getSlideTranscript, setEnhancedNote, updateEnhancedNoteStatus])

  /**
   * Enhance all slides in the session
   */
  const enhanceAllSlides = useCallback(async (): Promise<void> => {
    // Get fresh session from store to avoid stale closures
    const currentSession = useSessionStore.getState().session
    if (!currentSession || enhancingRef.current) return

    // Check LLM availability first
    const available = await checkLLMStatus()
    if (!available) {
      setProgress({
        currentSlide: 0,
        totalSlides: 0,
        status: 'error',
        error: 'LLM not available. Please load a model in Settings.',
      })
      return
    }

    enhancingRef.current = true
    cancelledRef.current = false
    setSessionPhase('enhancing')

    // Get fresh session and filter slides
    const freshSession = useSessionStore.getState().session!
    const slidesToEnhance = freshSession.slides.filter((slide: Slide) => {
      // Only enhance slides that have transcript or notes
      const hasTranscript = (freshSession.transcripts[slide.id]?.length || 0) > 0
      const hasNotes = freshSession.notes[slide.id]?.plainText?.trim().length > 0
      return hasTranscript || hasNotes
    })

    setProgress({
      currentSlide: 0,
      totalSlides: slidesToEnhance.length,
      status: 'enhancing',
    })

    for (let i = 0; i < slidesToEnhance.length; i++) {
      if (cancelledRef.current) {
        setProgress(prev => ({ ...prev, status: 'idle' }))
        setSessionPhase('ready_to_enhance')
        enhancingRef.current = false
        return
      }

      const slide = slidesToEnhance[i]
      setProgress(prev => ({ ...prev, currentSlide: i + 1 }))

      // Get fresh session state for each slide to include any updates made during enhancement
      const latestSession = useSessionStore.getState().session!

      // Create pending note
      const enhancedNote: EnhancedNote = {
        id: uuidv4(),
        slideId: slide.id,
        content: '',
        plainText: '',
        originalNoteId: latestSession.notes[slide.id]?.id,
        enhancedAt: new Date().toISOString(),
        status: 'generating',
      }
      setEnhancedNote(slide.id, enhancedNote)

      try {
        const context: EnhanceNotesContext = {
          slideText: slide.extractedText || '',
          slideIndex: slide.index + 1,
          totalSlides: latestSession.slides.length,
          userNotes: getSlideNotes(slide.id),
          transcript: getSlideTranscript(slide.id),
        }

        const prompt = generateEnhancePrompt(context)
        const systemPrompt = getEnhanceSystemPrompt()

        const response = await window.electronAPI.llmGenerate({
          prompt,
          systemPrompt,
          maxTokens: 2048,
          temperature: 0.7,
        })

        if (cancelledRef.current) continue

        const completedNote: EnhancedNote = {
          ...enhancedNote,
          content: response.text,
          plainText: response.text,
          status: 'complete',
        }
        setEnhancedNote(slide.id, completedNote)

      } catch (err) {
        console.error(`Enhancement error for slide ${slide.index}:`, err)
        updateEnhancedNoteStatus(
          slide.id,
          'error',
          err instanceof Error ? err.message : 'Enhancement failed'
        )
      }
    }

    setProgress({
      currentSlide: slidesToEnhance.length,
      totalSlides: slidesToEnhance.length,
      status: 'complete',
    })
    setSessionPhase('enhanced')
    enhancingRef.current = false
  }, [checkLLMStatus, getSlideNotes, getSlideTranscript, setEnhancedNote, updateEnhancedNoteStatus, setSessionPhase])

  /**
   * Cancel ongoing enhancement
   */
  const cancelEnhancement = useCallback(() => {
    cancelledRef.current = true
    setProgress(prev => ({ ...prev, status: 'idle' }))
  }, [])

  return {
    enhanceSlide,
    enhanceAllSlides,
    cancelEnhancement,
    progress,
    isLLMAvailable,
    checkLLMStatus,
  }
}

