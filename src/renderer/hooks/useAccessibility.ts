import { useState, useEffect, useCallback } from 'react'

const HIGH_CONTRAST_KEY = 'lecture-notes-high-contrast'
const AUTO_DELETE_AUDIO_KEY = 'lecture-notes-auto-delete-audio'

interface AccessibilitySettings {
  highContrast: boolean
  autoDeleteAudio: boolean
}

export function useAccessibility() {
  const [settings, setSettings] = useState<AccessibilitySettings>({
    highContrast: false,
    autoDeleteAudio: false,
  })

  // Load settings from localStorage on mount
  useEffect(() => {
    const highContrast = localStorage.getItem(HIGH_CONTRAST_KEY) === 'true'
    const autoDeleteAudio = localStorage.getItem(AUTO_DELETE_AUDIO_KEY) === 'true'
    
    setSettings({ highContrast, autoDeleteAudio })

    // Apply high contrast class to root
    if (highContrast) {
      document.documentElement.classList.add('high-contrast')
    }
  }, [])

  const setHighContrast = useCallback((enabled: boolean) => {
    localStorage.setItem(HIGH_CONTRAST_KEY, String(enabled))
    setSettings(prev => ({ ...prev, highContrast: enabled }))
    
    if (enabled) {
      document.documentElement.classList.add('high-contrast')
    } else {
      document.documentElement.classList.remove('high-contrast')
    }
  }, [])

  const setAutoDeleteAudio = useCallback((enabled: boolean) => {
    localStorage.setItem(AUTO_DELETE_AUDIO_KEY, String(enabled))
    setSettings(prev => ({ ...prev, autoDeleteAudio: enabled }))
  }, [])

  const toggleHighContrast = useCallback(() => {
    setHighContrast(!settings.highContrast)
  }, [settings.highContrast, setHighContrast])

  const toggleAutoDeleteAudio = useCallback(() => {
    setAutoDeleteAudio(!settings.autoDeleteAudio)
  }, [settings.autoDeleteAudio, setAutoDeleteAudio])

  return {
    ...settings,
    setHighContrast,
    setAutoDeleteAudio,
    toggleHighContrast,
    toggleAutoDeleteAudio,
  }
}

