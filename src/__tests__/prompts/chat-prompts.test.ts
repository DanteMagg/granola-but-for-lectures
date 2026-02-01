import { describe, it, expect } from 'vitest'
import {
  getChatSystemPrompt,
  buildContextBlock,
  buildFewShotSection,
  summarizeConversation,
  buildChatPrompt,
  estimateTokens,
  truncateContext,
  FEW_SHOT_EXAMPLES,
  type ChatContext,
  type ConversationMessage
} from '../../shared/prompts/chat-prompts'

describe('chat-prompts', () => {
  describe('getChatSystemPrompt', () => {
    it('returns a non-empty system prompt', () => {
      const prompt = getChatSystemPrompt()
      expect(prompt).toBeTruthy()
      expect(prompt.length).toBeGreaterThan(100)
    })

    it('is under 500 tokens (~2000 chars)', () => {
      const prompt = getChatSystemPrompt()
      expect(prompt.length).toBeLessThan(2000)
    })

    it('includes key role descriptors', () => {
      const prompt = getChatSystemPrompt()
      expect(prompt).toContain('lecture')
      expect(prompt).toContain('ROLE')
      expect(prompt).toContain('RULES')
    })
  })

  describe('buildContextBlock', () => {
    it('returns fallback when context is empty', () => {
      const result = buildContextBlock({})
      expect(result).toContain('NO CONTEXT AVAILABLE')
    })

    it('includes slide info when provided', () => {
      const ctx: ChatContext = {
        slideIndex: 3,
        totalSlides: 10,
        slideContent: 'Introduction to Machine Learning'
      }
      const result = buildContextBlock(ctx)
      expect(result).toContain('SLIDE: 3 of 10')
      expect(result).toContain('Introduction to Machine Learning')
    })

    it('includes all context sections', () => {
      const ctx: ChatContext = {
        sessionName: 'CS101 Lecture 5',
        slideIndex: 2,
        totalSlides: 15,
        slideContent: 'Neural Networks Basics',
        userNotes: 'Important: backpropagation',
        enhancedNotes: 'Enhanced version of notes',
        transcript: 'The professor explained that...'
      }
      const result = buildContextBlock(ctx)
      
      expect(result).toContain('LECTURE: CS101 Lecture 5')
      expect(result).toContain('SLIDE: 2 of 15')
      expect(result).toContain('SLIDE CONTENT:')
      expect(result).toContain('STUDENT NOTES:')
      expect(result).toContain('ENHANCED NOTES:')
      expect(result).toContain('PROFESSOR SAID:')
    })

    it('trims whitespace from content', () => {
      const ctx: ChatContext = {
        slideContent: '  \n  Some content with whitespace  \n  ',
        userNotes: '   Notes   '
      }
      const result = buildContextBlock(ctx)
      expect(result).not.toContain('  \n  Some')
      expect(result).toContain('Some content with whitespace')
    })

    it('skips empty fields', () => {
      const ctx: ChatContext = {
        slideContent: 'Has content',
        userNotes: '',
        transcript: '   '
      }
      const result = buildContextBlock(ctx)
      expect(result).toContain('SLIDE CONTENT:')
      expect(result).not.toContain('STUDENT NOTES:')
      expect(result).not.toContain('PROFESSOR SAID:')
    })
  })

  describe('FEW_SHOT_EXAMPLES', () => {
    it('has at least 3 example exchanges', () => {
      expect(FEW_SHOT_EXAMPLES.length).toBeGreaterThanOrEqual(6) // 3 user + 3 assistant
    })

    it('alternates between user and assistant', () => {
      for (let i = 0; i < FEW_SHOT_EXAMPLES.length; i++) {
        const expected = i % 2 === 0 ? 'user' : 'assistant'
        expect(FEW_SHOT_EXAMPLES[i].role).toBe(expected)
      }
    })

    it('includes example of declining off-topic question', () => {
      const assistantResponses = FEW_SHOT_EXAMPLES.filter(m => m.role === 'assistant')
      const hasDecline = assistantResponses.some(m => 
        m.content.toLowerCase().includes("isn't covered") || 
        m.content.toLowerCase().includes('not covered')
      )
      expect(hasDecline).toBe(true)
    })
  })

  describe('buildFewShotSection', () => {
    it('formats examples with Student/Assistant labels', () => {
      const result = buildFewShotSection()
      expect(result).toContain('Student:')
      expect(result).toContain('Assistant:')
    })
  })

  describe('summarizeConversation', () => {
    it('returns messages unchanged when under threshold', () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
      ]
      const { summary, recentMessages } = summarizeConversation(messages, 6)
      expect(summary).toBe('')
      expect(recentMessages).toEqual(messages)
    })

    it('summarizes old messages when over threshold', () => {
      const messages: ConversationMessage[] = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i} about machine learning and neural networks`
      })) as ConversationMessage[]

      const { summary, recentMessages } = summarizeConversation(messages, 6)
      
      expect(summary).toContain('PREVIOUS DISCUSSION')
      expect(recentMessages.length).toBe(6)
    })

    it('extracts topics from old messages', () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'Tell me about gradient descent optimization' },
        { role: 'assistant', content: 'Gradient descent is an algorithm...' },
        { role: 'user', content: 'How does backpropagation work?' },
        { role: 'assistant', content: 'Backpropagation computes gradients...' },
        { role: 'user', content: 'Explain neural networks' },
        { role: 'assistant', content: 'Neural networks are...' },
        { role: 'user', content: 'More questions' },
        { role: 'assistant', content: 'More answers' },
        { role: 'user', content: 'Final question' },
        { role: 'assistant', content: 'Final answer' }
      ]

      const { summary } = summarizeConversation(messages, 4)
      expect(summary).toContain('Topics covered')
    })
  })

  describe('buildChatPrompt', () => {
    const baseContext: ChatContext = {
      slideIndex: 1,
      totalSlides: 5,
      slideContent: 'Test slide content'
    }

    it('returns system and user prompts', () => {
      const result = buildChatPrompt({
        userMessage: 'What is this about?',
        context: baseContext
      })
      
      expect(result.systemPrompt).toBeTruthy()
      expect(result.userPrompt).toBeTruthy()
    })

    it('includes context block in user prompt', () => {
      const result = buildChatPrompt({
        userMessage: 'Explain this',
        context: baseContext
      })
      
      expect(result.userPrompt).toContain('CONTEXT:')
      expect(result.userPrompt).toContain('SLIDE: 1 of 5')
    })

    it('includes few-shot examples when requested', () => {
      const result = buildChatPrompt({
        userMessage: 'Hello',
        context: baseContext,
        includeExamples: true
      })
      
      expect(result.userPrompt).toContain('EXAMPLES:')
    })

    it('does not include examples when conversation has history', () => {
      const result = buildChatPrompt({
        userMessage: 'Follow up question',
        context: baseContext,
        conversationHistory: [
          { role: 'user', content: 'First question' },
          { role: 'assistant', content: 'First answer' }
        ],
        includeExamples: true
      })
      
      expect(result.userPrompt).not.toContain('EXAMPLES:')
      expect(result.userPrompt).toContain('RECENT CONVERSATION:')
    })

    it('ends with Assistant: prompt', () => {
      const result = buildChatPrompt({
        userMessage: 'My question',
        context: baseContext
      })
      
      expect(result.userPrompt).toContain('Student: My question')
      expect(result.userPrompt.trim()).toMatch(/Assistant:$/)
    })
  })

  describe('estimateTokens', () => {
    it('estimates ~4 chars per token', () => {
      const text = 'a'.repeat(100)
      expect(estimateTokens(text)).toBe(25)
    })

    it('rounds up', () => {
      const text = 'abc'
      expect(estimateTokens(text)).toBe(1)
    })
  })

  describe('truncateContext', () => {
    it('returns context unchanged when under limit', () => {
      const ctx: ChatContext = {
        slideContent: 'Short content'
      }
      const result = truncateContext(ctx, 1000)
      expect(result.slideContent).toBe('Short content')
    })

    it('truncates transcript first', () => {
      const longTranscript = 'word '.repeat(2000)
      const ctx: ChatContext = {
        slideContent: 'Slide',
        userNotes: 'Notes',
        transcript: longTranscript
      }
      
      const result = truncateContext(ctx, 500)
      expect(result.transcript!.length).toBeLessThan(longTranscript.length)
      expect(result.transcript).toContain('...')
    })

    it('preserves slide content priority', () => {
      const ctx: ChatContext = {
        slideContent: 'Important slide content',
        transcript: 'x'.repeat(5000),
        enhancedNotes: 'y'.repeat(5000),
        userNotes: 'z'.repeat(5000)
      }
      
      const result = truncateContext(ctx, 500)
      // Slide content should be preserved
      expect(result.slideContent).toBe('Important slide content')
    })
  })
})

