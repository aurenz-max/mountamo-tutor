---
name: review-live-wiring
description: >-
  Review one primitive's live-tutor wiring (or the current diff, or every family) against the boss framework —
  card and boss files, preset, registration, spoken key, lever set, words, leak tokens, dead legacy wiring, ratchets
  and verification — and name the exact change each gap needs. Use after any live-wiring work (/primitive,
  /add-live-tutor-tools, /add-support-tiers, /add-di-loop) or before moving a legacy family onto a boss. Read-only:
  fixes go through /add-live-tutor-tools (levers: /add-support-tiers).
---

# Review live wiring

Checks that a primitive is wired to the live tutor the one way the framework allows, and names the change for
every place it is not. The framework, its presets and its guards are in `references/boss-framework.md`; read it
first. The guard test `my-tutoring-app/src/components/lumina/components/live-activity/boss.test.ts` is the
authority: where this skill and the test disagree, the test is right and this skill is stale (fix the skill).

**Arguments:** `/review-live-wiring <primitive-id>` · `/review-live-wiring changed` (every primitive the working
tree touches) · `/review-live-wiring all` (one row per live family: on a boss or not, which preset fits, the first
change). Read-only. Free: no model calls.

## 1. Gather (free)

```bash
cd "<abs>/my-tutoring-app" && npm test -- src/components/lumina/components/live-activity/boss.test.ts
cd "<abs>/my-tutoring-app" && node scripts/boss-card.mjs <id>        # the card + the guidance the tutor receives
cd "<abs>/my-tutoring-app" && npm run test:primitive -- <id>          # journey sweep + workspace tests
```

Then read the primitive's files: component, `<x>Workspace.ts`, `<x>Levers.ts`, `<x>.card.ts`, `<x>.boss.ts`, its
catalog entry, its rows in `activityContract.ts` and `liveJourneySpec.ts`, its generator, and
`docs/contracts/<id>.md` if it exists. For `changed`, take the ids from `git status` / `git diff HEAD`.

## 2. The checklist

Give each item a verdict: **PASS**, **CHANGE** (state the edit: file, what goes, what replaces it), or **N/A** (why).

1. **Two files.** `<x>.card.ts` (facts) and `<x>.boss.ts` (behavior) exist beside the component, one export each.
   No `adapters/<x>Live.ts`; no `teachingWorkspace.guidance` prose in the catalog.
2. **Card stays light.** The card's value imports are only `live-activity/boss` and other `.card` files. A miss
   list or constant it needs lives in the card, and the workspace and levers import it from there.
3. **Preset.** All modes spoken + tutor-judged → `spokenBoss` with `SPOKEN` modes and `audio: SPOKEN_AUDIO`. All
   modes one tap the activity checks → `tapBoss` with `TAP_ONE`. Otherwise bespoke `defineBoss`, and say which
   mode keeps it off a preset. A boss that could be a preset and is not is a CHANGE.
4. **Registration.** Catalog spreads `...bossEntry(<x>Card)`, with no hand-written `teachingWorkspace` or
   `audioInput`. `LIVE_ADAPTERS` row is `bossAdapter(<x>Boss)` and `LIVE_JOURNEYS` row is `bossJourney(<x>Boss)`.
   Card modes equal the catalog's eval modes.
5. **Assignment.** On a preset, the component takes `<x>Boss.assignment`, and the workspace module builds no
   `{ response: 'speech' | 'gesture' }` assignment of its own. Bespoke bosses build their own; check that it never
   carries the gesture key to the tutor.
6. **Spoken key** (spoken modes). The key is `spokenKeyText(...)`, with no hand-written "also accept". The leak gate
   is `spokenKeyLeaks` over the surfaces that must not carry the answer. The generator spreads
   `spokenKeyProperties(...)` instead of writing `alsoAccept`/`acceptRule`/`signatureError`.
7. **Levers.** One lever set (`leverSet`) in the levers module, passed as `levers` on the boss. Each spec has a stock
   `type` (`custom` only with `why`). The component calls `declare`/`onScreen`/`simpler` (or `bind`) and keeps no
   per-id switch except to DRAW a pulled lever. `answersOf` is set when there is a `clue` or `meaning` lever. Every
   miss of every mode is answered or in `unanswered`. Levers still built in the component are a CHANGE.
8. **Words.** `job`/`answer`/`question` are short phrases that read right inside `ROTATION_DOCTRINE` (print the
   guidance with `boss-card.mjs`). Judge each `special` sentence by its scope, not its length: true of every board →
   `FLOW.board`; of every tutor-judged mode → `JUDGED_BY.tutor`; of every lever of a type → `LEVER_TYPE_DOCTRINE`; of
   every family → `ROTATION_DOCTRINE`; already said there or in the key text → delete. Only facts about this primitive
   stay. Moving a rule changes every boss's guidance: print each with `boss-card.mjs` and hand the user one sample
   per boss.
9. **Leak tokens.** Cue tags the primitive's code can still emit (`SAY_*` in a script module) are in
   `drive.leakTokens`. Tags nothing emits any more are deleted with their tokens.
10. **One path, no dead wiring.** The component exports through `withWorkspaceOnly` (or mounts `DiTeachingStage`);
    a `withWorkspaceController` / `useScriptedProgress` / `useLuminaAI` scripted fallback is a CHANGE: switch the export,
    delete the scripted branches (`tutorOwned` is always true), and move any band or leak assertions its tests made onto
    bound mounts (`mountWorkspace`). Also a CHANGE: a catalog `tutoring` block on a boss family (bound sessions send
    `tutoring: null`), scene `constraints`/facts that repeat the boss's `moves` or the doctrine, and exports only a
    deleted adapter used.
11. **Pip.** The component renders `<PipDock />` and `<PipWorkspace>` and calls no `useWorkspacePipSurface`,
    `usePipSurface` or `useLuminaAIContext` (a spoken pack on `DiTeachingStage` needs neither). Hand wiring is a CHANGE:
    delete the hook, the hand-picked `tutorSpeaking` and the per-primitive surface test, and mark the two elements.
12. **Ratchets.** Compare the ratchet counts in `boss.test.ts` with the tree. A change that moved a family lowers
    them in the same slice. A new instance is a CHANGE naming the framework piece to use.
13. **Verification.** `test:primitive` green; the card and guidance printed. Decide whether the change altered the
    tutor's input:
    - Byte-identical guidance, lever words and key text: no Live needed. Say how you know (tests, a diff of
      `boss-card.mjs` output).
    - Otherwise: hand the user ONE `--samples 1` command and the question it answers (agents never run Live:
      USER RULING 2026-10-17).

## 3. Report

One table per primitive: `# | item | verdict | change`. Then:
- **Next executor:** `/add-live-tutor-tools <id>` for wiring, `/add-support-tiers <id>` for levers, `/eval-fix` for
  content. If the user asked for the fix in the same request, run the executor yourself; otherwise queue it in the
  owning register (`/pm`).
- **Framework gaps:** a check that should be in `boss.test.ts` and is not, or a preset or lever type that two
  families need. Fix these in the framework, not in a primitive (USER 09-29: close findings at their class).

For `all`, report one row per family in `LIVE_ADAPTERS`: `id | on boss? | preset that fits | first change`, sorted
by the change that unlocks the most families. Keep it to the table and three lines of findings.
