import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAccessibility } from '../renderer/hooks/useAccessibility'

describe('useAccessibility', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('high-contrast')
  })

  afterEach(() => {
    document.documentElement.classList.remove('high-contrast')
  })

  it('returns default settings when localStorage is empty', () => {
    const { result } = renderHook(() => useAccessibility())

    expect(result.current.highContrast).toBe(false)
    expect(result.current.autoDeleteAudio).toBe(false)
  })

  it('loads high contrast setting from localStorage', () => {
    localStorage.setItem('lecture-notes-high-contrast', 'true')

    const { result } = renderHook(() => useAccessibility())

    expect(result.current.highContrast).toBe(true)
  })

  it('loads auto delete audio setting from localStorage', () => {
    localStorage.setItem('lecture-notes-auto-delete-audio', 'true')

    const { result } = renderHook(() => useAccessibility())

    expect(result.current.autoDeleteAudio).toBe(true)
  })

  it('applies high contrast class to document on load', () => {
    localStorage.setItem('lecture-notes-high-contrast', 'true')

    renderHook(() => useAccessibility())

    expect(document.documentElement.classList.contains('high-contrast')).toBe(true)
  })

  it('setHighContrast updates state and localStorage', () => {
    const { result } = renderHook(() => useAccessibility())

    act(() => {
      result.current.setHighContrast(true)
    })

    expect(result.current.highContrast).toBe(true)
    expect(localStorage.getItem('lecture-notes-high-contrast')).toBe('true')
    expect(document.documentElement.classList.contains('high-contrast')).toBe(true)
  })

  it('setHighContrast(false) removes class from document', () => {
    localStorage.setItem('lecture-notes-high-contrast', 'true')
    document.documentElement.classList.add('high-contrast')

    const { result } = renderHook(() => useAccessibility())

    act(() => {
      result.current.setHighContrast(false)
    })

    expect(result.current.highContrast).toBe(false)
    expect(document.documentElement.classList.contains('high-contrast')).toBe(false)
  })

  it('setAutoDeleteAudio updates state and localStorage', () => {
    const { result } = renderHook(() => useAccessibility())

    act(() => {
      result.current.setAutoDeleteAudio(true)
    })

    expect(result.current.autoDeleteAudio).toBe(true)
    expect(localStorage.getItem('lecture-notes-auto-delete-audio')).toBe('true')
  })

  it('toggleHighContrast toggles the setting', () => {
    const { result } = renderHook(() => useAccessibility())

    expect(result.current.highContrast).toBe(false)

    act(() => {
      result.current.toggleHighContrast()
    })

    expect(result.current.highContrast).toBe(true)

    act(() => {
      result.current.toggleHighContrast()
    })

    expect(result.current.highContrast).toBe(false)
  })

  it('toggleAutoDeleteAudio toggles the setting', () => {
    const { result } = renderHook(() => useAccessibility())

    expect(result.current.autoDeleteAudio).toBe(false)

    act(() => {
      result.current.toggleAutoDeleteAudio()
    })

    expect(result.current.autoDeleteAudio).toBe(true)

    act(() => {
      result.current.toggleAutoDeleteAudio()
    })

    expect(result.current.autoDeleteAudio).toBe(false)
  })
})

