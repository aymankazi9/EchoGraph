# Legal (Privacy / Terms / Cookies / Security)

- **Design reference:** `reference/source/Legal.dc.html`
- **Target routes:** `src/app/(marketing)/privacy/`, `/terms/`, `/cookies/`, `/security/`
- **Status:** Routes exist; this one mock is a **template for all legal/doc pages** — implement
  once as a shared layout, feed each route its document content.

## Purpose
Render long-form legal/policy documents in a calm, readable, navigable layout. The actual
copy in the mock (privacy policy, cookie table, etc.) is real and usable.

## Layout
- **Top header:** wordmark + "/ Legal" breadcrumb; right nav (Home, Security, "Get started"
  primary). `[data-topnav-extra]` links hide < 940px.
- **Two-column body** (collapses < 940px; mobile gets a `[data-mobswitch]` document picker):
  - **Left sidebar nav** — list of documents (`docs[]`: Privacy, Terms, Cookies, Security).
    Active item: indigo tint bg (`rgba(99,102,241,0.12)`) + border + dot. `rounded-md` 8px.
  - **Right document body** (`max-width:768px`, padding `46px 44px 84px`) — `[data-docbody]`
    fades/slides in on switch (`noct-docin`). Eyebrow tag, `h1` (clamp 28→37px), subtitle,
    meta row (last-updated etc.) with bottom hairline, then sectioned prose.

## Behavior
- Client-side doc switching (`switchDoc(id)`), scroll resets to top on switch.
- **Scroll-spy** (`IntersectionObserver`) highlights the active section in a TOC.
- A TOC (`toc[]`) of section anchors per document.

## Content model
Each document = `{ id, label, tag, subtitle, sections[] }`; sections built from helpers
`S()` (subheading), `T()` (paragraph), `L()` (labeled list item — e.g. the cookie table). Port
this content into MDX or structured data per route.

## Tokens
Doc-zone radii (8px), reading `max-width` 768px, body text 16px/1.62, section hairlines
`#191827`.
