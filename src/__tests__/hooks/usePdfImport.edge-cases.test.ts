/**
 * Edge case tests for PDF import functionality
 * Tests file validation, error handling, and state management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePdfImport } from '../../renderer/hooks/usePdfImport'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import { createMockUIState, createMockSession } from '../helpers/mockData'

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => {
  const mockPage = {
    getViewport: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
    render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
    getTextContent: vi.fn().mockResolvedValue({ items: [{ str: 'Test' }] }),
  }

  return {
    GlobalWorkerOptions: { workerSrc: '' },
    version: '4.0.379',
    getDocument: vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 3,
        getPage: vi.fn().mockResolvedValue(mockPage),
      }),
    }),
  }
})

// Mock toast
vi.mock('../../renderer/stores/toastStore', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const resetStore = () => {
  useSessionStore.setState({
    session: createMockSession({ name: 'Untitled Session' }),
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

// Store original createElement before it's mocked
const originalCreateElement = document.createElement.bind(document)

describe('usePdfImport - Edge Cases', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    
    // Mock canvas
    const mockContext = {
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      getImageData: vi.fn(),
    }
    
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => mockContext,
          toDataURL: () => 'data:image/png;base64,mockImageData',
        } as unknown as HTMLCanvasElement
      }
      return originalCreateElement(tag)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('file validation', () => {
    it('should accept .PDF (uppercase extension)', async () => {
      const pdfContent = new ArrayBuffer(100)
      const mockFile = {
        type: '',
        name: 'LECTURE.PDF',
        size: 100,
        arrayBuffer: vi.fn().mockResolvedValue(pdfContent),
      } as unknown as File

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdfFromFile(mockFile)
      })

      // Should not have the "invalid file" error
      expect(result.current.error).not.toBe('Please drop a PDF file')
    })

    it('should reject file with pdf in name but wrong extension', async () => {
      const mockFile = {
        type: 'text/plain',
        name: 'my-pdf-notes.txt',
        size: 100,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      } as unknown as File

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdfFromFile(mockFile)
      })

      expect(result.current.error).toBe('Please drop a PDF file')
    })

    it('should accept file with application/pdf MIME type', async () => {
      const pdfContent = new ArrayBuffer(100)
      const mockFile = {
        type: 'application/pdf',
        name: 'document.pdf',
        size: 100,
        arrayBuffer: vi.fn().mockResolvedValue(pdfContent),
      } as unknown as File

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdfFromFile(mockFile)
      })

      expect(result.current.error).not.toBe('Please drop a PDF file')
    })

    it('should accept file with no MIME type but .pdf extension', async () => {
      const pdfContent = new ArrayBuffer(100)
      const mockFile = {
        type: '',
        name: 'lecture.pdf',
        size: 100,
        arrayBuffer: vi.fn().mockResolvedValue(pdfContent),
      } as unknown as File

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdfFromFile(mockFile)
      })

      expect(result.current.error).not.toBe('Please drop a PDF file')
    })
  })

  describe('state management', () => {
    it('should track importing state correctly', async () => {
      const pdfContent = new ArrayBuffer(100)
      const mockFile = {
        type: 'application/pdf',
        name: 'test.pdf',
        size: 100,
        arrayBuffer: vi.fn().mockResolvedValue(pdfContent),
      } as unknown as File

      const { result } = renderHook(() => usePdfImport())

      expect(result.current.isImporting).toBe(false)

      await act(async () => {
        await result.current.importPdfFromFile(mockFile)
      })

      expect(result.current.isImporting).toBe(false)
    })

    it('should reset error on new import attempt', async () => {
      const mockFile = {
        type: 'text/plain',
        name: 'wrong.txt',
        size: 100,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      } as unknown as File

      const validFile = {
        type: 'application/pdf',
        name: 'correct.pdf',
        size: 100,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
      } as unknown as File

      const { result } = renderHook(() => usePdfImport())

      // First import fails
      await act(async () => {
        await result.current.importPdfFromFile(mockFile)
      })
      expect(result.current.error).toBe('Please drop a PDF file')

      // Second import clears error
      await act(async () => {
        await result.current.importPdfFromFile(validFile)
      })
      expect(result.current.error).not.toBe('Please drop a PDF file')
    })

    it('should set progress to 100 on successful import', async () => {
      const pdfContent = new ArrayBuffer(100)
      const mockFile = {
        type: 'application/pdf',
        name: 'test.pdf',
        size: 100,
        arrayBuffer: vi.fn().mockResolvedValue(pdfContent),
      } as unknown as File

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdfFromFile(mockFile)
      })

      expect(result.current.progress).toBe(100)
    })
  })

  describe('dialog cancellation', () => {
    it('should handle canceled dialog gracefully', async () => {
      window.electronAPI.openPdfDialog = vi.fn().mockResolvedValue(null)

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdf()
      })

      expect(result.current.isImporting).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('session name update', () => {
    it('should call setPdfFileName with correct name', async () => {
      const setPdfFileNameMock = vi.fn()
      
      useSessionStore.setState({
        ...useSessionStore.getState(),
        setPdfFileName: setPdfFileNameMock,
      })

      const pdfContent = new ArrayBuffer(100)
      const mockFile = {
        type: 'application/pdf',
        name: 'Lecture Notes.pdf',
        size: 100,
        arrayBuffer: vi.fn().mockResolvedValue(pdfContent),
      } as unknown as File

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdfFromFile(mockFile)
      })

      expect(setPdfFileNameMock).toHaveBeenCalledWith('Lecture Notes.pdf')
    })
  })

  describe('canvas context failure', () => {
    it('should handle canvas context creation failure', async () => {
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => null, // Context creation fails
            toDataURL: () => '',
          } as unknown as HTMLCanvasElement
        }
        return originalCreateElement(tag)
      })

      const pdfContent = new ArrayBuffer(100)
      const mockFile = {
        type: 'application/pdf',
        name: 'test.pdf',
        size: 100,
        arrayBuffer: vi.fn().mockResolvedValue(pdfContent),
      } as unknown as File

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdfFromFile(mockFile)
      })

      expect(result.current.error).toContain('Failed to create canvas context')
    })
  })

  describe('error handling', () => {
    it('should handle file read errors', async () => {
      const mockFile = {
        type: 'application/pdf',
        name: 'test.pdf',
        size: 100,
        arrayBuffer: vi.fn().mockRejectedValue(new Error('Read error')),
      } as unknown as File

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdfFromFile(mockFile)
      })

      expect(result.current.error).toBe('Read error')
      expect(result.current.isImporting).toBe(false)
    })

    it('should handle dialog errors', async () => {
      window.electronAPI.openPdfDialog = vi.fn().mockRejectedValue(new Error('Dialog failed'))

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdf()
      })

      expect(result.current.error).toBe('Dialog failed')
    })

    it('should provide fallback error message for non-Error rejections', async () => {
      window.electronAPI.openPdfDialog = vi.fn().mockRejectedValue('String error')

      const { result } = renderHook(() => usePdfImport())

      await act(async () => {
        await result.current.importPdf()
      })

      expect(result.current.error).toBe('Failed to import PDF')
    })
  })

  describe('return values', () => {
    it('should return false for invalid file type', async () => {
      const mockFile = {
        type: 'text/plain',
        name: 'document.txt',
        size: 100,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
      } as unknown as File

      const { result } = renderHook(() => usePdfImport())

      let returnValue: boolean | undefined
      await act(async () => {
        returnValue = await result.current.importPdfFromFile(mockFile)
      })

      expect(returnValue).toBe(false)
    })

    it('should return true for successful import', async () => {
      const pdfContent = new ArrayBuffer(100)
      const mockFile = {
        type: 'application/pdf',
        name: 'valid.pdf',
        size: 100,
        arrayBuffer: vi.fn().mockResolvedValue(pdfContent),
      } as unknown as File

      const { result } = renderHook(() => usePdfImport())

      let returnValue: boolean | undefined
      await act(async () => {
        returnValue = await result.current.importPdfFromFile(mockFile)
      })

      expect(returnValue).toBe(true)
    })
  })
})
