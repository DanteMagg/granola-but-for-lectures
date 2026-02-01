/**
 * useAudio Hook
 * Composes useRecording and useWhisper for backwards compatibility
 * New code should use useRecording and useWhisper directly for better separation
 */
import { useCallback } from 'react'
import { useRecording } from './useRecording'
import { useWhisper } from './useWhisper'
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
  // Use the separated hooks
  const whisper = useWhisper()
  
  // Handle audio chunks with transcription
  const handleAudioChunk = useCallback((audioBlob: Blob) => {
    if (whisper.isModelLoaded) {
      whisper.transcribe(audioBlob).catch(log.error)
    }
  }, [whisper])

  const recording = useRecording({
    onAudioChunk: handleAudioChunk,
    chunkBatchSize: 5,
  })

  return {
    // Recording state
    isRecording: recording.isRecording,
    isPaused: recording.isPaused,
    duration: recording.duration,
    audioLevel: recording.audioLevel,
    error: recording.error,
    
    // Recording actions
    startRecording: recording.startRecording,
    stopRecording: recording.stopRecording,
    pauseRecording: recording.pauseRecording,
    resumeRecording: recording.resumeRecording,
    
    // Whisper state
    isTranscribing: whisper.isTranscribing,
    whisperInfo: whisper.modelInfo,
    downloadProgress: whisper.downloadProgress,
    
    // Whisper actions
    initWhisper: whisper.initModel,
    downloadWhisperModel: whisper.downloadModel,
    cancelWhisperDownload: whisper.cancelDownload,
    setWhisperModel: whisper.setModel,
    refreshWhisperInfo: whisper.refreshModelInfo,
  }
}
