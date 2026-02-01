import { useEffect, useState, useCallback } from 'react'
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
  } = useSessionStore()
  
  const [isReady, setIsReady] = useState(false)
  const { importPdf, isImporting } = usePdfImport()
  const { showOnboarding, completeOnboarding } = useOnboarding()

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Escape key globally (close modals)
      if (e.key === 'Escape') {
        if (ui.showSearchModal) {
          setUIState({ showSearchModal: false })
          return
        }
        if (ui.showAIChat) {
          setUIState({ showAIChat: false })
          return
        }
        if (ui.showExportModal) {
          setUIState({ showExportModal: false })
          return
        }
        if (ui.showSettingsModal) {
          setUIState({ showSettingsModal: false })
          return
        }
        if (ui.showShortcutsHelp) {
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
        if (session && !isSaving) {
          saveSession()
          toast.shortcut('Saved', '⌘S')
        }
        return
      }

      // Meta+E - Export
      if (isMod && e.key.toLowerCase() === 'e') {
        e.preventDefault()
        if (session) {
          setUIState({ showExportModal: true })
          toast.shortcut('Export', '⌘E')
        }
        return
      }

      // Meta+O - Import PDF
      if (isMod && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        if (!isImporting) {
          importPdf()
          toast.shortcut('Import PDF', '⌘O')
        }
        return
      }

      // Meta+K or Meta+F - Search
      if (isMod && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'f')) {
        e.preventDefault()
        if (session) {
          setUIState({ showSearchModal: true })
        }
        return
      }

      // Don't process other shortcuts if modifiers are pressed
      if (isMod) return

      // Single key shortcuts (without modifiers)
      switch (e.key) {
        case SHORTCUTS.NEXT_SLIDE:
          if (session && session.slides.length > 0) {
            nextSlide()
          }
          break

        case SHORTCUTS.PREV_SLIDE:
          if (session && session.slides.length > 0) {
            prevSlide()
          }
          break

        case SHORTCUTS.TOGGLE_RECORDING:
        case SHORTCUTS.TOGGLE_RECORDING.toUpperCase():
          if (session && session.slides.length > 0) {
            // Dispatch custom event that AudioRecorder listens to
            window.dispatchEvent(new CustomEvent(RECORDING_TOGGLE_EVENT))
            toast.shortcut(session.isRecording ? 'Stop Recording' : 'Start Recording', 'R')
          }
          break

        case SHORTCUTS.TOGGLE_AI_CHAT:
        case SHORTCUTS.TOGGLE_AI_CHAT.toUpperCase():
          if (session) {
            setUIState({ showAIChat: !ui.showAIChat })
            toast.shortcut(ui.showAIChat ? 'Close AI Chat' : 'Open AI Chat', 'A')
          }
          break

        case '?':
          setUIState({ showShortcutsHelp: true })
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    session, 
    ui, 
    setUIState, 
    nextSlide, 
    prevSlide, 
    saveSession,
    isSaving,
    importPdf,
    isImporting,
    isTyping,
  ])

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
          {/* Sidebar */}
          <Sidebar />

              {/* Main content */}
              <main id="main-content" className="flex-1 flex flex-col overflow-hidden" role="main" aria-label="Lecture notes workspace">
            <ErrorBoundary>
              {session && session.slides.length > 0 ? (
                <>
                  {/* Top section: Slides + Notes */}
                  <div className="flex-1 flex overflow-hidden p-4 gap-4">
                    {/* Slide thumbnails */}
                    <SlideThumbList />

                    {/* Current slide viewer */}
                    <div className="flex-1 flex flex-col min-w-0">
                      <SlideViewer />
                      
                      {/* Recording controls */}
                      <AudioRecorder />
                    </div>

                    {/* Notes panel */}
                    <NotesPanel />
                  </div>

                  {/* Bottom section: Transcript */}
                  <TranscriptPanel />
                </>
              ) : (
                <EmptyState />
              )}
            </ErrorBoundary>
          </main>
        </div>

        {/* AI Chat Modal */}
        {ui.showAIChat && <AIChatModal />}

        {/* Export Modal */}
        {ui.showExportModal && (
          <ExportModal onClose={() => setUIState({ showExportModal: false })} />
        )}

        {/* Settings Modal */}
        {ui.showSettingsModal && (
          <SettingsModal onClose={() => setUIState({ showSettingsModal: false })} />
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
