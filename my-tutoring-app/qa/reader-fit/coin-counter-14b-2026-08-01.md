# Reader Fit: coin-counter `count-like` @ EMERGING (Grade 1) — 2026-08-01 (14b, --fix)

**Slice:** widen the K enacted-count band+mode fork to Grade 1 — deliberately, contract-first.
**Handoff:** `qa/HANDOFF-reader-fit-14b-coin-counter-g1-2026-08-01.md` · **Demand:**
`MEAS001-07-c` census trace (`qa/topic-traces/g1-identical-coins-2026-08-01.md`).
**Contract:** `docs/contracts/coin-counter.md` — G1 gap → **R11**; edit guard
`qa/primitive-contracts/coin-counter-check-2026-08-01.md` — **COMPATIBLE**.

Modes audited: `count-like` @ G1 (target) + K / `count-mixed` / `identify` regressions |
Probes: eval-test ✓ (real Gemini ×3) · jsdom ✓ (17, +2 non-vacuity) · real-Chrome clicks ✓

---

## The β decision (handoff decision 1) — G1 VARIANT, not K parity

`MEAS001-07-c`'s authored focus is "Skip counting **and summation**", and G1 `count-like` is
β1.5 with live item history. Full K parity (auto-judge when every coin is tagged once) would
ablate the summation half — the child never produces a total — and collapse the item toward
unfailable. Shipped instead, at `gradeBand==='1' && countMode==='like'`:

- **Coins are tappable TAGS.** Each coin must be counted exactly once; a re-tap is the rejected
  double-count (shake on the object, attempt++), same mechanics as K.
- **The number input + Check appear only after every coin is tagged.** The child still TYPES the
  total — the answer act the β1.5 item history was calibrated on is unchanged.
- **`showRunningTotal` reconciled** (the handoff's alignment question): it now also governs the
  G1 enacted display. Easy tier → climbing skip-count readout + value badges (5, 10, 15 — the
  self-check workspace, same philosophy as make-amount's easy tier). Medium/hard → plain ✓ tags,
  no readout — the accumulation happens in the child's head. The census draw's
  `showRunningTotal: false` @ medium now MEANS something instead of being dead. Generator stamped
  values are unchanged (the count fade and the make-amount fade are both easy-only).

**Calibration note (recorded in contract R11):** protocol adds required tagging (double-count
taps now count as attempts); easy tier adds a displayed accumulation. At the census-routed
medium tier the measured construct — mental skip-count summation — is unchanged.

**Standing rulings preserved (decision 2):** `countMode` stamped from `targetEvalMode`, never
derived from `displayedCoins` (non-vacuity probe B proves the guard); `showCoinValues` stays
default-true on like coins (recognition-aid ruling 2026-07-25).

## Audit A — text census (EMERGING)

| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| "How much money is shown here?" | card instruction | load-bearing | ACTIVITY_START/NEXT_ITEM direct the tutor to read it | COVERED |
| "Tap each coin to count it!" | new G1 cue (house style, cf. "Tap a coin to add it") | load-bearing (protocol) | `enactedCountG1Clause` on BOTH challenge-start messages + NEW catalog `GRADE 1 COUNT-LIKE` aiDirective (cap-overriding carrier) | COVERED |
| "Total:" / "cents" | input row | supportive | protocol clause says "type the total" | COVERED |
| "5¢ / nickel" coin labels | coins | task input (skip-count interval; ruling 2026-07-25) | tutor names values at easy/medium tiers | n/a |
| "Yes! The total is 15¢!" | feedback | supportive (SFX + Next carry state) | ANSWER_CORRECT beat | COVERED |
| "Grade 1" / "1/2" / "🔢 Count" badges | chrome | decorative | — | recorded (14d class; G1-tolerable) |

## Audit B — sufficiency contract (`count-like` @ G1)

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| count-like @ G1 | PASS — tap protocol spoken at every challenge start; durable catalog directive for lesson mode | PASS — coins on screen; instruction read | PASS — "tap each coin, then type the total" states the two acts | PASS — badge+SFX on tap, shake on double-count, feedback+beat on Check | PASS — commonStruggles + tier clauses; directive coaches skip-counting aloud without stating the total |

**Residual:** the ORIENT beat's lesson-mode survival uses the proven cap-overriding catalog
aiDirective mechanism (foundation-explorer / knowledge-check precedent) but was **not confirmed
with a Tier-3 live `--lesson` run this session** — queued as the standard behavioral residual,
not a blocker (standalone sendText twin + on-screen cue + EMERGING partial decoding all carry it).

## Audit C — band contract (EMERGING relaxations applied)

| Rule | PASS/FAIL | Note |
|---|---|---|
| 1 audio instruction channel | PASS | short cue + spoken twins (EMERGING allows short text if spoken) |
| 2 tap=choose | PASS | per-coin tap atomic; typed total is a construction → Check legitimately kept |
| 3 pictures as answer surface | PASS | coins are the manipulative; typed total is the G1 summation act |
| 4 one thing per screen | PASS | tag phase → (reveal) → type phase; progressive disclosure |
| 5 feedback on the object | PASS | badge/shake land on the tapped coin |
| 6 no typing | PASS (band) | number entry is band-appropriate at G1; K keeps zero typing |
| 7 no adult chrome | RECORDED | grade/counter/phase badges remain at G1 (K case = #52/14d; stage-mode evidence accumulates) |
| 8 assessment in mechanics | PASS | tagging instrumented (double-counts in attempts); explicit total is the assessed skill |

**Overall: READY @ EMERGING** — the compute-over-inert-coins proxy is dead at the primary
authored consumer; the summation measurement survives.

## Verification (doctrine)

| Gate | Result |
|---|---|
| jsdom `CoinCounter.reader-fit.test.tsx` | **17/17** — G1 suite (6) + K suite (5) + guards (6: G2 control, mixed@G1, mixed@K, unstamped@G1, unstamped@K→typed, typed grading) |
| non-vacuity probe A (G1 band gate disabled) | **4 G1 tests fail** — load-bearing |
| non-vacuity probe B (countMode guard dropped) | **2 guard tests fail** — the mode guard is real |
| full vitest | **1076/1076** (100 files; tree also carries the concurrent 14e slice — co-existence green) |
| `npm run typecheck:lumina` | **0 errors** |
| project-local full tsc | **803 = baseline, 0 new** (all legacy graveyard, 0 in `components/lumina/`) |
| real-Gemini eval-test `count-like` @ G1 medium | **PASS 6/6** — gradeBand "1", all `like`, all single-denomination, G1 pool (incl. quarter), 0 desyncs, generic instructions, `showRunningTotal:false` (census shape) |
| eval-test `count-like` @ K | **PASS 6/6** — unchanged vs Task 3 (K pool, single-denom, 0 desyncs) |
| eval-test `count-mixed` @ G2 | **PASS 6/6** — all stamped `mixed`, 0 desyncs (its `gradeBand:"1"` = known 14c defect, untouched) |
| **real Chrome** (playwright-core, real mouse) | **ALL PASS** — see below |
| `/primitive-contract --check` | **COMPATIBLE** (R1–R10 other-consumer probes all pass) |

### Real-Chrome probe (temp route, created → driven → deleted)

```
A (medium): coins 3 tappable · inputs/Check before: 0/0 · cue present · readout absent
  tap,tap → badges ["✓","✓"] · double-tap → held at 2, no input · tap 3rd → input+Check appear
  type 15 + Check → "Yes! The total is 15¢!" + Next · badge pointer-events none · coin box 44×44
B (easy): readout 0¢ → 10¢ → 30¢ · badges ["10","20","30"] · input appears after tagging
pageErrors: []
```

**Environmental note:** the long-running Next dev server had wedged (core chunks + `/` 404 —
app-wide, predating this slice); restarted, after which the probe ran clean first try. An earlier
false "clicks don't register" symptom was this wedge, not the component.

## Diff discipline (decision 3)

`git diff --stat`: CoinCounter.tsx +141/−~8, test +135, catalog +10 (additive directive),
generator +12/−~2. Non-insertion lines are comments, the Check-gate ternary (mode-gated), and the
two challenge-start strings (append an empty clause outside G1 count-like). K / `count-mixed` /
`identify` behavior byte-identical — proven by the guard tests + eval-tests, per contract check.

## Residuals & routing

- **HUMAN-CHECKS #58** — pixel/feel: 44×44 coin targets at the minimum; ✓/value badges slightly
  overlap neighboring coins when tightly packed; easy-tier readout sits directly above the input
  (copy-ceremony feel is deliberate self-check — confirm it reads as such); G1 chrome badges.
- Tier-3 live `--lesson` ORIENT confirm — queued (standard behavioral residual).
- G4 (single-coin card prints its own total) observed live again this run (K draw c3 = one
  nickel) — still queued to `/oracle-test`, not forced by this widening.
- 14c (G2–3 unreachable in coin-counter's own resolver) — re-check after 14e lands; out of scope.
