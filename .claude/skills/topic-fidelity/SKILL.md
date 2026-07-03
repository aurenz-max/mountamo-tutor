# Topic Fidelity — Does One Generator Honor Its topic + intent (+ grade)?

Take a SINGLE generator and verify that the lesson's `topic` and `intent` actually
shape what it produces — then fix it if they don't, via an escalating fix ladder.
Outcome: the generator's student-facing output respects the scope and theme the
topic+intent asked for ("counting to 10" → values ≤ 10; a topic about "frogs" →
frog-flavored content), OR a clear verdict that this primitive is simply the wrong
fit for the topic (not a bug).

There is a third fidelity axis: **grade** (`--grade` modality, see its section
below). Same probe → verdict → fix-ladder shape, but the axis under test is the
objective's canonical curriculum grade (`ctx.grade`) instead of topic/intent, and
the characteristic bug is a generator running forever on its hardcoded fallback
grade (poetry-lab emitted grade-4 content for every lesson, including K).

**This is the per-generator, fix-capable companion to the two assess-only skills:**
- `/topic-trace` watches a topic propagate through the manifest into MANY primitives (finds the broken link).
- `/eval-test` checks ONE primitive's modes for brokenness (crash / leak / impossible).
- `/topic-fidelity` takes ONE generator and asks "does topic+intent reach the output?" — and **applies the fix** when it doesn't.

**Arguments:** `/topic-fidelity <generator-id> [topic] [gradeLevel]`
- `/topic-fidelity number-line "Counting to 10" kindergarten`
- Omit the topic and the skill picks a scope-bearing probe topic for the primitive's domain.
- The topic SHOULD carry real scope or theme language ("to 10", "within 5", "about animals") — otherwise there is nothing to honor and every result looks fine.

**Grade modality:** `/topic-fidelity <generator-id> --grade [topic]`
- `/topic-fidelity poetry-lab --grade "rhyming words"`
- Runs the GRADE probes/fix ladder (see "Grade modality" section) instead of the topic/intent ones. Run both modalities on a generator you're fully auditing.

## The core distinction: fidelity bug vs. primitive-fit mismatch

Not every "topic didn't land" is a failure. Classify into exactly one:

| Verdict | What it means | Action |
|---|---|---|
| **HONORED** | Output respects topic+intent (scope + theme) | Done — report PASS |
| **FIDELITY BUG** | The topic asks for something the primitive *can* represent, but the output ignores it (e.g. "to 10" but the line goes to 20; "frogs" but content is generic) | Run the fix ladder |
| **WRONG PRIMITIVE** | The topic is outside what this primitive can pedagogically represent (e.g. "counting within 200" on `ten-frame`, which tops out at 10/20 by design) | **Not a failure.** Report it as a routing observation; the manifest simply shouldn't send this topic here. Optionally run `/curriculum-fit`. |

The bug signature is asymmetric: a topic asking for **less** than the default while
the generator emits **more** (number-line "to 10" → 0–20) is a FIDELITY BUG. A
topic asking for **more** than the primitive's ceiling is WRONG PRIMITIVE — the
ceiling is correct; the routing is wrong.

## How topic + intent reach a generator (read this first)

```
manifest → flattenManifestToLayout → generateComponentContent(item, topic, gradeLevel)
                                          │
   topic   = manifest.topic (exhibit-level)         ── always passed
   intent  = item.intent  → config.intent           ── ONLY if the registry handler injects it; MANY generators never read it
   config  = { targetEvalMode, difficulty, intent } ── numberRange etc. are NOT emitted by the manifest
```

Three failure mechanisms to look for:
1. **Intent dropped at the registry**: the `registerGenerator` handler forwards bare
   `item.config` instead of `{ ...item.config, intent: item.intent || item.title }`, so
   `item.intent` (the per-primitive assignment) never reaches the generator at all —
   even before the prompt question. The eval-test route injects `config.intent`
   directly, so this drop is INVISIBLE to a probe; you must read the registry handler.
2. **Prose-only**: topic/intent reach the prompt text, but the student-facing
   VALUES are picked in CODE (a pool/range/default), so prose never moves them.
   This was the number-line bug — "to 10" was in the prompt, but targets came from
   a `numberRange ?? {0,20}` default. *Prompt injection alone will NOT fix this.*
3. **Dead field**: `config.intent` is declared but never read (grep the generator
   for `intent` — if it only appears in the type, it's dead).

## Workflow

### Phase 0 — Locate and read the generator

```
Generator:  src/components/lumina/service/<domain>/gemini-<name>.ts
Component:  src/components/lumina/primitives/visual-primitives/<domain>/<Name>.tsx
Catalog:    src/components/lumina/service/manifest/catalog/<domain>.ts
Registry:   src/components/lumina/service/registry/generators/<domain>Generators.ts
```

Answer these questions from the source:
- **Does `intent` even REACH this generator?** Two drop points, check BOTH:
  (a) the **registry** handler — does it pass `intent: (item.config?.intent as string | undefined) || item.intent || item.title` into config, or just forward `item.config`? (b) the **generator** — does its config type declare `intent`, and does the prompt interpolate it?
  `topic` is the broad lesson; `intent` is the *specific objective the manifest intentionally assigned to THIS primitive*. If intent dies at either point, the per-primitive assignment is silently discarded and the generator can only ever honor the broad topic — a latent fidelity gap even when the topic-scope test passes.
- Are the student-facing values chosen by the **LLM** (from the prompt) or by
  **code** (a pool/range/default)? This decides Tier 1 vs Tier 2.
- What is the primitive's intrinsic ceiling/representable space (the WRONG-PRIMITIVE boundary)?

### Phase 0.5 — Establish the intent contract FIRST (before diagnosing)

If Phase 0 found intent doesn't reach the generator, **wire it before running probes** —
otherwise you are testing a generator that *structurally cannot* honor intent, and a
topic that happens to carry its own scope will read as HONORED while the assigned intent
is dropped. This is the Tier-1 fix applied pre-emptively, and it is the default first step:
1. Registry: spread `...item.config, intent: (item.config?.intent as string | undefined) || item.intent || item.title` (mirror `counting-board` / `number-sequencer`).
2. Generator: declare `intent?: string` on the config type; interpolate it into the prompt as the SPECIFIC focus ("the broad lesson is ${topic}, but THIS activity must target: ${intent}"), with the scope/ceiling + no-answer-leak guardrail.
Then diagnose with intent VARYING under a FIXED broad topic (Phase 1) to prove it tracks.

### Phase 1 — Diagnose with three test runs

Dev server must be up (`cd my-tutoring-app && npm run dev`). Use the eval-test
route — it now forwards `&intent=` to `config.intent`:

```bash
ID=number-line; M=plot; G=kindergarten
enc(){ python -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$1"; }
probe(){ curl -s -m 90 "http://localhost:3000/api/lumina/eval-test?componentId=$ID&evalMode=$M&gradeLevel=$G&topic=$(enc "$1")&intent=$(enc "$2")"; }

# 1. HONORED test — the bound the topic asks for
probe "Counting to 10"  "Plot numbers 1 to 10"
# 2. DISCRIMINATION control — a DIFFERENT bound; output must TRACK it (proves it reads, not a constant)
probe "Counting to 20"  "Plot numbers 1 to 20"
probe "Counting to 5"   "Numbers up to five"
# 3. NO-REGRESSION control — generic / no bound; output must fall back to the grade-band default
probe "Number line practice" "Plot a point"

# 4. INTENT-DISCRIMINATION — hold topic BROAD and FIXED, vary only intent. Output must
#    track the intent (operation, scope, theme). This is the test that exposes a dropped
#    intent contract that a topic-carries-its-own-scope probe would mask.
probe "Numbers within 10" "Numbers up to 5 only"
probe "Numbers within 10" "Numbers up to 10"
```

Extract the **largest student-facing value** (or the theme signal) from each run's
`fullData` and judge:
- **HONORED** if run 1 respects the bound, run 2 tracks the different bound, and run 3 is the sensible grade default.
- **FIDELITY BUG** if run 1 exceeds the bound, OR run 2 doesn't track (constant output = scope is ignored).
- **WRONG PRIMITIVE** if the topic's ask is structurally outside the primitive (then STOP — go to Report).

Run each probe 2–3× if values are LLM-chosen (generation has variance — judge the distribution, not one draw).

### Phase 2 — Tier 1 fix: feed topic + intent into the prompt (auto-apply)

Only when the verdict is FIDELITY BUG **and** the values are LLM-chosen from the prompt.

1. Ensure the prompt interpolates BOTH `topic` and `config.intent`, with an explicit
   scope/theme instruction ("Stay within the range the topic implies; the grade is
   the ceiling. Make the content about: ${intent}").
2. Keep the schema unchanged.
3. Re-run the Phase 1 probes. If now HONORED across all three → done, go to Verify.
4. If still brittle (the LLM ignores the scope language under conflict, or values
   are code-picked so prose can't bind them) → escalate to Tier 2.

Per [[schema-over-regex-and-prompt]]: never regex-parse the topic for a number.
Tier 1 is prompt prose; the structured extraction is Tier 2's job.

### Phase 3 — Tier 2 fix: pre-call micro-LLM resolver (GATED — get approval first)

Tier 2 adds one LLM call per render, so **PAUSE and present the plan for approval**
before writing it. Tell the user: which structured field(s) it will resolve, that
it adds ~1 flash-lite call per render, and that it only fires when the field is
absent (no-op otherwise).

The pattern (the number-line `resolveTopicNumberRange` is the reference
implementation in `gemini-number-line.ts`):
1. A tiny schema-constrained call (2–4 fields max — Flash Lite drops fields on big
   schemas, see SP-14) that reads `topic` + `intent` + `gradeLevel` and returns the
   structured value the code-picker needs (a `numberRange`, a `themeNoun`, etc.).
2. `temperature: 0`, grade as the CEILING in the prompt, return `null` on any
   parse/validation failure.
3. Wire it in BEFORE the value-pickers, gated on the manifest field being absent
   (`if (!config.numberRange) { resolved = await resolve(...) ?? undefined }`), then
   thread it into the sub-generators. A `null` result leaves the existing grade-band
   default in place → **no regression**.

Do sequentially: Tier 1 first (cheapest), Tier 2 only if Tier 1 proved insufficient.
If the right long-term home is the shared `scopeContext.ts` binding rather than a
bespoke resolver, say so — that is the [[scope-context-contract]] rollout.

### Phase 4 — Verify

1. `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit` — compare to the current baseline (1101 as of 2026-07-03; see [[tsc-verification-integrity]]), no new errors.
2. Re-run all three Phase-1 probes. Assert: HONORED on the bound, TRACKS on the discrimination control, UNCHANGED grade default on the no-regression control.
3. Confirm no answer leak was introduced (the topic/intent text must not name the answer).

### Phase 5 — Report + memory

Save to `my-tutoring-app/qa/topic-fidelity/<generator>-<YYYY-MM-DD>.md`:

```markdown
# Topic Fidelity: <generator> — <YYYY-MM-DD>

Scope/theme intended: <e.g. "values ≤ 10">

| Probe | topic | result (max value / theme) | verdict |
|-------|-------|----------------------------|---------|
| honored        | Counting to 10 | max 6  | HONORED (after fix) |
| discrimination | Counting to 20 | max 12 | tracks |
| discrimination | Counting to 5  | max 5  | tracks |
| no-regression  | (generic)      | max 12 (0–20) | grade default |

**Verdict:** FIDELITY BUG → fixed at Tier <1|2>.
**Mechanism:** <prose-only / dead field / honored>
**Change:** <file + one line>  | tsc: <n> (baseline 1419)
```

- If WRONG PRIMITIVE: record the routing observation, change no generator code.
- Update `EVAL_TRACKER.md` only if you found a defect (use the SP-pattern table; a
  prose-only/code-picked-values miss is a recurring class worth its own SP entry).
- Write a one-line memory pointer if the fix taught something general about the
  topic→generator contract.

## Grade modality (`--grade`)

Verify that the objective's canonical curriculum grade shapes what ONE generator
produces — then migrate it onto `ctx.grade` if it doesn't. Outcome: content
complexity (reading level, structural load, line/option counts, ladder rung)
tracks the grade the objective carries, OR a verdict that the grade is outside the
primitive's pedagogical range (routing, not a bug).

### How grade reaches a generator (the contract)

```
preBuiltObjectives[].grade ('K'|'1'..'12', from curriculum metadata)
  → flattenManifestToLayout stamps config.objectiveGrade per component
  → resolveGenerationContext normalizes it (normalizeObjectiveGrade — the ONLY
    place grade strings are parsed) → ctx.grade
  → generator selects its ladder rung from ctx.grade
```

`ctx.gradeLevel` (band key: 'kindergarten', 'elementary'…) and `ctx.gradeContext`
(prose) still exist as the BAND FALLBACK — note 'elementary' collapses grades 1–5,
so a numeric grade is unrecoverable from the band. Free-form lessons have no
`ctx.grade`; the band default must stand (that's the no-regression control).

Three failure mechanisms (grade analogs of the topic/intent ones):
1. **Legacy parse-and-fallback** (the ~25-generator class): the generator matches
   `gradeLevel`/`gradeContext` against `['1'..'6']` or regexes `/grade\s*(\d|K)/i`
   — the match never hits the band/prose strings, so output is CONSTANT at the
   hardcoded fallback ('4', '3', 'K'…). Only a discrimination probe exposes this;
   a K-fallback generator looks HONORED on a K probe ([[value-origin-not-code-touch]]
   — always probe, never grep).
2. **Missing rung**: `ctx.grade` is consumed but the gradeNotes/ladder has no entry
   for that grade (e.g. no 'K' row) → undefined interpolates into the prompt or the
   clamp silently lands on the wrong rung.
3. **Dead grade**: generator reads `ctx.grade` into a variable that never reaches
   the prompt or the value-pickers.

### Verdicts

Same table as topic/intent, grade-flavored:
- **HONORED** — output complexity tracks `&grade=` across probes AND falls back to
  the band default without it.
- **FIDELITY BUG** — constant output across grades (mechanism 1), a missing rung
  (2), or a dead field (3) → run the grade fix.
- **WRONG PRIMITIVE** — the grade is outside the primitive's ladder by design
  (grade 8 objective on a K-6 primitive): clamping to the ceiling rung is CORRECT,
  report as routing. Also correct: a K-2-only primitive (phonics) refusing to
  scale up.

### Probes

Same eval-test engine; `&grade=` mirrors `&intent=` (forwarded to
`config.objectiveGrade` → `ctx.grade`):

```bash
ID=poetry-lab; M=analysis; T="rhyming words"
probe(){ curl -s -m 90 "http://localhost:3000/api/lumina/eval-test?componentId=$ID&evalMode=$M&topic=$(enc "$T")&grade=$1&gradeLevel=$2"; }

# 1. HONORED test — the grade the objective carries
probe K kindergarten
# 2. DISCRIMINATION control — different grades; output complexity must TRACK
#    (this is the run that exposes a constant-fallback generator)
probe 2 elementary
probe 5 elementary
# 3. NO-REGRESSION control — no &grade= at all; band default must stand
curl -s -m 90 ".../eval-test?componentId=$ID&evalMode=$M&topic=$(enc "$T")&gradeLevel=elementary"
```

Judge on STRUCTURAL signals, not just the echoed `gradeLevel` field: line/item
counts, vocabulary level, which ladder-rung features appear (K = no figurative
language; 5 = free verse + hyperbole). An echoed "K" wrapping grade-4 content is
still a FIDELITY BUG.

### Grade fix (single tier — no resolver needed)

Grade arrives already structured, so there is no Tier-2 micro-LLM step. The fix is
the `ctx.grade` consumption pattern (reference: `gemini-poetry-lab.ts`):
1. Replace the legacy string-match with: use `ctx.grade` when it's on the
   primitive's ladder; clamp above-ceiling numeric grades to the top rung; else
   band fallback (map 'kindergarten'/'preschool' → 'K' where the ladder has K,
   otherwise the primitive's sensible mid default).
2. Add missing rungs the primitive can pedagogically serve (K = the common gap);
   update the catalog description/constraints so the curator knows the new range.
3. Keep the eval-mode/challenge-type docs consistent with the new range — a
   promptDoc saying "Grades 3-6" next to `GRADE: K` is a contradiction in the
   same prompt.
4. Never let grade change the eval mode's cognitive KIND — grade governs
   realization (reading level, structural load, option count); the tier/mode axis
   stays intact ([[evalmode-resolver-grade-blind]] grade-precedence rule).

Then verify exactly as Phase 4 (tsc vs baseline + re-run all probes) and report to
`my-tutoring-app/qa/topic-fidelity/<generator>-grade-<YYYY-MM-DD>.md` with the
same table shape (probe | grade | structural signals | verdict).

## Gotchas

- **eval-test forwards `intent` only as of this skill's creation** — older transcripts that passed `&intent=` were silently ignored. Confirm the route has the `intent` passthrough.
- **Prompt prose cannot move code-picked values.** If a Tier 1 prompt edit "does nothing," the values are code-picked → you needed Tier 2 from the start. Check the picker, not the prompt.
- **Discrimination control is the real test.** A generator that always emits 0–10 looks HONORED for "to 10" but is actually ignoring scope — only the "to 20"/"to 5" runs expose a constant.
- **`identify`-style hardcoded modes** (number-line caps `identify` at 0–10 by design) are correct, not bugs — don't "fix" an intentional fixed range.
- **WRONG PRIMITIVE is a success outcome of this skill**, not a failure to chase. Stop and report it; the fix lives in manifest routing, not the generator.
- **Don't widen scope to fit a topic.** A fix makes the generator honor a TIGHTER topic bound; it must never let `hard`/a big topic push values past the grade ceiling (pedagogy rule #1, [[structural-difficulty-not-numeric]]).
- **(--grade) A matching fallback masks the bug.** K-band phonics generators hardcode fallback 'K' — a K probe reads HONORED while grade is fully ignored. The grade-2/grade-5 discrimination runs are the real test, exactly like the scope constant.
- **(--grade) eval-test forwards `grade` only as of 2026-07-03** — confirm the route has the `objectiveGrade` passthrough before trusting probes.
- **(--grade) Never parse grade from `gradeContext` prose in a generator.** That's the original bug class. If normalization is needed, it belongs in `normalizeObjectiveGrade` at the boundary — generators only compare `ctx.grade` against their ladder.

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/lumina/eval-test/route.ts` | Test engine (forwards `topic`, `intent`, `difficulty`, `verb`, `grade`) |
| `src/components/lumina/service/<domain>/gemini-*.ts` | The generator under test |
| `src/components/lumina/service/math/gemini-number-line.ts` | Reference Tier-2 resolver (`resolveTopicNumberRange`) |
| `src/components/lumina/service/generation/resolveGenerationContext.ts` | `normalizeObjectiveGrade` — the ONLY grade-string parser (→ `ctx.grade`) |
| `src/components/lumina/service/literacy/gemini-poetry-lab.ts` | Reference `ctx.grade` consumption + K rung (the grade-fix pattern) |
| `src/components/lumina/service/**/scopeContext.ts` | `buildScopePromptSection` — shared scope binding (long-term Tier-2 home) |
| `src/components/lumina/service/registry/generators/*Generators.ts` | Where `intent` is injected into `config` |
| `my-tutoring-app/qa/topic-fidelity/` | Report output directory |
