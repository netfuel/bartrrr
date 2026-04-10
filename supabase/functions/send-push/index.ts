/**
 * Bartrrr — send-push Edge Function
 *
 * POST { userId, title, body, url? }
 * Fetches the user's push subscriptions and sends Web Push notifications.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
// @ts-ignore — web-push is available as an npm package in Deno
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { userId, title, body, url } = await req.json()

    if (!userId || !title || !body) {
      return new Response(JSON.stringify({ error: 'userId, title, body required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!

    // Configure VAPID
    webpush.setVapidDetails('mailto:push@bartrrr.app', vapidPublicKey, vapidPrivateKey)

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch push subscriptions for this user
    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (error) throw error

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = JSON.stringify({
      title,
      body,
      data: { url: url || '/' },
      tag: 'bartrrr',
    })

    // Send to all subscriptions (fan-out)
    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        ),
      ),
    )

    // Clean up expired subscriptions (410 Gone)
    const expiredEndpoints: string[] = []
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status === 'rejected') {
        const statusCode = (r.reason as { statusCode?: number })?.statusCode
        if (statusCode === 410) expiredEndpoints.push(subs[i].endpoint)
      }
    }
    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints)
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-push]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
