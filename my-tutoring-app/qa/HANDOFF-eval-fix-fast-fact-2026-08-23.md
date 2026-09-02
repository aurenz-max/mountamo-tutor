# HANDOFF — Eval-fix FastFact L1 semantic mode bleed

Paste-able continuation prompt. Authored 2026-08-23 from a live
`/add-eval-modes fast-fact` session. Executor: `/eval-fix fast-fact`, serial.
The new L1 wiring is already in the working tree; do not restart the migration.

## The prompt

Finish the FastFact L1 eval-mode migration and close FF-4 only after repairing
the confirmed `apply` semantic bleed.

The requested ladder is:

- `recognize` — translate a visible/symbolic/pictorial cue to its name or value
  (β 2.5, a 1.2, scaffolding mode 2).
- `recall` — retrieve one directly requested fact without an answer-bearing cue
  (β 3.5, a 1.2, scaffolding mode 3).
- `apply` — use a fact in a short context, cloze, comparison, or reverse
  association (β 5.0, a 1.2, scaffolding mode 4).

### Hook decision already made

Do **not** constrain `challenge.type`. FastFact already uses `type` as the
presentation-phase key for `PhaseSummaryPanel`, and pinned sessions still need
2–3 phases. The migration adds a separate per-challenge `challengeType` as the
stable eval identity. The eval-test harness now prefers `challengeType` when a
challenge also carries a phase `type`.

Anchors in the current working tree:

- Generator docs/schema/resolver/support:
  `src/components/lumina/service/core/gemini-fast-fact.ts:26`, `:32`, `:109`,
  `:708`, `:742`, `:789`, `:800`, `:880`.
- Component contract + tutor context:
  `src/components/lumina/primitives/visual-primitives/core/FastFact.tsx:44`,
  `:286`.
- Catalog ladder:
  `src/components/lumina/service/manifest/catalog/core.ts:356`.
- Backend β priors:
  `backend/app/services/calibration/problem_type_registry.py:920`.
- Backend multiple-choice discrimination priors:
  `backend/app/config/discrimination_priors.py:159`.
- Eval-test field priority:
  `src/app/api/lumina/eval-test/route.ts:363`.
- Registration is already context-native:
  `service/registry/generators/coreGenerators.ts:405`; `GenerationContext`
  centrally carries `targetEvalMode`, intent/objective, and support tier. No
  adapter change is needed.

## Confirmed runtime evidence

The local app server was live at `http://localhost:3000`. Real Gemini generation
produced the following:

| Case | Result | Challenge identities | Phases | Support shape |
|---|---:|---|---|---|
| `recognize` / element symbols | PASS 10/10 | `recognize` only | 3 phases | baseline |
| `recall` / state capitals | PASS 10/10 structurally | `recall` only | 2–3 phases | baseline |
| `apply` / state capitals | **semantic FAIL** | stamped `apply` 10/10 | 2 phases | baseline |
| explicit `mixed` | PASS 10/10 | all 3 identities present | 2 phases | baseline |
| `recognize|apply` blend | PASS 10/10 | exactly those 2 identities | 2 phases | baseline |
| `recall&difficulty=easy` | PASS 10/10 | `recall` only | 2 phases | 3 options, 2 attempts, `easy` stamp |
| `recall&difficulty=hard` | PASS 10/10 | `recall` only | 3 phases | 4 options, 1 attempt, `hard` stamp |

All runs had 10 challenges, no missing prompts, and at least two usable answer
options. Mixed honestly covered all three identities; this generator is not the
Fork-A one-root-type architecture, so no SP-21 mixed builder is required.

### The actual failure — candidate FF-5 until recorded

The `apply` state-capitals draw stamped every item `challengeType: "apply"`, but
the first **5/10** were ordinary direct recall:

- `What is the capital city of Texas?` → `Austin`
- `What is the capital city of California?` → `Sacramento`
- `What is the capital city of New York?` → `Albany`
- `What is the capital city of Florida?` → `Tallahassee`
- `What is the capital city of Washington?` → `Olympia`

Only the final 5/10 honored the mode via reverse association, e.g.
`Denver is the capital of which US state?` → `Colorado`. The `recall` control was
correctly direct state → capital throughout. Therefore the schema and resolver
are wired, but the semantic identity is partly cosmetic.

Classification:

| Issue | Severity | Pattern | Category | Location |
|---|---|---|---|---|
| candidate FF-5 — `apply` semantic bleed | HIGH | SP-3 cross-contamination | PROMPT-CHANGE first | `CHALLENGE_TYPE_DOCS.apply` |

## Required Phase-2 proposal — approval is still pending

The originating session proposed this fix, then the user requested this handoff
instead of approving implementation. Per `/eval-fix`, present the proposal and
wait before editing:

> Strengthen `CHALLENGE_TYPE_DOCS.apply` so every apply item must use at least one
> binding application shape: reverse the learned association, place the fact in
> a cloze/context, compare two factual cases, or choose the fact that resolves a
> short scenario. Explicitly forbid a direct cue → memorized partner question
> such as state → capital, term → definition, or element symbol → name in this
> mode; those belong to `recall`/`recognize`. Preserve the schema, phase system,
> answer-integrity guards, topic scope, support tiers, and the other two modes.
> Risk: prompt-only semantic binding is stochastic across subjects, so `apply`
> must pass repeated cross-domain runtime probes before FF-4 closes.

Why prompt first: there are only three modes and the JSON structure is correct;
this is SP-3 level 1. Do **not** add a string/regex post-validator for “context”
or “reverse” — those semantics are not safely decidable across every subject
FastFact serves and rejection could shorten the drill below its automaticity
floor. If the tightened prompt still bleeds repeatedly, stop and propose a
focused per-mode prompt fork/schema simplification rather than piling on a
semantic validator.

## Verification already green

- `vitest` focused generator + oracle suites: **2 files / 62 tests pass**.
- `npm.cmd run typecheck:lumina`: **0 errors**.
- `python -m py_compile` for both backend prior files: PASS.
- Project-wide `tsc --noEmit` remains unusably red with ~1,020 pre-existing
  errors across unrelated legacy app code. It showed no evidence of a scoped
  FastFact regression; use the clean Lumina gate and compare global baseline if
  needed.

## Required post-fix gates

1. Run `apply` at least 3 times and read every prompt, not just
   `validation.typesFound`. Use at least two domains (state capitals plus element
   symbols, vocabulary/sight words, translations, or math facts). Every item must
   exhibit a binding apply shape; a correct `challengeType` stamp alone is not a
   pass.
2. Re-run `recognize` and `recall`; confirm semantic differentiation and 10/10
   identity constraints.
3. Re-run explicit `recognize|apply` and `mixed`; blend must contain only the two
   requested identities and mixed must cover all three.
4. Re-run one easy/hard support sweep on a single pin. Deterministic contract:
   easy = 3 options / 2 attempts / easy stamps; hard = 4 options / 1 attempt /
   hard stamps. Preserve load-bearing `promptSubtext` (it may contain the cloze).
5. Apply eval-test G1–G5 and the existing FastFact oracle. Confirm exactly one
   answer grades correct, no visual/stem answer leaks, and no empty/short drill.
6. Re-run the focused 62 tests, `typecheck:lumina`, and backend `py_compile`.

Example endpoint:

```text
http://localhost:3000/api/lumina/eval-test?componentId=fast-fact&evalMode=apply&topic=US%20state%20capitals&gradeLevel=grade%204
```

If the server is unavailable, start it from `my-tutoring-app` with
`npm.cmd run dev`.

## Bookkeeping after all runtime gates pass

- Write `qa/eval-reports/fast-fact-2026-08-23.md` with the three pins, blend,
  mixed, and support sweep. The existing 2026-08-06 report is the answer-contract
  history; do not overwrite it.
- Update the FastFact dashboard row in `qa/EVAL_TRACKER.md` from L0 `default` to
  the three L1 modes and link the new report.
- Strike open FF-4 only after semantic apply passes. Record the same-slice
  semantic bleed/fix as FF-5 (or fold it into the FF-4 resolution with explicit
  evidence); do not leave a transient open row after it is closed.
- Recalculate dashboard totals from the current file on disk. The old snapshot
  was 384/401; replacing one L0 default with three passing modes would be a net
  +2 passed / +2 total, but shared tracker edits may have moved those numbers.
- Add an entry to Resolved Issues describing: separate phase/eval identity,
  schema-enum constraint, intent routing, β/a registry parity, honest mixed/blend,
  support-tier wiring, and the apply semantic correction.

## Working-tree ownership

Scoped uncommitted changes already present and owned by this task:

- `backend/app/config/discrimination_priors.py`
- `backend/app/services/calibration/problem_type_registry.py`
- `my-tutoring-app/src/app/api/lumina/eval-test/route.ts`
- `my-tutoring-app/src/components/lumina/primitives/visual-primitives/core/FastFact.tsx`
- `my-tutoring-app/src/components/lumina/service/core/gemini-fast-fact.ts`
- `my-tutoring-app/src/components/lumina/service/manifest/catalog/core.ts`

Unrelated dirty files belong to other work and must be preserved:
`.claude/settings.local.json`, `WORKSTREAMS.md`, tutor-live tests, coverage/DI
backlogs, and DI bench/drive-plan files. Re-read shared files before editing.

No eval report or tracker update has been written yet, and nothing has been
committed or pushed.
