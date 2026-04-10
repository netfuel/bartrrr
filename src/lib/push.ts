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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0))
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

    console.log('[Push] Subscribed successfully')
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
 * Fire-and-forget — errors are logged but not thrown.
 */
export function sendPushNotification(payload: SendPushPayload): void {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) return

  fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Include the anon key so the edge function can auth with Supabase
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  }).catch((err) => console.warn('[Push] Edge function call failed', err))
}
