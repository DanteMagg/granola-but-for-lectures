import { useEffect, useRef, RefObject } from 'react'

const FOCUSABLE_SELECTOR = 
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Focus trap hook for modals and dialogs
 * Traps focus within the container and restores focus on close
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean
): RefObject<T> {
  const containerRef = useRef<T>(null)
  const previousFocusRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!isOpen) return

    // Store current focus to restore later
    previousFocusRef.current = document.activeElement

    const container = containerRef.current
    if (!container) return

    // Find all focusable elements
    const getFocusableElements = () => 
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)

    // Focus first element after a short delay (for animation)
    const timeoutId = setTimeout(() => {
      const focusableEls = getFocusableElements()
      if (focusableEls.length > 0) {
        focusableEls[0].focus()
      }
    }, 50)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableEls = getFocusableElements()
      if (focusableEls.length === 0) return

      const firstEl = focusableEls[0]
      const lastEl = focusableEls[focusableEls.length - 1]

      // Shift+Tab from first element -> go to last
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      }
      // Tab from last element -> go to first
      else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('keydown', handleKeyDown)
      
      // Restore previous focus
      const previousElement = previousFocusRef.current as HTMLElement
      if (previousElement && typeof previousElement.focus === 'function') {
        previousElement.focus()
      }
    }
  }, [isOpen])

  return containerRef
}

