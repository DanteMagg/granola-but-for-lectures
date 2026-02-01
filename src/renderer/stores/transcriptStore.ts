/**
 * Transcript Store
 * Handles transcript segments from audio transcription
 */
import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { TranscriptSegment } from '@shared/types'

interface TranscriptStore {
  // Transcripts data (keyed by slideId)
  transcripts: Record<string, TranscriptSegment[]>
  
  // Actions
  addTranscriptSegment: (
    slideId: string,
    segment: Omit<TranscriptSegment, 'id' | 'slideId'>
  ) => void
  getTranscriptsForSlide: (slideId: string) => TranscriptSegment[]
  getAllTranscriptText: () => string
  getTranscriptTextForSlide: (slideId: string) => string
  
  // Bulk operations
  setTranscripts: (transcripts: Record<string, TranscriptSegment[]>) => void
  clearTranscriptsForSlide: (slideId: string) => void
  
  // Reset
  reset: () => void
}

export const useTranscriptStore = create<TranscriptStore>((set, get) => ({
  transcripts: {},

  addTranscriptSegment: (
    slideId: string,
    segment: Omit<TranscriptSegment, 'id' | 'slideId'>
  ) => {
    set(state => {
      const fullSegment: TranscriptSegment = {
        ...segment,
        id: uuidv4(),
        slideId,
      }

      const existingSegments = state.transcripts[slideId] || []

      return {
        transcripts: {
          ...state.transcripts,
          [slideId]: [...existingSegments, fullSegment],
        },
      }
    })
  },

  getTranscriptsForSlide: (slideId: string) => {
    return get().transcripts[slideId] || []
  },

  getAllTranscriptText: () => {
    const { transcripts } = get()
    return Object.values(transcripts)
      .flat()
      .sort((a, b) => a.startTime - b.startTime)
      .map(s => s.text)
      .join(' ')
  },

  getTranscriptTextForSlide: (slideId: string) => {
    const segments = get().transcripts[slideId] || []
    return segments.map(s => s.text).join(' ')
  },

  setTranscripts: (transcripts: Record<string, TranscriptSegment[]>) => {
    set({ transcripts })
  },

  clearTranscriptsForSlide: (slideId: string) => {
    set(state => {
      const { [slideId]: _, ...rest } = state.transcripts
      return { transcripts: rest }
    })
  },

  reset: () => {
    set({ transcripts: {} })
  },
}))

