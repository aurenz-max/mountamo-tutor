# Handoff — Direct-Manipulation Fixes (K math) — 2026-07-16

**Execution** handoff. The census is already DONE — do NOT re-audit. The item-11
session's "sibling audit" (Explore sweep of ~60 `visual-primitives/math/` primitives)
found the proxies below with `file:line` evidence; it lives under the
**"Direct-manipulation-first for K 'act out / build' scenes"** systemic note in
`qa/reader-fit/BACKLOG.md`. This handoff turns those findings into fixes.
**Start with ten-frame (item 12).**

## Reference exemplar (calibrate on this first)
`addition-subtraction-scene.act_out` (BACKLOG item 11, DONE 2026-07-16) is the gold
standard: **seed the scene → child taps to add/remove objects → auto-judge on the
enacted count**, forked by band+mode so other modes/grades are untouched. Read:
- `primitives/visual-primitives/math/AdditionSubtractionScene.tsx` (act_out K branch)
- `docs/contracts/addition-subtraction-scene.md`
- `qa/reader-fit/addition-subtraction-scene-item11-2026-07-16.md`

## House rules
- **Contract-first (CLAUDE.md):** each primitive here serves multiple modes/grades.
  Derive `docs/contracts/<id>.md` via `/primitive-contract` BEFORE editing, then
  **fork by mode + band** — change ONLY the K branch of the named mode; subitize /
  count_all / other eval modes / reader grades are live requirements you must not
  ablate. If the fix conflicts with an existing requirement, fork, don't edit over it.
- **Verification doctrine:** done only after the flow is exercised at RUNTIME (jsdom
  behavioral test that the enacted state drives the judged answer, `/eval-test` @ K,
  live `--lesson` where a journey is feasible). tsc is necessary, not sufficient:
  `./node_modules/.bin/tsc --noEmit` 0-new + `npm run typecheck:lumina` 0.
- **Hot tree:** several reader-fit sessions are live; the cited line numbers may have
  drifted — re-read the file and locate by symbol, not line. Re-read BACKLOG/WORKSTREAMS
  before editing; commit each primitive + its BACKLOG strike in a tight slice.
- Reuse item-11's seed→tap→auto-judge template rather than inventing a new pattern.

---

## Task 1 — ten-frame `make_ten` @ K (item 12) — STRONG proxy, DO THIS FIRST

**Paste this:**

> Work reader-fit BACKLOG item **12** (ten-frame `make_ten` @ K direct manipulation).
> Per the sibling audit: `TenFrame.tsx` renders a make-ten stepper (`counterCount + ___ =
> totalCells`, +/- over `makeTenInput` ~lines 923–947) judged in `checkMakeTenAnswer` (~:461)
> **from the stepper, not the frame** — even though the K frame is seeded with `counterCount`
> counters and shows empty cells the child can physically tap (`handleCellClick` ~:308 blocks
> taps only during the subitize answer phase). Make-ten (K.OA.4) should be ENACTED: the child
> places counters into the empty cells and the answer is auto-judged on the filled count.
>
> **Fix (fork by mode+band, item-11 template):** at K `make_ten`, make the empty cells
> tap-to-fill the answer surface, auto-judge on the resulting filled count, and remove the
> stepper + Check button at K. Keep `subitize` UNCHANGED (it flashes-then-hides counters, so a
> number answer is correct there — NOT a proxy), keep `count_all` unchanged, and keep Grade-1+
> make-ten UI unchanged (scope this to the K band only).
>
> Contract-first: derive `docs/contracts/ten-frame.md` first (subitize / count_all / make_ten +
> reader-grade behaviors are live requirements — fork, don't ablate). Verify: tsc 0-new +
> `typecheck:lumina` 0; jsdom behavioral test (tapping cells drives the judged make-ten answer at
> K; stepper/Check gone at K; subitize + count_all + a Grade-1 control all unchanged); `/eval-test`
> @ K make_ten; live `--lesson` if a bespoke ten-frame journey is feasible (else flag "needs a
> browser check on tap-to-fill make-ten"). Pixel → HUMAN-CHECKS. Close item 12 + WORKSTREAMS in
> the same slice.

---

## Task 2 — counting-board `subitize` @ K (item 13) — DISPLAY fix, NOT a manipulation swap

**Paste this:**

> Work reader-fit BACKLOG item **13** (counting-board `subitize` @ K). Per the sibling audit:
> `CountingBoard.tsx` renders a subitize stepper (~:1120–1144, judged ~:547) over objects that
> **stay visible and are tap-countable**. That's flagged as a proxy — but the deeper problem is
> that genuine subitizing REQUIRES the objects flash-then-hide (instant recognition, not counting).
> So this is a **display fix, not a direct-manipulation swap**: make the K subitize phase
> flash-then-hide the objects (mirror `ten-frame`'s own subitize behavior), after which the
> number answer is legitimate. Do NOT convert it to tap-counting — that would turn subitizing into
> counting (wrong skill).
>
> Fork by mode+band: change ONLY K `subitize`; leave `count_all` (already good — tap-count,
> answer = `countedObjects.size`) and everything else untouched. The `count-on` phase is a
> **Grade-1** challenge type — out of K scope; note it for the EMERGING re-audit, don't fix here.
> Contract-first (`docs/contracts/counting-board.md`). Verify: tsc + `typecheck:lumina`; jsdom
> (K subitize objects hide before the answer; count_all unchanged); `/eval-test` @ K. Close item 13
> + WORKSTREAMS in the same slice.

---

## Task 3 — coin-counter `count-like` @ K — CONFIRM/CLEAR (census gap, likely not a fix)

**Paste this:**

> Close the one census gap: `coin-counter` was not swept. Its K modes (catalog `math.ts` constraints
> "K-1: identify coins and count like coins only") are `identify` (naming = LEGIT-ABSTRACTION, not a
> proxy) and `count-like`. Read `CoinCounter.tsx`'s K `count-like` interaction: if the child taps/
> counts the displayed coins to reach the total (enacted) it's ENACTS → record CLEARED; if it
> collects the total via a stepper/number-pad over a manipulable coin set, it's a PROXY → promote a
> new BACKLOG item with the item-11 fix-direction. The money modes (make-amount / make-change /
> compare) are Grade 2-3 — OUT-OF-BAND, ignore. Record the verdict under the systemic note. No source
> edit unless count-like is a confirmed proxy.

---

### Sequencing
**Task 1 (ten-frame)** → **Task 2 (counting-board display fix)** → **Task 3 (coin-counter confirm)**.
Ten-frame is the one STRONG direct-manipulation proxy and the closest match to item 11's template —
do it first, and the pattern carries to any proxy Task 3 might surface.
