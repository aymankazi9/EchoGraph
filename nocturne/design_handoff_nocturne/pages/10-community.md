# Community (NEW feature)

- **Design reference:** `reference/source/Community.dc.html`
- **Target route:** **NEW** `src/app/(app)/community/` — inside the app shell (sidebar present)
- **Status:** Net-new. Build fresh. **Material-first, NOT a social network / people directory.**

## Purpose & principle
Discovery scoped to **course rooms**, not people. The unit of connection is the *material* (pooled
exam-prediction keywords, shared decks), never browsable profiles. Privacy-preserving by design:
anonymous handles, only keyword *counts* are pooled — transcripts/vault never leave the device.
Verify membership via the user's `.edu` email domain (already collected at signup).

## Layout (app shell + centered `max-width:1080px`, padding `34px 40px 90px`)
1. **Header** — `h1` "Community" + **Beta** badge; subtitle "Join your course, not a network.";
   right = **school picker** button (e.g. "UC San Diego · change").
2. **Your course rooms** — 3-col grid of joined-room cards (`activeRoom` state). Each: course code
   badge (mono), name, "N in room", "New deck" indicator. Selected card = indigo tint + border.
3. **Active room panel** (`rounded-3xl` 18px) with a header (course monogram, name, code · school ·
   "N classmates this term", a live "active now" pill (teal, `noct-livedot`), Leave button) and a
   **2-column body split by a hairline**:
   - **Left:** "What the class is flagging" — ranked **pooled Red Zone keywords** (rank, term,
     count `N / members`, bar — top 2 rose, rest indigo, check if also in *your* vault). Below:
     **Study threads** (title, "N studying · M notes", last-active). Anonymous.
   - **Right:** **shared exam-prediction deck** card (rose-tinted, "Add deck to my vault"),
     "This week in the room" stats, and a privacy reassurance box (indigo, lock icon):
     "You're anonymous here… classmates only see pooled keyword counts."
4. **Find more course rooms** — search input (course code/name) + discover list with **Join**
   buttons (joins → moves room into "your rooms", sets active). Empty state when no match.

## Behavior / state
`activeRoom`, `joined[]`, `query`. Selecting a joined card swaps the active panel; Join adds to
`joined`. `nocturne-nav-collapsed` persisted as elsewhere.

## Data model (wire in code)
Room = `{ code, name, members, online, pooledFrom, exam, deckCount, keywords[], threads[],
activity[] }`. Keyword pooling must be server-side aggregation of *counts only* — never raw
content. This is the one feature with a real backend + safety surface: needs room verification
(.edu domain), thread moderation (report/mute), and anonymized aggregation. Flag these as
pre-launch requirements; the mock shows representative data.

## Tokens
App-zone radii (cards 12–18), indigo accent, rose Red Zone keywords, teal live/online,
two-column hairline split (`#16151F`).
