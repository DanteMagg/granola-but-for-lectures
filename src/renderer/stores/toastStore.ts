import { create } from 'zustand'

// Toast types
export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'shortcut'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  shortcutKey?: string
  duration?: number
}

// Toast store
interface ToastStore {
  toasts: ToastItem[]
  addToast: (toast: Omit<ToastItem, 'id'>) => string
  removeToast: (id: string) => void
  clearAll: () => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))
    return id
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },
  
  clearAll: () => {
    set({ toasts: [] })
  },
}))

// Convenience functions
export const toast = {
  success: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().addToast({ type: 'success', title, message, duration }),
  error: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().addToast({ type: 'error', title, message, duration }),
  info: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().addToast({ type: 'info', title, message, duration }),
  warning: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().addToast({ type: 'warning', title, message, duration }),
  shortcut: (title: string, shortcutKey: string) =>
    useToastStore.getState().addToast({ type: 'shortcut', title, shortcutKey, duration: 1500 }),
}

