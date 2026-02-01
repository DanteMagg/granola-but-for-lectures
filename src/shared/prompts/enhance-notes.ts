// Enhancement prompt template for Granola-style note merging
// This is the "secret sauce" - merging user notes with transcript to create comprehensive notes

export interface EnhanceNotesContext {
  slideText: string        // Extracted text from the slide
  slideIndex: number       // 1-based slide number
  totalSlides: number      // Total number of slides
  userNotes: string        // User's original typed notes (plain text)
  transcript: string       // Full transcript for this slide
}

/**
 * System prompt that precisely defines the enhancement task
 * Optimized for concise, student-focused output that preserves user intent
 */
export function getEnhanceSystemPrompt(): string {
  return `You are a lecture notes enhancement assistant. Your ONLY job is to merge student notes with lecture transcripts into concise, study-ready notes.

CORE PRINCIPLES:
1. PRESERVE > EXPAND > ADD: Student's original points are sacred. Expand them with transcript context. Only add new points if critically important.
2. BREVITY: Students will review these notes repeatedly. Every word must earn its place.
3. VOICE: Maintain the student's writing style and terminology choices.
4. ACCURACY: Never invent information. Only use what's in the transcript/slides.

OUTPUT CONSTRAINTS:
- Maximum 150 words per slide (hard limit)
- Maximum 5 bullet points per section
- Use the exact output format specified in each prompt`
}

/**
 * Generate the enhancement prompt for a single slide
 * Uses structured output format to ensure consistency
 */
export function generateEnhancePrompt(context: EnhanceNotesContext): string {
  const { slideText, slideIndex, totalSlides, userNotes, transcript } = context

  const hasUserNotes = userNotes && userNotes.trim().length > 0
  const hasTranscript = transcript && transcript.trim().length > 0
  const hasSlideText = slideText && slideText.trim().length > 0

  // No transcript = minimal enhancement
  if (!hasTranscript) {
    return `Slide ${slideIndex}/${totalSlides}

${hasSlideText ? `SLIDE TEXT:\n${slideText}\n` : ''}
STUDENT NOTES:
${hasUserNotes ? userNotes : '(none)'}

Task: Format and clean up existing notes. If no notes exist, create 2-3 bullet points from slide text.

OUTPUT FORMAT:
## Key Points
- [bullet points only, no sub-bullets]`
  }

  // Main enhancement prompt with structured output
  return `Slide ${slideIndex}/${totalSlides}

${hasSlideText ? `SLIDE TEXT:\n${slideText}\n` : ''}
STUDENT NOTES:
${hasUserNotes ? userNotes : '(none taken)'}

TRANSCRIPT:
${transcript}

---
TASK: Create enhanced notes following these rules:

RULE 1 - PRESERVE USER NOTES
${hasUserNotes ? `The student wrote: "${userNotes}"
These points represent what THEY found important. Keep their exact wording where possible. Expand each point with 1 clarifying detail from the transcript.` : 'No notes taken. Extract 3-5 key points from the transcript.'}

RULE 2 - ADD ONLY CRITICAL GAPS
If the transcript contains something important the student missed AND it's essential for understanding, add it as a separate point marked with [+].

RULE 3 - STRICT OUTPUT FORMAT
\`\`\`
## Key Points
- **[Term/Concept]**: [Explanation in ≤15 words]
- [Additional points as needed, max 5 total]

${hasUserNotes ? `## From Lecture
- [+] [Only if student missed something critical]` : ''}
\`\`\`

RULE 4 - CONSTRAINTS
- Total output: ≤150 words
- No introductions, no summaries, no meta-commentary
- No "The professor said..." or "This slide covers..."
- Bold key terms only (max 3 per slide)

Generate enhanced notes:`
}

/**
 * Generate a prompt for summarizing an entire lecture
 */
export function generateLectureSummaryPrompt(
  slides: Array<{ index: number; text: string; notes: string; transcript: string }>
): string {
  const slideSummaries = slides.map(s => 
    `### Slide ${s.index}
${s.text ? `Content: ${s.text}` : ''}
${s.notes ? `Notes: ${s.notes}` : ''}
${s.transcript ? `Transcript excerpt: ${s.transcript.slice(0, 500)}${s.transcript.length > 500 ? '...' : ''}` : ''}`
  ).join('\n\n')

  return `Summarize this lecture in a structured format.

${slideSummaries}

OUTPUT FORMAT:
## Overview
[2-3 sentences describing what this lecture covered]

## Main Topics
1. **[Topic]**: [One sentence]
2. **[Topic]**: [One sentence]
[max 5 topics]

## Key Definitions
- **[Term]**: [Definition]
[only terms that were explicitly defined]

## Takeaways
- [Most important insight 1]
- [Most important insight 2]
- [Most important insight 3]

CONSTRAINTS:
- Total: ≤300 words
- No filler phrases
- Only information from the lecture`
}

// ============================================================================
// QUALITY SCORING RUBRIC (for evaluation/testing)
// ============================================================================

/**
 * Quality dimensions for enhanced notes evaluation
 * Score each 1-5, multiply by weight, sum for total (max 100)
 */
export const QUALITY_RUBRIC = {
  preservation: {
    weight: 30,
    description: 'User\'s original points preserved and recognizable',
    scoring: {
      5: 'All user points present with original wording intact',
      4: 'All user points present, minor rephrasing',
      3: 'Most user points present, some merged/lost',
      2: 'User points significantly altered or reduced',
      1: 'User notes largely ignored or replaced',
    }
  },
  conciseness: {
    weight: 25,
    description: 'Brevity without losing meaning',
    scoring: {
      5: '≤100 words, all essential info retained',
      4: '100-150 words, minimal fluff',
      3: '150-200 words, some unnecessary elaboration',
      2: '200-250 words, verbose',
      1: '>250 words or critical info missing due to over-cutting',
    }
  },
  formatting: {
    weight: 20,
    description: 'Consistent structure following output schema',
    scoring: {
      5: 'Exact format match, scannable, clear hierarchy',
      4: 'Minor format deviations, still scannable',
      3: 'Format partially followed, readability affected',
      2: 'Format largely ignored, hard to scan',
      1: 'No structure, wall of text',
    }
  },
  accuracy: {
    weight: 15,
    description: 'Information sourced only from transcript/slides',
    scoring: {
      5: 'All claims traceable to source material',
      4: 'Minor inferences but reasonable',
      3: 'Some unsupported claims',
      2: 'Multiple hallucinations',
      1: 'Largely fabricated content',
    }
  },
  studyValue: {
    weight: 10,
    description: 'Useful for exam review and understanding',
    scoring: {
      5: 'Perfect study notes, clear takeaways',
      4: 'Very useful, minor gaps',
      3: 'Useful but needs supplement',
      2: 'Limited study value',
      1: 'Not useful for studying',
    }
  },
} as const

export type QualityDimension = keyof typeof QUALITY_RUBRIC

// ============================================================================
// BEFORE/AFTER EXAMPLES (for testing and prompt engineering)
// ============================================================================

export const ENHANCEMENT_EXAMPLES = [
  {
    name: 'Example 1: Student has notes + transcript',
    input: {
      slideText: 'Machine Learning: Supervised vs Unsupervised Learning',
      slideIndex: 3,
      totalSlides: 20,
      userNotes: 'supervised = labeled data\nunsupervised finds patterns',
      transcript: 'So supervised learning is when you have labeled training data, meaning each example has the correct answer attached. Think of it like a teacher grading homework - you know what right looks like. Unsupervised learning is the opposite, you throw data at the algorithm and say find me interesting patterns, find clusters, find structure. No labels. Like giving someone a pile of photos and saying organize these however makes sense to you.',
    },
    goodOutput: `## Key Points
- **Supervised learning**: Uses labeled data where each example has the correct answer (like a teacher grading homework)
- **Unsupervised learning**: Finds patterns in unlabeled data without predefined answers (like organizing photos by similarity)

## From Lecture
- [+] Key distinction: supervised knows "what right looks like," unsupervised discovers structure`,
    badOutput: `## Machine Learning: Supervised vs Unsupervised Learning

In this slide, we're going to explore the fundamental differences between supervised and unsupervised learning, which are two major paradigms in machine learning.

### Supervised Learning
Supervised learning is a type of machine learning where the model is trained on labeled data. This means that for each training example, we have both the input features and the corresponding correct output (label). The professor used a great analogy here - it's like a teacher grading homework where you know what the correct answer should look like. The algorithm learns by comparing its predictions to the known correct answers and adjusting accordingly.

### Unsupervised Learning  
Unsupervised learning, on the other hand, works with unlabeled data. The algorithm is tasked with finding patterns, clusters, or structure in the data without being told what to look for. The professor compared this to giving someone a pile of photos and asking them to organize them however makes sense - there's no "right" answer, just discovered structure.

### Key Takeaways
- Supervised learning requires labeled training data
- Unsupervised learning finds patterns without labels
- The choice between them depends on whether you have labeled data available`,
    explanation: 'Bad output is verbose (250+ words), adds unnecessary headers, uses filler phrases ("In this slide, we\'re going to explore"), and buries the student\'s original simple notes. Good output preserves student\'s exact framing ("supervised = labeled data") while adding the clarifying analogy.',
  },
  {
    name: 'Example 2: Student has minimal notes',
    input: {
      slideText: 'HTTP Status Codes',
      slideIndex: 7,
      totalSlides: 15,
      userNotes: '404 = not found',
      transcript: 'HTTP status codes are grouped by their first digit. 2xx means success, so 200 is OK, 201 is created. 4xx are client errors - 404 not found is the famous one, but 401 unauthorized and 403 forbidden are important too. 5xx are server errors, 500 internal server error means something broke on the backend. You\'ll use these constantly in API development.',
    },
    goodOutput: `## Key Points
- **404**: Not found (client requested non-existent resource)
- **2xx**: Success codes (200 OK, 201 Created)
- **4xx**: Client errors (401 unauthorized, 403 forbidden)
- **5xx**: Server errors (500 = backend broke)

## From Lecture
- [+] Status codes grouped by first digit - memorize the pattern`,
    badOutput: `## HTTP Status Codes Overview

HTTP status codes tell you what happened with a request. Let me break these down for you:

**Success (2xx)**
- 200 OK - The request was successful
- 201 Created - Something new was created

**Client Errors (4xx)** 
- 401 Unauthorized - You need to authenticate
- 403 Forbidden - You're authenticated but not allowed
- 404 Not Found - The resource doesn't exist

**Server Errors (5xx)**
- 500 Internal Server Error - Something broke on the server side

These codes are essential for API development and debugging.`,
    explanation: 'Bad output ignores student\'s note (404=not found doesn\'t appear first despite being what student cared about), adds conversational filler ("Let me break these down"), and provides a generic textbook summary. Good output puts 404 first (preserving student priority), uses compact formatting, and surfaces the "grouped by digit" insight as an added critical point.',
  },
] as const
