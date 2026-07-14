# Momentum (NEW feature)

- **Design reference:** `reference/source/Momentum.dc.html`
- **Target route:** **NEW** `src/app/(app)/momentum/` — sits inside the app shell (sidebar present)
- **Status:** Net-new. No existing components. Build fresh using the shell + design system.

## Purpose
The personal-progress hub — makes study consistency and mastery visible and tangible. This is the
gamification system's "destination" half (the ambient half lives on the Vault dashboard ribbon).
Everything is computed on-device from the user's own session data.

## Layout (app shell + centered `max-width:1080px` content, page padding `34px 40px 90px`)
1. **Header** — `h1` "Momentum" + **Beta** badge (amber tint) + subtitle "computed on your device";
   right = momentum balance chip (amber, mono).
2. **Streak hero band** (`rounded-3xl` 18px, amber→rose→dark wash, ambient glow): big streak number
   (46px), "day streak", personal best + days-this-week; a **7-day dot strip** (filled =
   amber-gradient 26px chip w/ check + glow, missed = dashed); a **next-milestone** progress bar.
   Flame icon breathes (`scale 1↔1.04`, 2.4s).
3. **Row (grid `1.55fr 1fr`)**:
   - **Study activity heatmap** — 17 weeks × 7 days, GitHub-style. 5-level indigo scale
     (`#13121C → #818CF8`), day/month axis labels (mono `#3F485C`), cells `14px` `rounded-xs` 3px,
     hover `scale(1.28) brightness(1.3)`, tooltips. In code: bucket real session timestamps by day.
   - **Momentum wallet** (amber-tint card) — balance (34px mono), "earned this week +N", and a
     **Redeem** list. **Redeem buys real utility, never cosmetics**: Priority transcription (400),
     9B ASR boost (650), 1 week of Pro (1000). Disabled when unaffordable. Clicking spends balance.
4. **Mastery by subject** — per-course **conic-gradient ring** (`#6366F1` fill, `#16151F` track,
   inner disc = card bg, mono % center) + label + "N / M keywords" + progress bar + status tag
   (Exam-ready ≥80 teal / On track ≥55 indigo / Needs work amber). Data = share of each course's
   Red Zone keywords drilled to recall.
5. **Row (grid `1fr 1fr`)**:
   - **Milestones** — earned (tinted, check) vs locked (progress count). e.g. Two-week warrior,
     First subject mastered, 25 lectures captured, 500 cards drilled, Course conqueror.
   - **Course circle** (opt-in, indigo wash) — toggle (persisted `localStorage['nocturne-cohort']`).
     When on: classmate avatars, "14 classmates reviewing for Midterm 2", a shared exam-prediction
     deck card, **"Open the full course room →"** link to `/community`, and a privacy note. When
     off: a join prompt. This module **links into Community** — see `pages/10-community.md`.

## Data sources (wire in code)
Streak + heatmap = session activity by day; mastery rings = `keyword-scorer` recall over Red Zone;
milestones = thresholds on those metrics; momentum balance = earned from consistency (define an
accrual rule — e.g. +N per study day / per mastered keyword), spent on the redeem items.

## Tokens
App-zone radii (cards 16 / hero 18), amber momentum, teal success, indigo accent, conic-gradient
rings, heatmap scale above. State persisted: `nocturne-nav-collapsed`, `nocturne-cohort`.
