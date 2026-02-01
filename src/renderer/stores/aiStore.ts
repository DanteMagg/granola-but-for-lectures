/**
 * AI Store
 * Handles AI conversations and chat state
 */
import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { AIConversation, AIMessage } from '@shared/types'

type AIChatContext = 'current-slide' | 'all-slides' | 'all-notes'

interface AIStore {
  // Conversations
  conversations: AIConversation[]
  activeConversationId: string | null
  
  // Chat UI state
  chatContext: AIChatContext
  isGenerating: boolean
  
  // Actions
  addMessage: (
    conversationId: string | null,
    message: Omit<AIMessage, 'id' | 'timestamp'>
  ) => { messageId: string; conversationId: string }
  
  updateMessage: (
    conversationId: string,
    messageId: string,
    content: string
  ) => void
  
  setActiveConversation: (conversationId: string | null) => void
  setChatContext: (context: AIChatContext) => void
  setIsGenerating: (isGenerating: boolean) => void
  
  // Getters
  getActiveConversation: () => AIConversation | null
  getConversation: (id: string) => AIConversation | null
  
  // Bulk operations
  setConversations: (conversations: AIConversation[], sessionId: string) => void
  
  // Reset
  reset: () => void
}

export const useAIStore = create<AIStore>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  chatContext: 'current-slide',
  isGenerating: false,

  addMessage: (
    conversationId: string | null,
    message: Omit<AIMessage, 'id' | 'timestamp'>
  ) => {
    const fullMessage: AIMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    }

    let newConversationId = conversationId

    set(state => {
      let conversations = [...state.conversations]

      if (conversationId) {
        // Add to existing conversation
        conversations = conversations.map(conv =>
          conv.id === conversationId
            ? { ...conv, messages: [...conv.messages, fullMessage] }
            : conv
        )
      } else {
        // Create new conversation
        newConversationId = uuidv4()
        const newConversation: AIConversation = {
          id: newConversationId,
          sessionId: '', // Will be set by session store sync
          messages: [fullMessage],
          createdAt: new Date().toISOString(),
        }
        conversations.push(newConversation)
      }

      return {
        conversations,
        activeConversationId: newConversationId,
      }
    })

    return { messageId: fullMessage.id, conversationId: newConversationId! }
  },

  updateMessage: (
    conversationId: string,
    messageId: string,
    content: string
  ) => {
    set(state => ({
      conversations: state.conversations.map(conv => {
        if (conv.id !== conversationId) return conv

        return {
          ...conv,
          messages: conv.messages.map(m =>
            m.id === messageId ? { ...m, content } : m
          ),
        }
      }),
    }))
  },

  setActiveConversation: (conversationId: string | null) => {
    set({ activeConversationId: conversationId })
  },

  setChatContext: (context: AIChatContext) => {
    set({ chatContext: context })
  },

  setIsGenerating: (isGenerating: boolean) => {
    set({ isGenerating })
  },

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get()
    if (!activeConversationId) return null
    return conversations.find(c => c.id === activeConversationId) || null
  },

  getConversation: (id: string) => {
    return get().conversations.find(c => c.id === id) || null
  },

  setConversations: (conversations: AIConversation[], sessionId: string) => {
    // Update sessionId on all conversations
    const updated = conversations.map(c => ({ ...c, sessionId }))
    set({ conversations: updated })
  },

  reset: () => {
    set({
      conversations: [],
      activeConversationId: null,
      chatContext: 'current-slide',
      isGenerating: false,
    })
  },
}))

