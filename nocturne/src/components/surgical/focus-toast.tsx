// The "3 AM Deep Focus Mode" system toast — THEME_SURGICAL.md §8.
export function FocusToast({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 76,
        right: 'clamp(16px,3vw,32px)',
        zIndex: 60,
        minWidth: 270,
        padding: '14px 16px',
        background: '#000000',
        border: '1px solid rgba(255,59,48,0.45)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11.5,
        lineHeight: 1.9,
        letterSpacing: '0.06em',
        color: '#CFCFD2',
        animation: 'noct-toast .45s cubic-bezier(.22,1,.36,1) both',
      }}
    >
      <div style={{ animation: 'noct-in .3s .15s ease both' }}>
        <span style={{ color: '#FF3B30' }}>&gt;</span> SYSTEM STATE: 03:00_LOCAL_TIME
      </div>
      <div style={{ animation: 'noct-in .3s .4s ease both' }}>
        <span style={{ color: '#FF3B30' }}>&gt;</span> NOISE FILTER: MAXIMUM
      </div>
      <div style={{ animation: 'noct-in .3s .65s ease both' }}>
        <span style={{ color: '#FF3B30' }}>&gt;</span> RED ZONE:{' '}
        <span style={{ color: '#FF3B30' }}>ACTIVE</span>
      </div>
    </div>
  )
}
