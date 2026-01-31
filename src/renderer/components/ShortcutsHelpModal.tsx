import { X, Keyboard } from 'lucide-react'
import { useSessionStore } from '../stores/sessionStore'

interface ShortcutItem {
  keys: string[]
  description: string
  category: 'navigation' | 'recording' | 'general'
}

const shortcuts: ShortcutItem[] = [
  // Navigation
  { keys: ['←'], description: 'Previous slide', category: 'navigation' },
  { keys: ['→'], description: 'Next slide', category: 'navigation' },
  
  // Recording & AI
  { keys: ['R'], description: 'Toggle recording', category: 'recording' },
  { keys: ['A'], description: 'Toggle AI chat', category: 'recording' },
  
  // General
  { keys: ['⌘', 'S'], description: 'Save session', category: 'general' },
  { keys: ['⌘', 'E'], description: 'Export to PDF', category: 'general' },
  { keys: ['⌘', 'O'], description: 'Import PDF', category: 'general' },
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'general' },
  { keys: ['Esc'], description: 'Close modal / Cancel', category: 'general' },
]

const categoryLabels = {
  navigation: 'Navigation',
  recording: 'Recording & AI',
  general: 'General',
}

export function ShortcutsHelpModal() {
  const { setUIState } = useSessionStore()

  const handleClose = () => {
    setUIState({ showShortcutsHelp: false })
  }

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = []
    }
    acc[shortcut.category].push(shortcut)
    return acc
  }, {} as Record<string, ShortcutItem[]>)

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div 
        className="modal-content max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground tracking-tight">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {(Object.keys(groupedShortcuts) as Array<keyof typeof categoryLabels>).map(category => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {categoryLabels[category]}
              </h3>
              <div className="space-y-2">
                {groupedShortcuts[category].map((shortcut, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-50 transition-colors"
                  >
                    <span className="text-sm text-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center">
                          <kbd className="kbd">{key}</kbd>
                          {keyIndex < shortcut.keys.length - 1 && (
                            <span className="text-muted-foreground mx-0.5">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-zinc-50/30">
          <p className="text-xs text-muted-foreground text-center">
            Shortcuts are disabled when typing in text fields
          </p>
        </div>
      </div>
    </div>
  )
}

