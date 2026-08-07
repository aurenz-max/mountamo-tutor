# Reader Fit: day-night-seasons @ PRE — 2026-08-06

Item **15B / S10** of the reader-fit supply-side sweep.

Modes audited: single explore flow | Probes: eval-test ✓ (K + G4 control) ·
tutor-test Tier 1 ✓ · jsdom render ✓ | Live audio: NOT run (see residuals)

## Verdict

**Overall: READY at PRE.** Like S9, the queued verdict was **incomplete**: the
triage called this SCAFFOLD-GAP ("rotate the Earth, watch the light", risk 6).
The voice was missing — but the only assessment on screen was a **free-text box
at Kindergarten**, a hard PRE contract rule 6 failure.

---

## Finding 1 — SCAFFOLD-GAP (queued). Fix: CATALOG + COMPONENT.

No `tutoring` block, no `useLuminaAI`. Added a catalog block (9 contextKeys,
3 levels, 5 struggles, 3 aiDirectives) + 4 component moments: `[EARTH_ORIENT]`,
`[EARTH_LOCATION_SELECTED]`, `[EARTH_READ_ALOUD]`, `[EARTH_ALL_COMPLETE]`.

`commonStruggles` leads with the **two** misconceptions this primitive exists to
correct, both of which the component's own explanation panel names and neither
of which anything had ever spoken:
- *"the Sun moves across the sky"* → anchored on "we are the ones moving"
- *"seasons come from distance to the Sun"* → anchored on the tilt

A dedicated `THE TILT, NOT THE DISTANCE` directive forbids the words "closer"
and "farther" as a cause **even as a thing to reject in passing** — a young
child keeps the phrase and loses the correction.

## Finding 2 — PRIMITIVE-GAP, NOT in the triage. Fix: COMPONENT.

At K the screen carried:

```jsx
<input type="text" placeholder="Type your answer..." />   // rule 6: NO TYPING
<select>🗽 New York (40°N) …</select>                      // rule 2 / 7
"Earth Rotation: 137°"                                     // rule 7
"☀️ Daylight Hours / 12 hours"                             // rule 7
```

Worse than unusable — **the typed box was the entire assessment, and it scored
any non-empty string as correct**. A K child who cannot type scored 0; a child
who typed "aaa" scored 100. It measured nothing at either end.

**Fixed:**
- **Typing removed at K-1.** The objectives still render (they are good
  questions) but as a spoken prompt with a 🔊, not an input. Kept verbatim at 3-5.
- **Scoring moved to the instrument** (rule 8, "assessment hides in the
  mechanics"): did they spin the Earth, run the animation, and observe more than
  one place. This is *stricter* at K than what it replaced, not softer.
- `<select>` → big tappable place buttons at K-1 (emoji face, name as
  `aria-label`, spoken by the tutor). Kept at 3-5.
- Degree readout and hours card gated off at K-1.

### A bug found by writing the test, not by reading the code

First implementation computed "places observed" as
`new Set([selectedLocation, ...tappedPlaces])`. Selecting a place **replaces**
`selectedLocation`, so after tapping the second marker the set collapsed back to
size 1 and the third signal could never be earned. The jsdom test caught it as a
66% score; a debug run showed all three signals were in fact recorded and the
set was the liar. Now accumulated in `observedPlacesRef`, seeded with the marker
shown at mount and cleared on retry.

The `locationsExplored` **metric** deliberately stays tap-only, so a passive
student is not credited with an exploration they never made — the instrument
score and the analytics metric answer different questions.

## Finding 3 — GRADE-BLIND GENERATOR (predicted, confirmed by probe). Fix: GENERATOR.

The worst offender in the astronomy prose-grade table: **13** single-char
comparisons against a prose string, **0** reads of `ctx.grade`.

```ts
const gradeLevel = config?.gradeLevel
  || (gradeContext.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '3') as ...
```

Probe at `grade=K` **before** the fix returned `gradeLevel:'3'`,
`showTiltAxis:true`, **4** location markers, **3** objectives, `timeSpeed:5` —
against a catalog K rung reading *"no tilt axis shown, 2-3 familiar locations,
1-2 simple questions, fast animation (8x speed)"*. **Every K rung violated.**

Fixed with the S8 template: exported `dayNightGradeFromGrade()`, canonical-first,
prose kept as fallback, **no floor**.

## Deliberately NOT shipped — the day/night flip narration

The catalog originally carried a `[EARTH_DAY_NIGHT_FLIP]` directive: narrate
when the watched place crosses between day and night. **Not shipped**, because
whether a marker is lit depends on angle conventions in the D3 terminator math
that I could not confirm visually this session — and a tutor confidently saying
*"now it's night in New York"* over a screen showing daylight is worse than
silence.

What shipped instead: `isDaytimeAtMarker` is derived from the **same two
expressions the renderer uses for the terminator** (`angleToSun`,
`terminatorAngle`) and the **same projection the markers use**, in the same
rotated frame — so it cannot drift from the shadow that is actually drawn — and
it is reported through `[EARTH_LOCATION_SELECTED]` when the child *chooses* a
place, a moment that is verifiable in jsdom. `tutor-test` caught the now-dead
directive tag (`directive-tag-never-emitted` WARN) and it was rewritten to match
the tag actually emitted.

**This still needs one pair of eyes** — see residuals. Consistency with the
drawing code is strong evidence, not proof that my convention matches what a
human reads as "day".

---

## Audit A — text census (K rung)

| String | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| title + description | header | load-bearing | 🔊 + `[EARTH_ORIENT]` | COVERED |
| learningObjectives | questions | load-bearing | 🔊 "Read these questions to me" | COVERED |
| location names in `<select>` | controls | load-bearing | replaced by emoji buttons; name via `aria-label` + `[EARTH_LOCATION_SELECTED]` | COVERED |
| "Earth Rotation: 137°" | slider label | chrome | — | REMOVED at K-1 |
| "☀️ Daylight Hours / 12 hours" | stat card | chrome | — | REMOVED at K-1 |
| "Animation Controls", "Location Data" | panel headers | chrome | — | REMOVED at K-1 (emoji kept) |
| "Play Animation" | button | chrome | — | glyph-only at K-1, `aria-label` kept |
| `placeholder="Type your answer..."` | input | **rule-6 fail** | — | REMOVED at K-1 |

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| explore | ✅ `[EARTH_ORIENT]` on mount | ✅ header + questions read aloud; place named on choose | ✅ ORIENT states the task ("spin it, watch the dark part") | ✅ the terminator moves under their finger — instant, on the object | ✅ 5 struggles covering both misconceptions + a pre-reader clause |

## Audit C — band contract (PRE)

| Rule | PASS/FAIL | Note |
|---|---|---|
| 1 Audio is the instruction channel | PASS | ORIENT unprompted; no text gates progress |
| 2 Tap = choose | PASS | **was FAIL** — `<select>`; now tappable place buttons |
| 3 Pictures are the answer surface | PASS | the Earth itself; places are emoji |
| 4 One thing to do per screen | PASS | at K, focusMode is `day-night`, so the seasons panels, sun-angle diagrams and hemisphere cards never render |
| 5 Feedback on the touched object | PASS | terminator moves live with the slider |
| 6 No typing | PASS | **was FAIL** — free-text box removed at K-1 |
| 7 No adult chrome | PASS | **was FAIL** — degree readout, hours card, panel titles gated |
| 8 Assessment in the mechanics | PASS | **was FAIL** — scored a typed string; now scores the instrument |

---

## Gates

| Gate | Result |
|---|---|
| Focused tests | `gemini-day-night-seasons.reader-fit.test.ts` **12/12** |
| jsdom render test | `DayNightSeasons.reader-fit.test.tsx` **13/13** |
| **Revert-bite (both)** | **12/25 fail** with the prose regex and `isPreReader=false` restored |
| `tsc --noEmit` (src-scoped) | **803 = baseline, zero new** |
| `typecheck:lumina` | 0 errors |
| Full vitest | **1878/1878** |
| tutor-test Tier 1 | `pass`, 0 findings (after fixing the dead directive it caught) |

### Runtime A/B

| | pre-fix @ K | post-fix @ K | G4 control |
|---|---|---|---|
| `gradeLevel` | `'3'` ❌ | **`'K'`** | `'4'` |
| `showTiltAxis` | `true` ❌ | **`false`** | `true` |
| `markerLatitudes` | 4 ❌ | **2** | 4 |
| `learningObjectives` | 3 ❌ | **2** | 3 |
| `timeSpeed` | 5 ❌ | **8** | 4 |
| `showTemperatureZones` | false | false | **true** |

Every K rung now matches the catalog, and G4 gains what K loses — the ladder is
intact, not flattened.

---

## Residuals (open)

- **The day/night reading needs one visual confirmation.** Tap a place on the
  night side and check the tutor agrees with the picture. Added to
  HUMAN-CHECKS #73. If the convention is inverted, the fix is one `!` in
  `isDaytimeAtMarker` — but it must be *seen*, not reasoned about.
- **No Tier-3 live audio run.** Same sitting.
- **0 eval modes** — `/add-eval-modes` is a separate layer.
- **`showDaylightHours` is still generated `true` at K** even though the card is
  now gated off in the component. Harmless (nothing reads it at K) but the
  generator's K rung could set it false for honesty. Not worth its own slice;
  fold into `/add-eval-modes` if that runs.
