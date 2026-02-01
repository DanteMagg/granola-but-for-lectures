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
 * Generate the enhancement prompt for a single slide
 * The prompt is designed to:
 * 1. Preserve the user's note structure and priorities
 * 2. Fill gaps with transcript content
 * 3. Add context from slide content
 * 4. Produce well-formatted, readable notes
 */
export function generateEnhancePrompt(context: EnhanceNotesContext): string {
  const { slideText, slideIndex, totalSlides, userNotes, transcript } = context

  // Handle edge cases
  const hasUserNotes = userNotes && userNotes.trim().length > 0
  const hasTranscript = transcript && transcript.trim().length > 0
  const hasSlideText = slideText && slideText.trim().length > 0

  // If no transcript, we can't enhance much
  if (!hasTranscript) {
    return `You are a lecture notes assistant. The student has notes but no transcript was captured for this slide.

## SLIDE ${slideIndex} of ${totalSlides}
${hasSlideText ? `Slide content: ${slideText}` : 'No slide text available.'}

## STUDENT'S NOTES
${hasUserNotes ? userNotes : 'No notes taken for this slide.'}

Since there's no transcript, simply format and clean up the student's existing notes. If there are no notes, generate a brief placeholder based on the slide content.

Output clean, well-formatted markdown notes.`
  }

  return `You are enhancing lecture notes. The student took brief notes during a lecture slide, and we have the full transcript of what the professor said during this slide.

Your task: Create comprehensive, study-ready notes that:
1. START with the student's original points (these are their priorities)
2. EXPAND each point with relevant details from the transcript
3. ADD important information from the transcript the student may have missed
4. REFERENCE the slide content for context
5. Keep the student's voice and style - don't make it sound robotic

## SLIDE ${slideIndex} of ${totalSlides}
${hasSlideText ? `### Slide Content
${slideText}` : ''}

## STUDENT'S NOTES
${hasUserNotes ? userNotes : '(No notes taken - generate notes from transcript)'}

## PROFESSOR'S WORDS (Transcript)
${transcript}

## OUTPUT REQUIREMENTS
- Use markdown formatting
- Use clear headers (##) to organize topics
- Use bullet points for key concepts
- **Bold** important terms and definitions
- Keep it scannable and study-friendly
- If the student wrote something, preserve their wording but expand on it
- Don't add information not supported by the transcript or slide
- Be concise but comprehensive

Generate enhanced notes:`
}

/**
 * Generate a system prompt for the LLM
 */
export function getEnhanceSystemPrompt(): string {
  return `You are an expert lecture notes assistant. Your job is to help students create comprehensive, well-organized notes from their lectures.

Key principles:
- Preserve the student's original thoughts and priorities
- Add context and details from the professor's explanations
- Use clear formatting that's easy to study from
- Be accurate - only include information from the provided transcript and slides
- Be concise - students need to review these notes efficiently

Always output in clean markdown format.`
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
${s.transcript ? `Transcript: ${s.transcript}` : ''}`
  ).join('\n\n')

  return `You are summarizing an entire lecture. Create a comprehensive summary that captures the main topics, key concepts, and important details.

## LECTURE CONTENT
${slideSummaries}

## OUTPUT REQUIREMENTS
- Start with a brief overview (2-3 sentences)
- List the main topics covered
- Highlight key concepts and definitions
- Note any important examples or applications
- End with key takeaways

Generate lecture summary:`
}

