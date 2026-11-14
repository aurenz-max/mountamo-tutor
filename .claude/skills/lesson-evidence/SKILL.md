---
name: lesson-evidence
description: >-
  Make a lesson collect the evidence its objective needs: the lesson writes one evidence spec per objective
  (the act the child performs, on what, what earns credit, what must not), the kit's author is held to it, the
  run record counts the items that collect it, and when no kit surface can collect the act, build the surface
  (judged by code, or by the live tutor on a meaning key) and prove a lesson collects it. Use when an
  objective's verb (explain, say, build, run) degrades into card picks or reading, when a run record says
  "no kit surface lets a child do this act", or when a new act of evidence appears in curriculum demand.
  Covers the spec contract end to end (brief → manifest → generator → tutor), the bench that reads what a
  lesson collects, and adding a kit surface for an act, with `teach` (the child explains to a character the
  tutor plays) as the worked example. Not for a new agent primitive (/agent-primitive), a schema primitive's
  task identity (/add-eval-modes), levers alone (/add-support-tiers), or a canvas (/canvas-primitive).
---

> **Paid Gemini runs are the user's (USER RULING 2026-10-17).** Wherever this skill says to run a Live session (`run_live_runtime.py --audio`), do not run it: a hook blocks it. Finish the free gates and the author traces, then give the user the exact command and the question it answers. Author traces and `topic-trace` calls are ordinary generation and are allowed under the daily cap (`node scripts/gemini-spend.mjs`).

# Lesson Evidence

## The outcome

Every objective in a lesson says what the child must DO for a right answer to count, every generator that can
hold its items to that is told it, the run record says how many items collect it, and an act the kit cannot
collect is a counted gap that becomes a kit surface, so an "explain why" objective ends in the child explaining,
not in a card that says the explanation.

**Why this exists (Primer bench, 2026-11-13, `my-tutoring-app/qa/topic-traces/primer-bench-2026-11-13.md`).**
Lumina's objectives carried text and a Bloom verb and nothing about what would count. Traced through the live
pipeline, every `explain` objective became a worked example to read, a card pick ("which way splits 5?"), a
multiple-choice check, and a spoken drill that shipped `items: []` because its planner refuses procedures.
practice-studio already had a spec and a reader for it (`agent-kit/evidence.ts`, 11-09), but nothing upstream
wrote one, so every run planned its own from the objective text, and `say` and `explain` were acts no surface
collected. The same day the brief began writing the spec, and `teach` became the surface for `explain`: on the
first run the author built 4 of 4 teach items and the record read 2 of 4 met, up from 0 of 4.

## The dataflow

```
curriculum / Lesson Builder            curator brief (gemini-curator-brief.ts)
  preBuiltObjectives ───────────────▶  objectives kept verbatim, + evidence per objective
  (or none: free-form topic)           (EVIDENCE_WRITING_RULES, evidence.ts)
                                                │
                                                ▼  ObjectiveData.evidence  {act, on, credit, notCredit}
                                       flattenManifestToLayout (flattenManifest.ts)
                                       stamps config.evidence on EVERY component of the block
                                       and on finalAssessment.lessonObjectives
                                                │
                     ┌──────────────────────────┼──────────────────────────┐
                     ▼                          ▼                          ▼
   resolveGenerationContext          livePlan.ts                 a tester / probe may send
   ctx.objective.evidence            item.objective.evidence     config.evidence directly
                     │
                     ▼
   practice-studio (agent-practice-studio.ts) → itemLoop.ts
     the author is told it (evidencePrompt)            ─┐
     the blind reader judges each item against it       ├─ agentDebug.evidence { spec, items, met, gaps, unsupported }
     surfaceGap: "use <surface>" while rounds last      │
     unsupportedAct: a gap the kit cannot close        ─┘
```

Acts and the surface that collects each, in the order a planned spec prefers them (`COLLECTABLE_ACTS`, strongest
evidence first; `evidence.ts`). `ACT_SURFACES` is module-private: tests reach it through `unsupportedAct` and
`surfaceGap`.

| act | the child… (`ACT_WORDS`) | surfaces | judged by |
|---|---|---|---|
| run-read | runs a test and reads what happened | set on a `system` board | code (goal) |
| build | makes it from pieces, starting from nothing | make | code (goal) |
| set | changes a given picture or model until it is right | set | code (goal) |
| explain | says why | teach | the live tutor, on a meaning key |
| arrange | sorts or orders given things | categorize, order | code (key) |
| recognize | picks the right one from choices | choose, categorize, order, make, point | code (key) |
| say | says or writes the answer | **none yet** (a spoken surface collects the said half; the written half waits for a typed one) | would be the tutor on a word key, the activity on a tap |

Three lists change together when an act gains a surface, or the planner never offers it: `ACT_SURFACES[act]`,
the literal list in `COLLECTABLE_ACTS` (the code's order is run-read, build, set, explain, arrange, recognize:
making or changing a model first, then an answer the child produces in words, then arranging given things,
then picking from choices; `say` is a produced answer, so it goes after `explain` and before `arrange`), and
for a brand-new act also `EVIDENCE_ACTS` and `ACT_WORDS`.

## When to use / do not use

Use when:
- a lesson's objective asks for an act and the trace shows items of a different act (explain → choose);
- `agentDebug.evidence.unsupported` names an act, or `met` is 0 of N on a supported act across runs;
- a curriculum audit or design review names an act the table above lacks (say, write, measure, draw).

Do not use for:
- a new world or author (`/agent-primitive`); a schema primitive's new task (`/add-eval-modes`);
- help/simplify levers (`/add-support-tiers`); a canvas (`/canvas-primitive`);
- the manifest choosing a different primitive (the manifest owns that; never add a curator rule).

## Phase 0: name the act and the spec

Read the objective (and the objective record if one exists: `qa/curriculum-design-review/*/panel.json` has
`action`, `evidence`, `notCredit`, `misconceptions`). Write the spec by `EVIDENCE_WRITING_RULES`
(`service/agent-kit/evidence.ts`): one act; `on`; `credit` as ONE observable result; `notCredit` as what a child
could do instead. A spec whose credit names two results ("scoop and lift") counts items that do one as gaps
(EV-15). Keep this spec: Phases 1 and 3 send it on the objective.

## Phase 1: bench — what does a lesson collect today?

Server on :3000 (probe first: `curl -s -m 120 -o /dev/null -w "%{http_code}" http://localhost:3000/api/lumina/topic-trace`;
if nothing listens, `cd my-tutoring-app && npm run dev`, never a second instance).

1. **Free-form, the brief writes the spec.** `GET /api/lumina/topic-trace?topic=<t>&gradeLevel=<g>&componentId=practice-studio`.
   Read `briefObjectives[].evidence.act` (did the brief name your act?), `selection` (did the manifest put a
   kit primitive in that objective's block?), and for each practice-studio component
   `data.agentDebug.evidence` (`met`/`items`, `gaps[].gap`, `unsupported`) and `challenges[].surface`.
2. **Forced spec, the act is given.** `POST` the same route with `objectives:[{id,text,verb,icon,grade,evidence:{act,on,credit,notCredit}}]`
   and `componentId: practice-studio`. The flatten stamps the given spec; the brief is skipped, and on this path
   the response's `briefObjectives` echoes the fixed objectives, not a brief.
3. Save both JSONs under `qa/topic-traces/<topic-or-bench>-<date>/`.

| What the record says | Meaning | Next |
|---|---|---|
| `unsupported: "no kit surface lets a child do this act"` | the kit cannot collect it | Phase 2 |
| supported, `met` 0 of N, gaps say "use <surface>" | the author did not reach the surface before the budget | `/agent-primitive` (first write, EV-14); not a new surface |
| supported, `met` ≥ 1, gaps name item defects | the surface works; the items need the author's attention | record and stop |
| the brief wrote a different act than yours | the rules or the objective text are ambiguous | fix `EVIDENCE_WRITING_RULES` once, in the kit |

## Phase 2: add a surface for the act

Decide the judge first; it decides every file.

| The act's right answer is… | judge | key | precedent |
|---|---|---|---|
| a state code can compute (a set, a board, a part) | code: `gradeAnswer` on a goal or key | computed; the author never writes it | make, set, point |
| a meaning in the child's own words | the live tutor: `spokenBoss`, `SpokenKey.meaning` | derived from the author's content | teach (`teachSurface.ts`) |
| one word or number the child says | the live tutor on a word key (`SpokenKey.answer` + `alsoAccept`, number forms from `spokenNumber` in `runtime/spokenMissContract.ts`), and the same item takes a tap when a card shows it | derived | wonder-walk's `say` (`wonderWalkSpoken.ts`: code decides sayability, `stopSpokenKey` builds the key from the world); no kit surface yet |

Spoken-or-tap is code's call, never a menu: a number, a word or a letter is sayable; a place, a move, a sort or a
track is shown. practice-studio's one mode is `SAY_OR_SHOW` (judge `either`), so one item may carry a key and
still accept a tap on a card (`acceptsGesture`, `boss.ts` `bossAssignment`). A word key's blind-solve check is a
word comparison with the accepted forms (`keyAnswers` / `containsPhrase` in `spokenKey.ts`), not a model call;
only a meaning key needs one. Reuse by moving the key-building logic into the kit module, never by importing a
primitive's file (`stopSpokenKey` takes a `WonderWalkStop`). The child's speech reaches the tutor through the
workspace session's own microphone, as teach and the DI pack do; a surface does not add `useVoiceAnswer`.

Then, in this order (each line is a file; the `teach` build is the exact precedent for a spoken one):

1. **A pure module for the surface's own logic** (`service/agent-kit/<surface>Surface.ts`): the spec type the
   author writes, `read<Surface>` from a draft, `<surface>Errors` (structure and leaks, in sentences the author
   can act on), the derived key, misses (`KnownMiss` patterns) and harness answers, the difficulty contribution,
   the words for the reader and the scene. No React, no model.
2. **`surfaces.ts`**: add the name to `SURFACES`; the item field; `SurfaceAnswer` field for what the child did;
   `SurfaceMiss` union and `SURFACE_MISSES`; branches in `itemErrors`, `gradeAnswer`, `rightAnswer`,
   `wrongAnswer`, `answerReady`, `surfaceTaps` (empty for speech), `missHint`, `difficultyOf`.
3. **`evidence.ts`**: `ACT_SURFACES[act] = ['<surface>']` and the act into the literal list of
   `COLLECTABLE_ACTS` (the filter alone does not add it). Two tests pin the old state and must flip:
   `make.test.ts` loops the acts `unsupportedAct` must name, and `system.test.ts` asserts which `- act:` lines
   the planner's ask (`evidencePlanAsk`) contains.
4. **`itemLoop.ts`**: the surface's line in `SURFACE_LIST`; inside the `surfacePrompt` template (not exports) the
   `surface:` union literal, the item's fields under `AN ITEM`, the `simplify` shape, and the surface's rules under
   `RULES`; `readDraft` reads the field and sets the key; `buildSurfaceLevers` gets the surface's simplify (an
   edit that lowers `difficultyOf`, for example fewer presses, a smaller count, a board with part of the work
   done) and refuses the rest with a sentence. A help must change what is drawn (`applyHelp`: a display added
   to the stimulus, the same display replaced in a new state such as a highlight, or every option card lit
   alike), so decide at design time what a help for this surface shows: a second display that shows the
   structure of the answer without naming it (a full ten beside the frame; the same frame with its empty
   squares lit; on an item with cards, the cards' displays highlighted).
5. **`look.ts`**: `itemHtml` (what the reader screenshots), `itemWords`, `solverPrompt`'s "how" and middle line,
   `toAnswer`, `surfaceView`'s `how` and `key`. If the key is a meaning, the sync `agrees` is a word count and
   `lookAt` must judge with a model call (`teachAgrees`): a paraphrase must not send an item back. If the key is
   a word or number, `agrees` compares the reader's words with the accepted forms and needs no call.
6. **`surfaceScene.ts`**: the facts the tutor reads; the key never appears there (it travels in the assignment).
   `describeSurfaceWork` for the new answer field.
7. **`SurfaceBoard.tsx`** renders it; **`PracticeStudio.tsx`** gets a `PHASE_TYPE_CONFIG` row and hides Check and
   Clear when the activity does not judge it.
8. **Spoken only, card and boss.** practice-studio is already on the spoken wiring (since `teach`):
   `practiceStudio.card.ts` has one mode `practice` on `SAY_OR_SHOW` with `audio: SPOKEN_AUDIO`, and
   `practiceStudio.boss.ts` is `spokenBoss` whose `speech.key` / `speech.misses` / `speech.say` are ternaries on
   `item.surface`. A new spoken surface adds its branch to each (key null on a tap item; `say` returns strings even
   for tap items; `show` already plays the taps for items with no key) and its misses to the card's written-out
   list (a card's value imports may come only from `boss.ts` and card files, `boss.test`). Another primitive adopting
   its first spoken surface does the conversion this describes, and when it has several modes with one of them
   `SAY_OR_SHOW` it must give `speech.modeOf`. Catalog `affordances.answers` already holds `'tap', 'spoken'` for
   practice-studio (`catalog/core.ts`); the card's words must keep the adapter's guidance under
   `OFFER_GUIDANCE_MAX` (4000, `adapters/adapterContract.ts`; `activityContract.test`).
9. **A saved payload** `components/live-activity/runtime/testing/w1-payloads/practice-studio.practice-<surface>.json`:
   one item of the new surface and one tap item, every item with a help and a simplify lever (the dry journey's
   J12 reports a finding for an item with no lever answering one of its misses, unless the catalog lists the miss
   as unanswered; a new finding fails the sweep against its baseline).
10. **Tests**: `<surface>Surface.test.ts` (errors, leaks, key and misses derived, harness answers, difficulty,
    the simplify through `readDraft` + `buildSurfaceLevers`, `unsupportedAct(spec) === null`, `surfaceGap` names
    the surface).

## Phase 3: gates, then the author

Free gates, all green before any model call:

```bash
# <abs> = the repo's absolute path, as every command in CLAUDE.md uses it; vitest takes files or directories.
cd "<abs>/my-tutoring-app" && npm run typecheck:lumina                                   # 0
cd "<abs>/my-tutoring-app" && npm test -- src/components/lumina/service/agent-kit src/components/lumina/service/manifest src/components/lumina/components/live-activity/boss.test.ts
cd "<abs>/my-tutoring-app" && npm run test:primitive -- practice-studio                  # incl. the dry journey on the new payload
cd "<abs>/my-tutoring-app" && npm test -- src/components/lumina/service/manifest/catalog/misses.test.ts
```
Never the whole `components/live-activity` folder: that is the 10-15 minute journey suite, for runtime changes.

Then the two traces of Phase 1 again, now reading: did the author choose the surface for the act; did the look
stage keep the items (`agentDebug.items[].kept`, `blocking`); did the meaning judge agree (events "solver agreed");
is `met` above 0; is the key absent from the prompt and the screen. Expect the forced spec to reach the surface
on most items and the free-form lesson on fewer: the reader's "use <surface>" arrives after the first write, and
the first write often spends the budget (EV-14).

Draw what the author built without a browser session:
`node scripts/render-surface-items.mjs --trace=<trace json> --component=practice-studio --out=qa/topic-traces/<bench>/renders`
(the look stage's `itemHtml` in headless Chromium at 390 and 760 px). It needs `PLAYWRIGHT_CORE` set to a
`playwright-core` install (none is in the repo; `npm install playwright-core@1.52.0` in the session scratchpad,
never the project, see memory `headless-chrome-drive-recipe`) and the cached chromium-1169. Read the PNGs. The component itself renders only on the
teaching workspace (`withWorkspaceOnly`, `runtime/withTeachingWorkspace.tsx`), which needs a tutor connection:
that look is the user's.

## Phase 4: record and hand off

- `my-tutoring-app/qa/evidence-spec/QUEUE.md`: a paragraph for what was built with the numbers, and rows for what
  is owed. `WORKSTREAMS.md` row 17 gets one status line. Traces and renders under `qa/topic-traces/<bench>/`.
- Hand the user, with the question each answers:
  - the component on the workspace at phone width (bubble, board, no Check, the levers);
  - for a spoken surface, ONE `--audio` session:
    `cd backend/tests/tutor_live && ../../venv/Scripts/python run_live_runtime.py --primitive practice-studio --mode practice --input <abs path to the payload> --runs 1 --audio`
    (does the tutor hold the role, press rather than tell, credit a paraphrase, name the misses);
  - any lesson-shape change (a closing feedback stage) as a ruling, not a build.

## Worked example: `teach`, the surface for `explain` (2026-11-13/14)

Author writes `teach: { character, holds, idea, presses[] }`; code derives `teachSpokenKey` (a meaning: the idea,
and what is not it), four misses (`agreed_with_character`, `read_back`, `named_only`, `opposite_idea`), harness
answers (idea / holds), difficulty (1.2 + 0.4 per press + reading load), and refuses an idea in the prompt, a
press or screen text (60% of its content words). Files: `teachSurface.ts`, the nine files above, payload
`practice-studio.practice-teach.json`, `teachSurface.test.ts`. First runs: forced spec 4 of 4 teach items, kept,
met 2 of 4, $0.14, 116 s; free-form 1 teach of 4, met 1 of 4, $0.07. Owed: EV-17 (component on the workspace),
EV-18 (one `--audio` session), and in the kit: a first write that leans to the act's surface, and a help lever an
author can write for a spoken item.

## Getting this wrong

- **A spec the lesson never wrote.** Before 11-13 the item loop planned a spec per run from the objective text,
  so two lessons on one objective collected different things and nothing upstream could be held to it. The brief
  writes it once; given objectives keep their identity and take the brief's evidence (`objectiveEvidence.ts`).
- **A word count judging a meaning.** `saysIdea` is for the harness and tests. The child is judged by the tutor;
  the reader is judged by `teachAgrees`. A sync overlap check in `lookAt` sent paraphrases back.
- **Rails one level down.** A per-primitive "explain mode", a menu of characters or a list of pushbacks in app
  code is the thing `/agent-primitive` forbids. The author writes the content; code derives and checks.
- **The key in the scene.** Scene facts reach the tutor as text. The idea travels only in the assignment's
  `expectedAnswer` (`spokenKeyText`); `surfaceScene` for a spoken surface says who the character is and what it
  thinks, never the idea. The test asserts the idea's words are absent.
- **The card imports a value.** `SURFACE_MISSES` in a card fails `boss.test` (value imports only from `boss.ts`
  and card files); write the misses out.
- **A help with nothing to draw.** `buildSurfaceLevers` refuses a help that leaves the screen the same, and J12
  wants a lever for each miss, so a spoken surface with no display to add ships with a simplify only (3 of 4 teach
  items on the first run). Decide the help's display when designing the surface, not after.
- **Judging the kit by the first write.** The reader's gap lands after the budget on short runs. Count `met`
  across the forced and the free-form trace, and route a low free-form count to the author's first write, not to
  a new rule in the manifest.
