import { useState, useCallback, useEffect, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { createLogger } from '../lib/logger'

const log = createLogger('localAI')

interface LLMModelInfo {
  loaded: boolean
  modelPath: string
  modelName: string
  exists: boolean
  contextLength: number
  availableModels: Array<{
    name: string
    size: string
    contextLength: number
    downloaded: boolean
  }>
}

interface DownloadProgress {
  modelName: string
  downloaded: number
  total: number
  percent: number
}

interface UseLocalAIReturn {
  isLoading: boolean
  error: string | null
  modelInfo: LLMModelInfo | null
  isModelLoaded: boolean
  downloadProgress: DownloadProgress | null
  sendMessage: (message: string, context?: string) => Promise<string>
  sendMessageStream: (message: string, context?: string, onChunk?: (chunk: string) => void) => Promise<string>
  initModel: () => Promise<boolean>
  downloadModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
  cancelDownload: () => Promise<void>
  setModel: (modelName: string) => Promise<boolean>
  refreshModelInfo: () => Promise<void>
}

export function useLocalAI(): UseLocalAIReturn {
  const { session } = useSessionStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modelInfo, setModelInfo] = useState<LLMModelInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const unsubscribeProgressRef = useRef<(() => void) | null>(null)
  const unsubscribeChunkRef = useRef<(() => void) | null>(null)
  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Get context from current slide
  const getSlideContext = useCallback(() => {
    if (!session) return ''
    
    const slide = session.slides[session.currentSlideIndex]
    if (!slide) return ''
    
    let context = `Current Slide ${session.currentSlideIndex + 1}:\n`
    
    if (slide.extractedText) {
      context += `Text: ${slide.extractedText}\n`
    }
    
    const note = session.notes[slide.id]
    if (note?.plainText) {
      context += `Notes: ${note.plainText}\n`
    }
    
    const transcripts = session.transcripts[slide.id]
    if (transcripts?.length) {
      context += `Transcript: ${transcripts.map(t => t.text).join(' ')}\n`
    }
    
    return context
  }, [session])

  // Refresh model info
  const refreshModelInfo = useCallback(async () => {
    try {
      if (window.electronAPI?.llmGetInfo) {
        const info = await window.electronAPI.llmGetInfo()
        setModelInfo(info)
      }
    } catch (err) {
      log.error('Failed to get LLM info:', err)
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    refreshModelInfo()
    
    // Set up download progress listener
    if (window.electronAPI?.onLLMDownloadProgress) {
      unsubscribeProgressRef.current = window.electronAPI.onLLMDownloadProgress((progress) => {
        setDownloadProgress(progress)
        if (progress.percent >= 100) {
          // Clear progress after completion
          if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current)
          progressTimeoutRef.current = setTimeout(() => setDownloadProgress(null), 1000)
          refreshModelInfo()
        }
      })
    }

    return () => {
      if (unsubscribeProgressRef.current) {
        unsubscribeProgressRef.current()
      }
      if (unsubscribeChunkRef.current) {
        unsubscribeChunkRef.current()
      }
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current)
      }
    }
  }, [refreshModelInfo])

  // Initialize model
  const initModel = useCallback(async (): Promise<boolean> => {
    try {
      if (window.electronAPI?.llmInit) {
        const success = await window.electronAPI.llmInit()
        await refreshModelInfo()
        return success
      }
      return false
    } catch (err) {
      log.error('Failed to init LLM:', err)
      return false
    }
  }, [refreshModelInfo])

  // Download model
  const downloadModel = useCallback(async (modelName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setDownloadProgress({ modelName, downloaded: 0, total: 0, percent: 0 })
      
      if (window.electronAPI?.llmDownloadModel) {
        const result = await window.electronAPI.llmDownloadModel(modelName)
        if (result.success) {
          await refreshModelInfo()
        }
        return result
      }
      return { success: false, error: 'API not available' }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Download failed'
      setDownloadProgress(null)
      return { success: false, error: errorMsg }
    }
  }, [refreshModelInfo])

  // Cancel download
  const cancelDownload = useCallback(async () => {
    try {
      if (window.electronAPI?.llmCancelDownload) {
        await window.electronAPI.llmCancelDownload()
        setDownloadProgress(null)
      }
    } catch (err) {
      log.error('Failed to cancel download:', err)
    }
  }, [])

  // Set model
  const setModel = useCallback(async (modelName: string): Promise<boolean> => {
    try {
      if (window.electronAPI?.llmSetModel) {
        const success = await window.electronAPI.llmSetModel(modelName)
        await refreshModelInfo()
        return success
      }
      return false
    } catch (err) {
      log.error('Failed to set model:', err)
      return false
    }
  }, [refreshModelInfo])

  // Send message (non-streaming)
  const sendMessage = useCallback(async (message: string, providedContext?: string): Promise<string> => {
    setIsLoading(true)
    setError(null)

    try {
      const context = providedContext || getSlideContext()
      
      if (window.electronAPI?.llmGenerate) {
        const response = await window.electronAPI.llmGenerate({
          prompt: message,
          context: context || undefined,
        })
        
        setIsLoading(false)
        
        if (response.finishReason === 'error') {
          throw new Error(response.text)
        }
        
        return response.text
      }
      
      // Fallback if API not available
      setIsLoading(false)
      return 'LLM API not available. Please ensure the app is running in Electron.'
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'AI request failed'
      setError(errorMsg)
      setIsLoading(false)
      throw err
    }
  }, [getSlideContext])

  // Send message with streaming
  const sendMessageStream = useCallback(async (
    message: string, 
    providedContext?: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> => {
    setIsLoading(true)
    setError(null)

    try {
      const context = providedContext || getSlideContext()
      
      // Set up chunk listener
      if (onChunk && window.electronAPI?.onLLMChunk) {
        // Clean up previous listener
        if (unsubscribeChunkRef.current) {
          unsubscribeChunkRef.current()
        }
        unsubscribeChunkRef.current = window.electronAPI.onLLMChunk(onChunk)
      }
      
      if (window.electronAPI?.llmGenerateStream) {
        const response = await window.electronAPI.llmGenerateStream({
          prompt: message,
          context: context || undefined,
        })
        
        setIsLoading(false)
        
        // Clean up chunk listener
        if (unsubscribeChunkRef.current) {
          unsubscribeChunkRef.current()
          unsubscribeChunkRef.current = null
        }
        
        if (response.finishReason === 'error') {
          throw new Error(response.text)
        }
        
        return response.text
      }
      
      // Fallback to non-streaming
      return sendMessage(message, providedContext)
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'AI request failed'
      setError(errorMsg)
      setIsLoading(false)
      
      // Clean up chunk listener
      if (unsubscribeChunkRef.current) {
        unsubscribeChunkRef.current()
        unsubscribeChunkRef.current = null
      }
      
      throw err
    }
  }, [getSlideContext, sendMessage])

  return {
    isLoading,
    error,
    modelInfo,
    isModelLoaded: modelInfo?.loaded ?? false,
    downloadProgress,
    sendMessage,
    sendMessageStream,
    initModel,
    downloadModel,
    cancelDownload,
    setModel,
    refreshModelInfo,
  }
}
