import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchModal } from '../../renderer/components/SearchModal'
import { useSessionStore } from '../../renderer/stores/sessionStore'

// Mock the session store
vi.mock('../../renderer/stores/sessionStore', () => ({
  useSessionStore: vi.fn(),
}))

describe('SearchModal', () => {
  const mockOnClose = vi.fn()
  const mockSetCurrentSlide = vi.fn()
  
  const mockSession = {
    slides: [
      { id: 'slide-1', extractedText: 'Introduction to Machine Learning' },
      { id: 'slide-2', extractedText: 'Neural Networks Overview' },
      { id: 'slide-3', extractedText: 'Deep Learning Fundamentals' },
    ],
    notes: {
      'slide-1': { plainText: 'Key concepts: supervised learning, unsupervised learning' },
      'slide-2': { plainText: 'Perceptrons and activation functions' },
    },
    transcripts: {
      'slide-1': [{ text: 'Welcome to the course on ML' }],
      'slide-3': [{ text: 'Deep learning is a subset of ML' }],
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useSessionStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      session: mockSession,
      setCurrentSlide: mockSetCurrentSlide,
    })
  })

  it('renders the search input', () => {
    render(<SearchModal onClose={mockOnClose} />)
    
    expect(screen.getByPlaceholderText('Search slides, notes, and transcripts...')).toBeInTheDocument()
  })

  it('shows empty state when no query', () => {
    render(<SearchModal onClose={mockOnClose} />)
    
    expect(screen.getByText('Type to search across all slides, notes, and transcripts')).toBeInTheDocument()
  })

  it('searches slide text', () => {
    render(<SearchModal onClose={mockOnClose} />)
    
    const input = screen.getByPlaceholderText('Search slides, notes, and transcripts...')
    fireEvent.change(input, { target: { value: 'Machine Learning' } })
    
    expect(screen.getByText('Slide 1')).toBeInTheDocument()
  })

  it('searches notes', () => {
    render(<SearchModal onClose={mockOnClose} />)
    
    const input = screen.getByPlaceholderText('Search slides, notes, and transcripts...')
    fireEvent.change(input, { target: { value: 'supervised' } })
    
    expect(screen.getByText('Slide 1')).toBeInTheDocument()
    expect(screen.getByText('Note')).toBeInTheDocument()
  })

  it('searches transcripts', () => {
    render(<SearchModal onClose={mockOnClose} />)
    
    const input = screen.getByPlaceholderText('Search slides, notes, and transcripts...')
    fireEvent.change(input, { target: { value: 'course on ML' } })
    
    expect(screen.getByText('Transcript')).toBeInTheDocument()
  })

  it('shows no results message when no matches', () => {
    render(<SearchModal onClose={mockOnClose} />)
    
    const input = screen.getByPlaceholderText('Search slides, notes, and transcripts...')
    fireEvent.change(input, { target: { value: 'xyz123notfound' } })
    
    expect(screen.getByText(/No results found/)).toBeInTheDocument()
  })

  it('closes on escape key', () => {
    render(<SearchModal onClose={mockOnClose} />)
    
    fireEvent.keyDown(window, { key: 'Escape' })
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('navigates to slide when result is clicked', () => {
    render(<SearchModal onClose={mockOnClose} />)
    
    const input = screen.getByPlaceholderText('Search slides, notes, and transcripts...')
    fireEvent.change(input, { target: { value: 'Neural' } })
    
    // Find and click the result
    const result = screen.getByText('Slide 2')
    fireEvent.click(result.closest('button')!)
    
    expect(mockSetCurrentSlide).toHaveBeenCalledWith(1)
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('clears search when X button is clicked', () => {
    render(<SearchModal onClose={mockOnClose} />)
    
    const input = screen.getByPlaceholderText('Search slides, notes, and transcripts...')
    fireEvent.change(input, { target: { value: 'test' } })
    
    // Find the clear button (X icon)
    const clearButton = screen.getByRole('button', { name: '' })
    fireEvent.click(clearButton)
    
    expect(input).toHaveValue('')
  })

  it('shows result count in footer', () => {
    render(<SearchModal onClose={mockOnClose} />)
    
    const input = screen.getByPlaceholderText('Search slides, notes, and transcripts...')
    fireEvent.change(input, { target: { value: 'learning' } })
    
    expect(screen.getByText(/result/)).toBeInTheDocument()
  })
})

