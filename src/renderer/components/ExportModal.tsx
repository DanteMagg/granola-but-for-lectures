import { useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { X, Download, FileText, MessageSquare, Image } from 'lucide-react'
import { clsx } from 'clsx'
import type { ExportOptions } from '@shared/types'

interface ExportModalProps {
  onClose: () => void
}

export function ExportModal({ onClose }: ExportModalProps) {
  const { session } = useSessionStore()
  const [options, setOptions] = useState<ExportOptions>({
    includeSlides: true,
    includeNotes: true,
    includeTranscripts: true,
    slideRange: 'all',
  })
  const [isExporting, setIsExporting] = useState(false)

  if (!session) return null

  const handleExport = async () => {
    setIsExporting(true)

    try {
      // Get save path from dialog
      const filePath = await window.electronAPI.exportPdf(session.id)

      if (!filePath) {
        setIsExporting(false)
        return
      }

      // Determine which slides to export
      const slidesToExport =
        options.slideRange === 'current'
          ? [session.slides[session.currentSlideIndex]]
          : session.slides

      // Prepare export data
      const exportData = {
        sessionName: session.name,
        exportedAt: new Date().toISOString(),
        slides: slidesToExport.map((slide, idx) => ({
          index:
            options.slideRange === 'current'
              ? session.currentSlideIndex + 1
              : idx + 1,
          imageData: options.includeSlides ? slide.imageData : null,
          note: options.includeNotes
            ? (session.notes[slide.id]?.plainText ?? null)
            : null,
          transcript: options.includeTranscripts
            ? (session.transcripts[slide.id]?.map(t => t.text).join(' ') ?? null)
            : null,
        })),
      }

      // Generate the PDF
      await window.electronAPI.generatePdf(filePath, exportData)

      onClose()
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const slideCount = session.slides.length
  const noteCount = Object.keys(session.notes).length
  const transcriptCount = Object.keys(session.transcripts).length

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center shadow-sm">
              <Download className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground tracking-tight">Export Session</h2>
              <p className="text-xs text-muted-foreground">Export to PDF</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content options */}
        <div className="p-6 space-y-5">
          <p className="text-sm font-medium text-foreground mb-4">
            Choose what to include in your export:
          </p>

          {/* Include slides */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={options.includeSlides}
              onChange={(e) => setOptions({ ...options, includeSlides: e.target.checked })}
              className="mt-1 rounded border-input text-zinc-900 focus:ring-zinc-900 transition-all"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-sm font-medium text-foreground">Slide Images</span>
                <span className="text-xs text-muted-foreground bg-zinc-100 px-1.5 py-0.5 rounded-full">
                  {slideCount}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Include rendered slide images in the PDF
              </p>
            </div>
          </label>

          {/* Include notes */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={options.includeNotes}
              onChange={(e) => setOptions({ ...options, includeNotes: e.target.checked })}
              className="mt-1 rounded border-input text-zinc-900 focus:ring-zinc-900 transition-all"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-sm font-medium text-foreground">Notes</span>
                <span className="text-xs text-muted-foreground bg-zinc-100 px-1.5 py-0.5 rounded-full">
                  {noteCount}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Include your handwritten notes for each slide
              </p>
            </div>
          </label>

          {/* Include transcripts */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={options.includeTranscripts}
              onChange={(e) => setOptions({ ...options, includeTranscripts: e.target.checked })}
              className="mt-1 rounded border-input text-zinc-900 focus:ring-zinc-900 transition-all"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                <span className="text-sm font-medium text-foreground">Transcripts</span>
                <span className="text-xs text-muted-foreground bg-zinc-100 px-1.5 py-0.5 rounded-full">
                  {transcriptCount}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Include audio transcriptions for each slide
              </p>
            </div>
          </label>

          {/* Slide range */}
          <div className="pt-5 border-t border-border">
            <p className="text-sm font-medium text-foreground mb-3">Slide Range</p>
            <div className="flex gap-2">
              {(['all', 'current'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setOptions({ ...options, slideRange: range })}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-all border',
                    options.slideRange === range
                      ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                      : 'bg-white text-muted-foreground border-input hover:bg-zinc-50 hover:text-foreground'
                  )}
                >
                  {range === 'all' ? 'All Slides' : 'Current Slide Only'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-zinc-50/30">
          <button
            onClick={onClose}
            className="btn btn-secondary btn-md"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || (!options.includeSlides && !options.includeNotes && !options.includeTranscripts)}
            className="btn btn-primary btn-md"
          >
            {isExporting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                Export PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
