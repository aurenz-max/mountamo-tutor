# Number Bond: extend touch + voice to the remaining evaluation modes

Status: implemented in code on 2026-09-12. Focused automated gates are green; the live touch + microphone acceptance pass remains open. See [README.md](README.md) for the implementation record and current checks.

## Product direction

Extend the successful Split and Say experience around one principle: **the student changes a mathematical model, then uses that model to express a relationship.** Keep the same objects visible through the activity so joining, separating, and exchanging positions carry meaning.

Use one spoken response by default. Use two when the second question transforms the relationship established by the first. In symbolic modes, the equation the student constructs is the assessed response; tutor speech guides the activity and can invite an explanation without requiring another numerical answer.

The existing `decompose` and `ten_and_ones` flows are the reference implementation. Preserve their movable counters, reversible exploration, dynamic spoken targets, delayed equation reveal, and attribution of tutor help. See [the current implementation and verification](README.md).

## Scope and mode contracts

| Eval mode / challenge type | Grade floor | Touch experience | Spoken response | Assessed product |
| --- | --- | --- | --- | --- |
| `missing_part` / `missing-part` | K | Inspect a whole and one known part; optionally use counters to reason about the covered part | One missing quantity | Infer the unknown part, with support recorded |
| `related_fact` / `related-fact` | K | Join the same parts, then separate one part from the whole | Two linked, different quantities | Addition relationship followed by its inverse |
| `build_equation` / `build-equation` | Grade 1 | Join or separate counters, then arrange an equation describing the action | No required numerical response; optional explanation | A valid student-built symbolic relationship |
| `fact_family` / `fact-family` | Grade 1 | Join, swap parts, and separate each part; build the corresponding equations | Selective coaching, no required repeated counting | The complete set of distinct related equation forms |

Keep existing mode IDs, source range gates, and grade floors. Do not grant symbolic-mode credit for a spoken arithmetic answer. Additional gestures are activity phases, not automatically additional mastery items.

## 1. Related Facts: join it, then undo it

**Build this first.** It most directly extends the successful modality and gives the second spoken turn a clear mathematical purpose.

Example: the whole is seven and the parts are three and four.

1. Show the same seven counters divided into two groups, with three identified as the known part. Invite the student to slide the groups together. Retain their group colors or boundaries inside the joined whole.
2. Ask: "Three and how many make seven?" Highlight the other group. The student says "four."
3. After affirmation, show `3 + 4 = 7`. Invite the student to move the four-counter group out of the whole into a separate tray. Group movement preserves token identities and avoids an unnecessary four-tap chore.
4. Ask: "Seven take away four leaves how many?" Highlight the remaining counters. The student says "three."
5. Show `7 - 4 = 3` beside the first equation. Replay the join/separate motion briefly to connect the two facts.

State sequence: `join -> say missing addend -> separate -> say remainder -> relationship reveal`.

The first answer determines the group referenced in the second question. Preserve the existing unequal-parts source gate so both spoken answers differ. Do not put the answer numeral on the highlighted group before its response. Seeing and counting the counters is intended support; the tutor should connect the operations rather than demand an unvalidated explanation.

Touch preparation is ungraded unless the task actually asks the student to choose a mathematically meaningful group. Incomplete motion stays in exploration. If the tutor demonstrates either transformation or supplies an answer, retain that attribution on the affected relation. Keep the existing two relation outcomes; do not create four scored outcomes just because two hand phases were added.

Acceptance example: the seven objects survive both transformations, the tutor asks four then three, and replay or a correction does not reset the second turn to the first problem.

## 2. Missing Part: reason about what is covered

Example: "There are seven altogether. Three are here. How many are covered?"

1. Show a whole card marked seven, one visible group of three, and a covered part. The hidden part has no visible count, answer label, or quantity-shaped silhouette.
2. Ask the missing-part question immediately. The student may answer verbally in one turn.
3. Offer an optional "Use counters" workspace: start with seven movable counters and let the student set aside the known three to inspect the remainder. This is learner-requested support, recorded as such.
4. After the response is judged, reveal the covered counters and join both parts into the whole. Show `3 + 4 = 7` after affirmation. A correction can use counting up or the workspace, keeping the same problem available for repair.

State sequence: `infer [optional counter support] -> say -> uncover and verify`.

Do not make students build the hidden four and then answer an identical question solely to satisfy a two-step template. Touch is an available reasoning tool here; a confident learner can use the single spoken turn.

Support progression: easy explicitly introduces the counter tool; medium makes it available on request; hard starts with the compact bond and covered part. Help remains available at every tier. Track whether the response came before counter support, after counter support, or after an explicit reveal/model. A revealed answer cannot count as independent inference.

The cover must conceal the quantity in accessible student-facing labels as well as the visual layout. Keep the actual answer available to the code-owned judge. An accidental reveal during a drag, animation, replay, or focus change must not occur.

Acceptance example: a student can answer four without manipulating anything, or use the seven-counter workspace and answer four once; the evidence distinguishes those paths.

## 3. Build Equation: give the action a written form

Example: join three and four into seven, then build `3 + 4 = 7` with tiles.

1. Present the bond's counters as two parts. Offer meaningful actions such as "Join" and "Take apart," with spoken guidance.
2. Let the student perform the chosen action. For subtraction, the student chooses which part moves away; preserve the whole and remaining group.
3. Open a tile workspace containing the bond's numbers and operators. Ask: "Build an equation that shows what you did." Use neutral slots without prefilled operators or highlighted correct tiles.
4. Evaluate the student's equation against both the bond and the committed action. Accept equivalent equality orientations, such as `7 = 3 + 4`.
5. After acceptance, connect equation terms to the corresponding groups. An optional tutor prompt can ask the student to point to the whole or explain the action; this is coaching unless a separately validated explanation contract is added.

State sequence: `choose and perform action -> construct equation -> connect symbols to model`.

Keep symbolic construction as the response. Do not generate the complete equation for the learner before assessing it. Support can demonstrate on a different bond or identify which group a symbol describes.

**Contract change to make explicit:** the current checker accepts any valid equation over the bond's numbers. Matching a chosen action adds a constraint. Implement it as a separate deterministic action-match check with specific feedback: "That equation belongs to this bond. Show the joining you just did." Document the tighter contract in the catalog and tests before enabling this flow. Record arithmetic correctness separately from action mismatch for diagnosis; avoid silently treating a true equation as bad arithmetic.

Acceptance example: after joining, `7 - 4 = 3` receives relationship-specific coaching, while `4 + 3 = 7` and `7 = 3 + 4` are accepted. Duplicate-value bonds provide enough tile instances to use both equal parts.

## 4. Fact Family: transform one bond into its related equations

Example: keep the three- and four-counter groups throughout the activity.

1. Join three then four; the student constructs `3 + 4 = 7`.
2. Swap the groups' positions; the student constructs `4 + 3 = 7`.
3. Rejoin, then move the three-counter group away; the student constructs `7 - 3 = 4`.
4. Restore the same whole, then move the four-counter group away; the student constructs `7 - 4 = 3`.
5. Keep accepted equations in a visible family record. Finish by highlighting how the same whole and parts occur in every equation.

State sequence: repeat `transform -> student equation -> record`, then `family complete`.

Reuse equation tiles from Build Equation, with keyboard entry as an equivalent input path. Present one equation workspace at a time to reduce management overhead while retaining the requirement to produce the whole family. Never automatically fill a new equation from the previous one. Previously produced equations can remain visible as the student's record.

Speech guides each transformation. Optional questions such as "Which number stays the whole?" can support discussion, but do not impose four redundant spoken totals or make an open-ended explanation a scored gate.

**Resolve the existing checker/prompt mismatch in this slice:** `factFamilyCanonicalKeys` currently merges commuted addition, while prompts request four equations. Separate mathematical equivalence from required family-form coverage. For unequal parts, require both addition orders and both subtraction directions. Reversing the sides of `=` is equivalent notation, not a new family member. A repeated accepted form cannot fill another slot.

For equal parts, such as three and three, show two distinct equations (`3 + 3 = 6`, `6 - 3 = 3`). The swap can demonstrate that the equation stays the same; do not force duplicate entries or call this four distinct facts. Preserve symmetric source content and update family prompts, completion rules, and oracle expectations together.

Keep one aggregate family outcome with per-equation evidence. Partial success should remain inspectable; completing a tutor-supplied equation does not erase earlier assistance.

Acceptance example: an unequal-parts family needs four distinct forms, an equal-parts family needs two, and an equation written with the whole on the opposite side of `=` does not inflate coverage.

## Shared implementation work

Paths below are relative to `my-tutoring-app/src/components/lumina/`.

| Area | Files / intended change |
| --- | --- |
| Runtime orchestration | `primitives/visual-primitives/math/NumberBond.tsx`: select each mode's phases, retain state across linked turns, reset at source boundaries |
| Physical workspace | `SplitAndSayBoard.tsx` and `numberBondSplit.ts` in the same directory: extract reusable token movement and trays; add group moves, covered presentation, and persistent group identity without changing existing split behavior |
| Contracts and judging | `numberBondScript.ts`: retain source validation; add action-aware symbolic checks and explicit family-form coverage; derive asks from committed runtime state |
| Mode state | Add focused mode adapters beside `numberBondSplit.ts`; share mechanics, keep mode-specific learning rules separate |
| Generation and metadata | `service/math/gemini-number-bond.ts`, `service/manifest/catalog/math.ts`: align prompts, support-tier descriptions, and tutoring directives with each shipped flow |
| Harness and QA | `service/qa/di/diDrivePlan.ts`, `service/qa/oracles/number-bond.ts`, existing Number Bond unit/mounted tests, and `scripts/number-bond-split-probe.mjs` |

Before adding modes, make runtime and headless QA consume the same preparation and transition logic. The historical stateless drive helpers currently describe source items rather than the state-dependent Split and Say runtime. A green legacy drive must not stand in for exercising these new interactions.

Shared state needs stable token IDs, group membership, locations, current action/phase, cover/support state, committed model, submitted equations, and tutor-help attribution. Spoken targets must come from the committed model, not a stale source pair or the previous turn.

Reuse `useJudgedScriptRunner` and the existing speech loop for cue completion, stillness, replay, corrections, and progression. Avoid a second microphone or transcript judge. Lock manipulation during an active spoken verdict, reject stale events after transitions, and clear pending commits when Undo changes a model. Restore the relevant model on correction. Every action must have a tap/keyboard path as well as any drag affordance.

Preserve the existing spoken-number response contract and bounded numeric source gates. Silence, unfinished counting, help questions, conflicting guesses, and answer echoes need the same deliberate handling as the current split flow. Longer verbal explanations remain coaching until they have their own validated judging contract.

## Evidence and scoring

Keep current mode-level identities and logical assessment units. Store physical transitions, symbolic submissions, support use, and raw turns underneath those units. Preserve the existing aggregation for Split and Say and Ten and Ones.

- Missing Part: one inferred quantity, with support/reveal provenance.
- Related Facts: the existing two linked relation outcomes; hand preparation adds no score on its own.
- Build Equation: one equation outcome, including arithmetic, bond-number, and action-match evidence.
- Fact Family: one family outcome, with required forms, accepted forms, corrections, and assistance per form.

Version the extended interaction evidence and keep older submissions readable. Follow the repository's `student-data-loop` skill before changing submission or mastery mappings. If an assessment contract becomes stricter, document that change and review its calibration implications; do not silently alter backend priors as part of a UI migration.

## Delivery sequence

1. **Foundation:** share runtime/harness preparation, introduce only the reusable movement/state pieces needed by Related Facts, and preserve the current split tests. No all-mode rewrite.
2. **Related Facts:** ship the persistent join/separate flow and its two spoken turns. Verify it independently and inside a mixed session.
3. **Missing Part:** add covered inference and optional counter support, including reveal provenance and accessibility checks.
4. **Build Equation:** deliver the reusable symbolic workspace and action-match contract. Verify equivalent notation and repeated-number tiles.
5. **Fact Family:** reuse the symbolic workspace, implement transformation-linked family coverage, and reconcile symmetric-bond behavior across prompts, checker, and oracle.

Each slice should be independently reviewable and selectable through its existing eval mode. Keep changes scoped to that mode so a regression can be rolled back without replacing the successful split flows. Update this QA directory with the shipped behavior, fixtures, and remaining live checks after each slice.

## Verification and completion gates

For each slice, require:

1. Deterministic tests for counter conservation, valid transitions, target derivation, reveal timing, assistance attribution, and logical outcome counts. Enumerate bounded whole/part combinations where practical; include symmetric bonds and supported range boundaries.
2. Mounted interaction tests for tap/drag/keyboard paths, Undo, incomplete gestures, stillness, correction caps, replay, source reset, and mixed-mode transitions. Test the actual state adapter and rendered student surface.
3. Generator/oracle checks across supported grade bands and easy/medium/hard, plus a mixed session crossing the new mode and existing Split and Say. Save representative production-generated fixtures; make generator prompts and source validators agree.
4. Focused regression tests for existing Number Bond DI contracts, split scoring, and shared runner/voice policies. Check changed-file TypeScript diagnostics and document unrelated repository failures separately.
5. A live touch + microphone drive: correct answer, confident wrong answer, help question, silence, replay, and a capped/modelled response. Confirm the tutor refers to what the student actually moved and does not reveal an unspoken target accidentally.

Mode-specific gates are the acceptance examples above. For Fact Family, additionally test that all advertised required forms are required by the checker. For Missing Part, inspect the covered region visually and through accessible labels. For both symbolic modes, confirm that tutor-generated equations cannot receive independent student-production credit.

The four flows are now implemented and covered by focused pure, mounted, headless-drive, script, and oracle tests. They still need their own live acceptance; generated content and automated tests do not establish microphone or classroom quality.

## Implementation record

- `numberBondModes.ts` owns the remaining-mode phase expansion, stable group identity, dynamic Related Facts targets, action recognition, per-form Fact Family judging, and logical outcome aggregation.
- `NumberBond.tsx` and `SplitAndSayBoard.tsx` render the persistent model, opaque Missing Part cover, optional counter workspace, group actions, shared keyboard/tile equation workspace, and delayed verification reveals.
- `numberBondScript.ts` separates arithmetic validity, bond-number validity, action match, mathematical equivalence, and required family-form identity.
- Generator, catalog, headless DI drive, and content oracle contracts now agree on the six challenge types and the unequal/equal Fact Family requirements.
- Student work is versioned as `number-bond-model-v2` and travels through the existing single evaluation submission. No backend attempt, IRT, mastery, rollup, or profile writer was changed.

## Later extension

After these modes are stable, explore predicting how moving one counter changes both parts: "If one moves across, what happens to this part?" Then manipulate and check. Treat this as a separate learning-contract proposal so conservation/prediction work does not silently change what the existing modes assess.
