# The boss framework — how every primitive is wired to the live tutor

Canonical since 2026-10-18. Code: `my-tutoring-app/src/components/lumina/components/live-activity/`
(`boss.ts`, `bossLevers.ts`, `spokenKey.ts`) and `service/spokenKeySchema.ts`. Guards:
`components/live-activity/boss.test.ts`. If this file and the test disagree, the test is right.

## The two files

| File | Holds | Read by | May import |
|---|---|---|---|
| `<name>.card.ts` | facts: `id`, `grades`, per-mode wiring (`answer`, `judge`, `flow`, `moves?`) and `misses` (`unanswered?`, `missFromWords?`), `words` (`job`, `answer`, `question`, `special?`), `audio?`, `levers?: true` | the catalog (`...bossEntry(card)`) | types; `live-activity/boss`; other `.card` files |
| `<name>.boss.ts` | behavior: `validate`, `items`, `ask`, `assignment`, `levers` (a lever set), `drive` (harness) | `bossAdapter(boss)` in `activityContract.ts`, `bossJourney(boss)` in `liveJourneySpec.ts`, the component | anything pure (no React) |

A miss list the card needs lives IN the card (`SORT_MISSES`, `CELL_MISSES`), and the workspace and levers import it
from there. The card stays light because every catalog consumer, client bundles included, loads it.

Registration is three lines: the catalog spread, the `LIVE_ADAPTERS` row, the `LIVE_JOURNEYS` row. `boss.test.ts`
finds every card and boss on disk and fails on a missing or wrong one.

## Choose a preset first

| Mechanic | Card mode | Boss | The primitive supplies |
|---|---|---|---|
| The learner says it; the tutor judges | `{ ...SPOKEN, misses }`, card `audio: SPOKEN_AUDIO` | `spokenBoss({ card, validate, items, levers?, speech: { ask, key, misses?, say }, drive })` | the ask; the key via `spokenKeyText`; known misses (`KnownMiss[]`); the harness's `{ correct, plainWrong }` |
| The learner taps one choice; the activity checks | `{ ...TAP_ONE, misses }` | `tapBoss({ card, validate, items, levers?, choice: { ask, targets }, drive })` | the ask; the harness's `{ correct, wrong }` targets |
| Anything else (a board, a build, a simulation) | spell `answer`/`judge`/`flow` | `defineBoss({ card, validate, items, ask, drive })` | its own assignment in the component, `drive.play` |

The preset builds the assignment (`boss.assignment`, which the component passes to its workspace) and the harness
play.

**One path.** A boss component is taught only on the workspace: it exports through `withWorkspaceOnly` (or mounts
`DiTeachingStage`), and a mount with no tutor renders the shared "needs the tutor" card. No `withWorkspaceController`,
`useScriptedProgress` or `useLuminaAI` scripted fallback beside the tutor; the framework decides what an unbound
mount shows, never the primitive. A card whose modes are all `SPOKEN` (or all `TAP_ONE`) must use that preset; the guard fails otherwise.
A spoken component on the DI shell passes `assignment={<x>Boss.assignment}` and
`levers={useMemo(() => LEVERS.bind(ctx), …)}` to `DiTeachingStage` — the shared spoken stage.

**Pip is framework, not wiring.** The workspace runner publishes Pip from what it already knows (the item on
screen, solved, running) and one shared rule for "the tutor is speaking about this instance" (`tutorSpeakingFor`,
`pip/WorkspacePip.tsx`). The component only marks its layout: `<PipDock />` where the dock goes and
`<PipWorkspace>` around the answer surface. No `useWorkspacePipSurface`, `usePipSurface` or `useLuminaAIContext` in
a boss component, and no per-primitive Pip surface test: `pip/WorkspacePip.surface.test.tsx` runs the one contract
over every boss that marks the layout. `DiTeachingStage` publishes Pip itself for every spoken pack. Pip points at
the region as a whole, which never singles out an answer; a primitive that needs finer targeting is an exception to
argue for, not a default.

## The spoken key

One shape for every spoken answer (`spokenKey.ts`): `answer`, `alsoAccept[]`, `acceptRule?`, `signatureError?`, and
either `menu` (a closed word menu said in full in the ask) or `meaning` (`{ idea, notIt }`, judged on meaning).
`spokenKeyText(key)` writes the sentence the judge reads; never write "also accept …" by hand.
`spokenKeyLeaks(key, surfaces)` is the leak check: list the surfaces that must not carry the answer (the ask; a
print only when reading it is not the task). The generator spreads `spokenKeyProperties(answerDescription)`
(`service/spokenKeySchema.ts`) into its item schema instead of writing `alsoAccept`/`acceptRule`/`signatureError`.

## Levers

Declare levers once, as a lever set (`bossLevers.ts`), in the primitive's levers module:

```ts
export const LEVERS = leverSet<Item, Ctx>({
  modeOf: item => item.mode,                 // omit for one mode
  missesOf: mode => <x>Card.modes[mode].misses,
  answersOf: (item, ctx) => [/* the answer a clue or meaning must not name */],
  specs: [{ id, type, modes?, answers: 'all' | [...], when, does, content?, offer?, fact? }, …],
});
```

- `type` is one of `model` (a DIFFERENT item, solved), `easier` (simplify; `content` IS the practice item),
  `clue`, `meaning` (both leak-checked against `answersOf`), `marks`, `layout`, `custom` (needs `why` and `carrier`).
  The type sets help vs simplify and the default carrier.
- Offered when `content` is non-null and `offer` holds. `fact` is the scene fact while pulled.
- The set gives `declare`, `onScreen`, `simpler` and `bind(ctx)`; the component calls those and never re-switches on
  lever ids. The readable card lists the ids per mode from the set, so they cannot drift.
- Every miss of a mode is answered by a lever in it, or listed in `unanswered` with a reason.
- One id may have a spec per mode when its words differ by mode (cell-builder's `structure_jobs`); never two in a mode.
- What a type means for the tutor is written once in `LEVER_TYPE_DOCTRINE` (`adapterContract.ts`), added to the
  guidance of every boss whose set uses that type (`model`: a DIFFERENT item; never model the learner's own).

## Words

`job`, `answer`, `question` are short phrases `ROTATION_DOCTRINE` slots into the shared rules. `special` holds only
facts about this primitive the shared rules cannot know (what its panel can show; a tricky card on purpose). The test
for each sentence is not its length but its scope: a rule that would be true of every board goes in `FLOW.board`, of
every tutor-judged mode in `JUDGED_BY.tutor`, of every lever of a type in `LEVER_TYPE_DOCTRINE`, of every family in
`ROTATION_DOCTRINE` — written once, for all. Most cards need no `special` (cell-builder has none).

## Guards (boss.test.ts) and ratchets

Per boss: one card and one boss per file, the boss on the card beside it; catalog = `bossEntry(card)`; card modes =
catalog eval modes; adapter and journey rows present; leak tokens carried; card imports light; the component
workspace-only and wiring no Pip (markers only); preset used when the wiring matches; levers declared once and
answering every miss.

Ratchets over the source tree (lower the number in the change that moves a family):
Pip wired by hand in a primitive (177), hand-built `response: 'speech'` assignments (90), hand-written "also accept" key text (12), levers built outside a
lever set (171), scripted fallbacks beside the workspace (94), hand-written key schema fields in generators (1),
`adapters/*Live.ts` (161), and
`PROSE_GUIDANCE_FAMILIES` in `activityContract.test.ts` (161).

## Testing a boss

Free: `npm run test:primitive -- <id>` (the boss guards, the journey sweep, the workspace tests),
`node scripts/boss-card.mjs <id>` (the card and the guidance the tutor receives). Paid Live is the user's (USER RULING
2026-10-18: one `--samples 1` sample per boss; a miss is fixed on the shared path). A change that keeps the tutor's
input byte-identical (the guidance, the lever words, the key text) needs no Live sample.
