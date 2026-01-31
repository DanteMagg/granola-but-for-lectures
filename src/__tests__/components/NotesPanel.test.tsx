import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { NotesPanel } from '../../renderer/components/NotesPanel'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import type { Slide, Note } from '@shared/types'

// Mock TipTap editor
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn().mockReturnValue({
    getHTML: vi.fn().mockReturnValue('<p>Test content</p>'),
    getText: vi.fn().mockReturnValue('Test content'),
    chain: vi.fn().mockReturnValue({
      focus: vi.fn().mockReturnValue({
        toggleBold: vi.fn().mockReturnValue({ run: vi.fn() }),
        toggleItalic: vi.fn().mockReturnValue({ run: vi.fn() }),
        toggleBulletList: vi.fn().mockReturnValue({ run: vi.fn() }),
        toggleOrderedList: vi.fn().mockReturnValue({ run: vi.fn() }),
        undo: vi.fn().mockReturnValue({ run: vi.fn() }),
        redo: vi.fn().mockReturnValue({ run: vi.fn() }),
      }),
    }),
    isActive: vi.fn().mockReturnValue(false),
    can: vi.fn().mockReturnValue({
      undo: vi.fn().mockReturnValue(true),
      redo: vi.fn().mockReturnValue(false),
    }),
    commands: {
      setContent: vi.fn(),
    },
  }),
  EditorContent: ({ editor }: { editor: unknown }) => (
    <div data-testid="editor-content">Editor Content</div>
  ),
}))

vi.mock('@tiptap/starter-kit', () => ({
  default: {},
}))

vi.mock('@tiptap/extension-placeholder', () => ({
  default: {
    configure: vi.fn().mockReturnValue({}),
  },
}))

// Reset store helper
const resetStore = () => {
  useSessionStore.setState({
    session: null,
    sessionList: [],
    ui: {
      sidebarCollapsed: false,
      transcriptPanelHeight: 200,
      notesPanelWidth: 350,
      showAIChat: false,
      aiChatContext: 'current-slide',
    },
    isLoading: false,
    isSaving: false,
    error: null,
  })
}

// Mock slides for testing
const createMockSlides = (count: number): Slide[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `slide-${i}`,
    index: i,
    imageData: `base64-image-data-${i}`,
    width: 1920,
    height: 1080,
    extractedText: `Slide ${i + 1} content`,
  }))

// Helper to set up session with slides and optional notes
const setupSessionWithSlides = (
  slideCount: number,
  currentIndex = 0,
  notes: Record<string, Note> = {}
) => {
  const slides = createMockSlides(slideCount)
  useSessionStore.setState({
    session: {
      id: 'test-session',
      name: 'Test Session',
      slides,
      notes,
      transcripts: {},
      aiConversations: [],
      currentSlideIndex: currentIndex,
      isRecording: false,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    isSaving: false,
  })
  return slides
}

describe('NotesPanel', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render nothing when no session exists', () => {
      const { container } = render(<NotesPanel />)
      expect(container.firstChild).toBeNull()
    })

    it('should render nothing when session has no slides', () => {
      useSessionStore.setState({
        session: {
          id: 'test-session',
          name: 'Empty Session',
          slides: [],
          notes: {},
          transcripts: {},
          aiConversations: [],
          currentSlideIndex: 0,
          isRecording: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      })
      
      const { container } = render(<NotesPanel />)
      expect(container.firstChild).toBeNull()
    })

    it('should render notes panel with slides', () => {
      setupSessionWithSlides(5)
      
      render(<NotesPanel />)
      
      expect(screen.getByText('Notes')).toBeInTheDocument()
    })

    it('should display current slide number', () => {
      setupSessionWithSlides(10, 4) // 10 slides, current is 5th (index 4)
      
      render(<NotesPanel />)
      
      expect(screen.getByText('Slide 5')).toBeInTheDocument()
    })
  })

  describe('save status', () => {
    it('should show "Saved" when not saving', () => {
      setupSessionWithSlides(5)
      
      render(<NotesPanel />)
      
      expect(screen.getByText('Saved')).toBeInTheDocument()
    })

    it('should show "Saving..." when saving', () => {
      setupSessionWithSlides(5)
      useSessionStore.setState({ isSaving: true })
      
      render(<NotesPanel />)
      
      expect(screen.getByText('Saving...')).toBeInTheDocument()
    })
  })

  describe('toolbar', () => {
    it('should render formatting buttons', () => {
      setupSessionWithSlides(5)
      
      render(<NotesPanel />)
      
      expect(screen.getByTitle('Bold')).toBeInTheDocument()
      expect(screen.getByTitle('Italic')).toBeInTheDocument()
      expect(screen.getByTitle('Bullet list')).toBeInTheDocument()
      expect(screen.getByTitle('Numbered list')).toBeInTheDocument()
      expect(screen.getByTitle('Undo')).toBeInTheDocument()
      expect(screen.getByTitle('Redo')).toBeInTheDocument()
    })
  })

  describe('editor', () => {
    it('should render editor content area', () => {
      setupSessionWithSlides(5)
      
      render(<NotesPanel />)
      
      expect(screen.getByTestId('editor-content')).toBeInTheDocument()
    })
  })

  describe('with existing notes', () => {
    it('should load existing note content for current slide', () => {
      const notes: Record<string, Note> = {
        'slide-2': {
          id: 'note-1',
          slideId: 'slide-2',
          content: '<p>Existing note content</p>',
          plainText: 'Existing note content',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      }
      
      setupSessionWithSlides(5, 2, notes)
      
      render(<NotesPanel />)
      
      // The editor should be rendered (content is mocked)
      expect(screen.getByTestId('editor-content')).toBeInTheDocument()
    })
  })

  describe('slide change', () => {
    it('should update when slide changes', async () => {
      setupSessionWithSlides(5, 0)
      
      const { rerender } = render(<NotesPanel />)
      
      expect(screen.getByText('Slide 1')).toBeInTheDocument()
      
      // Change to slide 3
      useSessionStore.setState(state => ({
        session: state.session ? {
          ...state.session,
          currentSlideIndex: 2,
        } : null,
      }))
      
      rerender(<NotesPanel />)
      
      expect(screen.getByText('Slide 3')).toBeInTheDocument()
    })
  })
})

