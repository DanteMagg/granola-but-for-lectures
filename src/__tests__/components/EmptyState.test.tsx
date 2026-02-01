import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EmptyState } from '../../renderer/components/EmptyState'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import { usePdfImport } from '../../renderer/hooks/usePdfImport'
import { createMockSession } from '../helpers/mockData'

// Mock the stores and hooks
vi.mock('../../renderer/stores/sessionStore')
vi.mock('../../renderer/hooks/usePdfImport')
vi.mock('../../renderer/stores/toastStore', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }
}))

const mockUseSessionStore = vi.mocked(useSessionStore)
const mockUsePdfImport = vi.mocked(usePdfImport)

describe('EmptyState', () => {
  const mockCreateSession = vi.fn()
  const mockImportPdf = vi.fn()
  const mockImportPdfFromFile = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockCreateSession.mockResolvedValue(createMockSession())
    mockImportPdf.mockResolvedValue(undefined)
    mockImportPdfFromFile.mockResolvedValue(true)

    mockUsePdfImport.mockReturnValue({
      importPdf: mockImportPdf,
      importPdfFromFile: mockImportPdfFromFile,
      isImporting: false,
      progress: 0,
      error: null,
    })
  })

  describe('rendering', () => {
    it('should show welcome message when no session', () => {
      mockUseSessionStore.mockReturnValue({
        session: null,
        createSession: mockCreateSession,
      } as any)

      render(<EmptyState />)
      
      expect(screen.getByText('Welcome to Lecture Notes')).toBeInTheDocument()
      expect(screen.getByText('Your private, AI-powered lecture note companion.')).toBeInTheDocument()
    })

    it('should show import message when session exists', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession(),
        createSession: mockCreateSession,
      } as any)

      render(<EmptyState />)
      
      expect(screen.getByText('Import Your Slides')).toBeInTheDocument()
      expect(screen.getByText('Add a PDF to start taking notes synced to each slide.')).toBeInTheDocument()
    })

    it('should show feature cards when no session', () => {
      mockUseSessionStore.mockReturnValue({
        session: null,
        createSession: mockCreateSession,
      } as any)

      render(<EmptyState />)
      
      expect(screen.getByText('AI-Powered')).toBeInTheDocument()
      expect(screen.getByText('100% Private')).toBeInTheDocument()
    })

    it('should not show feature cards when session exists', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession(),
        createSession: mockCreateSession,
      } as any)

      render(<EmptyState />)
      
      expect(screen.queryByText('AI-Powered')).not.toBeInTheDocument()
      expect(screen.queryByText('100% Private')).not.toBeInTheDocument()
    })

    it('should show keyboard shortcut hints', () => {
      mockUseSessionStore.mockReturnValue({
        session: null,
        createSession: mockCreateSession,
      } as any)

      render(<EmptyState />)
      
      expect(screen.getByText('Navigate slides')).toBeInTheDocument()
      expect(screen.getByText('Ask AI')).toBeInTheDocument()
    })
  })

  describe('import button', () => {
    it('should show Import PDF button', () => {
      mockUseSessionStore.mockReturnValue({
        session: null,
        createSession: mockCreateSession,
      } as any)

      render(<EmptyState />)
      
      expect(screen.getByText('Import PDF Slides')).toBeInTheDocument()
      expect(screen.getByText('Click to browse or drag & drop')).toBeInTheDocument()
    })

    it('should create session and import PDF when clicked', async () => {
      mockUseSessionStore.mockReturnValue({
        session: null,
        createSession: mockCreateSession,
      } as any)

      render(<EmptyState />)
      
      const importButton = screen.getByRole('button', { name: /Import PDF/i })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(mockCreateSession).toHaveBeenCalled()
        expect(mockImportPdf).toHaveBeenCalled()
      })
    })

    it('should not create session if one exists', async () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession(),
        createSession: mockCreateSession,
      } as any)

      render(<EmptyState />)
      
      const importButton = screen.getByRole('button', { name: /Import PDF/i })
      fireEvent.click(importButton)
      
      await waitFor(() => {
        expect(mockCreateSession).not.toHaveBeenCalled()
        expect(mockImportPdf).toHaveBeenCalled()
      })
    })

    it('should show loading state when importing', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession(),
        createSession: mockCreateSession,
      } as any)

      mockUsePdfImport.mockReturnValue({
        importPdf: mockImportPdf,
        importPdfFromFile: mockImportPdfFromFile,
        isImporting: true,
        progress: 50,
        error: null,
      })

      render(<EmptyState />)
      
      expect(screen.getByText('Processing PDF...')).toBeInTheDocument()
    })
  })

  describe('drag and drop', () => {
    it('should show drag overlay when dragging file over', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession(),
        createSession: mockCreateSession,
      } as any)

      render(<EmptyState />)
      
      const dropZone = screen.getByText('Import PDF Slides').closest('div')!
      
      fireEvent.dragEnter(dropZone, {
        dataTransfer: {
          types: ['Files'],
        },
      })
      
      expect(screen.getByText('Drop PDF here')).toBeInTheDocument()
      expect(screen.getByText('Release to import slides')).toBeInTheDocument()
    })

    it('should hide drag overlay when drop happens', async () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession(),
        createSession: mockCreateSession,
      } as any)

      const { container } = render(<EmptyState />)
      
      const dropZone = container.querySelector('.flex-1')!
      
      fireEvent.dragEnter(dropZone, {
        dataTransfer: {
          types: ['Files'],
        },
      })
      
      expect(screen.getByText('Drop PDF here')).toBeInTheDocument()
      
      // Drop a file to exit drag state
      const pdfFile = new File(['test'], 'lecture.pdf', { type: 'application/pdf' })
      
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [pdfFile],
        },
      })
      
      // After drop, overlay should be hidden
      await waitFor(() => {
        expect(screen.queryByText('Drop PDF here')).not.toBeInTheDocument()
      })
    })

    it('should import PDF when valid file is dropped', async () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession(),
        createSession: mockCreateSession,
      } as any)

      const { container } = render(<EmptyState />)
      
      const dropZone = container.querySelector('.flex-1')!
      
      const pdfFile = new File(['test'], 'lecture.pdf', { type: 'application/pdf' })
      
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [pdfFile],
        },
      })
      
      await waitFor(() => {
        expect(mockImportPdfFromFile).toHaveBeenCalledWith(pdfFile)
      })
    })

    it('should show error when non-PDF file is dropped', async () => {
      const { toast } = await import('../../renderer/stores/toastStore')
      
      mockUseSessionStore.mockReturnValue({
        session: createMockSession(),
        createSession: mockCreateSession,
      } as any)

      const { container } = render(<EmptyState />)
      
      const dropZone = container.querySelector('.flex-1')!
      
      const txtFile = new File(['test'], 'document.txt', { type: 'text/plain' })
      
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [txtFile],
        },
      })
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid File Type', 'Only PDF files are supported')
      })
    })

    it('should show error when multiple files are dropped', async () => {
      const { toast } = await import('../../renderer/stores/toastStore')
      
      mockUseSessionStore.mockReturnValue({
        session: createMockSession(),
        createSession: mockCreateSession,
      } as any)

      const { container } = render(<EmptyState />)
      
      const dropZone = container.querySelector('.flex-1')!
      
      const file1 = new File(['test'], 'lecture1.pdf', { type: 'application/pdf' })
      const file2 = new File(['test'], 'lecture2.pdf', { type: 'application/pdf' })
      
      fireEvent.drop(dropZone, {
        dataTransfer: {
          files: [file1, file2],
        },
      })
      
      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith('Multiple Files', 'Please drop only one PDF file at a time')
      })
    })
  })
})

