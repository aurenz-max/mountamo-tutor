# Reader-Fit item 13 — counting-board `subitize` @ K flash-then-hide DISPLAY fork (2026-07-20)

**Executor:** `/reader-fit --fix counting-board` · **Handoff:** `qa/HANDOFF-direct-manipulation-fixes-2026-07-16.md` Task 2 · **Contract:** `docs/contracts/counting-board.md` (derived this run, R4)

## The defect (from the 2026-07-16 sibling audit)

K `subitize` presented a "How many do you see?" numeric stepper over objects that
stayed **fully visible** the whole time — and the objects were even tap-countable
(the same board the sibling `count_all` mode taps). That defeats the skill:
genuine subitizing is *instant recognition*, not counting a static scene. The
generator prompt even described subitize as "Objects are always visible"
(`gemini-counting-board.ts:70`).

## The fix — a DISPLAY fork by band + mode (NOT a manipulation swap)

At `gradeBand==='K'` **and** `type==='subitize'` (`isKSubitize`) the objects now
**flash then hide** before the numeric answer, mirroring ten-frame's subitize
(contract R4, item 12 precedent). The number answer stays the task identity — this
is explicitly *not* converted to tap-counting (that would be the sibling
`count_all` skill).

Lifecycle (`CountingBoard.tsx`):
- `isSubitizeFlashing` — objects are rendered **only** while this is true.
- `subitizeAnswerReady` — the stepper + Check enable **only** after the flash completes.
- Auto-start: on entering a K subitize challenge, a brief prep beat (`SUBITIZE_PREP_MS`
  800ms, "👀 Get ready to look…") → flash (`flashDuration || SUBITIZE_FLASH_MS`
  1500ms, "Look quick!") → hide → stepper.
- `handleObjectTap` early-returns for `isKSubitize` — hidden objects can't be tapped,
  and the brief flash can't be tap-counted either (closes the mechanism, not just the symptom).
- Check is disabled while `isKSubitize && !subitizeAnswerReady`.
- A subtle **"Show again"** re-flashes (`startSubitizeFlash`).
- Flash state is re-armed on retry and on advance so each K subitize challenge re-flashes;
  the flash timeout is cleared on unmount.

### Scope guard (what did NOT change)
- **`count_all` @ K** — untouched: objects stay visible, tap-to-count, answer = counted set.
- **`subitize` @ Grade 1** (and all reader grades) — untouched: objects visible, stepper live immediately.
- **`subitize_perceptual` (Pre-K)** — untouched (its own hand-image answer; flash is noted as gap G2, not done here).
- **`count_on` @ Grade 1** — same class of defect but one band up; deferred to the EMERGING re-audit (contract G1). Not touched.
- **No generator / schema / catalog change.** `flashDuration?` was added to the challenge type
  as an optional component-side field (defaults to the constant); the generator does not emit it.

## Verification (doctrine)

- **tsc:** 0 new errors in touched files (`./node_modules/.bin/tsc --noEmit` — the only remaining
  errors are the pre-existing legacy `src/lib/WebSocketService.ts` graveyard). **`typecheck:lumina` 0.**
- **jsdom behavioral suite** `CountingBoard.reader-fit.test.tsx` — **3/3**:
  1. K subitize: objects absent pre-flash → appear during flash (4) → tap during flash creates
     no count badge (guard) → hide (0) + stepper "How many … do you see?" + Check enabled.
  2. K `count_all` control: objects visible immediately, three taps stamp three count badges, Check → Next.
  3. Grade-1 subitize control: objects visible + stepper live immediately (no flash gate).
- **Full vitest suite:** 844/844.
- **eval-test @ K** (`subitize`, "Subitizing to 5"): **PASS** — 7 subitize challenges, every
  `targetAnswer === count`, counts 2–5 (K perceptual band; topic "to 5" ceiling honored), no
  answer leak. Content is unchanged by the display fork, as expected. Recorded in
  `qa/eval-reports/counting-board-2026-03-15.md` (2026-07-20 note).

## Residual → HUMAN-CHECKS #34

Pixel/feel of the flash timing (does ~1.5s feel right for a 2–5 object board), the
"👀 Get ready / Look quick!" copy, and the "Show again" affordance — plus a real-click
confirm that count_all @ K and subitize @ Grade 1 are visibly unchanged. jsdom proves the
lifecycle; the felt timing is a human call.
