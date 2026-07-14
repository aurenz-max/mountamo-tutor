# Reader Fit: addition-subtraction-scene @ PRE — 2026-07-13

Modes audited: act_out (primary), build_equation, solve_story, create_story
Probes: eval-test ✓ · tutor-test --probe ✓ · live (standalone 3× + **lesson 3×**, pre & post) ✓
Band: PRE (catalog claims "ESSENTIAL for Kindergarten"; audited at lowest claimed grade)

This was backlog item #1 (user-observed 2026-07-13: a K lesson where the tutor
said *"Now let's do some butterfly stories"* and stopped — the on-screen story
text is English a pre-reader cannot decode, and it was never read aloud).

## Audit A — text census

| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| `storyText` "There are 2 frogs on the lily pads. 1 more frog hops over…" | LuminaPrompt + generated | **Load-bearing** | Scaffold `aiDirectives` READ-ALOUD beat + component `[ACTIVITY_START]`/`[NEXT_ITEM]` | **COVERED** (after fix) |
| `instruction` "Drag 2 frogs onto the lily pads…" | LuminaPrompt (italic) + taskDescription | **Load-bearing** | Directive ORIENT line `{{instruction}}` (now in bag) | **COVERED** (after fix) |
| "How many {objectType} are there now?" | act-out input row | Load-bearing (question) | Story + instruction read aloud restate it | COVERED |
| "Drag tiles here to build the equation" | build-equation tray | Supportive | — | ok (numbers/symbols, not decode-gated) |
| Scene label, "Kindergarten", operation badge, phase tab labels | chrome | Decorative | — | see Audit C |

Pre-fix: `storyText` and `instruction` were **UNCOVERED** — the scaffold referenced
them (`taskDescription`, `contextKeys`) but nothing READ them aloud, and
`{{instruction}}` resolved to the literal `(not set)`.

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| act_out | **was FAIL → PASS** | **was FAIL → PASS** | n/a (single group counted) | PASS (SoundManager + spoken struggle) | PASS (scaffoldingLevels + commonStruggles, eyes-free) |
| build_equation | PASS | PASS (after fix) | PASS (operator direction in struggles) | PASS | PASS |
| solve_story | PASS | PASS (after fix) | PASS (unknownPosition line) | PASS | PASS |
| create_story | PASS | PASS | — | PASS | — (open-ended; see WRONG-BAND note) |

**ORIENT (was FAIL):** `taskDescription` ended "…they must **{{instruction}}**" →
rendered **"they must (not set)"** because the component's `aiPrimitiveData` bag
omitted `instruction` (it was generator-only). Confirmed on the `tutor-test`
`&probe=1` assembled prompt. HIGH — hard, always-present.

**STIMULUS (was intermittent FAIL):** the read-aloud lived ONLY as a soft trailing
clause in the component `[ACTIVITY_START]` ("…Then read the story aloud"). The
catalog scaffold had **no** read-aloud beat at all. In lesson mode the
`[PRIMITIVE SWITCH]` (lumina_tutor.py:677 "Keep it to one sentence") and the
lesson greeting (:534 "keep it brief") actively cap the tutor — so the soft clause
gets dropped and a non-reader is stranded (the user's session). Live harness:
current code read the story in 6/6 runs (3 standalone + 3 lesson) → the drop is
**intermittent**, not a hard fail, but a non-reader lesson must NEVER drop the
story. Fixed by making read-aloud a mandatory `aiDirectives` beat that explicitly
overrides the one-sentence cap.

## Audit C — band contract (PRE)

| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is the instruction channel | **PASS** (after fix) | — |
| 2 Tap = choose | **FAIL** | act-out = tap objects → type count → Check (multi-step); build/solve keep explicit Check (legit multi-part) |
| 3 Pictures are the answer surface | PASS | emoji objects are the manipulative |
| 4 One thing per screen, ≤5 elements | WARN | phase tabs (4) + counter + story + scene + input + check exceeds 5 in the child's field |
| 5 Feedback on the touched object, instant | PASS | SoundManager + spoken struggle (feedback card is secondary) |
| 6 No typing | **FAIL** | act_out + solve_story use a numeric `<LuminaInput>` — a pre-reader must type the numeral |
| 7 No adult chrome | **FAIL** | `LuminaModeTabs`, `LuminaChallengeCounter`, "Kindergarten"/operation `LuminaBadge`, ten-frame toggle |
| 8 Assessment hides in mechanics | PARTIAL | act-out could count-by-tap instead of quiz-a-number |

## Overall: SCAFFOLD-GAP (primary) — FIXED this loop; PRIMITIVE-GAP + routing findings queued

Findings → fix layer:
- **STIMULUS + ORIENT (SCAFFOLD-GAP, HIGH)** → **FIXED** (Tier 1: catalog `aiDirectives`
  beat + `contextKeys`/`taskDescription`; component `aiPrimitiveData.instruction` +
  strengthened `[ACTIVITY_START]`/`[NEXT_ITEM]` sendText). Verified: tutor-test now
  `pass` (0 findings), lesson-mode live 3/3 read the full story verbatim.
- **Typing input at PRE (PRIMITIVE-GAP, rule 6)** → next slice: band-gate act_out /
  solve_story on `gradeBand==='K'` to a row of tappable number tiles (tap=choose),
  not a keyboard. Queued in BACKLOG.
- **Adult chrome (Audit C rule 7)** → route to the systemic **K-stage presentation
  mode** item (do not fork the design system per-primitive). Evidence recorded.
- **create_story eval mode @ K (WRONG-BAND)** → routing: reverse-reason/story-authoring
  (beta 4.5) is above K by design. The eval-mode band floor / catalog `constraints`
  should stop routing create_story into a K lesson (K should get act_out / solve_story).

## Loop log

| # | Change | Type check | Runtime check | Re-audit |
|---|---|---|---|---|
| baseline | — | — | tutor-test `fail` ({{instruction}}→(not set)); live 6/6 read story but STIMULUS is a soft clause | A✗ B✗(ORIENT+STIMULUS) |
| 1 | catalog `aiDirectives` READ-ALOUD beat + `instruction` in bag/contextKeys/taskDescription; component sendText read-aloud made primary | tsc: 0 new (typecheck:lumina ✓) | tutor-test `pass`, 0 findings; **lesson-mode live 3/3 read full story verbatim**, no leak, no `(not set)` | A✓ B✓ → **READY** on STIMULUS+ORIENT |

Harness asset added: `run_tutor_live.py` now has a bespoke
`addition-subtraction-scene` journey (replays the real `[ACTIVITY_START]`/`[NEXT_ITEM]`),
a `--lesson` flag (drives the actual lesson-mode failing path), and a
`must_include` STIMULUS oracle (`stimulus-not-read` HIGH when load-bearing story
content is not voiced).
