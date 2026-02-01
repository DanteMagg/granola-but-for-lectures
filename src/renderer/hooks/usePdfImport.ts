import { useState, useCallback } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { v4 as uuidv4 } from 'uuid'
import type { Slide } from '@shared/types'
import * as pdfjsLib from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { toast } from '../stores/toastStore'
import { createLogger } from '../lib/logger'

const log = createLogger('pdfImport')

// Security: Maximum PDF file size (100MB)
const MAX_PDF_SIZE_BYTES = 100 * 1024 * 1024
// Security: Maximum number of pages to prevent DoS
const MAX_PDF_PAGES = 500

// Set up PDF.js worker - use local bundled worker for security
// CDN fallback removed for production security
const setupPdfWorker = () => {
  try {
    // Use the worker from node_modules (bundled by Vite)
    const workerUrl = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
  } catch (e) {
    // Log error but don't fallback to CDN for security
    log.error('Failed to load local PDF.js worker', e)
    // In dev mode only, allow CDN fallback
    if (import.meta.env.DEV) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
    }
  }
}
setupPdfWorker()

export function usePdfImport() {
  const { setSlides, setPdfFileName, setSessionName, session } =
    useSessionStore()
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Process PDF data (shared logic for both dialog and drag & drop)
  const processPdfData = useCallback(async (pdfData: Uint8Array, fileName: string) => {
    // Security: Validate file size
    if (pdfData.byteLength > MAX_PDF_SIZE_BYTES) {
      const sizeMB = Math.round(pdfData.byteLength / (1024 * 1024))
      throw new Error(`PDF file too large (${sizeMB}MB). Maximum size is ${MAX_PDF_SIZE_BYTES / (1024 * 1024)}MB.`)
    }

    // Update session metadata
    setPdfFileName(fileName)
    if (session?.name === 'Untitled Session') {
      setSessionName(fileName.replace('.pdf', ''))
    }

    // Load PDF document with security options
    const pdf = await pdfjsLib.getDocument({ 
      data: pdfData,
      // Security: Disable features that could be exploited
      disableAutoFetch: true,
      disableStream: true,
      isEvalSupported: false, // Disable eval in PDF.js
    }).promise
    const numPages = pdf.numPages

    // Security: Validate page count
    if (numPages > MAX_PDF_PAGES) {
      throw new Error(`PDF has too many pages (${numPages}). Maximum is ${MAX_PDF_PAGES} pages.`)
    }

    const slides: Slide[] = []

    // Process each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      setProgress((pageNum / numPages) * 100)

      const page = await pdf.getPage(pageNum)

      // Get page dimensions
      const viewport = page.getViewport({ scale: 2.0 }) // Higher scale for better quality

      // Create canvas for rendering
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error(
          `Failed to create canvas context for page ${pageNum}`
        )
      }

      canvas.width = viewport.width
      canvas.height = viewport.height

      // Render page to canvas
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise

      // Convert to base64 PNG
      const imageData = canvas.toDataURL('image/png').split(',')[1]

      // Extract text content
      const textContent = await page.getTextContent()
      const extractedText = textContent.items
        .filter((item): item is TextItem => 'str' in item)
        .map(item => item.str)
        .join(' ')
        .trim()

      slides.push({
        id: uuidv4(),
        index: pageNum - 1,
        imageData,
        width: viewport.width,
        height: viewport.height,
        extractedText,
      })
    }

    setSlides(slides)
    setProgress(100)
    
    toast.success('PDF Imported', `${numPages} slides loaded from ${fileName}`)
  }, [session?.name, setSlides, setPdfFileName, setSessionName])

  // Import via file dialog
  const importPdf = useCallback(async () => {
    setIsImporting(true)
    setProgress(0)
    setError(null)

    try {
      // Open file dialog
      const result = await window.electronAPI.openPdfDialog()

      if (!result) {
        setIsImporting(false)
        return
      }

      const { fileName, data } = result

      // Decode base64 PDF data
      const pdfData = Uint8Array.from(atob(data), c => c.charCodeAt(0))

      await processPdfData(pdfData, fileName)
    } catch (err) {
      log.error('PDF import failed', err)
      const errorMsg = err instanceof Error ? err.message : 'Failed to import PDF'
      setError(errorMsg)
      toast.error('Import Failed', errorMsg)
    } finally {
      setIsImporting(false)
    }
  }, [processPdfData])

  // Import from File object (for drag & drop)
  const importPdfFromFile = useCallback(async (file: File) => {
    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      const errorMsg = 'Please drop a PDF file'
      setError(errorMsg)
      toast.error('Invalid File', errorMsg)
      return false
    }

    // Security: Validate file size
    if (file.size > MAX_PDF_SIZE_BYTES) {
      const sizeMB = Math.round(file.size / (1024 * 1024))
      const errorMsg = `PDF file too large (${sizeMB}MB). Maximum size is ${MAX_PDF_SIZE_BYTES / (1024 * 1024)}MB.`
      setError(errorMsg)
      toast.error('File Too Large', errorMsg)
      return false
    }

    setIsImporting(true)
    setProgress(0)
    setError(null)

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer()
      const pdfData = new Uint8Array(arrayBuffer)

      await processPdfData(pdfData, file.name)
      return true
    } catch (err) {
      log.error('PDF import from file failed', err)
      const errorMsg = err instanceof Error ? err.message : 'Failed to import PDF'
      setError(errorMsg)
      toast.error('Import Failed', errorMsg)
      return false
    } finally {
      setIsImporting(false)
    }
  }, [processPdfData])

  return {
    importPdf,
    importPdfFromFile,
    isImporting,
    progress,
    error,
  }
}
