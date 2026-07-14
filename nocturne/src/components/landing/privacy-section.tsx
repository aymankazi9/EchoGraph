const GUARANTEES = [
  { text: 'Vault passphrase never leaves your device — not even hashed', rose: false },
  { text: 'Master Key is non-extractable; created with extractable: false', rose: false },
  { text: 'Files are AES-GCM 256 encrypted before upload', rose: false },
  { text: 'PBKDF2 at 310,000 iterations runs in a Web Worker, off the main thread', rose: false },
  { text: 'Whisper + BERT run locally via WASM — nothing leaves the browser on Free', rose: false },
  { text: 'No password reset exists. There is no backdoor.', rose: true },
]

const KEYCHAIN_TIERS = [
  {
    label: 'Passphrase',
    sub: 'your memory only',
    arrowLabel: 'PBKDF2 · 310,000 iterations · SHA-256',
    indigo: false,
  },
  {
    label: 'KEK',
    sub: 'memory only, discarded after unwrap',
    arrowLabel: 'AES-KW unwrap',
    indigo: false,
  },
  {
    label: 'Master Key',
    sub: 'non-extractable CryptoKey',
    arrowLabel: 'AES-GCM 256 · unique IV per file',
    indigo: false,
  },
  {
    label: 'Encrypted .bin blob',
    sub: 'stored in Supabase — opaque to the server',
    arrowLabel: null,
    indigo: true,
  },
]

export function PrivacySection() {
  return (
    <section
      id="privacy"
      style={{
        scrollMarginTop: 80,
        padding: 'clamp(72px,9vw,120px) 24px',
        borderTop: '1px solid #191827',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 64,
          alignItems: 'start',
        }}
        data-privacy-grid=""
      >
        {/* Left: guarantees */}
        <div data-reveal="">
          <p
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#818CF8',
              margin: '0 0 16px',
            }}
          >
            Zero-knowledge architecture
          </p>
          <h2
            style={{
              fontSize: 'clamp(26px,3.4vw,34px)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              margin: '0 0 16px',
              lineHeight: 1.2,
              color: '#E2E8F0',
            }}
          >
            The server stores data it cannot read.
          </h2>
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: '#94A3B8',
              margin: '0 0 26px',
            }}
          >
            Nocturne&apos;s encryption isn&apos;t a marketing claim — it&apos;s a structural constraint. Your vault passphrase derives the key that wraps your Master Key, and that passphrase never leaves your browser.
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {GUARANTEES.map((g, i) => {
              const c = g.rose ? '#FB7185' : '#818CF8'
              return (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 16,
                    padding: '13px 0',
                    borderBottom: i === GUARANTEES.length - 1 ? 'none' : '1px solid #1E1E2E',
                  }}
                >
                  <span
                    style={{
                      marginTop: 6,
                      flexShrink: 0,
                      width: 11,
                      height: 6,
                      borderLeft: `1.5px solid ${c}`,
                      borderBottom: `1.5px solid ${c}`,
                      transform: 'rotate(-45deg)',
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 14.5,
                      lineHeight: 1.6,
                      color: g.rose ? '#E2E8F0' : '#94A3B8',
                    }}
                  >
                    {g.text}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Right: keychain diagram */}
        <div
          data-reveal=""
          style={{
            position: 'relative',
            border: '1px solid #1E1E2E',
            borderRadius: 14,
            background: '#111118',
            padding: 30,
            overflow: 'hidden',
          }}
        >
          {/* Radial glow */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(500px circle at 80% -10%, rgba(99,102,241,0.08), transparent 60%)',
              pointerEvents: 'none',
            }}
          />

          <p
            style={{
              position: 'relative',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: '#5B6478',
              margin: '0 0 24px',
            }}
          >
            3-Tier key hierarchy
          </p>

          {KEYCHAIN_TIERS.map((tier, i) => (
            <div key={i}>
              {/* Tier box */}
              <div
                data-reveal=""
                data-delay={String(i * 160)}
                data-kc="tier"
                style={{
                  position: 'relative',
                  border: '1px solid ' + (tier.indigo ? 'rgba(99,102,241,0.45)' : '#2D2B45'),
                  borderRadius: 10,
                  padding: '14px 18px',
                  background: '#09090F',
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: tier.indigo ? '#818CF8' : '#E2E8F0',
                  }}
                >
                  {tier.label}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: '#5B6478',
                    marginTop: 3,
                  }}
                >
                  {tier.sub}
                </div>
              </div>

              {/* Arrow connector */}
              {tier.arrowLabel && (
                <div
                  data-kc="arrow"
                  style={{
                    minHeight: 36,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '7px 0 7px 42px',
                    lineHeight: 1.45,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: '#5B6478',
                  }}
                >
                  <span data-reveal="" data-delay={String(i * 160 + 100)}>
                    {tier.arrowLabel}
                  </span>
                </div>
              )}
            </div>
          ))}

          {/* Warning box */}
          <div
            data-reveal=""
            data-delay="600"
            style={{
              position: 'relative',
              marginTop: 22,
              border: '1px solid rgba(244,63,94,0.3)',
              background: 'rgba(244,63,94,0.1)',
              borderRadius: 10,
              padding: '13px 18px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
              color: '#FB7185',
            }}
          >
            No password reset exists. There is no backdoor.
          </div>
        </div>
      </div>
    </section>
  )
}
