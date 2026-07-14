# Reading the Design Reference Files (`.dc.html`)

The files in `reference/source/` are **HTML design references** — prototypes that show the
intended look and behavior. They are **not production code to copy**. Recreate them in the
Next.js/React/Tailwind/shadcn codebase using its patterns. This primer explains the format so you
can read intent accurately (this is what tripped up the earlier attempt — the *bundled* exports
were unreadable; these clean source files are not).

## File shape
Each file is `<x-dc>…</x-dc>` (a template) followed by a
`<script type="text/x-dc" data-dc-script>` containing `class Component extends DCLogic { … }`
(the logic). A small runtime (`support.js`) renders it. You are **reimplementing**, so treat:
- the **template** as the JSX structure + inline styles (exact colors, spacing, radii), and
- the **logic class** as the component's state, derived values, and handlers.

## Template syntax → React equivalent
| In the `.dc.html` | Means | Your React |
|---|---|---|
| `{{ name }}` | a value from `renderVals()` | `{name}` |
| `style="color:#E2E8F0; padding:12px"` | literal inline style (ground-truth values) | Tailwind class or `style={{…}}` |
| `style="{{ someStyle }}"` | a style object built in the logic | compute + apply |
| `<sc-for list="{{ items }}" as="it">…{{ it.x }}…</sc-for>` | list render | `items.map(it => …)` |
| `<sc-if value="{{ cond }}">…</sc-if>` | conditional | `{cond && (…)}` |
| `onClick="{{ handler }}"` | event handler from logic | `onClick={handler}` |
| `<dc-import name="Card" …>` | embeds sibling `Card.dc.html` | a child component |
| `<helmet>…</helmet>` | head content (fonts, `@keyframes`) | already in `globals.css` / layout |
| `data-screen-label`, `data-*` hooks | labels / CSS-animation hooks | port the `data-*` the CSS in `globals.css` expects |

## Logic class → React
- `state = {…}` → `useState` / store.
- `renderVals()` returns the values/handlers the template binds — these are your derived props,
  `useMemo`s, and callbacks.
- `componentDidMount`, `setState`, refs map 1:1 to React.
- Plain JS only; no TS, no imports. The data arrays inside (e.g. session list, FAQ content,
  room data) are **real sample content** you can reuse for fixtures.

## How to extract exact values
Open the relevant `.dc.html`, find the element, read its inline `style`. Colors and px are
literal and authoritative. Cross-check against `DESIGN_SYSTEM.md` and snap to the nearest token —
**but if a mock value and a token disagree, the mock wins** (that's the point of ground truth).

## Tip
If you want to *see* a page rendered, open its `.dc.html` directly in a browser — it's
self-contained except for Google Fonts + `support.js` (included alongside). Screenshots can be
added to this bundle on request.
