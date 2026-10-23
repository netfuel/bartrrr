import { create } from 'zustand'
import type { AppNotification, NotificationType } from '@/types'
import { generateId } from '@/lib/utils'
import * as svc from '@/lib/supabase/supabase-service'
import { hasBackend, persist } from './persist'

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
  /** Insert a server notification (realtime), deduped by id */
  receiveNotification: (notification: AppNotification) => void
  getNotificationsForUser: (userId: string) => AppNotification[]
  getUnreadCount: (userId: string) => number
  /**
   * Called by pages after an action that should notify the other party.
   * With a backend this is a no-op: database triggers create the
   * notification server-side (clients can't write notifications for
   * other users). In offline demo mode it records it locally.
   */
  addNotification: (data: AddNotificationData) => void
  markAsRead: (id: string) => void
  markAllAsRead: (userId: string) => void
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],

  setNotifications: (notifications) => set({ notifications }),

  receiveNotification: (notification) =>
    set((state) =>
      state.notifications.some((n) => n.id === notification.id)
        ? state
        : { notifications: [notification, ...state.notifications] },
    ),

  getNotificationsForUser: (userId) =>
    get().notifications.filter((n) => n.userId === userId),

  getUnreadCount: (userId) =>
    get().notifications.filter((n) => n.userId === userId && !n.readAt).length,

  addNotification: (data) => {
    if (hasBackend() && !data.id) return
    get().receiveNotification({
      ...data,
      id: data.id ?? generateId(),
      createdAt: new Date().toISOString(),
    })
  },

  markAsRead: (id) => {
    const previous = get().notifications.find((n) => n.id === id)
    if (!previous || previous.readAt) return
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
      ),
    }))
    persist(() => svc.markNotificationRead(id), {
      error: "Couldn't update your notifications",
      rollback: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => (n.id === id ? previous : n)),
        })),
    })
  },

  markAllAsRead: (userId) => {
    const previous = get().notifications
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.userId === userId && !n.readAt
          ? { ...n, readAt: new Date().toISOString() }
          : n,
      ),
    }))
    persist(() => svc.markAllNotificationsRead(userId), {
      error: "Couldn't update your notifications",
      rollback: () => set({ notifications: previous }),
    })
  },
}))
