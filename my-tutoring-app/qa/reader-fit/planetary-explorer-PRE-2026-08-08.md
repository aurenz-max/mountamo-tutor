# Reader Fit: planetary-explorer @ PRE — 2026-08-08

Item 16 / slice 2 (of 2) — **item 16 CLOSES 2/2**. Executor `/reader-fit --fix`.
Baseline HEAD `ea5f60b` (slice 1, constellation-builder).

Modes audited: `explore` (the K-routed mode) primary; `identify`/`compare`/`apply`
assessed for band reachability.
Probes: eval-test ✓ (K, **Grade 1**, Grade 5 control) · tutor-test `--probe` ✓
(before **and** after) · **real-Chrome drive ✓**

---

## Why this slice was a different job

The handoff predicted it: this is the first primitive in the whole sweep that
**already had a voice** — 14 `sendText` tags, 8 of 12 context vars resolving from
the component. So the work was *auditing an existing voice for band-fitness*, not
adding one. Running `tutor-test?probe=1` **before** scoping (slice 1's lesson) is
what made the difference: it showed the channel was alive, so the fix had to be
about what the voice SAYS, not whether it exists.

## Finding 1 — the prose-grade defect, and it bit Grade 1 too

Identical to slice 1, and the last instance of the class in astronomy:

| request | prose `gradeContext` | old stamp | why |
|---|---|---|---|
| `grade=K` | `kindergarten students (ages 5-6)…` | **`'3'`** | no "grade N" in the prose |
| `grade=1` | `first grade students (ages 6-7)…` | **`'3'`** | "first grade" is not "grade 1" |
| `grade=5` | `grade 5 students…` | `'5'` | the only shape the regex handled |

`ctx.grade` was read zero times. `resolvedGrade` drives `GRADE_CONFIGURATIONS`
(planet count + guidance), the prompt's grade line, the age-appropriateness rule,
`buildFallback` on **all five** degrade paths, and the output stamp — which is
what the tutor prompt prints, so the scaffold read `Grade Level: 3` at K as well.

One difference worth recording: **this ladder runs to grade 8**, so the resolver
clamps at 8, not 5 — every other astronomy generator in the sweep was K-5.

## Finding 2 — the K content was the real failure, not the chrome

Probed verbatim at `ea5f60b` with `&grade=K`:

> **"What is the length of a day on Jupiter?"** → `9.9 hours` / `24 hours` / `365 hours` / `48 hours`
> **"Earth is the only known planet that supports life."** (true/false)
> **"It is made of gas with no solid surface"** (an option)

Reading those aloud does not rescue them — discriminating 9.9 from 48 hours is not
a Kindergarten task in *any* modality. This is the S4 lesson a third time: **a band
failure can be a content gap, and only the generator can close one.** The stat
cards are this primitive's answer surface, so the bound had to name what may be
asked (colour, big/small, rings, moons 0-2, rocky vs gas) and what may not
(durations, distances, mass, gravity, temperatures, decimals).

## Finding 3 — nothing ever announced the question

`handleStartQuestions` fired **no moment at all**, and `[NEXT_ITEM]` said only
*"Moving to question 2 of 3"* — never the question text, never the options. So at
K the question and every answer were silent text with no spoken twin, while the
tutor sat on a scaffold telling it to help with a question it had never been told.
Replaced with `[QUESTION_SHOWN]`, which carries the question and every option and
is explicitly told not to say which is right.

## Finding 4 — an answer leak the handoff had recorded as clean

The 2026-08-07 handoff states: *"Answer-leak check already run, and it is CLEAN …
zero spoken lines interpolate it. Do not 'fix' this."* That was inaccurate.
`PlanetaryExplorer.tsx` first-attempt branch:

```ts
sendText(`[ANSWER_INCORRECT] Student chose "…" but correct is "${q.options[q.correctIndex]}".
          Give a hint without revealing the answer.`)
```

It handed the model the correct option **while the student still had a try left**
and relied on an instruction to keep it quiet. Per the skill's own rule (answer
keys in `contextKeys` are fine; the same key in a spoken line is a leak) this is a
leak. The final-attempt reveal is legitimate pedagogy and is kept — now marked
`FINAL ATTEMPT` so the directive can distinguish the two.

Related: `correctAnswer` was declared in `contextKeys` and never resolved. Wiring
it would have parked the answer key in the prompt for the *whole* question, so it
was **removed** rather than resolved.

---

## Audit A — text census (K, from the rendered state)

| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| `Earth is our very own home planet…` | planet description | **load-bearing** | `[PLANET_ARRIVE]` + `LuminaReadAloud` | COVERED |
| `COLOUR / Blue colour`, `MOONS / One moon` | stat cards | **load-bearing** (the evidence) | `[STAT_TAPPED]` fires per card | COVERED |
| `Earth is the only planet we know that has living things.` | Fun Fact | supportive | `LuminaReadAloud` | COVERED |
| `What colour is most of Earth?` | question | **load-bearing** | `[QUESTION_SHOWN]` + replay button | COVERED |
| `Blue` / `Red` / `Green` / `Yellow` | options | **load-bearing** | `[QUESTION_SHOWN]` reads every one, in order | COVERED |
| `Q1/2` | counter | adult chrome | **removed at K-1** | COVERED |
| `A.` `B.` `C.` `D.` | option letters | reading cue | **removed at K-1** | COVERED |
| `Ready for Questions →` / `Check Answer` | buttons | load-bearing (nav) | **UNCOVERED** | residual |

**Audit A: PASS for `explore` at PRE**, with one residual (below).

## Audit B — sufficiency contract

| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| `explore` (K) | ✅ `[JOURNEY_START]` + `[PLANET_ARRIVE]` | ✅ description, fun fact, question **and every option** now voiced | ✅ scaffold enacts the question instead of pointing at the panel | ✅ sound + on-option colour + spoken | ✅ 3 levels resolve; answer withheld until the final try |
| `identify` (quiz) | ✅ `[QUIZ_START]` | ✅ | ✅ `[QUIZ_HINT]` never names the planet | ✅ | ✅ |
| `compare` / `apply` | ✅ | ✅ | ✅ | ✅ | ✅ |

Before this slice, STIMULUS failed for every mode — the question was never spoken.

## Audit C — band contract (PRE, `explore`, from the Chrome render)

| Rule | PASS/FAIL | Note |
|---|---|---|
| 1. Audio is the instruction channel | **PASS** | 15 moment tags, 11/11 context keys live, 3 read-aloud surfaces |
| 2. Tap = choose | **PARTIAL** | select-then-`Check Answer` is two taps. Kept deliberately: the 2-attempt allowance is the primitive's support-tier contract (L3), and collapsing it would delete a shipped lever. Not atomic ⇒ rule 2's confirm-button exemption applies. |
| 3. Pictures are the answer surface | **PARTIAL** | options are words ("Blue", "Red"). At K they are now single colour words the tutor speaks — but this primitive is text-MCQ by design. See residuals. |
| 4. One thing per screen, ≤ ~5 interactive | **PASS** | measured: planet-info 4 stat cards + 1 button = 5; questions 4 options + 1 button = 5 |
| 5. Feedback on the touched object, instantly | **PASS** | option tints green/red in place + sound + spoken |
| 6. No typing | **PASS** | — |
| 7. No adult chrome | **PASS** | `Q1/2` and `A./B.` conditionally removed; stats now carry no units or decimals at K |
| 8. Assessment hides in the mechanics | **FAIL (by design)** | it is a quiz. Not fixable without a rebuild — see residuals. |

---

## Overall: **READY at PRE** for `explore`

Findings → fix layer:
1. Prose-grade resolver (K *and* Grade 1 → `'3'`) → **GENERATOR**: exported
   `planetaryGradeFromGrade` canonical-first, prose demoted and taught the
   spelled-out forms, clamp at 8.
2. Grade-3 content at K → **GENERATOR** (Tier 3), band-scoped prompt rules.
3. Question never announced → **COMPONENT**, new `[QUESTION_SHOWN]` beat.
4. First-attempt answer leak → **COMPONENT** + **CATALOG** reveal-policy directive.
5. Reader-shaped scaffold → **CATALOG**: `aiDirectives` (cap-override read-aloud,
   reveal policy, no-numbers-at-K-1 with the replacement register) and
   `scaffoldingLevels` rewritten to ENACT the question.
6. Adult chrome at K → **COMPONENT** band gate.

### Runtime A/B — the ladder is not flattened

| grade | stamp | planets | stats | question |
|---|---|---|---|---|
| K | **`K`** | 3 | `Colour: Blue`, `Moons: One`, `Water: Lots` | "What colour is most of Earth?" → Blue/Red/Green/Yellow |
| 1 | **`1`** | 3 | plain | short, seeable |
| 5 (control) | **`5`** | — | `Distance from Sun: 150 million km`, `Length of Day: 24.6 hours` | "What gives Mars its red color?" → "Iron oxide (rust)" |

### Tutor channel, before → after (`tutor-test?probe=1&gradeLevel=kindergarten`)

| | before | after |
|---|---|---|
| status | `warn` | **`pass`** |
| findings | 4× `context-key-unresolvable`, 1× `indirect-script` | **none** |
| context keys resolved by component | 8 / 12 | **11 / 11** |
| `(not set)` in the prompt | 4 | **0** |
| `Grade Level:` | `3` | `K` |

The `indirect-script` warnings were real reader-fit findings, not noise: `level3`
narrated the UI ("what the question is asking"), which is exactly the failure at K.

### Real-Chrome drive (K, AstronomyPrimitivesTester)

`invalid button-in-button 0` · read-aloud present on description, fun fact and
question · `Q1/2` absent · `A./B.` absent · question "What colour is most of
Earth?" · options Blue/Red/Green/Yellow · **zero page or console errors**.

⚠️ The drive was initially blocked by **three dev servers sharing one `.next`**,
which made port 3000 404 its own CSS chunks — the handoff's documented trap, hit
for real. Cleared with the user's approval (kill all, `rm -rf .next`, one clean
server). API probes were unaffected throughout; only the browser was.

### Residuals (recorded, not fixed)

- **Rule 8 fails by design.** planetary-explorer is a read-then-quiz instrument;
  assessment cannot hide in its mechanics without a rebuild. That is a REBUILD
  conversation ("tap the planet that is red" as the measurement), not a fix — and
  it is the same shape as the media-player/hydraulics reimaginings.
- **Rule 3 partial**: options are words. At K they are now single concrete words,
  but picture-primary options would need an image/emoji field per option — a
  generator + component change of its own.
- **Nav buttons have no spoken twin** (`Ready for Questions`, `Check Answer`).
  Single affordance per screen, so a child can proceed by position; worth folding
  into the shared K-stage presentation mode rather than fixing per-primitive.
- **Grade-5 control returned 2 planets where the config asks for 5.** Generation
  yield, not grade resolution (the prompt said "Pick 5 planets" — asserted in the
  test). Pre-existing; belongs to the flash-lite truncation sweep.

### Gates

- src-scoped tsc **803 = baseline, set diff EMPTY**.
- `npm run typecheck:lumina` **0 errors**.
- Full vitest **2417 passed**; the one failure in the tree is a concurrent DI
  session's `gemini-di-shapes.test.ts` (a probabilistic threshold in their
  in-flight L4 work), not reachable from anything in this slice.
- **Every claim revert-bitten**: generator+catalog reverts → 9 failures; component
  reverts (question beat, leak, chrome) → 7 failures. 16/16 bit.
