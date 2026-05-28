import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('NEXT_PUBLIC_APP_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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
    const token: string = (body.token ?? '').trim()

    if (!token) {
      return json({ error: 'invalid_token' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Look up the confirmation token
    const { data: confirmation, error } = await supabase
      .from('newsletter_confirmations')
      .select('id, email, confirmed, expires_at')
      .eq('token', token)
      .maybeSingle()

    if (error || !confirmation) {
      return json({ error: 'invalid_token' }, 400)
    }

    // Already confirmed — idempotent success
    if (confirmation.confirmed) {
      return json({ status: 'already_confirmed', email: confirmation.email }, 200)
    }

    // Expired
    if (new Date(confirmation.expires_at) < new Date()) {
      return json({ error: 'invalid_token' }, 400)
    }

    // Mark confirmed in our DB first
    const { error: updateError } = await supabase
      .from('newsletter_confirmations')
      .update({ confirmed: true })
      .eq('id', confirmation.id)

    if (updateError) {
      console.error('confirm update error:', updateError)
      return json({ error: 'service_error' }, 500)
    }

    // TODO: wire Resend audience when plan supports it

    return json({ status: 'confirmed', email: confirmation.email }, 200)
  } catch (err) {
    console.error('confirm-newsletter error:', err)
    return json({ error: 'service_error' }, 500)
  }
})
