# Creator dashboard — spec

## Problem
The old creator home showed four static numbers and two short lists. Creators had to visit four
pages to answer "what should I do next, what's running, what's pending, what have I earned?".

## Goal
One mobile-first screen where each stat card is also a filter for the list below it. Tapping a card
answers its question in place, without leaving the page.

## Filters (stat cards)
| Card | Count shows | List shows | Chips |
|---|---|---|---|
| **Needs you** (default) | offers awaiting acceptance + deliverables to submit or fix | offers and to-dos, soonest due first | All · Offers · Due soon · Changes requested |
| **In progress** | active collaborations | each collaboration with deliverable progress and earned so far | All · Awaiting review · On track |
| **Applications** | open applications | every application with status and next step | All · Shortlisted · Submitted · Closed |
| **Earnings** | lifetime paid | ledger history (paid, approved, held) | All · Paid · On its way · Held |

- Exactly one card is selected (WAI-ARIA tabs: `tablist` / `tab` / `tabpanel`, arrow-key navigation).
- Selection and chip are mirrored to the URL (`?view=…&chip=…`) with `history.replaceState`, so a
  refresh or shared link keeps the view; filtering itself is instant on the client.
- Selected state changes colour and surface only (dark card, lime accent), never size, so nothing shifts.

## Supporting modules
- **Continue card** — the most urgent active collaboration with deliverable progress and a round
  "open" button.
- **For you** — up to three open campaigns in the creator's niche they haven't applied to. Tapping one
  opens a bottom sheet (Vaul) with the brief, payout formula and an earnings estimate, then
  "View & apply".
- **Profile strength** — progress ring and a lime "Complete profile" action when under 100%.
- **Search pill** — submits to Discover campaigns.

## Visual language ("warm glass", creator workspace only)
- Canvas: soft pastel gradient `from-green-100 via-amber-50 to-blue-100`.
- Surfaces: glass cards `backdrop-blur-md bg-white/50 border border-white/60 shadow-sm rounded-3xl`.
- Accent: lime (`#e3f25c`) for the single most important action; ink-black pills for primary CTAs;
  white round icon buttons.
- Type: Plus Jakarta Sans (bundled locally via Fontsource) for the creator workspace. Brand and ops
  workspaces keep the crisper SaaS styling.
- Motion: list items fade up on filter change; cards lift on hover; respects reduced motion.

## Tech
- Server component loads one read model (`creatorDashboard`) — no client fetching, dates serialised.
- Client component owns filter state. Drawer: `vaul` (built on Radix Dialog: focus trap, Esc, swipe).
- No new data writes; every action links into existing flows.
