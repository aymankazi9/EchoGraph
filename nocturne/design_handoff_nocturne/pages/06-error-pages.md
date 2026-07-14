# Error Pages — 404 & 500

- **Design references:** `reference/source/404.dc.html`, `reference/source/500.dc.html`
- **Target routes:**
  - 404 → `src/app/(app)/not-found.tsx` + a root `not-found.tsx` + `(marketing)` not-found
  - 500 → `src/app/(app)/error.tsx` + `(marketing)/error.tsx` (Next error boundaries)
- **Status:** Files exist (`error.tsx`, `not-found.tsx`); restyle to match mocks.

## Shared layout
Centered, full-viewport, dark with one ambient glow. Wordmark pinned top-left (`top:28px;
left:32px`) linking to Vault. Center column (`text-align:center`, narrow `max-width` ~430–440px):
a glyph/illustration block, `h1` (23px/600/-0.02em), one paragraph (`text-secondary`,
line-height 1.65), then a two-button action row (`gap:11px`, wraps).

Buttons: primary indigo (`height:46px`, `rounded-md` 10px, near-black text) + secondary ghost
(`border:#2D2B45`). Error-zone radii = 10px.

## 404 — "This page isn't in your vault"
- Copy: *"The link may be broken, or the page was moved. Either way nothing here was decrypted —
  your vault is untouched."* (privacy reassurance even in errors).
- Actions: **Back to your vault** (→ `/vault`, back-arrow icon) · **Visit Help Center** (→ `/help`).

## 500 — "Something jammed on our end"
- Copy: *"A server hit a fault while reaching for your vault. Nothing was lost and nothing was
  decrypted…"*.
- Actions: **Try again** (re-attempt / `reset()` from Next error boundary, refresh icon) ·
  **Visit Help Center**.

## Note
In code, the 500 "Try again" should call the Next.js `error.tsx` `reset()` callback rather than
linking to a URL. The 404 is a static `not-found.tsx`.
