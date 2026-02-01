import { useState, useRef, useCallback, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { AUDIO_CONFIG } from '@shared/constants'
import { createLogger } from '../lib/logger'

const log = createLogger('audio')

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

interface UseAudioReturn {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioLevel: number
  error: string | null
  isTranscribing: boolean
  whisperInfo: WhisperModelInfo | null
  downloadProgress: DownloadProgress | null
  startRecording: () => Promise<void>
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  initWhisper: () => Promise<boolean>
  downloadWhisperModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
  cancelWhisperDownload: () => Promise<void>
  setWhisperModel: (modelName: string) => Promise<boolean>
  refreshWhisperInfo: () => Promise<void>
}

export function useAudio(): UseAudioReturn {
  const { session, setRecording, addTranscriptSegment } = useSessionStore()
  
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [whisperInfo, setWhisperInfo] = useState<WhisperModelInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animationRef = useRef<number | null>(null)
  const unsubscribeProgressRef = useRef<(() => void) | null>(null)

  // Refresh Whisper model info
  const refreshWhisperInfo = useCallback(async () => {
    try {
      if (window.electronAPI?.whisperGetInfo) {
        const info = await window.electronAPI.whisperGetInfo()
        setWhisperInfo(info)
      }
    } catch (err) {
      log.error('Failed to get Whisper info:', err)
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    refreshWhisperInfo()
    
    // Set up download progress listener
    if (window.electronAPI?.onWhisperDownloadProgress) {
      unsubscribeProgressRef.current = window.electronAPI.onWhisperDownloadProgress((progress) => {
        setDownloadProgress(progress)
        if (progress.percent >= 100) {
          setTimeout(() => setDownloadProgress(null), 1000)
          refreshWhisperInfo()
        }
      })
    }

    return () => {
      if (unsubscribeProgressRef.current) {
        unsubscribeProgressRef.current()
      }
    }
  }, [refreshWhisperInfo])

  // Initialize Whisper
  const initWhisper = useCallback(async (): Promise<boolean> => {
    try {
      if (window.electronAPI?.whisperInit) {
        const success = await window.electronAPI.whisperInit()
        await refreshWhisperInfo()
        return success
      }
      return false
    } catch (err) {
      log.error('Failed to init Whisper:', err)
      return false
    }
  }, [refreshWhisperInfo])

  // Download Whisper model
  const downloadWhisperModel = useCallback(async (modelName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setDownloadProgress({ modelName, downloaded: 0, total: 0, percent: 0 })
      
      if (window.electronAPI?.whisperDownloadModel) {
        const result = await window.electronAPI.whisperDownloadModel(modelName)
        if (result.success) {
          await refreshWhisperInfo()
        }
        return result
      }
      return { success: false, error: 'API not available' }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Download failed'
      setDownloadProgress(null)
      return { success: false, error: errorMsg }
    }
  }, [refreshWhisperInfo])

  // Cancel Whisper download
  const cancelWhisperDownload = useCallback(async () => {
    try {
      if (window.electronAPI?.whisperCancelDownload) {
        await window.electronAPI.whisperCancelDownload()
        setDownloadProgress(null)
      }
    } catch (err) {
      log.error('Failed to cancel download:', err)
    }
  }, [])

  // Set Whisper model
  const setWhisperModel = useCallback(async (modelName: string): Promise<boolean> => {
    try {
      if (window.electronAPI?.whisperSetModel) {
        const success = await window.electronAPI.whisperSetModel(modelName)
        await refreshWhisperInfo()
        return success
      }
      return false
    } catch (err) {
      log.error('Failed to set Whisper model:', err)
      return false
    }
  }, [refreshWhisperInfo])

  // Transcribe audio chunk using Whisper
  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
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
      if (result.segments && result.segments.length > 0) {
        for (const segment of result.segments) {
          if (segment.text && segment.text.trim()) {
            addTranscriptSegment(session.slides[session.currentSlideIndex].id, {
              text: segment.text.trim(),
              startTime: segment.start,
              endTime: segment.end,
              confidence: segment.confidence,
            })
          }
        }
      } else if (result.text && result.text.trim()) {
        // Fallback to full text if no segments
        addTranscriptSegment(session.slides[session.currentSlideIndex].id, {
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

  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current && session?.isRecording && !isPaused) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(dataArray)
      
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      setAudioLevel(average / 255)
    }
    
    animationRef.current = requestAnimationFrame(updateAudioLevel)
  }, [session?.isRecording, isPaused])

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
          channelCount: AUDIO_CONFIG.CHANNELS,
        },
      })
      
      streamRef.current = stream

      // Set up audio analysis
      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)

      // Set up media recorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: AUDIO_CONFIG.MIME_TYPE,
      })

      chunksRef.current = []
      let pendingChunks: Blob[] = []

      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
          pendingChunks.push(event.data)
          
          // Transcribe every few chunks (e.g., every 5 seconds worth)
          // AUDIO_CONFIG.CHUNK_INTERVAL_MS is typically 1000ms
          if (pendingChunks.length >= 5 && whisperInfo?.loaded) {
            const audioBlob = new Blob(pendingChunks, { type: AUDIO_CONFIG.MIME_TYPE })
            pendingChunks = []
            // Fire and forget - don't await to avoid blocking recording
            transcribeAudio(audioBlob).catch(log.error)
          }
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        // Final processing when recording stops
        const audioBlob = new Blob(chunksRef.current, { type: AUDIO_CONFIG.MIME_TYPE })
        saveRecording(audioBlob)
        
        // Transcribe any remaining chunks
        if (pendingChunks.length > 0 && whisperInfo?.loaded) {
          const remainingBlob = new Blob(pendingChunks, { type: AUDIO_CONFIG.MIME_TYPE })
          await transcribeAudio(remainingBlob)
        }
      }

      // Start recording
      mediaRecorderRef.current.start(AUDIO_CONFIG.CHUNK_INTERVAL_MS)
      startTimeRef.current = Date.now()
      setRecording(true)
      setIsPaused(false)

      // Start duration counter
      intervalRef.current = setInterval(() => {
        if (!isPaused) {
          setDuration(Date.now() - startTimeRef.current)
        }
      }, 100)

      // Start audio level animation
      updateAudioLevel()

    } catch (err) {
      log.error('Failed to start recording:', err)
      setError('Could not access microphone. Please check permissions.')
    }
  }, [setRecording, isPaused, updateAudioLevel, whisperInfo?.loaded, transcribeAudio])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    setRecording(false)
    setIsPaused(false)
    setAudioLevel(0)
    setDuration(0)
  }, [setRecording])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
    }
  }, [])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
    }
  }, [])

  const saveRecording = async (audioBlob: Blob) => {
    if (!session) return

    const reader = new FileReader()
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1]
      await window.electronAPI.saveAudio(
        session.id,
        base64,
        session.currentSlideIndex
      )
    }
    reader.readAsDataURL(audioBlob)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return {
    isRecording: session?.isRecording || false,
    isPaused,
    duration,
    audioLevel,
    error,
    isTranscribing,
    whisperInfo,
    downloadProgress,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    initWhisper,
    downloadWhisperModel,
    cancelWhisperDownload,
    setWhisperModel,
    refreshWhisperInfo,
  }
}
