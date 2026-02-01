// AI Chat prompts for contextual lecture assistance
// Designed for small models (TinyLlama, Phi-2, Llama-3.2)

export interface ChatContext {
  slideContent?: string
  slideIndex?: number
  totalSlides?: number
  userNotes?: string
  enhancedNotes?: string
  transcript?: string
  sessionName?: string
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * System prompt for lecture chat assistant (~400 tokens)
 * Optimized for small LLMs - clear, structured, task-focused
 */
export function getChatSystemPrompt(): string {
  return `You are a lecture study assistant in a note-taking app. Students ask about slides, notes, and transcripts from their lectures.

ROLE:
- Explain concepts from lecture content
- Answer questions using ONLY the provided context
- Help students understand difficult material
- Create quizzes and summaries when asked

RULES:
1. Base answers on the provided lecture context only
2. Reference slide numbers when relevant (e.g., "On slide 3...")
3. If info isn't in context, say "This isn't covered in the current context"
4. Be concise - students need quick answers
5. Use bullet points for lists

FORMAT:
- Keep responses under 200 words unless asked for detail
- Use **bold** for key terms
- Use bullet points for multiple items`
}

/**
 * Build context block from lecture materials
 * Structured for easy LLM parsing
 */
export function buildContextBlock(ctx: ChatContext): string {
  const parts: string[] = []

  if (ctx.sessionName) {
    parts.push(`LECTURE: ${ctx.sessionName}`)
  }

  if (ctx.slideIndex !== undefined && ctx.totalSlides !== undefined) {
    parts.push(`SLIDE: ${ctx.slideIndex} of ${ctx.totalSlides}`)
  }

  if (ctx.slideContent?.trim()) {
    parts.push(`SLIDE CONTENT:\n${ctx.slideContent.trim()}`)
  }

  if (ctx.userNotes?.trim()) {
    parts.push(`STUDENT NOTES:\n${ctx.userNotes.trim()}`)
  }

  if (ctx.enhancedNotes?.trim()) {
    parts.push(`ENHANCED NOTES:\n${ctx.enhancedNotes.trim()}`)
  }

  if (ctx.transcript?.trim()) {
    parts.push(`PROFESSOR SAID:\n${ctx.transcript.trim()}`)
  }

  if (parts.length === 0) {
    return 'NO CONTEXT AVAILABLE - Answer based on general knowledge or ask for more info.'
  }

  return parts.join('\n\n')
}

/**
 * Few-shot examples for lecture Q&A
 * Demonstrates expected response format and behavior
 */
export const FEW_SHOT_EXAMPLES: ConversationMessage[] = [
  {
    role: 'user',
    content: 'What is the main point of this slide?'
  },
  {
    role: 'assistant',
    content: `Based on slide 4, the main point is **gradient descent optimization**.

Key concepts:
- It's an iterative algorithm to find minimum values
- Learning rate controls step size
- Used to train neural networks

The professor emphasized: "This is the backbone of modern machine learning."`
  },
  {
    role: 'user', 
    content: 'Quiz me on this material'
  },
  {
    role: 'assistant',
    content: `Here are 3 questions from slide 4:

**Q1:** What does gradient descent minimize?
<answer>The loss/cost function</answer>

**Q2:** What happens if learning rate is too high?
<answer>The algorithm overshoots and may diverge</answer>

**Q3:** Name one application mentioned in the lecture.
<answer>Training neural networks / image classification</answer>`
  },
  {
    role: 'user',
    content: 'Explain photosynthesis'
  },
  {
    role: 'assistant',
    content: `This isn't covered in the current context. The lecture appears to be about machine learning, not biology.

Would you like me to:
- Explain a concept from the current slide instead?
- Search your other lecture notes?`
  }
]

/**
 * Build few-shot prompt section
 * Only include when conversation is empty (first message)
 */
export function buildFewShotSection(): string {
  return FEW_SHOT_EXAMPLES.map(msg => 
    `${msg.role === 'user' ? 'Student' : 'Assistant'}: ${msg.content}`
  ).join('\n\n')
}

/**
 * Summarize conversation history to save tokens
 * Used when conversation exceeds threshold
 */
export function summarizeConversation(
  messages: ConversationMessage[],
  maxMessages: number = 6
): { summary: string; recentMessages: ConversationMessage[] } {
  if (messages.length <= maxMessages) {
    return { summary: '', recentMessages: messages }
  }

  const oldMessages = messages.slice(0, -maxMessages)
  const recentMessages = messages.slice(-maxMessages)

  // Extract key topics from old messages
  const topics = new Set<string>()
  const userQuestions: string[] = []

  oldMessages.forEach(msg => {
    if (msg.role === 'user') {
      userQuestions.push(msg.content.slice(0, 100))
    }
    // Simple keyword extraction
    const words = msg.content.toLowerCase().split(/\s+/)
    words.forEach(word => {
      if (word.length > 5 && !['about', 'would', 'could', 'should', 'their', 'there', 'which', 'where', 'these', 'those'].includes(word)) {
        topics.add(word)
      }
    })
  })

  const summary = `PREVIOUS DISCUSSION:
- Topics covered: ${Array.from(topics).slice(0, 10).join(', ')}
- Student asked about: ${userQuestions.slice(0, 3).join('; ').slice(0, 200)}
- ${oldMessages.length} earlier messages summarized`

  return { summary, recentMessages }
}

/**
 * Build complete prompt for LLM
 * Combines system prompt, context, history, and user message
 */
export function buildChatPrompt(params: {
  userMessage: string
  context: ChatContext
  conversationHistory?: ConversationMessage[]
  includeExamples?: boolean
}): { systemPrompt: string; userPrompt: string } {
  const { userMessage, context, conversationHistory = [], includeExamples = false } = params

  const systemPrompt = getChatSystemPrompt()
  const contextBlock = buildContextBlock(context)

  let userPrompt = `CONTEXT:\n${contextBlock}\n\n`

  // Add few-shot examples for first message
  if (includeExamples && conversationHistory.length === 0) {
    userPrompt += `EXAMPLES:\n${buildFewShotSection()}\n\n---\n\n`
  }

  // Add conversation history (summarized if long)
  if (conversationHistory.length > 0) {
    const { summary, recentMessages } = summarizeConversation(conversationHistory)
    
    if (summary) {
      userPrompt += `${summary}\n\n`
    }

    userPrompt += 'RECENT CONVERSATION:\n'
    recentMessages.forEach(msg => {
      userPrompt += `${msg.role === 'user' ? 'Student' : 'Assistant'}: ${msg.content}\n\n`
    })
  }

  userPrompt += `Student: ${userMessage}\n\nAssistant:`

  return { systemPrompt, userPrompt }
}

/**
 * Token estimation (rough, ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Truncate context to fit within token budget
 */
export function truncateContext(context: ChatContext, maxTokens: number = 1500): ChatContext {
  const truncated = { ...context }
  let totalTokens = estimateTokens(buildContextBlock(truncated))

  // Priority order for truncation: transcript > enhanced > notes > slide
  if (totalTokens > maxTokens && truncated.transcript) {
    const maxChars = Math.floor(maxTokens * 4 * 0.4) // 40% for transcript
    truncated.transcript = truncated.transcript.slice(0, maxChars) + '...'
    totalTokens = estimateTokens(buildContextBlock(truncated))
  }

  if (totalTokens > maxTokens && truncated.enhancedNotes) {
    const maxChars = Math.floor(maxTokens * 4 * 0.3)
    truncated.enhancedNotes = truncated.enhancedNotes.slice(0, maxChars) + '...'
    totalTokens = estimateTokens(buildContextBlock(truncated))
  }

  if (totalTokens > maxTokens && truncated.userNotes) {
    const maxChars = Math.floor(maxTokens * 4 * 0.2)
    truncated.userNotes = truncated.userNotes.slice(0, maxChars) + '...'
  }

  return truncated
}

