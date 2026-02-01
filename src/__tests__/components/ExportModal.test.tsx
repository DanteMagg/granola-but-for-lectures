import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExportModal } from '../../renderer/components/ExportModal'
import { useSessionStore } from '../../renderer/stores/sessionStore'

// Mock the session store
vi.mock('../../renderer/stores/sessionStore', () => ({
  useSessionStore: vi.fn(),
}))

// Mock electronAPI
const mockExportPdf = vi.fn()
const mockGeneratePdf = vi.fn()

Object.defineProperty(window, 'electronAPI', {
  value: {
    exportPdf: mockExportPdf,
    generatePdf: mockGeneratePdf,
  },
  writable: true,
})

describe('ExportModal', () => {
  const mockOnClose = vi.fn()
  
  const mockSession = {
    id: 'session-1',
    name: 'Test Session',
    currentSlideIndex: 1,
    slides: [
      { id: 'slide-1', imageData: 'image1' },
      { id: 'slide-2', imageData: 'image2' },
      { id: 'slide-3', imageData: 'image3' },
      { id: 'slide-4', imageData: 'image4' },
      { id: 'slide-5', imageData: 'image5' },
    ],
    notes: {
      'slide-1': { plainText: 'Note 1' },
      'slide-2': { plainText: 'Note 2' },
    },
    transcripts: {
      'slide-1': [{ text: 'Transcript 1' }],
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockExportPdf.mockResolvedValue('/path/to/export.pdf')
    mockGeneratePdf.mockResolvedValue(true)
    ;(useSessionStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      session: mockSession,
    })
  })

  it('renders the export modal', () => {
    render(<ExportModal onClose={mockOnClose} />)
    
    expect(screen.getByText('Export Session')).toBeInTheDocument()
    expect(screen.getByText('Export to PDF')).toBeInTheDocument()
  })

  it('shows content options', () => {
    render(<ExportModal onClose={mockOnClose} />)
    
    expect(screen.getByText('Slide Images')).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Transcripts')).toBeInTheDocument()
  })

  it('shows slide range options including custom', () => {
    render(<ExportModal onClose={mockOnClose} />)
    
    expect(screen.getByText('All Slides')).toBeInTheDocument()
    expect(screen.getByText('Current Slide')).toBeInTheDocument()
    expect(screen.getByText('Custom Range')).toBeInTheDocument()
  })

  it('shows custom range inputs when custom is selected', () => {
    render(<ExportModal onClose={mockOnClose} />)
    
    fireEvent.click(screen.getByText('Custom Range'))
    
    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByText('To')).toBeInTheDocument()
    expect(screen.getByText('of 5 slides')).toBeInTheDocument()
  })

  it('allows toggling content options', () => {
    render(<ExportModal onClose={mockOnClose} />)
    
    const slideImagesCheckbox = screen.getAllByRole('checkbox')[0]
    expect(slideImagesCheckbox).toBeChecked()
    
    fireEvent.click(slideImagesCheckbox)
    expect(slideImagesCheckbox).not.toBeChecked()
  })

  it('closes when cancel is clicked', () => {
    render(<ExportModal onClose={mockOnClose} />)
    
    fireEvent.click(screen.getByText('Cancel'))
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('closes when clicking overlay', () => {
    render(<ExportModal onClose={mockOnClose} />)
    
    const overlay = document.querySelector('.modal-overlay')
    fireEvent.click(overlay!)
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('disables export button when no content is selected', () => {
    render(<ExportModal onClose={mockOnClose} />)
    
    // Uncheck all options
    const checkboxes = screen.getAllByRole('checkbox')
    checkboxes.forEach(checkbox => {
      if ((checkbox as HTMLInputElement).checked) {
        fireEvent.click(checkbox)
      }
    })
    
    expect(screen.getByText('Export PDF').closest('button')).toBeDisabled()
  })

  it('exports all slides when "All Slides" is selected', async () => {
    render(<ExportModal onClose={mockOnClose} />)
    
    fireEvent.click(screen.getByText('Export PDF'))
    
    await waitFor(() => {
      expect(mockGeneratePdf).toHaveBeenCalled()
      const exportData = mockGeneratePdf.mock.calls[0][1]
      expect(exportData.slides.length).toBe(5)
    })
  })

  it('exports only current slide when "Current Slide" is selected', async () => {
    render(<ExportModal onClose={mockOnClose} />)
    
    fireEvent.click(screen.getByText('Current Slide'))
    fireEvent.click(screen.getByText('Export PDF'))
    
    await waitFor(() => {
      expect(mockGeneratePdf).toHaveBeenCalled()
      const exportData = mockGeneratePdf.mock.calls[0][1]
      expect(exportData.slides.length).toBe(1)
      expect(exportData.slides[0].index).toBe(2) // currentSlideIndex + 1
    })
  })

  it('exports custom range when specified', async () => {
    render(<ExportModal onClose={mockOnClose} />)
    
    fireEvent.click(screen.getByText('Custom Range'))
    
    // Set range from 2 to 4
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[0], { target: { value: '2' } })
    fireEvent.change(inputs[1], { target: { value: '4' } })
    
    fireEvent.click(screen.getByText('Export PDF'))
    
    await waitFor(() => {
      expect(mockGeneratePdf).toHaveBeenCalled()
      const exportData = mockGeneratePdf.mock.calls[0][1]
      expect(exportData.slides.length).toBe(3) // slides 2, 3, 4
      expect(exportData.slides[0].index).toBe(2)
    })
  })

  it('validates custom range bounds', () => {
    render(<ExportModal onClose={mockOnClose} />)
    
    fireEvent.click(screen.getByText('Custom Range'))
    
    const inputs = screen.getAllByRole('spinbutton')
    const fromInput = inputs[0] as HTMLInputElement
    const toInput = inputs[1] as HTMLInputElement
    
    // Try to set start beyond slide count
    fireEvent.change(fromInput, { target: { value: '10' } })
    expect(parseInt(fromInput.value)).toBeLessThanOrEqual(5)
    
    // Try to set negative end
    fireEvent.change(toInput, { target: { value: '-1' } })
    expect(parseInt(toInput.value)).toBeGreaterThanOrEqual(1)
  })
})

