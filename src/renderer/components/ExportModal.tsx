import { useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { X, Download, FileText, MessageSquare, Image, Sparkles } from 'lucide-react'
import { clsx } from 'clsx'
import type { ExportOptions } from '@shared/types'

interface ExtendedExportOptions extends ExportOptions {
  preferEnhanced: boolean  // Use enhanced notes when available
}

interface ExportModalProps {
  onClose: () => void
}

export function ExportModal({ onClose }: ExportModalProps) {
  const { session } = useSessionStore()
  const [options, setOptions] = useState<ExtendedExportOptions>({
    includeSlides: true,
    includeNotes: true,
    includeTranscripts: true,
    slideRange: 'all',
    customRange: { start: 1, end: session?.slides.length || 1 },
    preferEnhanced: true,  // Default to enhanced notes
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
      let slidesToExport
      if (options.slideRange === 'current') {
        slidesToExport = [session.slides[session.currentSlideIndex]]
      } else if (options.slideRange === 'custom' && options.customRange) {
        const start = Math.max(0, options.customRange.start - 1)
        const end = Math.min(session.slides.length, options.customRange.end)
        slidesToExport = session.slides.slice(start, end)
      } else {
        slidesToExport = session.slides
      }

      // Calculate starting index for slide numbers
      let startIndex = 1
      if (options.slideRange === 'current') {
        startIndex = session.currentSlideIndex + 1
      } else if (options.slideRange === 'custom' && options.customRange) {
        startIndex = options.customRange.start
      }

      // Prepare export data
      const exportData = {
        sessionName: session.name,
        exportedAt: new Date().toISOString(),
        slides: slidesToExport.map((slide, idx) => {
          // Determine which notes to use
          let noteContent: string | null = null
          if (options.includeNotes) {
            const enhancedNote = session.enhancedNotes?.[slide.id]
            const originalNote = session.notes[slide.id]
            
            if (options.preferEnhanced && enhancedNote?.status === 'complete') {
              noteContent = enhancedNote.plainText
            } else if (originalNote?.plainText) {
              noteContent = originalNote.plainText
            }
          }

          return {
            index: startIndex + idx,
            imageData: options.includeSlides ? slide.imageData : null,
            note: noteContent,
            transcript: options.includeTranscripts
              ? (session.transcripts[slide.id]?.map(t => t.text).join(' ') ?? null)
              : null,
          }
        }),
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
  const enhancedCount = Object.values(session.enhancedNotes || {}).filter(
    n => n.status === 'complete'
  ).length

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
              
              {/* Enhanced notes option */}
              {options.includeNotes && enhancedCount > 0 && (
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.preferEnhanced}
                    onChange={(e) => setOptions({ ...options, preferEnhanced: e.target.checked })}
                    className="rounded border-input text-zinc-900 focus:ring-zinc-900 transition-all"
                  />
                  <span className="text-xs text-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Use enhanced notes when available ({enhancedCount} slides)
                  </span>
                </label>
              )}
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
            <div className="flex flex-wrap gap-2">
              {(['all', 'current', 'custom'] as const).map((range) => (
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
                  {range === 'all' ? 'All Slides' : range === 'current' ? 'Current Slide' : 'Custom Range'}
                </button>
              ))}
            </div>

            {/* Custom range inputs */}
            {options.slideRange === 'custom' && (
              <div className="flex items-center gap-3 mt-3 animate-fade-in">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">From</label>
                  <input
                    type="number"
                    min={1}
                    max={slideCount}
                    value={options.customRange?.start || 1}
                    onChange={(e) => {
                      const start = Math.max(1, Math.min(slideCount, parseInt(e.target.value) || 1))
                      setOptions({
                        ...options,
                        customRange: { 
                          start, 
                          end: Math.max(start, options.customRange?.end || slideCount) 
                        },
                      })
                    }}
                    className="input w-16 text-center py-1.5"
                  />
                </div>
                <span className="text-muted-foreground">—</span>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">To</label>
                  <input
                    type="number"
                    min={1}
                    max={slideCount}
                    value={options.customRange?.end || slideCount}
                    onChange={(e) => {
                      const end = Math.max(1, Math.min(slideCount, parseInt(e.target.value) || slideCount))
                      setOptions({
                        ...options,
                        customRange: { 
                          start: Math.min(end, options.customRange?.start || 1), 
                          end 
                        },
                      })
                    }}
                    className="input w-16 text-center py-1.5"
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  of {slideCount} slides
                </span>
              </div>
            )}
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
