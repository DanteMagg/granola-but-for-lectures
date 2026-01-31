import { useState, useCallback, DragEvent } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { Upload, FileText, Sparkles, Shield, FileWarning } from 'lucide-react'
import { usePdfImport } from '../hooks/usePdfImport'
import { clsx } from 'clsx'
import { toast } from '../stores/toastStore'

export function EmptyState() {
  const { session, createSession } = useSessionStore()
  const { importPdf, importPdfFromFile, isImporting } = usePdfImport()
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragError, setDragError] = useState<string | null>(null)

  const handleImportPdf = async () => {
    // Create session if none exists
    if (!session) {
      await createSession()
    }
    await importPdf()
  }

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragError(null)
    
    // Check if it's a file
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Only reset if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragOver(false)
      setDragError(null)
    }
  }, [])

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    setDragError(null)

    const files = Array.from(e.dataTransfer.files)
    
    if (files.length === 0) {
      return
    }

    if (files.length > 1) {
      setDragError('Please drop only one PDF file at a time')
      toast.warning('Multiple Files', 'Please drop only one PDF file at a time')
      return
    }

    const file = files[0]

    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setDragError('Only PDF files are supported')
      toast.error('Invalid File Type', 'Only PDF files are supported')
      return
    }

    // Create session if none exists
    if (!session) {
      await createSession()
    }

    await importPdfFromFile(file)
  }, [session, createSession, importPdfFromFile])

  return (
    <div 
      className="flex-1 flex items-center justify-center p-8 bg-zinc-50/30"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Full-screen drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900/10 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border-2 border-dashed border-zinc-900 p-12 shadow-2xl">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4 animate-bounce">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <p className="text-lg font-semibold text-zinc-900">Drop PDF here</p>
              <p className="text-sm text-muted-foreground mt-1">Release to import slides</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-md w-full">
        {/* Hero section */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-800 to-black flex items-center justify-center mx-auto mb-6 shadow-xl shadow-zinc-200">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3 tracking-tight">
            {session ? 'Import Your Slides' : 'Welcome to Lecture Notes'}
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            {session 
              ? 'Add a PDF to start taking notes synced to each slide.'
              : 'Your private, AI-powered lecture note companion.'}
          </p>
        </div>

        {/* Import area */}
        <button
          onClick={handleImportPdf}
          disabled={isImporting}
          className={clsx(
            'w-full p-10 border-2 border-dashed rounded-xl transition-all duration-300 group',
            dragError
              ? 'border-red-300 bg-red-50/50'
              : isDragOver
                ? 'border-zinc-900 bg-white scale-[1.02]'
                : 'border-zinc-200 hover:border-zinc-900 hover:bg-white bg-zinc-50/50'
          )}
        >
          <div className="flex flex-col items-center">
            {isImporting ? (
              <>
                <div className="w-10 h-10 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mb-4" />
                <p className="text-sm font-medium text-foreground">Processing PDF...</p>
              </>
            ) : dragError ? (
              <>
                <div className="w-12 h-12 rounded-full bg-red-100 border border-red-200 flex items-center justify-center mb-4">
                  <FileWarning className="w-5 h-5 text-red-500" />
                </div>
                <p className="text-sm font-medium text-red-600 mb-1">
                  {dragError}
                </p>
                <p className="text-xs text-muted-foreground">
                  Try again with a PDF file
                </p>
              </>
            ) : (
              <>
                <div className={clsx(
                  'w-12 h-12 rounded-full bg-white border flex items-center justify-center mb-4 transition-all shadow-sm',
                  isDragOver 
                    ? 'border-zinc-900 scale-110' 
                    : 'border-zinc-200 group-hover:scale-110 group-hover:border-zinc-900'
                )}>
                  <Upload className={clsx(
                    'w-5 h-5 transition-colors',
                    isDragOver ? 'text-zinc-900' : 'text-muted-foreground group-hover:text-foreground'
                  )} />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Import PDF Slides
                </p>
                <p className="text-xs text-muted-foreground">
                  Click to browse or drag & drop
                </p>
              </>
            )}
          </div>
        </button>

        {/* Features */}
        {!session && (
          <div className="mt-10 grid grid-cols-2 gap-4">
            <div className="p-5 bg-white rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center mb-3">
                <Sparkles className="w-4 h-4 text-zinc-900" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">AI-Powered</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Get help understanding lecture content with contextual AI.
              </p>
            </div>
            <div className="p-5 bg-white rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center mb-3">
                <Shield className="w-4 h-4 text-zinc-900" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">100% Private</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                All data stays on your device. No cloud required.
              </p>
            </div>
          </div>
        )}

        {/* Keyboard hints */}
        <div className="mt-10 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <kbd className="kbd">←</kbd>
            <kbd className="kbd">→</kbd>
            Navigate slides
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="kbd">A</kbd>
            Ask AI
          </span>
        </div>
      </div>
    </div>
  )
}
