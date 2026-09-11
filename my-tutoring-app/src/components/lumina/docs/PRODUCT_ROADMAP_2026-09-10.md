# Lumina product roadmap — from practice to inquiry

**Decision proposal · September 10, 2026.** Review window: September 8–9, America/New_York, plus the current working tree. Primary evidence is the repository, its curriculum atlases, and primitive QA reports. This is a product plan; it does not change execution queues or certify production deployment.

**Recommendation:** keep the recent math and literacy work moving toward learner acceptance, and put the next expansion lane into **investigation and evidence**. Follow with **purposeful conversation**. These extend the most interesting recent breakthrough: Lumina can increasingly evaluate something a child makes or reasons through, including an original utterance, a sequence of moves, and a constructed representation.

The next milestone should be a small set of complete learning experiences: **run a fair test, explain what the evidence supports, and ask a question that helps solve a problem.** More subject coverage should follow those capabilities.

## What the last two days actually changed

The catalog at the last commit before September 8 contained **206 entries and 602 explicit eval-mode entries**. Across **37 commits**, it reached **209 entries and 638 modes**: three new primitives and a net 36 additional modes. The working tree contains **210 entries and 652 modes**, adding `spatial-path` and another 14 modes. These are catalog counts, including reference/display components; they are not counts of learner-verified or deployed experiences.

| Development | Student capability gained | Evidence / status |
|---|---|---|
| `story-ribbon` | Tell a connected account, control its tense, connect a story to experience | Committed `202389e1`; five modes; lifecycle work through L5 reported; human acceptance remains open |
| `oral-sentence-studio` | Produce an original scene-description sentence using target vocabulary | Committed `dfddb3a7`; L0 `describe_scene`; semantic and microphone acceptance still owed |
| `story-bridge` | Compare characters/settings, place Venn entries, say how stories are alike/different, compare main ideas | Committed `977ad5f4`; seven explicit modes added to an existing birth |
| `bar-model` | Record one-to-one data, read comparisons, explain a graph aloud, compare two surveys | Committed `21323587` / `908b65e0`; six additional mode IDs across the window |
| `measure-lab` | Predict balance/capacity, count pours, order capacities | Committed `bd3ee344`; new physical-measurement interaction with four modes |
| Counting and place value | Give a requested quantity, conserve number after rearrangement, add/remove objects, build teens, connect related facts | `counting-board`, `ten-frame`, `number-bond`; committed extensions |
| Time, length, and access | Identify clock parts, order clock-bearing events, estimate then measure, compare units; honor the objective's number range | Committed extensions and generator repairs |
| New work in progress | Spatial route choice and scene description, final sounds, rhyme collections, extended decoding, calendar sequences, real-object shape finding, sequence errors | Present in uncommitted code; do not schedule these again as untouched gaps |

The older-learner DI packs landed just **before** this window on September 7: `di-worked-procedure` judges subtraction moves; `di-deduction` judges a verdict plus its reason. They matter to the next roadmap, but are not September 8–9 births.

The product pattern is valuable: **a new task identity often unlocks more learning than a new component**. Teen-number work, graph explanations, and cross-story comparison are examples. Generator fixes also recovered capabilities that the catalog already promised but did not consistently deliver.

Source: [catalog census and commit comparison](../../../../qa/roadmap-census-2026-09-10.json), [evaluation tracker](../../../../qa/EVAL_TRACKER.md), and the birth/eval reports linked below.

## Portfolio: breadth is ahead of assessed depth outside math and literacy

Counts below come from evaluating the current catalog modules, including uncommitted changes. “With modes” means an explicit catalog ladder exists; it does not certify generation, evaluation correctness, or empirical calibration.

| Catalog domain | Entries | With modes | Mode entries | Product interpretation |
|---|---:|---:|---:|---|
| Math | 63 | 63 | 313 | Deepest task inventory; prioritize transfer and explanation over another broad feature sweep |
| Literacy | 38 | 36 | 142 | Strong breadth; independent language production and interaction are the new frontier |
| DI family | 9 | 9 | 34 | Shared spoken practice and reasoning; DI also operates inside other domains |
| Engineering | 24 | 8 | 25 | Large reuse opportunity: more constructions need distinct, assessable task identities |
| Biology | 17 | 2 | 9 | Biggest proportional gap between the inventory and explicit mode coverage |
| Chemistry | 14 | 14 | 43 | Already registered with mode ladders; deepen investigation instead of planning to wire a missing domain |
| Astronomy | 11 | 4 | 17 | Consider mode extensions against actual grade/objective demand |
| Physics | 5 | 4 | 18 | Small dedicated inventory, complemented by engineering and astronomy |
| History | 2 | 2 | 7 | `era-explorer` and `cause-effect-chain` exist; source analysis and geography remain expansion candidates |
| Calendar | 2 | 2 | 11 | Several extensions are in progress now |
| Core / assessment / media | 25 | 10 | 33 | Mix of assessment and deliberately presentational experiences |
| Economics | 0 dedicated catalog entries | — | — | PRD exists; related math/sorting capabilities must be checked before commissioning new primitives |

The general `science.ts` catalog is intentionally empty following the chemistry split. That is not a broken chemistry pipeline. Missing explicit modes also do not mean that a component has no local scoring. The relevant backlog is [BIO-2 in EVAL_TRACKER](../../../../qa/EVAL_TRACKER.md), whose historical counts have drifted.

The curriculum atlases give a more useful view of K demand:

| Frozen review | Requirements | Direct candidates | Partial fits | Development |
|---|---:|---:|---:|---:|
| K Mathematics | 166 | 140 | 21 | 5 |
| K Language Arts | 191 | 47 | 109 | 35 |

These are **reviewed capability matches**, not learning outcomes. New builds do not automatically promote rows. The latest math summary is 140/21/5 even though its README still says 137/24/5. The LA snapshot predates some new capability work. Re-review changed requirements before claiming a new coverage percentage. No equivalent reviewed matrix was established here for all science/history grades; those opportunities are product hypotheses, not measured curriculum coverage totals.

Sources: [K Math summary](../../../../qa/curriculum-coverage/math-k/summary.json), [K LA summary](../../../../qa/curriculum-coverage/summary.json), [LA design studio](../../../../qa/curriculum-coverage/design-studio.html).

## Separate the learning task from the answer modality

Use four dimensions when planning a feature: **curriculum objective × primitive/eval mode × response modality × support/structure**. An eval mode names what the student must demonstrate. Speaking, dragging, and drawing describe how they demonstrate it. Support withdrawal and harder problem shapes are separate decisions.

| Learning demand | Current examples | Next useful progression |
|---|---|---|
| Recognize / name / read | DI sounds/words/shapes; phoneme and decoding modes | Mixed retrieval and independent production on unfamiliar items |
| Manipulate / build / represent | Counters, teen frames, graph construction, letter strokes, spatial routes | Build from a goal, then explain or transfer to another representation |
| Describe / explain | `say_what_it_shows`, `explain_concept`, `oral-sentence-studio` | Refer to specific evidence; distinguish relevant explanation from fluent filler |
| Narrate / compare | `story-ribbon`, `story-bridge` | Organize an original account, compare perspectives, revise for a listener |
| Execute / infer | `di-worked-procedure`, `di-deduction` | Diagnose a wrong move; distinguish a supported conclusion from insufficient evidence |
| Investigate / design | `ramp-lab` comparisons, thresholds and constrained designs; existing engineering builders | Student chooses the test, records evidence, revises the model or design |
| Ask / negotiate meaning | Help Desk is an authored design, not a registered primitive | Ask for missing information, understand the reply, and use it |

**DI is already broader than recitation.** Its production contract can judge an utterance, or carry feedback/progression for a gesture whose correctness is computed by code. Keep hands on the object when placement, construction, or measurement is the skill. Speech should add evidence of reasoning where that is the objective.

The shared response-class registry currently distinguishes **9 benched classes and 11 accepted-build-ahead classes**. `concept_statement` is benched; sentence/narrative classes, `procedure_step`, and `deduction` still carry acceptance debt. This is why conversational or evidence-based judging should enter as a bounded task with explicit acceptance cases. A new prompt alone does not establish a reliable new modality.

Do not force all modes into one universal Bloom ladder. `tell_present_account` and `tell_past_account` are distinct demands; their relative difficulty needs evidence. Catalog beta values are priors, not proof of calibrated learner difficulty.

Sources: [judged response contracts](../hooks/judgedScriptContract.ts), [lifecycle ladder](PRIMITIVE_LIFECYCLE.md), [DI queue](../../../../qa/di/BACKLOG.md).

## The expansion bets

### 1. Investigation and engineering reasoning — first expansion lane

**Experience:** “Which surface needs less push? Set up a fair test, run it, and show me what makes you think so.” Start at Grades 3–5, with a simpler K–2 version only where the curriculum and reading demands fit.

**Reuse:** `ramp-lab` already has `compare_conditions`, `find_threshold`, and `design_with_budget`, including matched setups and concealed force evidence. Its [August 21 report](../../../../qa/eval-reports/ramp-lab-2026-08-21.md) verifies those behaviors. Do not rebuild fair-test comparison as a new lab.

**New core demand:** choose which trial would isolate a variable. Proposed mode `plan_fair_test` presents a question and candidate or editable setups; the learner must hold irrelevant conditions constant. The choice is scored from code-owned conditions. Then, in a separate extension, `explain_from_trials` asks the learner to cite an observed comparison. A trial record supplies the judge's facts.

**Why this is first:** it combines existing math representation, physical simulation, and spoken reasoning in one coherent experience. The NGSS practices explicitly progress toward controlled investigations and evidence-based explanations; this direction aligns with that emphasis. [NGSS practices](https://www.nextgenscience.org/sites/ngss/files/Appendix%20F%20%20Science%20and%20Engineering%20Practices%20in%20the%20NGSS%20-%20FINAL%20060513.pdf).

**Next:** scope the missing demand with `/lumina-portfolio scope`, check its actual curriculum home with `/curriculum-fit`, then `/add-eval-modes ramp-lab`. Add contextual tutoring with `/add-tutoring-scaffold`; use the existing DI port workflow only after the new response contract has evidence. Preserve direct manipulation.

**Pass gate:** changing two causal variables fails the fair-test task even if the eventual prediction is correct. A plausible explanation contradicting the recorded trials is refused. A valid paraphrase with relevant evidence is accepted. Prediction, trial behavior, and explanation remain distinguishable evidence.

**Follow-on:** use BIO-2 to add mode ladders to a curriculum-selected engineering/biology primitive. `bridge-builder` is a construction candidate; `food-web-builder` is a systems candidate. Before expanding biology, pull the existing [science-depth queue](../../../../qa/science-depth/BACKLOG.md) top, LCS-1, through `/oracle-test`; its old unmeasured suspicion is not a confirmed current failure.

### 2. Source analysis and evidence — first new subject primitive

**Experience:** “These two accounts disagree. What can you actually conclude, and which detail supports it?” Grades 3–5 first.

**Build:** `source-detective`, already specified in the [history PRD](PRD_HISTORY_SOCIAL_STUDIES_SUITE.md) and named as the next history birth in the portfolio. Its distinct value is author/date/purpose, source context, and corroboration. `evidence-finder` already supports locating and evaluating textual evidence; reuse that interaction instead of duplicating it.

**Bounded birth:** proposed `source_purpose` — examine one attributed source, identify its likely purpose, and point to a supporting detail. Follow with `corroborate` and `supported_conclusion` only after that first identity is stable. “Cannot tell from this source” must be a legitimate result when warranted.

Use authentic, attributed excerpts or explicitly labeled fictional practice documents. Generated historical illustrations are reconstructions, not primary-source evidence. The Library of Congress provides a compatible observe/reflect/question progression and curated source material. [Primary-source guidance](https://www.loc.gov/programs/teachers/getting-started-with-primary-sources).

**Next:** `/curriculum-fit` and, if no published home exists, `/curriculum-author`; then `/primitive source-detective` from the existing PRD, one mode at birth. The deduction pack already exposed a published-curriculum gap for rule-based reasoning, so do not presume retrieval will solve this automatically.

**Pass gate:** learners must connect a conclusion to an actual source detail. Correct-sounding outside knowledge cannot substitute for the requested source evidence. Source metadata must not print the inference being assessed.

### 3. Purposeful conversation — strongest new modality

**Experience:** “Deliver this parcel. You know the street, but not the house number. Ask the person who knows, then use the answer.” K–2 first.

**Build:** the existing **Help Desk** design from the LA studio, whose first task is already “ask one clarification question, hear the answer, and use it.” This adds conversational initiative beyond `oral-sentence-studio` description or `story-ribbon` narration.

**Bounded birth:** proposed `ask_to_resolve` — one missing fact, a genuinely necessary question, one reply, and an action that demonstrates understanding. Later modes can repair an ambiguous request or ask a useful follow-up. No open-ended chatbot birth.

**Next:** the LA atlas owns `oral-interaction`; use `/lumina-portfolio scope help-desk`, then `/primitive help-desk` after a bounded question-response judge is validated through the shared contract workflow. Do not route free-form questions into the single-word spoken judge skill.

**Pass gate:** “Where does it go?” and another natural useful question work; repeating the instruction or asking an irrelevant question does not complete the task. The destination changes only after the learner uses the missing information. Score communication against the task, with ordinary child phrasing accepted.

### 4. Trade-offs and geographic decisions — horizon after the pilots

Economics is a meaningful subject gap, but a 20-primitive buildout would outrun evidence. The best first candidate is the existing PRD's `resource-allocator`: divide ten tokens among three goals, observe what remains unmet, and explain the trade-off. Grade 2–3 first. Budget arithmetic can be checked exactly; reasonable preferences must not be graded against a single approved opinion.

Geography's `map-lab` is also in the history PRD. It offers a path from the newly built `spatial-path` to landmarks, map symbols, and route constraints, but a geographical map is a different learning demand from choosing “under” or “around.” Start with a curriculum audit, then scope one task.

**Next:** `/curriculum-lumina-audit` for the selected subject/grade, followed by `/lumina-portfolio scope resource-allocator` or `map-lab`. Reuse `coin-counter`, sorting, graphing, and route interactions where their contracts genuinely fit. Music/art, broader earth science, and other subjects remain discovery candidates; this review did not establish their curriculum demand well enough to rank them ahead of these bets.

## Sequence and capacity

Use **two active streams plus one small opportunistic lane**, consistent with the portfolio policy. The horizons below are sequences of bounded slices, not calendar commitments or parallel projects. Proposed allocation for the next cycle: **40% core capability completion, 40% one frontier pilot, 20% verification and acceptance support**. Revisit once the first investigation pilot passes.

| Horizon | Core stream | Expansion stream | Exit condition |
|---|---|---|---|
| Now: close the current slice | Verify the uncommitted extensions; pull `k-grammar-completion`; finish newborn acceptance preparation | Scope `ramp-lab / plan_fair_test` and verify curriculum demand | Concrete grammar contract; no duplicate work on already-built features; bounded investigation scope |
| Next: first pilot | Finish grammar; address SPK-2 where its named strategy objective demands it; raise `oral-sentence-studio` tutoring after its core is accepted | Implement and evaluate the ramp investigation task, then evidence explanation | Learner can plan a valid test and justify from actual results; wrong-but-fluent responses exercised |
| Following: first new subject | Continue targeted K gaps and accepted newborn lifecycle work | Birth `source-detective`; complete its core before a wider ladder | Attributed source, usable G3–5 curriculum home, and one verified source-reasoning task |
| Then: conversation | Core work now follows observed acceptance and curriculum gaps | Birth Help Desk from `oral-interaction` | Useful question → reply understood → successful action, including error recovery |
| Horizon | Maintain proven math/literacy experiences | Choose economics, geography, or a second science system from pilot evidence | One curriculum-backed scope, rather than an entire domain commitment |

The opportunistic lane should consume existing queues: science LCS-1 measurement, response-class acceptance support, or an already-scoped repair. It should not become a third large build stream.

For older math learners, `di-error-hunt` is a particularly good follow-on: identify and repair a mistaken move instead of performing another full subtraction. It already appears in DI item 38's residuals and depends on the deduction acceptance work. Preserve the DI queue's explicit `gas-laws-simulator` → `ph-explorer` port order unless deliberately reprioritized; this roadmap does not silently reorder it.

## Measure capability, reliability, and learning separately

For each pilot, retain the existing lifecycle and primitive QA gates. Add these product acceptance questions:

| Signal | What to inspect |
|---|---|
| Honest evidence | Can the learner make a meaningful wrong response? Are answer cues hidden until the appropriate reveal? |
| Judge reliability | Known wrong reasoning, plausible paraphrases, echoes, incomplete answers, and pauses; report false accepts and false rejects separately |
| Content delivery | Requested versus usable item count, fresh-draw variety, and objective fidelity; a perfect surviving item does not excuse frequent empty sessions |
| Independence | First attempt and assistance state; a correct response immediately after a model is different evidence from an independent one |
| Transfer | A fresh problem or representation with the same underlying demand; separately report supported practice and unprompted transfer |
| Learner usability | Real microphone, tablet/stylus, listener comprehension, and recovery; automated checks do not close human-only rows |

Do not count adding beta priors as empirical calibration. Copy/write scoring in Letter Workshop and the new free-form spoken classes retain their existing acceptance conditions before adaptive mastery credit. Any later change to attempt/mastery semantics should start with `/student-data-loop`; this plan makes no such change.

## Execution health and immediate pulls

| Currently active work in WORKSTREAMS | Health / implication |
|---|---|
| Judged-loop ports | Engine and packs have substantial evidence; speech acceptance and generation-yield residuals remain. Keep class acceptance distinct from catalog readiness. |
| Coverage campaign | September 2 index still names the phase-enum trio. Reconcile its current queue before a new broad campaign. |
| K LA atlas | Recent builds and critical repairs progressed; `k-grammar-completion` is the current next-ranked capability item. |
| K Math atlas | Broad improvement; spatial/calendar/decoding-adjacent working changes and stale summaries make closeout verification more useful than another duplicate gap sweep. |
| History | Two working primitives; `source-detective` is the named next birth. Curriculum demand still needs checking for its exact task. |

There are more active labels than the stated WIP limit. The proposed core/expansion grouping consolidates the work rather than opening three new active lanes. **Lesson Bench remains paused.** Nothing here resumes its self-evaluation or synthetic lesson journeys.

**Next three concrete moves:**

1. **`k-grammar-completion` — `/add-eval-modes`.** Owning queue: [K LA work items](../../../../qa/curriculum-coverage/work-items.json). Scope contextual spoken completion first; sentence creation stays distinct. Use the repaired `di-spoken-practice / say_answer` as evidence when deciding whether an explicit extension is enough.
2. **LCS-1 — `/oracle-test`, then `/eval-fix` only for confirmed failures.** Owning queue: [science depth](../../../../qa/science-depth/BACKLOG.md). This is a bounded way to resume science work while the investigation pilot is scoped.
3. **First frontier scope — `/lumina-portfolio scope` for `ramp-lab / plan_fair_test`, followed by `/curriculum-fit`.** This roadmap owns the proposed product scope; actual findings belong in existing QA registers. Next new primitive after the pilot is `source-detective` from the history lane.

**Dependencies:** source/grade curriculum gaps unblock through a verified home or deliberate curriculum authoring; new spoken classes unblock through their recorded acceptance process; human checks unblock through user sittings, particularly #140–146 and the newborn reports. An old unknown failure is measured before it becomes a repair task.

**Planning corrections made:** none to shared queues or trackers. Stale claims are identified here, including the September 4 portfolio header/production pointer, already-committed work marked uncommitted, the older math-atlas counts, the Story Bridge build-status row still asking for its already-added ladder, and historical BIO-2 totals. The repository commit state is verified; live deployment is not.

## Evidence and limits

**Implementation follow-through, September 10:** the user selected Ramp Lab as the
first frontier build. `plan_fair_test` and `explain_from_trials` are now implemented;
see the [build and verification report](../../../../qa/eval-reports/ramp-lab-2026-09-10.md).
This advances the proposal above to an interactive pilot. Real microphone/tablet
acceptance remains in HUMAN-CHECKS #148, and the scoped curriculum probe does not
establish Grade 4/5 attribution. The other roadmap proposals remain proposals.

The [census](../../../../qa/roadmap-census-2026-09-10.json) evaluates catalog TypeScript, checks unique IDs, records domain/mode counts, and compares the pre-September-8 catalog with HEAD and the working tree. Its registry text matches are discovery checks, not a full wiring/runtime audit. Counts include L0 entries without ladders and intentionally presentational components. This was a planning review, not a new whole-portfolio QA run or learner study.

Additional implementation evidence: [Oral Sentence Studio birth](../../../../qa/eval-reports/oral-sentence-studio-birth.md), [Story Ribbon birth](../../../../qa/eval-reports/story-ribbon-birth.md), [Spatial Path birth](../../../../qa/eval-reports/spatial-path-birth.md), [human acceptance register](../../../../qa/HUMAN-CHECKS.md), [current portfolio](../../../../../WORKSTREAMS.md), [economics PRD](PRD_ECONOMICS_SUITE.md), and [physics PRD](PRD_FUNDAMENTAL_PHYSICS.md). PRDs supply design candidates; their old inventory claims and standards mappings are not automatically treated as current facts.
