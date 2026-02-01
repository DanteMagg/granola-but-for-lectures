/**
 * Skeleton loader components for loading states
 */

import { clsx } from 'clsx'

interface SkeletonProps {
  className?: string
  animate?: boolean
}

export function Skeleton({ className, animate = true }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'bg-zinc-200 rounded',
        animate && 'animate-pulse',
        className
      )}
    />
  )
}

// Slide skeleton
export function SlideSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-[16/9] w-full rounded-lg" />
      <div className="flex gap-2 items-center">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  )
}

// Slide thumbnail skeleton
export function SlideThumbSkeleton() {
  return (
    <div className="w-24 flex flex-col gap-1">
      <Skeleton className="aspect-[16/9] w-full rounded-md" />
      <Skeleton className="h-3 w-8 mx-auto" />
    </div>
  )
}

// Notes panel skeleton
export function NotesPanelSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-6 w-20" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}

// Transcript panel skeleton
export function TranscriptPanelSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-5 w-24" />
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-2">
            <Skeleton className="h-4 w-12 flex-shrink-0" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Sidebar session list skeleton
export function SessionListSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="p-3 rounded-lg border border-zinc-100">
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

// Chat message skeleton
export function ChatMessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={clsx('flex gap-2 mb-4', isUser && 'justify-end')}>
      {!isUser && <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />}
      <div className={clsx('max-w-[80%] space-y-2', isUser && 'items-end')}>
        <Skeleton className={clsx('h-4', isUser ? 'w-48' : 'w-64')} />
        <Skeleton className={clsx('h-4', isUser ? 'w-32' : 'w-56')} />
        {!isUser && <Skeleton className="h-4 w-40" />}
      </div>
      {isUser && <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />}
    </div>
  )
}

// Full page loading skeleton
export function PageLoadingSkeleton() {
  return (
    <div className="h-full flex flex-col bg-zinc-50">
      {/* Header skeleton */}
      <div className="h-12 border-b border-zinc-200 flex items-center justify-between px-4">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-2">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="w-8 h-8 rounded-lg" />
        </div>
      </div>
      
      {/* Main content skeleton */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-64 border-r border-zinc-200 p-4 space-y-4">
          <Skeleton className="h-10 w-full rounded-lg" />
          <SessionListSkeleton />
        </div>
        
        {/* Content area */}
        <div className="flex-1 p-4 flex gap-4">
          {/* Thumbnails */}
          <div className="w-28 space-y-2">
            {[...Array(4)].map((_, i) => (
              <SlideThumbSkeleton key={i} />
            ))}
          </div>
          
          {/* Main slide */}
          <div className="flex-1">
            <SlideSkeleton />
          </div>
          
          {/* Notes panel */}
          <div className="w-80 border-l border-zinc-200">
            <NotesPanelSkeleton />
          </div>
        </div>
      </div>
    </div>
  )
}

// Progress bar component
interface ProgressBarProps {
  progress: number
  className?: string
  showPercentage?: boolean
  variant?: 'default' | 'success' | 'warning' | 'error'
}

export function ProgressBar({ 
  progress, 
  className, 
  showPercentage = false,
  variant = 'default' 
}: ProgressBarProps) {
  const variantColors = {
    default: 'bg-zinc-900',
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  }

  return (
    <div className={clsx('space-y-1', className)}>
      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full transition-all duration-300 rounded-full',
            variantColors[variant]
          )}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      {showPercentage && (
        <p className="text-[10px] text-muted-foreground text-right">
          {Math.round(progress)}%
        </p>
      )}
    </div>
  )
}

// Spinner component
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
  }

  return (
    <div
      className={clsx(
        'rounded-full border-zinc-200 border-t-zinc-900 animate-spin',
        sizeClasses[size],
        className
      )}
    />
  )
}

// Loading overlay
interface LoadingOverlayProps {
  message?: string
  progress?: number
}

export function LoadingOverlay({ message, progress }: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center space-y-4">
        <Spinner size="lg" className="mx-auto" />
        {message && (
          <p className="text-sm font-medium text-foreground">{message}</p>
        )}
        {typeof progress === 'number' && (
          <div className="w-48">
            <ProgressBar progress={progress} showPercentage />
          </div>
        )}
      </div>
    </div>
  )
}

