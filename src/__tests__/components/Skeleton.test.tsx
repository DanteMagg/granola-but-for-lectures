import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Skeleton,
  SlideSkeleton,
  SlideThumbSkeleton,
  NotesPanelSkeleton,
  TranscriptPanelSkeleton,
  SessionListSkeleton,
  ChatMessageSkeleton,
  PageLoadingSkeleton,
  ProgressBar,
  Spinner,
  LoadingOverlay,
} from '../../renderer/components/Skeleton'

describe('Skeleton', () => {
  describe('base Skeleton component', () => {
    it('should render with default classes', () => {
      const { container } = render(<Skeleton />)
      const skeleton = container.firstChild as HTMLElement

      expect(skeleton).toHaveClass('bg-zinc-200')
      expect(skeleton).toHaveClass('rounded')
      expect(skeleton).toHaveClass('animate-pulse')
    })

    it('should accept custom className', () => {
      const { container } = render(<Skeleton className="h-10 w-32" />)
      const skeleton = container.firstChild as HTMLElement

      expect(skeleton).toHaveClass('h-10')
      expect(skeleton).toHaveClass('w-32')
    })

    it('should disable animation when animate is false', () => {
      const { container } = render(<Skeleton animate={false} />)
      const skeleton = container.firstChild as HTMLElement

      expect(skeleton).not.toHaveClass('animate-pulse')
    })
  })

  describe('SlideSkeleton', () => {
    it('should render slide skeleton with aspect ratio', () => {
      const { container } = render(<SlideSkeleton />)

      expect(container.querySelector('.aspect-\\[16\\/9\\]')).toBeInTheDocument()
    })

    it('should render additional metadata skeletons', () => {
      const { container } = render(<SlideSkeleton />)
      const skeletons = container.querySelectorAll('.bg-zinc-200')

      expect(skeletons.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('SlideThumbSkeleton', () => {
    it('should render thumbnail with correct width', () => {
      const { container } = render(<SlideThumbSkeleton />)

      expect(container.querySelector('.w-24')).toBeInTheDocument()
    })

    it('should render aspect ratio element', () => {
      const { container } = render(<SlideThumbSkeleton />)

      expect(container.querySelector('.aspect-\\[16\\/9\\]')).toBeInTheDocument()
    })
  })

  describe('NotesPanelSkeleton', () => {
    it('should render with padding', () => {
      const { container } = render(<NotesPanelSkeleton />)

      expect(container.querySelector('.p-4')).toBeInTheDocument()
    })

    it('should render multiple line skeletons', () => {
      const { container } = render(<NotesPanelSkeleton />)
      const skeletons = container.querySelectorAll('.bg-zinc-200')

      expect(skeletons.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe('TranscriptPanelSkeleton', () => {
    it('should render with padding', () => {
      const { container } = render(<TranscriptPanelSkeleton />)

      expect(container.querySelector('.p-4')).toBeInTheDocument()
    })

    it('should render 4 transcript line skeletons', () => {
      const { container } = render(<TranscriptPanelSkeleton />)
      // Each transcript line has 2 skeletons (timestamp + text)
      const rows = container.querySelectorAll('.flex.gap-2')

      expect(rows.length).toBe(4)
    })
  })

  describe('SessionListSkeleton', () => {
    it('should render 5 session item skeletons', () => {
      const { container } = render(<SessionListSkeleton />)
      const items = container.querySelectorAll('.border-zinc-100')

      expect(items.length).toBe(5)
    })
  })

  describe('ChatMessageSkeleton', () => {
    it('should render assistant message with avatar on left', () => {
      const { container } = render(<ChatMessageSkeleton isUser={false} />)

      expect(container.querySelector('.rounded-full')).toBeInTheDocument()
      expect(container.querySelector('.justify-end')).not.toBeInTheDocument()
    })

    it('should render user message aligned to right', () => {
      const { container } = render(<ChatMessageSkeleton isUser={true} />)

      expect(container.querySelector('.justify-end')).toBeInTheDocument()
    })
  })

  describe('PageLoadingSkeleton', () => {
    it('should render header skeleton', () => {
      const { container } = render(<PageLoadingSkeleton />)

      expect(container.querySelector('.h-12')).toBeInTheDocument()
    })

    it('should render sidebar skeleton', () => {
      const { container } = render(<PageLoadingSkeleton />)

      expect(container.querySelector('.w-64')).toBeInTheDocument()
    })

    it('should include SessionListSkeleton', () => {
      const { container } = render(<PageLoadingSkeleton />)
      // SessionListSkeleton has 5 items with border-zinc-100
      const sessionItems = container.querySelectorAll('.border-zinc-100')

      expect(sessionItems.length).toBe(5)
    })

    it('should include SlideThumbSkeletons', () => {
      const { container } = render(<PageLoadingSkeleton />)
      // Has thumbnails container
      expect(container.querySelector('.w-28')).toBeInTheDocument()
    })
  })
})

describe('ProgressBar', () => {
  it('should render with progress value', () => {
    const { container } = render(<ProgressBar progress={50} />)

    const bar = container.querySelector('[style*="width: 50%"]')
    expect(bar).toBeInTheDocument()
  })

  it('should clamp progress to 0-100', () => {
    const { container: containerOver } = render(<ProgressBar progress={150} />)
    expect(containerOver.querySelector('[style*="width: 100%"]')).toBeInTheDocument()

    const { container: containerUnder } = render(<ProgressBar progress={-10} />)
    expect(containerUnder.querySelector('[style*="width: 0%"]')).toBeInTheDocument()
  })

  it('should show percentage when showPercentage is true', () => {
    render(<ProgressBar progress={75} showPercentage />)

    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('should not show percentage by default', () => {
    render(<ProgressBar progress={75} />)

    expect(screen.queryByText('75%')).not.toBeInTheDocument()
  })

  it('should render default variant', () => {
    const { container } = render(<ProgressBar progress={50} />)
    const bar = container.querySelector('.bg-zinc-900')

    expect(bar).toBeInTheDocument()
  })

  it('should render success variant', () => {
    const { container } = render(<ProgressBar progress={50} variant="success" />)
    const bar = container.querySelector('.bg-green-500')

    expect(bar).toBeInTheDocument()
  })

  it('should render warning variant', () => {
    const { container } = render(<ProgressBar progress={50} variant="warning" />)
    const bar = container.querySelector('.bg-amber-500')

    expect(bar).toBeInTheDocument()
  })

  it('should render error variant', () => {
    const { container } = render(<ProgressBar progress={50} variant="error" />)
    const bar = container.querySelector('.bg-red-500')

    expect(bar).toBeInTheDocument()
  })

  it('should accept custom className', () => {
    const { container } = render(<ProgressBar progress={50} className="my-custom-class" />)

    expect(container.firstChild).toHaveClass('my-custom-class')
  })
})

describe('Spinner', () => {
  it('should render with default md size', () => {
    const { container } = render(<Spinner />)
    const spinner = container.firstChild as HTMLElement

    expect(spinner).toHaveClass('w-6')
    expect(spinner).toHaveClass('h-6')
  })

  it('should render sm size', () => {
    const { container } = render(<Spinner size="sm" />)
    const spinner = container.firstChild as HTMLElement

    expect(spinner).toHaveClass('w-4')
    expect(spinner).toHaveClass('h-4')
  })

  it('should render lg size', () => {
    const { container } = render(<Spinner size="lg" />)
    const spinner = container.firstChild as HTMLElement

    expect(spinner).toHaveClass('w-8')
    expect(spinner).toHaveClass('h-8')
  })

  it('should have spin animation', () => {
    const { container } = render(<Spinner />)
    const spinner = container.firstChild as HTMLElement

    expect(spinner).toHaveClass('animate-spin')
  })

  it('should accept custom className', () => {
    const { container } = render(<Spinner className="text-blue-500" />)
    const spinner = container.firstChild as HTMLElement

    expect(spinner).toHaveClass('text-blue-500')
  })
})

describe('LoadingOverlay', () => {
  it('should render spinner', () => {
    const { container } = render(<LoadingOverlay />)

    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('should render message when provided', () => {
    render(<LoadingOverlay message="Loading data..." />)

    expect(screen.getByText('Loading data...')).toBeInTheDocument()
  })

  it('should not render message when not provided', () => {
    const { container } = render(<LoadingOverlay />)
    const textElements = container.querySelectorAll('p')

    expect(textElements.length).toBe(0)
  })

  it('should render progress bar when progress is provided', () => {
    render(<LoadingOverlay progress={60} />)

    expect(screen.getByText('60%')).toBeInTheDocument()
  })

  it('should not render progress bar when progress is not provided', () => {
    const { container } = render(<LoadingOverlay />)
    
    // Progress bar wrapper has w-48 class
    expect(container.querySelector('.w-48')).not.toBeInTheDocument()
  })

  it('should render both message and progress', () => {
    render(<LoadingOverlay message="Processing..." progress={45} />)

    expect(screen.getByText('Processing...')).toBeInTheDocument()
    expect(screen.getByText('45%')).toBeInTheDocument()
  })

  it('should have overlay styling', () => {
    const { container } = render(<LoadingOverlay />)
    const overlay = container.firstChild as HTMLElement

    expect(overlay).toHaveClass('absolute')
    expect(overlay).toHaveClass('inset-0')
    expect(overlay).toHaveClass('z-50')
  })
})

