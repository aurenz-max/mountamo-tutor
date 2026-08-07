# Reader Fit: orbit-mechanics-lab @ PRE — 2026-08-07

Modes audited: n/a (0 eval modes) | Probes: eval-test ✓ (K, G1, G3 control) · tutor-test Tier 1 ✓ · tutor-test --probe ✓ · curator trace ✓ (A/B, 4+4 draws)

**Queue:** supply-side sweep item **S2** (`BACKLOG.md` item 15A), the next pull after
15B closed 8/8.

**Overall: SCAFFOLD-GAP + PRIMITIVE-GAP at PRE — FIXED. The queued WRONG-BAND
verdict was REJECTED, on a user ruling and on live evidence.**

---

## The verdict change, and why

15A's stated theory was: *these primitives cannot serve K by design, so the fix is
a catalog **BAND FLOOR** plus a generator backstop, with no component work.* The
S1 `telescope-simulator` precedent had shipped exactly that.

I initially leant that way here too, and was wrong. **User ruling, mid-slice:**

> *"i dont like band floor method, like if lumina routes to a certain primitive,
> its okay to use it and we should make it age friendly?"*

Two independent things then confirmed the ruling was the right call:

1. **The curator really does route this primitive to a Kindergarten lesson.**
   A live `topic-trace` on *"Things that go around and around in space"* @ K
   selected `['solar-system-explorer', 'foundation-explorer', **'orbit-mechanics-lab'**]`.
   A floor would have deleted a card the curator actively wanted, at the band
   with the least supply.
2. **The K interaction is fixable.** The blocker was never the physics — it was
   two numeric sliders (kN, degrees) as the only input path. Replacing them with
   three tappable pictures preserves the real failure modes, so the task stays
   assessable instead of collapsing into a one-tap animation.

Recorded as a standing ruling ([[feedback_make-age-friendly-not-band-floor]]):
**WRONG-BAND is a last resort, not the cheap default.** It supersedes 15A's
theory for S3/S5/S6/S7, and makes `telescope-simulator` (S1) a revisit candidate.

---

## Audit A — text census (real K draw)

Every string below rendered **unconditionally** — `data.gradeLevel` was read in
exactly ONE place (`getGradeLabel`, relabelling three words), so K and Grade 5
rendered the same panel apart from five display booleans.

| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| "Set thrust and angle, then launch!" | status chip, top-right | **Load-bearing** (the ONLY statement of the protocol) | none | **UNCOVERED** |
| "Thrust: 26 kN" + range slider | launch panel | **Load-bearing** (half the input) | none | **UNCOVERED** |
| "Launch Angle: 90°" + range slider | launch panel | **Load-bearing** (the other half) | none | **UNCOVERED** |
| "🚀 Launch!" / **"Need More Thrust!"** | primary action | **Load-bearing**; disabled state is a text-only dead end | none | **UNCOVERED** |
| "Star Hopper Stats", "Mass 2,000 kg", "Thrust 26 kN" | rocket panel | Chrome | none | UNCOVERED |
| "Altitude / Max Altitude / Velocity" + km, m/s | flight data | Chrome | none | UNCOVERED |
| "Reached Space (100 km)", "Stable Orbit" | milestone ledger | Chrome | none | UNCOVERED |
| "Need a hint?" ▼ → "Press the big Launch button!" | collapsed disclosure | **Load-bearing** (the task, hidden behind a toggle) | none | **UNCOVERED** |
| "Speed: 10x" + range slider | flight controls | Chrome | none | UNCOVERED |
| "CRASHED!" | SVG overlay | Feedback | none | UNCOVERED |
| "Astronomy: / ORBIT LAB" | mono badge | Decorative dev chrome | none | UNCOVERED |

**Audit A: FAIL** — and not by oversight. No spoken channel existed at all.

## Audit B — sufficiency contract

Not inferred; the platform's own probe answered it:

```
GET /api/lumina/tutor-test?componentId=orbit-mechanics-lab
→ HTTP 400 {"status":"no-scaffold", "error":"\"orbit-mechanics-lab\" has no
   tutoring block — it runs on the generic tutor (L0/L1)."}
```

`OrbitMechanicsLab.tsx` contained no `useLuminaAI` and no `sendText(`. **Both
channels absent**, so `lumina_tutor.py:385` served the literal string *"No
specific scaffolding instructions for this primitive type."*

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| (all — no eval modes declared) | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL** |

## Audit C — band contract (rendered worst case, real K data)

| Rule | Pre-fix | Offender | Post-fix |
|---|---|---|---|
| 1. Audio is the instruction channel | **FAIL** | no audio channel exists | **PASS** |
| 2. Tap = choose | **FAIL** | drag a kN slider, drag a degree slider, then press Launch | **PASS** (one tap chooses AND flies) |
| 3. Pictures are the answer surface | **FAIL** | two continuous numeric controls | **PASS** (🐢 / 🚀 / ⚡) |
| 4. ≤ ~5 interactive elements | **FAIL** | 7 (2 sliders, Launch, hint toggle, play/pause, reset, speed slider) | **PASS** (5, test-locked) |
| 5. Feedback on the touched object | PARTIAL | `CRASHED!` text | **PASS** (💥 on the rocket + spoken beat) |
| 6. No typing | PASS | — | PASS |
| 7. No adult chrome | **FAIL** | kg/kN/km/m·s⁻¹/°, TWR, milestone ledger, 3 panels | **PASS** (absent from the DOM) |
| 8. Assessment hides in the mechanics | **FAIL** | at K `challenge` is null, so `handleSubmitEvaluation` was **unreachable — no assessment path at all** | **PASS** (finding the orbiting speed self-submits) |

---

## The four defects fixed

### 1. Prose grade (the `14m` class) — probe-confirmed, and it fired at G1

`gradeLevel = ctx.gradeContext` (`:251`) fed every structural default. **Live
probe at `grade=1` pre-fix returned `"Rocket to Orbit! - Grade 3 Orbit Mechanics
Lab"`, `gradeLevel:'3'`, with `showTWR`, `showFuelGauge`, `allowBurns` and
`gravityVisualization:'field_lines'` all on.** A Grade-1 child was served the
Grade-3 instrument.

*Correction to the handoff's prediction, worth recording:* the handoff expected
this to bite at K. **It did not** — the K happy path came out correct, because
kindergarten prose steers Gemini strongly enough on its own. It bit at **G1**,
and on the **degrade path at every grade** (`getDefaultRocketConfig(prose)` →
undefined → Grade-3 rung). *A happy-path probe at K alone would have declared
this generator clean.* Probe the neighbouring grade too.

Fixed canonical-first: exported `orbitMechanicsGradeFromGrade()` `??`
`orbitMechanicsGradeFromProse()` (legacy, kept not deleted). Prose stays in the
prompt as `audienceProse`, which is the one place prose belongs. **No floor.**

### 2. Lexical rung comparison — a SECOND bug that survives a correct resolver

`gradeLevel >= '3'` is **true for `'K'`**, because `'K'` sorts after `'3'`. So
even once the rung resolved correctly, burns and gravity field lines stayed on at
Kindergarten. Two bugs, one symptom; a grep for the resolver would have found
only the first. Now `orbitRungIndex()` (K = 0) with ordinal comparisons, in an
exported, directly-tested `applyOrbitDisplayDefaults()`.

### 3. The rung was never STAMPED onto the output

The component band-gates on `data.gradeLevel`, and the generator returned
whatever Gemini echoed — which at G1 was `'3'`. **Every new gate would have been
dead on arrival** (the `habitat-diorama` failure: gating code that never runs).
The resolved rung now overwrites the echo. *This line had no test until a
revert-bite proved the omission was silent.*

### 4. SCAFFOLD-GAP + PRIMITIVE-GAP

- **Catalog `tutoring` block**: 9 contextKeys, 3 levels, 5 struggles, 3
  aiDirectives — a PRE-READER READ-ALOUD carrying the *"this OVERRIDES any
  one-sentence cap"* clause, a **`WHICH SPEED IS THE ANSWER — NEVER SAY IT`**
  rule (the goal is the question and may be said freely; the winning picture is
  the answer, forbidden *including by elimination*), and `FALLING IS NOT
  FAILING`.
- **Component**: `useLuminaAI` + flat-literal `aiPrimitiveData` + 3 moments
  (`ORBIT_ORIENT`, `ORBIT_READ_ALOUD`, `ORBIT_FLIGHT_RESULT`, all `silent:true`)
  + `LuminaReadAloud`; K-1 chrome gated by **conditional render**, not CSS.
- **The two sliders become three pictures.** One tap sets thrust + angle and
  flies. The TWR gate is bypassed on that path deliberately — *"too slow"* must
  visibly fall back, not meet a disabled button reading "Need More Thrust!".

### Also: `showOrbitPath` was declared, generated, and read by NOBODY

The catalog's K rung is *"showOrbitPath only"* — the one feature K is promised,
and the component never implemented it. Now drawn from the same orbital elements
the flight panel uses, so the loop cannot drift from the dot travelling it. It
matters most at K: the drawn loop makes "goes around and around" legible in the
first second rather than after a 100-minute lap.

`showApogeePerigee` was equally dead (the rows keyed off `isInOrbit` instead) —
now honoured. **`gravityVisualization` and `initialOrbit` remain unimplemented →
residual, below.**

---

## How the three speed choices were chosen (not guessed)

The physics was extracted to `service/astronomy/orbitPhysics.ts` — a pure module
the component now calls, so the presets are proved against **the same code the
child's rocket flies on**. Sweeping the real integrator (propellant is 60% of
mass at every grade rung, so outcome depends on thrust-to-weight alone and the
presets generalise):

| Choice | TWR | Outcome | e | Apogee | On screen |
|---|---|---|---|---|---|
| 🐢 Slow | 0.90 | **crash** — rises, falls back | — | — | — |
| 🚀 Medium | 1.02 | **orbit** | 0.11 | 1,668 km | **yes** |
| ⚡ Super fast | 2.50 | orbit, flung far out | 0.72 | 33,162 km | no (521 px vs a 250 px half-height) |

Exactly one choice both orbits and stays visible — asserted by a test that
re-derives all three on every run.

**Answer-leak fix found by this analysis:** the orbiting choice was first
labelled **"Just right"**, which names the answer outright — and worse, the tutor
reads those labels aloud to the very child who cannot read them. Relabelled
**"Medium"**; captions now describe speed, never correctness (CLAUDE.md #1).
Locked by a test.

**Time compression:** one lap takes ~102 simulated minutes; at the grade-2+
default of 10× that is a 10-minute wait, so K would never see "around and
around". K-1 now uses 60× while ascending (the climb stays watchable) then 300×
coasting (~20 s per lap). The integrator always steps at ~1 s regardless, so this
changes nothing about accuracy.

---

## [--fix] Loop log

| # | Change | Verification | Result |
|---|---|---|---|
| 1 | Pure `orbitPhysics.ts`; component rewired to it | 2 files, 71 focused tests | PASS |
| 2 | Canonical-first grade + ordinal rung + stamp | **revert-bite 1/35, 2/35** | non-vacuous |
| 3 | Catalog `tutoring` block | tutor-test Tier 1 `pass` | PASS |
| 4 | Component band pass + speed picker | **revert-bite 20/34** | non-vacuous |
| 5 | `showOrbitPath` implemented | **revert-bite 2/34** | non-vacuous |
| 6 | Read-aloud `silent:true` | **revert-bite 1/34** | non-vacuous |
| 7 | Speed presets from the real integrator | **revert-bite 4/35** | non-vacuous |
| 8 | — | src-scoped tsc **803 = baseline, zero new**; `typecheck:lumina` **0** | PASS |
| 9 | — | full vitest **2049/2049** (1978 at `ff31a95`) | PASS |

**All six revert-bites bite.** Two did NOT on the first attempt — the rung stamp
and `showOrbitPath` — because the code they guarded was unreachable from a test.
Both were restructured (stamp moved into the tested pure function;
`buildOrbitPathD` exported) rather than left as decoration.

### Runtime verification (Verification Doctrine — exercised, not type-checked)

**Generator, real `/api/lumina/eval-test` through the production route:**

| Requested | `gradeLevel` | TWR | fuel | vel | burns | gravity | path | challenge |
|---|---|---|---|---|---|---|---|---|
| **K** | **K** | false | false | false | false | none | true | none |
| **Grade 1** | **1** (was **`3`**) | false | false | false | false | none | true | reach_altitude |
| Grade 3 (control) | 3 | true | true | true | **true** | field_lines | true | reach_orbit |

**The G1 row is the A/B that decides the slice:** pre-fix *"Rocket to Orbit! -
Grade 3 Orbit Mechanics Lab"* with the full adult instrument → post-fix *"Sky
Jumper: Why Satellites Stay Up!"* with all of it off. G3 is unchanged, so the
ladder was not flattened.

**Content fidelity caught by re-probing:** post-fix G1 hints still read *"Try
different speeds with the slider!"* — describing a control that no longer exists
at that grade, and *"Not too slow, not too fast!"* leaked the answer. Both K/G1
hint sets fixed in the prompt (two separate places named them) and in
`getDefaultHints`; re-probed **2/2 clean at K, 1/1 at G1**.

**tutor-test Tier 2 probe @ kindergarten:** `status: pass`, `findings: []`,
`dataBagDynamic: false` (flat literal), all 9 contextKeys resolved from the
component, all 3 sendText tags live, **zero literal `(not set)`**.

**Curator A/B — reported honestly, and it does NOT support a strong claim.**
Same topic, same grade, 4 draws each:

| Catalog | `orbit-mechanics-lab` selected |
|---|---|
| pre-fix wording | **1 / 4** |
| post-fix wording | **0 / 4** |

The base rate is low either way and 0/4 vs 1/4 is well inside noise for a ~25%
rate (P(0 of 4 | p=0.25) ≈ 0.32). **Claim: no measurable change in selection; the
sample cannot detect one.** Unlike S1 — where changing selection *was* the fix —
selection is not what this slice changed, so this is a supply sanity check rather
than the decisive evidence. The decisive evidence is the G1 grade flip above.

---

## Findings routed elsewhere (NOT fixed here)

- **No Tier-3 live audio run.** → `qa/HUMAN-CHECKS.md` (extend **#73**, the
  15B astronomy sitting). The `ORBIT_FLIGHT_RESULT` beat and the
  never-name-the-picture rule are behavioural and only fully visible live.
- **0 eval modes** — invisible to the IRT selector. `/add-eval-modes` (L1) is a
  separate layer, out of scope here as it was for all of 15B.
- **`gravityVisualization` and `initialOrbit` are still declared-but-unread.**
  Two more dead flags in the same component; neither is band-relevant (both are
  grade 3+ features), so they are a fidelity item, not a reader-fit one.
- **The 🐢 "too slow" arc is physically ~51 km — under 1 px at this visual
  scale.** The outcome is legible only from the 💥 and the spoken beat, not from
  a visible rise-and-fall. Honest limitation of the renderer's scale, recorded
  rather than papered over; a K-specific zoom would be its own slice.
- **`telescope-simulator` (S1) shipped a Grade-2 BAND FLOOR under the theory this
  slice just overturned.** It predates the ruling. Revisit candidate — not
  silently reverted.
