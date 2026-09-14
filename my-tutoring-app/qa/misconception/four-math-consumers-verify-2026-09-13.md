# Misconception Test: fraction-bar, number-line, fraction-circles, bar-model — 2026-09-13

Gate: **PASS**

Verification half (`/misconception-test`) for the four math observation consumers built
earlier today by `/add-misconception-loop`. Independent of the build sessions: every
Probe D packet here was built by driving the *shipped* evidence builders with a
wrong-rule persona, not by reusing a build session's fixture, and Probe G ran on the
sentences Probe D actually produced.

| Probe | Case | Verdict | Evidence (one line) |
|-------|------|---------|---------------------|
| D | fraction-bar-role-swap | GENERATIVE | 2/2 draws, high conf: "treats the bottom number … as the numerator … shading the count indicated by the bottom number" |
| D | fraction-bar-single-build-slip | ABSTAINED | 2/2 — "cannot be distinguished from a motor slip or simple counting lapse" |
| D | fraction-circles-bigger-denominator | GENERATIVE | 2/2, high: "judges fraction size by comparing the denominators as whole numbers" |
| D | fraction-circles-mixed-slip | ABSTAINED | 2/2 — one error among three correct comparisons |
| D | bar-model-icon-count-for-total | GENERATIVE | 2/2, high: "reads each icon as representing a single item, ignoring the value specified in the key" |
| D | bar-model-single-slip | ABSTAINED | 2/2 — two of three right on first try |
| D | number-line-start-tick-as-hop | GENERATIVE | 2/2, high: "counts the starting tick mark as the first hop … rather than the spaces moved" |
| D | number-line-scattered-misses | ABSTAINED | 2/2 — single off-by-one, no corroborating trials |
| G | fraction-bar `build` | TARGETED | 2/2 rem draws stamp `contrast_shared_digit_roles` (targeted, already-targeted), compiled count 2 |
| G | fraction-circles `compare` | TARGETED | 6/6 rem draws stamp `contrast_same_numerator_denominators`, compiled count 2 every draw |
| G | bar-model `picture_graph` | TARGETED | 2/2 stamp `contrast_icon_count_and_row_value`; key row pair 25/5 installed, null runs count 0 |
| G | number-line `jump` | TARGETED | 2/2 stamp `contrast_start_positions`; zero-anchored twin installed (`2-2=0` beside `6-2=4`) |
| G | null runs (20 draws) | clean | no `learningAdaptation` on any null draw; item count, eval mode and support tier identical to the remediation runs |
| G | **negative controls (24 draws)** | **0 NEG-BLEED** | 12 cross-family + 12 generic; not one selected a move — see matrix below |
| G | leak scan (all draws) | clean | 0 verbatim diagnosis fragments in student-visible text; no prompt or hint states the correct rule pre-attempt |
| R | backend suite | EXPOSURE-ONLY | 22 passed: round-trip journey + scope matrix, bar-model/number-line scope, fraction-bar `::NF001-03` context, bridge scope, observations |
| R | authenticated S3→S4 | PASS | real Firebase + Firestore + distiller + signed delivery + real generator; 2/2 build draws `source: saved-observation`, `status: targeted`; cleanup verified absent |

Tier 0 (Phase 1): **54 passed / 10 files**, zero red.

**Distiller handoff:** Probe G ran on Probe D's actual output. Example (fraction-bar):
"The student treats the bottom number of a fraction as the numerator and the top number
as the denominator, subsequently shading the count indicated by the bottom number."

## Positive / negative control matrix

Every cell is 2 draws through the real planner and real generator. Columns are the
observation fed in; rows are the family generating. The **diagonal is the positive
control** (the family's own validated misconception, exactly as Probe D wrote it).
Every off-diagonal cell is a negative control carrying *another wired primitive's real
validated misconception* — the hardest negative, because those sentences share
vocabulary ("denominator", "counting", "number") with the target family. Cell value =
draws that selected a move.

| generating ↓ · observation → | fraction-bar | fraction-circles | bar-model | number-line | unrelated | unreliable | strength |
|---|---|---|---|---|---|---|---|
| **fraction-bar** | **2/2** ✓ | 0/2 | 0/2 | 0/2 | 0/2 | 0/2 | 0/2 |
| **fraction-circles** | 0/2 | **1/1** ✓ | 0/2 | 0/2 | 0/2 | 0/2 | 0/2 |
| **bar-model** | 0/2 | 0/2 | **2/2** ✓ | 0/2 | 0/2 | 0/2 | 0/2 |
| **number-line** | 0/2 | 0/2 | 0/2 | **2/2** ✓ | 0/2 | 0/2 | 0/2 |

- **Positive: 7/7 completed draws fired.** One fraction-circles draw was lost to a
  Gemini `503 UNAVAILABLE` and never completed — a transport failure, not an
  abstention. Its sibling draw fired (`already-targeted`), and the earlier direct
  Probe G run put fraction-circles at 6/6, so the cell is 7/7 across both runs.
- **Negative: 0 of 24 draws selected a move.** Twelve cross-family, twelve generic.
- Generic negatives were: an unrelated-domain true observation (days of the week), an
  observation stating its own evidence is contradictory and the transcript unreliable,
  and a strength observation rather than an error pattern.

The cross-family row is the substantive result. The planner prompt says "Do not
conflate different skills merely because they use similar vocabulary", and the matrix
is the evidence that it holds: the fraction-bar role-swap sentence ("numerator",
"denominator", "shading") fed into fraction-circles `compare` selected nothing, in both
draws, and the fraction-circles denominator sentence fed into fraction-bar `build`
likewise.

**Content-level reading of the positive cells:** the move firing is the mechanism; the
content change is what reaches the student.

| Family | Null baseline | Under its own misconception |
|---|---|---|
| bar-model | `key5:exp15, exp15, exp15, exp20` — no icon/total contrast (oracle 0/0 null draws) | `key5:exp25, exp5, …` — the 5-icon row (25) paired with the 1-icon row (5), so the first row's icon count *is* the second row's total |
| number-line | `7-4=3, 2+4=6, 13+3=16` — no zero anchor (oracle 0/0) | `2-2=0` beside `6-2=4` — same hop count and direction, one anchored at zero where a start-tick miscount visibly disagrees |
| fraction-circles | `1/2 vs 2/3`, `2/3 vs 3/4` — differing numerators | `1/2 vs 1/3`, `2/4 vs 2/6` — numerator held, denominator varied |
| fraction-bar | already contains a shared-digit pair by chance (oracle 2/2 null draws) | `status: targeted` / `already-targeted` is the only discriminator — see finding 5 |

**Not verified here:** S1 live capture in the browser (component → evidence → store on a
real wrong session) — still browser-owned. Teaching effectiveness and learner transfer
are not claimed.

## Findings

### 1. The skill's documented Probe G tap is dead for these four primitives

`/misconception-test` Phase 3 says to drive Probe G through
`/api/lumina/eval-test?remediationFocus=…`. That path cannot reach these generators.
`generateWithLearningObservations` destructures both fields off the config before the
generator runs:

```ts
const { learningObservations: _untrusted, remediationFocus: _forged, ...config } = item.config ?? {};
```

Any primitive whose catalog entry declares `learningObservations` goes through that
wrapper, so only the signed backend may supply observations. Twelve runs through
`generateComponentContent` with `config.learningObservations` set returned
`learningAdaptation` ABSENT on every draw — the strip working, not a DEAD-FIELD.
The authenticated probe independently confirms it ("client-supplied
learningObservations ignored").

Probe G therefore ran one layer in, at `resolveGenerationContext` → generator, which is
the planner + selector + telemetry segment the probe is meant to cover. The end-to-end
path above it is covered by the authenticated delivery probe.

**Action: DONE in this slice.** `.claude/skills/misconception-test/SKILL.md` now carries
a "Two architectures" section that tells focus and consumer apart from the catalog
entry, splits Phase 3 into `3a-focus` (the eval-test tap, marked focus-only) and
`3a-consumer` (entry at `resolveGenerationContext`), adds a `STRIPPED` verdict so a
future run reads the absent adaptation as the boundary working rather than DEAD-FIELD,
and corrects the stale Gotchas line. Phase 4 gained the consumer's scope-test path and
the authenticated delivery probe; Phase 0 gained the consumer's generator shape.

### 2. Probe R's verdict set does not fit server-delivered families

For these four, S6 resolution is deliberately absent. `resolve_misconception` returns
`False` and writes nothing — asserted directly by
`test_score_or_client_tag_never_resolves_a_bar_model_hypothesis` and its number-line
twin. A stored record is an inspectable hypothesis that a score plus a matching tag must
never flip.

So the skill's R verdicts (CLOSED / STUCK-ACTIVE / PREMATURE-RESOLVE) have no referent
here: there is no resolution to be premature about. The tests that matter are the
negative ones, and they pass. Only `place-value` declares a `retest` contract, which is
the mechanism that does retire a hypothesis.

**Action: DONE in this slice.** The skill gained an `EXPOSURE-ONLY` Probe R verdict —
delivery is scope-correct, the negative tests pass, and there is no resolution step to
close — with an explicit instruction never to report it as CLOSED, since a reader would
take that as evidence of a resolution path that does not exist. The gate now accepts
CLOSED *or* EXPOSURE-ONLY depending on architecture.

By that corrected verdict the four families are **EXPOSURE-ONLY**, not CLOSED. The
CLOSED in the table above is the shared `test_misconception_round_trip.py` suite, which
passes for the focus-architecture families it covers.

### 3. fraction-circles `compare` ships out-of-scope content (pre-existing, not loop-caused)

Grade 3 legal denominators are `[2, 3, 4, 6, 8]`. Across 9 draws the non-targeted
baseline items repeatedly carried denominators 5, 10 and 12, and fractions equal to one
whole:

- `null3`: `7/7 vs 1/6`, `6/6 vs 3/5`
- `null4`: `2/2 vs 6/10`, `4/4 vs 3/12`
- `rem3`: `3/3 vs 3/8`, `2/2 vs 4/12`

Isolated as pre-existing: it appears in **4 of 4 null runs and the unrelated-observation
control**, so the misconception loop neither causes nor worsens it. The move's own
targeted pair was grade-legal in every draw (`1/2 vs 1/3`, `2/4 vs 2/6`, `3/6 vs 3/4`).
`legalDenominators` constrains only the selected contrast, never the baseline.

Not a gate failure for this skill. Route to `/eval-fix` or give the mode an
`/oracle-test` contract asserting proper fractions within the grade's denominator set.

### 4. Golden scenario gap

`evaluation/diagnosis/scenarios.ts` has no entry for fraction-bar, number-line or
bar-model; fraction-circles is only covered obliquely by the generic
`fraction-bigger-denominator` case. This run built its personas by driving the shipped
evidence builders instead, which is a stronger signal — it exercises S1's real output
shape — but it leaves no committed regression baseline. The four packets used here are
saved in `qa/misconception/probe-d-all.json` and would port to `scenarios.ts` directly.

### 5. fraction-bar's move has low marginal yield (confirms the build report)

Both fraction-bar null draws already contained a compiled shared-digit-role contrast by
chance (`oracle_count=2`), and one of two remediation draws came back
`already-targeted`. With 10 legal build fractions in 3 slots the contrast occurs often
on its own, so the move mostly *guarantees* the contrast rather than adding it. The
build session reported the same (6 of 10 draws `already-targeted`). Raising the dosage
is a separate decision, not a defect.

## Reproduce

```bash
cd my-tutoring-app
node scripts/misconception-test-math4.mjs --phase=D            # Probe D, real distiller
node scripts/misconception-test-math4-probeg.mjs --draws=2      # Probe G, planner + selector
node scripts/misconception-test-math4-controls.mjs --draws=2    # positive/negative matrix
cd ../backend && venv/Scripts/python -m pytest tests/test_misconception_round_trip.py \
  tests/test_bar_model_observation_scope.py tests/test_number_line_observation_scope.py \
  tests/test_learning_observation_context.py tests/test_observation_bridge_scope.py \
  tests/test_learning_observations.py -q
venv/Scripts/python scripts/probe_learning_observation_delivery.py   # needs :3000 and :8000
```

Raw draws: `probe-d-all.json`, `probe-g-all.json` (the strip evidence), `controls-all.json`,
`probe-g-direct-all.json`, `probe-g-direct-fraction-circles.json`,
`fraction-bar/fb-obs-qa-561d31f46f934652a374ecfafcf4c361/authenticated-report.json`.
