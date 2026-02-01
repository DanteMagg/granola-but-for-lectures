/**
 * Performance utilities for the application
 */

import { useCallback, useEffect, useRef } from 'react'

/**
 * Debounce a function call
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args)
      timeoutId = null
    }, wait)
  }
}

/**
 * Throttle a function call
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

/**
 * Hook to debounce a callback
 */
export function useDebouncedCallback<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback)

  // Update ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    debounce((...args: Parameters<T>) => {
      callbackRef.current(...args)
    }, delay),
    [delay]
  )
}

/**
 * Hook to throttle a callback
 */
export function useThrottledCallback<T extends (...args: Parameters<T>) => void>(
  callback: T,
  limit: number
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback)

  // Update ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    throttle((...args: Parameters<T>) => {
      callbackRef.current(...args)
    }, limit),
    [limit]
  )
}

/**
 * Hook to measure render performance in development
 */
export function useRenderCount(componentName: string): void {
  const renderCount = useRef(0)

  useEffect(() => {
    renderCount.current += 1
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Render] ${componentName}: ${renderCount.current} renders`)
    }
  })
}

/**
 * Hook for cleanup on unmount
 */
export function useCleanup(cleanup: () => void): void {
  const cleanupRef = useRef(cleanup)

  useEffect(() => {
    cleanupRef.current = cleanup
  }, [cleanup])

  useEffect(() => {
    return () => {
      cleanupRef.current()
    }
  }, [])
}

/**
 * Memory cleanup utility for image data
 * Revokes blob URLs to prevent memory leaks
 */
export function revokeImageUrls(urls: string[]): void {
  urls.forEach((url) => {
    if (url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // Ignore errors
      }
    }
  })
}

/**
 * Lazy load an image
 */
export async function lazyLoadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Hook for intersection observer based lazy loading
 */
export function useIntersectionObserver(
  callback: (isIntersecting: boolean) => void,
  options?: IntersectionObserverInit
): React.RefCallback<Element> {
  const observerRef = useRef<IntersectionObserver | null>(null)

  return useCallback(
    (element: Element | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }

      if (!element) return

      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            callback(entry.isIntersecting)
          })
        },
        {
          threshold: 0.1,
          ...options,
        }
      )

      observerRef.current.observe(element)
    },
    [callback, options]
  )
}

/**
 * Request idle callback polyfill
 */
export function requestIdleCallback(
  callback: IdleRequestCallback,
  options?: IdleRequestOptions
): number {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return (window as Window & typeof globalThis).requestIdleCallback(callback, options)
  }

  // Fallback for Safari and older browsers
  return setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => 50,
    })
  }, 1) as unknown as number
}

/**
 * Cancel idle callback polyfill
 */
export function cancelIdleCallback(id: number): void {
  if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
    (window as Window & typeof globalThis).cancelIdleCallback(id)
  } else {
    clearTimeout(id)
  }
}

/**
 * Execute work during idle time
 */
export function runDuringIdle<T>(work: () => T): Promise<T> {
  return new Promise((resolve) => {
    requestIdleCallback(() => {
      resolve(work())
    })
  })
}

