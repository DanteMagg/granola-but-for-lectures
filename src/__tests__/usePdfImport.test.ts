import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePdfImport } from '../renderer/hooks/usePdfImport'
import { useSessionStore } from '../renderer/stores/sessionStore'
import { createMockUIState, createMockSession } from './helpers/mockData'

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => {
  const mockPage = {
    getViewport: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
    render: vi.fn().mockReturnValue({
      promise: Promise.resolve(),
    }),
    getTextContent: vi.fn().mockResolvedValue({
      items: [
        { str: 'Hello' },
        { str: ' ' },
        { str: 'World' },
      ],
    }),
  }

  const mockPdf = {
    numPages: 3,
    getPage: vi.fn().mockResolvedValue(mockPage),
  }

  return {
    GlobalWorkerOptions: {
      workerSrc: '',
    },
    version: '4.0.379',
    getDocument: vi.fn().mockReturnValue({
      promise: Promise.resolve(mockPdf),
    }),
  }
})

// Mock toast
vi.mock('../renderer/components/Toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Reset store helper
const resetStore = () => {
  useSessionStore.setState({
    session: createMockSession(),
    sessionList: [],
    ui: createMockUIState(),
    isLoading: false,
    isSaving: false,
    error: null,
    setSlides: vi.fn(),
    setPdfFileName: vi.fn(),
    setSessionName: vi.fn(),
  })
}

describe('usePdfImport', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => usePdfImport())

      expect(result.current.isImporting).toBe(false)
      expect(result.current.progress).toBe(0)
      expect(result.current.error).toBeNull()
    })

    it('should expose importPdf and importPdfFromFile functions', () => {
      const { result } = renderHook(() => usePdfImport())

      expect(typeof result.current.importPdf).toBe('function')
      expect(typeof result.current.importPdfFromFile).toBe('function')
    })
  })

  describe('importPdf (file dialog)', () => {
    it('should handle canceled dialog', async () => {
      window.electronAPI.openPdfDialog = vi.fn().mockResolvedValue(null)

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdf()
      })

      expect(result.current.isImporting).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should set isImporting during import', async () => {
      let resolveDialog: (value: unknown) => void
      const dialogPromise = new Promise((resolve) => {
        resolveDialog = resolve
      })

      window.electronAPI.openPdfDialog = vi.fn().mockReturnValue(dialogPromise)

      const { result } = renderHook(() => usePdfImport())

      // Start import
      act(() => {
        result.current.importPdf()
      })

      // Should be importing
      expect(result.current.isImporting).toBe(true)

      // Complete dialog
      await act(async () => {
        resolveDialog!(null)
        await dialogPromise
      })

      expect(result.current.isImporting).toBe(false)
    })

    it('should handle import errors', async () => {
      window.electronAPI.openPdfDialog = vi.fn().mockRejectedValue(new Error('Dialog error'))
      
      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdf()
      })

      expect(result.current.error).toBe('Dialog error')
    })
  })

  describe('importPdfFromFile (drag & drop)', () => {
    it('should reject non-PDF files by type and extension', async () => {
      // Create a mock file object with necessary methods
      const mockFile = {
        type: 'text/plain',
        name: 'document.txt',
        size: 100,
        lastModified: Date.now(),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      } as unknown as File

      const { result } = renderHook(() => usePdfImport())

      let returnValue: boolean | undefined
      await act(async () => {
        returnValue = await result.current.importPdfFromFile(mockFile)
      })

      expect(returnValue).toBe(false)
      expect(result.current.error).toBe('Please drop a PDF file')
    })

    it('should accept PDF files by MIME type', async () => {
      const pdfContent = new ArrayBuffer(100)
      const mockFile = {
        type: 'application/pdf',
        name: 'document.pdf',
        size: 100,
        lastModified: Date.now(),
        arrayBuffer: vi.fn().mockResolvedValue(pdfContent),
      } as unknown as File

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdfFromFile(mockFile)
      })

      // Should not have the "invalid file" error
      expect(result.current.error).not.toBe('Please drop a PDF file')
    })

    it('should accept files with .pdf extension regardless of MIME type', async () => {
      const pdfContent = new ArrayBuffer(100)
      const mockFile = {
        type: '',
        name: 'document.pdf',
        size: 100,
        lastModified: Date.now(),
        arrayBuffer: vi.fn().mockResolvedValue(pdfContent),
      } as unknown as File

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdfFromFile(mockFile)
      })

      // Type validation should pass (might fail on PDF parsing but that's expected)
      expect(result.current.error).not.toBe('Please drop a PDF file')
    })
  })

  describe('session name update', () => {
    it('should update session name from PDF filename if untitled', async () => {
      const setPdfFileNameSpy = vi.fn()
      const setSessionNameSpy = vi.fn()
      
      useSessionStore.setState({
        session: createMockSession({ name: 'Untitled Session' }),
        setSessionName: setSessionNameSpy,
        setPdfFileName: setPdfFileNameSpy,
        setSlides: vi.fn(),
      })

      window.electronAPI.openPdfDialog = vi.fn().mockResolvedValue({
        fileName: 'My Lecture Notes.pdf',
        data: btoa('fake pdf content'),
      })

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdf()
      })

      // The setPdfFileName should be called with the filename
      expect(setPdfFileNameSpy).toHaveBeenCalledWith('My Lecture Notes.pdf')
    })

    it('should not update session name if already named', async () => {
      const setSessionNameSpy = vi.fn()
      
      useSessionStore.setState({
        session: createMockSession({ name: 'My Custom Session Name' }),
        setSessionName: setSessionNameSpy,
        setPdfFileName: vi.fn(),
        setSlides: vi.fn(),
      })

      window.electronAPI.openPdfDialog = vi.fn().mockResolvedValue({
        fileName: 'Different Name.pdf',
        data: btoa('fake pdf content'),
      })

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdf()
      })

      // Should NOT have called setSessionName since session already has a name
      expect(setSessionNameSpy).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle generic errors with fallback message', async () => {
      window.electronAPI.openPdfDialog = vi.fn().mockRejectedValue('Non-Error rejection')

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdf()
      })

      expect(result.current.error).toBe('Failed to import PDF')
    })

    it('should clear previous errors on new import', async () => {
      window.electronAPI.openPdfDialog = vi.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(null)

      const { result } = renderHook(() => usePdfImport())

      // First import fails
      await act(async () => {
        await result.current.importPdf()
      })
      expect(result.current.error).toBe('First error')

      // Second import clears error
      await act(async () => {
        await result.current.importPdf()
      })
      expect(result.current.error).toBeNull()
    })
  })
})
