export type SubscribeResult =
  | { status: 'pending' }
  | { status: 'already_subscribed' }
  | { status: 'error'; message?: string }

export async function subscribeToNewsletter(
  email: string,
  consentGiven: boolean,
): Promise<SubscribeResult> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/subscribe-newsletter`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email, consentGiven }),
      },
    )

    if (res.status === 429) {
      return { status: 'error', message: 'rate_limited' }
    }

    if (!res.ok) {
      return { status: 'error' }
    }

    const data = await res.json()
    return { status: data.status }
  } catch {
    return { status: 'error' }
  }
}
