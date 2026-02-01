import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OnboardingModal, useOnboarding } from '../../renderer/components/OnboardingModal'
import { renderHook, act } from '@testing-library/react'

describe('OnboardingModal', () => {
  const mockOnComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders the welcome screen initially', () => {
    render(<OnboardingModal onComplete={mockOnComplete} />)
    
    expect(screen.getByText('Welcome to Lecture Notes')).toBeInTheDocument()
    expect(screen.getByText('Privacy First')).toBeInTheDocument()
    expect(screen.getByText('Get Started')).toBeInTheDocument()
  })

  it('shows privacy features on welcome screen', () => {
    render(<OnboardingModal onComplete={mockOnComplete} />)
    
    expect(screen.getByText('No account required')).toBeInTheDocument()
    expect(screen.getByText('Works completely offline')).toBeInTheDocument()
    expect(screen.getByText('Local AI models for transcription & chat')).toBeInTheDocument()
    expect(screen.getByText('Your recordings stay on your device')).toBeInTheDocument()
  })

  it('advances to first tour step when clicking Get Started', () => {
    render(<OnboardingModal onComplete={mockOnComplete} />)
    
    fireEvent.click(screen.getByText('Get Started'))
    
    expect(screen.getByText('Import Your Slides')).toBeInTheDocument()
  })

  it('advances through all tour steps', () => {
    render(<OnboardingModal onComplete={mockOnComplete} />)
    
    // Go to step 1
    fireEvent.click(screen.getByText('Get Started'))
    expect(screen.getByText('Import Your Slides')).toBeInTheDocument()
    
    // Go to step 2
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Record & Take Notes')).toBeInTheDocument()
    
    // Go to step 3
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Ask AI & Export')).toBeInTheDocument()
    
    // Complete
    fireEvent.click(screen.getByText('Start Using App'))
    
    // Wait for timeout
    setTimeout(() => {
      expect(mockOnComplete).toHaveBeenCalled()
    }, 300)
  })

  it('allows skipping the onboarding', () => {
    render(<OnboardingModal onComplete={mockOnComplete} />)
    
    fireEvent.click(screen.getByText('Skip intro'))
    
    setTimeout(() => {
      expect(mockOnComplete).toHaveBeenCalled()
    }, 300)
  })

  it('allows going back through steps', () => {
    render(<OnboardingModal onComplete={mockOnComplete} />)
    
    // Go to step 1
    fireEvent.click(screen.getByText('Get Started'))
    expect(screen.getByText('Import Your Slides')).toBeInTheDocument()
    
    // Go to step 2
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Record & Take Notes')).toBeInTheDocument()
    
    // Go back to step 1
    fireEvent.click(screen.getByText('Back'))
    expect(screen.getByText('Import Your Slides')).toBeInTheDocument()
    
    // Go back to welcome
    fireEvent.click(screen.getByText('Back'))
    expect(screen.getByText('Welcome to Lecture Notes')).toBeInTheDocument()
  })
})

describe('useOnboarding hook', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows onboarding when not completed', () => {
    const { result } = renderHook(() => useOnboarding())
    
    expect(result.current.showOnboarding).toBe(true)
  })

  it('hides onboarding when completed', () => {
    localStorage.setItem('lecture-note-companion-onboarded', 'true')
    
    const { result } = renderHook(() => useOnboarding())
    
    expect(result.current.showOnboarding).toBe(false)
  })

  it('completeOnboarding hides the modal', () => {
    const { result } = renderHook(() => useOnboarding())
    
    act(() => {
      result.current.completeOnboarding()
    })
    
    expect(result.current.showOnboarding).toBe(false)
  })

  it('resetOnboarding shows the modal again', () => {
    localStorage.setItem('lecture-note-companion-onboarded', 'true')
    
    const { result } = renderHook(() => useOnboarding())
    
    expect(result.current.showOnboarding).toBe(false)
    
    act(() => {
      result.current.resetOnboarding()
    })
    
    expect(result.current.showOnboarding).toBe(true)
  })
})

