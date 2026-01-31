import { useState } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { Settings, Download, FolderOpen, Sparkles, Keyboard } from 'lucide-react'

export function Header() {
  const { session, ui, setUIState, setSessionName } = useSessionStore()
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')

  const handleNameClick = () => {
    if (session) {
      setEditedName(session.name)
      setIsEditingName(true)
    }
  }

  const handleNameSubmit = () => {
    const trimmedName = editedName.trim()
    if (trimmedName) {
      setSessionName(trimmedName)
    } else if (session) {
      // Restore original name if empty - don't allow blank names
      setEditedName(session.name)
    }
    setIsEditingName(false)
  }

  const handleExport = () => {
    if (!session) return
    setUIState({ showExportModal: true })
  }

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-white/80 backdrop-blur-md draggable traffic-light-padding z-10">
      {/* Left section */}
      <div className="flex items-center gap-3 non-draggable">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-zinc-900 flex items-center justify-center shadow-sm">
            <FolderOpen className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-foreground tracking-tight">Lecture Notes</span>
        </div>
      </div>

      {/* Center section - Session name */}
      <div className="absolute left-1/2 -translate-x-1/2 non-draggable">
        {session ? (
          isEditingName ? (
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit()
                if (e.key === 'Escape') setIsEditingName(false)
              }}
              className="text-sm font-medium text-center bg-transparent border-b border-zinc-900 outline-none px-2 py-1 min-w-[200px]"
              autoFocus
            />
          ) : (
            <button
              onClick={handleNameClick}
              className="text-sm font-medium text-foreground hover:text-zinc-600 px-2 py-1 rounded transition-colors"
            >
              {session.name}
            </button>
          )
        ) : (
          <span className="text-sm text-muted-foreground">No session</span>
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2 non-draggable">
        {session && (
          <>
            <button
              onClick={() => setUIState({ showAIChat: !ui.showAIChat })}
              className={`btn btn-sm ${ui.showAIChat ? 'bg-zinc-100 text-foreground' : 'btn-ghost'}`}
              title="Ask AI (A)"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ask AI</span>
            </button>
            
            <button
              onClick={handleExport}
              className="btn btn-ghost btn-sm"
              title="Export session (⌘E)"
            >
              <Download className="w-4 h-4" />
            </button>
          </>
        )}

        <button 
          className="btn btn-ghost btn-sm"
          title="Keyboard shortcuts (?)"
          onClick={() => setUIState({ showShortcutsHelp: true })}
        >
          <Keyboard className="w-4 h-4" />
        </button>
        
        <button 
          className="btn btn-ghost btn-sm" 
          title="Settings"
          onClick={() => setUIState({ showSettingsModal: true })}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
