declare module 'whisper-node' {
  interface WhisperOptions {
    modelName?: string
    modelPath?: string
    whisperOptions?: {
      language?: string
      word_timestamps?: boolean
      gen_file_txt?: boolean
      gen_file_subtitle?: boolean
      gen_file_vtt?: boolean
    }
  }

  interface WhisperSegment {
    start?: number
    end?: number
    speech?: string
    text?: string
    confidence?: number
  }

  type WhisperResult = WhisperSegment[] | string | { text?: string; transcription?: string }

  function whisper(filePath: string, options?: WhisperOptions): Promise<WhisperResult>

  export default whisper
}
