import { CreditCard } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Billing — Nocturne' }

export default function BillingPage() {
  return (
    <div style={{ maxWidth: 600 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.025em', color: '#E2E8F0', margin: '0 0 6px' }}>Billing</h1>
        <p style={{ fontSize: 14, color: '#5B6478', margin: 0 }}>Manage your subscription and payment details.</p>
      </div>

      {/* Current plan card */}
      <div style={{ padding: '22px 24px', borderRadius: 14, border: '1px solid #1E1E2E', background: '#0C0C13', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 12, color: '#5B6478', margin: '0 0 4px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Current plan</p>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#E2E8F0', margin: 0 }}>Free</p>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 9999, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', fontSize: 12, color: '#A5B4FC', fontWeight: 500 }}>
            Active
          </span>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 12, color: '#5B6478', margin: '0 0 3px' }}>Storage</p>
            <p style={{ fontSize: 14, color: '#CBD5E1', margin: 0 }}>500 MB included</p>
          </div>
          <div>
            <p style={{ fontSize: 12, color: '#5B6478', margin: '0 0 3px' }}>Sessions</p>
            <p style={{ fontSize: 14, color: '#CBD5E1', margin: 0 }}>Unlimited</p>
          </div>
        </div>
      </div>

      {/* Pro upgrade teaser */}
      <div style={{ padding: '22px 24px', borderRadius: 14, border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.05)', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8', flexShrink: 0 }}>
            <CreditCard size={18} strokeWidth={1.5} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#E2E8F0', margin: '0 0 5px' }}>Nocturne Pro — coming soon</p>
            <p style={{ fontSize: 13.5, color: '#5B6478', margin: '0 0 16px', lineHeight: 1.6 }}>
              Expanded storage, priority transcription, and advanced Red Zone analytics. Upgrade options will appear here when available.
            </p>
            <Link
              href="/roadmap"
              style={{ fontSize: 13, color: '#818CF8', textDecoration: 'none' }}
            >
              View roadmap →
            </Link>
          </div>
        </div>
      </div>

      {/* Payment method placeholder */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#94A3B8', margin: '0 0 10px' }}>Payment method</p>
        <div style={{ padding: '16px 20px', borderRadius: 10, border: '1px solid #1E1E2E', background: '#0C0C13', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 24, borderRadius: 5, border: '1px solid #2D2B45', background: '#16151F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={13} strokeWidth={1.5} style={{ color: '#3F485C' }} />
          </div>
          <span style={{ fontSize: 13.5, color: '#3F485C' }}>No payment method on file</span>
        </div>
      </div>
    </div>
  )
}
