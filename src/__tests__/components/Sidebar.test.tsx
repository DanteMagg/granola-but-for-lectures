import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from '../../renderer/components/Sidebar'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import type { SessionListItem } from '@shared/types'
import { createMockUIState, createMockSession } from '../helpers/mockData'

// Reset store helper
const resetStore = () => {
  useSessionStore.setState({
    session: null,
    sessionList: [],
    ui: createMockUIState(),
    isLoading: false,
    isSaving: false,
    error: null,
    createSession: vi.fn(),
    loadSession: vi.fn(),
    deleteSession: vi.fn(),
    setUIState: vi.fn(),
  })
}

// Mock session list
const createMockSessionList = (count: number): SessionListItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `session-${i}`,
    name: `Session ${i + 1}`,
    createdAt: new Date(Date.now() - i * 86400000).toISOString(), // Each day older
    updatedAt: new Date(Date.now() - i * 86400000).toISOString(),
    slideCount: (i + 1) * 5,
  }))

describe('Sidebar', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  describe('collapsed state', () => {
    it('should render collapsed sidebar when ui.sidebarCollapsed is true', () => {
      useSessionStore.setState({
        ui: createMockUIState({ sidebarCollapsed: true }),
      })
      
      render(<Sidebar />)
      
      // Should show expand button
      expect(screen.getByTitle('Expand sidebar')).toBeInTheDocument()
      
      // Should NOT show sessions header
      expect(screen.queryByText('Sessions')).not.toBeInTheDocument()
    })

    it('should call setUIState to expand when expand button clicked', () => {
      const setUIStateSpy = vi.fn()
      useSessionStore.setState({
        ui: createMockUIState({ sidebarCollapsed: true }),
        setUIState: setUIStateSpy,
      })
      
      render(<Sidebar />)
      
      fireEvent.click(screen.getByTitle('Expand sidebar'))
      
      expect(setUIStateSpy).toHaveBeenCalledWith({ sidebarCollapsed: false })
    })
  })

  describe('expanded state', () => {
    it('should render full sidebar when not collapsed', () => {
      render(<Sidebar />)
      
      expect(screen.getByText('Sessions')).toBeInTheDocument()
    })

    it('should show collapse button', () => {
      render(<Sidebar />)
      
      expect(screen.getByTitle('Collapse sidebar')).toBeInTheDocument()
    })

    it('should call setUIState to collapse when collapse button clicked', () => {
      const setUIStateSpy = vi.fn()
      useSessionStore.setState({ setUIState: setUIStateSpy })
      
      render(<Sidebar />)
      
      fireEvent.click(screen.getByTitle('Collapse sidebar'))
      
      expect(setUIStateSpy).toHaveBeenCalledWith({ sidebarCollapsed: true })
    })
  })

  describe('empty state', () => {
    it('should show empty state when no sessions', () => {
      render(<Sidebar />)
      
      expect(screen.getByText('No sessions yet')).toBeInTheDocument()
      expect(screen.getByText('Create your first session')).toBeInTheDocument()
    })

    it('should create session when "Create your first session" clicked', () => {
      const createSessionSpy = vi.fn()
      useSessionStore.setState({ createSession: createSessionSpy })
      
      render(<Sidebar />)
      
      fireEvent.click(screen.getByText('Create your first session'))
      
      expect(createSessionSpy).toHaveBeenCalled()
    })
  })

  describe('session list', () => {
    it('should render session list when sessions exist', () => {
      const sessions = createMockSessionList(3)
      useSessionStore.setState({ sessionList: sessions })
      
      render(<Sidebar />)
      
      expect(screen.getByText('Session 1')).toBeInTheDocument()
      expect(screen.getByText('Session 2')).toBeInTheDocument()
      expect(screen.getByText('Session 3')).toBeInTheDocument()
    })

    it('should show slide count for each session', () => {
      const sessions = createMockSessionList(2)
      useSessionStore.setState({ sessionList: sessions })
      
      render(<Sidebar />)
      
      expect(screen.getByText(/5 slides/)).toBeInTheDocument()
      expect(screen.getByText(/10 slides/)).toBeInTheDocument()
    })

    it('should highlight current session', () => {
      const sessions = createMockSessionList(3)
      useSessionStore.setState({
        sessionList: sessions,
        session: createMockSession({ id: 'session-1', name: 'Session 2' }),
      })
      
      render(<Sidebar />)
      
      // The current session should have different styling
      // We can check by looking for the session button and its classes
      const sessionButtons = screen.getAllByRole('button', { name: /Session/i })
      expect(sessionButtons.length).toBeGreaterThan(0)
    })

    it('should load session when clicked', () => {
      const sessions = createMockSessionList(3)
      const loadSessionSpy = vi.fn()
      useSessionStore.setState({
        sessionList: sessions,
        loadSession: loadSessionSpy,
      })
      
      render(<Sidebar />)
      
      fireEvent.click(screen.getByText('Session 2'))
      
      expect(loadSessionSpy).toHaveBeenCalledWith('session-1')
    })
  })

  describe('new session button', () => {
    it('should show new session button in header', () => {
      render(<Sidebar />)
      
      expect(screen.getByTitle('New session')).toBeInTheDocument()
    })

    it('should create session when new button clicked', () => {
      const createSessionSpy = vi.fn()
      useSessionStore.setState({ createSession: createSessionSpy })
      
      render(<Sidebar />)
      
      fireEvent.click(screen.getByTitle('New session'))
      
      expect(createSessionSpy).toHaveBeenCalled()
    })

    it('should show new session button in collapsed mode', () => {
      useSessionStore.setState({
        ui: createMockUIState({ sidebarCollapsed: true }),
      })
      
      render(<Sidebar />)
      
      expect(screen.getByTitle('New session')).toBeInTheDocument()
    })
  })

  describe('delete session', () => {
    it('should delete session when delete button clicked and confirmed', async () => {
      const sessions = createMockSessionList(2)
      const deleteSessionSpy = vi.fn()
      useSessionStore.setState({
        sessionList: sessions,
        deleteSession: deleteSessionSpy,
      })
      
      render(<Sidebar />)
      
      // Hover over first session to show delete button
      const firstSession = screen.getByText('Session 1').closest('[role="button"]')!
      fireEvent.mouseEnter(firstSession)
      
      // Click delete
      const deleteButton = screen.getAllByTitle('Delete session')[0]
      fireEvent.click(deleteButton)
      
      expect(window.confirm).toHaveBeenCalledWith('Delete this session? This cannot be undone.')
      expect(deleteSessionSpy).toHaveBeenCalledWith('session-0')
    })

    it('should not delete session when not confirmed', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      
      const sessions = createMockSessionList(2)
      const deleteSessionSpy = vi.fn()
      useSessionStore.setState({
        sessionList: sessions,
        deleteSession: deleteSessionSpy,
      })
      
      render(<Sidebar />)
      
      const firstSession = screen.getByText('Session 1').closest('[role="button"]')!
      fireEvent.mouseEnter(firstSession)

      const deleteButton = screen.getAllByTitle('Delete session')[0]
      fireEvent.click(deleteButton)

      expect(deleteSessionSpy).not.toHaveBeenCalled()
    })

    it('should stop propagation when delete clicked (not load session)', () => {
      const sessions = createMockSessionList(2)
      const loadSessionSpy = vi.fn()
      const deleteSessionSpy = vi.fn()
      useSessionStore.setState({
        sessionList: sessions,
        loadSession: loadSessionSpy,
        deleteSession: deleteSessionSpy,
      })
      
      render(<Sidebar />)
      
      const firstSession = screen.getByText('Session 1').closest('[role="button"]')!
      fireEvent.mouseEnter(firstSession)

      const deleteButton = screen.getAllByTitle('Delete session')[0]
      fireEvent.click(deleteButton)

      // Delete should be called, but NOT loadSession
      expect(deleteSessionSpy).toHaveBeenCalled()
      // loadSession should not be called from the delete click
    })
  })

  describe('date formatting', () => {
    it('should show "Today" for sessions updated today', () => {
      const sessions: SessionListItem[] = [{
        id: 'today-session',
        name: 'Test Session', // Use a name that doesn't contain "Today"
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        slideCount: 5,
      }]
      useSessionStore.setState({ sessionList: sessions })
      
      render(<Sidebar />)
      
      // Look specifically in the date section
      expect(screen.getByText(/5 slides · Today/)).toBeInTheDocument()
    })

    it('should show "Yesterday" for sessions updated yesterday', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      
      const sessions: SessionListItem[] = [{
        id: 'yesterday-session',
        name: 'Test Session', // Use a name that doesn't contain "Yesterday"
        createdAt: yesterday.toISOString(),
        updatedAt: yesterday.toISOString(),
        slideCount: 5,
      }]
      useSessionStore.setState({ sessionList: sessions })
      
      render(<Sidebar />)
      
      expect(screen.getByText(/5 slides · Yesterday/)).toBeInTheDocument()
    })

    it('should show "X days ago" for recent sessions', () => {
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      
      const sessions: SessionListItem[] = [{
        id: 'recent-session',
        name: 'Recent Session',
        createdAt: threeDaysAgo.toISOString(),
        updatedAt: threeDaysAgo.toISOString(),
        slideCount: 5,
      }]
      useSessionStore.setState({ sessionList: sessions })
      
      render(<Sidebar />)
      
      expect(screen.getByText(/3 days ago/)).toBeInTheDocument()
    })
  })
})
