import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Download, HardDrive, Cpu, Mic, CheckCircle2, AlertCircle, XCircle, Eye, Trash2, Copy, Check, FileText, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'
import { useAccessibility } from '../hooks/useAccessibility'
import { useFocusTrap } from '../hooks/useFocusTrap'

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
  const [activeTab, setActiveTab] = useState<'models' | 'accessibility' | 'storage' | 'about'>('models')
  const focusTrapRef = useFocusTrap<HTMLDivElement>(true)
  
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
  
  // Log viewer state
  const [logs, setLogs] = useState<string>('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsCopied, setLogsCopied] = useState(false)
  const [showLogViewer, setShowLogViewer] = useState(false)

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
      if (result && !result.success) {
        setWhisperDownload(prev => ({ 
          ...prev, 
          isDownloading: false, 
          error: result.error || 'Download failed' 
        }))
      } else if (result?.success) {
        setWhisperDownload(prev => ({ ...prev, isDownloading: false }))
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
      if (result && !result.success) {
        setLlmDownload(prev => ({ 
          ...prev, 
          isDownloading: false, 
          error: result.error || 'Download failed' 
        }))
      } else if (result?.success) {
        setLlmDownload(prev => ({ ...prev, isDownloading: false }))
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

  const { highContrast, autoDeleteAudio, setHighContrast, setAutoDeleteAudio } = useAccessibility()

  // Load logs function
  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const logData = await window.electronAPI.logsGetAll()
      setLogs(logData || 'No logs available')
    } catch (err) {
      setLogs('Failed to load logs: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setLogsLoading(false)
    }
  }, [])

  // Copy logs to clipboard
  const handleCopyLogs = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(logs)
      setLogsCopied(true)
      setTimeout(() => setLogsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy logs:', err)
    }
  }, [logs])

  // Clear logs
  const handleClearLogs = useCallback(async () => {
    if (confirm('Are you sure you want to clear all logs?')) {
      try {
        await window.electronAPI.logsClear()
        setLogs('')
        await loadLogs()
      } catch (err) {
        console.error('Failed to clear logs:', err)
      }
    }
  }, [loadLogs])

  // Load logs when viewer is opened
  useEffect(() => {
    if (showLogViewer) {
      loadLogs()
    }
  }, [showLogViewer, loadLogs])

  const tabs = [
    { id: 'models', label: 'AI Models', icon: Cpu },
    { id: 'accessibility', label: 'Accessibility', icon: Eye },
    { id: 'storage', label: 'Storage', icon: HardDrive },
    { id: 'about', label: 'About', icon: null },
  ] as const

  // Get available models from info or use defaults
  // Models with quality descriptions for classroom use
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

  // Model quality recommendations
  const getModelQuality = (name: string): { quality: string; description: string; recommended: boolean } => {
    if (name.startsWith('tiny')) {
      return { 
        quality: 'Fast', 
        description: 'Quick but less accurate. Good for clear audio close to mic.',
        recommended: false 
      }
    }
    if (name.startsWith('base')) {
      return { 
        quality: 'Balanced', 
        description: 'Good balance of speed and accuracy.',
        recommended: false 
      }
    }
    if (name.startsWith('small')) {
      return { 
        quality: 'Good', 
        description: 'Recommended for most classroom settings.',
        recommended: true 
      }
    }
    if (name.startsWith('medium')) {
      return { 
        quality: 'Best', 
        description: 'Best accuracy for distant audio or noisy environments.',
        recommended: false 
      }
    }
    return { quality: 'Unknown', description: '', recommended: false }
  }

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
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="modal-content max-w-xl h-[600px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-zinc-50/50">
          <h2 id="settings-modal-title" className="text-lg font-semibold text-foreground tracking-tight">Settings</h2>
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
                  <div className="mt-4 space-y-3">
                    {/* Model quality info */}
                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground">
                          {getModelQuality(selectedWhisperModel).quality} Quality
                        </span>
                        {getModelQuality(selectedWhisperModel).recommended && (
                          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {getModelQuality(selectedWhisperModel).description}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <select 
                        className="flex-1 text-sm rounded-md border-zinc-200 focus:border-zinc-400 focus:ring-0"
                        value={selectedWhisperModel}
                        onChange={(e) => setSelectedWhisperModel(e.target.value)}
                      >
                        {whisperModels.map(model => {
                          const quality = getModelQuality(model.name)
                          return (
                            <option key={model.name} value={model.name}>
                              {model.name} ({model.size}) {quality.recommended ? '★' : ''} {model.downloaded ? '✓' : ''}
                            </option>
                          )
                        })}
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

                    <p className="text-[10px] text-muted-foreground">
                      💡 For lecture halls: Use "small" or "medium" for better accuracy with distant audio.
                    </p>
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

          {activeTab === 'accessibility' && (
            <div className="space-y-4">
              <div className="panel p-4 bg-white">
                <h3 className="font-medium text-foreground mb-3">Display</h3>
                <label className="flex items-center justify-between cursor-pointer group p-2 hover:bg-zinc-50 rounded-lg transition-colors">
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      High Contrast Mode
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Increases contrast for better readability
                    </p>
                  </div>
                  <button
                    onClick={() => setHighContrast(!highContrast)}
                    className={clsx(
                      'relative w-11 h-6 rounded-full transition-colors',
                      highContrast ? 'bg-zinc-900' : 'bg-zinc-200'
                    )}
                    role="switch"
                    aria-checked={highContrast}
                  >
                    <span
                      className={clsx(
                        'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                        highContrast && 'translate-x-5'
                      )}
                    />
                  </button>
                </label>
              </div>

              <div className="panel p-4 bg-white">
                <h3 className="font-medium text-foreground mb-3">Privacy</h3>
                <label className="flex items-center justify-between cursor-pointer group p-2 hover:bg-zinc-50 rounded-lg transition-colors">
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      Auto-delete Audio Files
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Remove recordings after transcription
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoDeleteAudio(!autoDeleteAudio)}
                    className={clsx(
                      'relative w-11 h-6 rounded-full transition-colors',
                      autoDeleteAudio ? 'bg-zinc-900' : 'bg-zinc-200'
                    )}
                    role="switch"
                    aria-checked={autoDeleteAudio}
                  >
                    <span
                      className={clsx(
                        'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                        autoDeleteAudio && 'translate-x-5'
                      )}
                    />
                  </button>
                </label>
              </div>

              <p className="text-[10px] text-muted-foreground text-center px-4">
                These settings are saved locally and persist across sessions.
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
                <h3 className="font-medium text-foreground mb-3">Debug Logs</h3>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Application Logs</p>
                    <p className="text-[10px] text-muted-foreground">
                      View and export logs for troubleshooting
                    </p>
                  </div>
                  <button
                    onClick={() => setShowLogViewer(!showLogViewer)}
                    className="btn btn-secondary btn-sm"
                  >
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                    {showLogViewer ? 'Hide' : 'View'} Logs
                  </button>
                </div>

                {showLogViewer && (
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex gap-1.5">
                        <button
                          onClick={loadLogs}
                          className="btn btn-ghost btn-sm text-xs"
                          disabled={logsLoading}
                        >
                          <RefreshCw className={clsx('w-3 h-3 mr-1', logsLoading && 'animate-spin')} />
                          Refresh
                        </button>
                        <button
                          onClick={handleCopyLogs}
                          className="btn btn-ghost btn-sm text-xs"
                          disabled={!logs}
                        >
                          {logsCopied ? (
                            <>
                              <Check className="w-3 h-3 mr-1 text-green-500" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 mr-1" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <button
                        onClick={handleClearLogs}
                        className="btn btn-ghost btn-sm text-xs text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Clear
                      </button>
                    </div>
                    <div className="relative">
                      <pre className="text-[10px] font-mono bg-zinc-900 text-zinc-100 p-3 rounded-lg overflow-auto max-h-48 whitespace-pre-wrap break-all">
                        {logsLoading ? (
                          <span className="text-zinc-400">Loading logs...</span>
                        ) : logs || (
                          <span className="text-zinc-400">No logs available</span>
                        )}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              <div className="panel p-4 bg-white">
                <h3 className="font-medium text-foreground mb-3">Cache Management</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Downloaded AI models are stored locally. Removing them will require re-downloading.
                </p>
                <div className="space-y-2">
                  {whisperInfo?.modelName && (
                    <div className="flex items-center justify-between p-2 bg-zinc-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-zinc-400" />
                        <span className="text-xs font-medium">Whisper: {whisperInfo.modelName}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Downloaded</span>
                    </div>
                  )}
                  {llmInfo?.modelName && (
                    <div className="flex items-center justify-between p-2 bg-zinc-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-zinc-400" />
                        <span className="text-xs font-medium">LLM: {llmInfo.modelName}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Downloaded</span>
                    </div>
                  )}
                  {!whisperInfo?.modelName && !llmInfo?.modelName && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      No models downloaded yet
                    </p>
                  )}
                </div>
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
