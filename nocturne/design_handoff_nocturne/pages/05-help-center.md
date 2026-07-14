# Help Center

- **Design reference:** `reference/source/Help Center.dc.html`
- **Target route:** `src/app/(marketing)/help/`
- **Status:** Route exists; rebuild to match mock. Reuse `src/components/marketing/help-accordion.tsx`.

## Purpose
Self-serve support: search the docs, browse by category, or open a support ticket.

## Layout (centered, `max-width` varies by section)
1. **Hero** (`max-width:920px`, centered): eyebrow "Help Center", `h1` "How can we help?"
   (clamp 30→44px, -0.03em), subcopy. Large **search input** (54px tall, `rounded` ~11px,
   leading search icon, clear-button when query present).
2. **Category cards** (`max-width:920px`): 4-col grid (`[data-cats]`) of categories — Getting
   started, Encryption & security, Features, Troubleshooting. Each card: icon-chip, heading,
   blurb, article count. Active category highlights.
3. **Documentation list** (`max-width:720px`): `h2` ("Browse the documentation" / "Search
   results" / category name) + result count. FAQ items as expandable accordion rows. The FAQ
   content (`buildFaqs()`) is real and reusable — covers uploads, passphrase, Red Zone,
   transcription speed, PDF viewer issues, etc.
   - **Empty state** when no search match: icon, "No articles match '…'", + "Open a ticket" CTA.
4. **Contact / ticket** (`max-width:1080px`, 2-col): left = support channels; right = ticket
   form with category chips ("Something is broken", etc.) and message field.

## Behavior
- Live search filters FAQ items (`query` → filtered `groups`, `total` count).
- Category filter (`activeCat`: all | start | enc | feat | trouble).
- Ticket category selection; smooth-scroll to ticket form from empty-state CTA (`onGoTicket`).

## Tokens
Marketing-zone radii (8–11px), icon-chips per category color, search input `#13121C` →
focus indigo border.
