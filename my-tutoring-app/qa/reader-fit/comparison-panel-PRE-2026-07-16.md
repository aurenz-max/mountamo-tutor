# Reader Fit: comparison-panel @ PRE — 2026-07-16

Modes audited: (single graded flow — boolean comprehension gate) | Probes: eval-test ✓ tutor-test --probe ✓ | live --lesson ✗ (residual)

Source: BACKLOG item **9c** (explainer-tail bespoke). The graded gate is boolean
(`gates[].correctAnswer: boolean`, two hardcoded True/False text buttons + Submit) —
NOT the MCQ helper's shape. Prose walls: `points[]` / `synthesis.*` paragraphs.

## Audit A — text census (pre-fix)
| String | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| "Comparative Analysis" / "Side-by-Side Comparison" | header chrome | Decorative | — | FAIL (chrome in field) |
| "Option A" / "Option B" | card badges | Decorative | — | FAIL |
| "VS" | badge | Decorative | — | FAIL |
| "Comprehension Check N of M" / "Answer correctly to continue" | gate header | Decorative | — | FAIL |
| gate `question` (T/F statement) | gate | Load-bearing | none (silent [GATE_OPENED] only) | UNCOVERED |
| True / False text buttons + Submit | gate | Load-bearing | — | FAIL (two-tap, text, no picture) |
| card `description` / `points[]` | cards | Load-bearing | [ITEM_EXPLORED] silent walkthrough | partial |
| synthesis prose (`mainInsight`/differences/similarities/whenToUse/misconception) | synthesis | Load-bearing | [SYNTHESIS_UNLOCKED] | prose wall on screen |

## Audit B — sufficiency contract (pre-fix)
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| gate | ✗ (no spoken "tap each picture") | ✗ (statement not read at K; cap drops soft clause) | n/a | text card | text "Try Again" |

## Audit C — band contract (pre-fix)
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 audio is the channel | FAIL | statement/instructions on-screen only |
| 2 tap = choose | FAIL | select-then-Submit gate |
| 3 pictures are the answer surface | FAIL | True/False **text** buttons |
| 5 feedback on the object | FAIL | transient text feedback card |
| 7 no adult chrome | FAIL | Option A/B, VS, "Comprehension Check N of M", synthesis labels |

**Overall (pre-fix): PRIMITIVE-GAP + SCAFFOLD-GAP.**

## Fix — the four layers (one loop)

- **GENERATOR (ctx-native refactor + PRE constraints).** `generateComparisonPanel`
  now takes the typed `GenerationContext` (was positional `(topic, gradeContext,
  config)`); a local `resolvePreReaderGradeKey(ctx)` resolves the band from the
  canonical `ctx.grade` and **stamps `data.gradeLevel`** ('K' | '1'..'12'). At K a
  PRE-READER block constrains the prompt: title 2-4w, intro ≤12w, item names 1-3w
  concrete/picturable, exactly 2 short concrete `points`, and each gate a ONE-line
  concrete TRUE/FALSE statement ≤12w that a child can judge by LOOKING at the two
  pictures, answer not leaked. Also folds in `buildScopePromptSection` + `buildGradeLine`.
- **REGISTRATION** (`coreGenerators.ts`): `generateComparisonPanel(ctx)` (was unpacked args).
- **COMPONENT** (`ComparisonPanel.tsx`): `preReader = isPreReaderGrade(data.gradeLevel)`
  band-gate. At K the boolean gate renders as a **picture true/false** via the shared
  `PreReaderSelfCheck` (a boolean gate is a 2-option self-check): options 👍/👎
  emoji-primary, **tap = choose (no Submit)**, the tutor auto-reads the statement on
  first view + from a 🔊 button, a wrong tap eliminates that tile + fires an
  eyes-free `[GATE_RETRY]` hint (never the answer). Card exploration stays tap-based
  and reads each card aloud on flip (`[ITEM_READ_ALOUD]`, silent background trigger).
  Chrome hidden at K: header, Option A/B badges, VS badge, "Comprehension Check N of
  M" + Submit, intro/exploration-prompt text, and the whole prose **synthesis** block
  (the tutor speaks it via `[SYNTHESIS_UNLOCKED]`); completion is a wordless 🎉. The
  PRE gate walks EVERY gate (a new branch — reader-mode reveal logic untouched).
- **CATALOG** (`core.ts`): new **PRE-READER READ-ALOUD (kindergarten)** `aiDirective`
  on the comparison-panel tutoring block — `[COMPARE_START]` (ORIENT: "tap each
  picture"), `[ITEM_READ_ALOUD]` (read the tapped card), `[GATE_READ_ALOUD]` (read the
  T/F statement, then "tap 👍 if right / 👎 if wrong", answer-free, **overrides the
  one-sentence cap**), `[GATE_RETRY]` (eyes-free hint pointing back to the pictures).
- **`{{#if}}` handlebars check:** none present in the comparison-panel scaffold. Clean.

## Verification
- **tsc**: `typecheck:lumina` **0 errors**; full `tsc --noEmit` shows zero NEW errors
  vs baseline (pre-existing `WebSocketService.ts` / `practice/primitives/types.ts` /
  `LuminaAIContext.tsx` errors untouched).
- **jsdom**: `ComparisonPanel.reader-fit.test.tsx` **6/6** — chrome hidden at K; 👍/👎
  picture gate after both cards explored; statement auto-read once on view + 🔊 replay;
  tap=choose walks both gates → 🎉 + one evaluation submit; wrong tap → eyes-free hint,
  no answer reveal; reader-grade control keeps the text T/F gate + chrome, never auto-reads.
- **eval-test @ K** (topic "Cats vs Dogs"): `gradeLevel:'K'`; intro 8w; items "The
  Cat"/"The Dog" with 2 short points each; gates "A cat makes a woof sound." (6w,
  false) and "Cats and dogs both have soft fur." (7w, true) — concrete, picturable,
  ≤12w, no answer leak.
- **tutor-test --probe @ K**: audit **PASS, 0 findings**; PRE-READER directive +
  `[COMPARE_START]`/`[GATE_READ_ALOUD]` present in the prompt injection; **0 `(not
  set)`**, no `{{#if}}`.

**Overall: READY @ PRE (pending live).** The read-aloud mechanism is the proven
cap-overriding catalog `aiDirective` carrier (foundation-explorer / fact-file /
knowledge-check). Residual: Tier-3 live `--lesson` behavioral confirmation (needs a
bespoke `build_comparison_panel_journey` in `run_tutor_live.py` + the backend) — flag
as **browser/live check** → HUMAN-CHECKS. Pixel look of the 👍/👎 gate → HUMAN-CHECKS.
