# Reader-fit SUPPLY-SIDE SWEEP — triage of the never-audited K-selectable set — 2026-08-06

**Outcome: the sweep's target set is enumerated and risk-ranked against the LIVE
catalog (196 entries, dumped by importing `UNIVERSAL_CATALOG`, not grepped), and
the top risk band is not a list of 69 independent audits — it is ONE
machine-verified class: 26 primitives that claim Kindergarten in the catalog and
have NO instruction channel of any kind. 11 of those already have an owner
(engineering Phase A). 15 do not. That unowned 15 is the re-seeded queue.**

## Method (why these numbers are trustworthy where the 08-06 estimate was a proxy)

The `/pm` estimate (107 K-selectable / ~38 audited / ≈69 unaudited) was an
honest text grep and said so. This run replaced it with a real enumeration:
a temporary vitest harness imported `UNIVERSAL_CATALOG` and dumped every entry's
`description`, `constraints`, `tutoring` block, `aiDirectives`, `evalModes` and
`supportsEvaluation` to JSON; components were resolved per entry and scanned.
Harness deleted after the dump (it was a census tool, not a test).

**Enumeration:**

| | Count |
|---|---|
| Catalog entries (live `UNIVERSAL_CATALOG`) | **196** |
| K-CLAIMED — text explicitly names K / kindergarten / a `K-n` range | 100 |
| NO-GRADE-STATED — no grade token at all, so nothing stops the curator | 18 |
| **K-selectable (K-CLAIMED + NO-GRADE-STATED)** | **118** |
| GRADE-ABOVE-K — states a range starting above K | 73 |
| Already carries an explicit `BAND FLOOR` / Grade-1+ exclusion | 5 |
| K-selectable **with** reader-fit evidence (report or `*.reader-fit.test.*`) | 28 |
| **K-selectable and NEVER reader-fit audited** | **90** |

The count came in **higher** than the estimate (90 vs ≈69), not lower — mainly
the 18 NO-GRADE-STATED entries, which the earlier grep could not see and which
are genuinely K-selectable: nothing in their text stops the curator.

**Two corrections to the `/pm` estimate, both making it less alarming, recorded
so the next session does not re-raise them:**

- `stoichiometry-lab` and `gas-laws-simulator` were named as "routable into a
  Kindergarten lesson today." Not really. Their `constraints` say **"Best for
  grades 8-12"** outright. They matched a K proxy only because each description
  brags about closing a *"K-8 → HS gap."* Real but mild; **not** top-band.
- `story-talk` scored 7 on the raw risk proxy and is a **false positive** — it is
  the PRE *reference model*. It has no catalog `tutoring` block but drives the
  read-aloud from component `useLuminaAI` + `sendText`. It is the negative
  control that proved the channel test below discriminates.

## The finding: 26 K-claiming primitives are structurally MUTE to a non-reader

The PRE band contract's rule #1 is *"Audio is the instruction channel."* The test
for whether that channel exists is two-part, because either half suffices —
StoryTalk (catalog block absent, component `sendText` present) is the proof:

1. a catalog `tutoring` block, **or**
2. `useLuminaAI` / `sendText(` in the component.

**26 K-claiming primitives have NEITHER.** Verified at the mechanism, not by
proxy — `backend/app/api/endpoints/lumina_tutor.py:385`:

```python
if not tutoring_scaffold:
    return base + "\nNo specific scaffolding instructions for this primitive type."
```

So for all 26, the entire primitive-specific system prompt the tutor receives is:

```
**CURRENT PRIMITIVE: telescope-simulator**
Grade Level: K-6

No specific scaffolding instructions for this primitive type.
```

No task description, no runtime state, no `aiDirectives`, no scaffolding levels,
no struggle responses — and the component never sends it anything either. The
tutor cannot ORIENT, cannot read a stimulus, cannot disambiguate, cannot respond
to a stall. **This fails Audit A and Audit B before a single string is read**,
for every one of them, at every eval mode. 20 of the 26 make an *explicit*
K-progression promise in `constraints` (`"K: binoculars, 3-4 bright objects…"`).

No per-primitive judgment call is needed to establish the failure. Judgment is
only needed for the *fix*, which is where they split.

## Ownership — 11 of the 26 are already queued; do NOT re-file them

`qa/engineering-tutoring-scaffold/BACKLOG.md` **Phase A** (opened 2026-07-21)
already owns the identical defect for engineering, with `/add-tutoring-scaffold`
named as executor and a pilot-then-sweep rule: `lever-lab`,
`pulley-system-builder`, `ramp-lab`, `wheel-axle-explorer`, `gear-train-builder`,
`bridge-builder`, `tower-stacker`, `shape-strength-tester`, `foundation-builder`,
`dump-truck-loader`, `blueprint-canvas` (+ `machine-profile`, which has a block
but no channel). That queue independently reached the same conclusion from the
read-aloud side. **This sweep confirms it and adds nothing to it.**

## The re-seeded queue — 15 unowned, no-channel, K-claiming primitives

Every one also carries **0 eval modes** (except `story-planner`, 4), so this is
the same set as the queued **BIO-2** density deficit. Reader-fit (CLAUDE.md #1)
and density (CLAUDE.md #3) converge on one slice per primitive, in one catalog
file — the same convergence WORKSTREAMS recorded for DNA-1/BIO-2.

Split by the verdict the fix belongs to. **Class A is cheaper and should go
first** — a band floor removes the failure with no component work.

### Class A — WRONG-BAND: the K claim is aspirational; floor it

The interaction is not completable at K under *any* scaffold. Fix = catalog
`BAND FLOOR` (the `word-sorter` / `protein-folder` pattern), which also makes the
primitive unselectable at K rather than merely quieter.

| # | Primitive | Why K is not real | Risk |
|---|---|---|---|
| S1 | `telescope-simulator` | drag-to-aim + zoom **slider** + telescope-type switching + observation **journal**; claims *"K: binoculars, 3-4 bright objects, 1-2 easy targets to find"* | **11 (top)** |
| S2 | `orbit-mechanics-lab` | prograde/retrograde burns, apogee/perigee markers; claims K = *"things go around and around"* over a live D3 physics sandbox | 9 |
| S3 | `rocket-builder` | stage stacking, thrust-to-weight, fuel gauges; claims K = *"rockets have parts"* | 8 |
| S4 | `story-planner` | *"students fill structured cards"* = **typing** at K (PRE contract rule 6); claims K-6 | 8 |
| S5 | `bio-compare-contrast` | drag **text attributes** into Venn regions; K-2 explicitly named | 8 |
| S6 | `species-profile` | taxonomy/classification prose display, adult vocabulary | 8 |
| S7 | `mission-planner` | multi-step planning UI with typed inputs | 4 |

### Class B — SCAFFOLD-GAP: the interaction IS K-fit, the voice is missing

Tap/drag physical objects; a non-reader could do these if anyone told them what
to do. Fix = `/add-tutoring-scaffold` (catalog block + channel), then
`/reader-fit --fix` for the read-aloud beat — the Phase A ladder exactly.

| # | Primitive | K interaction | Risk |
|---|---|---|---|
| S8 | `moon-phases-lab` | K = `from_earth` view only, *"Moon looks different on different nights"*, drag the Moon | 8 |
| S9 | `classification-sorter` | tap/drag creatures into groups | 6 |
| S10 | `day-night-seasons` | rotate the Earth, watch the light | 6 |
| S11 | `solar-system-explorer` | tap planets | 6 |
| S12 | `scale-comparator` | compare two objects visually | 6 |
| S13 | `life-cycle-sequencer` | order picture cards | 3 |
| S14 | `habitat-diorama` | place animals in a habitat | 3 |
| S15 | `organism-card` | picture card display | 3 |

**Pull order:** S1 as the pilot (top risk, explicit K promise, and it establishes
the astronomy band-floor template that S2/S3 reuse), then S2–S7 as Class A is
mechanical once the pattern is proven, then Class B via `/add-tutoring-scaffold`
under pilot-then-sweep. Serial, one primitive per slice, per the 08-05 ruling.

## The remaining ~64 — deliberately NOT queued

The other unaudited K-selectable entries have at least one channel, so they need
real per-primitive audits rather than a class fix. They stay unqueued on purpose:
per the 08-03 ruling, **QA is a gate, not a census** — this sweep emits the
verified class it found and its owner, not a standing 90-row backlog. The ranked
table exists in this report if a future session wants to pull from it.

## Artifacts

- Ranked triage over all 196 entries + per-entry signals: reproduced by the
  method above (harness deleted; `qa/reader-fit/BACKLOG.md` item 15 carries the
  queue).
- Mechanism proof: `backend/app/api/endpoints/lumina_tutor.py:385`.
- Overlapping owner: `qa/engineering-tutoring-scaffold/BACKLOG.md` Phase A.
