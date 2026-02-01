/**
 * Tests for transcription utility functions
 * Covers confidence filtering, bracketed text filtering, and error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transcribeAudioFile } from '../../renderer/lib/transcription'
import { TRANSCRIPTION_CONFIG } from '@shared/constants'

describe('transcription', () => {
  const mockAddTranscriptSegment = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock setup
    window.electronAPI = {
      ...window.electronAPI,
      whisperGetInfo: vi.fn().mockResolvedValue({
        loaded: true,
        exists: true,
        modelName: 'base.en',
      }),
      whisperTranscribe: vi.fn().mockResolvedValue({
        text: 'Test transcription',
        segments: [
          { text: 'Test transcription', start: 0, end: 1000, confidence: 0.95 },
        ],
      }),
    } as any
  })

  describe('API availability', () => {
    it('should return error when whisperTranscribe API is not available', async () => {
      window.electronAPI = {} as any

      const result = await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Whisper API not available')
      expect(mockAddTranscriptSegment).not.toHaveBeenCalled()
    })

    it('should return error when Whisper model is not loaded', async () => {
      window.electronAPI.whisperGetInfo = vi.fn().mockResolvedValue({
        loaded: false,
        exists: false,
        modelName: '',
      })

      const result = await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      expect(result.success).toBe(false)
      expect(result.error).toContain('not loaded')
      expect(mockAddTranscriptSegment).not.toHaveBeenCalled()
    })
  })

  describe('confidence threshold filtering', () => {
    it('should filter out segments below confidence threshold', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: '',
        segments: [
          { text: 'High confidence', start: 0, end: 1000, confidence: 0.95 },
          { text: 'Low confidence', start: 1000, end: 2000, confidence: 0.1 },
          { text: 'Medium confidence', start: 2000, end: 3000, confidence: 0.5 },
        ],
      })

      await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      // Segments get merged by post-processor, but low confidence segment is filtered
      const calls = mockAddTranscriptSegment.mock.calls
      const fullText = calls.map(call => call[1].text).join(' ')
      
      // Should contain high and medium confidence text (both >= threshold of 0.5)
      expect(fullText).toContain('High confidence')
      expect(fullText).not.toContain('Low confidence')
    })

    it('should include segments at exactly the confidence threshold', async () => {
      const threshold = TRANSCRIPTION_CONFIG.CONFIDENCE_THRESHOLD
      
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: '',
        segments: [
          { text: 'At threshold', start: 0, end: 1000, confidence: threshold },
          { text: 'Below threshold', start: 1000, end: 2000, confidence: threshold - 0.01 },
        ],
      })

      await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      const calls = mockAddTranscriptSegment.mock.calls
      const addedTexts = calls.map(call => call[1].text)
      
      // At threshold should NOT be included (uses < not <=)
      expect(addedTexts).not.toContain('Below threshold')
    })
  })

  describe('bracketed text filtering', () => {
    it('should filter out [Music] annotations', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: '',
        segments: [
          { text: '[Music]', start: 0, end: 1000, confidence: 0.95 },
          { text: 'Actual speech', start: 1000, end: 2000, confidence: 0.95 },
        ],
      })

      await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      const calls = mockAddTranscriptSegment.mock.calls
      const addedTexts = calls.map(call => call[1].text)
      
      expect(addedTexts).not.toContain('[Music]')
      expect(addedTexts).toContain('Actual speech')
    })

    it('should filter out [Applause] annotations', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: '',
        segments: [
          { text: '[Applause]', start: 0, end: 1000, confidence: 0.95 },
          { text: 'Thank you', start: 1000, end: 2000, confidence: 0.95 },
        ],
      })

      await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      const calls = mockAddTranscriptSegment.mock.calls
      const addedTexts = calls.map(call => call[1].text)
      
      expect(addedTexts).not.toContain('[Applause]')
      expect(addedTexts).toContain('Thank you')
    })

    it('should filter out [Laughter] and similar annotations', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: '',
        segments: [
          { text: '[Laughter]', start: 0, end: 500, confidence: 0.95 },
          { text: '[BLANK_AUDIO]', start: 500, end: 1000, confidence: 0.95 },
          { text: '[silence]', start: 1000, end: 1500, confidence: 0.95 },
          { text: 'Real content', start: 1500, end: 2000, confidence: 0.95 },
        ],
      })

      await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      const calls = mockAddTranscriptSegment.mock.calls
      expect(calls.length).toBe(1)
      expect(calls[0][1].text).toBe('Real content')
    })

    it('should NOT filter text that contains brackets but is not entirely bracketed', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: '',
        segments: [
          { text: 'The function f[x] returns', start: 0, end: 1000, confidence: 0.95 },
        ],
      })

      await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      const calls = mockAddTranscriptSegment.mock.calls
      expect(calls.length).toBe(1)
      expect(calls[0][1].text).toBe('The function f[x] returns')
    })
  })

  describe('empty text handling', () => {
    it('should skip segments with empty text', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: '',
        segments: [
          { text: '', start: 0, end: 1000, confidence: 0.95 },
          { text: '   ', start: 1000, end: 2000, confidence: 0.95 },
          { text: 'Actual content', start: 2000, end: 3000, confidence: 0.95 },
        ],
      })

      await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      const calls = mockAddTranscriptSegment.mock.calls
      expect(calls.length).toBe(1)
      expect(calls[0][1].text).toBe('Actual content')
    })

    it('should skip segments with null/undefined text', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: '',
        segments: [
          { text: null, start: 0, end: 1000, confidence: 0.95 },
          { text: undefined, start: 1000, end: 2000, confidence: 0.95 },
          { text: 'Valid', start: 2000, end: 3000, confidence: 0.95 },
        ],
      })

      await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      const calls = mockAddTranscriptSegment.mock.calls
      expect(calls.length).toBe(1)
      expect(calls[0][1].text).toBe('Valid')
    })
  })

  describe('fallback to full text', () => {
    it('should use full text when no segments are returned', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: 'Full transcription text',
        segments: [],
      })

      await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      const calls = mockAddTranscriptSegment.mock.calls
      expect(calls.length).toBe(1)
      expect(calls[0][1].text).toBe('Full transcription text')
      expect(calls[0][1].confidence).toBe(0.8) // Default confidence for fallback
    })

    it('should use full text when segments is undefined', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: 'Fallback text',
        segments: undefined,
      })

      await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      const calls = mockAddTranscriptSegment.mock.calls
      expect(calls.length).toBe(1)
      expect(calls[0][1].text).toBe('Fallback text')
    })

    it('should NOT use full text if it is bracketed annotation', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: '[Music playing]',
        segments: [],
      })

      const result = await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      expect(mockAddTranscriptSegment).not.toHaveBeenCalled()
      // Returns error since no speech was detected
      expect(result.success).toBe(false)
      expect(result.error).toBe('No speech detected')
    })
  })

  describe('segment data integrity', () => {
    it('should pass correct slideId to addTranscriptSegment', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: '',
        segments: [
          { text: 'Test', start: 100, end: 2000, confidence: 0.95 },
        ],
      })

      await transcribeAudioFile('base64audio', 'slide-42', mockAddTranscriptSegment)

      expect(mockAddTranscriptSegment).toHaveBeenCalledWith(
        'slide-42',
        expect.any(Object)
      )
    })

    it('should pass correct timing data to segments', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: '',
        segments: [
          { text: 'Test', start: 1500, end: 3500, confidence: 0.92 },
        ],
      })

      await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      expect(mockAddTranscriptSegment).toHaveBeenCalledWith(
        'slide-1',
        {
          text: 'Test',
          startTime: 1500,
          endTime: 3500,
          confidence: 0.92,
        }
      )
    })

    it('should trim whitespace from segment text', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: '',
        segments: [
          { text: '  Padded text  ', start: 0, end: 1000, confidence: 0.95 },
        ],
      })

      await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      expect(mockAddTranscriptSegment).toHaveBeenCalledWith(
        'slide-1',
        expect.objectContaining({ text: 'Padded text' })
      )
    })
  })

  describe('error handling', () => {
    it('should handle transcription API errors', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockRejectedValue(new Error('Transcription failed'))

      const result = await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Transcription failed')
      expect(mockAddTranscriptSegment).not.toHaveBeenCalled()
    })

    it('should handle non-Error rejections', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockRejectedValue('String error')

      const result = await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Transcription failed')
    })

    it('should return error when result is null', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue(null)

      const result = await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No transcription results')
    })

    it('should return error when result has no text and no segments', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: '',
        segments: [],
      })

      const result = await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No transcription results')
    })
  })

  describe('success cases', () => {
    it('should return success when segments are processed', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: '',
        segments: [
          { text: 'Good segment', start: 0, end: 1000, confidence: 0.95 },
        ],
      })

      const result = await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should return success when using full text fallback', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: 'Full text only',
        segments: [],
      })

      const result = await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      expect(result.success).toBe(true)
    })

    it('should process multiple segments correctly (with processing)', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: '',
        segments: [
          { text: 'First segment', start: 0, end: 1000, confidence: 0.95 },
          { text: 'Second segment', start: 1000, end: 2000, confidence: 0.90 },
          { text: 'Third segment', start: 2000, end: 3000, confidence: 0.88 },
        ],
      })

      const result = await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment)

      expect(result.success).toBe(true)
      // Consecutive segments get merged by post-processor
      expect(mockAddTranscriptSegment).toHaveBeenCalled()
      const text = mockAddTranscriptSegment.mock.calls[0][1].text
      expect(text).toContain('First segment')
    })

    it('should process multiple segments correctly (skip processing)', async () => {
      window.electronAPI.whisperTranscribe = vi.fn().mockResolvedValue({
        text: '',
        segments: [
          { text: 'First segment', start: 0, end: 1000, confidence: 0.95 },
          { text: 'Second segment', start: 1000, end: 2000, confidence: 0.90 },
          { text: 'Third segment', start: 2000, end: 3000, confidence: 0.88 },
        ],
      })

      const result = await transcribeAudioFile('base64audio', 'slide-1', mockAddTranscriptSegment, { skipProcessing: true })

      expect(result.success).toBe(true)
      expect(mockAddTranscriptSegment).toHaveBeenCalledTimes(3)
    })
  })
})

