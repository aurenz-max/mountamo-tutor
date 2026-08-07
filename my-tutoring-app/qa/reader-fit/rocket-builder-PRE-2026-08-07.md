# Reader Fit: rocket-builder @ PRE — 2026-08-07

Modes audited: n/a (0 eval modes) | Probes: eval-test ✓ (K, G1 ×3, G3 control) · tutor-test Tier 1 ✓ · tutor-test --probe ✓

**Queue:** supply-side sweep item **S3** (`BACKLOG.md` item 15A), taken under the
ruling that overturned 15A's band-floor theory ([[feedback_make-age-friendly-not-band-floor]]).

**Overall: SCAFFOLD-GAP + PRIMITIVE-GAP at PRE — FIXED, no floor.**

---

## What made this slice different from S2

**Rule 2 already passed.** This is the first primitive in the sweep whose
interaction protocol needed no surgery: tapping a part button already adds it to
the rocket. The K-fit core act — *tap a part, watch it appear, press launch,
watch what happens* — was intact and is exactly the catalog's K rung ("rockets
have parts"). Everything that failed was the screen around it, plus the voice.

**And the generator's happy path was clean at BOTH K and G1.** Probed live before
any change, `grade=K` returned `gradeLevel:'K'` with the correct 3-part rung, and
`grade=1` returned `'1'`. **This is where S2's headline defect did not
reproduce** — so if this slice had been judged by a happy-path probe alone it
would have been declared clean.

---

## Audit A — text census (real K draw)

`data.gradeLevel` was read in **exactly one place in the entire 1,205-line
component**: to render a literal `GRADE K` badge at the child.

| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| "500 kg • 50 kN thrust • 400 kg fuel" | under **every** part card | **Load-bearing** (the only basis for choosing a part) | none | **UNCOVERED** |
| "Small Capsule" / "Small Fuel Tank" / "Small Engine" | part cards | **Load-bearing** (which part is which) | none | **UNCOVERED** |
| "Reach 15 km altitude" | Mission Objective | **Load-bearing** (the goal) | none | **UNCOVERED** |
| "💡 Need a hint?" → "Every rocket needs an engine!" | collapsed disclosure | **Load-bearing** (the task, behind a toggle) | none | **UNCOVERED** |
| "Not enough thrust! … (TWR: 0.85)" | failure banner | **Load-bearing** (the correction) | none | **UNCOVERED** |
| "Reached 12.3 km but target is 15 km." | failure banner | Load-bearing | none | UNCOVERED |
| "Total Mass 800 kg", "Total Thrust 50 kN" | stats panel (**unconditional**) | Chrome | none | UNCOVERED |
| "+ Add Stage", "1/1 stages" | staging control | Chrome | none | UNCOVERED |
| "GRADE K" | header badge | Decorative dev readout | none | UNCOVERED |
| "Flight Profile" chart w/ axes, "Staging Events", "Attempt #3" | results panel | Chrome | none | UNCOVERED |
| "Learning Focus: Students will discover that…" | footer | Teacher-facing prose, shown to the child | none | UNCOVERED |

**Audit A: FAIL.**

## Audit B — sufficiency contract

```
GET /api/lumina/tutor-test?componentId=rocket-builder
→ HTTP 400 {"status":"no-scaffold", …}
```
plus `grep -c "useLuminaAI\|sendText(" RocketBuilder.tsx` → **0**.
**Both channels absent**, so the tutor received *"No specific scaffolding
instructions for this primitive type."*

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| (all — no eval modes declared) | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL** |

## Audit C — band contract

| Rule | Pre-fix | Offender | Post-fix |
|---|---|---|---|
| 1. Audio is the instruction channel | **FAIL** | no channel exists | **PASS** |
| 2. Tap = choose | **PASS** | — (already correct) | **PASS** (untouched) |
| 3. Pictures are the answer surface | **FAIL** | part cards are name + kg/kN spec line | **PASS** (emoji-primary) |
| 4. ≤ ~5 interactive elements | **FAIL** | 3 parts + hint + Add Stage + Launch + Reset = 7 (9 at G1) | PARTIAL — see residual |
| 5. Feedback on the touched object | PARTIAL | 🎉/💥 banner, but with km prose | **PASS** (+ spoken beat) |
| 6. No typing | PASS | — | PASS |
| 7. No adult chrome | **FAIL** | 13 distinct classes (see census) | **PASS** (absent from DOM) |
| 8. Assessment hides in the mechanics | PASS | launch outcome is the measurement | PASS |

---

## The defects fixed

### 1. Prose grade — on the DEGRADE path only (the solar-system-explorer shape)

`gradeLevel = ctx.gradeContext` (`:181`). The happy path survived because the
prose reaches Gemini through the prompt and steers it well. But
`getDefaultComponents(prose)`, `getDefaultHints(prose)` and
`getDefaultLearningFocus(prose)` all miss their maps and fall through to the
**Grade 3** rung — and those fire exactly when Gemini omitted a field, i.e. when
the lesson is already degraded and the child can least afford it.

**No happy-path probe can reach this.** It is guarded by tests that drive the
real generator with Gemini stubbed to return a reply missing those fields.

Fixed canonical-first: exported `rocketBuilderGradeFromGrade()` `??`
`rocketBuilderGradeFromProse()` (legacy, kept). Prose stays as `audienceProse`.
**No floor.**

### 2. The resolved rung was never stamped onto the output

Same as S2 — the component band-gates on `data.gradeLevel`, and the generator
returned Gemini's echo. Now overwritten by the resolved rung.

### 3. The budget rung never armed — and an honest correction

`['3','4','5'].includes(gradeLevel)` against PROSE was never true at **any**
grade, so the grade-3+ cost constraint silently never armed on the degrade path.

**Correction worth recording:** I initially framed the ordinal rewrite as a
"second bug that survives the resolver", by analogy with S2. **It is not.** Once
`gradeLevel` is a canonical rung, `includes()` and `rung >= 3` are *equivalent* —
the resolver alone fixes it. The revert-bite proved this: restoring the
membership test changed nothing. S2's `>= '3'` was different, because `'K' > '3'`
lexically. The ordinal form here is defensive clarity, not a defect fix, and the
code comment says so.

### 4. SCAFFOLD-GAP + PRIMITIVE-GAP

- **Catalog `tutoring` block**: 9 contextKeys, 3 levels, 5 struggles, 3
  aiDirectives — PRE-READER READ-ALOUD with the cap-override clause (banning kg,
  kN, thrust, staging, delta-v and supplying "push"/"heavy"/"how high"), a
  **`WHAT A ROCKET NEEDS IS THE ANSWER — LEAD THEM TO IT`** rule (the three
  required parts must not be handed over as a checklist on the first ask; the
  goal may be said freely), and `A ROCKET THAT DOES NOT FLY IS DATA, NOT FAILURE`.
- **Component**: `useLuminaAI` + flat-literal `aiPrimitiveData` + 4 moments
  (`ROCKET_ORIENT`, `ROCKET_READ_ALOUD`, `ROCKET_PART_ADDED`,
  `ROCKET_LAUNCH_RESULT`, all `silent:true`) + `LuminaReadAloud`.
  **`[ROCKET_PART_ADDED]` is the load-bearing one** — the tutor's voice IS the
  part label for a non-reader, and it is fired from the handler rather than an
  effect on `stages`, so it cannot double-emit.
- **Part cards become picture-primary** at K-1 (glyph + short name, spec line
  gone), and the group headers use child words ("Where you sit", "Pushers")
  instead of the raw `fuel_tank` slug.
- **13 chrome classes conditionally rendered away** at K-1.

---

## [--fix] Loop log

| # | Change | Verification | Result |
|---|---|---|---|
| 1 | Canonical-first resolver + rung stamp | **revert-bite 7/26 and 3/26** | non-vacuous |
| 2 | Ordinal budget rung | **revert-bite 0/26 — documented NO-OP** | honest null result |
| 3 | Catalog `tutoring` block | **revert-bite 2/26**; tutor-test Tier 1 `pass` | non-vacuous |
| 4 | Component band pass (13 chrome classes) | **revert-bite 18/31** | non-vacuous |
| 5 | Picture-primary part cards | **revert-bite 1/31** | non-vacuous |
| 6 | Read-aloud `silent:true` | **revert-bite 1/31** | non-vacuous |
| 7 | — | src-scoped tsc **803 = baseline, zero new**; `typecheck:lumina` **0** | PASS |
| 8 | — | full vitest **2106/2106** (2049 before this slice) | PASS |

**6 of 7 bites bite.** The seventh is reported as a no-op rather than quietly
dropped, because *why* it doesn't bite is the finding.

**Testing note worth reusing:** the first three bites did NOT bite, because the
generator tests only exercised the exported pure helpers — not the generator's
own USE of them. Fixed by stubbing `../geminiClient` and driving the real
`generateRocketBuilder` with a reply that omits every grade-shaped field. That
technique covers the whole degrade path and should be the default for this class.

### Runtime verification

| Requested | `gradeLevel` | TWR | fuel | forces | stages | budget | parts |
|---|---|---|---|---|---|---|---|
| **K** | **K** | false | false | false | 1 | none | 3 |
| **Grade 1** (×2) | **1** | false | **true** | false | 1 | none | 5 |
| Grade 3 (control) | 3 | **true** | true | **true** | 3 | **7500** | 8 |

The ladder is intact and monotone. `tutor-test` Tier 2 @ kindergarten:
`status: pass`, `findings: []`, `dataBagDynamic: false`, all 9 contextKeys
resolved from the component, all 4 sendText tags live, zero `(not set)`.

---

## Findings routed elsewhere (NOT fixed here)

- **Rule 4 is still PARTIAL at K.** With 3 parts the visible interactive count is
  6 (3 parts + read-aloud + Launch + Start-over), and G1's 5 parts make it 8. The
  count is driven by how many parts the generator emits, so the real lever is a
  generator cap at K-1 — a Tier-3 change, deliberately not bundled here. **Recorded
  as PARTIAL rather than claimed as a pass.**
- **Flash-lite truncation, observed live: 1 failure in 4 G1 calls** —
  `Failed to parse Gemini response as JSON … at position 66172`.
  `availableComponents` is an unbounded schema array. This is the known
  [[project_flash-lite-truncation-template]] class (bound arrays, raise
  maxOutputTokens, retry+degrade) and is **pre-existing, not caused by this
  slice** — but it means the degrade path this slice just fixed is genuinely
  reachable in production, which raises its value.
- **No Tier-3 live audio run** → `qa/HUMAN-CHECKS.md` **#73**.
- **0 eval modes** → `/add-eval-modes` (L1), a separate layer.
- **The `GRADE {n}` badge is developer chrome at every grade**, not just K. Gated
  at K-1 only, to stay inside the band remit; removing it at 2-5 is a one-line
  follow-up if anyone wants it.
