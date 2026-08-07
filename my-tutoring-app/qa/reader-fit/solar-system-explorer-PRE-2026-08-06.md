# Reader Fit: solar-system-explorer @ PRE — 2026-08-06

Item **15B / S11** of the reader-fit supply-side sweep.

Modes audited: free exploration | Probes: eval-test ✓ @ K · tutor-test Tier 1 ✓ ·
jsdom render ✓ | Live audio: NOT run (see residuals)

## Verdict

**Overall: READY at PRE.** The interaction the triage named — *"tap planets"* —
really is K-fit, and this is the first slice where the generator's **happy path
was already correct at K**. What surrounded the tap was not.

---

## Finding 1 — SCAFFOLD-GAP (queued). Fix: CATALOG + COMPONENT.

No `tutoring` block, no `useLuminaAI`. Added a catalog block (8 contextKeys,
3 levels, 5 struggles, 2 aiDirectives) + 3 moments: `[SOLAR_ORIENT]`,
`[SOLAR_BODY_SELECTED]`, `[SOLAR_READ_ALOUD]`.

Two scaffold decisions worth naming:

**1. A hard no-measurements rule at PRE.** This primitive's detail card is six
numeric cells — `1.52 AU`, `6,371 km`, `687 days`, `24.6 hrs`, `-63 °C`,
`2 moons`. The directive forbids the tutor from speaking *any* of them to a
pre-reader and supplies the replacement register: *"the biggest one"*, *"really
really hot"*, *"it takes a long time to go around"*. The ORIENT message carries
the same clause, and drops it at 3-5 where the numbers are the point (asserted
both ways by test).

**2. A `SCALE HONESTY` directive.** The model cannot show size and distance
truthfully at the same time — the catalog itself calls this out as a teaching
point. Two of the five `commonStruggles` are the misconceptions the *layout
itself invites* (the planets look lined up; they look close together), so the
tutor names the trade-off rather than letting the picture teach something false.

## Finding 2 — GRADE-BLINDNESS ON THE DEGRADE PATH. Fix: GENERATOR.

This one is different from S8/S10 and is the reason "probe, don't grep" earns
its keep. The probe at `grade=K` came back **correct**: `gradeLevel:'K'`,
`initialZoom:'inner'`, 5 bodies, distances and habitable zone off. The happy
path is fine because the prompt carries the audience in prose — which is the one
place prose belongs.

The defect is in the fallback:

```ts
const gradeLevel = ctx.gradeContext;          // PROSE
…
data.bodies = getDefaultBodies(gradeLevel);   // :489
…
if (gradeLevel === 'K' || gradeLevel === '1' || gradeLevel === '2') {  // :690
  return [sun, ...innerPlanets];              // UNREACHABLE
}
return [sun, ...innerPlanets, ...outerPlanets];
```

Prose never equals `'K'`, so the K-2 branch could never be taken and a
Kindergartener fell back to **all eight planets** instead of the inner four —
firing only when Gemini returned no bodies, i.e. exactly when the lesson was
already degraded and least able to absorb it.

This is the `matter-explorer` shape from
[[feedback_value-origin-not-code-touch]]: an **inline** resolver that a
named-resolver grep does not see. It also would not have shown up in any
happy-path probe. Fixed by introducing `solarSystemGradeFromGrade()` and passing
a canonical `gradeRung` to `getDefaultBodies`, while `gradeLevel` stays prose and
stays in the prompt where it belongs.

## Finding 3 — PRIMITIVE-GAP, not in the triage. Fix: COMPONENT.

At K the tap was surrounded by:

| Offender | Rule |
|---|---|
| `Scroll to Zoom • Drag to Pan • Click Planets` (12px, 3 clauses) | 1 — the one string a non-reader most needs |
| 3 display checkboxes (Orbits / Labels / Distances) | 7 |
| Scale `<select>` (Hybrid / Size Accurate / Distance Accurate) | 7 |
| Speed slider (raw 100–20000 multiplier) | 7 |
| Calendar date (`Aug 7, 2026`) | 7 |
| 6-cell stat grid (AU, km, days, hrs, °C, moons) | 7 |

All gated off at K-1, all kept at 3-5. The planet story survives at K as the
description plus a `lg` read-aloud — the child still gets the content, by voice.

### A defect the test caught, not the review

The stat grid was first gated with Tailwind `hidden`. The jsdom test failed on
`Distance from Sun` still being findable — correctly, because **CSS-hidden is
not gone**: the text stays in the DOM and stays reachable by assistive tech.
Changed to a conditional render. Worth remembering for the remaining slices:
`className="hidden"` does not satisfy rule 7.

---

## Audit A — text census (K rung)

| String | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| body description + funFact | detail card | load-bearing | 🔊 (`lg`) + `[SOLAR_BODY_SELECTED]` | COVERED |
| planet names | SVG labels | load-bearing | spoken on tap; named in ORIENT | COVERED |
| "Scroll to Zoom • Drag to Pan • Click Planets" | overlay | load-bearing | `[SOLAR_ORIENT]` | REMOVED at K-1, covered by voice |
| Orbits / Labels / Distances / Scale | controls | chrome | — | REMOVED at K-1 |
| "Speed:" + slider, calendar date | controls | chrome | — | REMOVED at K-1 |
| AU / km / days / hrs / °C / moons | stat grid | chrome | — | REMOVED at K-1 (and unspeakable by directive) |
| body `type` badge ("dwarf planet") | detail card | supportive | — | kept (short, decorative at K) |

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| explore | ✅ `[SOLAR_ORIENT]` on mount, names the bodies | ✅ every tapped body voiced + 🔊 for the full card | ✅ ORIENT states the task ("tap one to hear about it") | ✅ selection highlights the tapped body instantly | ✅ 5 struggles incl. both scale misconceptions + a pre-reader clause |

## Audit C — band contract (PRE)

| Rule | PASS/FAIL | Note |
|---|---|---|
| 1 Audio is the instruction channel | PASS | **was FAIL** — the protocol lived only in 12px text |
| 2 Tap = choose | PASS | tapping a planet is atomic and always was |
| 3 Pictures are the answer surface | PASS | the orrery itself |
| 4 One thing to do per screen | PASS | **was borderline** — 6 controls + the sim; now the sim + play/pause |
| 5 Feedback on the touched object | PASS | tapped body highlights and opens its card |
| 6 No typing | PASS | none anywhere |
| 7 No adult chrome | PASS | **was FAIL** — six categories of it, listed above |
| 8 Assessment in the mechanics | N/A | free-exploration primitive, no evaluation hook at all — see residuals |

---

## Gates

| Gate | Result |
|---|---|
| Focused tests | `gemini-solar-system-explorer.reader-fit.test.ts` **12/12** |
| jsdom render test | `SolarSystemExplorer.reader-fit.test.tsx` **13/13** |
| **Revert-bite (PRE gate)** | **5/13 fail** with `isPreReader = false` |
| `tsc --noEmit` (src-scoped) | **803 = baseline, zero new** |
| `typecheck:lumina` | 0 errors |
| Full vitest | **1903/1903** |
| tutor-test Tier 1 | `pass`, 0 findings, 3 tags |

### Runtime

Probe @ `grade=K`: `gradeLevel:'K'`, `initialZoom:'inner'`, `scaleMode:'hybrid'`,
5 bodies, `showDistances:false`, `showHabitableZone:false` — already correct
before the fix and unchanged after it. **The generator fix is on the degrade
path, which a probe cannot reach**; it is covered by the focused test instead.
That asymmetry is the finding, not a gap in the evidence.

---

## Residuals (open)

- **No Tier-3 live audio run.** Folded into HUMAN-CHECKS #73.
- **No evaluation hook at all.** This primitive has no `usePrimitiveEvaluation`,
  no eval props and no `supportsEvaluation` path in the component — it is pure
  exploration, so rule 8 is N/A rather than passing. If K astronomy demand wants
  a *measured* solar-system activity, `planetary-explorer` already exists for
  that; this one should probably stay an instrument. Not queued as a fix.
- **0 eval modes** — `/add-eval-modes` is a separate layer.
- **`instanceId` added to the data interface.** It was absent, so the tutor
  session had nothing to scope to. Auto-injected by `ManifestOrderRenderer` like
  every other primitive; typed here for the first time.
