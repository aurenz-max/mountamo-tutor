# Reader Fit: telescope-simulator @ PRE — 2026-08-06

Modes audited: n/a (0 eval modes) | Probes: eval-test ✓ (K, G1, G3) · tutor-test --probe ✓ · real curator A/B ✓

**Queue:** supply-side sweep item **S1** (`BACKLOG.md` item 15A), the top-risk pull
of `qa/reader-fit/supply-sweep-triage-2026-08-06.md`.

**Overall: WRONG-BAND at PRE and EMERGING — FIXED via a Grade-2 BAND FLOOR, and
the fix is A/B-verified against the real manifest curator.** A second,
independent defect (prose-vs-canonical grade, the `14m` sweep class) was found in
the same generator and fixed in the same slice.

## Why this was audited at PRE

The catalog promised it: *"Progressive difficulty from K (we can see space with
telescopes) to Grade 5"*, *"ESSENTIAL for … K-5 science"*, and a `constraints`
line specifying a K rung — *"K: binoculars, 3-4 bright objects (Moon, Venus,
Jupiter), auto-focus, no grid/journal, 1-2 easy targets to find."* Per the skill,
a catalog band claim is a promise and is audited at the LOWEST claimed grade.

## Audit A — text census

Real K draw (`/api/lumina/eval-test`, `grade=K`, topic "we can see space with
telescopes"). The generator's K shaping was actually correct — `binoculars`,
`initialMagnification: 3`, `targetObjects: ["venus","moon"]`, `journalMode:
false`, `showGrid: false`. The COMPONENT ignores it for chrome purposes.

| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| "Venus is the brightest point of light! Can you find it?" | `hints[]`, behind a "💡 Show hints" toggle | **Load-bearing** (this IS the task) | none | **UNCOVERED** |
| "Drag to move the telescope!" | `hints[]`, same toggle | **Load-bearing** (the only statement of the protocol) | none | **UNCOVERED** |
| "Venus" / "planet", "The Moon" / "moon" | target list buttons | **Load-bearing** (which object to find) | none | **UNCOVERED** |
| "🎯 Targets (0/2)" | sidebar tab | Load-bearing (progress) | none | UNCOVERED |
| "Through your Binoculars at 3×:" + detailLevels prose | `ObjectInfoPopup` | Load-bearing (the payoff content) | none | UNCOVERED |
| "Submit Observation" | primary action button | Load-bearing | none | UNCOVERED |
| "Magnification", "Telescope", "View:", "Labels", "Grid", "Manual Focus" | controls bar | Supportive→chrome | none | UNCOVERED |
| "Binoculars"/"Small Scope"/"Large Scope"/"Space Telescope" | 4 buttons | Chrome | none | UNCOVERED |
| "Visible"/"Infrared"/"Radio" | 3 buttons | Chrome | none | UNCOVERED |
| "No observations yet. Click an object and log it!" | journal empty state | Chrome | none | UNCOVERED |
| "All Objects Found! You discovered 2 celestial objects!" | completion | Feedback | none | UNCOVERED |

**Audit A: FAIL.** Every load-bearing string is UNCOVERED, and not by oversight —
**no spoken channel exists to cover them** (see Audit B). The instruction that
tells the child what to do is 12px text behind a toggle.

## Audit B — sufficiency contract

Not inferred. The platform's own probe answers it:

```
GET /api/lumina/tutor-test?componentId=telescope-simulator&probe=1&gradeLevel=kindergarten
→ HTTP 400
{"status":"no-scaffold","error":"\"telescope-simulator\" has no tutoring block —
  it runs on the generic tutor (L0/L1). Add one via /add-tutoring-scaffold."}
```

`TelescopeSimulator.tsx` contains no `useLuminaAI` and no `sendText(`, and the
catalog entry has no `tutoring` block, so `lumina_tutor.py:385` fires:

```python
if not tutoring_scaffold:
    return base + "\nNo specific scaffolding instructions for this primitive type."
```

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| (all — no eval modes declared) | **FAIL** | **FAIL** | **FAIL** | **FAIL** | **FAIL** |

**Audit B: FAIL, structurally.** There is no channel to fix at Tier 1.

## Audit C — band contract

Counted from the rendered worst case. Every control below is **unconditional** —
`gradeLevel` is destructured at `TelescopeSimulator.tsx:265` and never read again,
so K and Grade 5 render an identical panel. The generator's careful `showGrid:
false` / `focusMode: 'auto'` are only *initial state* the child can toggle back on.

| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1. Audio is the instruction channel | **FAIL** | No audio channel exists at all |
| 2. Tap = choose | **FAIL** | Aim by dragging, then zoom by slider, then tap — a 3-step protocol stated only in hint text |
| 3. Pictures are the answer surface | **FAIL** | Target list is name+type text rows |
| 4. ≤ ~5 interactive elements | **FAIL** | **17+**: drag viewport, mag slider, focus ring, 4 telescope buttons, 3 view-mode buttons, 3 checkboxes, targets tab, N target rows, hints toggle, Submit |
| 5. Feedback on the touched object | PARTIAL | Green ✓ lands on the row, but completion is a text card |
| 6. No typing | PASS | No text entry |
| 7. No adult chrome | **FAIL** | `AZ 225.0° · ALT 35.0° · 3×` coordinate readout, `3× / 12×` ratio, `(0/2)` counter, three toggles, journal timestamps |
| 8. Assessment hides in the mechanics | PARTIAL | Finding an object is instrumented, but "Submit Observation" is a quiz-shaped gate |

## Verdict and why WRONG-BAND, not PRIMITIVE-GAP

Band-gating the chrome and adding an L2 scaffold *could* silence the panel — but
what remains at K is dragging a viewport until an unnamed dot is centred. Every
teaching payload the primitive owns (magnification, telescope comparison, view
modes, observation logging) is precisely what must be removed, and the catalog's
own K rung — *"we can see space with telescopes"* — is a **fact to be told, not a
task to be performed**. There is nothing left to assess.

Flooring also strands nothing: the same K objective routes to
`solar-system-explorer`, `day-night-seasons`, `moon-phases-lab`,
`constellation-builder` and `planetary-explorer` — confirmed empirically below.
This is the skill's "success outcome" case.

## The fix

**Floor = Grade 2**, matching the catalog's own progression (Grade 2 = *"small
telescope, telescope switching enabled, finding things in the sky"*), which is
where the primitive's real pedagogy starts.

1. **Catalog** (`catalog/astronomy.ts`) — `description` no longer advertises
   K-4/K-5; `constraints` opens with an explicit **`BAND FLOOR: Grade 2+ ONLY`**
   that states *why* (permanent text-labelled instrument panel, no spoken twin,
   no scaffold) and **names where K-1 astronomy should route instead**. K and
   Grade 1 rungs deleted.
2. **Generator** (`gemini-telescope-simulator.ts`) — structural backstop so the
   floor holds even if something routes K anyway: response-schema `gradeLevel`
   enum narrowed to `["2","3","4","5"]`; K/G1 prompt rungs, fun-facts, default
   hints and default object-lists removed; prompt states the floor explicitly.
3. **Second defect, same slice — prose-vs-canonical grade (`14m` class).** The
   generator read `ctx.gradeContext` — PROSE (*"kindergarten students …"*) — into
   `gradeLevel === 'K'` and `gradeLevel <= '2'` comparisons that **could never
   match**, so every structural default silently fell through to its last branch.
   Fixed with the 14m template: exported `telescopeGradeFromGrade(grade?)`
   (canonical-first, floor applied, `null` when absent) `??`
   `telescopeGradeFromProse(...)` (legacy fallback, kept not deleted).

## [--fix] Loop log

| # | Change | Verification | Result |
|---|---|---|---|
| 1 | Catalog band floor + description de-K'd | 10 focused tests | PASS |
| 2 | Generator enum/prompt/defaults floored; canonical-first resolver | **revert-bite: 3/10 fail when the floor is removed** | non-vacuous |
| 3 | Schema field descriptions de-K'd (they steered Gemini to K rungs) | — | applied |
| 4 | — | `tsc --noEmit` **805 vs 806 baseline** (one fewer, zero new); `typecheck:lumina` **0** | PASS |
| 5 | — | full vitest **1801/1801**, 156 files | PASS |

### Runtime verification (Verification Doctrine — exercised, not type-checked)

**Generator, real `/api/lumina/eval-test` through the production route:**

| Requested | `gradeLevel` | telescope | mag | objects | targets | journal |
|---|---|---|---|---|---|---|
| **K** | **2** (floored) | small | 5 | 6 | 4 | false |
| **Grade 1** | **2** (floored) | small | 5 | 6 | 4 | false |
| Grade 3 (control) | 3 | small | 10 | 7 | 4 | **true** |

The G3 control is unchanged — the floor lifts K/1 without flattening the ladder.

**Curator A/B on the most adversarial possible K topic** — "Looking at the night
sky with telescopes" @ Kindergarten, real pipeline (`/api/lumina/topic-trace`,
`manifestOnly=true`):

- **PRE-FIX:** `foundation-explorer, sorting-station, constellation-builder,
  image-comparison, ` **`telescope-simulator`** `, knowledge-check` — the curator
  **did** hand a Kindergartener the mute instrument panel. The sweep's predicted
  failure, reproduced live.
- **POST-FIX:** `deep-dive, image-comparison, sorting-station, concept-card-grid,
  planetary-explorer, constellation-builder` — **telescope-simulator not
  selected**, and the K demand landed on tap-and-watch astronomy primitives.

*Honest bound:* curation is stochastic, so one A/B pair is strong evidence the
floor changed behavior on the worst-case topic, not a proof it can never be
picked. The generator-side enum floor is the backstop for that residual.

## Findings routed elsewhere (NOT fixed here)

- **SCAFFOLD-GAP at Grades 2-5 remains open.** The floor makes the primitive
  unreachable by non-readers; it does **not** give it a tutor. `telescope-simulator`
  still has no `tutoring` block and no channel at the grades it *does* serve.
  That is an L2 item (`/add-tutoring-scaffold`), the same ladder as engineering
  Phase A. Queued in `BACKLOG.md` item 15 as a follow-on, not silently closed.
- **0 eval modes** — invisible to the IRT selector. Belongs to the queued
  density work (`/add-eval-modes`), same primitive, same slice when pulled.
- **Confirmation for the sweep's ordering:** the post-fix K manifest selected
  `planetary-explorer` and `constellation-builder`, both flagged in the triage as
  *no read-aloud, no band gate*. K astronomy demand is now routing squarely onto
  the Class-B queue — which raises S8–S12's priority rather than lowering it.
