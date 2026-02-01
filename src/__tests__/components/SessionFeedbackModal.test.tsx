import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionFeedbackModal } from '../../renderer/components/SessionFeedbackModal'

describe('SessionFeedbackModal', () => {
  const mockOnSubmit = vi.fn()
  const mockOnSkip = vi.fn()
  
  const mockStats = {
    slidesReviewed: 5,
    totalSlides: 10,
    notesWritten: 3,
    transcriptSegments: 15,
    recordingDuration: 300000, // 5 minutes
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders session summary stats', () => {
    render(
      <SessionFeedbackModal
        stats={mockStats}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    )
    
    expect(screen.getByText('Session Complete!')).toBeInTheDocument()
    expect(screen.getByText('5m 0s')).toBeInTheDocument() // Recording time
    expect(screen.getByText('5/10')).toBeInTheDocument() // Slides reviewed
    expect(screen.getByText('3')).toBeInTheDocument() // Notes written
    expect(screen.getByText('15')).toBeInTheDocument() // Transcript segments
  })

  it('shows rating stars', () => {
    render(
      <SessionFeedbackModal
        stats={mockStats}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    )
    
    // Should have 5 star buttons
    const buttons = screen.getAllByRole('button')
    const starButtons = buttons.filter(btn => btn.querySelector('svg'))
    expect(starButtons.length).toBeGreaterThanOrEqual(5)
  })

  it('allows rating selection', () => {
    render(
      <SessionFeedbackModal
        stats={mockStats}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    )
    
    // Click the 4th star
    const starButtons = screen.getAllByRole('button').filter(btn => {
      const svg = btn.querySelector('svg')
      return svg && svg.classList.contains('w-8')
    })
    
    if (starButtons.length >= 4) {
      fireEvent.click(starButtons[3])
    }
  })

  it('disables submit when no rating selected', () => {
    render(
      <SessionFeedbackModal
        stats={mockStats}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    )
    
    const submitButton = screen.getByText('Submit')
    expect(submitButton).toBeDisabled()
  })

  it('enables submit after rating is selected', () => {
    render(
      <SessionFeedbackModal
        stats={mockStats}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    )
    
    // Find star buttons by looking for buttons that contain the star icon
    const buttons = screen.getAllByRole('button')
    const starButtons = buttons.filter(btn => {
      const svg = btn.querySelector('svg')
      return svg?.classList.contains('w-8')
    })
    
    if (starButtons.length > 0) {
      fireEvent.click(starButtons[0])
    }
    
    const submitButton = screen.getByText('Submit')
    expect(submitButton).not.toBeDisabled()
  })

  it('calls onSkip when skip is clicked', () => {
    render(
      <SessionFeedbackModal
        stats={mockStats}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    )
    
    fireEvent.click(screen.getByText('Skip'))
    
    expect(mockOnSkip).toHaveBeenCalled()
  })

  it('calls onSubmit with rating and feedback when submitted', () => {
    render(
      <SessionFeedbackModal
        stats={mockStats}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    )
    
    // Select a rating
    const buttons = screen.getAllByRole('button')
    const starButtons = buttons.filter(btn => {
      const svg = btn.querySelector('svg')
      return svg?.classList.contains('w-8')
    })
    
    if (starButtons.length >= 4) {
      fireEvent.click(starButtons[3]) // 4 stars
    }
    
    // Enter feedback
    const textarea = screen.getByPlaceholderText('Any feedback? (optional)')
    fireEvent.change(textarea, { target: { value: 'Great session!' } })
    
    // Submit
    fireEvent.click(screen.getByText('Submit'))
    
    expect(mockOnSubmit).toHaveBeenCalledWith(4, 'Great session!')
  })

  it('formats duration correctly for hours', () => {
    const statsWithHours = {
      ...mockStats,
      recordingDuration: 3900000, // 1h 5m
    }
    
    render(
      <SessionFeedbackModal
        stats={statsWithHours}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    )
    
    expect(screen.getByText('1h 5m')).toBeInTheDocument()
  })

  it('closes when overlay is clicked', () => {
    render(
      <SessionFeedbackModal
        stats={mockStats}
        onSubmit={mockOnSubmit}
        onSkip={mockOnSkip}
      />
    )
    
    const overlay = document.querySelector('.modal-overlay')
    fireEvent.click(overlay!)
    
    expect(mockOnSkip).toHaveBeenCalled()
  })
})

