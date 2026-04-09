import { create } from 'zustand'
import type { AppNotification, NotificationType } from '@/types'
import { generateId } from '@/lib/utils'

interface AddNotificationData {
  userId: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, string>
}

interface NotificationsState {
  notifications: AppNotification[]
  getNotificationsForUser: (userId: string) => AppNotification[]
  getUnreadCount: (userId: string) => number
  addNotification: (data: AddNotificationData) => void
  markAsRead: (id: string) => void
  markAllAsRead: (userId: string) => void
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],

  getNotificationsForUser: (userId) =>
    get().notifications.filter((n) => n.userId === userId),

  getUnreadCount: (userId) =>
    get().notifications.filter((n) => n.userId === userId && !n.readAt).length,

  addNotification: (data) => {
    const notification: AppNotification = {
      id: generateId(),
      ...data,
      createdAt: new Date().toISOString(),
    }
    set((state) => ({
      notifications: [notification, ...state.notifications],
    }))
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
