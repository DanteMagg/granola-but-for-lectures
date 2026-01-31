import { useSessionStore } from '../stores/sessionStore'
import { Plus, FileText, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

export function Sidebar() {
  const { 
    session, 
    sessionList, 
    ui,
    setUIState,
    createSession, 
    loadSession, 
    deleteSession 
  } = useSessionStore()

  const handleNewSession = async () => {
    await createSession()
  }

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    if (confirm('Delete this session? This cannot be undone.')) {
      await deleteSession(sessionId)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  if (ui.sidebarCollapsed) {
    return (
      <aside className="w-12 bg-zinc-50/50 border-r border-border flex flex-col backdrop-blur-sm">
        <button
          onClick={() => setUIState({ sidebarCollapsed: false })}
          className="p-3 hover:bg-zinc-100 transition-colors"
          title="Expand sidebar"
        >
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
        
        <button
          onClick={handleNewSession}
          className="p-3 hover:bg-zinc-100 transition-colors"
          title="New session"
        >
          <Plus className="w-5 h-5 text-muted-foreground" />
        </button>
      </aside>
    )
  }

  return (
    <aside className="w-64 bg-zinc-50/30 border-r border-border flex flex-col backdrop-blur-sm">
      {/* Header */}
      <div className="p-3 flex items-center justify-between border-b border-border/50">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider pl-2">
          Sessions
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewSession}
            className="p-1.5 hover:bg-zinc-100 rounded-md transition-colors"
            title="New session"
          >
            <Plus className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setUIState({ sidebarCollapsed: true })}
            className="p-1.5 hover:bg-zinc-100 rounded-md transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto p-2">
        {sessionList.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-5 h-5 text-zinc-400" />
            </div>
            <p className="text-sm text-muted-foreground">No sessions yet</p>
            <button
              onClick={handleNewSession}
              className="mt-3 text-xs text-foreground font-medium hover:underline"
            >
              Create your first session
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sessionList.map((item) => (
              <button
                key={item.id}
                onClick={() => loadSession(item.id)}
                className={clsx(
                  'w-full text-left p-2.5 rounded-md transition-all duration-200 group border border-transparent',
                  session?.id === item.id
                    ? 'bg-white shadow-sm border-border text-foreground'
                    : 'hover:bg-zinc-100 text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {item.slideCount} slides · {formatDate(item.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, item.id)}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 rounded transition-all"
                    title="Delete session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
