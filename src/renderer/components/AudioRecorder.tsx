import { useState, useRef, useEffect, useCallback } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { toast } from '../stores/toastStore'
import { Mic, MicOff, Pause, Play, Square, AlertTriangle, Loader2, MessageSquare, MessageSquareOff } from 'lucide-react'
import { clsx } from 'clsx'
import { AUDIO_CONFIG, TRANSCRIPTION_CONFIG } from '@shared/constants'
import { RECORDING_TOGGLE_EVENT } from '../App'
import { useAccessibility } from '../hooks/useAccessibility'

// Maximum number of audio chunks to queue for transcription
// Prevents memory growth during long recordings or slow transcription
const MAX_TRANSCRIPTION_QUEUE_SIZE = 10

// Number of consecutive failures before showing user warning
const TRANSCRIPTION_FAILURE_THRESHOLD = 3

interface WhisperStatus {
  loaded: boolean
  exists: boolean
  modelName: string
}

export function AudioRecorder() {
  const { session, ui, setRecording, setRecordingStartTime, addTranscriptSegment, addRecordingDuration, setUIState, setSessionPhase } = useSessionStore()
  const { autoDeleteAudio } = useAccessibility()
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [whisperStatus, setWhisperStatus] = useState<WhisperStatus | null>(null)
  const [pendingChunks, setPendingChunks] = useState(0)
  const [lowAudioWarning, setLowAudioWarning] = useState(false)
  const lowAudioCountRef = useRef(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const transcriptionChunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isTranscribingRef = useRef(false)
  const transcriptionQueueRef = useRef<Blob[]>([])
  const transcriptionFailureCountRef = useRef(0)
  const hasShownTranscriptionWarningRef = useRef(false)

  // Ref to track if we should toggle (to avoid stale closure issues)
  const isRecordingRef = useRef(false)
  const autoDeleteAudioRef = useRef(autoDeleteAudio)

  // Keep refs in sync with state
  useEffect(() => {
    isRecordingRef.current = session?.isRecording ?? false
  }, [session?.isRecording])

  useEffect(() => {
    autoDeleteAudioRef.current = autoDeleteAudio
  }, [autoDeleteAudio])

  // Check Whisper status on mount
  useEffect(() => {
    checkWhisperStatus()
  }, [])

  const checkWhisperStatus = async () => {
    try {
      if (window.electronAPI?.whisperGetInfo) {
        const info = await window.electronAPI.whisperGetInfo()
        setWhisperStatus({
          loaded: info.loaded,
          exists: info.exists,
          modelName: info.modelName,
        })
      }
    } catch (err) {
      console.error('Failed to check Whisper status:', err)
    }
  }

  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(dataArray)
      
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      const normalizedLevel = average / 255 // Normalize to 0-1
      setAudioLevel(normalizedLevel)

      // Track low audio levels for warning
      if (normalizedLevel < 0.05) {
        lowAudioCountRef.current++
        // Show warning after 5 seconds of consistently low audio
        if (lowAudioCountRef.current > 300) { // ~5 seconds at 60fps
          setLowAudioWarning(true)
        }
      } else {
        lowAudioCountRef.current = 0
        setLowAudioWarning(false)
      }
    }
    
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
  }, [])

  // Convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // Process audio chunks through Whisper
  const transcribeChunks = useCallback(async (audioBlob: Blob) => {
    if (!session || !window.electronAPI?.whisperTranscribe) return
    if (!whisperStatus?.loaded) {
      // Whisper not loaded, skip transcription silently
      return
    }

    // Prevent concurrent transcriptions - queue if busy
    if (isTranscribingRef.current) {
      // Limit queue size to prevent memory growth
      if (transcriptionQueueRef.current.length >= MAX_TRANSCRIPTION_QUEUE_SIZE) {
        console.warn('Transcription queue full, dropping oldest chunk')
        transcriptionQueueRef.current.shift() // Remove oldest
        setPendingChunks(prev => Math.max(0, prev - 1))
        // Show warning once per recording session about queue overflow
        if (!hasShownTranscriptionWarningRef.current) {
          toast.warning('Transcription Busy', 'Some audio may not be transcribed. Consider pausing recording.')
          hasShownTranscriptionWarningRef.current = true
        }
      }
      transcriptionQueueRef.current.push(audioBlob)
      setPendingChunks(prev => prev + 1)
      return
    }

    isTranscribingRef.current = true
    setIsTranscribing(true)

    try {
      const base64Audio = await blobToBase64(audioBlob)
      const result = await window.electronAPI.whisperTranscribe(base64Audio)

      if (result && result.segments && result.segments.length > 0) {
        const currentSlide = session.slides[session.currentSlideIndex]
        if (!currentSlide) return

        for (const segment of result.segments) {
          // Filter out low confidence and empty segments
          if (!segment.text || !segment.text.trim()) continue
          if (segment.confidence < TRANSCRIPTION_CONFIG.CONFIDENCE_THRESHOLD) continue
          
          // Also filter out placeholder messages from Whisper
          const text = segment.text.trim()
          if (text.startsWith('[') && text.endsWith(']')) continue

          const elapsedTime = Date.now() - startTimeRef.current

          addTranscriptSegment(currentSlide.id, {
            text,
            startTime: elapsedTime - (segment.end - segment.start),
            endTime: elapsedTime,
            confidence: segment.confidence,
          })
        }
      } else if (result && result.text && result.text.trim()) {
        // Fallback to full text if no segments
        const text = result.text.trim()
        
        // Filter placeholder messages
        if (!text.startsWith('[') || !text.endsWith(']')) {
          const currentSlide = session.slides[session.currentSlideIndex]
          if (currentSlide) {
            const elapsedTime = Date.now() - startTimeRef.current

            addTranscriptSegment(currentSlide.id, {
              text,
              startTime: Math.max(0, elapsedTime - 5000),
              endTime: elapsedTime,
              confidence: 0.8, // Default confidence for non-segment results
            })
          }
        }
      }
      // Reset failure counter on successful transcription
      transcriptionFailureCountRef.current = 0
    } catch (err) {
      console.error('Transcription error:', err)
      // Track consecutive failures
      transcriptionFailureCountRef.current++

      // Show warning after multiple consecutive failures (not every time to avoid spam)
      if (transcriptionFailureCountRef.current === TRANSCRIPTION_FAILURE_THRESHOLD && !hasShownTranscriptionWarningRef.current) {
        toast.warning(
          'Transcription Issues',
          'Having trouble transcribing audio. Check Settings for model status.'
        )
        hasShownTranscriptionWarningRef.current = true
      }
    } finally {
      isTranscribingRef.current = false
      setIsTranscribing(false)

      // Process queued chunks
      if (transcriptionQueueRef.current.length > 0) {
        const nextBlob = transcriptionQueueRef.current.shift()!
        setPendingChunks(prev => Math.max(0, prev - 1))
        transcribeChunks(nextBlob)
      }
    }
  }, [session, whisperStatus?.loaded, addTranscriptSegment])

  const startRecording = async () => {
    try {
      setError(null)

      // Reset transcription tracking for new recording
      transcriptionFailureCountRef.current = 0
      hasShownTranscriptionWarningRef.current = false

      // Check Whisper status first
      await checkWhisperStatus()
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
          channelCount: AUDIO_CONFIG.CHANNELS,
        }
      })

      streamRef.current = stream

      // Set up audio analysis for visualization
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
      transcriptionChunksRef.current = []
      transcriptionQueueRef.current = []
      setPendingChunks(0)

      mediaRecorderRef.current.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
          transcriptionChunksRef.current.push(event.data)
          
          // Accumulate ~5 seconds of audio before transcribing
          // CHUNK_INTERVAL_MS is typically 1000ms, so 5 chunks = 5 seconds
          if (transcriptionChunksRef.current.length >= 5) {
            const audioBlob = new Blob(transcriptionChunksRef.current, { type: AUDIO_CONFIG.MIME_TYPE })
            transcriptionChunksRef.current = []
            
            // Fire and forget - don't await to avoid blocking recording
            transcribeChunks(audioBlob).catch(console.error)
          }
        }
      }

      mediaRecorderRef.current.onstop = async () => {
        // Save full audio file
        const audioBlob = new Blob(chunksRef.current, { type: AUDIO_CONFIG.MIME_TYPE })
        const currentSlideIndex = session?.currentSlideIndex ?? 0
        const currentSessionId = session?.id
        
        if (currentSessionId) {
          const base64 = await blobToBase64(audioBlob)
          await window.electronAPI.saveAudio(
            currentSessionId, 
            base64, 
            currentSlideIndex
          )
        }

        // Transcribe any remaining chunks
        if (transcriptionChunksRef.current.length > 0) {
          const remainingBlob = new Blob(transcriptionChunksRef.current, { type: AUDIO_CONFIG.MIME_TYPE })
          transcriptionChunksRef.current = []
          await transcribeChunks(remainingBlob)
        }

        // Auto-delete audio after transcription if setting is enabled
        if (autoDeleteAudioRef.current && currentSessionId) {
          try {
            await window.electronAPI.deleteAudio(currentSessionId, currentSlideIndex)
            console.log('Audio file auto-deleted after transcription')
          } catch (err) {
            console.error('Failed to auto-delete audio:', err)
          }
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      // Start recording with intervals for chunked processing
      mediaRecorderRef.current.start(AUDIO_CONFIG.CHUNK_INTERVAL_MS)
      
      startTimeRef.current = Date.now()
      setRecording(true)
      setRecordingStartTime(startTimeRef.current)
      setIsPaused(false)

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        setDuration(Date.now() - startTimeRef.current)
      }, 100)

      // Start audio level animation
      updateAudioLevel()

    } catch (err) {
      console.error('Failed to start recording:', err)
      
      // Provide helpful error messages based on error type
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Microphone access denied. Please grant permission in System Preferences.')
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No microphone found. Please connect a microphone.')
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Microphone is in use by another application.')
        } else {
          setError(`Microphone error: ${err.message}`)
        }
      } else {
        setError('Could not access microphone. Please check permissions.')
      }
    }
  }

  const stopRecording = () => {
    // Calculate recording duration before stopping
    const recordedDuration = duration

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }

    setRecording(false)
    setRecordingStartTime(null)
    setIsPaused(false)
    setAudioLevel(0)
    setLowAudioWarning(false)
    lowAudioCountRef.current = 0

    // Track recording duration
    if (recordedDuration > 0) {
      addRecordingDuration(recordedDuration)
    }

    // Show feedback modal if recording was substantial (> 30 seconds)
    // and user hasn't already given feedback for this session
    if (recordedDuration > 30000 && session && !session.feedback) {
      setTimeout(() => {
        setUIState({ showFeedbackModal: true })
      }, 500) // Small delay for smoother UX
    }

    // Transition to ready_to_enhance after a short processing delay
    setTimeout(() => {
      setSessionPhase('ready_to_enhance')
    }, 1500) // Give time for final transcription chunks
  }

  const togglePause = () => {
    if (!mediaRecorderRef.current) return

    if (isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
    } else {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Listen for keyboard shortcut toggle event from App
  useEffect(() => {
    const handleToggleRecording = () => {
      if (isRecordingRef.current) {
        stopRecording()
      } else {
        startRecording()
      }
    }

    window.addEventListener(RECORDING_TOGGLE_EVENT, handleToggleRecording)
    return () => window.removeEventListener(RECORDING_TOGGLE_EVENT, handleToggleRecording)
  }, []) // Empty deps since we use refs for current values

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`
  }

  if (!session || session.slides.length === 0) {
    return null
  }

  const showWhisperWarning = !whisperStatus?.loaded && !whisperStatus?.exists

  return (
    <div className="mt-3 flex items-center justify-center gap-4 bg-white/80 backdrop-blur-md p-2 rounded-full border border-white/20 shadow-lg ring-1 ring-black/5 inline-flex mx-auto relative transition-all duration-300 hover:shadow-xl hover:scale-[1.01]">
      {/* Whisper not loaded warning */}
      {showWhisperWarning && !session.isRecording && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-amber-50 text-amber-700 text-xs px-3 py-2 rounded-md flex items-center gap-2 border border-amber-200 shadow-sm whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Whisper not loaded. Transcription unavailable.</span>
        </div>
      )}

      {/* Low audio warning */}
      {session.isRecording && lowAudioWarning && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-amber-50 text-amber-700 text-xs px-3 py-2 rounded-md flex items-center gap-2 border border-amber-200 shadow-sm whitespace-nowrap animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Low audio level. Move closer to the speaker or check your microphone.</span>
        </div>
      )}

      {/* Audio level visualization */}
      {session.isRecording && (
        <div className="flex items-center gap-0.5 h-6 px-2">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="w-0.5 bg-zinc-900 rounded-full transition-all duration-75"
              style={{
                height: `${Math.max(4, audioLevel * 24 * (1 + Math.random() * 0.5))}px`,
                opacity: audioLevel > i * 0.1 ? 1 : 0.2,
              }}
            />
          ))}
        </div>
      )}

      {/* Transcription indicator */}
      {session.isRecording && (isTranscribing || pendingChunks > 0) && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
        </div>
      )}

      {/* Screen reader announcements for transcription status */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      >
        {session.isRecording && isTranscribing && 'Transcribing audio...'}
        {session.isRecording && !isTranscribing && pendingChunks > 0 && `${pendingChunks} audio chunks pending transcription`}
      </div>

      {/* Main record button */}
      <button
        onClick={session.isRecording ? stopRecording : startRecording}
        className={clsx(
          'btn-record p-3 transition-all duration-300 transform',
          session.isRecording 
            ? 'recording bg-red-500 hover:bg-red-600 scale-110' 
            : 'hover:scale-105 active:scale-95'
        )}
        title={session.isRecording ? 'Stop recording' : 'Start recording (R)'}
      >
        {session.isRecording ? (
          <Square className="w-4 h-4 fill-current" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>

      {/* Pause/Resume button */}
      {session.isRecording && (
        <button
          onClick={togglePause}
          className="btn btn-secondary btn-sm rounded-full w-8 h-8 p-0 flex items-center justify-center"
          title={isPaused ? 'Resume' : 'Pause'}
        >
          {isPaused ? (
            <Play className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Pause className="w-3.5 h-3.5 fill-current" />
          )}
        </button>
      )}

      {/* Duration display */}
      {session.isRecording && (
        <span className={clsx(
          'text-xs font-mono font-medium px-2',
          isPaused ? 'text-muted-foreground' : 'text-foreground'
        )}>
          {formatDuration(duration)}
        </span>
      )}

      {/* Whisper status indicator */}
      {session.isRecording && whisperStatus && (
        <div 
          className={clsx(
            'w-2 h-2 rounded-full',
            whisperStatus.loaded ? 'bg-green-500' : 'bg-amber-500'
          )}
          title={whisperStatus.loaded ? `Whisper: ${whisperStatus.modelName}` : 'Whisper not loaded'}
        />
      )}

      {/* Toggle live transcript button */}
      {session.isRecording && (
        <button
          onClick={() => setUIState({ showLiveTranscript: !ui.showLiveTranscript })}
          className={clsx(
            'btn btn-sm rounded-full w-8 h-8 p-0 flex items-center justify-center transition-colors',
            ui.showLiveTranscript 
              ? 'btn-secondary bg-zinc-200' 
              : 'btn-ghost hover:bg-zinc-100'
          )}
          title={ui.showLiveTranscript ? 'Hide live transcript' : 'Show live transcript'}
        >
          {ui.showLiveTranscript ? (
            <MessageSquare className="w-3.5 h-3.5" />
          ) : (
            <MessageSquareOff className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-md flex items-center gap-2 border border-red-100 shadow-sm whitespace-nowrap max-w-xs">
          <MicOff className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{error}</span>
          <button 
            onClick={() => setError(null)}
            className="ml-1 text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

// Note: transcribeAudioFile has been moved to src/renderer/lib/transcription.ts
// to enable React Fast Refresh for this component
