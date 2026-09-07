# knowledge-check redesign — P0–P3 pilot, 2026-09-05

Executes `qa/HANDOFF-knowledge-check-redesign-2026-09-05.md` (lesson-bench BACKLOG item 25;
di item 23 slice 3). Evidence: `knowledge-check-redesign-2026-09-05.json` / `.log` (run 2, all
five packages) and `…-fix2.json` / `.log` (addition + shapes after the two mapping fixes).
Probe: `scripts/probe-kc-redesign.mjs` — live `generateKnowledgeCheck` with the package's
objectives → oracle → runtime script gate → the KC block swapped into the frozen package →
coverage judge (rows in `qa/lesson-coverage/evals.jsonl`, source `kc-redesign-p3`).

## Review verdict on the handoff

Agreed: the three structural gaps, the design principle (per-objective sampler of PRODUCTION
items over a SHOWN stimulus, set-sized in code), the P0→P1→P2→P3 order, the pilot on K
subtraction. Two corrections applied while building:

1. **`namedSet` is not "the DSP-1 helper generalised".** DSP-1's set extraction is a model plan
   with a review pass. The redesign needs the set in CODE before any model call, so
   `service/objectives/namedSet.ts` is a new lexical extractor over a small K-2 vocabulary
   (symbol names beside a sign/symbol word, single letters, shape names, numeral ranges ≤10).
   What it does not recognise is a reported residual, never a guess.
2. **The kinds need a DATA type, not only a planning vocabulary.** Every kind must survive a
   no-mic device, so one new `ProblemType 'production'` carries the stimulus, the spoken
   answer, and a closed fallback menu. Judged surface: the child produces. Tap surface
   (`ProductionProblem.tsx`): the menu. That is how R2 forks honestly and how the
   all-or-nothing rule survives.

§10 decisions: (1) `minutes` NOT raised — the K budget is 8 items and the count delta is
logged; (2) `point_to` at K, `say_it` from G1 — built as recommended; (3) kinds-as-eval-modes
deferred (registry + backend slice).

## What shipped (working tree, uncommitted)

- **P0** `service/insets/` — one shared inset module (schema, guidance, serializer, per-type
  leak rules, code builders). `annotated-example/inset-helpers.ts` is a re-export shim. KC's
  duplicate `getInsetSchema`/`buildInsetPrompt` deleted (−7.8 KB).
- **P1** insets `number-sentence`, `arrangement` (row / ten-frame / scattered / take-away /
  two `groups`), `glyph-card` (numeral / letter / word / operator / shape — shapes draw the
  di-shapes exemplar table, so a rectangle is never a squarish polygon). Renderers +
  `NumberSentenceTokens` (the one tappable form). `findInsetAnswerLeaks`: one rule per type,
  seeded-leak tests per type.
- **P2** `knowledgeCheckScript.ts`: `say_it` (class narrows per card), `how_many`
  (`number_word_to_20`; counting aloud = thinking), `point_to` (gesture over token positions).
  Contracts carry the blind-tutor stimulus description; harness answers name a signature
  wrong per kind. `KnowledgeCheck.tsx` renders the stimulus; `point_to` is the one on-screen
  commit. Oracle `checkProduction`; PRE floor admits `production` (R2 fork, contract changelog).
- **P3** `knowledgeCheckPlan.ts`: slots = Σ max(2, |named set|), one per element, K budget 8
  (generic angles dropped first, never an element). Verb→kind table in code; EXPLAIN verbs and
  letter SOUNDS stay legacy. `productionGenerator.ts`: code-only builders, no model call.
  Orchestrator gets `problemCount` per legacy objective (it briefs slots, does not size them).

## Coverage judge, before → after (five KC-only packages)

| Package | Before | After | KC items per objective (after) |
|---|---|---|---|
| `…e1b7` subtraction | PASS 1.00 (obj2 by a lucky "=" draw) | **PASS 1.00**, 0 model calls | obj1 how_many ×2 · obj2 point_to − and = |
| `…mb4f` subtraction (KC-1's package) | WARN 0.75; obj2 INSUFFICIENT n=2 | **PASS 1.00**; obj2 SUFFICIENT n=7 | obj1 ×2 · obj2 − and = |
| `…99mt` shapes | obj3 INSUFFICIENT n=2 | WARN 0.83; obj2 kc 1→4 (all four shapes named) | obj1 legacy ×2 · obj2 say_it ×4 · obj3 legacy ×2 |
| `…xr70` addition | obj2 INSUFFICIENT n=5, obj3 INSUFFICIENT n=1 | FAIL 0.67; **obj2 SUFFICIENT n=11** (+ and =); obj3 TAUGHT_NOT_ASSESSED | obj1 how_many (two groups) ×2 · obj2 point_to ×2 · obj3 legacy ×2 |
| `…rw3p` CVC (legacy-only control) | obj1 INSUFFICIENT n=3 | **PASS 1.00**; obj1 SUFFICIENT n=4 | 6 legacy (count 5 → 6, 2 per objective) |

Of the handoff's five KC-only failures (S2): subtraction equals-sign, CVC obj1 → **closed**; CVC
obj3 was already sufficient on this package. Addition obj3 "explain… bigger number" and shapes
obj3 "compare by sides and corners" **stay open — they are P4 kinds** (`which_reason`,
`which_one` over two cards); the plan routes them to legacy slots and says so.

Runtime gates per package: oracle 0 violations on every production item; judged-viable on
e1b7 / mb4f / xr70 / 99mt (fix2); pack gates clean (the first xr70 run tripped the repeat-ask
gate on two byte-identical 14-word `how_many` asks — asks are now ≤4 words, the how-to-play
line carries the framing once). The one remaining oracle hit (99mt `clustering`) is on the
orchestrator's legacy MCQs — pre-existing class.

## Machine gates

tsc **770 = baseline** (dirty tree) · `typecheck:lumina` **0** · vitest targeted 741/741, full
suite 4770/4770 before the last two edits (re-run after). New tests: `namedSet.test.ts`,
`knowledgeCheckPlan.test.ts`, `insets/leaks.test.ts`, `productionGenerator.test.ts`,
`KnowledgeCheck.production.di-script.test.ts` (shared pack gates + catalog contract on a mixed
production set). Build-over-ceremony: ~1,700 production lines (incl. 330 moved) + 660 modified
vs ~660 test lines.

## Owed (named)

- **Browser + mic:** HUMAN-CHECKS **#135** (renderers on a tablet, `point_to` commit on the
  judged surface, tap-surface fallback, a counting-aloud child). Headless
  `run_tutor_live.py --component knowledge-check --di --runs 3` on a production set.
- **P4:** `picture-scene`, `spoken-cue`, `read_it`, `sort_one`, `which_reason` — closes
  addition obj3 / shapes obj3 / CVC read-the-word / letter-SOUND objectives.
- **P5:** journey adapter reads production items as production evidence; β per kind
  (`problem_type_registry.py`); kinds as eval modes (§10.3).
- Legacy MCQ answer-leak / clustering on shapes (orchestrator side) — pre-existing class.
