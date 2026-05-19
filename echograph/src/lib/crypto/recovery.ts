// Browser-only Recovery Kit utilities.
// The EG-v1: content NEVER touches Supabase — only recovery_salt goes to the DB.

export function formatRecoveryKit(recoveryWrappedKeyB64: string): string {
  return `EG-v1:${recoveryWrappedKeyB64}`
}

// Returns the payload (recovery-wrapped MK, base64) or throws if the format is invalid.
export function parseRecoveryKey(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('EG-v1:')) {
    throw new Error('Invalid Recovery Kit. Key must start with "EG-v1:".')
  }
  const payload = trimmed.slice('EG-v1:'.length)
  if (!payload) throw new Error('Recovery Kit payload is empty.')
  return payload
}

export function downloadRecoveryKit(recoveryWrappedKeyB64: string): void {
  const content = formatRecoveryKit(recoveryWrappedKeyB64)
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'echograph-recovery-kit.txt'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
