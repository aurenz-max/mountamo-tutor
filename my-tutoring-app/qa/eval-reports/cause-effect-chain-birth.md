# Birth Certificate — cause-effect-chain (2026-09-03)

**Lifecycle layer: L5 (judged loop, port 25) as of 2026-09-03** — born L0 on 2026-09-03 and laddered L1→L5 the same day; rows below are struck as each rung landed.
**Second primitive of the history domain** (PRD_HISTORY_SOCIAL_STUDIES_SUITE #4, Wave 1) — rides the
scaffolding `era-explorer` created on 08-23 (`catalog/history.ts`, `service/history/`,
`historyGenerators.ts`, `history → SOCIAL_STUDIES` backend scoping); adds the domain's first
**tester panel**, which `era-explorer` never had.

- Core task identity at birth: **`build_chain`** — given an outcome and a shuffled bank of event
  cards, place the causes in the order that made each next thing possible. The PRD's other two
  phases (Identify, Analyze) are ladder rungs, not birth scope.
- Generator fork: **B (content-bearing), single-call topic-coherent variant** — one Gemini call
  emits the shared background + `challenges[3..5]`. N parallel calls would each reach for the
  topic's most obvious causal story and ship the same chain N times. Model:
  `gemini-flash-lite-latest`, flat `cause0..cause3` fields (the nested-array workaround),
  retry-once → curated fallback.
- **Answer ownership:** Gemini emits the causes *in causal order* and nothing else. Code assigns
  the ids, derives `correctOrder` from that order, then shuffles the bank. The answer exists only
  as a permutation the model was never asked to encode, and `shuffleAwayFrom` re-draws (then
  force-swaps) until the on-screen order provably is not it.
- sendText tags wired: `[ACTIVITY_START]`, `[ANSWER_CORRECT]`, `[ANSWER_INCORRECT]`,
  `[NEXT_ITEM]`, `[ALL_COMPLETE]`, `[CHAIN_READ_ALOUD]`.
- **Answer-leak audit:** cards are rejected for sequence words ("first", "then", "finally"),
  causal connectives ("because", "led to", "as a result") and years — each sorts the chain with
  no causal thought. Also rejected: near-duplicate cards, a cause restating the outcome, a chain
  under 3 cards. Hints are audited softly (a hint naming a position is dropped, not fatal). The
  shared `context` is instructed never to say what caused what. On a wrong check the chain grades
  **all-or-nothing** — marking individual slots would hand back which cards are already right and
  make try 2 a different, easier question. `explanation` renders post-answer only.
- Design gate (Phase 2):
  1. Direct manipulation — **pass**: the student picks up event cards and places them; the chain
     they build IS the causal claim being assessed. Tap-to-place, not HTML5 drag (mobile, and
     [[svg-g-unclickable-jsdom-blind]]).
  2. Living simulation — **chosen exception**: historical causation is an argument structure, not
     a physical system. The nearest honest thing — the chain assembling and re-flowing under the
     student's hand — is what ships. Same archetype exception `era-explorer` took.
  3. Production over recognition — **pass**: an ordering of 3-4 cards is 6-24 arrangements the
     student produces, not a 1-of-3 choice. This is why the two-card chain the first live run
     produced was treated as a defect, not a grade band.
  4. No timers — **pass**: none rendered; `elapsedMs` captured silently.
  5. No answer-leak by layout — **pass**: audited above and enforced in generator code + tests.
- Curriculum home: **MATCH at both grades that could be probed** — G1 `SS004-02` @ 0.723 (4/5),
  G2 `SS004-03` @ 0.733 (4/5), both in the SS004 timeline / change-over-time family. G3-G6 blocked
  on a Gemini embedding 429, **not** on curriculum. See
  `qa/curriculum-fit/cause-effect-chain-2026-09-03.md` — which also files a probe defect: a 429
  during subskill embedding is reported as `ABSTAIN [no_scope]`, indistinguishable from a genuinely
  unpublished grade, so a sweep would file phantom curriculum gaps.

## Follow-up queue (run in order — each skill is the single source of truth for its layer)

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| **0** | **browser drive** | **verification debt → mechanical half CLOSED 2026-09-03** | Headless Chromium drive, 25/26 (the miss a selector artefact, confirmed by screenshot): every interaction below held, at easy and hard. What remains is #124's human half — phone width, hearing the tutor, and whether the order is *defensible*. Original: **Do this first.** The render tree has never run in Chrome. `Dev → History Primitives` → pick Cause & Effect Chain → Generate. Watch: tap-to-place fills the earliest empty slot; tapping a placed card returns it; a wrong check shakes the whole chain (not per-slot); the second wrong check reveals the true order and the explanation stays readable until "Next Round". The same panel closes `era-explorer`'s identical debt. |
| ~~1~~ | ~~`/add-eval-modes`~~ — **DONE 2026-09-03** | ~~L1 eval-dense~~ | [report](cause-effect-chain-evalmodes-2026-09-03.md). Shipped **3 of the 5** candidates — `identify_cause` β 2.0 / `build_chain` β 3.5 / `root_vs_proximate` β 6.0 — all three off ONE emission, so the ladder cost one new field family (the two non-cause cards). `label_link` and `divergence` **QUEUED**: each needs a second content shape, and this schema already carries the flash-lite flat-field workaround. Two things the scoping below got wrong: `challenges[].type` did NOT protect the mixed path — nothing wrote it, so code assigns the rung outright and SP-21 is unreachable rather than audited; and **the primitive had no catalog entry at all**, fixed here. Original scoping: Ladder candidates, all from the PRD's own metrics block: `identify_cause` (which cards are causes of this outcome vs. consequences/background — the locate rung under `build_chain`, β ~2.0) · `build_chain` (the birth anchor, β ~3.5) · `label_link` (name the connection type — caused / enabled / accelerated / prevented — over a chain already built, β ~5.0) · `root_vs_proximate` (which cause was the root, β ~6.0) · `divergence` (one cause, several effects — the PRD's G5 rung, β ~5.5). Note `challenges[].type` already exists per challenge, so the mixed path cannot become a lie (SP-21). `challengeType` at the session root and `CauseEffectChainMetrics.challengeType` both widen. |
| ~~2~~ | ~~`/add-tutoring-scaffold`~~ — **DONE 2026-09-03** | ~~L2 tutored~~ | [report](cause-effect-chain-tutoring-2026-09-03.md). Shipped all 10 contextKey candidates below MINUS `chainLength`: on an `identify_cause` round it is the cardinality of the answer set, and TU-6 says the RUNTIME STATE block gets read aloud, so a key protected only by a directive is not protected. Rule this produced: **every contextKey here must be harmless SPOKEN.** The NEVER-NAME-A-SLOT directive shipped and held, but the live drive found the scoping below missed a channel: the tutor pointed at a card by its ACTOR (*"put yourself in the shoes of the pioneers"*) without quoting a word of it — invisible to the whole-string leak oracle and passed by the LLM judge. Directive clause + journey oracle added; re-driven 0/3. Also: level 3 walks the METHOD on borrowed material, because there is no honest step-by-step through a permutation. Original scoping:  contextKeys candidates (all component-resolved today in `aiPrimitiveData`): `title`, `gradeLevel`, `periodLabel`, `challengeType`, `question`, `challengeIndex`, `totalChallenges`, `outcomeText`, `chainLength`, `slotsFilled`. Struggles to write up: ordering by *narrative* plausibility rather than by what had to exist first; treating the outcome as one of the cards; picking the most *important* cause as the earliest; an emerging reader who cannot read the cards (the read-aloud path is already wired). Hard directive needed: **NEVER NAME A CARD'S SLOT** — the whole task is the permutation. |
| ~~3~~ | ~~`/add-support-tiers`~~ — **DONE 2026-09-03, paired with 4** | ~~L3 tiered~~ | [report](cause-effect-chain-tiers-2026-09-03.md). Shipped all four levers scoped below — strategy line (easy only), category label (icon stays), slot numbers, hint gate — per challenge, on the live path and the fallback, plus a `TUTOR_REVEAL` clause on the silent sends (as a sentence, never a contextKey: TU-6). Original scoping: Scaffolding intrinsic to the interaction that could withdraw: `MODE_META.strategy` is already written and deliberately unrendered — surface it at easy only (instruction-as-scaffold). Others: the **category chip** on each card (a shared category hints at grouping; withdrawing it at hard is a real lever, but the **icon** must stay — it is the emerging reader's channel); the number badge on each slot; whether `hint` is offered at all. `MAX_TRIES` is NOT a lever (it changes the score, not the scaffold). |
| ~~4~~ | ~~`/add-structural-difficulty`~~ — **DONE 2026-09-03, paired with 3** | ~~L4 shaped~~ | Same report. **Link distance** shipped as scoped (`inferredLinks`, over-generate → measure → select, chain length untouched): build_chain G3 easy links 1,0,0,0,0 vs hard 2,2,3,3,1. Second lever the scoping missed: `identify_cause` gets **background nearness** — and NOT consequence nearness, which is lexically unreachable because a consequence is about the same things by definition. Three things the sweep taught: describing words ("heavy", "warm") anchor unrelated cards (era-explorer's `lens_id` residual, same class); "same NOUN not a synonym" is what makes easy land at G5; and **the untiered path was falling back 2/2 on the tester's own topic** — the 5-8 pool is now unconditional, 2/2 live after. Original scoping: (requires L3) The axis is **link distance**: at easy, adjacent links are obviously dependent (a thing is built, then used); at hard, one link is indirect and the chain needs an inference to close. Chain LENGTH is already spoken for by grade fidelity (`chainLengthFor`) — do not re-use it as the tier knob, or the two axes fight. Enforcement will have to be over-generate → measure → select, as with `era-explorer`, because cards are prose. |
| ~~5~~ | ~~`/add-sound`~~ — **DONE 2026-09-03, folded into 6** | ~~L5 polished~~ | Structurally small and stated as such: `tap()` on place/remove stays, the placement that COMPLETES the chain is a choice committed → `select()`, and correct/incorrect moved off the deleted Check press onto the runner's verdict (the component adds no second `playCorrect`). No completion flourish: with the stillness close, a sound between the last placement and the verdict would read as a verdict. Original: Already wired: `SoundManager.tap()` on place/remove, `playCorrect`/`playIncorrect` on check. Candidate additions: a distinct "card lands in a slot" tick vs. "card returns to the bank", and a chain-completion flourish when the last slot fills (before the check, so it rewards the build). |
| ~~6~~ | ~~`/add-di-loop`~~ — **DONE 2026-09-03 (port 25)** | ~~L5 strong form~~ | [block](../di/BACKLOG.md) (item 29), mic row #130. The scoping below was half right: `root_vs_proximate` is the closed-set spoken rung it predicted, and `build_chain` stayed a HANDS rung (the arrangement IS the answer — the skill's third unsayable shape, stillness-closed, matched in code). What it missed: `identify_cause` is not a closed set at all, it is ONE SPOKEN YES/NO PER CARD — defect class 1, the five-card set-pick expanded into the per-card verdict a child can say, balanced so one word scores at chance. Drives: identify 10/10 refused + affirmed, hands 5/5, pick 5/5 after one wording fix ("that was the last thing" tripped the completion tripwire). The tutor-reveal residual below is RETIRED by construction; the G5 chain-length residual stands. Original: **Strong candidate but NOT yet.** The judged loop wants a closed set the tutor can judge from audio; a permutation of prose cards is not one. The natural spoken form is *"tell me which of these had to happen first, and why"* — which is `identify_cause` / `root_vs_proximate` (rungs 1 and 4 above), not `build_chain`. Do the eval-mode ladder first, then port the closed-set rung. Doctrine: `docs/SPOKEN_INTERACTION_DOCTRINE.md`. |
| ✓ | `/eval-test cause-effect-chain` | QA loop | L2 adds a Tier-3 tutor drive (5 Live sessions, 2 oracle defects fixed) — `run_tutor_live.py --component cause-effect-chain`, and run it with `backend/venv/Scripts/python.exe`. Birth: 5 live runs (G1/G3/G5/G6, 4 topics) — 1 FAIL that produced two real fixes, then 4 PASS. Plus a 27-test offline audit gate, mutation-checked. Re-run after EVERY layer. |

## Residuals — known and named

- **Semantic near-duplication is only partly closed.** The theme field + word-overlap floor catch
  a model that repeats an event; they cannot catch four structurally identical chains given four
  different theme labels. The prompt carries the real weight. Watch for it in the L1 runs.
- **Two grades unprobed for curriculum fit** (429, not a gap) — command to re-run is in the fit
  report.
- **NO CATALOG ENTRY.** Found and fixed by rung 1 on 2026-09-03, but it belongs here: the birth
  shipped `cause-effect-chain` into `types.ts`, `primitiveRegistry`, `evaluation/types.ts`, the
  generator registry and a tester — everywhere except `catalog/history.ts`, the one file the
  manifest reads. Every gate was green and the primitive was unreachable by a lesson. The Files
  table below LISTS the catalog, which is how it read as done. A tester that renders is not a
  catalog entry, and nothing at birth distinguished them.
- **The probe's `no_scope`-on-429 defect** is a `/curriculum-fit` bug, filed in the fit report,
  not fixed here.
- **G5 ships 3-card chains** (found by the L3/L4 sweep, 4/4 G5 runs). `chainLengthFor('5') = 4`
  but attempt 1 rejects and attempt 2 degrades to the floor every time. Grade fidelity at G5 is
  not landing live. Executor `/eval-fix`; first look: flash-lite ignoring "EXACTLY 4" while
  `cause3Text` is nullable.
- **The tutor reveal clause (L3) has not been heard.** `run_tutor_live.py` replays the sends
  without a tier; needs a `--difficulty` flag. Executor `/tutor-test`.

## Files

| Kind | Path |
|---|---|
| Component | `src/components/lumina/primitives/visual-primitives/history/CauseEffectChain.tsx` |
| Generator | `src/components/lumina/service/history/gemini-cause-effect-chain.ts` |
| Audit gate | `src/components/lumina/service/history/gemini-cause-effect-chain.audit.test.ts` |
| Tester (new, domain-wide) | `src/components/lumina/components/HistoryPrimitivesTester.tsx` |
| Catalog | `src/components/lumina/service/manifest/catalog/history.ts` |
| Generator registry | `src/components/lumina/service/registry/generators/historyGenerators.ts` |
| Types / registry / metrics | `lumina/types.ts`, `config/primitiveRegistry.tsx`, `evaluation/types.ts`, `evaluation/index.ts` |
| Dev panel wiring | `components/DevPanelRouter.tsx`, `components/IdleScreen.tsx` |
