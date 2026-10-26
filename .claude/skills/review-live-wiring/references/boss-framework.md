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

The rotation is the same for every boss; a mode's variant is a card value, never its own wiring. Every item's
assignment comes from `bossAssignment` (a spoken key, or none: a gesture the activity checks). A family whose modes
mix said, shown and board items is still one `spokenBoss`: its shown items return a null key and play through `show`.

| Mechanic | Card mode | Boss | The primitive supplies |
|---|---|---|---|
| The learner says it; the tutor judges | `{ ...SPOKEN, misses }`, card `audio: SPOKEN_AUDIO` | `spokenBoss({ card, validate, items, levers?, speech: { ask, key, misses?, say, show?, before?, modeOf? }, drive })` | the ask; the key as a `SpokenKey` (the preset writes its text), or null on an item answered on screen; `given`, what the ask says by design; known misses (`KnownMiss[]`); the harness's `{ correct, plainWrong }`; `show`: the harness's moves on a keyless item; `before`: what the learner does on screen first (roll the dice) |
| The learner says it or shows it | `{ ...SAY_OR_SHOW, misses }` (`judge: 'either'`) | `spokenBoss`, with `speech.modeOf` when other modes sit beside it | as spoken; the assignment adds `acceptsGesture` |
| The learner taps (one choice, or several checked taps in order); the activity checks | `{ ...TAP_ONE, misses }` | `tapBoss({ card, validate, items, levers?, choice: { ask, targets, commit? } or { ask, play }, drive })` | the ask; the harness's `{ correct, wrong }` targets (`correct` may list several taps in order); `commit`: the button pressed after the taps ("Check"), named in the card's `moves`; `play` instead of `targets` when the taps are not workspace targets (menu buttons by label, a run from the line reached so far: equation-workspace) |
| Every mode a board, a build, a simulation | spell `answer`/`judge`/`flow` | `defineBoss({ card, validate, items, ask, drive })` | its own assignment in the component, `drive.play` |

**An ungraded teaching surface** (curator-brief, adaptation-investigator; USER RULING 2026-10-26) is a card with
`ungraded: true` and no modes: the catalog declares no eval modes and it binds as `mixed`. `words.job` is what the learner
looks at and does, `words.question` what the tutor teaches from, `words.special` how to cover this content;
`TEACHING_ROTATION` and `TEACHING_DOCTRINE` write its guidance. Its boss is bespoke: `items` are the things it can show
(the opening counts them), `drive.teach` looks at one thing and finishes with Done, and the journey is a teaching one.

**A mode whose items are steps wired differently** (say the story kind, place the cards, say the answer) is
`{ steps: { <step>: BossMode, … }, misses }`, keyed by the step name the item's scene publishes as `kind`, and the
boss gives `stepOf(item)` (the guard requires it). The doctrine then speaks of steps ("In the big_number steps: …")
and says the task's kind names the step; a card with no stepped mode reads exactly as before. Pilot:
di-word-problem-setup (bespoke). Read a mode's wiring through `wiringsOf(mode)`, never `mode.answer`.

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
A boss hands over the key OBJECT, never its text: `speech.key` (or `spoken.key` on a bespoke boss) returns a
`SpokenKey`, and `spokenAssignment` (`boss.ts`, the only builder of a `response: 'speech'` assignment) writes the
sentence with `spokenKeyText`.

**The ask never says the answer, by construction.** A boss with spoken items declares `spoken` (`spokenBoss` does it),
and `defineBoss` wraps its `validate` with `askLeaks(ask, key, given)`: content whose ask says an accepted answer is
rejected at launch. A menu key's ask must say its whole menu instead. `given` lists what the ask says by design
("zero plus three" asks for three; dice's "left, right, or same"); a sound in slashes (`/t/`) is not its letter.
`boss.test.ts` requires every spoken boss to declare `spoken`, to have a saved payload in
`runtime/testing/w1-payloads/`, and to pass `askLeaks` on every item of it; no boss family file may write
`response: 'speech'` itself. `spokenKeyLeaks(key, surfaces)` remains for surfaces beyond the ask (a printed
stimulus, a picture's name). The generator spreads `spokenKeyProperties(answerDescription)`
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
  `clue`, `meaning` (both leak-checked against `answersOf`), `marks`, `layout`, `legend` (a key or reference naming
  EVERY choice alike, none marked: a litmus key, the timeline already read; not leak-checked), `custom` (needs `why` and
  `carrier`).
  The type sets help vs simplify and the default carrier.
- Offered when `content` is non-null and `offer` holds. `fact` is the scene fact while pulled.
- The set gives `declare`, `onScreen`, `simpler` and `bind(ctx)`; the component calls those and never re-switches on
  lever ids. The readable card lists the ids per mode from the set, so they cannot drift.
- Every miss of a mode is answered by a lever in it, or listed in `unanswered` with a reason.
- One id may have a spec per mode when its words differ by mode (cell-builder's `structure_jobs`); never two in a mode.
  When the words differ by item inside one mode (word reading's `model_word`: a decodable word is sounded out, a sight
  word said whole), `does` is a function of the item.
- When the model lever comes, by support tier, is the lever set's: a set with a `model` lever declares
  `support: { tier, different, own }`, and `supportFact` writes the `support` scene fact (easy models a different
  item first, medium after a miss, hard never before a try) and names the item's model lever. Enforced three ways:
  `leverSet` throws at import without `support`; a scene function returns `SceneOf`, whose type forbids `support`
  and `onScreen`; `leverScene` (the one merge `DiTeachingStage` and a bespoke mount use) throws on a scene that
  writes either. No family writes the tier sentence. A mount calls `support(item, ctx)` with the ctx it gives
  `declare` (or `bind(ctx).support`): only a model lever offered on the item counts, so the fact is '' when none is.
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

A boss family exports no scripted cue builders (`itemCue`, `moveOnCue`, `completeCue`, `pronounceCue`,
`judgingContract`, `correctionLines`, `verifyLine`, `*PackBase`) from any module its boss or component imports: the
boss is the one description of the activity. A boss id may not appear in `DI_PORTS` (`service/qa/di/diDrivePlan.ts`): that drive replays scripted cues the tutor
no longer receives; the boss's `drive` is its harness.

Ratchets over the source tree (lower the number in the change that moves a family; the current ceilings are in
`boss.test.ts`, not copied here): Pip wired by hand, hand-built `response: 'speech'` assignments, hand-written
"also accept" key text, levers built outside a lever set, scripted fallbacks beside the workspace, hand-written tier
support facts (0), hand-written key schema fields in generators, `adapters/*Live.ts`, and `PROSE_GUIDANCE_FAMILIES`
in `activityContract.test.ts`.

## Testing a boss

Free: `npm run test:primitive -- <id>` (the boss guards, the journey sweep, the workspace tests),
`node scripts/boss-card.mjs <id>` (the card and the guidance the tutor receives). Those are the gate. Paid Live is the user's. USER RULING 2026-10-19: a family moved to a boss is gated by the free checks only; ask the user for ONE `--samples 1` sample only when the change touches the shared path (a doctrine sentence, a judge or flow value, the assignment or key shape in `boss.ts`, host messages, tool descriptions) or adds `words.special`, and name that trigger. New card words (`job`, `answer`, `question`) fill shared sentences and need no sample. A miss is fixed on the shared path.
