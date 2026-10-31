'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { EclipseMark } from './eclipse-mark'
import { useContourField } from './use-contour-field'

type Action = { label: string; href?: string; onClick?: () => void }
type TerminalRow = { src: string; msg: string; value?: string }

function ActionButton({ action, kind }: { action: Action; kind: 'primary' | 'text' }) {
  const style: React.CSSProperties =
    kind === 'primary'
      ? { height: 44, padding: '0 22px', borderRadius: 2, background: 'var(--color-accent)', color: 'var(--color-text-inverse)' }
      : { height: 44, padding: '0 6px', background: 'transparent', color: 'var(--color-text-secondary)' }
  const className = kind === 'primary' ? 'nocturne-error-primary' : 'nocturne-error-text'
  const content = (
    <>
      {action.label}
      {kind === 'text' && <span style={{ fontFamily: 'var(--font-mono)' }}>&nbsp;→</span>}
    </>
  )
  const shared = { className, style: { ...style, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer' } as React.CSSProperties }
  return action.href ? (
    <Link href={action.href} {...shared}>{content}</Link>
  ) : (
    <button type="button" onClick={action.onClick} {...shared}>{content}</button>
  )
}

// THEME_SURGICAL.md §9/06 — 404/500 full-viewport (hero) or in-shell (compact/card) error state.
export function ErrorPage({
  code,
  severity = false,
  replaceZeroWithMark = false,
  compact = false,
  headline,
  body,
  primary,
  secondary,
  terminal,
}: {
  code: string
  severity?: boolean
  replaceZeroWithMark?: boolean
  compact?: boolean
  headline: string
  body: string
  primary: Action
  secondary: Action
  terminal?: TerminalRow[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const readoutRef = useRef<HTMLDivElement>(null)
  useContourField(canvasRef, { variant: compact ? 'card' : 'hero', readoutRef: compact ? undefined : readoutRef })

  const codeSize = compact ? 72 : 152
  const markSize = compact ? 52 : 112
  const codeColor = severity ? 'var(--color-severity)' : 'var(--color-text-primary)'

  return (
    <div
      style={{
        position: 'relative',
        minHeight: compact ? '100%' : '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-base)',
        overflow: 'hidden',
        padding: compact ? '48px 24px' : '24px',
      }}
    >
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {!compact && (
        <div
          ref={readoutRef}
          style={{ position: 'fixed', top: 0, left: 0, zIndex: 10, pointerEvents: 'none', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)', opacity: 0 }}
        />
      )}

      {!compact && (
        <Link href="/" style={{ position: 'absolute', top: 28, left: 32, zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <EclipseMark size={22} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500, color: 'var(--color-text-primary)' }}>Nocturne</span>
        </Link>
      )}

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: compact ? 360 : 480 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: compact ? 2 : 6,
            fontFamily: 'var(--font-mono)',
            fontSize: codeSize,
            lineHeight: 1,
            fontWeight: 500,
            color: codeColor,
            marginBottom: compact ? 16 : 26,
          }}
        >
          {replaceZeroWithMark ? (
            <>
              <span>4</span>
              <EclipseMark size={markSize} />
              <span>4</span>
            </>
          ) : (
            code
          )}
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: compact ? 22 : 36,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--color-text-primary)',
            margin: compact ? '0 0 10px' : '0 0 14px',
          }}
        >
          {headline}
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: compact ? 14 : 16,
            lineHeight: 1.65,
            color: 'var(--color-text-secondary)',
            margin: compact ? '0 0 24px' : '0 0 32px',
          }}
        >
          {body}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: terminal ? 36 : 0 }}>
          <ActionButton action={primary} kind="primary" />
          <ActionButton action={secondary} kind="text" />
        </div>

        {terminal && terminal.length > 0 && (
          <div
            style={{
              marginTop: 8,
              textAlign: 'left',
              background: '#0A0A0A',
              border: '1px solid var(--color-border-default)',
              padding: '14px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
              lineHeight: 1.95,
            }}
          >
            {terminal.map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                <span style={{ color: '#76767B', flexShrink: 0 }}>[{row.src}]</span>
                <span style={{ color: '#9A9A9F', flexShrink: 0 }}>{row.msg}</span>
                {row.value && <span style={{ color: 'var(--color-severity)' }}>{row.value}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .nocturne-error-primary:hover { background: var(--color-accent-hover) !important; }
        .nocturne-error-text:hover { color: var(--color-text-primary) !important; }
      `}</style>
    </div>
  )
}
