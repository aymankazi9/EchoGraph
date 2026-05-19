import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateConfirmationEmail } from './email-template.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('NEXT_PUBLIC_APP_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function hashIP(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  try {
    const body = await req.json()
    const email: string = (body.email ?? '').trim().toLowerCase()
    const consentGiven: boolean = body.consentGiven === true

    if (!EMAIL_REGEX.test(email) || !consentGiven) {
      return json({ error: 'invalid_input' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Clean up stale data at the start of each invocation
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
    await supabase.from('newsletter_rate_limits').delete().lt('attempted_at', oneHourAgo)
    await supabase
      .from('newsletter_confirmations')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .eq('confirmed', false)

    // Rate limit — max 3 attempts per IP per hour
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const ipHash = await hashIP(ip)

    const { count: attemptCount } = await supabase
      .from('newsletter_rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('attempted_at', oneHourAgo)

    if ((attemptCount ?? 0) >= 3) {
      return json({ error: 'rate_limited' }, 429)
    }

    // Record this attempt before doing any work
    await supabase.from('newsletter_rate_limits').insert({ ip_hash: ipHash })

    // Already confirmed check
    const { data: confirmed } = await supabase
      .from('newsletter_confirmations')
      .select('id')
      .eq('email', email)
      .eq('confirmed', true)
      .maybeSingle()

    if (confirmed) {
      return json({ status: 'already_subscribed' }, 200)
    }

    // Upsert pending confirmation (reset token + expiry on re-subscribe)
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 86_400_000).toISOString() // 24 h

    const { error: upsertError } = await supabase
      .from('newsletter_confirmations')
      .upsert(
        { email, token, confirmed: false, expires_at: expiresAt },
        { onConflict: 'email' },
      )

    if (upsertError) {
      console.error('upsert error:', upsertError)
      return json({ error: 'service_error' }, 500)
    }

    // Send confirmation email via Resend (REST — no SDK import needed)
    const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? ''
    const confirmationUrl = `${appUrl}/confirm-subscription?token=${token}`

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM_EMAIL'),
        to: [email],
        subject: 'Confirm your EchoGraph subscription',
        html: generateConfirmationEmail({ email, confirmationUrl }),
      }),
    })

    if (!emailRes.ok) {
      console.error('Resend error:', await emailRes.text())
      return json({ error: 'service_error' }, 500)
    }

    return json({ status: 'pending' }, 200)
  } catch (err) {
    console.error('subscribe-newsletter error:', err)
    return json({ error: 'service_error' }, 500)
  }
})
