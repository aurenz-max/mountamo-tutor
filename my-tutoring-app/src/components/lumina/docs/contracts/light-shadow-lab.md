# Contract: light-shadow-lab

- **Derived:** 2026-10-09 (workspace W1 binding; no earlier contract) · **Re-based:** 2026-10-19 (boss framework)
- **Component:** `primitives/visual-primitives/astronomy/LightShadowLab.tsx` · **Domain:** `astronomy/lightShadowWorkspace.ts` ·
  **Card / boss:** `astronomy/lightShadowLab.card.ts` + `astronomy/lightShadowLab.boss.ts` (`tapBoss`, commit `Check Answer`) ·
  **Generator:** `service/astronomy/gemini-light-shadow-lab.ts` · **Catalog:** `service/manifest/catalog/astronomy.ts`
- **Modes:** `observe` · `predict` · `measure` · `apply`; one challenge type each.

## Requirements

### R1 — the key is recomputed and the choices are built in code · OBSERVED
The key is the shadow binned from the item's own sun (`keyShadow`: azimuth <80 W, >100 E, else N; altitude <30 long,
<=60 medium, else short), or on apply its time (`normalizeTime`). `shadowOptions` builds four choices in the key's own
form, each wrong one a named error, in a shuffle seeded by the item; the generator's free-text distractors ("Morning",
"Pointing North") are not drawn, because the key was the only option in its own format. A wrong apply time casts a
different shadow from the key and from every other option. Probe: `LightShadowLab.workspace.test.tsx` (every saved
payload item: 4 distinct choices, key once, every wrong one named).

### R2 — what a mode asks is not drawn while it is open · OBSERVED
predict draws no shadow until the prediction is right; apply draws no sun and no clock until the time is right; the
"Shadow: <length>, <direction>" readout appears only after a right answer (the easy tier's live readout printed the
answer's words; `showLiveShadowReadout` no longer shows it while working). observe opens the sun where its shadow
points the other way (`openingSun`) and draws a mark per time, where the dragged sun snaps. The wrong-answer hint is
`shadowHint` (points at the evidence); the generator's hint often stated the shadow and is not drawn.
Probe: workspace test (predict, apply, observe cases).

### R3 — the check is the activity's own, and the key stays off the tutor · OBSERVED
One tapped choice and Check Answer (every card mode `TAP_ONE`, the press named in its `moves`); `shadowCorrect` judges. It
commits through `commitCheck` with
`shadowMiss` (`toward_sun`, `side_when_overhead`, `below_when_side`, `length_flipped`, `length_off`, `both_wrong`;
apply `mirror_time`, `wrong_height`, `other_time`). The scene names the sun's height and side where it is drawn, the
choices on screen (`choices`) and the learner's choice, never the shadow on observe/predict/measure or the time on apply;
how to answer is the card's `moves`, not a scene fact. Try again clears the choice and puts the sun back. The journey
taps the choice button `option-<i>` (its place in `shadowOptions`) and presses Check Answer. Probe: workspace test +
journey sweep J1-J8.

### R4 — taught only on the workspace · OBSERVED (re-based 2026-10-19)
Was: "scripted path kept" (Next Challenge / See Results, a reveal after three misses, scripted cues). The boss framework
retires every scripted fallback (one path, 09-23): the component exports through `withWorkspaceOnly`, an unbound mount
(the tester) shows the shared NeedsTutor card, and the runtime owns Try again and Next. No Next, no answer shown, no
`sendText`, no `useLuminaAI`. The catalog `tutoring` block is deleted (bound sessions send `tutoring: null`). Probe:
`boss.test.ts` (workspace-only, no Pip by hand), workspace test.

### R5 — levers never draw or name the item's shadow or time · OBSERVED (2026-10-09)
`lightShadowLevers.ts`, one lever set (`SHADOW_LEVERS`). `side_model` (model): three fixed pictures, a sun left /
overhead / right with its shadow; `height_model` (model): two fixed pictures, a low and a high sun on the left with a
long and a short shadow; when the two models come is the lesson tier's `support` fact (medium when none);
`shadow_zones` (marks, observe and measure): unlabelled ground marks on both sides at the short/medium and
medium/long edges. None reads the item. `easy_sun` / `easy_shadow` (easier): `<item>~easier`, same type, an obvious
sun (`PRACTICE_SUNS`) whose shadow differs from the item's, two code-built choices, neither the item's answer
(`practiceLeaks`), ungraded; the full item comes back blank. Lever state keyed by item; Try again keeps a pulled lever
and a practice item. The drawn object is a fixed 100px, so the drawn shadow's length falls in the key's own bins
(it used to scale with `objects[0].height`, and a tall pole at noon drew a medium-looking shadow for a short key).
Starting positions: easy tier sets `startLevers` (observe/measure `shadow_zones`; predict/apply both models), drawn
and declared pulled, recorded as no help. Probe: `lightShadowLevers.test.ts`, `LightShadowLab.levers.workspace.test.tsx`,
sweep J9/J12/J13.

## Log
- 2026-10-19: moved onto the boss framework (`tapBoss`). R4 re-based from the scripted path to workspace-only. Model and
  easier levers now take their type's default carrier (`both`; was `shown`), and the models gain the tier `support`
  fact. Legacy deleted: `adapters/lightShadowLabLive.ts`, the hand-built assignment, the scene's `howToAnswer` and
  `constraints` facts, the catalog `guidance` prose and `tutoring` block, `useWorkspacePipSurface`, the journey's
  `ANSWER_*`/`NEXT_ITEM`/`ALL_COMPLETE`/`SUPPORT=` leak tokens (nothing emits them).

## Open
- **G1** — apply instructions describe the shadow in words ("long and points west"), so the item can be answered from the
  text without reading the picture; and they name a "flagpole" when `objects[0]` (the one drawn) is a person.
  Generator question → `/eval-fix`.
- **G2** — the generator's `distractor*` and `hint` fields are now unused; dropping them from the schema is a cleanup.
- **G3** — at the easy tier, predict and apply open with both model pictures already drawn (`startLevers`), while the
  tier `support` fact tells the tutor to pull a model before the first try; the pull is refused as already on screen.
  Either drop the models from easy `startLevers` (the support fact now brings them) or leave it: `/add-support-tiers`.
