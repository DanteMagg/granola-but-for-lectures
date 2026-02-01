/**
 * useWhisper Hook
 * Handles Whisper model management and transcription
 * Separated from recording for better separation of concerns
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { createLogger } from '../lib/logger'

const log = createLogger('whisper')

interface WhisperModelInfo {
  loaded: boolean
  modelPath: string
  modelName: string
  exists: boolean
  language: string
  availableModels: Array<{
    name: string
    size: string
    downloaded: boolean
  }>
}

interface DownloadProgress {
  modelName: string
  downloaded: number
  total: number
  percent: number
}

interface UseWhisperReturn {
  // Model state
  modelInfo: WhisperModelInfo | null
  isModelLoaded: boolean
  downloadProgress: DownloadProgress | null
  
  // Transcription state
  isTranscribing: boolean
  
  // Model management
  initModel: () => Promise<boolean>
  downloadModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
  cancelDownload: () => Promise<void>
  setModel: (modelName: string) => Promise<boolean>
  refreshModelInfo: () => Promise<void>
  
  // Transcription
  transcribe: (audioBlob: Blob) => Promise<void>
  transcribeBase64: (audioBase64: string) => Promise<TranscriptionResult | null>
}

interface TranscriptionResult {
  text: string
  segments: Array<{
    start: number
    end: number
    text: string
    confidence: number
  }>
}

export function useWhisper(): UseWhisperReturn {
  const { session, addTranscriptSegment } = useSessionStore()
  
  const [modelInfo, setModelInfo] = useState<WhisperModelInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  
  const unsubscribeProgressRef = useRef<(() => void) | null>(null)
  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refresh model info
  const refreshModelInfo = useCallback(async () => {
    try {
      if (window.electronAPI?.whisperGetInfo) {
        const info = await window.electronAPI.whisperGetInfo()
        setModelInfo(info)
      }
    } catch (err) {
      log.error('Failed to get Whisper info:', err)
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    refreshModelInfo()
    
    // Set up download progress listener
    if (window.electronAPI?.onWhisperDownloadProgress) {
      unsubscribeProgressRef.current = window.electronAPI.onWhisperDownloadProgress((progress) => {
        setDownloadProgress(progress)
        if (progress.percent >= 100) {
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
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current)
      }
    }
  }, [refreshModelInfo])

  // Initialize model
  const initModel = useCallback(async (): Promise<boolean> => {
    try {
      if (window.electronAPI?.whisperInit) {
        const success = await window.electronAPI.whisperInit()
        await refreshModelInfo()
        return success
      }
      return false
    } catch (err) {
      log.error('Failed to init Whisper:', err)
      return false
    }
  }, [refreshModelInfo])

  // Download model
  const downloadModel = useCallback(async (modelName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setDownloadProgress({ modelName, downloaded: 0, total: 0, percent: 0 })
      
      if (window.electronAPI?.whisperDownloadModel) {
        const result = await window.electronAPI.whisperDownloadModel(modelName)
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
      if (window.electronAPI?.whisperCancelDownload) {
        await window.electronAPI.whisperCancelDownload()
        setDownloadProgress(null)
      }
    } catch (err) {
      log.error('Failed to cancel download:', err)
    }
  }, [])

  // Set model
  const setModel = useCallback(async (modelName: string): Promise<boolean> => {
    try {
      if (window.electronAPI?.whisperSetModel) {
        const success = await window.electronAPI.whisperSetModel(modelName)
        await refreshModelInfo()
        return success
      }
      return false
    } catch (err) {
      log.error('Failed to set Whisper model:', err)
      return false
    }
  }, [refreshModelInfo])

  // Transcribe base64 audio (raw API)
  const transcribeBase64 = useCallback(async (audioBase64: string): Promise<TranscriptionResult | null> => {
    if (!window.electronAPI?.whisperTranscribe) {
      return null
    }

    try {
      return await window.electronAPI.whisperTranscribe(audioBase64)
    } catch (err) {
      log.error('Transcription error:', err)
      return null
    }
  }, [])

  // Transcribe audio blob and add to session
  const transcribe = useCallback(async (audioBlob: Blob) => {
    if (!session || !window.electronAPI?.whisperTranscribe) return

    setIsTranscribing(true)
    try {
      // Convert blob to base64
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string
          const base64 = result.split(',')[1]
          resolve(base64)
        }
        reader.onerror = reject
      })
      reader.readAsDataURL(audioBlob)
      
      const base64 = await base64Promise
      const result = await window.electronAPI.whisperTranscribe(base64)
      
      // Add transcription segments to the session
      const now = Date.now()
      const currentSlide = session.slides[session.currentSlideIndex]
      
      if (!currentSlide) return
      
      if (result.segments && result.segments.length > 0) {
        for (const segment of result.segments) {
          if (segment.text && segment.text.trim()) {
            addTranscriptSegment(currentSlide.id, {
              text: segment.text.trim(),
              startTime: segment.start,
              endTime: segment.end,
              confidence: segment.confidence,
            })
          }
        }
      } else if (result.text && result.text.trim()) {
        // Fallback to full text if no segments
        addTranscriptSegment(currentSlide.id, {
          text: result.text.trim(),
          startTime: now - 5000,
          endTime: now,
          confidence: 0.9,
        })
      }
    } catch (err) {
      log.error('Transcription error:', err)
    } finally {
      setIsTranscribing(false)
    }
  }, [session, addTranscriptSegment])

  return {
    modelInfo,
    isModelLoaded: modelInfo?.loaded ?? false,
    downloadProgress,
    isTranscribing,
    initModel,
    downloadModel,
    cancelDownload,
    setModel,
    refreshModelInfo,
    transcribe,
    transcribeBase64,
  }
}

