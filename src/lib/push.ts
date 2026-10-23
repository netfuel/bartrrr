/**
 * Bartrrr — Web Push client utilities
 *
 * Handles:
 *  1. Service worker registration
 *  2. Requesting notification permission
 *  3. Subscribing / unsubscribing from push
 *  4. Storing subscriptions in Supabase
 *  5. Triggering push notifications via Edge Function
 */

import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

// ── Service Worker ────────────────────────────────────────────────────────────

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready
    return reg
  } catch (err) {
    console.warn('[Push] Service worker registration failed', err)
    return null
  }
}

// ── Subscription management ───────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(rawData.length))
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i)
  return bytes
}

/**
 * Request push permission, subscribe the browser, and save the subscription to Supabase.
 * Returns true if successfully subscribed.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[Push] VITE_VAPID_PUBLIC_KEY not set')
    return false
  }
  if (!supabase) {
    console.warn('[Push] Supabase not initialized')
    return false
  }
  if (!('PushManager' in window)) {
    console.warn('[Push] Push not supported in this browser')
    return false
  }

  // Request permission
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  try {
    const reg = await registerServiceWorker()
    if (!reg) return false

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const sub = subscription.toJSON()
    if (!sub.keys) return false

    // Upsert into Supabase
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: sub.endpoint!,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    }, { onConflict: 'user_id,endpoint' })

    if (error) {
      console.warn('[Push] Failed to save subscription', error)
      return false
    }

    return true
  } catch (err) {
    console.warn('[Push] Subscription failed', err)
    return false
  }
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  if (!supabase) return

  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe()
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', sub.endpoint)
    }
  } catch (err) {
    console.warn('[Push] Unsubscribe failed', err)
  }
}

export function isPushSupported(): boolean {
  return 'PushManager' in window && 'serviceWorker' in navigator && !!VAPID_PUBLIC_KEY
}

export function getPushPermissionState(): NotificationPermission | 'unsupported' {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

// ── Sending notifications ─────────────────────────────────────────────────────

interface SendPushPayload {
  userId: string
  title: string
  body: string
  url?: string
}

/**
 * Trigger a push notification for a user via the Edge Function.
 * Fire-and-forget — errors are logged but not thrown. The caller's access
 * token is sent so the function can verify who is pushing to whom.
 */
export function sendPushNotification(payload: SendPushPayload): void {
  if (!supabase) return
  const client = supabase
  void (async () => {
    try {
      const { data } = await client.auth.getSession()
      const token = data.session?.access_token
      if (!token) return
      const { error } = await client.functions.invoke('send-push', {
        body: payload,
        headers: { Authorization: `Bearer ${token}` },
      })
      if (error) console.warn('[Push] Edge function call failed', error)
    } catch (err) {
      console.warn('[Push] Edge function call failed', err)
    }
  })()
}
