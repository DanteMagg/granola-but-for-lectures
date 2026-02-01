/**
 * Transcript post-processing pipeline
 * Cleans, corrects, and segments Whisper transcription output
 */

export type VerbosityLevel = 'verbatim' | 'clean' | 'minimal'

export interface TranscriptProcessorConfig {
  verbosity: VerbosityLevel
  confidenceThreshold: number
  paragraphGapMs: number
}

export interface TranscriptSegment {
  text: string
  startTime: number
  endTime: number
  confidence: number
}

// Filler words and phrases to remove at different verbosity levels
const FILLER_WORDS_CLEAN = [
  'um', 'uh', 'er', 'ah', 'uhm', 'uhh', 'ehm',
]

const FILLER_WORDS_MINIMAL = [
  ...FILLER_WORDS_CLEAN,
  'basically', 'actually', 'literally', 'honestly',
  'obviously', 'essentially', 'definitely',
]

// Words that are fillers when standalone but meaningful in context
const CONTEXTUAL_FILLERS = ['like', 'so', 'well', 'right', 'okay', 'ok']

// Additional filler patterns for clean verbosity
const FILLER_PATTERNS_CLEAN = [
  /\blike\s+(?=um|uh|er|ah|really|actually|so|just)\b/gi,
  /\blike\s+(?=[a-z]+ing\b)/gi, // "like running" (filler before -ing verbs)
  /(?<!\bis\b|\bare\b|\bwas\b|\bwere\b|\blooks\b|\bseems\b|\bfeels\b|\bsounds\b)\s+like\s+(?=\w+(?:\s|$|[.,!?]))/gi, // standalone like not after simile verbs
]

// Additional patterns for minimal verbosity  
const FILLER_PATTERNS_MINIMAL = [
  /\bwhat\s+/gi, // "what we have" -> "we have"
]

// Phrases to remove at minimal verbosity
const FILLER_PHRASES_MINIMAL = [
  'you know',
  'i mean',
  'kind of',
  'sort of',
  'more or less',
  'if you will',
  'as it were',
]

// Common Whisper mishearings -> correct terms
const COMMON_CORRECTIONS: Record<string, string> = {
  'sequel': 'SQL',
  'jason': 'JSON',
  'no js': 'Node.js',
  'node js': 'Node.js',
  'react js': 'React',
  'type script': 'TypeScript',
  'java script': 'JavaScript',
  'html': 'HTML',
  'css': 'CSS',
  'url': 'URL',
  'http': 'HTTP',
  'https': 'HTTPS',
  'ui': 'UI',
  'ux': 'UX',
  'git': 'Git',
  'github': 'GitHub',
  'gitlab': 'GitLab',
  'cooper netties': 'Kubernetes',
  'kubernetes': 'Kubernetes',
  'kuber netties': 'Kubernetes',
  'docker': 'Docker',
  'polly morphism': 'polymorphism',
  'polymorphism': 'polymorphism',
  'encapsulation': 'encapsulation',
  'inheritance': 'inheritance',
  'abstraction': 'abstraction',
  'algorithm': 'algorithm',
  'algorithms': 'algorithms',
  'recursion': 'recursion',
  'recursive': 'recursive',
  'async': 'async',
  'await': 'await',
  'promise': 'Promise',
  'promises': 'Promises',
  'callback': 'callback',
  'callbacks': 'callbacks',
}

// Build regex pattern for filler removal
function buildFillerPattern(fillers: string[]): RegExp {
  const escaped = fillers.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  // Match fillers as whole words, case insensitive
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')
}

interface CleanOptions {
  verbosity?: VerbosityLevel
}

/**
 * Clean transcript by removing filler words based on verbosity level
 */
export function cleanTranscript(text: string, options: CleanOptions = {}): string {
  const { verbosity = 'clean' } = options

  if (!text || verbosity === 'verbatim') {
    return text
  }

  let result = text

  // Get appropriate filler list based on verbosity
  const fillers = verbosity === 'minimal' ? FILLER_WORDS_MINIMAL : FILLER_WORDS_CLEAN

  // Remove filler phrases first (minimal only)
  if (verbosity === 'minimal') {
    for (const phrase of FILLER_PHRASES_MINIMAL) {
      const phrasePattern = new RegExp(`\\b${phrase}\\b`, 'gi')
      result = result.replace(phrasePattern, '')
    }
    // Apply minimal-specific patterns
    for (const pattern of FILLER_PATTERNS_MINIMAL) {
      result = result.replace(pattern, '')
    }
  }

  // Remove filler words
  const fillerPattern = buildFillerPattern(fillers)
  result = result.replace(fillerPattern, '')

  // Handle contextual fillers (like, so, well, etc.)
  result = removeContextualFillers(result, verbosity)

  // Clean up: remove duplicate spaces, leading/trailing spaces
  result = result.replace(/\s+/g, ' ').trim()

  // Remove leading "So" at minimal verbosity (common speech pattern)
  if (verbosity === 'minimal') {
    result = result.replace(/^So\s+/i, '')
  }

  // Fix spacing around punctuation
  result = result.replace(/\s+([.,!?;:])/g, '$1')
  result = result.replace(/([.,!?;:])\s*([A-Z])/g, '$1 $2')

  // Remove duplicate words (the the -> the)
  result = result.replace(/\b(\w+)\s+\1\b/gi, '$1')

  // Capitalize first letter if it got lowercased
  result = result.charAt(0).toUpperCase() + result.slice(1)

  return result.trim()
}

/**
 * Remove contextual fillers that don't add meaning
 * "like" before another filler = remove
 * "like" as simile (like containers) = keep
 */
function removeContextualFillers(text: string, verbosity: VerbosityLevel): string {
  let result = text

  // Remove "like" + filler word entirely (both words)
  result = result.replace(/\blike\s+(um|uh|er|ah|basically|actually|really|just|so)\b/gi, '')

  // Remove duplicate "like like"
  result = result.replace(/\blike\s+like\b/gi, 'like')

  // Remove "like" before "the" when NOT after a simile verb
  // "is like the" = simile (keep), "like the function" = filler (remove)
  result = result.replace(/(?<!\b(?:is|are|was|were|looks|seems|feels|sounds|be))\s+like\s+the\b/gi, ' the')

  // Remove "like" before code-like patterns (contains dots, parens)
  result = result.replace(/\blike\s+(?=\w+[.(])/gi, '')

  // Remove "like" at start of sentence when not a simile
  result = result.replace(/^like\s+(?!a\b|an\b)/gi, '')

  // Remove standalone "like" before verbs (filler pattern) - not after simile verbs
  // This catches cases where "like" is left after removing a filler word
  result = result.replace(/(?<!\b(?:is|are|was|were|looks|seems|feels|sounds|be))\s+like\s+(?=[a-z]+s?\b)/gi, ' ')

  // Remove "so" at sentence start (except when meaning "therefore")
  if (verbosity === 'minimal') {
    result = result.replace(/^So\s+(?!that|far|long|much)/gi, '')
  }

  return result
}

/**
 * Extract potential technical terms from slide text
 */
function extractSlideTerms(slideText: string): string[] {
  if (!slideText) return []

  // Split on whitespace and punctuation
  const words = slideText.split(/[\s\-_.,;:!?()\[\]{}'"]+/)
    .filter(w => w.length > 2)

  // Also extract multi-word terms (capitalized sequences, known patterns)
  const multiWordPatterns = [
    /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g, // "Object Oriented Programming"
    /[A-Z]{2,}(?:\s+[A-Z]{2,})*/g,     // "SQL API JSON"
  ]

  const terms = [...words]
  for (const pattern of multiWordPatterns) {
    const matches = slideText.match(pattern) || []
    terms.push(...matches)
  }

  return [...new Set(terms)]
}

// Patterns for spelled-out acronyms -> correct form
const ACRONYM_CORRECTIONS: [RegExp, string][] = [
  [/\bA\.?P\.?I\.?\b/gi, 'API'],
  [/\bU\.?I\.?\b/gi, 'UI'],
  [/\bU\.?X\.?\b/gi, 'UX'],
  [/\bH\.?T\.?M\.?L\.?\b/gi, 'HTML'],
  [/\bC\.?S\.?S\.?\b/gi, 'CSS'],
  [/\bS\.?Q\.?L\.?\b/gi, 'SQL'],
  [/\bU\.?R\.?L\.?\b/gi, 'URL'],
  [/\bJ\.?S\.?O\.?N\.?\b/gi, 'JSON'],
  [/\bH\.?T\.?T\.?P\.?S?\b/gi, 'HTTP'],
]

/**
 * Correct technical terms in transcript using slide context
 */
export function correctTermsWithSlideContext(
  transcript: string,
  slideText: string | undefined
): string {
  if (!transcript) return transcript

  let result = transcript

  // Apply acronym corrections first (handles A.P.I. -> API etc)
  for (const [pattern, replacement] of ACRONYM_CORRECTIONS) {
    result = result.replace(pattern, replacement)
  }

  // Apply common corrections
  for (const [wrong, correct] of Object.entries(COMMON_CORRECTIONS)) {
    const pattern = new RegExp(`\\b${wrong}\\b`, 'gi')
    result = result.replace(pattern, correct)
  }

  // If we have slide context, use it for additional corrections
  if (slideText) {
    const slideTerms = extractSlideTerms(slideText)

    for (const term of slideTerms) {
      // Create fuzzy match pattern for the term
      // Handle common phonetic variations
      const termLower = term.toLowerCase()
      const variations = generatePhoneticVariations(termLower)

      for (const variant of variations) {
        if (variant !== termLower) {
          const pattern = new RegExp(`\\b${escapeRegex(variant)}\\b`, 'gi')
          result = result.replace(pattern, term)
        }
      }
    }
  }

  return result
}

/**
 * Generate phonetic variations of a term for fuzzy matching
 */
function generatePhoneticVariations(term: string): string[] {
  const variations = [term]

  // Common phonetic patterns
  const replacements: [RegExp, string][] = [
    [/y$/i, 'ie'],
    [/ie$/i, 'y'],
    [/ph/gi, 'f'],
    [/f/gi, 'ph'],
    [/ck/gi, 'k'],
    [/k(?=[aou])/gi, 'c'],
    [/tion$/i, 'sion'],
    [/sion$/i, 'tion'],
  ]

  for (const [pattern, replacement] of replacements) {
    const variant = term.replace(pattern, replacement)
    if (variant !== term) {
      variations.push(variant)
    }
  }

  // Add space-separated version for compound words
  // "polymorphism" -> "polly morphism"
  if (term.length > 8) {
    for (let i = 4; i < term.length - 3; i++) {
      variations.push(term.slice(0, i) + ' ' + term.slice(i))
    }
  }

  return variations
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Segment transcript into logical paragraphs based on timing gaps
 */
export function segmentTranscript(
  segments: TranscriptSegment[],
  gapThresholdMs: number = 5000
): TranscriptSegment[] {
  if (!segments || segments.length === 0) {
    return []
  }

  const paragraphs: TranscriptSegment[] = []
  let currentParagraph: TranscriptSegment | null = null

  for (const segment of segments) {
    if (!segment.text?.trim()) continue

    if (!currentParagraph) {
      currentParagraph = { ...segment, text: segment.text.trim() }
      continue
    }

    const gap = segment.startTime - currentParagraph.endTime

    if (gap >= gapThresholdMs) {
      // Start new paragraph
      paragraphs.push(currentParagraph)
      currentParagraph = { ...segment, text: segment.text.trim() }
    } else {
      // Merge into current paragraph
      currentParagraph.text = `${currentParagraph.text} ${segment.text.trim()}`
      currentParagraph.endTime = segment.endTime
      currentParagraph.confidence = Math.min(currentParagraph.confidence, segment.confidence)
    }
  }

  if (currentParagraph) {
    paragraphs.push(currentParagraph)
  }

  return paragraphs
}

/**
 * Full transcript processing pipeline
 */
export function processTranscript(
  segments: TranscriptSegment[],
  slideText: string | undefined,
  config: TranscriptProcessorConfig
): TranscriptSegment[] {
  if (!segments || segments.length === 0) {
    return []
  }

  // Step 1: Filter by confidence threshold
  const filteredSegments = segments.filter(
    s => s.confidence >= config.confidenceThreshold
  )

  if (filteredSegments.length === 0) {
    return []
  }

  // Step 2: Clean each segment
  const cleanedSegments = filteredSegments.map(segment => ({
    ...segment,
    text: cleanTranscript(segment.text, { verbosity: config.verbosity }),
  })).filter(s => s.text.trim().length > 0)

  if (cleanedSegments.length === 0) {
    return []
  }

  // Step 3: Segment into paragraphs
  const paragraphs = segmentTranscript(cleanedSegments, config.paragraphGapMs)

  // Step 4: Apply term corrections with slide context
  const correctedParagraphs = paragraphs.map(para => ({
    ...para,
    text: correctTermsWithSlideContext(para.text, slideText),
  }))

  return correctedParagraphs
}

/**
 * Default configuration for transcript processing
 */
export const DEFAULT_TRANSCRIPT_CONFIG: TranscriptProcessorConfig = {
  verbosity: 'clean',
  confidenceThreshold: 0.5,
  paragraphGapMs: 5000,
}

