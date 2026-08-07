# Reader Fit: scale-comparator @ PRE — 2026-08-06

Item **15B / S12** of the reader-fit supply-side sweep.

Modes audited: size comparison | Probes: eval-test ✓ (K + G4 control) ·
tutor-test Tier 1 ✓ · jsdom render ✓ | Live audio: NOT run (see residuals)

## Verdict

**Overall: READY at PRE.** The comparison — two circles side by side — is
genuinely K-fit. Everything attached to it was a number.

This slice carried the **most complete instance of the prose-grade class found
in the sweep**, and the only one where the prose escaped the generator entirely
and reached the component.

---

## Finding 1 — PROSE CROSSED THE GENERATOR/COMPONENT BOUNDARY. Fix: GENERATOR.

```ts
const gradeLevel = ctx.gradeContext;                     // PROSE
const gradeConfig = getGradeConfig(gradeLevel);          // switch → default
`… activity for ${gradeLevel === 'K' ? 'Kindergarten' : `Grade ${gradeLevel}`} students.`
…
gradeLevel: gradeLevel as 'K' | '1' | '2' | '3' | '4' | '5',   // the lie
```

Probe at `grade=K`, **before** the fix:

```
gradeLevel: "kindergarten students (ages 5-6) - Use clear language, rela…"
showRatios: true      ← catalog: "showRatios should be false for K-1"
```

Four consequences, all live:

1. **`getGradeConfig`'s `switch` never matched**, so every grade received the
   default rung. That is why K shipped `showRatios: true`.
2. **The prompt's audience line rendered garbled** — literally *"…activity for
   Grade kindergarten students (ages 5-6) - Use clear language, relat… students."*
3. **All six per-grade prompt blocks** (`gradeLevel === 'K'` … `=== '5'`) were
   unreachable, so none of the authored grade guidance ever reached Gemini.
4. **The `as` cast pushed prose into `data.gradeLevel`**, a field typed
   `'K'|'1'|…|'5'`. The component's own pre-existing `formatNumber` branch
   (`gradeLevel === 'K' || === '1'`) was therefore dead too — young-reader number
   formatting had never once run.

Point 4 is the one worth remembering: **a type assertion silenced the compiler
at exactly the boundary where the contract was being violated**, and the defect
propagated into a second file where nothing looked wrong. Any band gate I added
to this component would have been dead on arrival.

Fixed: `scaleComparatorGradeFromGrade()` (canonical-first, null when absent)
`??` a real prose resolver; the rung now drives `getGradeConfig`, every prompt
branch, and the emitted field. Both `as` casts deleted — the value is now
genuinely of that type. `audienceProse` is passed to the prompt separately, so
the audience voice is preserved without contaminating structure.

## Finding 2 — SCAFFOLD-GAP (queued). Fix: CATALOG + COMPONENT.

No `tutoring` block, no `useLuminaAI`. Added a catalog block (7 contextKeys,
3 levels, 5 struggles, 2 aiDirectives) + 3 moments: `[SCALE_ORIENT]`,
`[SCALE_OBJECT_ADDED]`, `[SCALE_READ_ALOUD]`.

The scaffold's job here is to supply a **non-numeric comparison register**,
because the whole primitive is about magnitude and a pre-reader has no access to
any of the figures. The directive forbids kilometres, AU and "× bigger" at PRE
and hands the tutor the replacement vocabulary: *"much bigger"*, *"tiny next to
it"*, *"about the same"*. A second directive, `COMPARISON IS THE ANSWER, NOT THE
NUMBER`, applies at **every** grade: never lead with a ratio; turn the question
back to the drawing first.

`commonStruggles` includes the misconception the visualisation itself invites —
that the object drawn bigger is *closer* rather than *larger*.

## Finding 3 — PRIMITIVE-GAP, not in the triage. Fix: COMPONENT.

| Offender at K | Rule |
|---|---|
| `12,742 km` under every object card | 7 |
| `12,742 km` again under every drawn circle | 7 |
| "Select Objects to Compare" + "2 selected" tally | 7 |
| Log-scale checkbox labelled *"Use logarithmic scale (better for huge size differences)"* | 7 |
| Ratio panel: "Earth vs The Moon: 3.7× larger" | 7 — and the catalog forbids it at K-1 |

All gated at K-1, all kept at 3-5. The ratio panel is gated in the **component**
as well as the generator: the catalog rule is unambiguous, and a component
owning its own band contract is the point of the Tier-2 fix layer. Locked by a
test that passes `showRatios: true` at K and asserts the panel still does not
render.

`Reset Zoom` is kept at every band — it is the recovery affordance after a child
pinches the view into nonsense — but rendered as a glyph at K-1.

### A React footgun caught by the test

`[SCALE_OBJECT_ADDED]` first decided add-vs-remove with a flag assigned **inside**
the `setSelectedObjectIds` updater and read immediately after. React runs
functional updaters during render processing, so the flag was still `false` and
the cue never fired. Now decided from the current render's state before the
setter. (`LuminaAIContext`'s cue dedup comment warns about the sibling of this
bug — firing a cue from inside an updater emits it twice.)

---

## Audit A — text census (K rung)

| String | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| title + description | header | load-bearing | 🔊 (`lg`) + `[SCALE_ORIENT]` | COVERED |
| object names | cards + SVG labels | load-bearing | `[SCALE_OBJECT_ADDED]` + ORIENT lists them | COVERED |
| funFact | fact card | load-bearing | 🔊 "Read the fun fact to me" | COVERED |
| "12,742 km" (cards) | selector | chrome | — | REMOVED at K-1 |
| "12,742 km" / "1.00 AU" (SVG) | diagram | chrome | — | REMOVED at K-1 |
| "Select Objects to Compare" / "2 selected" | heading | chrome | — | REMOVED at K-1 |
| "Use logarithmic scale (better for huge size differences)" | toggle | chrome | — | REMOVED at K-1 |
| "3.7× larger" | ratio panel | chrome | — | REMOVED at K-1 |
| "Reset Zoom" | button | chrome | — | glyph at K-1, `aria-label` kept |

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| compare | ✅ `[SCALE_ORIENT]` on mount, lists the objects | ✅ names voiced on add; fun fact via 🔊 | ✅ ORIENT states the task ("see which is bigger"); level 2 asks "which takes up more room?" | ✅ the circles redraw instantly on tap; selection ring on the tapped card | ✅ 5 struggles incl. bigger≠closer + a pre-reader clause |

## Audit C — band contract (PRE)

| Rule | PASS/FAIL | Note |
|---|---|---|
| 1 Audio is the instruction channel | PASS | **was FAIL** — no channel existed |
| 2 Tap = choose | PASS | tapping a card is atomic and always was |
| 3 Pictures are the answer surface | PASS | the circles ARE the comparison |
| 4 One thing to do per screen | PASS | **was borderline** — selector + log toggle + ratios + facts; now selector + drawing |
| 5 Feedback on the touched object | PASS | selection ring + immediate redraw |
| 6 No typing | PASS | none |
| 7 No adult chrome | PASS | **was FAIL** — five categories, listed above |
| 8 Assessment in the mechanics | N/A | exploration primitive; no evaluation hook (same as S11) |

---

## Gates

| Gate | Result |
|---|---|
| Focused tests | `gemini-scale-comparator.reader-fit.test.ts` **13/13** |
| jsdom render test | `ScaleComparator.reader-fit.test.tsx` **13/13** |
| **Revert-bite (both)** | **11/26 fail** with prose passthrough + `isPreReader=false` |
| `tsc --noEmit` (src-scoped) | **803 = baseline, zero new** |
| `typecheck:lumina` | 0 errors |
| Full vitest | **1929/1929** |
| tutor-test Tier 1 | `pass`, 0 findings, 3 tags |

### Runtime A/B

| | pre-fix @ K | post-fix @ K | G4 control |
|---|---|---|---|
| `gradeLevel` | `"kindergarten students (ages 5-6) - Use clear…"` ❌ | **`'K'`** | `'4'` |
| `showRatios` | `true` ❌ | **`false`** | `true` |
| `interactiveWalk` | false | false | **true** |
| objects | 2 | 2 | **5** |

---

## Residuals (open)

- **No Tier-3 live audio run.** Folded into HUMAN-CHECKS #73.
- **No evaluation hook** — same shape as S11 (`solar-system-explorer`); rule 8
  is N/A rather than passing. Two of the eight 15B primitives are pure
  instruments with no measurement path at all. Worth a portfolio decision at
  some point: either they get `/add-eval-modes` or they are explicitly
  exploration-only and the manifest should not route assessment demand to them.
- **0 eval modes.**
- **`instanceId` added to the data interface** so the tutor session can scope.
