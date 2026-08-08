# Reader Fit: mission-planner @ PRE — 2026-08-07

Item **15A / S7** — the last 15A item. Worked under
[[feedback_make-age-friendly-not-band-floor]].

Probes: eval-test ✓ (K + G4, pre- and post-fix) · tutor-test Tier 1 ✓ + Tier 2
`--probe` ✓ · **real Chrome drive ✓** (K and G4) · live audio ✗ (→ HUMAN-CHECKS).

**Overall: SCAFFOLD-GAP + GRADE-BLINDNESS → now READY at PRE.**
Unusually for this sweep, the component needed almost no band-gating work — it was
already thoroughly band-aware. What it had was **no voice**, and **a rung it could
not trust**.

---

## The headline: the defect bit at GRADE 4, not at K

The sweep's standing advice is *"probe the neighbouring grade, not just K"*
(from S2). Here it paid off in the other direction — **K was already correct and
Grade 4 was broken.**

`?componentId=mission-planner&grade=4&gradeLevel=fourth grade` returned
**`gradeLevel: '1'`**. `MissionPlanner.tsx` band-gates on `data.gradeLevel` in a
dozen places (`PHASE_INSTRUCTIONS[phase][gradeLevel]`, the K destination copy, the
travel-time formatter), so **a Grade 4 student was served the Grade 1 screen.**

| | K PRE | K POST | **G4 PRE** | **G4 POST** |
|---|---|---|---|---|
| `gradeLevel` | `K` | `K` | **`1`** | **`4`** |
| `missionType` | flyby | flyby | **flyby** | **return** |
| `supplyCalculator` | false | false | **false** | **true** |
| `showLaunchWindows` | false | false | **false** | **true** |
| `gravityAssistOption` | false | false | **false** | **true** |
| `crewed` | false | false | **false** | **true** |
| destinations | 2 | 2 | **3** | **4** |

The entire Grade-4 rung the catalog promises — *"gravity assists give speed boosts
from planets"*, `missionType: "return"`, supplies, launch windows — **did not
exist at Grade 4.** K is unchanged, as a control.

---

## Three grade defects — the S2 triple, all present

1. **Prose grade.** `const gradeLevel = ctx.gradeContext` (`:252`), against the
   explicit `generationContext.ts` contract. The prose then fed a dozen
   comparisons and three lookup maps.
2. **Lexical compare that survives a correct resolver.** `gradeLevel >= '2'` is
   **TRUE for `'K'`** — `'K'` (0x4B) sorts above `'2'` (0x32). So making the
   resolver canonical *without* this would have switched the supply calculator
   and a crewed mission **ON at Kindergarten**. A grep for the resolver finds
   only defect 1. Now ordinal via `missionRungIndex()` (K = 0).
   **Revert-bitten, so this is genuinely the S2 case and not the S3 one.**
3. **The rung was never stamped.** `gradeLevel` is in the response schema, so
   Gemini fills it — and got it wrong. Now overridden by the resolved value
   (config still wins).

**Honest correction, in the S3 tradition.** The same rewrite also touched
`showTrajectory = gradeLevel !== 'K'` and `missionClock = gradeLevel !== 'K'`.
Those were framed as part of the lexical bug. **They are not** — once the rung is
canonical, `!== 'K'` and `rung >= 1` are equivalent, and the revert-bite proved it
(**0 failures**). Only the `>=` / `<=` comparisons were broken. Reported rather
than quietly counted as a fix.

---

## Audit A — text census

Pre-fix there was **no channel at all** (no catalog `tutoring`, no `useLuminaAI`),
so `lumina_tutor.py:385` handed the model the literal string *"No specific
scaffolding instructions for this primitive type."* Every load-bearing string was
UNCOVERED.

| String | Class | Spoken twin (post-fix) | Verdict |
|---|---|---|---|
| `PHASE_INSTRUCTIONS[phase][gradeLevel]` — "Pick a place in space you want to visit!" | **load-bearing** — it is the entire task statement, and it CHANGES silently when the phase advances | `LuminaReadAloud` at K-1 + `[MISSION_PHASE_CHANGED]` fires on every phase change | COVERED |
| Destination names ("The Moon", "Mars") | **load-bearing** — they are the choices | `[MISSION_DESTINATION_SELECTED]` says the name + one picturable thing | COVERED |
| "🪐 Where do you want to go?" heading | supportive | `[MISSION_ORIENT]` | COVERED |
| `Travel time: ~N days` | — | — | already hidden at K by the component |

The phase-instruction beat is the important one: the line is the only statement of
what to do, and **a non-reader cannot see that it changed** when a phase advances.

---

## Audit B — sufficiency contract

| ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|
| PASS — fires once, names the task | PASS — the instruction line is spoken at K-1 and re-spoken on every phase change | PASS — the orient beat states the act ("choose a place to fly to") | PASS — the chosen destination is named back | PASS — 5 struggles, incl. two real misconceptions (space travel is instant; ships fly in straight lines to planets) |

**The answer discipline here is inverted and had to be written carefully.**
Choosing a destination is a **CHOICE, not an answer** — so the directive forbids
implying one is correct, forbids "are you sure?" about a valid pick, and forbids
steering to the Moon because it is the easy trip. But the launch-window phase at
grade 3+ **does** have a right answer (which window uses least fuel), so the same
directive protects it explicitly, including against elimination. Getting only one
half of that right would have produced either a tutor that invents a wrong answer
or one that gives away a real one.

---

## Audit C — band contract (K)

| Rule | Pre | Post | Note |
|---|---|---|---|
| 1 Audio is the instruction channel | **FAIL** | PASS | no channel existed |
| 2 Tap = choose | PASS | PASS | destination cards were already one-tap |
| 3 Pictures are the answer surface | PARTIAL | PARTIAL | destination cards are name + description text beside a D3 map; no per-destination image |
| 4 One thing per screen | PASS | PASS | K has 2 destinations and one phase |
| 5 Feedback | PASS | PASS | the ship flies; now also named aloud |
| 6 No typing | PASS | PASS | — |
| 7 No adult chrome | PASS | PASS | **already gated** — travel times, supplies, launch windows and the clock are all off at K |
| 8 Assessment in mechanics | PASS | PASS | `supportsEvaluation: true`, mission completion |

**This is the first 15A slice where Audit C came out mostly clean pre-fix.** The
component was written band-aware from the start (the S14 shape) — but unlike S14,
its gates were *running*, because Gemini happened to echo `'K'` correctly at
Kindergarten. They were failing silently at Grade 4 instead.

---

## Gates

- **30 focused tests** (20 generator/catalog + 10 jsdom), **11 revert-bites, 10 bite**
  (8/3/1/2/2/3/2/1/1/1) **+ 1 documented no-op** (the `!== 'K'` rewrite above,
  reported rather than dropped). One bite initially failed to bite because the
  silence test only covered mount-time beats — strengthened to click read-aloud
  and a destination, after which it bites.
- **src-scoped tsc 803 = baseline, set-identical.**
- `typecheck:lumina` **0**.
- Full vitest **2278/2278** (2248 + exactly 30).
- `tutor-test` Tier 1 `pass` · Tier 2 `findings: []`, `dataBagDynamic: false`,
  **8/8 contextKeys resolve**, 4 tags emitted, **zero `(not set)`**.
- **Runtime A/B** as tabulated above — G4 transformed, K unchanged as control.
- **Real-Chrome drive.** K: correct K instruction line, 1 read-aloud button, 2
  destination cards, **no travel-time leak**, 0 nested buttons, destination tap
  works. G4: correct G4 instruction, K copy gone, **0 read-aloud** (correctly not
  offered), travel times shown, 4 destination cards. **Zero console errors.**

---

## Residuals — stated, not buried

- **No Tier-3 live audio run.** → HUMAN-CHECKS. The `[MISSION_PHASE_CHANGED]` beat
  is the one that most needs hearing: it must fire *and* be brief enough not to
  talk over a child already tapping.
- **Rule 3 stays PARTIAL** — destination cards are text beside a D3 map. Real
  planet images (or even emoji) would make the K choice picture-primary; the
  generator already emits per-destination `color` and `radiusPx` but no image.
- **A prose-grade sibling remains in the same file family.** This slice fixed
  `gemini-mission-planner.ts` only. The 08-06 handoff measured the astronomy
  domain as **10 generators out of 10** violating the "never parse grade out of
  `gradeContext`" contract; S1, S2, S3, S8, S10, S11, S12 and now S7 are done,
  which leaves `planetary-explorer` and `constellation-builder` — **already the
  next ranked item on the frontier**, and both now carry redirected K astronomy
  demand.
- **The `funFact` and `hints` fields are generated but unvoiced at K** — they are
  in the data bag for the tutor but no moment fires on them. Deliberate: the
  quiet-tutor doctrine says frame once, then be silent, and hints already have a
  student-initiated button at 3+.
- **Dev-server note (2nd occurrence this session):** adding a route to a running
  Next dev server makes it 404 its own client chunks, so the page renders but
  never hydrates and looks like a component failure. A restart fixes it. Cost real
  time twice; worth knowing before diagnosing a "broken" probe page.
