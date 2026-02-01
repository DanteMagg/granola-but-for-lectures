/**
 * Tests for session validation, recovery, and migration
 */

import { describe, it, expect } from 'vitest'
import {
  validateSession,
  recoverSession,
  migrateSession,
  CURRENT_SCHEMA_VERSION,
  createSessionBackup,
  restoreFromBackup,
} from '../../renderer/lib/sessionValidator'
import { createMockSession, createMockSlide } from '../helpers/mockData'
import type { Session } from '@shared/types'

describe('sessionValidator', () => {
  describe('validateSession', () => {
    it('should validate a correct session', () => {
      const session = createMockSession()
      const result = validateSession(session)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('should return errors for null data', () => {
      const result = validateSession(null)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Session data is null or not an object')
    })

    it('should return errors for missing session ID', () => {
      const session = { name: 'Test', slides: [] }
      const result = validateSession(session)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing or invalid session ID')
    })

    it('should return warnings for invalid slides array', () => {
      const session = {
        id: 'test-id',
        name: 'Test',
        slides: 'not an array',
      }
      const result = validateSession(session)
      
      expect(result.warnings).toContain('Invalid slides array, will initialize empty')
      expect(result.recovered).toBeDefined()
      expect(result.recovered?.slides).toEqual([])
    })

    it('should return warnings for invalid notes object', () => {
      const session = {
        id: 'test-id',
        name: 'Test',
        slides: [],
        notes: 'not an object',
      }
      const result = validateSession(session)
      
      expect(result.warnings).toContain('Invalid notes object, will initialize empty')
    })
  })

  describe('recoverSession', () => {
    it('should recover a session with missing fields', () => {
      const partialData = {
        id: 'test-id',
        name: 'Partial Session',
      }
      
      const recovered = recoverSession(partialData)
      
      expect(recovered.id).toBe('test-id')
      expect(recovered.name).toBe('Partial Session')
      expect(recovered.slides).toEqual([])
      expect(recovered.notes).toEqual({})
      expect(recovered.transcripts).toEqual({})
      expect(recovered.aiConversations).toEqual([])
      expect(recovered.phase).toBe('idle')
      expect(recovered.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    })

    it('should generate a new ID if missing', () => {
      const partialData = {
        name: 'No ID Session',
      }
      
      const recovered = recoverSession(partialData)
      
      expect(recovered.id).toBeDefined()
      expect(recovered.id.length).toBeGreaterThan(0)
    })

    it('should recover slides with missing properties', () => {
      const partialData = {
        id: 'test-id',
        slides: [
          { id: 'slide-1' }, // missing index
          { index: 1 }, // missing id
          { id: 'slide-3', index: 2, imageData: 'data' }, // complete
        ],
      }
      
      const recovered = recoverSession(partialData)
      
      expect(recovered.slides).toHaveLength(3)
      expect(recovered.slides[0].id).toBe('slide-1')
      expect(recovered.slides[0].index).toBe(0) // recovered
      expect(recovered.slides[1].id).toBe('slide-1') // auto-generated
      expect(recovered.slides[2].imageData).toBe('data')
    })

    it('should recover notes with partial data', () => {
      const partialData = {
        id: 'test-id',
        notes: {
          'slide-1': { content: 'test content' }, // missing other fields
        },
      }
      
      const recovered = recoverSession(partialData)
      
      expect(recovered.notes['slide-1']).toBeDefined()
      expect(recovered.notes['slide-1'].content).toBe('test content')
      expect(recovered.notes['slide-1'].id).toBeDefined()
      expect(recovered.notes['slide-1'].slideId).toBe('slide-1')
    })

    it('should recover AI conversations', () => {
      const partialData = {
        id: 'test-id',
        aiConversations: [
          {
            id: 'conv-1',
            messages: [
              { role: 'user', content: 'Hello' },
              { role: 'assistant', content: 'Hi there' },
            ],
          },
        ],
      }
      
      const recovered = recoverSession(partialData)
      
      expect(recovered.aiConversations).toHaveLength(1)
      expect(recovered.aiConversations[0].messages).toHaveLength(2)
      expect(recovered.aiConversations[0].messages[0].id).toBeDefined()
    })
  })

  describe('migrateSession', () => {
    it('should migrate session from version 0 to current', () => {
      const oldSession = {
        id: 'old-session',
        name: 'Old Session',
        slides: [],
        notes: {},
        enhancedNotes: undefined as any,
        transcripts: { 'slide-1': [] },
        aiConversations: [],
        currentSlideIndex: 0,
        isRecording: false,
        phase: undefined as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // No schemaVersion, totalRecordingDuration
      } as unknown as Session

      const migrated = migrateSession(oldSession)

      expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
      expect(migrated.enhancedNotes).toEqual({})
      expect(migrated.phase).toBe('ready_to_enhance') // inferred from transcripts
      expect(migrated.totalRecordingDuration).toBe(0)
    })

    it('should infer recording phase for active recording', () => {
      const oldSession = {
        id: 'recording-session',
        name: 'Recording',
        slides: [],
        notes: {},
        enhancedNotes: undefined as any,
        transcripts: {},
        aiConversations: [],
        currentSlideIndex: 0,
        isRecording: true,
        phase: undefined as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as Session

      const migrated = migrateSession(oldSession)

      expect(migrated.phase).toBe('recording')
    })

    it('should infer enhanced phase when enhanced notes exist', () => {
      const oldSession = {
        id: 'enhanced-session',
        name: 'Enhanced',
        slides: [],
        notes: {},
        transcripts: {},
        enhancedNotes: { 'slide-1': { id: 'en-1', status: 'complete' } as any },
        aiConversations: [],
        currentSlideIndex: 0,
        isRecording: false,
        phase: undefined as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as Session

      const migrated = migrateSession(oldSession)

      expect(migrated.phase).toBe('enhanced')
    })

    it('should not modify session already at current version', () => {
      const currentSession = createMockSession({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        phase: 'idle',
        totalRecordingDuration: 5000,
      })

      const migrated = migrateSession(currentSession)

      expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
      expect(migrated.phase).toBe('idle')
      expect(migrated.totalRecordingDuration).toBe(5000)
    })
  })

  describe('createSessionBackup / restoreFromBackup', () => {
    it('should create and restore a backup', () => {
      const session = createMockSession({
        id: 'backup-test',
        name: 'Backup Test Session',
        slides: [createMockSlide({ id: 'slide-1', index: 0 })],
      })

      const backup = createSessionBackup(session)
      const restored = restoreFromBackup(backup)

      expect(restored).not.toBeNull()
      expect(restored?.id).toBe('backup-test')
      expect(restored?.name).toBe('Backup Test Session')
      expect(restored?.slides).toHaveLength(1)
    })

    it('should return null for invalid backup data', () => {
      const result = restoreFromBackup('invalid json')
      expect(result).toBeNull()
    })

    it('should return null for non-backup JSON', () => {
      const result = restoreFromBackup(JSON.stringify({ foo: 'bar' }))
      expect(result).toBeNull()
    })
  })
})

