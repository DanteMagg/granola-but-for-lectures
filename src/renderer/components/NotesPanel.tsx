import { useEffect, useCallback, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import DOMPurify from 'dompurify'
import { useSessionStore } from '../stores/sessionStore'
import { 
  Bold, Italic, List, ListOrdered, Undo, Redo, Check, 
  Sparkles, FileText, RefreshCw, CheckCircle, XCircle, Loader2 
} from 'lucide-react'
import { clsx } from 'clsx'
import { useNoteEnhancement } from '../hooks/useNoteEnhancement'

type ViewMode = 'original' | 'enhanced'

export function NotesPanel() {
  const { session, updateNote, isSaving, updateEnhancedNoteStatus } = useSessionStore()
  const { enhanceSlide } = useNoteEnhancement()
  const [viewMode, setViewMode] = useState<ViewMode>('original')

  const currentSlide = session?.slides[session.currentSlideIndex]
  const currentNote = currentSlide ? session?.notes[currentSlide.id] : null
  const currentEnhancedNote = currentSlide ? session?.enhancedNotes?.[currentSlide.id] : null

  // Auto-switch to enhanced view when enhancement is complete
  useEffect(() => {
    if (session?.phase === 'enhanced' && currentEnhancedNote?.status === 'complete') {
      setViewMode('enhanced')
    }
  }, [session?.phase, currentEnhancedNote?.status])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Take notes for this slide...',
      }),
    ],
    content: currentNote?.content || '',
    editorProps: {
      attributes: {
        class: 'prose-editor outline-none min-h-[200px] p-4',
      },
    },
    onUpdate: ({ editor }) => {
      if (currentSlide) {
        const html = editor.getHTML()
        const text = editor.getText()
        updateNote(currentSlide.id, html, text)
      }
    },
  })

  // Update editor content when slide changes
  useEffect(() => {
    if (editor && currentNote?.content !== undefined) {
      const currentContent = editor.getHTML()
      if (currentContent !== currentNote.content) {
        editor.commands.setContent(currentNote.content || '')
      }
    } else if (editor && !currentNote) {
      editor.commands.setContent('')
    }
  }, [editor, currentSlide?.id, currentNote?.content])

  const ToolbarButton = useCallback(({ 
    onClick, 
    isActive, 
    disabled,
    children,
    title,
  }: {
    onClick: () => void
    isActive?: boolean
    disabled?: boolean
    children: React.ReactNode
    title: string
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'p-1.5 rounded transition-colors',
        isActive 
          ? 'bg-zinc-100 text-zinc-900' 
          : 'text-muted-foreground hover:bg-zinc-50 hover:text-foreground',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  ), [])

  if (!session || session.slides.length === 0) {
    return null
  }

  const hasEnhancedNote = currentEnhancedNote?.status === 'complete'
  const isEnhancing = currentEnhancedNote?.status === 'generating'
  const hasError = currentEnhancedNote?.status === 'error'
  
  // Show tabs only when there's enhanced content or we're in post-recording phase
  const showTabs = !session.isRecording && (
    session.phase === 'enhanced' || 
    session.phase === 'enhancing' || 
    session.phase === 'ready_to_enhance' ||
    hasEnhancedNote
  )

  // Show enhance CTA when ready but not yet enhanced
  const showEnhanceCTA = !session.isRecording && 
    session.phase === 'ready_to_enhance' && 
    !hasEnhancedNote &&
    viewMode === 'original'

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Notes
          </span>
          {isSaving ? (
            <span className="text-[10px] text-muted-foreground animate-pulse" aria-hidden="true">Saving...</span>
          ) : (
            <span className="text-[10px] text-zinc-400 flex items-center gap-1" aria-hidden="true">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
          {/* Screen reader announcement for save status */}
          <span role="status" aria-live="polite" className="sr-only">
            {isSaving ? 'Saving notes...' : 'Notes saved'}
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          Slide {session.currentSlideIndex + 1}
        </span>
      </div>

      {/* View Mode Tabs (shown after recording) */}
      {showTabs && (
        <div className="px-3 py-2 border-b border-border flex items-center gap-1 bg-zinc-50/50">
          <button
            onClick={() => setViewMode('original')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              viewMode === 'original'
                ? 'bg-white text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            Original
          </button>
          <button
            onClick={() => setViewMode('enhanced')}
            disabled={!hasEnhancedNote && !isEnhancing}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              viewMode === 'enhanced'
                ? 'bg-white text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/50',
              !hasEnhancedNote && !isEnhancing && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Enhanced
            {isEnhancing && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
            {hasEnhancedNote && <CheckCircle className="w-3 h-3 text-green-500 ml-1" />}
          </button>
        </div>
      )}

      {/* Original Notes View */}
      {viewMode === 'original' && (
        <>
          {/* Toolbar */}
          <div className="px-3 py-2 border-b border-border flex items-center gap-1 flex-wrap bg-white">
            <div className="flex items-center gap-0.5 p-0.5 bg-zinc-100/50 rounded-md border border-zinc-200/50">
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleBold().run()}
                isActive={editor?.isActive('bold')}
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </ToolbarButton>

              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                isActive={editor?.isActive('italic')}
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </ToolbarButton>
            </div>

            <div className="w-px h-4 bg-border mx-1.5" />

            <div className="flex items-center gap-0.5 p-0.5 bg-zinc-100/50 rounded-md border border-zinc-200/50">
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                isActive={editor?.isActive('bulletList')}
                title="Bullet list"
              >
                <List className="w-4 h-4" />
              </ToolbarButton>

              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                isActive={editor?.isActive('orderedList')}
                title="Numbered list"
              >
                <ListOrdered className="w-4 h-4" />
              </ToolbarButton>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-0.5">
              <ToolbarButton
                onClick={() => editor?.chain().focus().undo().run()}
                disabled={!editor?.can().undo()}
                title="Undo"
              >
                <Undo className="w-4 h-4" />
              </ToolbarButton>

              <ToolbarButton
                onClick={() => editor?.chain().focus().redo().run()}
                disabled={!editor?.can().redo()}
                title="Redo"
              >
                <Redo className="w-4 h-4" />
              </ToolbarButton>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-y-auto">
            <EditorContent editor={editor} />
          </div>

          {/* Enhance CTA (shown after recording, before enhancement) */}
          {showEnhanceCTA && (
            <div className="p-3 border-t border-border bg-zinc-50/50">
              <button
                onClick={() => currentSlide && enhanceSlide(currentSlide.id)}
                className="w-full btn btn-secondary btn-sm flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Enhance this slide's notes
              </button>
            </div>
          )}
        </>
      )}

      {/* Enhanced Notes View */}
      {viewMode === 'enhanced' && (
        <div className="flex-1 overflow-y-auto">
          {isEnhancing && (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-3" />
              <p className="text-sm text-muted-foreground">Enhancing notes...</p>
              <p className="text-xs text-zinc-400 mt-1">
                Merging your notes with the transcript
              </p>
            </div>
          )}

          {hasError && (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <XCircle className="w-8 h-8 text-red-400 mb-3" />
              <p className="text-sm text-red-600 font-medium">Enhancement failed</p>
              <p className="text-xs text-red-500 mt-1 mb-4">
                {currentEnhancedNote?.error || 'Unknown error'}
              </p>
              <button
                onClick={() => currentSlide && enhanceSlide(currentSlide.id)}
                className="btn btn-secondary btn-sm flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try again
              </button>
            </div>
          )}

          {hasEnhancedNote && (
            <>
              {/* Enhanced content display */}
              <div className="p-4 prose prose-sm max-w-none">
                <div 
                  className="enhanced-notes-content"
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(formatMarkdownToHtml(currentEnhancedNote.content))
                  }}
                />
              </div>

              {/* Actions */}
              <div className="p-3 border-t border-border bg-zinc-50/50 flex items-center gap-2">
                <button
                  onClick={() => currentSlide && enhanceSlide(currentSlide.id)}
                  className="btn btn-ghost btn-sm flex items-center gap-1.5"
                  title="Regenerate enhanced notes"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </button>
                
                <div className="flex-1" />
                
                {currentEnhancedNote.status !== 'accepted' && (
                  <>
                    <button
                      onClick={() => currentSlide && updateEnhancedNoteStatus(currentSlide.id, 'rejected')}
                      className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => currentSlide && updateEnhancedNoteStatus(currentSlide.id, 'accepted')}
                      className="btn btn-ghost btn-sm text-green-600 hover:bg-green-50"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                
                {currentEnhancedNote.status === 'accepted' && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Accepted
                  </span>
                )}
              </div>
            </>
          )}

          {!hasEnhancedNote && !isEnhancing && !hasError && (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <Sparkles className="w-8 h-8 text-zinc-300 mb-3" />
              <p className="text-sm text-muted-foreground">No enhanced notes yet</p>
              <p className="text-xs text-zinc-400 mt-1 mb-4">
                Click below to enhance this slide's notes with AI
              </p>
              <button
                onClick={() => currentSlide && enhanceSlide(currentSlide.id)}
                className="btn btn-primary btn-sm flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Enhance Notes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Simple markdown to HTML converter for enhanced notes display
 */
function formatMarkdownToHtml(markdown: string): string {
  if (!markdown) return ''
  
  let html = markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // Bullet lists
    .replace(/^\s*[-*] (.*$)/gim, '<li>$1</li>')
    // Numbered lists
    .replace(/^\s*\d+\. (.*$)/gim, '<li>$1</li>')
    // Line breaks
    .replace(/\n/gim, '<br>')
  
  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/(<li>.*?<\/li>)(<br>)?/g, '$1')
  html = html.replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>')
  
  return html
}
