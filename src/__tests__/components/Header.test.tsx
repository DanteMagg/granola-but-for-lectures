import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Header } from '../../renderer/components/Header'
import { useSessionStore } from '../../renderer/stores/sessionStore'
import { createMockSession, createMockUIState } from '../helpers/mockData'

// Mock the store
vi.mock('../../renderer/stores/sessionStore')

const mockUseSessionStore = vi.mocked(useSessionStore)

describe('Header', () => {
  const mockSetUIState = vi.fn()
  const mockSetSessionName = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render app title', () => {
      mockUseSessionStore.mockReturnValue({
        session: null,
        ui: createMockUIState(),
        setUIState: mockSetUIState,
        setSessionName: mockSetSessionName,
      } as any)

      render(<Header />)
      
      expect(screen.getByText('Lecture Notes')).toBeInTheDocument()
    })

    it('should show "No session" when no session exists', () => {
      mockUseSessionStore.mockReturnValue({
        session: null,
        ui: createMockUIState(),
        setUIState: mockSetUIState,
        setSessionName: mockSetSessionName,
      } as any)

      render(<Header />)
      
      expect(screen.getByText('No session')).toBeInTheDocument()
    })

    it('should show session name when session exists', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ name: 'My Lecture Notes' }),
        ui: createMockUIState(),
        setUIState: mockSetUIState,
        setSessionName: mockSetSessionName,
      } as any)

      render(<Header />)
      
      expect(screen.getByText('My Lecture Notes')).toBeInTheDocument()
    })
  })

  describe('session controls', () => {
    it('should show Search, Ask AI, Export buttons when session exists', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession(),
        ui: createMockUIState(),
        setUIState: mockSetUIState,
        setSessionName: mockSetSessionName,
      } as any)

      render(<Header />)
      
      expect(screen.getByTitle('Search (⌘K)')).toBeInTheDocument()
      expect(screen.getByTitle('Ask AI (A)')).toBeInTheDocument()
      expect(screen.getByTitle('Export session (⌘E)')).toBeInTheDocument()
    })

    it('should not show session controls when no session', () => {
      mockUseSessionStore.mockReturnValue({
        session: null,
        ui: createMockUIState(),
        setUIState: mockSetUIState,
        setSessionName: mockSetSessionName,
      } as any)

      render(<Header />)
      
      expect(screen.queryByTitle('Search (⌘K)')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Ask AI (A)')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Export session (⌘E)')).not.toBeInTheDocument()
    })
  })

  describe('session name editing', () => {
    it('should allow editing session name on click', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ name: 'Test Session' }),
        ui: createMockUIState(),
        setUIState: mockSetUIState,
        setSessionName: mockSetSessionName,
      } as any)

      render(<Header />)
      
      const nameButton = screen.getByText('Test Session')
      fireEvent.click(nameButton)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveValue('Test Session')
    })

    it('should save new name on blur', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ name: 'Test Session' }),
        ui: createMockUIState(),
        setUIState: mockSetUIState,
        setSessionName: mockSetSessionName,
      } as any)

      render(<Header />)
      
      const nameButton = screen.getByText('Test Session')
      fireEvent.click(nameButton)
      
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'New Name' } })
      fireEvent.blur(input)
      
      expect(mockSetSessionName).toHaveBeenCalledWith('New Name')
    })

    it('should save new name on Enter key', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ name: 'Test Session' }),
        ui: createMockUIState(),
        setUIState: mockSetUIState,
        setSessionName: mockSetSessionName,
      } as any)

      render(<Header />)
      
      const nameButton = screen.getByText('Test Session')
      fireEvent.click(nameButton)
      
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'New Name' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      
      expect(mockSetSessionName).toHaveBeenCalledWith('New Name')
    })

    it('should cancel editing on Escape key', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession({ name: 'Test Session' }),
        ui: createMockUIState(),
        setUIState: mockSetUIState,
        setSessionName: mockSetSessionName,
      } as any)

      render(<Header />)
      
      const nameButton = screen.getByText('Test Session')
      fireEvent.click(nameButton)
      
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'New Name' } })
      fireEvent.keyDown(input, { key: 'Escape' })
      
      expect(mockSetSessionName).not.toHaveBeenCalled()
      expect(screen.getByText('Test Session')).toBeInTheDocument()
    })
  })

  describe('button actions', () => {
    it('should open search modal when Search button clicked', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession(),
        ui: createMockUIState(),
        setUIState: mockSetUIState,
        setSessionName: mockSetSessionName,
      } as any)

      render(<Header />)
      
      const searchButton = screen.getByTitle('Search (⌘K)')
      fireEvent.click(searchButton)
      
      expect(mockSetUIState).toHaveBeenCalledWith({ showSearchModal: true })
    })

    it('should toggle AI chat when Ask AI button clicked', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession(),
        ui: createMockUIState({ showAIChat: false }),
        setUIState: mockSetUIState,
        setSessionName: mockSetSessionName,
      } as any)

      render(<Header />)
      
      const aiButton = screen.getByTitle('Ask AI (A)')
      fireEvent.click(aiButton)
      
      expect(mockSetUIState).toHaveBeenCalledWith({ showAIChat: true })
    })

    it('should open export modal when Export button clicked', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession(),
        ui: createMockUIState(),
        setUIState: mockSetUIState,
        setSessionName: mockSetSessionName,
      } as any)

      render(<Header />)
      
      const exportButton = screen.getByTitle('Export session (⌘E)')
      fireEvent.click(exportButton)
      
      expect(mockSetUIState).toHaveBeenCalledWith({ showExportModal: true })
    })

    it('should open shortcuts modal when Keyboard button clicked', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession(),
        ui: createMockUIState(),
        setUIState: mockSetUIState,
        setSessionName: mockSetSessionName,
      } as any)

      render(<Header />)
      
      const shortcutsButton = screen.getByTitle('Keyboard shortcuts (?)')
      fireEvent.click(shortcutsButton)
      
      expect(mockSetUIState).toHaveBeenCalledWith({ showShortcutsHelp: true })
    })

    it('should open settings modal when Settings button clicked', () => {
      mockUseSessionStore.mockReturnValue({
        session: createMockSession(),
        ui: createMockUIState(),
        setUIState: mockSetUIState,
        setSessionName: mockSetSessionName,
      } as any)

      render(<Header />)
      
      const settingsButton = screen.getByTitle('Settings')
      fireEvent.click(settingsButton)
      
      expect(mockSetUIState).toHaveBeenCalledWith({ showSettingsModal: true })
    })
  })

  describe('accessibility', () => {
    it('should have proper role and aria-label', () => {
      mockUseSessionStore.mockReturnValue({
        session: null,
        ui: createMockUIState(),
        setUIState: mockSetUIState,
        setSessionName: mockSetSessionName,
      } as any)

      render(<Header />)
      
      expect(screen.getByRole('banner')).toHaveAttribute('aria-label', 'Application header')
    })
  })
})

