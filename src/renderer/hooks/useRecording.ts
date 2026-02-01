/**
 * useRecording Hook
 * Handles audio recording state and media stream management
 * Separated from transcription for better separation of concerns
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { AUDIO_CONFIG } from '@shared/constants'
import { createLogger } from '../lib/logger'

const log = createLogger('recording')

interface UseRecordingOptions {
  // Callback when audio chunks are available for transcription
  onAudioChunk?: (audioBlob: Blob) => void
  // Callback when recording stops with final audio
  onRecordingComplete?: (audioBlob: Blob) => void
  // How many chunks to accumulate before calling onAudioChunk (default: 5)
  chunkBatchSize?: number
}

interface UseRecordingReturn {
  isRecording: boolean
  isPaused: boolean
  duration: number
  audioLevel: number
  error: string | null
  startRecording: () => Promise<void>
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
}

export function useRecording(options: UseRecordingOptions = {}): UseRecordingReturn {
  const { onAudioChunk, onRecordingComplete, chunkBatchSize = 5 } = options
  const { session, setRecording, addRecordingDuration } = useSessionStore()
  
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const pendingChunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const animationRef = useRef<number | null>(null)
  const isPausedRef = useRef(false)
  const callbacksRef = useRef({ onAudioChunk, onRecordingComplete })

  // Keep refs in sync
  useEffect(() => {
    isPausedRef.current = isPaused
    callbacksRef.current = { onAudioChunk, onRecordingComplete }
  }, [isPaused, onAudioChunk, onRecordingComplete])

  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current && session?.isRecording && !isPausedRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(dataArray)
      
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      setAudioLevel(average / 255)
    }
    
    animationRef.current = requestAnimationFrame(updateAudioLevel)
  }, [session?.isRecording])

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
      pendingChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
          pendingChunksRef.current.push(event.data)
          
          // Batch chunks for transcription callback
          if (pendingChunksRef.current.length >= chunkBatchSize && callbacksRef.current.onAudioChunk) {
            const audioBlob = new Blob(pendingChunksRef.current, { type: AUDIO_CONFIG.MIME_TYPE })
            pendingChunksRef.current = []
            callbacksRef.current.onAudioChunk(audioBlob)
          }
        }
      }

      mediaRecorderRef.current.onstop = () => {
        // Final processing when recording stops
        const audioBlob = new Blob(chunksRef.current, { type: AUDIO_CONFIG.MIME_TYPE })
        
        // Save recording
        saveRecording(audioBlob)
        
        // Call completion callback with any remaining chunks
        if (callbacksRef.current.onRecordingComplete) {
          if (pendingChunksRef.current.length > 0) {
            const remainingBlob = new Blob(pendingChunksRef.current, { type: AUDIO_CONFIG.MIME_TYPE })
            callbacksRef.current.onAudioChunk?.(remainingBlob)
          }
          callbacksRef.current.onRecordingComplete(audioBlob)
        }
        
        // Track recording duration
        const recordingDuration = Date.now() - startTimeRef.current
        addRecordingDuration(recordingDuration)
      }

      // Start recording
      mediaRecorderRef.current.start(AUDIO_CONFIG.CHUNK_INTERVAL_MS)
      startTimeRef.current = Date.now()
      setRecording(true)
      setIsPaused(false)

      // Start duration counter
      intervalRef.current = setInterval(() => {
        if (!isPausedRef.current) {
          setDuration(Date.now() - startTimeRef.current)
        }
      }, 100)

      // Start audio level animation
      updateAudioLevel()

    } catch (err) {
      log.error('Failed to start recording:', err)
      setError('Could not access microphone. Please check permissions.')
    }
  }, [setRecording, updateAudioLevel, chunkBatchSize, addRecordingDuration])

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
    reader.onerror = () => {
      log.error('Failed to read audio blob for saving')
    }
    reader.onloadend = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1]
        await window.electronAPI.saveAudio(
          session.id,
          base64,
          session.currentSlideIndex
        )
      } catch (err) {
        log.error('Failed to save audio recording:', err)
      }
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
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  }
}

