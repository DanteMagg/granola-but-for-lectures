/**
 * Notes Store
 * Handles user notes and AI-enhanced notes
 */
import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Note, EnhancedNote } from '@shared/types'

interface NotesStore {
  // Notes data
  notes: Record<string, Note>
  enhancedNotes: Record<string, EnhancedNote>
  
  // Actions
  updateNote: (slideId: string, content: string, plainText: string) => void
  getNote: (slideId: string) => Note | null
  deleteNote: (slideId: string) => void
  
  // Enhanced notes
  setEnhancedNote: (slideId: string, note: EnhancedNote) => void
  updateEnhancedNoteStatus: (slideId: string, status: EnhancedNote['status'], error?: string) => void
  getEnhancedNote: (slideId: string) => EnhancedNote | null
  
  // Bulk operations
  setNotes: (notes: Record<string, Note>) => void
  setEnhancedNotes: (notes: Record<string, EnhancedNote>) => void
  
  // Reset
  reset: () => void
}

export const useNotesStore = create<NotesStore>((set, get) => ({
  notes: {},
  enhancedNotes: {},

  updateNote: (slideId: string, content: string, plainText: string) => {
    set(state => {
      const existingNote = state.notes[slideId]
      const now = new Date().toISOString()

      const note: Note = existingNote
        ? { ...existingNote, content, plainText, updatedAt: now }
        : {
            id: uuidv4(),
            slideId,
            content,
            plainText,
            createdAt: now,
            updatedAt: now,
          }

      return {
        notes: {
          ...state.notes,
          [slideId]: note,
        },
      }
    })
  },

  getNote: (slideId: string) => {
    return get().notes[slideId] || null
  },

  deleteNote: (slideId: string) => {
    set(state => {
      const { [slideId]: _, ...rest } = state.notes
      return { notes: rest }
    })
  },

  setEnhancedNote: (slideId: string, note: EnhancedNote) => {
    set(state => ({
      enhancedNotes: {
        ...state.enhancedNotes,
        [slideId]: note,
      },
    }))
  },

  updateEnhancedNoteStatus: (slideId: string, status: EnhancedNote['status'], error?: string) => {
    set(state => {
      const existingNote = state.enhancedNotes[slideId]
      if (!existingNote) return state

      return {
        enhancedNotes: {
          ...state.enhancedNotes,
          [slideId]: {
            ...existingNote,
            status,
            error,
          },
        },
      }
    })
  },

  getEnhancedNote: (slideId: string) => {
    return get().enhancedNotes[slideId] || null
  },

  setNotes: (notes: Record<string, Note>) => {
    set({ notes })
  },

  setEnhancedNotes: (notes: Record<string, EnhancedNote>) => {
    set({ enhancedNotes: notes })
  },

  reset: () => {
    set({ notes: {}, enhancedNotes: {} })
  },
}))

