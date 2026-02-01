/**
 * Session data validation, recovery, and migration utilities
 * Ensures session data integrity and backward compatibility
 */

import { v4 as uuidv4 } from 'uuid'
import type { Session, Slide, Note, EnhancedNote, TranscriptSegment, AIConversation, AIMessage } from '@shared/types'

// Schema version for migrations
export const CURRENT_SCHEMA_VERSION = 1

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  recovered?: Session
}

/**
 * Validates a session object and attempts to recover corrupted data
 */
export function validateSession(data: unknown): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Session data is null or not an object'], warnings }
  }
  
  const session = data as Record<string, unknown>
  
  // Check required fields
  if (!session.id || typeof session.id !== 'string') {
    errors.push('Missing or invalid session ID')
  }
  
  if (!session.name || typeof session.name !== 'string') {
    warnings.push('Missing session name, will use default')
  }
  
  if (!session.createdAt || typeof session.createdAt !== 'string') {
    warnings.push('Missing createdAt timestamp, will use current time')
  }
  
  // Validate slides array
  if (!Array.isArray(session.slides)) {
    warnings.push('Invalid slides array, will initialize empty')
  } else {
    const slideErrors = validateSlides(session.slides)
    if (slideErrors.length > 0) {
      warnings.push(...slideErrors.map(e => `Slide validation: ${e}`))
    }
  }
  
  // Validate notes object
  if (session.notes && typeof session.notes !== 'object') {
    warnings.push('Invalid notes object, will initialize empty')
  }
  
  // Validate transcripts object
  if (session.transcripts && typeof session.transcripts !== 'object') {
    warnings.push('Invalid transcripts object, will initialize empty')
  }
  
  // Validate AI conversations
  if (session.aiConversations && !Array.isArray(session.aiConversations)) {
    warnings.push('Invalid AI conversations, will initialize empty')
  }
  
  // If there are errors, try to recover
  if (errors.length > 0 || warnings.length > 0) {
    const recovered = recoverSession(session)
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      recovered,
    }
  }
  
  return { valid: true, errors, warnings }
}

/**
 * Validates an array of slides
 */
function validateSlides(slides: unknown[]): string[] {
  const errors: string[] = []
  
  slides.forEach((slide, index) => {
    if (!slide || typeof slide !== 'object') {
      errors.push(`Slide ${index} is invalid`)
      return
    }
    
    const s = slide as Record<string, unknown>
    
    if (!s.id || typeof s.id !== 'string') {
      errors.push(`Slide ${index} missing ID`)
    }
    
    if (typeof s.index !== 'number') {
      errors.push(`Slide ${index} missing index`)
    }
  })
  
  return errors
}

/**
 * Attempts to recover a corrupted session by filling in missing/invalid fields
 */
export function recoverSession(data: Record<string, unknown>): Session {
  const now = new Date().toISOString()
  
  // Recover slides
  let slides: Slide[] = []
  if (Array.isArray(data.slides)) {
    slides = data.slides.map((s, index) => recoverSlide(s, index)).filter(Boolean) as Slide[]
  }
  
  // Recover notes
  let notes: Record<string, Note> = {}
  if (data.notes && typeof data.notes === 'object') {
    const notesObj = data.notes as Record<string, unknown>
    for (const [slideId, note] of Object.entries(notesObj)) {
      if (note && typeof note === 'object') {
        notes[slideId] = recoverNote(note as Record<string, unknown>, slideId)
      }
    }
  }
  
  // Recover enhanced notes
  let enhancedNotes: Record<string, EnhancedNote> = {}
  if (data.enhancedNotes && typeof data.enhancedNotes === 'object') {
    const enhancedObj = data.enhancedNotes as Record<string, unknown>
    for (const [slideId, note] of Object.entries(enhancedObj)) {
      if (note && typeof note === 'object') {
        enhancedNotes[slideId] = recoverEnhancedNote(note as Record<string, unknown>, slideId)
      }
    }
  }
  
  // Recover transcripts
  let transcripts: Record<string, TranscriptSegment[]> = {}
  if (data.transcripts && typeof data.transcripts === 'object') {
    const transcriptsObj = data.transcripts as Record<string, unknown>
    for (const [slideId, segments] of Object.entries(transcriptsObj)) {
      if (Array.isArray(segments)) {
        transcripts[slideId] = segments.map(seg => recoverTranscriptSegment(seg, slideId)).filter(Boolean) as TranscriptSegment[]
      }
    }
  }
  
  // Recover AI conversations
  let aiConversations: AIConversation[] = []
  if (Array.isArray(data.aiConversations)) {
    aiConversations = data.aiConversations.map(recoverConversation).filter(Boolean) as AIConversation[]
  }
  
  return {
    id: typeof data.id === 'string' ? data.id : uuidv4(),
    name: typeof data.name === 'string' ? data.name : 'Recovered Session',
    slides,
    notes,
    enhancedNotes,
    transcripts,
    aiConversations,
    currentSlideIndex: typeof data.currentSlideIndex === 'number' ? data.currentSlideIndex : 0,
    isRecording: typeof data.isRecording === 'boolean' ? data.isRecording : false,
    recordingStartTime: typeof data.recordingStartTime === 'number' ? data.recordingStartTime : undefined,
    totalRecordingDuration: typeof data.totalRecordingDuration === 'number' ? data.totalRecordingDuration : 0,
    phase: isValidPhase(data.phase) ? data.phase as Session['phase'] : 'idle',
    pdfFileName: typeof data.pdfFileName === 'string' ? data.pdfFileName : undefined,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : now,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  }
}

function isValidPhase(phase: unknown): boolean {
  return ['idle', 'recording', 'ready_to_enhance', 'enhancing', 'enhanced'].includes(phase as string)
}

function recoverSlide(data: unknown, index: number): Slide | null {
  if (!data || typeof data !== 'object') return null
  
  const s = data as Record<string, unknown>
  
  return {
    id: typeof s.id === 'string' ? s.id : `slide-${index}`,
    index: typeof s.index === 'number' ? s.index : index,
    imageData: typeof s.imageData === 'string' ? s.imageData : '',
    extractedText: typeof s.extractedText === 'string' ? s.extractedText : undefined,
    width: typeof s.width === 'number' ? s.width : 800,
    height: typeof s.height === 'number' ? s.height : 600,
  }
}

function recoverNote(data: Record<string, unknown>, slideId: string): Note {
  return {
    id: typeof data.id === 'string' ? data.id : uuidv4(),
    slideId,
    content: typeof data.content === 'string' ? data.content : '',
    plainText: typeof data.plainText === 'string' ? data.plainText : '',
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
  }
}

function recoverEnhancedNote(data: Record<string, unknown>, slideId: string): EnhancedNote {
  return {
    id: typeof data.id === 'string' ? data.id : uuidv4(),
    slideId,
    content: typeof data.content === 'string' ? data.content : '',
    plainText: typeof data.plainText === 'string' ? data.plainText : '',
    enhancedAt: typeof data.enhancedAt === 'string' ? data.enhancedAt : new Date().toISOString(),
    status: ['pending', 'processing', 'complete', 'error'].includes(data.status as string) 
      ? data.status as EnhancedNote['status'] 
      : 'complete',
    error: typeof data.error === 'string' ? data.error : undefined,
  }
}

function recoverTranscriptSegment(data: unknown, slideId: string): TranscriptSegment | null {
  if (!data || typeof data !== 'object') return null
  
  const seg = data as Record<string, unknown>
  
  return {
    id: typeof seg.id === 'string' ? seg.id : uuidv4(),
    slideId,
    text: typeof seg.text === 'string' ? seg.text : '',
    startTime: typeof seg.startTime === 'number' ? seg.startTime : 0,
    endTime: typeof seg.endTime === 'number' ? seg.endTime : 0,
    confidence: typeof seg.confidence === 'number' ? seg.confidence : 0,
  }
}

function recoverConversation(data: unknown): AIConversation | null {
  if (!data || typeof data !== 'object') return null
  
  const conv = data as Record<string, unknown>
  
  let messages: AIMessage[] = []
  if (Array.isArray(conv.messages)) {
    messages = conv.messages.map(recoverMessage).filter(Boolean) as AIMessage[]
  }
  
  return {
    id: typeof conv.id === 'string' ? conv.id : uuidv4(),
    sessionId: typeof conv.sessionId === 'string' ? conv.sessionId : '',
    messages,
    createdAt: typeof conv.createdAt === 'string' ? conv.createdAt : new Date().toISOString(),
  }
}

function recoverMessage(data: unknown): AIMessage | null {
  if (!data || typeof data !== 'object') return null
  
  const msg = data as Record<string, unknown>
  
  if (!['user', 'assistant', 'system'].includes(msg.role as string)) {
    return null
  }
  
  return {
    id: typeof msg.id === 'string' ? msg.id : uuidv4(),
    role: msg.role as AIMessage['role'],
    content: typeof msg.content === 'string' ? msg.content : '',
    timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : new Date().toISOString(),
  }
}

/**
 * Migrates session data from older schema versions to current
 */
export function migrateSession(data: Session): Session {
  let migrated = { ...data }
  const version = data.schemaVersion || 0
  
  // Migration from version 0 (no version) to version 1
  if (version < 1) {
    // Add missing fields introduced in v1
    if (!migrated.enhancedNotes) {
      migrated.enhancedNotes = {}
    }
    if (!migrated.phase) {
      // Infer phase from existing data
      if (migrated.isRecording) {
        migrated.phase = 'recording'
      } else if (Object.keys(migrated.enhancedNotes).length > 0) {
        migrated.phase = 'enhanced'
      } else if (Object.keys(migrated.transcripts).length > 0) {
        migrated.phase = 'ready_to_enhance'
      } else {
        migrated.phase = 'idle'
      }
    }
    if (migrated.totalRecordingDuration === undefined) {
      migrated.totalRecordingDuration = 0
    }
  }
  
  // Future migrations would go here:
  // if (version < 2) { ... }
  
  // Always update to current schema version
  migrated.schemaVersion = CURRENT_SCHEMA_VERSION
  
  return migrated
}

/**
 * Creates a backup of session data before potentially destructive operations
 */
export function createSessionBackup(session: Session): string {
  return JSON.stringify({
    backup: true,
    timestamp: new Date().toISOString(),
    session,
  })
}

/**
 * Restores session from backup
 */
export function restoreFromBackup(backupData: string): Session | null {
  try {
    const parsed = JSON.parse(backupData)
    if (parsed.backup && parsed.session) {
      return parsed.session as Session
    }
    return null
  } catch {
    return null
  }
}

