# character-web W1 (ROLLOUT C21), 2026-10-09: HELD

Executor: `/add-live-tutor-tools` (W1, plain shape P). Outcome: **not bound**. No production files changed.

## Why it is held

The catalog declares four eval modes (`trait_id`, `trait_evidence`, `relationship_map`, `character_change`,
`service/manifest/catalog/literacy.ts`), but none of them has an answer check, in code or as a bounded
`expectedAnswer`. This is the OPEN-row case (`opinion-builder`, `revision-workshop`).

1. **Every answer is free typing, and nothing compares it with the key.** The learner types a trait and evidence
   for each character, picks relationships from menus, and writes a change paragraph. `CharacterWeb.tsx` never
   reads `suggestedTraits`, `traitEvidence`, `relationships[].relationshipType` or `expectedChange` to judge
   anything. The modes change only what the generator's story emphasises (`analysisFocus`); the screen and the
   scoring are the same for all four.
2. **The score counts what was filled in, not whether it is right.** `submitFinalEvaluation` gives 35 points for 3
   traits of any text, relationship points per relationship added (any type), 20 for a change answer longer than
   15 characters, and evidence points for evidence longer than 10 characters. `success = score >= 50`, so any
   filled-in web passes.
3. **There is no item to commit.** The activity is one four-phase web with a single Submit. A W1 binding needs
   items with a checked commit (`progress.commitCheck(describe, correct, miss)`); there is no `correct` to pass.

## Screen leak found while reading (not fixed here; `/eval-fix`)

The profile phase prints `Hint: Look for traits like: {suggestedTraits}` under each character
(`CharacterWeb.tsx` line 357). That is the generator's trait key for `trait_id`, shown before the learner types.
Under CLAUDE.md rule 1 this should go in any binding slice, or be fixed on its own first.

## What would unblock it (needs a decision)

- **`/add-eval-modes`, code-checked (recommended for two modes):**
  - `relationship_map`: the generator already emits closed-set `relationshipType` (friend, rival, family, mentor,
    enemy, ally) per character pair. One item per generated relationship: "How is A related to B?", the learner
    picks a type, and code checks it against the key. Needs the generator to validate that the type is
    unambiguous from the story (rival vs enemy, friend vs ally are close).
  - `trait_id`: one item per character: pick the trait the story shows from a menu of the key trait plus
    generated distractors that the story contradicts. Code checks the pick. The current printed hint must go.
- **`trait_evidence` and `character_change` stay open writing.** They need a judged evidence contract (W2: JEV or
  the open-build literacy judge against `traitEvidence` / `expectedChange`), or a menu form (pick the sentence
  from the story that proves the trait; pick the cause of the change).
- Then W1 binds in plain shape with these items, and levers follow.

## Gates

None run: there is no binding to test. Phase 2 (levers) was not started, because it needs the W1 binding, so
there is no `qa/eval-reports/character-web-levers-2026-10-09.md`.
