import { useEffect } from 'react'
import { useSessionStore } from '../stores/sessionStore'

// Hook to initialize and manage session lifecycle
export function useSession() {
  const {
    session,
    sessionList,
    isLoading,
    isSaving,
    createSession,
    loadSession,
    saveSession,
    deleteSession,
    refreshSessionList,
  } = useSessionStore()

  // Initialize session list on mount
  useEffect(() => {
    refreshSessionList()
  }, [refreshSessionList])

  // Auto-save on window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (session) {
        saveSession()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [session, saveSession])

  return {
    session,
    sessionList,
    isLoading,
    isSaving,
    createSession,
    loadSession,
    saveSession,
    deleteSession,
    refreshSessionList,
  }
}

