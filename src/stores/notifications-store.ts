import { create } from 'zustand'
import type { AppNotification, NotificationType } from '@/types'
import { generateId } from '@/lib/utils'

interface AddNotificationData {
  /** Server id when known — lets realtime inserts dedupe against fetched rows */
  id?: string
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, string>
}

interface NotificationsState {
  notifications: AppNotification[]
  setNotifications: (notifications: AppNotification[]) => void
  getNotificationsForUser: (userId: string) => AppNotification[]
  getUnreadCount: (userId: string) => number
  addNotification: (data: AddNotificationData) => void
  markAsRead: (id: string) => void
  markAllAsRead: (userId: string) => void
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],

  setNotifications: (notifications) => set({ notifications }),

  getNotificationsForUser: (userId) =>
    get().notifications.filter((n) => n.userId === userId),

  getUnreadCount: (userId) =>
    get().notifications.filter((n) => n.userId === userId && !n.readAt).length,

  addNotification: (data) => {
    set((state) => {
      // Same server notification can arrive via realtime AND the initial
      // fetch — never insert the same id twice.
      if (data.id && state.notifications.some((n) => n.id === data.id)) {
        return state
      }
      const notification: AppNotification = {
        ...data,
        id: data.id ?? generateId(),
        createdAt: new Date().toISOString(),
      }
      return { notifications: [notification, ...state.notifications] }
    })
  },

  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
      ),
    })),

  markAllAsRead: (userId) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.userId === userId && !n.readAt
          ? { ...n, readAt: new Date().toISOString() }
          : n,
      ),
    })),
}))
