# TypeSafe (System One) lane — ledger

TypeSafe answers typed Choice / Score / Noul questions over a state and returns probabilities
with confidence. It does not generate text. Key: `TYPESAFE_API_KEY` in `.env.local`. Client and
selector: `src/components/lumina/service/manifest/typesafe/`. Every bench here is code-scored
against labels that predate it.

## State (2026-09-16)

| # | Question | Verdict | Report |
|---|---|---|---|
| 1 | Can it pick primitives for a manifest? | **No** as a replacement. Agreement with the curator 23–28%; structural — 46% of curator picks are phase scaffolds a semantic ranker cannot pick. Right on specialists where it disagrees. | `bench-2026-09-16T03-00-59.md` |
| 2 | As a suggestion block in the curator prompt? | **Shipped opt-in, default off.** Strict form safe; take rate 46% → 56%; otherwise inside the curator's own 44–49% run-to-run variance. Flag `LUMINA_TYPESAFE_SUGGESTIONS`, failsafe in `specialistSuggestions.ts` (4 s budget, breaker, 7 tests). | `suggest-ab-2026-09-16T03-16-17.md`, `suggest-ab-typesafe-strict-2026-09-16T03-20-20.md` |
| 3 | Does it beat the embedding retrieval (objective → subskill)? | **No as a ranker** (skill@1 82% vs 88%; hierarchical arm worst at 68%). **Yes as a gate**: confidence separates right from wrong where cosine is flat; agreement gate 95% skill precision at 78% coverage. Production coherence gate is below ungated argmax. | `retrieval-bench-2026-09-15T23-39-33.md` |
| 4 | Verify-and-gate on the misconception loop? | **Verify, never replace.** Distiller 96% / planner 100% on their labeled sets — nothing for a gate to catch there. `supported` + `leaks` Nouls separate hypotheses 28/28 and agree with the human 14/14 out of sample; TypeSafe leans "rule" on 3/6 human-agreed abstains, so it must not decide. | `misconception-bench-2026-09-16T13-32-27.md` |
| 5 | Ship verification as an optional pipeline? | **Shipped, default off.** `service/typesafe/verify.ts`: named Noul checks with an expected side and threshold; `LUMINA_TYPESAFE_VERIFY=off\|shadow\|gate`. Consumers: `distillMisconception` (hypothesis `supported`+`leaks`) and `distillLearningObservation` (draft `supported`+`leaks`). Shadow attaches the verdict and logs `[typesafe-verify]`; gate turns a failed output into an abstain and keeps `rejectedText`. Failsafe: 3 s budget, breaker, never throws; 22 tests. Runtime: shadow server over the 48 golden packets → 29 written hypotheses, 0 would be rejected, +317 ms each. | `verify-shadow/misconception-bench-*.md` |

Each report ends with a **Reading** section: the judged interpretation, caveats, and the disagreements
that were read by hand.

## Rulings owed (user)

- **(a)** Turn `LUMINA_TYPESAFE_SUGGESTIONS=strict` on for a judged-quality study — blocked while Lesson
  Bench is PAUSED; needs 6–8 subskills × 3 runs × {control, strict} under a quality judge.
- **(b)** Authorize a TypeSafe confidence- or agreement-gated verifier on the generation-context
  objective → subskill path. Precondition: re-run `backend/scripts/typesafe_retrieval_bench.py` on
  CHALLENGE text (the bench used objective paraphrases). Finding for the retrieval owner regardless:
  the coherence gate abstains on correct argmaxes and re-attributes.
- **(c)** BUILT 09-16 as row 5 (`verify.ts`, both distillers, default off). What remains is the mode
  decision below; Probe D's judge in `/misconception-test` can call the same `HYPOTHESIS_CHECKS`.
- **(d)** Run `LUMINA_TYPESAFE_VERIFY=shadow` in normal dev/pilot traffic and read the `[typesafe-verify]`
  lines for a while; promote to `gate` when the shadow rejections have been read by hand and none is a
  wrong rejection. The golden set showed 0/29; real thin packets are where a rejection would first appear.

## Not pursued

Eval-mode resolver replacement (74–76% agreement, leans harder than the resolver); planner or
distiller replacement (less conservative on thin real evidence); whole-manifest generation
(cannot author prose). Pricing is still unverified — check console.typesafe.ai before any
production traffic.

## Scripts

`scripts/typesafe-manifest-probe.mjs` (one topic, `--compare`) · `scripts/typesafe-bench.mjs`
(N published subskills) · `scripts/typesafe-suggest-ab.mjs` (`--arm strict|loose`) ·
`backend/scripts/typesafe_retrieval_bench.py` · `scripts/typesafe-misconception-bench.mjs`
(`--probes A,B,C,D`). All need the dev server on :3000; the retrieval bench needs the backend venv.
