# Contract: story-map

- **Derived:** 2026-10-09 (workspace W1 binding, batch C13; no earlier contract)
- **Component:** `primitives/visual-primitives/literacy/StoryMap.tsx` · **Domain:** `literacy/storyMapWorkspace.ts` ·
  **Generator:** `service/literacy/gemini-story-map.ts` · **Catalog:** `service/manifest/catalog/literacy.ts`
- **Modes:** `bme` · `story_mountain` · `plot_diagram` · `heros_journey`; one generated story each, mapped in phases.

## Requirements

### R1 — every phase is the activity's own check · OBSERVED
One story, two or three checked items: `identify` (every character + the setting), `sequence` (every event card in
its arc part), and `analyze` (conflict type) when grade ≥ 4 and the story has a conflict (`asksConflict`). Checks:
`identifyCorrect`, `sequenceCorrect`, `analyzeCorrect`. On the workspace path each commits through `commitCheck` with
`storyMapMiss`; the runtime owns progression. Probe: `StoryMap.workspace.test.tsx`, journey sweep J1-J8.

### R2 — nothing on screen or in the packet gives an answer away · OBSERVED
- The event bank is `eventBank(data)`: a seeded shuffle, never story order (the generator lists events in order).
- Character tiles print the name only; description and role print after a correct check (printed before, they
  marked which names are characters). Distractor names (the support tier's) never one the passage mentions.
- A wrong identify marks nothing; a wrong analyze on the workspace marks the pick only, never the answer.
- The scene lists choices in screen order, never flagged; no `arcPosition`, role or conflict type reaches the tutor.

### R3 — the support tier ships validated distractors · OBSERVED (2026-10-09)
The generator strips the LLM's raw `distractorCharacters` and calls `applyStoryMapSupportTier` (it was never called:
raw, unvalidated names shipped and the component ignored them). No tier, easy and medium: 1; hard: 2. Never 0:
`characterChoices` fills a shortfall from `FALLBACK_NAMES` (no word of the name in the story), on both paths.

### R4 — scripted path unchanged · OBSERVED
Outside a live runtime: Continue buttons, Try Again per phase, auto-advance and one submission. On the workspace:
no Continue, no scripted Try Again, no Reset; submission from the scored session under an evaluation provider only.

### R5 — levers never mark a name, place an event or single out a choice · OBSERVED (2026-10-09)
`storyMapLevers.ts`, workspace path only, state keyed by phase. identify: `character_count` (help; one empty person
space per character, filled per pick; declared only when a printed name is not a character, `countLeaks`).
sequence: `part_pictures` (help; what each part of any story does), `arc_arrow` (help; start → end). analyze:
`conflict_pictures` (help; a picture on every choice; the fact never repeats a label). Simplify: `easier_story`
(identify, sequence; a pool story, same `structureType`, two characters + one name not in it, none of the session's
names/events/title, `practiceLeaks`) and `easier_conflict` (a one-sentence pool conflict, three choices incl. the
crossed one). Practice is `<phase>~simpler`, ungraded; Try again keeps it; the full phase returns blank.
Probe: `storyMapLevers.test.ts`, `StoryMap.levers.workspace.test.tsx`, sweep J12/J13.

## Open
- **G1** — CLOSED 2026-10-09: identify always prints a non-character (R3).
- **G2** — setting distractors are two fixed strings ("An unknown city - Long ago", "A spaceship - In the future").
  Generator-authored settings → `/eval-fix`.
- **G3** — all four saved payloads are person-vs-nature; conflict type clusters → `/oracle-test`.
