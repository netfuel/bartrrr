import { create } from 'zustand'
import { generateId } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
}

interface ToastState {
  toasts: ToastItem[]
  addToast: (message: string, type?: ToastType) => void
  dismissToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  // Keep at most 3 on screen; oldest drops first
  addToast: (message, type = 'info') =>
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { id: generateId(), message, type }],
    })),

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

/** Imperative helper — safe to call from non-React code (stores, services). */
export function showToast(message: string, type: ToastType = 'info') {
  useToastStore.getState().addToast(message, type)
}
