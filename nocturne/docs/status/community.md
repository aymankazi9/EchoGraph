## Status

| Sub-feature | Status |
|---|---|
| Room list (all rooms, seeded with 5 UCSD rooms) | Done |
| Anonymous membership (SHA-256(userId:roomId) hash) | Done |
| Join room (email domain check via `join_room()` RPC) | Done |
| Leave room | Done |
| Presence heartbeat (60 s interval, 3 min active window) | Done |
| Active member count display | Done |
| Keyword pool display (from shared deck terms + pool hash lookup) | Done |
| Anonymous keyword pool contribution (`increment_keyword_count()` RPC) | Done |
| Study threads (create thread, list threads with reply count) | Done |
| Thread replies (DB schema + RPC) | In Progress |
| Shared deck display + "Add to vault" import | Done |
| Publish shared deck to community | Needs verification |
| Room discovery + search filter | Done |
| Room stats panel (member count, topics tracked, shared decks) | Done |
| Privacy note display | Done |
| Institution-gated join (email suffix check) | Done |
| `/api/community/join` route | Done |
| `/api/community/deck` route | Done |
| `/api/community/keywords` route | Done |
| `/api/community/threads` route | Done |

## What Exists

- `nocturne/src/app/(app)/community/CommunityClient.tsx` — full Community page: joined rooms panel, active room panel (2-col: keywords + threads left, shared deck + stats + privacy right), discover section with search, presence heartbeat, vault import handler
- `nocturne/src/app/(app)/community/page.tsx` — server component wrapper; passes `userId`
- `nocturne/src/app/api/community/join/route.ts` — POST (join) and DELETE (leave) handlers; calls `join_room()` and `leave_room()` DB RPCs
- `nocturne/src/app/api/community/deck/route.ts` — GET; returns the most recently published shared deck for a room
- `nocturne/src/app/api/community/keywords/route.ts` — POST; calls `increment_keyword_count()` with a pre-hashed term
- `nocturne/src/app/api/community/threads/route.ts` — POST; calls `create_community_thread()` RPC; returns `{ threadId }`
- `nocturne/src/lib/crypto/community-hash.ts` — `hashMemberId(userId, roomId)` and `hashPoolTerm(roomId, term)` using Web Crypto SHA-256
- `nocturne/supabase/migrations/015_create_community.sql` — full community schema: `institution_domains`, `community_rooms`, `room_memberships`, `community_keyword_pool`, `community_threads`, `community_replies`, `shared_decks`, `room_presence`; RPCs: `join_room`, `leave_room`, `heartbeat_presence`, `increment_keyword_count`, `create_community_thread`, `create_community_reply`, `publish_shared_deck`, `get_active_count`

## What's Missing

- **Thread replies have no UI** — `community_threads` shows `reply_count` but clicking a thread does nothing. There is no thread detail view, no way to read replies, and no reply form. `create_community_reply()` RPC and the `community_replies` table exist but are unused by the frontend.
- **Publishing a shared deck has no UI** — `publish_shared_deck()` RPC exists in the DB and `/api/community/deck` serves the latest deck, but CommunityClient has no button or form for a room member to publish a deck from their own vault keywords. The "Shared deck" card only shows how to consume a deck, not create one.
- **Keyword pool contribution is not called automatically** — `/api/community/keywords` exists and `increment_keyword_count()` is implemented, but CommunityClient never calls this route. Keywords from the user's vault are never contributed to the pool; the pool can only grow via external calls.
- **Institution domains are seeded for 5 universities only** — `join_room` validates email suffix against `institution_domains`. Users at unsupported institutions cannot join any room, and there is no UI or API to request a new institution.
- **`zone: null` in vault import** — `handleAddToVault` inserts flashcards with `zone: null`, violating the `flashcards.zone CHECK (zone IN ('red','likely'))` constraint. This will produce a DB error on import.

## Recent Decisions

- 2026-09-22: Midnight tier gate added. `CommunityClient` now accepts `userTier: Tier` prop (fetched by `page.tsx` via `getUserTier`). When `!hasAccess(userTier, 'midnight')`, the component returns a `LockedFeature` panel instead of rendering the community UI.

## Tier

**Midnight** — the entire `/community` page is gated. Dusk and Eclipse users see a `LockedFeature` upsell panel ("Community — available on Midnight").
