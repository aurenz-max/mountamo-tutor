# Reader Fit: moon-phases-lab @ PRE — 2026-08-06

Item **15B / S8** of the reader-fit supply-side sweep — the FIRST Class-B
(SCAFFOLD-GAP) slice, and the pilot for the remaining seven (S9–S15).

Modes audited: none declared (0 eval modes — see residuals) | Probes:
eval-test ✓ (K + G3 control) · tutor-test Tier 1 ✓ · tutor-test `--probe` @ K ✓ ·
jsdom render ✓ | Live audio: NOT run (see residuals)

## Verdict

**Overall: READY at PRE** — a non-reader is now oriented by voice, every
load-bearing string has a spoken twin, and the adult chrome is gone at K-1.

Two defects were closed in this slice. The second was NOT in the queue and is
the reason the first would otherwise have shipped inert.

---

## Finding 1 — SCAFFOLD-GAP (the queued one). Fix: CATALOG + COMPONENT.

`moon-phases-lab` had **no `tutoring` block and no `useLuminaAI` channel**, so
`backend/app/api/endpoints/lumina_tutor.py:385` fired:

```python
if not tutoring_scaffold:
    return base + "\nNo specific scaffolding instructions for this primitive type."
```

Reproduced pre-fix at the mechanism:

```
GET /api/lumina/tutor-test?componentId=moon-phases-lab
{"status":"no-scaffold", "error":"... has no tutoring block — it runs on the
 generic tutor (L0/L1). Add one via /add-tutoring-scaffold, then re-run."}
```

The interaction itself is genuinely K-fit (drag the Moon, watch it change) —
this was only ever a missing voice, exactly as the triage classified it.

**Fixed:**
- Catalog `tutoring` block (`catalog/astronomy.ts`): taskDescription, 11
  contextKeys, 3 scaffolding levels, **5 commonStruggles**, 3 aiDirectives.
- `commonStruggles` leads with the primitive's own stated critical
  misconception — *"phases are Earth's shadow"* — which the component's
  explanation panel names but nothing had ever spoken.
- `aiDirectives`:
  - **PRE-READER READ-ALOUD** — carries `[MOON_ORIENT]` + `[MOON_READ_ALOUD]`
    and says *"this OVERRIDES any instruction to keep it to one sentence"*, so
    the beat survives the lesson `[PRIMITIVE SWITCH]` cap (SKILL Phase 5 Tier 1).
  - **PHASE NARRATION** — one sentence, no question, never narrates a moving Moon.
  - **CHALLENGE ANSWER DISCIPLINE** — the target phase is the QUESTION and may be
    spoken; the orbit position/degree/button never may.
- Component: `useLuminaAI` + a memoized `aiPrimitiveData` bag, and 5 moments —
  `[MOON_ORIENT]` (mount), `[MOON_PHASE_SETTLED]`, `[MOON_CHALLENGE_PICK]`,
  `[MOON_ALL_COMPLETE]`, `[MOON_READ_ALOUD]`.

**Quiet-by-default honored:** `[MOON_PHASE_SETTLED]` is debounced 900 ms and
suppressed while the animation runs — dragging sweeps all 8 phases in a second,
and a per-degree narrator would be exactly the overbearing tutor the doctrine
forbids. The ORIENT beat is the frame; the rest is silence until they stop.

### `tagged-sendtext-not-silent` — worth recording

The first Tier-1 run returned **HIGH** on `[MOON_READ_ALOUD]`, which I had
written non-silent on the theory that a read-aloud must "take a turn."
Checked at the mechanism (`LuminaAIContext.tsx:930-953`): `silent` suppresses
**only** the chat-transcript entry, the metrics bump and `isAIResponding`. The
socket payload is byte-identical, so a silent send still makes the tutor speak.
Non-silent would have posted a machine-written prompt into the conversation as
if the child had typed it. Fixed to `{ silent: true }` → Tier 1 `pass`.

> **Cross-queue note (do not fix here):** the engineering Phase-A precedent
> (`PropulsionTimeline.readBlockAloud` and its siblings) sends read-alouds
> **non-silent**, and the static checker misses it only because those calls
> interpolate the tag (`` `${tag} …` ``) instead of writing a literal `[TAG]`.
> That is a real pre-existing defect in another owner's queue —
> `qa/engineering-tutoring-scaffold/BACKLOG.md`. Filed, not touched.

---

## Finding 2 — GRADE-BLIND GENERATOR (found by the probe, not queued). Fix: GENERATOR.

The Tier-2 probe was requested at `gradeLevel=kindergarten&grade=K` and came
back describing **`"Sunlight and the Moon: Grade 3 Space Explorer"`,
`gradeLevel: "3"`, `viewMode: "split_view"`**.

Mechanism, `gemini-moon-phases-lab.ts:223` (pre-fix):

```ts
const gradeLevel = config?.gradeLevel
  || (gradeContext.match(/grade\s*(\d|K)/i)?.[1]?.toUpperCase() || '3') as ...
```

`ctx.gradeContext` is **prose** ("kindergarten students - Use age-appropriate…").
Kindergarten prose contains no "grade N", so the regex missed and the whole
expression fell through to the literal default **`'3'`**. This is the 2026-08-04
`14m` class the handoff measured on this generator (1 prose read, **10**
single-char compares, **0** reads of `ctx.grade`).

**Why this made Finding 1's fix inert:** the component's new `isPreReader` gate
keys off `data.gradeLevel`. If the generator can never emit `'K'`, the gate is
dead code and a K child still gets `split_view` + the full stat panel. Fixing
the scaffold without this would have shipped a green report and a broken child
experience — the "close the channel, not the symptom" case.

**Fixed** with the S1 template: exported `moonPhasesGradeFromGrade(grade?)`,
canonical-first, `null` when absent, with the prose resolver **kept as the
fallback, never deleted**. **No floor** — unlike telescope-simulator (S1), this
primitive is genuinely K-fit, so K must reach its own rung, not be clamped.

---

## Audit A — text census (K rung)

| String | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| title + description | header | load-bearing | `[MOON_READ_ALOUD]` (🔊, `lg` at K) | COVERED |
| phase name + description ("we see the dark side") | Earth view | load-bearing | 🔊 "Tell me about this Moon" + `[MOON_PHASE_SETTLED]` | COVERED |
| "Challenge: Find the …" + "Move the Moon to show…" | challenge | load-bearing | 🔊 + spoken in `[MOON_ORIENT]` | COVERED |
| learningObjectives ("Think About It") | questions | load-bearing | 🔊 "Read these questions to me" | COVERED |
| "Illumination / Day in Cycle / Phases Explored" | stat panel | chrome | — | REMOVED at K-1 |
| "Moon Position: 123°", "Speed: 8 days/sec" | controls | chrome | — | REMOVED at K-1 |
| phase button labels ("Waxing Crescent") | controls + challenge | load-bearing | — | REPLACED by emoji at K-1 (`aria-label` keeps the name for AT) |
| "Controls", "Jump to Phase:" | chrome | decorative | — | REMOVED at K-1 |

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| (single, undeclared) | ✅ `[MOON_ORIENT]` on mount | ✅ 4 read-aloud surfaces + settled narration | ✅ ORIENT states the challenge; CHALLENGE ANSWER DISCIPLINE keeps it look-based | ✅ the Moon picture *is* the feedback; `[MOON_PHASE_SETTLED]` names it | ✅ 5 struggles incl. the shadow misconception + an explicit pre-reader clause |

## Audit C — band contract (PRE)

| Rule | PASS/FAIL | Note |
|---|---|---|
| 1 Audio is the instruction channel | PASS | ORIENT fires unprompted; no text gates progress |
| 2 Tap = choose | PASS | tap a phase / drag the Moon; no two-tap protocol |
| 3 Pictures are the answer surface | PASS | emoji-primary options at K-1 (was `🌑 🌑`, see below) |
| 4 One thing per screen, ≤~5 elements | **PARTIAL** | 8 phase buttons + slider + play. Bounded by the 8 real phases; not primitive-local — see residuals |
| 5 Feedback on the touched object | PASS | the Moon redraws instantly on every move |
| 6 No typing | PASS | none |
| 7 No adult chrome | PASS | stat panel, degree readout, days/sec, text labels all gated off at K-1 |
| 8 Assessment in the mechanics | PASS | exploration is scored by phases visited, not a quiz |

**Incidental bug fixed:** the K/1 branch of the jump-to-phase button rendered
`{phase.emoji} {…? phase.emoji : phase.name}` — i.e. the emoji **twice**
("🌑 🌑"). Now a single large glyph at K-1, `emoji + name` at 2+. Locked by a test.

---

## Gates

| Gate | Result |
|---|---|
| Focused tests | `gemini-moon-phases-lab.reader-fit.test.ts` **12/12** |
| **Revert-bite (resolver)** | **5/12 fail** with the pre-fix prose regex restored |
| jsdom render test | `MoonPhasesLab.reader-fit.test.tsx` **15/15** |
| **Revert-bite (band gate)** | **4/15 fail** with `isPreReader = false` |
| `tsc --noEmit` | **805** = baseline (0 new) |
| `typecheck:lumina` | 0 errors |
| Full vitest | **1813/1813** (1801 + 12 new; +15 jsdom counted in the astronomy re-run) |
| tutor-test Tier 1 | `pass`, 0 findings |
| tutor-test Tier 2 `--probe` @ K | every var `resolvedBy: component`; **zero `(not set)`** |

### Runtime A/B — the gate that actually decides this

| | pre-fix @ K | post-fix @ K | G3 control |
|---|---|---|---|
| `gradeLevel` | `'3'` ❌ | **`'K'`** | `'3'` unchanged |
| `viewMode` | `split_view` ❌ | **`from_earth`** | `split_view` unchanged |
| `cycleSpeed` | 5 | **8** | 5 unchanged |
| `showOrbit` / `showSunDirection` | on ❌ | **off** | on unchanged |
| title | "…Grade 3 Space Explorer" ❌ | **"Peek-a-Boo Moon"** | "Cosmic Detective…" |
| learningObjectives | 3 | **2** (K rung) | 3 unchanged |

The G3 column is the control: the ladder was not flattened to fix K.

---

## Residuals (open, deliberately NOT closed here)

- **No live audio check.** The Tier-3 harness (`run_tutor_live.py --component
  moon-phases-lab --lesson --runs 3`) was not run. ORIENT and the read-aloud
  survive the lesson one-sentence cap *by construction* (they are aiDirectives,
  not component-only clauses), but that is an argument, not evidence.
  → HUMAN-CHECKS.
- **0 eval modes.** This primitive still has no `evalModes` — `/add-eval-modes`
  (L1) is a separate layer and was not in 15B's scope.
- **Band contract rule 4** (8 simultaneous phase buttons at K) is the shared
  K-stage presentation problem, not a primitive-local one. Recorded per the
  SKILL's instruction to keep accumulating the stage-mode case; not forked here.
- **The other 9 astronomy generators still have the prose-grade defect**
  (handoff table: day-night-seasons 13 compares, mission-planner 7,
  scale-comparator 7, orbit-mechanics-lab 4, solar-system-explorer 1). S10, S11
  and S12 are all in 15B and will each need this same second fix — assume it,
  and probe rather than grep.
