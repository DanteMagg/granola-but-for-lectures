import { TRANSCRIPTION_CONFIG } from '@shared/constants'
import {
  cleanTranscript,
  correctTermsWithSlideContext,
  processTranscript,
  DEFAULT_TRANSCRIPT_CONFIG,
  VerbosityLevel,
  TranscriptProcessorConfig,
} from './transcript-processor'

export interface TranscriptionOptions {
  /** Slide text for context-aware term correction */
  slideText?: string
  /** Verbosity level for transcript cleaning */
  verbosity?: VerbosityLevel
  /** Skip post-processing (raw Whisper output) */
  skipProcessing?: boolean
}

/**
 * Helper function to transcribe existing audio files
 * Separated from AudioRecorder component to enable React Fast Refresh
 */
export async function transcribeAudioFile(
  audioBase64: string,
  slideId: string,
  addTranscriptSegment: (slideId: string, segment: { text: string; startTime: number; endTime: number; confidence: number }) => void,
  options: TranscriptionOptions = {}
): Promise<{ success: boolean; error?: string }> {
  if (!window.electronAPI?.whisperTranscribe) {
    return { success: false, error: 'Whisper API not available' }
  }

  const { slideText, verbosity = 'clean', skipProcessing = false } = options

  try {
    // Check if Whisper is loaded
    const info = await window.electronAPI.whisperGetInfo()
    if (!info.loaded) {
      return { success: false, error: 'Whisper model not loaded. Please load a model in Settings.' }
    }

    const result = await window.electronAPI.whisperTranscribe(audioBase64)
    
    if (result && result.segments && result.segments.length > 0) {
      // Convert raw segments
      const rawSegments = result.segments
        .filter((s: any) => s.text?.trim() && !s.text.trim().match(/^\[.*\]$/))
        .map((s: any) => ({
          text: s.text.trim(),
          startTime: s.start,
          endTime: s.end,
          confidence: s.confidence ?? 0.8,
        }))

      if (skipProcessing) {
        // Add raw segments without processing
        for (const segment of rawSegments) {
          if (segment.confidence < TRANSCRIPTION_CONFIG.CONFIDENCE_THRESHOLD) continue
          addTranscriptSegment(slideId, segment)
        }
      } else {
        // Apply full post-processing pipeline
        const config: TranscriptProcessorConfig = {
          ...DEFAULT_TRANSCRIPT_CONFIG,
          verbosity,
          confidenceThreshold: TRANSCRIPTION_CONFIG.CONFIDENCE_THRESHOLD,
        }
        
        const processedSegments = processTranscript(rawSegments, slideText, config)
        
        for (const segment of processedSegments) {
          addTranscriptSegment(slideId, segment)
        }
      }
      
      return { success: true }
    } else if (result && result.text && result.text.trim()) {
      let text = result.text.trim()
      if (text.startsWith('[') && text.endsWith(']')) {
        return { success: false, error: 'No speech detected' }
      }
      
      // Apply cleaning to single-segment result
      if (!skipProcessing) {
        text = cleanTranscript(text, { verbosity })
        if (slideText) {
          text = correctTermsWithSlideContext(text, slideText)
        }
      }
      
      if (text.trim()) {
        addTranscriptSegment(slideId, {
          text,
          startTime: 0,
          endTime: 5000,
          confidence: 0.8,
        })
      }
      return { success: true }
    }

    return { success: false, error: 'No transcription results' }
  } catch (err) {
    console.error('Transcription error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Transcription failed' }
  }
}

// Re-export processor utilities for direct use
export {
  cleanTranscript,
  correctTermsWithSlideContext,
  processTranscript,
  DEFAULT_TRANSCRIPT_CONFIG,
  type VerbosityLevel,
  type TranscriptProcessorConfig,
}

