import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AIChatModal } from '../../renderer/components/AIChatModal'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import { createMockSession, createMockSlide, createMockUIState } from '../helpers/mockData'
import type { AIMessage, AIConversation } from '@shared/types'

// Mock the store
vi.mock('../../renderer/stores/sessionStore')

const mockUseSessionStore = vi.mocked(useSessionStore) as any

describe('AIChatModal', () => {
  const mockSetUIState = vi.fn()
  const mockAddAIMessage = vi.fn().mockReturnValue('msg-1')
  const mockUpdateAIMessage = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock window.electronAPI
    window.electronAPI = {
      ...window.electronAPI,
      llmGetInfo: vi.fn().mockResolvedValue({
        loaded: true,
        exists: true,
        modelName: 'tinyllama-1.1b',
        contextLength: 2048,
      }),
      llmGenerate: vi.fn().mockResolvedValue({
        text: 'This is a test response from the AI.',
        tokensUsed: 50,
        finishReason: 'stop',
      }),
      llmGenerateStream: vi.fn().mockResolvedValue({
        text: 'Streaming response',
        tokensUsed: 30,
        finishReason: 'stop',
      }),
      onLLMChunk: vi.fn().mockReturnValue(() => {}),
    } as any
  })

  const setupMockStore = (overrides: Record<string, any> = {}) => {
    const slides = overrides.slides || [createMockSlide()]
    const session = createMockSession({
      slides,
      aiConversations: overrides.aiConversations || [],
      notes: overrides.notes || {},
      ...overrides,
    })

    const storeReturnValue = {
      session,
      ui: createMockUIState({ showAIChat: true, aiChatContext: 'current-slide', ...overrides.ui }),
      setUIState: mockSetUIState,
      addAIMessage: mockAddAIMessage,
      updateAIMessage: mockUpdateAIMessage,
    }
    
    mockUseSessionStore.mockReturnValue(storeReturnValue as any)
    
    // Also mock getState for direct store access
    mockUseSessionStore.getState = vi.fn().mockReturnValue(storeReturnValue)

    return session
  }

  describe('rendering', () => {
    it('should render modal with header', async () => {
      setupMockStore()
      render(<AIChatModal />)
      
      await waitFor(() => {
        expect(screen.getByText('Ask AI')).toBeInTheDocument()
      })
    })

    it('should show model info when LLM is available', async () => {
      setupMockStore()
      render(<AIChatModal />)
      
      await waitFor(() => {
        expect(screen.getByText(/Using tinyllama/i)).toBeInTheDocument()
      })
    })

    it('should show model not available warning', async () => {
      window.electronAPI.llmGetInfo = vi.fn().mockResolvedValue({
        loaded: false,
        exists: false,
        modelName: '',
      })

      setupMockStore()
      render(<AIChatModal />)
      
      await waitFor(() => {
        expect(screen.getByText(/No model installed/i)).toBeInTheDocument()
      })
    })

    it('should show empty state with quick actions when no messages', async () => {
      setupMockStore()
      render(<AIChatModal />)
      
      await waitFor(() => {
        expect(screen.getByText('Ask about your lecture')).toBeInTheDocument()
      })
    })
  })

  describe('context selector', () => {
    it('should show context selector', async () => {
      setupMockStore()
      render(<AIChatModal />)
      
      await waitFor(() => {
        expect(screen.getByText('Context:')).toBeInTheDocument()
      })
    })
  })

  describe('message display', () => {
    it('should display existing messages', async () => {
      const messages: AIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'What is machine learning?',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Machine learning is a branch of AI...',
          timestamp: new Date().toISOString(),
        },
      ]

      const conversation: AIConversation = {
        id: 'conv-1',
        sessionId: 'session-1',
        messages,
        createdAt: new Date().toISOString(),
      }

      setupMockStore({ aiConversations: [conversation] })
      render(<AIChatModal />)
      
      await waitFor(() => {
        expect(screen.getByText('What is machine learning?')).toBeInTheDocument()
      })
    })
  })

  describe('modal behavior', () => {
    it('should close when overlay clicked', async () => {
      setupMockStore()
      render(<AIChatModal />)
      
      await waitFor(() => {
        const overlay = document.querySelector('.modal-overlay')!
        fireEvent.click(overlay)
      })
      
      expect(mockSetUIState).toHaveBeenCalledWith({ showAIChat: false })
    })

    it('should not close when modal content clicked', async () => {
      setupMockStore()
      render(<AIChatModal />)
      
      await waitFor(() => {
        const modalContent = document.querySelector('.modal-content')!
        fireEvent.click(modalContent)
      })
      
      // setUIState should not have been called to close
      expect(mockSetUIState).not.toHaveBeenCalledWith({ showAIChat: false })
    })
  })

  describe('input behavior', () => {
    it('should have input field', async () => {
      setupMockStore()
      render(<AIChatModal />)
      
      await waitFor(() => {
        const input = screen.getByRole('textbox')
        expect(input).toBeInTheDocument()
      })
    })

    it('should have submit button', async () => {
      setupMockStore()
      render(<AIChatModal />)
      
      await waitFor(() => {
        // Submit button is the last button with type="submit"
        const form = document.querySelector('form')
        expect(form).toBeInTheDocument()
        const submitButton = form?.querySelector('button[type="submit"]')
        expect(submitButton).toBeInTheDocument()
      })
    })
  })
})
