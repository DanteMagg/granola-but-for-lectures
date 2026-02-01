/**
 * useSlideImage Hook
 * Handles lazy loading of slide images from disk
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { createLogger } from '../lib/logger'

const log = createLogger('slideImage')

// In-memory cache for loaded images
const imageCache = new Map<string, string>()

// Track pending loads to prevent duplicate requests
const pendingLoads = new Map<string, Promise<string | null>>()

interface UseSlideImageOptions {
  sessionId: string | null
  slideId: string | null
  // If provided, use this as the initial image data (for newly imported slides)
  initialImageData?: string
  // Whether to automatically load the image
  autoLoad?: boolean
}

interface UseSlideImageReturn {
  imageData: string | null
  isLoading: boolean
  error: string | null
  loadImage: () => Promise<string | null>
  saveImage: (imageData: string) => Promise<boolean>
  clearCache: () => void
}

export function useSlideImage({
  sessionId,
  slideId,
  initialImageData,
  autoLoad = true,
}: UseSlideImageOptions): UseSlideImageReturn {
  const [imageData, setImageData] = useState<string | null>(initialImageData || null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  // Generate cache key
  const cacheKey = sessionId && slideId ? `${sessionId}:${slideId}` : null

  // Load image from disk or cache
  const loadImage = useCallback(async (): Promise<string | null> => {
    if (!sessionId || !slideId) {
      return null
    }

    // Check cache first
    if (cacheKey && imageCache.has(cacheKey)) {
      const cached = imageCache.get(cacheKey)!
      setImageData(cached)
      return cached
    }

    // Check if already loading
    if (cacheKey && pendingLoads.has(cacheKey)) {
      return pendingLoads.get(cacheKey)!
    }

    setIsLoading(true)
    setError(null)

    const loadPromise = (async () => {
      try {
        const data = await window.electronAPI.loadSlideImage(sessionId, slideId)
        
        if (!mountedRef.current) return null

        if (data) {
          // Cache the loaded image
          if (cacheKey) {
            imageCache.set(cacheKey, data)
          }
          setImageData(data)
          return data
        } else {
          // No image on disk, might be a new slide
          return null
        }
      } catch (err) {
        if (!mountedRef.current) return null
        
        const message = err instanceof Error ? err.message : 'Failed to load image'
        log.error('Failed to load slide image', { sessionId, slideId, error: message })
        setError(message)
        return null
      } finally {
        if (mountedRef.current) {
          setIsLoading(false)
        }
        if (cacheKey) {
          pendingLoads.delete(cacheKey)
        }
      }
    })()

    if (cacheKey) {
      pendingLoads.set(cacheKey, loadPromise)
    }

    return loadPromise
  }, [sessionId, slideId, cacheKey])

  // Save image to disk
  const saveImage = useCallback(async (data: string): Promise<boolean> => {
    if (!sessionId || !slideId) {
      return false
    }

    try {
      await window.electronAPI.saveSlideImage(sessionId, slideId, data)
      
      // Update cache
      if (cacheKey) {
        imageCache.set(cacheKey, data)
      }
      setImageData(data)
      
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save image'
      log.error('Failed to save slide image', { sessionId, slideId, error: message })
      setError(message)
      return false
    }
  }, [sessionId, slideId, cacheKey])

  // Clear cache for this slide
  const clearCache = useCallback(() => {
    if (cacheKey) {
      imageCache.delete(cacheKey)
    }
    setImageData(null)
  }, [cacheKey])

  // Auto-load on mount or when slide changes
  useEffect(() => {
    mountedRef.current = true

    if (autoLoad && sessionId && slideId && !initialImageData) {
      // Check cache first
      if (cacheKey && imageCache.has(cacheKey)) {
        setImageData(imageCache.get(cacheKey)!)
      } else {
        loadImage()
      }
    } else if (initialImageData) {
      setImageData(initialImageData)
      // Also save to disk if we have initial data
      if (sessionId && slideId) {
        saveImage(initialImageData)
      }
    }

    return () => {
      mountedRef.current = false
    }
  }, [sessionId, slideId, autoLoad, initialImageData, cacheKey, loadImage, saveImage])

  return {
    imageData,
    isLoading,
    error,
    loadImage,
    saveImage,
    clearCache,
  }
}

// Utility to preload multiple slide images
export async function preloadSlideImages(
  sessionId: string,
  slideIds: string[]
): Promise<void> {
  const promises = slideIds.map(async (slideId) => {
    const cacheKey = `${sessionId}:${slideId}`
    
    // Skip if already cached
    if (imageCache.has(cacheKey)) {
      return
    }

    try {
      const data = await window.electronAPI.loadSlideImage(sessionId, slideId)
      if (data) {
        imageCache.set(cacheKey, data)
      }
    } catch {
      // Ignore errors during preload
    }
  })

  await Promise.all(promises)
}

// Clear all cached images for a session
export function clearSessionImageCache(sessionId: string): void {
  for (const key of imageCache.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      imageCache.delete(key)
    }
  }
}

// Clear entire image cache
export function clearAllImageCache(): void {
  imageCache.clear()
}

