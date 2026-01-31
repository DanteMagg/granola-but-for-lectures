import { useState, useEffect, useRef } from 'react'
import { X, Download, HardDrive, Cpu, Mic, Trash2, CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import { clsx } from 'clsx'

interface SettingsModalProps {
  onClose: () => void
}

interface WhisperModelInfo {
  loaded: boolean
  exists: boolean
  modelPath: string
  modelName: string
  language: string
  availableModels: Array<{
    name: string
    size: string
    downloaded: boolean
  }>
}

interface LLMModelInfo {
  loaded: boolean
  exists: boolean
  modelPath: string
  modelName: string
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

interface DownloadState {
  isDownloading: boolean
  progress: number
  modelName: string
  error: string | null
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [whisperInfo, setWhisperInfo] = useState<WhisperModelInfo | null>(null)
  const [llmInfo, setLlmInfo] = useState<LLMModelInfo | null>(null)
  const [activeTab, setActiveTab] = useState<'models' | 'storage' | 'about'>('models')
  
  const [whisperDownload, setWhisperDownload] = useState<DownloadState>({
    isDownloading: false,
    progress: 0,
    modelName: '',
    error: null
  })
  
  const [llmDownload, setLlmDownload] = useState<DownloadState>({
    isDownloading: false,
    progress: 0,
    modelName: '',
    error: null
  })

  const [selectedWhisperModel, setSelectedWhisperModel] = useState('small')
  const [selectedLlmModel, setSelectedLlmModel] = useState('tinyllama-1.1b')

  const unsubWhisperRef = useRef<(() => void) | null>(null)
  const unsubLlmRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    loadModelInfo()

    // Set up download progress listeners
    if (window.electronAPI?.onWhisperDownloadProgress) {
      unsubWhisperRef.current = window.electronAPI.onWhisperDownloadProgress((progress: DownloadProgress) => {
        setWhisperDownload(prev => ({
          ...prev,
          isDownloading: progress.percent < 100,
          progress: progress.percent,
          modelName: progress.modelName,
        }))
        if (progress.percent >= 100) {
          setTimeout(() => {
            setWhisperDownload(prev => ({ ...prev, isDownloading: false }))
            loadModelInfo()
          }, 500)
        }
      })
    }

    if (window.electronAPI?.onLLMDownloadProgress) {
      unsubLlmRef.current = window.electronAPI.onLLMDownloadProgress((progress: DownloadProgress) => {
        setLlmDownload(prev => ({
          ...prev,
          isDownloading: progress.percent < 100,
          progress: progress.percent,
          modelName: progress.modelName,
        }))
        if (progress.percent >= 100) {
          setTimeout(() => {
            setLlmDownload(prev => ({ ...prev, isDownloading: false }))
            loadModelInfo()
          }, 500)
        }
      })
    }

    return () => {
      if (unsubWhisperRef.current) unsubWhisperRef.current()
      if (unsubLlmRef.current) unsubLlmRef.current()
    }
  }, [])

  const loadModelInfo = async () => {
    try {
      if (window.electronAPI?.whisperGetInfo) {
        const wInfo = await window.electronAPI.whisperGetInfo()
        setWhisperInfo(wInfo)
        if (wInfo?.modelName) setSelectedWhisperModel(wInfo.modelName)
      }
      if (window.electronAPI?.llmGetInfo) {
        const lInfo = await window.electronAPI.llmGetInfo()
        setLlmInfo(lInfo)
        if (lInfo?.modelName) setSelectedLlmModel(lInfo.modelName)
      }
    } catch (err) {
      console.error('Failed to load model info:', err)
    }
  }

  const handleDownloadWhisper = async () => {
    try {
      setWhisperDownload({ isDownloading: true, progress: 0, modelName: selectedWhisperModel, error: null })
      const result = await window.electronAPI.whisperDownloadModel(selectedWhisperModel)
      if (!result.success) {
        setWhisperDownload(prev => ({ 
          ...prev, 
          isDownloading: false, 
          error: result.error || 'Download failed' 
        }))
      } else {
        loadModelInfo()
      }
    } catch (err) {
      setWhisperDownload(prev => ({ 
        ...prev,
        isDownloading: false, 
        error: err instanceof Error ? err.message : 'Download failed' 
      }))
    }
  }

  const handleCancelWhisperDownload = async () => {
    try {
      await window.electronAPI.whisperCancelDownload()
      setWhisperDownload({ isDownloading: false, progress: 0, modelName: '', error: null })
    } catch (err) {
      console.error('Failed to cancel download:', err)
    }
  }

  const handleDownloadLlm = async () => {
    try {
      setLlmDownload({ isDownloading: true, progress: 0, modelName: selectedLlmModel, error: null })
      const result = await window.electronAPI.llmDownloadModel(selectedLlmModel)
      if (!result.success) {
        setLlmDownload(prev => ({ 
          ...prev, 
          isDownloading: false, 
          error: result.error || 'Download failed' 
        }))
      } else {
        loadModelInfo()
      }
    } catch (err) {
      setLlmDownload(prev => ({ 
        ...prev,
        isDownloading: false, 
        error: err instanceof Error ? err.message : 'Download failed' 
      }))
    }
  }

  const handleCancelLlmDownload = async () => {
    try {
      await window.electronAPI.llmCancelDownload()
      setLlmDownload({ isDownloading: false, progress: 0, modelName: '', error: null })
    } catch (err) {
      console.error('Failed to cancel download:', err)
    }
  }

  const handleInitWhisper = async () => {
    try {
      await window.electronAPI.whisperInit()
      loadModelInfo()
    } catch (err) {
      console.error('Failed to init Whisper:', err)
    }
  }

  const handleInitLlm = async () => {
    try {
      await window.electronAPI.llmInit()
      loadModelInfo()
    } catch (err) {
      console.error('Failed to init LLM:', err)
    }
  }

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const tabs = [
    { id: 'models', label: 'AI Models', icon: Cpu },
    { id: 'storage', label: 'Storage', icon: HardDrive },
    { id: 'about', label: 'About', icon: null },
  ] as const

  // Get available models from info or use defaults
  const whisperModels = whisperInfo?.availableModels || [
    { name: 'tiny', size: '75 MB', downloaded: false },
    { name: 'tiny.en', size: '75 MB', downloaded: false },
    { name: 'base', size: '142 MB', downloaded: false },
    { name: 'base.en', size: '142 MB', downloaded: false },
    { name: 'small', size: '466 MB', downloaded: false },
    { name: 'small.en', size: '466 MB', downloaded: false },
    { name: 'medium', size: '1.5 GB', downloaded: false },
    { name: 'medium.en', size: '1.5 GB', downloaded: false },
  ]

  const llmModels = llmInfo?.availableModels || [
    { name: 'tinyllama-1.1b', size: '670 MB', contextLength: 2048, downloaded: false },
    { name: 'phi-2', size: '1.6 GB', contextLength: 2048, downloaded: false },
    { name: 'llama-3.2-1b', size: '775 MB', contextLength: 8192, downloaded: false },
    { name: 'llama-3.2-3b', size: '2.0 GB', contextLength: 8192, downloaded: false },
    { name: 'mistral-7b-instruct', size: '4.4 GB', contextLength: 8192, downloaded: false },
  ]

  const hasDownloadedWhisper = whisperModels.some(m => m.downloaded)
  const hasDownloadedLlm = llmModels.some(m => m.downloaded)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content max-w-xl h-[600px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-zinc-50/50">
          <h2 className="text-lg font-semibold text-foreground tracking-tight">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="px-6 py-2 border-b border-border flex gap-1 bg-white">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2',
                activeTab === tab.id
                  ? 'bg-zinc-100 text-foreground'
                  : 'text-muted-foreground hover:bg-zinc-50 hover:text-foreground'
              )}
            >
              {tab.icon && <tab.icon className="w-4 h-4" />}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/30">
          {activeTab === 'models' && (
            <div className="space-y-6">
              {/* Whisper model */}
              <div className="panel p-4 bg-white">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center border border-zinc-200">
                      <Mic className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">Whisper (Speech-to-Text)</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Local transcription using OpenAI's Whisper model
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <span className={clsx(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border',
                          hasDownloadedWhisper
                            ? whisperInfo?.loaded 
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                        )}>
                          {hasDownloadedWhisper ? (
                            whisperInfo?.loaded ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                Loaded
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                Downloaded
                              </>
                            )
                          ) : 'Not installed'}
                        </span>
                        {whisperInfo?.modelName && hasDownloadedWhisper && (
                          <span className="text-[10px] text-muted-foreground">
                            Model: {whisperInfo.modelName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {hasDownloadedWhisper && !whisperInfo?.loaded && (
                    <button
                      onClick={handleInitWhisper}
                      className="btn btn-secondary btn-sm"
                    >
                      Load
                    </button>
                  )}
                </div>

                {!whisperDownload.isDownloading && (
                  <div className="flex gap-2 mt-4">
                    <select 
                      className="flex-1 text-sm rounded-md border-zinc-200 focus:border-zinc-400 focus:ring-0"
                      value={selectedWhisperModel}
                      onChange={(e) => setSelectedWhisperModel(e.target.value)}
                    >
                      {whisperModels.map(model => (
                        <option key={model.name} value={model.name}>
                          {model.name} ({model.size}) {model.downloaded ? '✓' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleDownloadWhisper}
                      className="btn btn-primary btn-sm whitespace-nowrap"
                      disabled={whisperModels.find(m => m.name === selectedWhisperModel)?.downloaded}
                    >
                      <Download className="w-3.5 h-3.5 mr-2" />
                      {whisperModels.find(m => m.name === selectedWhisperModel)?.downloaded ? 'Downloaded' : 'Download'}
                    </button>
                  </div>
                )}

                {whisperDownload.isDownloading && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Downloading {whisperDownload.modelName}...</span>
                      <div className="flex items-center gap-2">
                        <span>{whisperDownload.progress}%</span>
                        <button 
                          onClick={handleCancelWhisperDownload}
                          className="text-red-500 hover:text-red-600"
                          title="Cancel download"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-zinc-900 transition-all duration-300"
                        style={{ width: `${whisperDownload.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {whisperDownload.error && (
                  <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs rounded-md flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {whisperDownload.error}
                  </div>
                )}
              </div>

              {/* LLM model */}
              <div className="panel p-4 bg-white">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center border border-zinc-200">
                      <Cpu className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">Local LLM (AI Assistant)</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Local language model for contextual AI chat
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <span className={clsx(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border',
                          hasDownloadedLlm
                            ? llmInfo?.loaded 
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                        )}>
                          {hasDownloadedLlm ? (
                            llmInfo?.loaded ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                Loaded
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                Downloaded
                              </>
                            )
                          ) : 'Not installed'}
                        </span>
                        {llmInfo?.modelName && hasDownloadedLlm && (
                          <span className="text-[10px] text-muted-foreground">
                            Model: {llmInfo.modelName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {hasDownloadedLlm && !llmInfo?.loaded && (
                    <button
                      onClick={handleInitLlm}
                      className="btn btn-secondary btn-sm"
                    >
                      Load
                    </button>
                  )}
                </div>

                {!llmDownload.isDownloading && (
                  <div className="flex gap-2 mt-4">
                    <select 
                      className="flex-1 text-sm rounded-md border-zinc-200 focus:border-zinc-400 focus:ring-0"
                      value={selectedLlmModel}
                      onChange={(e) => setSelectedLlmModel(e.target.value)}
                    >
                      {llmModels.map(model => (
                        <option key={model.name} value={model.name}>
                          {model.name} ({model.size}) {model.downloaded ? '✓' : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleDownloadLlm}
                      className="btn btn-primary btn-sm whitespace-nowrap"
                      disabled={llmModels.find(m => m.name === selectedLlmModel)?.downloaded}
                    >
                      <Download className="w-3.5 h-3.5 mr-2" />
                      {llmModels.find(m => m.name === selectedLlmModel)?.downloaded ? 'Downloaded' : 'Download'}
                    </button>
                  </div>
                )}

                {llmDownload.isDownloading && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span>Downloading {llmDownload.modelName}...</span>
                      <div className="flex items-center gap-2">
                        <span>{llmDownload.progress}%</span>
                        <button 
                          onClick={handleCancelLlmDownload}
                          className="text-red-500 hover:text-red-600"
                          title="Cancel download"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-zinc-900 transition-all duration-300"
                        style={{ width: `${llmDownload.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {llmDownload.error && (
                  <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs rounded-md flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {llmDownload.error}
                  </div>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground text-center px-4">
                Models are downloaded once and run completely offline. No internet required for AI features after download.
              </p>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div className="panel p-4 bg-white">
                <h3 className="font-medium text-foreground mb-2">Data Location</h3>
                <p className="text-xs text-muted-foreground font-mono bg-zinc-100 p-2 rounded border border-zinc-200 break-all">
                  ~/Library/Application Support/Lecture Note Companion/
                </p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  All your sessions, notes, and recordings are stored locally.
                </p>
              </div>

              <div className="panel p-4 bg-white">
                <h3 className="font-medium text-foreground mb-3">Audio Recordings</h3>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="rounded border-input text-zinc-900 focus:ring-zinc-900"
                    defaultChecked
                  />
                  <span className="text-sm text-foreground group-hover:text-zinc-900 transition-colors">
                    Auto-delete audio after transcription
                  </span>
                </label>
                <p className="text-[10px] text-muted-foreground mt-2 ml-7">
                  Saves disk space by removing audio files after they're transcribed.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-800 to-black flex items-center justify-center mx-auto mb-6 shadow-xl shadow-zinc-200">
                <span className="text-2xl">📚</span>
              </div>
              <h3 className="text-lg font-bold text-foreground tracking-tight">
                Lecture Note Companion
              </h3>
              <p className="text-xs text-muted-foreground mt-1 font-mono">Version 0.1.0</p>
              <p className="text-sm text-muted-foreground mt-4 max-w-xs mx-auto leading-relaxed">
                A privacy-first note-taking app for lectures. All your data stays on your device.
              </p>
              <div className="mt-8 flex justify-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="kbd">←</span>
                  <span className="kbd">→</span>
                  <span className="text-[10px] text-muted-foreground">Navigate</span>
                </div>
                <div className="w-px h-4 bg-border"></div>
                <div className="flex items-center gap-1.5">
                  <span className="kbd">A</span>
                  <span className="text-[10px] text-muted-foreground">Ask AI</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
