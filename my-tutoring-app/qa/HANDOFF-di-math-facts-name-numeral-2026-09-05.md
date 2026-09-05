# HANDOFF — `di-math-facts` gets a fifth mode: `name_numeral`

Paste-able execution prompt. Authored `/lesson-coverage` session 2026-09-05;
every anchor verified against the working tree at HEAD `315f7bfb`. Executor:
`/add-eval-modes di-math-facts` for the catalog/backend/generator-wiring
shape, but this is Fork A (pool-service) — the mode's per-challenge CONTENT is
code-owned, not schema-constrained, so most of the actual work is direct edits
to the three files below, in the pattern `counting_next` already set. Serial
single session (DI lane convention — no Workflow fan-out on an unbenched mode).

## The prompt

`qa/lesson-bench/BACKLOG.md` item 20 (2026-09-05): the objective-coverage judge
scored a fresh K "Counting objects to 10" package WARN — obj1 ("count objects")
sufficient, obj2 ("Recognize and name the written numbers 1 through 10 in
order") only `ASSESSED_INDIRECTLY`. The three components the manifest picked
for obj2 — `number-tracer[trace]`, `hundreds-chart[highlight_sequence]`,
`number-sequencer[before_after]` — all proxy a neighbour skill (handwriting
motion, pattern-tap, sequence-neighbor) instead of recognizing/naming a shown
numeral. Checked the catalog: no primitive has a challenge type whose task IS
"see a written numeral, name it" — a genuine SUPPLY gap, not a manifest miss.

User ruling (this session, 2026-09-05): a **tap-to-select** fix (e.g. a new
`hundreds-chart` "tap the matching cell" mode) was rejected — it assesses
*recognize*, not *name*, and the objective's verb is expressive. This is DI
territory: the child answers OUT LOUD (`feedback_di-spoken-first-not-tap`).
Home: extend `di-math-facts`, not a new primitive — it is already the K/G1
spoken, live-judged, number-word-production engine, and its existing
`counting_next` mode ("5 →" → child says "six") already carries 90% of the
infrastructure a bare numeral-naming task needs (the ASR/number-word alias
table, the DISTAR model→guide→test script, the ORDER-of-magnitude support
tier). `name_numeral` needs no `counting_next`-style successor computation —
it is simpler: show the numeral, judge the number word said back.

**Open scope question this session did NOT resolve** — the catalog's own
`di-math-facts` description draws a line: *"Use a dedicated counting primitive
when COUNTING ITSELF is the objective."* Numeral naming is arguably closer to
that carved-out family than to "facts." Default here is a MODE on
`di-math-facts` (fastest, reuses everything); if the user overrides to a
separate pack instead, the code below (number-word table, alias builder,
DI script pattern) is still the reference to port, just onto a new file.

### Line-exact mechanism — THREE files, don't stop at one

**1. `src/components/lumina/primitives/visual-primitives/direct-instruction/diMathFactsScript.ts`**
- `:68-72` `DiMathFactsChallengeType` union — add `| 'name_numeral'`.
- `:190-191` `countingDirection()` defaults to `'up'` for anything that isn't
  `subtraction_fact`. **Real defect if left as-is**: `judgingContract` (`:223`)
  always appends `"...or after counting ${countingDirection(it)} to it"` —
  for `name_numeral` there is no "count up to the answer" route (you don't
  count your way to a number's NAME), so this must NOT fire for the new type.
  Cleanest fix: parameterize the counting-route clause out of `judgingContract`
  for `name_numeral` the same way `countingJudgingClauses` (`:206-210`) is
  already conditionally scoped to `counting_next` only — add a sibling guard
  (e.g. `const hasCountingRoute = (it) => it.challengeType !== 'name_numeral'`)
  and gate the `"...or after counting X to it"` fragment on it.
- `:227` the "echoing a number straight out of the problem" struggle line is
  inert for `name_numeral` (the display is a single bare numeral — nothing
  else to echo); no change needed, just don't be surprised it never fires.
- Everything else (`modelLine`/`guideLine`/`testLine`/`verifyLine`/
  `correctionLine`/`contrastCorrectionLine`/`leadInFor`/`coldAnswerGuard`) is
  already generic over `it.problem`/`it.answerWord`/`it.supportTier` — no
  change. Suggested `problem` string for the new type: `"this number"` (reads
  correctly inside every cue: *"Listen: this number is seven."* / *"Your
  turn. What is this number?"*).

**2. `src/components/lumina/service/direct-instruction/gemini-di-math-facts.ts`**
(Fork A — Gemini emits ONLY the title/description/factScope wrapper; every
challenge field below is code-owned, mirroring `counting_next`.)
- `:162-166` `NUMBER_WORDS` / `:186-197` `numberWordFor` / `:219-230`
  `aliasesFor` — reuse AS-IS, zero changes. This is the whole reason the mode
  is cheap: the numeral→word→ASR-alias table already exists.
- `:281-307` `resolveTextScope` — **required regex extension**. The exact
  target objective text, *"Recognize and name the written numbers 1 through 10
  in order"*, does NOT match the existing `within`-pattern
  (`/(?:within|up\s+to|sums?\s+to|to)\s+(\d{1,3})\b/i` — verified null on this
  string at HEAD). Add `through` to the alternation:
  `/(?:within|up\s+to|sums?\s+to|to|through)\s+(\d{1,3})\b/i` — verified this
  still matches "within 120" byte-identically AND newly matches "1 through
  10" → `maxSum: 10`. Without this, the scope falls through to the flash-lite
  wrapper's `factScope` guess (enum is `within_5|within_10|make_10|doubles`,
  framed entirely around ADDITION sums — the model has no real signal for a
  naming-range objective) or the grade default (K → within 5, which would
  silently cap the session at naming 1-5, not 1-10). Code-enforced scope beats
  a guess, per this file's own governing principle (`:967-969`).
- `:316-317` `benchedCeilingFor` — add `type === 'name_numeral' ? 20 : ...`
  ahead of the `counting_next` ternary (name_numeral is a single-word response
  like every fact identity, never the compound-numeral 120 extension).
- `:406-413` `buildCountingPool` — do NOT reuse directly (it returns `{a, b:
  1}` pairs starting at 0, i.e. numerals 0..ceiling-1; the objective's pool
  should be 1..ceiling since "1 through 10" excludes 0). Add a sibling
  `buildNumeralPool(min: number, max: number): FactPair[]` returning `{a: n, b:
  0}` for `n` in `[min, max]` inclusive. Default `min = 1` (this objective and
  the common case never ask to name "zero" as a numeral).
- `:418-421` `answerFor` — add `type === 'name_numeral' ? p.a : ...` (the
  answer IS the shown numeral, spoken as its word — no computation).
- `:424-427` `keyFor` — add `` type === 'name_numeral' ? `name:${p.a}` : ... ``.
- `:430-433` `isTrivial` — add `type === 'name_numeral' ? false : ...` (every
  numeral in the pool is worth naming; nothing to exclude the way ±0 is
  excluded from facts).
- `:436-442` `structuralMagnitude` — add `type === 'name_numeral' ? p.a : ...`.
- `:445-458` `crossesOperandBoundary` — add a `name_numeral` branch. There is
  no real "crossing" concept for a bare naming task (unlike counting-on or
  subtraction borrowing); mirror `counting_next`'s shape (`p.a === boundary`)
  or simply return `false` and leave the operand-boundary L4 axis undefined
  for this type — same deferral `counting_next` already documents for
  above-20 counting (`:987-990`), just flag it in the same style rather than
  silently no-op it.
- `:693-718` `poolForType` — add
  `case 'name_numeral': return buildNumeralPool(1, Math.min(ceiling, benchedCeilingFor(type)));`
- `:733-745` `seedForType` — no change needed (only fires for `answer_fact`/
  `fact_review`); confirm `name_numeral` correctly falls through to `return []`.
- `:749-794` `buildChallenge` — add a branch:
  ```ts
  if (type === 'name_numeral') {
    return {
      ...base,
      id: `dimf-${index + 1}-id${pair.a}`,
      a: pair.a,
      b: 0,
      display: `${pair.a}`,
      problem: 'this number',
      solvedDisplay: `${pair.a} = ${numberWordFor(answer)}`,
    };
  }
  ```
  (`answer === pair.a` here — `answerFor` above makes that the identity.)
- `:806-827` `CHALLENGE_TYPE_DOCS` — add an entry (Fork A: this only feeds the
  intent→mode ROUTER's prompt doc, no schema to constrain):
  ```ts
  name_numeral: {
    promptDoc: `"name_numeral": the child sees ONE printed numeral (e.g. "7") and speaks its name aloud ("seven"). Pure recognition/production — no computation.`,
    schemaDescription: "'name_numeral' (say the numeral's name)",
  },
  ```
- `:830-832` `ALL_TYPES` — add `'name_numeral'` (the mixed/unconstrained spread
  must include it, SP-21 discipline). Order matters for downstream β ordering
  — see catalog section below; put it FIRST (`['name_numeral', 'counting_next', 'answer_fact', 'fact_review', 'subtraction_fact']`).
- `:904-912` the Gemini wrapper prompt's factScope RULES paragraph is written
  entirely around addition sums ("pick the factScope that matches its number
  range"). Once the `resolveTextScope` regex fix above lands, code-enforced
  scope wins for THIS objective regardless — but if the mode ever runs
  unpinned/mixed with a vaguer objective, the wrapper call has no framing for
  a naming-range ask. Lower priority than the regex fix; note it, don't
  necessarily block on it.

**3. `src/components/lumina/service/manifest/catalog/di.ts`**
- `:312` top-level `description` — currently frames the whole primitive around
  fact fluency + "the counting-sequence step underneath them"; add a clause
  naming bare numeral recognition/production explicitly (e.g. "...and pure
  numeral recognition — see a printed number and say its name aloud, no
  computation required — for K.CC.3-adjacent objectives"), since the CURATOR
  reads this exact field to decide whether to select the primitive at all
  (`gemini-manifest.ts:325-327` renders `c.description` into the selection
  prompt for every catalog line). Skipping this half means the mode can exist
  and still never get selected.
- `:313` `constraints` — the "use a dedicated counting primitive when COUNTING
  ITSELF is the objective" carve-out stays true (still means `counting_next`
  scope), but consider one clause distinguishing "counting itself" from "naming
  a written numeral" so the steering reads consistently with the new mode.
- `:321-354` `evalModes` array — insert a new entry, ordered FIRST (lowest β,
  easiest — pure perceptual/production naming, no computation, matching the
  `di-shapes.name_shape` β=1.5 precedent in the backend registry):
  ```ts
  {
    evalMode: 'name_numeral',
    label: 'Name the Number',
    beta: 1.5,
    scaffoldingMode: 1,
    challengeTypes: ['name_numeral'],
    description: 'See one printed numeral, say its name aloud — recognition and production, no computation.',
  },
  ```
  Re-check `counting_next`'s β (currently 1.5, first in the list) — two modes
  sharing β 1.5 at scaffoldingMode 1 is fine (both are the ladder's floor), but
  confirm this reads right once both exist side by side; nudge `counting_next`
  to 1.75-2.0 if the calibration owner wants them ordered rather than tied.

**4. Backend `backend/app/services/calibration/problem_type_registry.py:573-578`**
  — mirror the catalog β exactly. Add
  `"name_numeral": PriorConfig(1.5, "Production: name a printed numeral aloud with the number word"),`
  ahead of `"counting_next"`. No `discrimination_priors.py` entry exists for
  `di-math-facts` today (falls back to the 1.4 default) — leave it that way
  unless the calibration owner wants an explicit `a` value.

**5. `src/components/lumina/primitives/visual-primitives/direct-instruction/DiMathFacts.tsx`**
- `:171-174` `TASK_PHRASE` (misconception-evidence description map, keyed by
  `challengeType`) — add
  `name_numeral: 'naming a printed numeral aloud (recognition/production, no computation)',`
  TypeScript will force this once the union grows — it is not optional.
- Everything else (`display` rendering at `:852`/`:878`, the eval/context
  wiring at `:387-388`, `:683-739`) is already generic over `challengeType` —
  confirmed no other branch keys off it by name.

### Gates

- Non-vacuity: a focused unit test that builds a `name_numeral` session from
  the exact census objective text ("Recognize and name the written numbers 1
  through 10 in order") and asserts the pool is `{1..10}` (not `{0..4}` from a
  silent grade-default fallback, and not empty) — this is the test that would
  have FAILED before the `resolveTextScope` regex fix and passes after.
- `typecheck:lumina` 0; tsc 0 NEW vs baseline; existing
  `gemini-di-math-facts.test.ts` / `.remediation` suites stay green (adding a
  union member must not break the `ALL_TYPES`-driven mixed-spread tests).
- Real-pipeline probe: `/topic-trace?topic=Recognize+and+name+the+written+numbers+1+through+10+in+order&gradeLevel=kindergarten&package=true`
  pinned via `config.targetEvalMode: 'name_numeral'` in the eval-test route
  first (isolated dev port if :3000 is busy), THEN unpinned to confirm
  selection + resolution both land once the catalog description change ships
  (see the earlier session turn: a description-only edit without the mode
  itself would just mis-resolve into an existing wrong mode — verify BOTH
  layers together, not selection alone).
- **The actual acceptance gate for this whole slice**:
  `node scripts/lesson-coverage.mjs eval` on a fresh regeneration of this
  topic — obj2 should move from `ASSESSED_INDIRECTLY [WARNING]` to
  `ASSESSED_SUFFICIENTLY`. Compare against
  `qa/lesson-bench/packages/kindergarten-counting-objects-to-10-20260905174750-c71j.json`
  (the row that opened item 20) — before/after table, not "should work."
- Live ear-check: this is a NEW spoken response class inside an already-benched
  primitive (single number words, same class as `counting_next`/`answer_fact`
  — not a NEW class per DI standing gate 1, since the answer space is still
  0-20 single words), so a full bench sitting is not required, but one
  `run_tutor_live.py --lesson --runs 3` pass pinned to `name_numeral` is the
  minimum live confirmation before calling the mode shipped — file the
  HUMAN-CHECKS row if the live pass surfaces anything.

### Bookkeeping

- Strike `qa/lesson-bench/BACKLOG.md` item 20's "Executor" line to point at
  this handoff once work starts; close it with the before/after
  `lesson-coverage confirm` table once it lands.
- `WORKSTREAMS.md` Lesson Bench row: "last touched" + one line on the shipped
  mode.
- If the scope question above gets a ruling (mode on `di-math-facts` vs a
  separate pack), record it as a memory (`feedback_*` if it reverses this
  handoff's default, `project_*` if it confirms it) — it is exactly the kind
  of non-derivable decision that belongs in memory, not just in this file.
