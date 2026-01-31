import { useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useSessionStore } from '../stores/sessionStore'
import { Bold, Italic, List, ListOrdered, Undo, Redo, Check } from 'lucide-react'
import { clsx } from 'clsx'

export function NotesPanel() {
  const { session, updateNote, isSaving } = useSessionStore()

  const currentSlide = session?.slides[session.currentSlideIndex]
  const currentNote = currentSlide ? session?.notes[currentSlide.id] : null

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

  return (
    <div className="w-96 flex-shrink-0 panel flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Notes
          </span>
          {isSaving ? (
            <span className="text-[10px] text-muted-foreground animate-pulse">Saving...</span>
          ) : (
            <span className="text-[10px] text-zinc-400 flex items-center gap-1">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          Slide {session.currentSlideIndex + 1}
        </span>
      </div>

      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-1 flex-wrap bg-white">
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

        <div className="w-px h-4 bg-border mx-1" />

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

        <div className="flex-1" />

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

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
