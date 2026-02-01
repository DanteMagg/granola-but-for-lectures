import { useEffect, useState, useCallback, useRef } from 'react'
import { useSessionStore } from './stores/sessionStore'
import { Sidebar } from './components/Sidebar'
import { SlideViewer } from './components/SlideViewer'
import { SlideThumbList } from './components/SlideThumbList'
import { NotesPanel } from './components/NotesPanel'
import { TranscriptPanel } from './components/TranscriptPanel'
import { AudioRecorder } from './components/AudioRecorder'
import { AIChatModal } from './components/AIChatModal'
import { Header } from './components/Header'
import { EmptyState } from './components/EmptyState'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ExportModal } from './components/ExportModal'
import { SettingsModal } from './components/SettingsModal'
import { ShortcutsHelpModal } from './components/ShortcutsHelpModal'
import { OnboardingModal, useOnboarding } from './components/OnboardingModal'
import { SearchModal } from './components/SearchModal'
import { SessionFeedbackModal } from './components/SessionFeedbackModal'
import { ToastContainer, toast } from './components/Toast'
import { EnhanceNotesButton } from './components/EnhanceNotesButton'
import { usePdfImport } from './hooks/usePdfImport'
import { SHORTCUTS } from '@shared/constants'

// Custom event for toggling recording from keyboard shortcut
export const RECORDING_TOGGLE_EVENT = 'app:toggleRecording'

export default function App() {
  const { 
    session, 
    ui, 
    setUIState, 
    nextSlide, 
    prevSlide, 
    refreshSessionList,
    saveSession,
    isSaving,
    setFeedback,
    createSession,
  } = useSessionStore()
  
  const [isReady, setIsReady] = useState(false)
  const { importPdf, isImporting } = usePdfImport()
  const { showOnboarding, completeOnboarding } = useOnboarding()

  // Refs for keyboard shortcuts to avoid re-registering handlers on every state change
  const sessionRef = useRef(session)
  const uiRef = useRef(ui)
  const isSavingRef = useRef(isSaving)
  const isImportingRef = useRef(isImporting)
  
  // Keep refs in sync with state
  useEffect(() => { sessionRef.current = session }, [session])
  useEffect(() => { uiRef.current = ui }, [ui])
  useEffect(() => { isSavingRef.current = isSaving }, [isSaving])
  useEffect(() => { isImportingRef.current = isImporting }, [isImporting])

  // Initialize app
  useEffect(() => {
    refreshSessionList().then(() => setIsReady(true))
  }, [refreshSessionList])

  // Check if user is typing in an input field
  const isTyping = useCallback(() => {
    const activeElement = document.activeElement
    if (!activeElement) return false
    
    // Check for input/textarea
    if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
      return true
    }
    
    // Check for contenteditable (like Tiptap)
    if (activeElement.getAttribute('contenteditable') === 'true') {
      return true
    }
    
    // Check for Tiptap/ProseMirror
    if (activeElement.closest('.ProseMirror')) {
      return true
    }
    
    return false
  }, [])

  // Keyboard shortcuts - uses refs to avoid re-registering on every state change
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Read current values from refs
      const currentSession = sessionRef.current
      const currentUI = uiRef.current

      // Handle Escape key globally (close modals)
      if (e.key === 'Escape') {
        if (currentUI.showSearchModal) {
          setUIState({ showSearchModal: false })
          return
        }
        if (currentUI.showAIChat) {
          setUIState({ showAIChat: false })
          return
        }
        if (currentUI.showExportModal) {
          setUIState({ showExportModal: false })
          return
        }
        if (currentUI.showSettingsModal) {
          setUIState({ showSettingsModal: false })
          return
        }
        if (currentUI.showShortcutsHelp) {
          setUIState({ showShortcutsHelp: false })
          return
        }
        return
      }

      // Don't trigger shortcuts when typing
      if (isTyping()) {
        return
      }

      // Check for modifier keys (Meta on Mac, Ctrl on Windows/Linux)
      const isMod = e.metaKey || e.ctrlKey

      // Meta+S - Save
      if (isMod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (currentSession && !isSavingRef.current) {
          saveSession()
          toast.shortcut('Saved', '⌘S')
        }
        return
      }

      // Meta+E - Export
      if (isMod && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        if (currentSession) {
          setUIState({ showExportModal: true })
          toast.shortcut('Export', '⌘E')
        }
        return
      }

      // Meta+O - Import PDF
      if (isMod && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        if (!isImportingRef.current) {
          importPdf()
          toast.shortcut('Import PDF', '⌘O')
        }
        return
      }

      // Meta+K or Meta+F - Search
      if (isMod && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'f')) {
        e.preventDefault()
        if (currentSession) {
          setUIState({ showSearchModal: true })
        }
        return
      }

      // Meta+, - Settings
      if (isMod && e.key === ',') {
        e.preventDefault()
        setUIState({ showSettingsModal: true })
        return
      }

      // Meta+N - New session
      if (isMod && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        createSession()
        toast.shortcut('New Session', '⌘N')
        return
      }

      // Meta+\ - Toggle sidebar
      if (isMod && e.key === '\\') {
        e.preventDefault()
        setUIState({ sidebarCollapsed: !currentUI.sidebarCollapsed })
        return
      }

      // Don't process other shortcuts if modifiers are pressed
      if (isMod) return

      // Single key shortcuts (without modifiers)
      switch (e.key) {
        case SHORTCUTS.NEXT_SLIDE:
          if (currentSession && currentSession.slides.length > 0) {
            nextSlide()
          }
          break

        case SHORTCUTS.PREV_SLIDE:
          if (currentSession && currentSession.slides.length > 0) {
            prevSlide()
          }
          break

        case SHORTCUTS.TOGGLE_RECORDING:
        case SHORTCUTS.TOGGLE_RECORDING.toUpperCase():
          if (currentSession && currentSession.slides.length > 0) {
            // Dispatch custom event that AudioRecorder listens to
            window.dispatchEvent(new CustomEvent(RECORDING_TOGGLE_EVENT))
            toast.shortcut(currentSession.isRecording ? 'Stop Recording' : 'Start Recording', 'R')
          }
          break

        case SHORTCUTS.TOGGLE_AI_CHAT:
        case SHORTCUTS.TOGGLE_AI_CHAT.toUpperCase():
          if (currentSession) {
            setUIState({ showAIChat: !currentUI.showAIChat })
            toast.shortcut(currentUI.showAIChat ? 'Close AI Chat' : 'Open AI Chat', 'A')
          }
          break

        case SHORTCUTS.FOCUS_NOTES:
        case SHORTCUTS.FOCUS_NOTES.toUpperCase():
          if (currentSession) {
            const notesEditor = document.querySelector('.ProseMirror') as HTMLElement
            if (notesEditor) {
              notesEditor.focus()
              toast.shortcut('Focus Notes', 'N')
            }
          }
          break

        case '?':
          setUIState({ showShortcutsHelp: true })
          break
        
        // Also handle Shift+/ for keyboards where ? doesn't register
        case '/':
          if (e.shiftKey) {
            setUIState({ showShortcutsHelp: true })
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setUIState, nextSlide, prevSlide, saveSession, importPdf, isTyping, createSession])

  if (!isReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-background overflow-hidden font-sans">
        {/* Skip links for accessibility */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:text-foreground focus:font-medium"
        >
          Skip to main content
        </a>

        {/* Header with traffic light padding */}
        <Header />

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar with error boundary */}
          <ErrorBoundary section="sidebar" compact>
            <Sidebar />
          </ErrorBoundary>

          {/* Main content */}
          <main id="main-content" className="flex-1 flex flex-col overflow-hidden" role="main" aria-label="Lecture notes workspace">
            <ErrorBoundary>
              {session && session.slides.length > 0 ? (
                <>
                  {/* Main content area - slide-focused layout */}
                  <div className="flex-1 flex overflow-hidden">
                    {/* Left: Slide thumbnails - collapsible narrow strip */}
                    {ui.showSlideList && (
                      <div className="flex-shrink-0">
                        <SlideThumbList />
                      </div>
                    )}

                    {/* Center: Slide viewer - DOMINANT */}
                    <div className="flex-1 flex flex-col min-w-0 p-3">
                      <ErrorBoundary section="slides">
                        <SlideViewer />
                      </ErrorBoundary>
                      
                      {/* Recording controls - compact below slide */}
                      <div className="mt-2">
                        <AudioRecorder />
                      </div>
                      
                      {/* Enhance CTA - inline compact version */}
                      {!session.isRecording && (session.phase === 'ready_to_enhance' || session.phase === 'enhancing') && (
                        <div className="mt-2">
                          <EnhanceNotesButton variant="compact" className="justify-center" />
                        </div>
                      )}
                    </div>

                    {/* Right: Notes + Transcript in a single panel */}
                    <div className="w-80 flex-shrink-0 flex flex-col border-l border-border bg-white">
                      <ErrorBoundary section="notes">
                        <NotesPanel />
                      </ErrorBoundary>
                      
                      {/* Transcript at bottom of right panel */}
                      {(!session.isRecording || ui.showLiveTranscript) && (
                        <ErrorBoundary section="transcript" compact>
                          <TranscriptPanel />
                        </ErrorBoundary>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState />
              )}
            </ErrorBoundary>
          </main>
        </div>

        {/* AI Chat Modal */}
        {ui.showAIChat && (
          <ErrorBoundary section="ai-chat" onRetry={() => setUIState({ showAIChat: false })}>
            <AIChatModal />
          </ErrorBoundary>
        )}

        {/* Export Modal */}
        {ui.showExportModal && (
          <ErrorBoundary section="export" onRetry={() => setUIState({ showExportModal: false })}>
            <ExportModal onClose={() => setUIState({ showExportModal: false })} />
          </ErrorBoundary>
        )}

        {/* Settings Modal */}
        {ui.showSettingsModal && (
          <ErrorBoundary section="settings" onRetry={() => setUIState({ showSettingsModal: false })}>
            <SettingsModal onClose={() => setUIState({ showSettingsModal: false })} />
          </ErrorBoundary>
        )}

        {/* Shortcuts Help Modal */}
        {ui.showShortcutsHelp && <ShortcutsHelpModal />}

        {/* Search Modal */}
        {ui.showSearchModal && (
          <SearchModal onClose={() => setUIState({ showSearchModal: false })} />
        )}

        {/* Session Feedback Modal */}
        {ui.showFeedbackModal && session && (
          <SessionFeedbackModal
            stats={{
              slidesReviewed: new Set(
                Object.keys(session.notes).concat(
                  Object.keys(session.transcripts)
                )
              ).size,
              totalSlides: session.slides.length,
              notesWritten: Object.values(session.notes).filter(n => n.plainText.trim().length > 0).length,
              transcriptSegments: Object.values(session.transcripts).flat().length,
              recordingDuration: session.totalRecordingDuration || 0,
            }}
            onSubmit={(rating, feedback) => {
              setFeedback(rating, feedback)
              setUIState({ showFeedbackModal: false })
              toast.success('Thanks!', 'Your feedback has been saved.')
            }}
            onSkip={() => setUIState({ showFeedbackModal: false })}
          />
        )}

        {/* Toast notifications */}
        <ToastContainer />

        {/* Onboarding modal for first-time users */}
        {showOnboarding && (
          <OnboardingModal onComplete={completeOnboarding} />
        )}
      </div>
    </ErrorBoundary>
  )
}
