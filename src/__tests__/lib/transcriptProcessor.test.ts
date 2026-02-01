import { describe, it, expect } from 'vitest'
import {
  cleanTranscript,
  correctTermsWithSlideContext,
  segmentTranscript,
  processTranscript,
  TranscriptProcessorConfig,
  VerbosityLevel,
} from '../../renderer/lib/transcript-processor'

describe('cleanTranscript', () => {
  it('removes filler words at default verbosity', () => {
    const input = 'So um basically uh the algorithm runs in O(n) time'
    const result = cleanTranscript(input)
    expect(result).toBe('So basically the algorithm runs in O(n) time')
  })

  it('removes repeated filler words', () => {
    const input = 'Um um uh well you know like like the the function'
    const result = cleanTranscript(input)
    expect(result).toBe('Well you know the function')
  })

  it('preserves sentence structure', () => {
    const input = 'The um derivative of x squared is uh 2x.'
    const result = cleanTranscript(input)
    expect(result).toBe('The derivative of x squared is 2x.')
  })

  it('handles empty input', () => {
    expect(cleanTranscript('')).toBe('')
  })

  it('handles input with only fillers', () => {
    const input = 'um uh er ah'
    const result = cleanTranscript(input)
    expect(result).toBe('')
  })

  it('preserves "like" when used meaningfully', () => {
    const input = 'Arrays are like containers for data'
    const result = cleanTranscript(input)
    expect(result).toBe('Arrays are like containers for data')
  })

  it('removes "like" followed by filler', () => {
    const input = 'The code like uh runs fast'
    const result = cleanTranscript(input)
    expect(result).toBe('The code runs fast')
  })

  describe('verbosity levels', () => {
    it('verbatim keeps everything', () => {
      const input = 'Um so like the uh function returns null'
      const result = cleanTranscript(input, { verbosity: 'verbatim' })
      expect(result).toBe('Um so like the uh function returns null')
    })

    it('minimal removes most conversational elements', () => {
      const input = 'So basically um we have here a recursive function'
      const result = cleanTranscript(input, { verbosity: 'minimal' })
      expect(result).toBe('We have here a recursive function')
    })

    it('clean is the default - removes fillers but keeps flow words', () => {
      const input = 'So um the function returns the sum'
      const result = cleanTranscript(input, { verbosity: 'clean' })
      expect(result).toBe('So the function returns the sum')
    })
  })
})

describe('correctTermsWithSlideContext', () => {
  it('corrects misheard technical terms using slide context', () => {
    const transcript = 'The polly morphism concept allows different implementations'
    const slideText = 'Polymorphism in Object-Oriented Programming'
    const result = correctTermsWithSlideContext(transcript, slideText)
    expect(result).toContain('polymorphism')
  })

  it('corrects common Whisper mishearings', () => {
    const transcript = 'We use the sequel database for storage'
    const slideText = 'SQL Database Design'
    const result = correctTermsWithSlideContext(transcript, slideText)
    expect(result).toContain('SQL')
  })

  it('corrects multiple terms in one pass', () => {
    const transcript = 'The Jason data is parsed using the A.P.I. endpoint'
    const slideText = 'JSON API Integration'
    const result = correctTermsWithSlideContext(transcript, slideText)
    expect(result).toContain('JSON')
    expect(result).toContain('API')
  })

  it('preserves transcript when no slide context', () => {
    const transcript = 'This is the original text'
    const result = correctTermsWithSlideContext(transcript, undefined)
    expect(result).toBe('This is the original text')
  })

  it('is case insensitive for matching', () => {
    const transcript = 'the GIT version control system'
    const slideText = 'Git Branching Strategies'
    const result = correctTermsWithSlideContext(transcript, slideText)
    expect(result).toContain('Git')
  })

  it('corrects kubernetes pronunciations', () => {
    const transcript = 'We deploy using Cooper Netties orchestration'
    const slideText = 'Kubernetes Container Orchestration'
    const result = correctTermsWithSlideContext(transcript, slideText)
    expect(result).toContain('Kubernetes')
  })
})

describe('segmentTranscript', () => {
  it('creates paragraph breaks at natural pause points', () => {
    const segments = [
      { text: 'First topic here.', startTime: 0, endTime: 3000, confidence: 0.9 },
      { text: 'Still on first topic.', startTime: 3100, endTime: 6000, confidence: 0.9 },
      { text: 'Now a new topic.', startTime: 12000, endTime: 15000, confidence: 0.9 },
    ]
    const result = segmentTranscript(segments)
    expect(result).toHaveLength(2) // Two paragraphs
    expect(result[0].text).toBe('First topic here. Still on first topic.')
    expect(result[1].text).toBe('Now a new topic.')
  })

  it('merges very short segments', () => {
    const segments = [
      { text: 'The', startTime: 0, endTime: 200, confidence: 0.9 },
      { text: 'quick', startTime: 250, endTime: 500, confidence: 0.9 },
      { text: 'brown fox', startTime: 550, endTime: 1000, confidence: 0.9 },
    ]
    const result = segmentTranscript(segments)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('The quick brown fox')
  })

  it('preserves confidence scores (uses minimum)', () => {
    const segments = [
      { text: 'High confidence.', startTime: 0, endTime: 1000, confidence: 0.95 },
      { text: 'Lower confidence.', startTime: 1100, endTime: 2000, confidence: 0.7 },
    ]
    const result = segmentTranscript(segments)
    expect(result[0].confidence).toBe(0.7)
  })

  it('handles empty input', () => {
    expect(segmentTranscript([])).toEqual([])
  })

  it('handles single segment', () => {
    const segments = [
      { text: 'Only one segment.', startTime: 0, endTime: 2000, confidence: 0.85 },
    ]
    const result = segmentTranscript(segments)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('Only one segment.')
  })
})

describe('processTranscript (full pipeline)', () => {
  const defaultConfig: TranscriptProcessorConfig = {
    verbosity: 'clean',
    confidenceThreshold: 0.5,
    paragraphGapMs: 5000,
  }

  it('applies full processing pipeline', () => {
    const segments = [
      { text: 'So um the polly morphism concept is', startTime: 0, endTime: 3000, confidence: 0.9 },
      { text: 'like uh really important.', startTime: 3100, endTime: 5000, confidence: 0.85 },
    ]
    const slideText = 'Polymorphism in OOP'
    
    const result = processTranscript(segments, slideText, defaultConfig)
    
    expect(result).toHaveLength(1)
    expect(result[0].text).toContain('polymorphism')
    expect(result[0].text).not.toContain('um')
    expect(result[0].text).not.toContain('uh')
  })

  it('filters low confidence segments', () => {
    const segments = [
      { text: 'Clear speech here.', startTime: 0, endTime: 2000, confidence: 0.9 },
      { text: 'Mumbled unclear.', startTime: 2100, endTime: 4000, confidence: 0.3 },
      { text: 'More clear speech.', startTime: 4100, endTime: 6000, confidence: 0.85 },
    ]
    
    const result = processTranscript(segments, undefined, defaultConfig)
    
    const fullText = result.map(s => s.text).join(' ')
    expect(fullText).toContain('Clear speech here')
    expect(fullText).not.toContain('Mumbled unclear')
    expect(fullText).toContain('More clear speech')
  })

  it('handles mixed confidence with merging', () => {
    const segments = [
      { text: 'Start.', startTime: 0, endTime: 1000, confidence: 0.9 },
      { text: 'Middle.', startTime: 1100, endTime: 2000, confidence: 0.4 }, // Below threshold
      { text: 'End.', startTime: 2100, endTime: 3000, confidence: 0.9 },
    ]
    
    const result = processTranscript(segments, undefined, defaultConfig)
    const fullText = result.map(s => s.text).join(' ')
    expect(fullText).toBe('Start. End.')
  })

  it('respects verbosity setting through pipeline', () => {
    const segments = [
      { text: 'So basically um the answer is yes.', startTime: 0, endTime: 3000, confidence: 0.9 },
    ]
    
    const minimalConfig = { ...defaultConfig, verbosity: 'minimal' as VerbosityLevel }
    const result = processTranscript(segments, undefined, minimalConfig)
    
    expect(result[0].text).toBe('The answer is yes.')
  })
})

describe('edge cases', () => {
  it('handles unicode and special characters', () => {
    const input = 'The résumé shows naïve approaches to Pokémon™'
    const result = cleanTranscript(input)
    expect(result).toBe('The résumé shows naïve approaches to Pokémon™')
  })

  it('handles numbers and math expressions', () => {
    const input = 'So um 2 + 2 equals uh 4'
    const result = cleanTranscript(input)
    expect(result).toBe('So 2 + 2 equals 4')
  })

  it('handles code-like content', () => {
    const input = 'The um function foo() returns like bar.baz()'
    const result = cleanTranscript(input)
    expect(result).toBe('The function foo() returns bar.baz()')
  })

  it('handles very long transcripts efficiently', () => {
    const longText = Array(1000).fill('Um the algorithm is O(n) time.').join(' ')
    const start = performance.now()
    const result = cleanTranscript(longText)
    const elapsed = performance.now() - start
    
    expect(elapsed).toBeLessThan(1000) // Should process in under 1 second
    expect(result).not.toContain(' Um ')
  })
})

