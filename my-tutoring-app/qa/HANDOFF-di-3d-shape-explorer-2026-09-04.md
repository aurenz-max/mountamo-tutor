# HANDOFF — DI port for `3d-shape-explorer`

**Status:** scoped, not started. Executor: `/add-di-loop 3d-shape-explorer`, one coherent slice.
**Queue:** `qa/di/BACKLOG.md` item 18. `WORKSTREAMS.md` names this as the next codeable math port.
**Portfolio note:** it is the next **math** port, not the top item in the combined judged-loop queue; the main row currently names `gas-laws-simulator` and `ph-explorer` first.
**Scope date:** 2026-09-04.

## Paste-ready executor prompt

```text
/add-di-loop 3d-shape-explorer

Execute qa/HANDOFF-di-3d-shape-explorer-2026-09-04.md as the product and engineering brief.
This is an upgrade of the existing five-mode primitive, not a rebuild and not a new primitive.

Decisions already made:
- All five eval modes answer aloud. The pseudo-3D solid or real-world object remains the manipulable/visual stimulus; tapping a name, bin, option, or property answer is not the skill.
- Use the existing benched `shape_name`, `short_spoken_word`, and `number_word_to_20` classes. Spoken property verdicts use the existing `yes_no` accepted-build-ahead class. Do not add a response class.
- A click-era collection is not one judged item. Expand 2D/3D collections, real-world match grids, and property-question grids into one item per answer.
- Never ask for spoken zero. Reframe a zero count as a yes/no `any?` question. Positive counts 1..20 stay `number_word_to_20`.
- Remove answer buttons, sorting buttons/bins as response controls, the match grid, the property answer grid, Check, Next, local feedback grading, timers, and the generic `useLuminaAI` choreography. The Live tutor's verdict advances the run.
- Preserve the existing SVG solids, 2D SVGs, card shell, grade badge, progress/summary value, evaluation submission, and tier-controlled visual support after making support item-aware and leak-safe.
- Do not add Three.js/WebGL, do not redesign rotation/unfolding, and do not resurrect the stale PRD `compare` phase. Runtime/catalog truth is `shape-riddle`.

Required implementation:
1. Create `threeDShapeExplorerScript.ts` beside the component. Hand-author the judged cue surface, item builders, canonical shape facts, content gates, session dedupe, harness answers, and pack surface there.
2. Rewrite `ThreeDShapeExplorer.tsx` onto `useJudgedScriptRunner`. Render exactly the current item, wire evaluation to item IDs, hold answer-revealing pixels behind `runner.revealHeld`, and let the verdict be the only advance.
3. Update `gemini-3d-shape-explorer.ts` so generated data is KEEP-or-DROP through the script module's exported gates. Facts and fallback riddles must come from one code-owned truth table, not LLM arithmetic or hand-copied validation.
4. Update the math catalog to the DI contract: `audioInput: { manual_activity: true }`, `contextKeys: ['challengeType', 'stimulus']`, 18d-clean scaffolding, explicit spoken/visual modality descriptions, and the beta decisions in this handoff.
5. Add a `DiPortAdapter` in `service/qa/di/diDrivePlan.ts` using the script exports. There is no gesture cue for this all-voice pack.
6. Add `__tests__/ThreeDShapeExplorer.di-script.test.ts` and use `checkPackGates` plus `checkDiCatalogEntry`.
7. Run the focused suite, typecheck, census greps, full Vitest, one real-generator probe per eval mode (plus tier forks), and plain/signature/cap DI drives. Delete temporary probes.
8. Close the slice in BACKLOG item 18, update WORKSTREAMS, and file the next free HUMAN-CHECKS mic row. Re-read the next free ID immediately before filing.

Do not silently narrow this to identify-only. Do not leave any mode on click-era grading. If a live content shape cannot produce one defensible spoken answer, DROP it and report the generator finding; do not loosen the judge.
```

---

## 1. Ground truth and why this port is worth doing

This primitive already exists end to end:

- Component: `src/components/lumina/primitives/visual-primitives/math/ThreeDShapeExplorer.tsx`
- Generator: `src/components/lumina/service/math/gemini-3d-shape-explorer.ts`
- Catalog: `src/components/lumina/service/manifest/catalog/math.ts` (`id: '3d-shape-explorer'`)
- Registry: `src/components/lumina/config/primitiveRegistry.tsx` and `service/registry/generators/mathGenerators.ts`
- Tester: `src/components/lumina/components/MathPrimitivesTester.tsx`
- Curriculum PRD: `src/components/lumina/docs/PRD-KINDERGARTEN-GEOMETRY.md` section 3.2
- Existing QA: `qa/eval-reports/3d-shape-explorer-2026-03-17.md` — all five eval modes passed generator contract QA.

The curriculum purpose is stable: K-1 learners name solid shapes, distinguish flat from solid, connect solids to familiar objects, and reason about faces and movement properties. The existing screen makes every answer a click-era selection:

- identify: tap one of 3-4 printed shape names;
- 2D vs 3D: press `2D` or `3D` below each named shape;
- real-world match: consume a two-column matching grid until the last pair is free;
- properties: answer a whole grid through yes/no, number, and word buttons, then press Check;
- riddle: tap one of 3-4 illustrated, printed shape names.

At a teacher's table, the child looks at the solid or object and says the answer. The living object is the stimulus; the button is a costume. This port realizes the compact loop:

> one visible object → one spoken claim → exact tutor judgment → immediate visual reward

This is an interaction upgrade, not a generator/eval-mode birth. Preserve the five mode identities and their topic-fidelity wiring.

### PRD drift to respect

The detailed PRD table still names a fifth `compare` phase, but its own completion note says `shape-riddle` replaced compare, and code/catalog/eval QA all agree on `shape-riddle`. Do not reintroduce `compare` in this slice.

The PRD also describes real drag rotation and unfolding. The current component renders pseudo-3D SVGs and has display flags, but does not provide that complete interaction. That is a separate visual-depth residual. Do not turn a DI port into a WebGL or animation project.

---

## 2. Answer-material fork — decided

Every mode is spoken. There is no honest gesture answer in the current five modes: rotating a shape helps inspect it, but the final rotation is not the mathematical answer.

| eval mode | challenge type | judged item | response class | click-era shape removed |
|---|---|---|---|---|
| `identify_3d` | `identify-3d` | say the solid's mathematical name | `shape_name` (benched) | printed name options |
| `match_real_world` | `match-to-real-world` | for one familiar object, say its solid-shape name | `shape_name` (benched) | two-column matching grid and elimination |
| `2d_vs_3d` | `2d-vs-3d` | for one drawing, say `flat` or `solid` | `short_spoken_word` (benched) | `2D` / `3D` buttons and bins as answer controls |
| `faces_properties` | `faces-and-properties` | answer one property question aloud | facet-dependent; see below | yes/no, number, choice grid and bulk Check |
| `shape_riddle` | `shape-riddle` | say the mystery solid's name | `shape_name` (benched) | illustrated name options |

`faces_properties` deliberately expands into several item kinds:

| property facet | spoken form | class |
|---|---|---|
| positive `flatFaces` / `curvedSurfaces` count | number word, 1..20 | `number_word_to_20` |
| zero `flatFaces` / `curvedSurfaces` count | `Does it have any ...?` → yes/no | `yes_no` |
| `canRoll` / `canStack` / `canSlide` | yes/no, including natural variants | `yes_no` |
| shape of a flat face | `circle`, `square`, or `rectangle` | `shape_name` |

`number_word_to_20` explicitly excludes zero. A sphere's zero flat faces and a cube's zero curved surfaces therefore cannot ship as `How many?` items. The script changes only the question form, not the fact: `Does this shape have any flat faces?` has answer `no` and belongs to `yes_no`.

No new response class is owed. `yes_no` remains accepted-build-ahead and must carry its standing natural-variant clause (`yeah`, `nope`, `it does`, `it doesn't`) plus a human mic check.

---

## 3. Item model and fan-out

Create a local judged item union in `threeDShapeExplorerScript.ts`. Suggested kinds:

```ts
type ThreeDShapeItemKind =
  | 'identify_shape'
  | 'classify_dimension'
  | 'match_object'
  | 'count_property'
  | 'judge_property'
  | 'name_face_shape'
  | 'solve_riddle';
```

Each item needs a stable item ID, source challenge ID, source mode, public stimulus, canonical answer, response class, support tier, and only the facet-specific fields required to render and judge it. Do not pass the component's whole answer-bearing challenge into the tutor context.

Fan-out is mandatory:

- `identify-3d`: one challenge → one item.
- `2d-vs-3d`: one item per `mixedShapes` member.
- `match-to-real-world`: one item per `matchPairs` member.
- `faces-and-properties`: one item per property question.
- `shape-riddle`: one challenge → one item.

Use stable IDs such as `${challenge.id}:shape:${index}`; never use array position as identity. Once fan-out exists, `challenges[runner.currentIndex]` is wrong. Rendering, progress, phase summaries, result recording, and final evaluation must resolve by the judged item's source ID/facet.

Cap the session after expansion at a child-sized 6 judged items. Cap each collection challenge at 4 children before the global cap. A pinned real-world/property generation currently asks for 3-5 **challenges**, each containing 2-5 answers; blindly expanding all of them would create a 9-25 item session. Make the generator prompt target 4-6 judged opportunities, and make the build cap authoritative.

In mixed sessions, keep items of the same action together so the tutor does not recite a new how-to-play on every beat. Preserve stable source order inside each action family.

### Session repetition rules

- Across `identify_shape`, `match_object`, and `solve_riddle`, a 3D shape name may be the answer only once per session. After it is affirmed, asking for the same name through another costume is recall.
- For binary flat/solid and yes/no properties, repeated answer words are unavoidable; balance and avoid long same-answer runs instead of globally deduping them.
- Drop an exact repeated `(kind, stimulus, facet)` item everywhere.
- Never emit the same spoken ask twice in a row.

`droppedChallenges` should count source challenges that produce no items. Also expose/record dropped child-item reasons during probes, because a partially usable collection can otherwise hide a high content drop rate.

---

## 4. Canonical content and KEEP-or-DROP gates

The current generator lets Gemini author geometry facts and then supplies defaults. DI judgment needs one source of truth. Put a canonical table in the script module and import it into the generator:

```ts
const SHAPE_FACTS = {
  cube:               { flatFaces: 6, curvedSurfaces: 0, faceShapes: ['square'],    canRoll: false, canStack: true,  canSlide: true },
  sphere:             { flatFaces: 0, curvedSurfaces: 1, faceShapes: [],            canRoll: true,  canStack: false, canSlide: false },
  cylinder:           { flatFaces: 2, curvedSurfaces: 1, faceShapes: ['circle'],    canRoll: true,  canStack: true,  canSlide: true },
  cone:               { flatFaces: 1, curvedSurfaces: 1, faceShapes: ['circle'],    canRoll: true,  canStack: false, canSlide: true },
  'rectangular-prism':{ flatFaces: 6, curvedSurfaces: 0, faceShapes: ['rectangle'], canRoll: false, canStack: true,  canSlide: true },
} as const;
```

The table is both generator truth and script gate truth. The generator may choose the target shape and object; it must not invent the shape's facts.

Add an explicit property facet to the generated question contract:

```ts
propertyKey?:
  | 'flatFaces'
  | 'curvedSurfaces'
  | 'faceShape'
  | 'canRoll'
  | 'canStack'
  | 'canSlide';
```

The item builder derives the expected answer from `SHAPE_FACTS`. `correctAnswer` may remain temporarily for compatibility, but it must agree with the derived answer or the question is dropped. Do not infer a facet from arbitrary prose at runtime.

Required gates, all exported from the script and imported by the generator:

1. **Canonical name:** every 2D/3D name is in the closed domain. Unknown names drop; they do not become `cube`.
2. **Dimension agreement:** `is3d` must agree with the code-owned 2D/3D set. A model-emitted flag never overrules the name.
3. **Fact agreement:** `properties`, `propertyKey`, and `correctAnswer` agree with `SHAPE_FACTS`.
4. **One defensible face answer:** `faceShape` ships only when the solid's flat faces have one named 2D shape. A sphere has none; do not make up an option.
5. **Spoken-number window:** number answers are integers 1..20. Zero is converted at item construction to the code-owned yes/no `any?` ask; negative, fractional, or larger counts drop.
6. **Sayable real-world object:** a match object has a short, child-owned name; no quotes, sentinel opener, markup, or instruction-like prose.
7. **Object-name leak:** a real-world object's spoken/printed name may not contain the target shape name or an accepted alternate. `ice cream cone → cone` is a leak; use a non-answer label such as `party hat` or drop it.
8. **Riddle leak:** no clue, instruction, title, or description contains the answer shape name or accepted alternate.
9. **Riddle uniqueness:** the clue set must identify exactly one entry in `SHAPE_FACTS`. Prefer code-owned clue atoms selected from the fact table. Do not validate free prose with a fragile substring parser.
10. **Riddle consistency:** every clue is true of its keyed shape. `cone` and `cylinder` share curved/circular properties; a riddle needs a distinguishing fact such as one point versus two flat faces.
11. **Wrapper neutrality:** title/description may not preview any shape name that will be an answer in the session. Fall back to neutral chrome such as `Solid Shape Lab`; never replace an answer token with `???` and ship the damaged sentence.
12. **Stable uniqueness:** unique source IDs, item IDs, and no repeated skill key or consecutive identical ask.
13. **Item budget:** 1-6 kept items, collection child cap 4.

Invalid generated content is dropped, not silently rewritten into a different question. Deterministic facts/riddle atoms should be constructed from code before validation; that is the authored content source, not a repair of Gemini prose. Every fallback path must pass the same gates.

---

## 5. Pixel-level leak rules

String scans are insufficient because the existing UI prints or highlights many answers.

### `identify_3d`

Show one solid. Delete the option grid and do not print the solid's name before judgment. On affirmation/reveal, ring it and show the name as the earned result.

### `2d_vs_3d`

Show one shape at a time using the existing code-owned SVG renderers, not the generated emoji as the primary percept. Before judgment, do not print its name and do not show the labeled flat/solid bins. Ask `Flat or solid?`; accept `2D/two-dimensional` for flat and `3D/three-dimensional` for solid as explicit per-item alternates.

### `match_real_world`

Show one object at a time and name that object in the ask. Delete the shape column, arrows, consumed matches, and all shape-name choices. The object's identity is public stimulus; the solid-shape name is not.

### `faces_properties`

The solid's mathematical name may remain visible/audible because the answer is a property, not its identity. Render one property question at a time.

`showElementLabels` is not automatically safe merely because it omits a total:

- `flat faces (circles)` directly answers a `faceShape` item;
- `curved surface` directly answers `Does it have a curved surface?`;
- the presence or absence of `flat faces` can answer an `any flat faces?` item.

Therefore compute item-aware support. Before judgment:

- hide all labels that name the current facet or answer;
- allow count-tracking highlights only for a positive count item and never print a total;
- hold the full labels/checklist behind `runner.revealHeld` for yes/no and face-shape items.

The current `showFaceHighlight` implementation is only a ring around the whole SVG, not a per-face sequence. Preserve it as a cue if useful, but do not claim it proves or displays individual face counts.

### `shape_riddle`

Keep the clue card as the source and have the tutor read every clue for pre-readers. Delete all illustrated answer options and shape names. A neutral mystery mark may replace the option grid. Reveal the keyed solid/name only after the verdict.

### Reveal lifecycle

Set the current item's reward/reveal in `onAffirmed`; do not clear it in `onItemOpened` before the affirmation can be seen. Correction may briefly show the answer only as part of the tutor's modeled turn, then the same item is asked again. The next item must start clean.

---

## 6. Hand-authored teaching surface

The exact wording belongs in `threeDShapeExplorerScript.ts`, not Gemini output and not catalog hint prose. Every ask must be answerable by a pre-reader from what the tutor says plus what the screen shows.

Representative shapes (author the final lines in code):

- identify: `Look at this solid. What shape is it?`
- classification: `Look at this shape. Is it flat or solid?`
- real-world match: `This is a soup can. What solid shape is it like?`
- positive count: `This is a cylinder. Touch each flat face once with your eyes. How many flat faces?`
- zero count: `This is a sphere. Does it have any flat faces?`
- movement property: `This is a cube. Could it roll smoothly? Yes or no?`
- face shape: `This is a cube. What shape is each flat face?`
- riddle: read the bounded clue set, then `What solid shape am I?`

Corrections open with `My turn:` and end by re-asking the same question. Affirmations open with `Yes,` and state the earned mathematical claim. Nothing else opens with either sentinel.

### Signature errors the contract must name and the harness must drive

- `identify_shape`: says the 2D look-alike/face instead of the solid (`circle` for sphere, `square` for cube, `rectangle` for rectangular prism).
- `classify_dimension`: confidently reverses flat and solid.
- `match_object`: repeats the everyday object (`ball`, `box`, `can`) instead of translating it into a mathematical solid name.
- `count_property`: off by one; the correction models touching each face exactly once.
- zero/boolean property: confuses no flat faces with one curved surface, or confuses rolling with sliding/stacking.
- `name_face_shape`: says the solid name instead of the shape of its flat face.
- `solve_riddle`: picks the nearest solid sharing one clue (`cone` for cylinder or vice versa) while ignoring the distinguishing clue.

For `shape_name`, state alternates per item. Do not accept an everyday object name as a mathematical name. `rectangular prism` is the spoken canonical form; any child-language alternative such as `cuboid` must be an explicit product choice and test case, not judge latitude. Keep cube and rectangular prism distinct.

### Support tiers

Preserve the current easy/medium/hard annotation withdrawal, but make it answer-safe:

- easy: strategy/model on a different, unused example where possible, plus item-safe visual cues;
- medium: one strategy nudge, no answer-bearing labels;
- hard: cold ask and bare percept.

Never model the current target answer before the ask. For properties, model the action (`look at one flat face at a time`) rather than the total. For riddles, model using **all** clues rather than naming a candidate.

---

## 7. Component rewrite requirements

Use `useJudgedScriptRunner` as the single interaction clock and `JudgedScriptPack` as the teaching contract.

Delete from `ThreeDShapeExplorer.tsx`:

- `useLuminaAI`, every `sendText`, connect-time activity introduction, and `tutorRevealClause`;
- `useChallengeProgress` as the advancement clock;
- `selectedOption`, `sortedShapes`, `matchSelections`, `selectedMatchObject`, and `propertyAnswers`;
- all five local checker functions and `handleCheckAnswer`;
- the `canCheck` branch;
- Check and Next controls;
- local success/error feedback that grades or reveals the answer;
- the answer option grids, match grid, classification buttons/bins as response controls, and property answer controls;
- any click-era SoundManager correctness/retry path. The shared runner owns verdict feedback.

Preserve/re-base:

- `Shape3DSVG`, `Shape2DSVG`, gradients, card shell, grade badge, and a compact judged-item progress display;
- neutral exploration of the visual stimulus if it does not commit an answer;
- support-tier fields and current display flags, after item-aware leak filtering;
- `usePrimitiveEvaluation`, but submit from runner item results exactly once;
- phase/summary information only if it is computed from judged items rather than source challenge indices.

The runner gates every attempt through `runner.canAttempt`. Do not branch on `runner.stage` to decide whether an answer is allowed. This pack has no gesture item, so it does not call `armStillness` or `submitGestureAttempt`.

Evaluation metrics must stop assigning the same overall accuracy to every metric. Compute from the relevant judged subsets when present:

- identification/classification/riddle → `identificationAccuracy`;
- property items → `propertyKnowledge`;
- real-world items → `realWorldConnections`.

For a pinned mode with no items in another subset, use a documented neutral/not-observed policy rather than fabricating evidence from overall accuracy. Do not change the public metrics type in this slice unless the existing type makes an honest result impossible; if it does, report that as a scoped follow-up.

---

## 8. Generator and catalog changes

### `gemini-3d-shape-explorer.ts`

- Keep `resolveEvalModeConstraint`, the five challenge type docs, `buildScopePromptSection`, and topic-fidelity behavior.
- Import canonical facts, validators, and item-count constants from `threeDShapeExplorerScript.ts`.
- Add `propertyKey` to schema/prompt requirements.
- Stop asking Gemini to invent authoritative geometry facts or riddle truth. It chooses target shapes/objects; code derives facts and code-owned clue atoms.
- Replace mutation fallbacks such as unknown shape → cube with KEEP-or-DROP. Fallback challenges remain, but they enter through the same validation/build gates.
- Change density wording from 3-5 compound challenges to enough source data for 4-6 judged items after fan-out, without allowing one compound challenge to monopolize the session.
- Preserve `targetEvalMode` and per-challenge support tier application in pinned, blended, and mixed generation.
- Replace the `???` riddle-name scrub with reject/drop plus valid code-owned fallback.
- Log drop reasons and final **judged opportunity** count, not only source challenge count.

### `catalog/math.ts`

For `3d-shape-explorer`:

- add `misconceptionScope: 'primitive'`;
- add `audioInput: { manual_activity: true }`;
- set tutoring context to exactly `['challengeType', 'stimulus']`;
- replace answer-bearing `{{shape3d}}`, `{{properties}}`, and click-era scaffolding with the standard live-judged frame;
- apply item 18d at birth: scaffolding levels command fidelity to the scripted correction and never offer a competing speakable line;
- include the shared `TWO_BRANCH_LAW`, `[CURRENT STATE]` handling, and never-perform tail used by shipped judged-loop catalog entries;
- describe each mode by what the child **says**, and state that there are no answer buttons/Check/Next.

Intended IRT betas:

| eval mode | current | ship | rationale |
|---|---:|---:|---|
| `identify_3d` | 1.5 | **2.0** | 1-of-4 printed name menu → unaided mathematical-name production |
| `match_real_world` | 2.5 | **3.0** | word column and process-of-elimination grid removed; one object → one produced shape name |
| `2d_vs_3d` | 3.5 | **3.5** | same binary discrimination and same spoken closed pair; only the button is removed |
| `faces_properties` | 4.5 | **4.5** | menus are removed, but the bulk grid is decomposed into one focused property at a time; do not claim a net raise without evidence |
| `shape_riddle` | 5.5 | **6.0** | 1-of-4 illustrated menu → unaided name from the full clue conjunction |

Record these rationales beside the values. If live evidence forces a different beta, call it out explicitly; do not silently leave stale click-era calibration comments.

No changes are required in the primitive registry, math generator registry, global response-class register, or tester selector unless the implementation proves an actual contract gap.

---

## 9. Exact files

### Create

- `src/components/lumina/primitives/visual-primitives/math/threeDShapeExplorerScript.ts`
  - judged item union;
  - canonical 2D/3D vocabulary and `SHAPE_FACTS`;
  - item fan-out/build functions and drop reasons;
  - leak, fact, uniqueness, sayability, repetition, and count-window gates;
  - code-authored asks/models/corrections/affirmations;
  - pack surface and harness answers.
- `src/components/lumina/primitives/visual-primitives/math/__tests__/ThreeDShapeExplorer.di-script.test.ts`
  - pure contract and content tests; no browser dependency.

### Modify

- `src/components/lumina/primitives/visual-primitives/math/ThreeDShapeExplorer.tsx`
  - runner rewrite, one-item rendering, answer-control deletion, item-aware reveal/support, item-based evaluation.
- `src/components/lumina/service/math/gemini-3d-shape-explorer.ts`
  - explicit property facets, code-owned facts/riddles, imported gates, item-aware density, drop logging.
- `src/components/lumina/service/manifest/catalog/math.ts`
  - DI catalog contract, audio input, context keys, clean scaffolding, mode descriptions, beta changes.
- `src/components/lumina/service/qa/di/diDrivePlan.ts`
  - all-voice `DiPortAdapter`, answer harness, no gesture cue.
- `qa/di/BACKLOG.md`
  - close under item 18 with files, findings, gates, drives, and residuals.
- `qa/HUMAN-CHECKS.md`
  - next free mic row, currently advertised as #131 but re-grep before filing.
- `WORKSTREAMS.md`
  - update the math sub-row and combined judged-loop evidence without changing unrelated priorities.

### Generate during verification, then keep only final reports

- `qa/tutor-reports/3d-shape-explorer-live-di-plain-2026-09-04.md`
- `qa/tutor-reports/3d-shape-explorer-live-di-signature-2026-09-04.md`
- cap report if the harness writes a distinct file.

Delete temporary live-probe files after the run.

### Explicitly do not touch unless a proven gap appears

- `src/components/lumina/hooks/judgedScriptContract.ts` — all needed response classes already exist.
- `src/components/lumina/config/primitiveRegistry.tsx`
- `src/components/lumina/service/registry/generators/mathGenerators.ts`
- unrelated geometry primitives or the PRD's visual-depth promises.

---

## 10. Verification and acceptance

### Focused machine gates

The new suite must prove, at minimum:

- every mode maps to the intended answer kind/class;
- each compound challenge fans out to one item per answer and stable unique IDs;
- source-index and item-index cannot be confused;
- canonical facts for all five solids;
- 2D/3D flags cannot contradict names;
- zero counts become yes/no and never `number_word_to_20`;
- positive counts stay within 1..20;
- real-world object names cannot contain the answer shape name;
- riddle clues are answer-name-free, true, and uniquely identify one solid;
- answer-bearing labels/options are reveal-held;
- repeated exact items and repeat shape-name answers drop;
- session cap and per-collection cap hold;
- all correction/affirm branches obey sentinels;
- every signature wrong is refused and every canonical/natural alternate is affirmed;
- `checkPackGates` passes a normal pack and bites on a seeded leak/repetition/sentinel fault;
- `checkDiCatalogEntry` passes the final catalog entry;
- empty/all-dropped input fails safely rather than mounting a dead loop.

Run:

```powershell
npm run typecheck:lumina
npx vitest run src/components/lumina/primitives/visual-primitives/math/__tests__/ThreeDShapeExplorer.di-script.test.ts
npx vitest run
```

Run component census greps and require zero click-era choreography in the ported component (comments count):

```powershell
rg -n "useLuminaAI|sendText|handleCheck|canCheck|LuminaActionButton|selectedOption|sortedShapes|matchSelections|propertyAnswers|setTimeout" src/components/lumina/primitives/visual-primitives/math/ThreeDShapeExplorer.tsx
```

### Real pipeline probes

Use the real generator, not fixtures:

- one pinned probe for each of the five eval modes;
- at least easy and hard property probes, because visual support is item-aware there;
- one blended/mixed probe to prove every challenge receives its own tier and fan-out stays grouped;
- build the final judged pack from each payload and run `validateJudgedScriptPack`/`checkPackGates`;
- report source challenge count, judged item count, partial drops, total drops, shape-answer dedupe, and zero-question reframes.

A clean JSON schema response is not sufficient. The probe must exercise the same item builder the component and drive adapter use.

### Headless judged-loop drives

Add the adapter, then drive all five modes through plain, signature-wrong, and cap paths. The claims to prove are:

- wrong answers are refused without advancing;
- the exact correction re-asks the same item;
- right answers are affirmed and the tutor's affirmation alone advances;
- no mode requires a click to answer or continue;
- no shape name/property is spoken or printed before it is legitimately public;
- the final item completes once, with no false completion claim or hanging listener;
- cap drill reports no HIGH findings; inherited/open family WARNs are named rather than hidden.

### Browser and human acceptance

Browser-check all modes in `MathPrimitivesTester`:

- one-item-at-a-time rendering after fan-out;
- SVG depth remains legible at mobile and desktop widths;
- flat/solid mode uses the actual shape drawing, not a semantic emoji shortcut;
- property support does not reveal the active answer;
- clue card is readable while answer options are absent;
- correction/reveal/next-item transitions do not flash the next answer;
- completion summary and evaluation submission are coherent.

File a mic row and have the human deliberately say:

- `circle` for a sphere;
- the opposite `flat/solid` classification;
- `ball` instead of `sphere` in a real-world match;
- an off-by-one face count;
- `yes` for a cube rolling, and a natural `nope` on a true no-answer;
- `cylinder` for a cone riddle sharing curved/circular clues;
- `rectangle prism`/a young-child production of `rectangular prism` to hear the acoustic edge.

The row also confirms open-mic transport, VAD, ASR, audio tail, and that the tutor's own `Yes,` is the only advancing event. Machine drives do not close this row.

---

## 11. What success looks like

A Kindergartener sees one shape, hears one exact prompt, and answers without hunting through UI chrome. A correct spoken claim makes the solid visibly come alive and moves immediately to the next object. A plausible misconception gets a short, exact model tied to the geometry on screen, then the same question comes back. The primitive still looks and feels like 3D Shape Explorer; it simply stops outsourcing the mathematics to buttons.

## 12. Do not do these things

- Do not create a second `di-3d-shape-explorer` primitive.
- Do not route around the existing primitive to `di-shapes`; this primitive owns 2D/3D, real-world, property, and riddle demands that the naming pack does not.
- Do not retain tap fallback answer buttons “for accessibility” without a product ruling; voice is the answer material in this port.
- Do not use generated `instruction`, catalog scaffolding, or generic tutor improvisation as the judged ask.
- Do not trust LLM geometry facts, `is3d`, answer keys, or riddle uniqueness.
- Do not ask a child to say zero under `number_word_to_20`.
- Do not let a compound grid become one all-or-nothing judged item.
- Do not infer current content from `runner.currentIndex` into the source challenge array.
- Do not add hand-written timers or auto-advance.
- Do not expand scope into true 3D rotation, unfolding, WebGL, UI-kit migration, new eval modes, or curriculum rewrites.

