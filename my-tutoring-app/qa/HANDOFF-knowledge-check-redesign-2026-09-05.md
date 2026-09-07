# HANDOFF — knowledge-check redesign: a stimulus channel, production item kinds, and a set-sized plan

Paste-able execution prompt for a new session. Authored 2026-09-05 after the `/lesson-coverage`
items 20–24 passes and the DIMF-1 execution; every anchor verified against the working tree at
HEAD `315f7bfb` (+ uncommitted 09-05 work). **This is a DESIGN handoff.** It says what the
evidence shows, why the current knowledge-check (KC) cannot be patched into fitness, which new
insets and item kinds close the gap, and how to phase it so every slice is gated at runtime.
Read §1–§3 before touching code; §8 is the executable plan.

The user's framing (2026-09-05): *"KC is showing we need a redesign, I'm seeing it come up all
over the place."* The evidence agrees, and it is not five bugs — it is three structural gaps
that every K-2 lesson trips over because KC is the one block in every lesson.

---

## 0. Where KC sits today (read once)

- **Catalog:** `service/manifest/catalog/assessment.ts:11` — "Assessment checkpoint … SPOKEN-FIRST
  … Without a microphone it is a tap surface." `role: 'assess'`, `minutes: 4`, `maxPerLesson: 1`,
  eval modes `recall | apply | analyze | evaluate` (a Bloom ladder; β 1.5 / 3.0 / 4.5 / 6.0 in
  `backend/app/services/calibration/problem_type_registry.py:426`).
- **Selection:** the curator puts ONE `knowledge-check` in `finalAssessment` with a `count`
  (`gemini-manifest.ts:248-266`, "assesses ALL objectives together"). Every package on disk
  requested 4 or 5 problems for 2 or 3 objectives.
- **Generation:** two stages. `gemini-knowledge-check-orchestrator.ts` (418 lines) plans
  `{problemType, difficulty, insetType, visualType, brief, objectiveId}` per problem from the
  objective texts; `gemini-knowledge-check.ts` (1933 lines) generates each problem in parallel.
  Problem types: `multiple_choice true_false fill_in_blanks matching_activity
  sequencing_activity categorization_activity` (+ `scenario_question short_answer` in the type
  union, never planned). Insets: `katex data-table passage chart code number-line
  definition-box image equation-setup` (`types.ts:465-590`, renderers in
  `primitives/problem-primitives/insets/`). Visuals (G1 only): `object-collection`,
  `comparison-panel`.
- **K band:** `PRE_READER_PROBLEM_TYPES = {multiple_choice, true_false}`
  (`gemini-knowledge-check.ts:209`) and `PRE_READER_MC_PALETTE` (`:216`): *"Do NOT reference any
  picture, diagram, chart, box … NO visual is shown on screen. The ONLY picture is the emoji on
  each option."* K explicitly clears the visual plan (`:1845`).
- **Runtime:** `primitives/KnowledgeCheck.tsx` + `knowledgeCheckScript.ts` — the DI port
  (`qa/di/BACKLOG.md` item 23 slice 2, 2026-08-18). Item kinds → benched response classes:
  `true_false → yes_no`, `choice → closed_set_choice`, `choice_tap → manipulation` (KaTeX /
  bare numbers / symbols only), `blank → short_spoken_word`, `match → closed_set_choice`,
  `sort → closed_set_choice` (microstep). `sequencing` / `scenario` / `short_answer` are NOT
  askable; a set containing one falls back to taps **as a whole** (all-or-nothing, forced by the
  `::pN` completion gate, contract R7).
- **Contract:** `docs/contracts/knowledge-check.md` R1–R7 (answer-key integrity, K
  picture-primary MCQ/TF floor, grade-over-Bloom realization, eval-mode identity, visual-task
  evidence, viewport-gated mic, composite ids). **Every requirement below must be re-derived, not
  silently broken** — run `/primitive-contract knowledge-check --check` on each slice.
- **Evaluation:** `service/qa/lessonCoverage/evaluateLessonCoverage.ts` judges every assembled
  lesson; `MIN_SUFFICIENT_ASSESSMENT_ITEMS = 2` distinct items per objective
  (`lessonCoverage/types.ts:42`); `ASSESSED_INDIRECTLY` = "recognition for a production
  objective".

---

## 1. What the evidence shows (38 judged lessons, 78 objectives, 20 packages, all K except one)

| # | Signal | Measurement | Where it shows |
|---|---|---|---|
| S1 | **KC is under-sized per objective by construction** | Requested `count` vs objectives: (4,2)×9 · (4,3)×5 · (5,3)×4 · (5,2)×1 · (3,3)×1 → **1.3–2.5 items per objective**, against a judge that needs ≥2 distinct items. KC items cited per objective: **0 → 40 objectives, 1 → 18, 2 → 14, 3 → 1, 6 → 5.** | every package; `lesson-bench/BACKLOG.md` items 20–24 |
| S2 | **When KC is the ONLY assessment surface, it fails every time** | 5 objectives had KC as their sole evidence → **5/5 `ASSESSED_INSUFFICIENTLY`** (addition obj3 "bigger number" 1 item; shapes obj3 "compare by corners" 1 item; CVC obj1 and obj3; subtraction obj2 equals-sign). | `qa/lesson-coverage/evals.jsonl` |
| S3 | **Named-set drop** — an objective names N elements, KC samples one | "minus AND equals" → minus ×2, equals ×0 (KC-1); "+ AND =" → same shape (item 21); shapes "real-world shape finding only evaluates circles"; phonics-2 "review letters p, n, i not assessed". KC constraints across rows: `insufficient_items` ×5. | `EVAL_TRACKER.md` KC-1; items 21, 22, 24; phonics-2 rows |
| S4 | **Recognition where the objective is production** | 5 `off_target_assessment` constraints on KC instance ids, all phonics: *"Multiple-choice listening questions evaluate receptive phoneme recognition rather than oral production"*, *"true/false definition rather than grapheme-to-phoneme production"*. The journey extractor already classes KC MC/TF as onset/letterform → off-target, `NO_CONTENT_ADAPTER` (item 17 residual (c)). | phonics-1/3 rows; `lesson-bench/BACKLOG.md:218` |
| S5 | **Type collapse at K** | 84 KC problems on disk: MC 66 · TF 15 · fill 1 · match 1 · sequence 1. **At K: 79/79 are MC or TF.** The orchestrator's "diversity rule" (≥2 types for 3+, ≥3 for 5+) is voided by the K floor every time. | package census (this handoff) |
| S6 | **No stimulus channel at K** | The K palette forbids any on-screen evidence: the question is a spoken sentence and the only pictures are option emoji. So "identify the equals sign", "what number is shown", "which shape has 3 corners", "read this word" cannot be asked as *identify* tasks — they degrade to "which sign means take away?" (a vocabulary recall over emoji ➖ ➕ 🟰, `…e1b7` problems[2]) or to text descriptions the census already banned ("the shape with 3 sides"). | `gemini-knowledge-check.ts:216-235`; `…e1b7`, `…mb4f` KC blocks |
| S7 | **Cross-objective duplicates** | CVC draw: problem 4 (obj3, "read a CVC word") = problem 0 (obj1, "identify short a") — same stem, same key, 2/3 identical options. Prompt-only distinctness rule added, **unconfirmed**. | item 23 "CONTENT fix" |
| S8 | **Commit path at K** | Child answers aloud and is still asked to tap (user label on `…pgr5`, di item 23 OPEN 09-04). | `qa/di/BACKLOG.md` item 23 |

**Objective verbs that ended under-assessed across all rows: identify 21 · apply 17 · compare 2 ·
explain 1.** KC is the block that is supposed to backstop every one of them.

### Read of the evidence

S1+S2 are the same fact: the plan is sized by a curator `count`, not by the objectives. S3 is the
same fact one level down: within an objective the plan is sized by a brief, not by the named set.
S4+S5+S6 are one fact: at K the KC can only ask *"which of these pictures…"*, so it can only
measure recognition, and it cannot show the thing the objective is about. S7 is a symptom of S1
(too few slots → the model reuses a stem). S8 is a runtime defect on the ported surface.

**Three structural gaps, not eight bugs:**

1. **Plan sizing is count-driven, not set-driven** (S1, S2, S3, S7).
2. **No stimulus channel at K/G1** — insets are all reading-dependent or adult (S5, S6).
3. **Item kinds are pick-from-N, so the child recognizes instead of produces** (S4, S5, S8).

Each of the five prompt-only patches this month (KC distinctness rule, DSP-1 named-set rule,
G1 visual gate, K palette, Grade-1 reader profile) attacked one symptom inside the LLM window.
The rulings on file say the structure belongs in code: `feedback_llm-window-code-builds-structure`
("LLM emits scope; code builds structure + answer"), `feedback_n-challenges-n-problems` ("content
varies first"), `feedback_trust-intent-over-hardcoded-caps` ("a cap below lesson intent is a BUG
… SESSION LENGTH when the objective names an enumerable set"), `feedback_schema-over-regex-and-prompt`.

---

## 2. Design principle for the redesign

> **The knowledge check is a per-objective sampler of PRODUCTION items over a SHOWN stimulus,
> sized by each objective's enumerable set, run spoken-first by the judged loop.**

Four consequences, each of which maps to a slice in §8:

- **Sized by the set, in code.** Items = Σ over objectives of `max(2, |named set|)`, capped by
  the block's minute budget, never by a curator `count`. The orchestrator receives the slot list
  and writes briefs; it does not decide how many or for which element.
- **Every item has a stimulus the child can see or hear** that is NOT the answer (the same
  "stimulus ≠ answer" identity the DSP-2 fix restored on `say_answer`). At K the stimulus is an
  inset built from a small K-2 inset family (§3), or a spoken cue the tutor reads.
- **The child produces** — says a name / sound / number word / yes-no, or points at a position
  when the answer is a location or form (`feedback_di-spoken-first-not-tap`: *"child answers OUT
  LOUD; tap only for position/form/build"*). Pick-from-N stays for objectives whose skill IS a
  discrimination between offered alternatives, and the menu is spoken.
- **Item kind is chosen by the objective's verb, in code** (§5), with the Bloom eval mode setting
  difficulty *within* the kind, not the kind itself.

This is the production-modality direction on file (`feedback_production-modality-roadmap`:
judge-driven student production, more capability in the generalized primitive) — and explicitly
**not** the rejected shape of wrapping atom primitives (ten-frame, number-line…) as blocks inside
KC. The insets below are stimulus renderers owned by KC, not embedded primitives.

---

## 3. Recommended new insets (stimulus only, K-first)

Why new ones: the nine existing insets were designed for G3+ text problems. `qa/di/BACKLOG.md`
item 17 already screened them for a K-2 spoken pack and kept 3 of 9 (`number-line`, `chart`,
`data-table` band-gated), ruled **insets are STIMULUS ONLY, never input** (`equation-setup` is the
counter-example — interactive, gateable, out), and named the highest-value inset as one that does
not exist: an *arrangement*. That screen transfers to KC unchanged.

**Prerequisite (item 17 P1): extract ONE shared inset module.** Two copies exist today
(`service/knowledge-check/gemini-knowledge-check.ts` `getInsetSchema`/`buildInsetPrompt` and
`service/annotated-example/inset-helpers.ts` `getInsetGeminiSchema`/`buildInsetPromptGuidance`/
`serializeInsetForPrompt`). Add the new types once, in the shared module; KC, annotated-example
and (later) di-spoken-practice import it. `serializeInsetForPrompt` is what lets the blind Live
tutor SAY the stimulus — every new type below needs a serializer line.

| Inset | Renders | Item kinds it enables (§4) | Objectives / findings it closes | Leak rule (`findInsetAnswerLeaks`) | Band |
|---|---|---|---|---|---|
| **`number-sentence`** | A printed equation as addressable tokens: `["3","−","1","=","2"]`, each token a slot with an id; optional blank token `□`; optional operator-only display (`3 □ 1 = 2`). Large glyphs, no colour on any token by default. | `point_to` ("point to the sign that means take away"), `say_it` ("what does this sign say?" over a single highlighted token), `how_many` (missing result), `yes_no` ("does this sentence show taking away?") | KC-1 / DIMF-1 / DSP-1 class — "identify minus and equals", "+ and = as math symbols"; equation reading at K-1; missing addend at G1 (queued L4 on di-math-facts) | the target token is never pre-highlighted; when the answer is a token, that token's text does not appear in the ask; a `□` never sits where the answer is unless the kind is `how_many` | K–2 |
| **`arrangement`** | A set of emoji objects in one of: `scattered` · `row` · `ten-frame` · `array r×c` · `groups-of` · `before/after` (crossed-out items for take-away). Count and layout are code-built from `{emoji, count, layout, removed?}`; no digits anywhere. | `how_many` ("how many are left?"), `yes_no` ("are there more apples or pears?" → `which_one`), `point_to` ("point to the group with five") | counting-objects rows (items 8, 20: 5/5 same count, ten-frame off-target), subtraction obj1 at assessment time, subitizing, compare groups | no numeral rendered; `count` never appears in the ask or option text; `removed` never equals `count` | K–1 |
| **`glyph-card`** | ONE large printed symbol: a numeral (`7`, `107`), a letter (`m` / `M`), a digraph, an operator, a shape outline (SVG polygon from `{sides, regular}`), or a short decodable word with optional phoneme boxes. Optional second card for compare. | `say_it` (numeral name, letter name, letter SOUND, shape name, read the word), `yes_no` ("is this a triangle?"), `which_one` over two cards ("which has more corners?") | the numeral-naming supply gap (item 20), letter-sound production `off_target` ×5 (S4), shapes "compare by sides and corners" (item 22), CVC decoding obj3 (item 23) | the glyph's name/sound/word never appears in ask or options; for shapes the side count is not printed; for words the word is not spoken by the tutor before the ask (`findUnspokenStimulus` inverted: the STIMULUS must NOT be in the ask for a read/decode kind) | K–2 |
| **`picture-scene`** | 2–4 emoji objects with a labelled spatial relation or a named attribute set (`{objects:[{emoji, position, label?}], frame?}`) — the K version of `object-collection`, which today is G1-only. | `point_to` ("point to the one under the table"), `say_it` ("what shape is the clock?"), `which_one` | positional-word objectives (spatial-scene demand), shapes-in-the-world ("only evaluates circles" — one scene per named shape), category naming | the ask never names the target object's attribute; no text labels on the target | K–1 |
| **`spoken-cue`** (not a renderer — a stimulus kind) | Nothing printed; the tutor SAYS the stimulus (`"/m/ … /a/ … /t/"`, `"the word is *cat*"`, `"listen: five, six, …"`). Flag `stimulusKind: 'spoken'` on the item; `serializeInsetForPrompt` emits the cue verbatim for the Live tutor; the tap surface plays TTS. | `say_it` ("what word did I say?" → blend; "what sound does *mat* start with?"), `how_many` ("what comes next?"), `yes_no` ("do *cat* and *hat* rhyme?") | phonemic-awareness objectives the K palette forces into emoji MC today (S4), counting-on, oral blending — and medial-vowel identify (item 23 SUPPLY gap: *"hear a CVC word, identify its medial vowel"* has no surface today) | the cue never contains the answer token unless the kind is `read_it`/blend (where the cue IS the segmented form) | K–1 |

Band-gate the nine existing insets: `katex` `passage` `code` `data-table` `definition-box`
`chart` → G2+ (they already never plan at K, make it a code gate); `number-line` stays K-2 (it
is picturable and sayable); `image` stays out (no image channel, IMG-1 parked); `equation-setup`
stays annotated-example-only (interactive).

**Not recommended:** a generic `image` or generated-picture inset (base64 hop, tutor blind, and
both existing generators already exclude it); anything the child touches to answer (breaks the
stimulus-only rule and reintroduces the on-screen commit every DI port deleted).

---

## 4. Recommended item kinds (replace the six problem types as the PLANNING vocabulary)

The runtime already forks by answer material (`knowledgeCheckScript.ts`). The redesign makes that
fork the *planning* vocabulary too, so a K plan is never "3 MC + 1 TF" but "say_it ×4 (one per
letter), point_to ×2 (minus, equals), how_many ×2". Each kind maps to a response class that is
already benched — **no new bench sitting is required for kinds 1–7.**

| Kind | Child does | Response class | Stimulus (required) | Objective verbs it serves | Replaces / relation to today |
|---|---|---|---|---|---|
| 1. **`say_it`** | Sees or hears ONE thing, says its name / sound / value | `short_spoken_word` · `letter_name` · `number_word_to_120` · `shape_name` · `continuant_sound` (all benched) | `glyph-card` · `spoken-cue` · one highlighted `number-sentence` token | identify · name · recognize · read · say the sound | NEW. The K workhorse — the identity `di-math-facts[name_numeral]` and `di-letter-sounds` already prove; KC lacks it entirely |
| 2. **`point_to`** | Points at a position or form in a shown stimulus | `manipulation` (benched — the existing `choice_tap` gesture, now with a stimulus and a NAMED target) | `number-sentence` · `arrangement` · `picture-scene` · two `glyph-card`s | identify (a location/form) · find · show me | Generalizes `choice_tap` from "the options can't be said" to "the answer is a position" — the honest tap per the DI ruling |
| 3. **`how_many`** | Says a number word | `number_word_to_20` / `_to_120` | `arrangement` · `number-sentence` with `□` · `spoken-cue` (count on) | count · how many · what comes next · how many are left | NEW (today: MC with number emoji options — `…e1b7` problems[0..1] — recognition of a numeral, not production of a count) |
| 4. **`yes_no`** | Judges a statement ABOUT a shown stimulus | `yes_no` | any inset, or `spoken-cue` | is / does / compare (one attribute) · misconception probes | `true_false`, with a stimulus made mandatory so it stops being a read-aloud definition ("The plus sign means put together — true or false?") |
| 5. **`which_one`** | Hears the menu, says the one (K: 3 picture options; G1+: up to 4) | `closed_set_choice` | optional at G1+; **at K required** unless the options themselves are the pictures being discriminated (rhyme/onset picture sets) | discriminate · which · compare two shown things | `multiple_choice`, demoted from workhorse to one kind among seven; the K palette rules stay (emoji per option, ≤12-word ask) |
| 6. **`read_it`** | Reads a printed word / sentence aloud | `short_spoken_word` · `sentence_read_aloud` (benched) | `glyph-card` (word) | decode · read · blend | NEW for KC (exists on `di-word-reading`, `di-sentence-reading`, `decodable-reader`) — item 23's obj3 finally has an assessment surface |
| 7. **`sort_one`** | Says which group ONE shown item belongs to | `closed_set_choice` over group names | the item as `glyph-card` / emoji + 2–3 named groups | classify · sort · which group | `categorization_activity` microstep (item 23 slice 1) — unchanged, now plannable at K because the item is shown, not read |
| 8. **`which_reason`** | Chooses the better of two spoken reasons | `closed_set_choice` (2) | the situation as `picture-scene` / `arrangement` | explain · why · because | The contract's existing G1 realization of analyze/evaluate; the honest closed form of "explain" (open_set is BLOCKED). Serves addition obj3 "explain how putting together makes a bigger number" — `before/after arrangement` + "which is true: more, or fewer?" |
| 9. **`build_it`** | Orders or assembles | `manipulation` (build) | tokens to place | order · sequence · build the sentence | `sequencing_activity` + `matching` → deferred to di item 23 slice 2b (the judged BUILD gesture). Until then a plan that needs ordering routes to `which_one` over two orderings. |

**Retire from the K-2 plan:** `fill_in_blanks` (word-bank reading — its spoken form `blank` is
fine at G2+), `matching_activity` (two text columns; the microstep form is `which_one` with the
left item shown as a `glyph-card`), `scenario_question`, `short_answer` (open set, BLOCKED).

**Bloom eval modes survive as difficulty within a kind**, not as the kind: `recall` = the shown
element alone; `apply` = the element inside a sentence/scene; `analyze` = two elements compared;
`evaluate` = `which_reason`. The β priors (1.5/3.0/4.5/6.0) keep their meaning, and the
per-problem `objectiveId` stamping (contract R4/R8, `coreGenerators.ts:388`) is untouched.

---

## 5. Verb → kind mapping (code-owned, the orchestrator cannot override it)

Reuse the verb the curator brief already emits (`objectiveVerb`: identify / apply / compare /
explain / count / read …) plus a small lexical pass over the objective text. Table, not prompt:

| Objective verb / text pattern | Default kind | Stimulus | Fallback when the set is not enumerable |
|---|---|---|---|
| identify / name / recognize + **symbol or sign** noun (`+ − = < >`, "sign", "symbol") | `point_to` over `number-sentence` (K) → `say_it` (G1+) | `number-sentence` | `which_one` with the sentence shown |
| identify / name / recognize + numeral, letter, shape, word | `say_it` | `glyph-card` | `yes_no` over the card |
| count / how many / what comes next / how many are left | `how_many` | `arrangement` / `spoken-cue` | `which_one` over `arrangement` |
| compare / more / fewer / bigger / same | `which_one` (2 shown) or `yes_no` | two `glyph-card`s / `arrangement` / `comparison-panel` | — |
| read / decode / blend | `read_it` | `glyph-card` (word) | `say_it` over `spoken-cue` (blend) |
| hear / listen / first sound / rhyme / middle sound | `say_it` over `spoken-cue` | `spoken-cue` | `yes_no` ("do these rhyme?") |
| sort / classify / group / belongs | `sort_one` | `glyph-card` + groups | `which_one` |
| explain / why / because / describe | `which_reason` | `picture-scene` / `arrangement` (before/after) | `yes_no` |
| demonstrate / show / act out / build | route to the objective's own teaching primitive; KC asks `how_many` or `yes_no` about the RESULT | `arrangement` | — |

The 21 under-assessed *identify* objectives and 17 *apply* objectives in the ledger all land in
the first five rows.

---

## 6. Plan sizing (code, not `count`)

```
slots = []
for obj in objectives (lesson order):
  set   = namedSet(obj.text)              # "minus sign and equals sign" → [−, =]; "letters s a t p i n" → 6;
                                           # "shapes: circle, square, triangle" → 3; none → []
  kind  = kindFor(obj.verb, obj.text)     # §5
  n     = max(MIN_SUFFICIENT_ASSESSMENT_ITEMS, |set|)      # ≥2, one per named element
  for each element (or n generic angles when set is empty): slots.push({obj, element, kind, inset})
budget = minutesFor(band) → K ≈ 8 items (4 min affordance today; raise `minutes` honestly if n exceeds it —
         feedback_trust-intent-over-hardcoded-caps: the cap yields to the objective's enumerable set,
         but the whole-lesson pre-reader length gate Q9 still holds)
if slots > budget: drop generic angles first, never named elements; then drop the objective whose
         teaching blocks already carry ≥2 judged items (labor division — the coverage judge tells you)
```

`namedSet` is the helper DSP-1 shipped in `gemini-di-spoken-practice.ts` ("source-token targets,
code-owned coverage") generalised and moved to a shared `service/objectives/` module; the same
helper is what `knowledge-check`, `di-spoken-practice`, and later `fast-fact` read. The
orchestrator's schema then takes `slots[]` as INPUT and returns one `brief` per slot — it may
not add, drop, or retag a slot (validate in code; a plan that changes the slot list is rejected
and retried once, then the code skeleton ships with template briefs).

This closes S1, S2, S3 and S7 (a duplicate stem across two slots is now a code check on
`ask` similarity, not a prompt plea).

---

## 7. What NOT to do (rulings on file)

- **No band floor or grade filter on KC** — `feedback_make-age-friendly-not-band-floor`. The fix
  is a K-capable stimulus and a K-capable kind, never "exclude KC at K".
- **No curator/manifest rule** to fix KC sizing — `feedback_manifest-passes-generator-works`
  (user ruling ×N). The generator reads objective text + verb and does the work; residuals are
  reported in the output.
- **Insets are stimulus only, never input.** No inset takes an answer (item 17 ruling).
- **No timer, no visible score counter on the fluency kinds** — `feedback_no-timer-on-fact-fluency`;
  completion through `PhaseSummaryPanel` (`feedback_honest-completion-summary`).
- **No open-set spoken answers** (`open_set_word` BLOCKED); `explain` → `which_reason`.
- **Don't wrap ten-frame / number-line / equation-builder inside KC** as embedded blocks —
  rejected roadmap shape (`feedback_production-modality-roadmap`). `arrangement` is a KC-owned
  stimulus renderer, not `TenFrame.tsx`.
- **Contract-first.** `docs/contracts/knowledge-check.md` R1–R7 are live consumers' demands; R2
  (K picture-primary MCQ/TF floor) is the one this design *forks* — the fork is "K = kinds 1–8 with
  a stimulus", not "K = MCQ/TF"; re-derive R2 in the same slice you change the floor.
- **No prompt-only fixes counted as done.** Every slice below ends with the coverage judge on a
  fresh package plus a headless `--di` drive; a type check is not verification.

---

## 8. Phasing (each slice ships alone, gated at runtime)

| Slice | What ships | Executor | Runtime gate | Closes |
|---|---|---|---|---|
| **P0 — shared inset module + `namedSet`** | Extract `service/insets/` (schema builder, prompt guidance, `serializeInsetForPrompt`, renderer index) from the two copies; extract `namedSetFromObjective()` from DSP-1 into `service/objectives/`. Zero behaviour change. | direct edit | vitest on both consumers; `/oracle-test knowledge-check` 5 runs byte-identical; tsc 0 new | item 17 P1 debt |
| **P1 — three insets: `number-sentence`, `arrangement`, `glyph-card`** | Types in `types.ts`, renderers in `insets/`, schema fragments + `serializeInsetForPrompt` lines + `findInsetAnswerLeaks` rules (one per type) in the shared module. K-2 band tag. Rendered in `KnowledgeCheckTester` overrides first. | direct edit (contract-first) | tester renders each with a real generation ×3; leak rule catches a seeded leak per type (unit); `/primitive-contract --check` COMPATIBLE | S6 (stimulus channel exists) |
| **P2 — kinds `say_it`, `point_to`, `how_many` in the script + generator** | `knowledgeCheckScript.ts` item kinds + response classes + cues + judging contracts (hand-authored, DISTAR, sentinel discipline); generator functions for the three kinds (schema: ask ≤12 words, stimulus ref, expected answer + ASR aliases in code); `yes_no` and `which_one` gain a required stimulus at K. Fork R2. | `/add-di-loop knowledge-check` (slice 3 of di item 23) | `run_tutor_live.py --component knowledge-check --di --runs 3` clean per kind; tap-surface fallback drives; mic sitting queued (#111 already covers the mixed session) | S4, S5, S8 (commit = affirmation) |
| **P3 — code-owned plan skeleton** | §6 sizing; orchestrator schema takes `slots[]`, returns briefs only; slot-list validation + retry; stem-similarity duplicate check; `count` from the manifest becomes a hint the skeleton may exceed (log the delta). | `/eval-fix knowledge-check` | `/lesson-coverage confirm` on the 5 KC-only objectives' packages (`…xr70`, `…99mt`, `…rw3p`, `…7ngg`, `…mb4f`) — each must move to ≥2 KC items per objective and no `insufficient_items` on the final check; fresh ×3 on subtraction + addition + phonics-2 | S1, S2, S3, S7; KC-1 |
| **P4 — `picture-scene`, `spoken-cue`, `read_it`, `sort_one` at K, `which_reason`** | The remaining kinds and stimuli; `matching` at K becomes `which_one` with a shown left item. | `/add-di-loop knowledge-check` | as P2, plus `/lesson-coverage` on CVC (item 23) — obj3 "read a CVC word" must get ≥2 `read_it` items | item 23 supply gap; addition obj3; shapes obj3 |
| **P5 — journey adapter + calibration** | `lessonJourney/extract.ts` reads the new kinds as production evidence (today `NO_CONTENT_ADAPTER`); β priors per kind in `problem_type_registry.py` (backend ships WITH its surface). One calibration sitting (19(a)) on a redesigned K package. | direct edit + `/lesson-journey` | journey run credits KC items as independent production; calibrate row agrees ≥ current 8/9 | item 17 residual (c) |

**Order is P0 → P1 → P2 → P3.** P1 before P3 on purpose: a set-sized plan with no stimulus
channel just produces eight recognition MCQs instead of four. P2 before P3 for the same reason.
P4/P5 can interleave.

**Pilot-then-sweep:** P1–P3 pilot on ONE topic family (K subtraction: `number-sentence` +
`arrangement`, kinds `point_to` + `how_many`) and drive it end to end before generalising to
phonics (`glyph-card` + `spoken-cue`, `say_it`). Serial, one primitive, one runtime probe.

---

## 9. Gates and honesty rules for the executing session

- tsc: exactly `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit`, 0 new vs baseline
  (775 at this writing on the dirty tree; 802 committed). `npm run typecheck:lumina` 0.
- `/oracle-test knowledge-check` after every generator slice (answer-key desync, option modality).
- `/primitive-contract knowledge-check --check` after every slice; R2 fork written into the
  contract before the K floor changes.
- Coverage: `node scripts/lesson-coverage.mjs eval <pkg> --write` on fresh `topic-trace?package=true`
  draws, ×3 per topic — one draw is a sample. Report a before/after table per objective:
  category · items · constraints · named-set coverage.
- Spoken surface: `run_tutor_live.py --component knowledge-check --di --runs 3` (+ `--di-cap`);
  never edit `backend/` while a drive is up. Mic sittings stay human (#109, #111, #22, #44, #59).
- **Build-over-ceremony check** before the report: if tests + docs dwarf renderer + script +
  generator lines, say so.
- Do not claim S1–S8 closed on a single PASS; the subtraction `…e1b7` PASS this session came
  from a selection change (no `di-math-facts` under obj2) and one lucky draw covering "=".

---

## 10. Decisions the user should make before P2 (not blocking P0/P1)

1. **`minutes` for KC at K.** Set-sized plans on 3-objective lessons will run 6–9 items (~6–8
   min), above the current `minutes: 4` affordance. Raise the tag honestly, or let the sizing rule
   drop generic angles to fit 4 min and report the delta? Recommendation: raise to 6 and let the
   Q9 whole-lesson gate arbitrate.
2. **`point_to` on symbols at K vs `say_it`.** The DI ruling allows a tap for position/form; a
   five-year-old can also *say* "minus". Recommendation: `point_to` at K (the sign's NAME is the
   G1 objective), `say_it` from G1.
3. **Should KC keep the Bloom eval modes as its catalog ladder**, or expose the kinds as eval
   modes (`say_it`, `how_many`, …) so IRT routes on task identity like every other primitive
   (`feedback_structural-difficulty-not-numeric`: eval modes = TASK IDENTITIES)? Recommendation:
   kinds as eval modes, Bloom as `scaffoldingMode`/difficulty within a kind — but this is a
   registry + backend change and deserves its own `/add-eval-modes` slice after P3.

---

## Bookkeeping

- Queue: `qa/lesson-bench/BACKLOG.md` item 25 (this handoff), `qa/di/BACKLOG.md` item 23 gets
  slice 3 = P2 (pointer only), `EVAL_TRACKER.md` KC-1 row points here as the fix path.
- When P3 lands: strike KC-1; re-judge the five KC-only packages; update items 20–24 gates.
- Memory-worthy only after P3 confirms: "KC plan is set-sized in code" as a `project_*` note.
