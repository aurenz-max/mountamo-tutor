# cause-effect-chain — L1 eval modes (2026-09-03)

**Lifecycle: L0 → L1.** The ladder is the PRD's own three phases, not three sizes of one task.
Rung 1 of the birth certificate's follow-up queue, run the same day as the birth.

| Mode | β | a / c | Rung | Answer |
|---|---|---|---|---|
| `identify_cause` | 2.0 | 1.4 / 0.10 | PRD Phase 1 — Identify | the SET of causes, out of a bank salted with a consequence and inert background |
| `build_chain` | 3.5 | 1.5 / 0.12 | PRD Phase 2 — Connect (the birth anchor) | the ORDER of the causes |
| `root_vs_proximate` | 6.0 | 1.5 / 0.29 | PRD Phase 3 — Analyze (its G6 goal) | ONE card: the root, or the one right before the ending |

## Blocking find, fixed first: the primitive had no catalog entry

`HISTORY_CATALOG` held only `era-explorer`. `cause-effect-chain` was registered in
`types.ts`, `primitiveRegistry`, `evaluation/types.ts`, the generator registry and the tester —
everywhere except the one file the **manifest** reads. It could not have been selected for a
lesson, and `resolveEvalModes` would have found zero modes and silently returned mixed forever.
Birth debt, not an eval-mode issue; the entry now carries the description, constraints and all
three modes.

## The design call: three questions over ONE emission

The five candidates on the birth certificate were not equally cheap, and the difference is
whether the rung needs Gemini to write a **second content shape**:

| Candidate | Needs | Verdict |
|---|---|---|
| `identify_cause` | 2 extra flat fields (the non-causes) | **shipped** |
| `build_chain` | nothing — it is the emission | **shipped** |
| `root_vs_proximate` | nothing — it is one END of `correctOrder` | **shipped** |
| `label_link` | a link type per adjacent pair, and "caused / enabled / accelerated" is a judgment the model is not reliable on | queued |
| `divergence` | one cause, several effects — a different chain topology | queued |

So the whole ladder cost **one new field family**. That matters concretely: this schema already
carries the flat-`cause0..cause3` workaround because flash-lite ships malformed JSON when an
object inside an array holds another array. A second nested shape is exactly the failure mode.

**The type is code-assigned, not enum-constrained.** The usual contract narrows a schema enum so
Gemini *cannot* emit a disallowed type. Here there is no type field to narrow — all three rungs
are questions over identical content — so `assignModes` stamps the move after validation. That is
strictly stronger than an enum the model could ignore, and it makes the SP-21 failure (a session
labelled "mixed" that is one type end to end) unreachable by construction rather than by audit.

Two rules ride with it:
- **Coverage** — types rotate over a shuffled order, so a blend or mixed session shows every rung
  it claims once there are that many challenges.
- **Eligibility** — `identify_cause` is only assigned to a challenge that HAS distractors. A
  session PINNED to it with none anywhere **fails validation** rather than shipping `build_chain`
  rounds under an `identify_cause` label — a silent downgrade would feed the IRT model evidence
  under a β that never applied.

## Live runs — the real pipeline, not the tester

Dev server, `POST /api/lumina` → `generateComponentContent`. Topic *"Why towns grew along the
railroad"*.

**Pinned (G4), 3 sessions:** each returned `challengeType` equal to its pin, every round that
rung. `identify_cause` banks came back 5 cards / 3-card key; `root_vs_proximate` alternated
`root` and `proximate` across the session, so "pick the earliest-sounding card" does not score.

**Unpinned intent resolution (G5), 4 objectives** — the path the tester cannot exercise, since it
pins:

| Objective | Resolved |
|---|---|
| "Sort which events were causes of a change and which were its results" | `identify_cause` |
| "Put historical events in the order in which each one made the next possible" | `build_chain` |
| "Distinguish the root cause of an event from its immediate trigger" | `root_vs_proximate` (both asks) |
| "Understand cause and effect in history" | **mixed — all three rungs present** |

The last row is SP-21 verified at runtime, not only in the unit gate.

## Live-caught and fixed: a distractor that was defensibly a cause

The first `identify_cause` run produced, for the ending *"A thriving village surrounds the water
tank"*, the non-cause **"Store owners open shops to sell goods to travellers."** Shops opening
plausibly *does* help a village thrive — so the round had two defensible answers and the student
who reasoned correctly would have been marked wrong.

The prompt now makes the consequence distractor a **dead end** and says how to test one: *could a
thoughtful student argue this event also helped bring the outcome about? Then write a different
card.* Re-probed: 4 chains × 2 distractors, all clean —
*"Children run down to the platform to wave at the passengers"*, *"Students play tag on the dirt
playground during recess"*, *"Blacksmiths hammer glowing horseshoes on heavy iron anvils"*,
*"Guests sit on wooden rocking chairs on the front porch"*. Nothing runs on any of them.

This is the same class of defect the birth run caught twice (a two-card chain; four chains from
one opener): the audits can only reject what a regex can see, and *defensibility* is carried by
the prompt.

## Gates

- `npm run typecheck:lumina` — **0 errors**.
- Audit suite — **41/41** (was 27). 14 new tests, all non-vacuous: they cover pin exactness,
  blend coverage over 50 trials, the identify_cause eligibility rule, bank-not-answer-prefix over
  200 trials, both-ends coverage on `root_vs_proximate`, the distractor leak audits, and the
  refuse-rather-than-substitute rule on a pinned session.
- Backend parity — β priors in `problem_type_registry.py` and per-rung `a`/`c` in
  `discrimination_priors.py`. The guessing floors are computed per rung, not defaulted:
  `identify_cause` is C(5,3)=10 → 0.10, `build_chain` is 1/6..1/24 → 0.12,
  `root_vs_proximate` is one of 3-4 → 0.29.

## Residual — the two new render paths have not run in Chrome

`identify_cause` and `root_vs_proximate` render a **new surface**: an outcome panel over a
selectable chip bank, single- or multi-select. The generator half is live-verified; the render
half is not, and no gate covers it. Rolled into the primitive's existing browser row
(**HUMAN-CHECKS #124**) rather than filed as a new one — it is the same panel, one sitting.

Also unchanged from birth: the generated **hint** is written for the chain ("which of these could
not happen until something was built?"). It is a causal-dependency prompt, so it is not wrong on
a pick round, but it is not tuned for one either. Left alone deliberately — a per-rung hint is
`/add-support-tiers` territory (rung 3), which owns whether a hint is offered at all.

## Files

| Kind | Path |
|---|---|
| Catalog (entry CREATED) | `service/manifest/catalog/history.ts` |
| Generator | `service/history/gemini-cause-effect-chain.ts` |
| Component | `primitives/visual-primitives/history/CauseEffectChain.tsx` |
| Audit gate | `service/history/gemini-cause-effect-chain.audit.test.ts` |
| Tester (eval-mode pin selector added) | `components/HistoryPrimitivesTester.tsx` |
| Registry | `service/registry/generators/historyGenerators.ts` |
| Metrics | `evaluation/types.ts` |
| Backend priors | `backend/app/services/calibration/problem_type_registry.py`, `backend/app/config/discrimination_priors.py` |
