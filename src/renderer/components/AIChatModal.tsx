import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import DOMPurify from 'dompurify'
import { useSessionStore } from '../stores/sessionStore'
import { createLogger } from '../lib/logger'
import { X, Send, Sparkles, ChevronDown, Copy, Check, Square, Settings, AlertCircle, Lightbulb, HelpCircle, BookOpen } from 'lucide-react'

const log = createLogger('aiChat')
import { clsx } from 'clsx'
import { AI_CONFIG } from '@shared/constants'
import {
  buildChatPrompt,
  truncateContext,
  type ChatContext,
  type ConversationMessage
} from '@shared/prompts/chat-prompts'
import { useFocusTrap } from '../hooks/useFocusTrap'

type ContextType = typeof AI_CONFIG.CONTEXT_TYPES[number]

// Quick action prompts for slide-aware chat
const QUICK_ACTIONS = [
  {
    id: 'explain',
    label: 'Explain this slide',
    icon: Lightbulb,
    prompt: 'Explain the key concepts on this slide in simple terms. What are the main takeaways?',
  },
  {
    id: 'quiz',
    label: 'Quiz me',
    icon: HelpCircle,
    prompt: 'Create 3 quiz questions based on this slide to test my understanding. Include the answers.',
  },
  {
    id: 'summarize',
    label: 'Summarize lecture',
    icon: BookOpen,
    prompt: 'Provide a comprehensive summary of the entire lecture, highlighting the main topics and key points.',
    context: 'all-slides' as ContextType,
  },
]

interface LLMStatus {
  available: boolean
  loaded: boolean
  modelName?: string
  error?: string
}

export function AIChatModal() {
  const { session, ui, setUIState, addAIMessage, updateAIMessage } = useSessionStore()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [context, setContext] = useState<ContextType>(ui.aiChatContext)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [llmStatus, setLlmStatus] = useState<LLMStatus>({ available: false, loaded: false })
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<boolean>(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const focusTrapRef = useFocusTrap<HTMLDivElement>(true)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settingsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Get current conversation or messages from all conversations
  const currentConversation = session?.aiConversations[session.aiConversations.length - 1]
  const messages = currentConversation?.messages || []

  // Check LLM status on mount
  useEffect(() => {
    checkLLMStatus()
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Cleanup streaming listener and timeouts on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
      if (settingsTimeoutRef.current) {
        clearTimeout(settingsTimeoutRef.current)
      }
    }
  }, [])

  const checkLLMStatus = async () => {
    try {
      if (window.electronAPI?.llmGetInfo) {
        const info = await window.electronAPI.llmGetInfo()
        setLlmStatus({
          available: info.exists,
          loaded: info.loaded,
          modelName: info.modelName
        })
      }
    } catch (err) {
      setLlmStatus({
        available: false,
        loaded: false,
        error: 'Failed to check LLM status'
      })
    }
  }

  const handleClose = () => {
    setUIState({ showAIChat: false })
  }

  const handleOpenSettings = () => {
    setUIState({ showAIChat: false })
    // A small delay to allow the modal to close before opening settings
    settingsTimeoutRef.current = setTimeout(() => {
      // Trigger settings modal - this assumes there's a way to open it
      // For now, we'll just close this modal
      document.dispatchEvent(new CustomEvent('open-settings', { detail: { tab: 'models' } }))
    }, 100)
  }

  // Build context object for the new prompt system
  const buildLectureContext = useCallback((overrideContext?: ContextType): ChatContext => {
    if (!session) return {}

    const activeContext = overrideContext || context

    switch (activeContext) {
      case 'current-slide': {
        const slide = session.slides[session.currentSlideIndex]
        if (!slide) return {}
        
        const note = session.notes[slide.id]
        const enhancedNote = session.enhancedNotes?.[slide.id]
        const transcripts = session.transcripts[slide.id] || []
        
        return {
          sessionName: session.name,
          slideIndex: session.currentSlideIndex + 1,
          totalSlides: session.slides.length,
          slideContent: slide.extractedText,
          userNotes: note?.plainText,
          enhancedNotes: enhancedNote?.status === 'complete' ? enhancedNote.plainText : undefined,
          transcript: transcripts.map(t => t.text).join(' ')
        }
      }
      
      case 'all-slides': {
        // Combine all slides into a single context
        const allContent = session.slides.map((slide, i) => {
          const note = session.notes[slide.id]
          const enhancedNote = session.enhancedNotes?.[slide.id]
          const transcripts = session.transcripts[slide.id] || []
          
          let text = `[Slide ${i + 1}]`
          if (slide.extractedText) text += ` ${slide.extractedText}`
          if (note?.plainText) text += ` Notes: ${note.plainText}`
          if (enhancedNote?.status === 'complete') text += ` Enhanced: ${enhancedNote.plainText}`
          if (transcripts.length > 0) text += ` Transcript: ${transcripts.map(t => t.text).join(' ')}`
          
          return text
        }).join('\n\n')
        
        return {
          sessionName: session.name,
          totalSlides: session.slides.length,
          slideContent: allContent
        }
      }
      
      case 'all-notes': {
        const allNotes = Object.entries(session.notes)
          .map(([slideId, note]) => {
            const slideIndex = session.slides.findIndex(s => s.id === slideId)
            const enhancedNote = session.enhancedNotes?.[slideId]
            let text = `[Slide ${slideIndex + 1}] ${note.plainText}`
            if (enhancedNote?.status === 'complete') {
              text += ` | Enhanced: ${enhancedNote.plainText}`
            }
            return text
          })
          .join('\n')
        
        return {
          sessionName: session.name,
          userNotes: allNotes
        }
      }
      
      default:
        return {}
    }
  }, [session, context])

  // Convert message history to format expected by prompt builder
  const conversationHistory = useMemo((): ConversationMessage[] => {
    return messages.map(m => ({
      role: m.role,
      content: m.content
    }))
  }, [messages])

  const handleStopGenerating = () => {
    abortRef.current = true
    setIsStreaming(false)
    setIsLoading(false)
  }

  const handleCopy = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(messageId)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      log.error('Failed to copy', err)
    }
  }

  const sendMessage = useCallback(async (userMessage: string, overrideContext?: ContextType) => {
    if (!session || isLoading) return

    setIsLoading(true)
    abortRef.current = false

    // Add user message
    const conversationId = currentConversation?.id || null
    addAIMessage(conversationId, {
      role: 'user',
      content: userMessage,
      slideContext: overrideContext || context,
    })

    // Check if LLM is available
    if (!llmStatus.available) {
      addAIMessage(conversationId || session.aiConversations[session.aiConversations.length - 1]?.id, {
        role: 'assistant',
        content: "I can't generate a response because no AI model is installed. Please go to **Settings → AI Models** to download a model like TinyLlama or Phi-2.",
      })
      setIsLoading(false)
      return
    }

    // Build context and prompts using new system
    const lectureContext = buildLectureContext(overrideContext)
    const truncatedContext = truncateContext(lectureContext, 1500)
    const isFirstMessage = messages.length === 0
    
    const { systemPrompt, userPrompt } = buildChatPrompt({
      userMessage,
      context: truncatedContext,
      conversationHistory: conversationHistory,
      includeExamples: isFirstMessage
    })

    try {
      // Try streaming first
      if (window.electronAPI?.llmGenerateStream && window.electronAPI?.onLLMChunk) {
        setIsStreaming(true)
        
        // Create placeholder message for streaming
        const tempMessageId = `streaming-${Date.now()}`
        addAIMessage(conversationId || session.aiConversations[session.aiConversations.length - 1]?.id, {
          role: 'assistant',
          content: '',
        })
        
        // Get the actual message ID after it was added - read fresh from store to avoid stale closure
        const freshSession = useSessionStore.getState().session
        const updatedConversation = freshSession?.aiConversations[freshSession.aiConversations.length - 1]
        const lastMessage = updatedConversation?.messages[updatedConversation.messages.length - 1]
        const messageId = lastMessage?.id || tempMessageId
        setStreamingMessageId(messageId)
        
        let fullResponse = ''
        
        // Set up streaming listener
        unsubscribeRef.current = window.electronAPI.onLLMChunk((chunk: string) => {
          if (abortRef.current) return
          fullResponse += chunk
          // Update the message content progressively - use fresh state to avoid stale closure
          if (updateAIMessage) {
            const currentSession = useSessionStore.getState().session
            const convId = conversationId ?? currentSession?.aiConversations[currentSession.aiConversations.length - 1]?.id ?? null
            updateAIMessage(convId, messageId, fullResponse)
          }
        })

        try {
          // Start streaming generation with built prompt
          const response = await window.electronAPI.llmGenerateStream({
            prompt: userPrompt,
            systemPrompt,
            maxTokens: 1024,
            temperature: 0.7,
          })

          // Check abort after streaming completes
          if (abortRef.current) return

          // If streaming didn't produce content, use the final response
          if (!fullResponse && response.text) {
            if (updateAIMessage) {
              const currentSession = useSessionStore.getState().session
              const convId = conversationId ?? currentSession?.aiConversations[currentSession.aiConversations.length - 1]?.id ?? null
              updateAIMessage(convId, messageId, response.text)
            }
          }
        } finally {
          // Always cleanup the listener, even on error or abort
          if (unsubscribeRef.current) {
            unsubscribeRef.current()
            unsubscribeRef.current = null
          }
          setStreamingMessageId(null)
          setIsStreaming(false)
        }
      } else {
        // Fallback to non-streaming with built prompt
        const response = await window.electronAPI.llmGenerate({
          prompt: userPrompt,
          systemPrompt,
          maxTokens: 1024,
          temperature: 0.7,
        })

        if (abortRef.current) return

        const currentSession = useSessionStore.getState().session
        addAIMessage(conversationId ?? currentSession?.aiConversations[currentSession.aiConversations.length - 1]?.id ?? null, {
          role: 'assistant',
          content: response.text,
        })
      }
    } catch (err) {
      log.error('LLM generation error', err)
      
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      
      const errSession = useSessionStore.getState().session
      addAIMessage(conversationId ?? errSession?.aiConversations[errSession.aiConversations.length - 1]?.id ?? null, {
        role: 'assistant',
        content: `**Error generating response:** ${errorMessage}\n\nPlease check that the AI model is properly loaded in Settings.`,
      })
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
      setStreamingMessageId(null)
    }
  }, [session, isLoading, currentConversation, context, llmStatus.available, buildLectureContext, conversationHistory, messages, addAIMessage, updateAIMessage])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!input.trim() || !session || isLoading) return

    const userMessage = input.trim()
    setInput('')
    await sendMessage(userMessage)
  }

  const handleQuickAction = (action: typeof QUICK_ACTIONS[number]) => {
    if (isLoading || !session) return
    sendMessage(action.prompt, action.context)
  }

  const contextLabels: Record<ContextType, string> = {
    'current-slide': 'Current Slide',
    'all-slides': 'All Slides',
    'all-notes': 'All Notes',
  }

  // Simple markdown-like rendering
  const renderContent = (content: string) => {
    // Split by code blocks first
    const parts = content.split(/(```[\s\S]*?```)/g)
    
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        // Code block
        const code = part.slice(3, -3)
        const firstNewline = code.indexOf('\n')
        const codeContent = firstNewline > 0 ? code.slice(firstNewline + 1) : code
        
        return (
          <pre key={i} className="bg-zinc-100 rounded-md p-3 overflow-x-auto my-2 text-xs">
            <code>{codeContent}</code>
          </pre>
        )
      }
      
      // Process inline formatting with HTML escaping for security
      return (
        <span key={i}>
          {part.split('\n').map((line, j) => {
            // Escape HTML first to prevent XSS
            let processedLine = line
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;')
            // Bold
            processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            processedLine = processedLine.replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Inline code
            processedLine = processedLine.replace(/`(.*?)`/g, '<code class="bg-zinc-100 px-1 rounded text-xs">$1</code>')
            
            return (
              <span key={j}>
                <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(processedLine) }} />
                {j < part.split('\n').length - 1 && <br />}
              </span>
            )
          })}
        </span>
      )
    })
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div 
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-chat-modal-title"
        className="modal-content max-w-2xl h-[600px] flex flex-col transform transition-all duration-300 ease-out scale-100 opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-zinc-50/50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center shadow-sm ring-1 ring-black/5">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 id="ai-chat-modal-title" className="text-lg font-semibold text-foreground tracking-tight">Ask AI</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                {llmStatus.available ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    Using {llmStatus.modelName || 'Local LLM'}
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    No model installed
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* LLM unavailable banner */}
        {!llmStatus.available && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">No AI model installed. Download one to use AI features.</span>
            </div>
            <button
              onClick={handleOpenSettings}
              className="flex items-center gap-1.5 text-xs font-medium text-amber-900 hover:text-amber-700 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
          </div>
        )}

        {/* Context selector */}
        <div className="px-6 py-3 border-b border-border bg-white">
          <div className="relative">
            <button
              onClick={() => setShowContextMenu(!showContextMenu)}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Context:</span>
              <span className="text-foreground bg-zinc-100 px-2 py-0.5 rounded-md">{contextLabels[context]}</span>
              <ChevronDown className={clsx(
                'w-3.5 h-3.5 transition-transform',
                showContextMenu && 'rotate-180'
              )} />
            </button>

            {showContextMenu && (
              <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-border py-1 z-10 min-w-[160px] animate-fade-in">
                {AI_CONFIG.CONTEXT_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setContext(type)
                      setUIState({ aiChatContext: type })
                      setShowContextMenu(false)
                    }}
                    className={clsx(
                      'w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 transition-colors',
                      context === type ? 'text-foreground font-medium bg-zinc-50' : 'text-muted-foreground'
                    )}
                  >
                    {contextLabels[type]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/30">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-zinc-400" />
              </div>
              <p className="text-foreground font-medium mb-1">Ask about your lecture</p>
              <p className="text-sm text-muted-foreground mb-6">
                Get explanations, quiz yourself, or summarize content.
              </p>
              
              {/* Quick Actions */}
              {llmStatus.available && (
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleQuickAction(action)}
                      disabled={isLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm font-medium text-foreground hover:bg-zinc-50 hover:border-zinc-300 transition-colors shadow-sm"
                    >
                      <action.icon className="w-4 h-4 text-zinc-500" />
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
              
              {!llmStatus.available && (
                <button
                  onClick={handleOpenSettings}
                  className="mt-4 text-sm text-zinc-600 hover:text-zinc-900 underline"
                >
                  Download an AI model to get started
                </button>
              )}
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={clsx(
                  'chat-message shadow-sm group relative',
                  message.role === 'user' ? 'user' : 'assistant'
                )}
              >
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {message.role === 'assistant' ? renderContent(message.content) : message.content}
                </div>
                
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] opacity-50">
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  
                  {message.role === 'assistant' && message.content && (
                    <button
                      onClick={() => handleCopy(message.content, message.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-zinc-200/50 rounded"
                      title="Copy to clipboard"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-zinc-500" />
                      )}
                    </button>
                  )}
                </div>
                
                {/* Streaming indicator */}
                {streamingMessageId === message.id && isStreaming && (
                  <div className="absolute -bottom-1 left-4 w-2 h-2 bg-zinc-400 rounded-full animate-pulse" />
                )}
              </div>
            ))
          )}

          {isLoading && !isStreaming && (
            <div className="chat-message assistant w-fit">
              <div className="flex items-center gap-1.5 px-1">
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-white">
          {isStreaming && (
            <div className="flex justify-center mb-3">
              <button
                type="button"
                onClick={handleStopGenerating}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 hover:bg-zinc-200 rounded-full transition-colors"
              >
                <Square className="w-3 h-3" />
                Stop generating
              </button>
            </div>
          )}
          
          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              placeholder={llmStatus.available 
                ? "Ask a question about your lecture..." 
                : "Download an AI model to ask questions..."}
              className="flex-1 resize-none input min-h-[44px] max-h-[120px] py-3"
              rows={1}
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="btn btn-primary btn-md h-[44px] w-[44px] p-0 flex items-center justify-center rounded-md"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  )
}
