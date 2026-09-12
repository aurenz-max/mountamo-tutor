# Number Bond: Split and Say

The [remaining-mode implementation plan](IMPLEMENTATION-PLAN.md) is now implemented in code. Live touch and microphone acceptance is still open.

Try Math Primitives Tester > Number Bond > **Split and Say** (`decompose`). **Ten and Ones** also uses the new hand-to-voice flow. Mixed sessions use it whenever either split mode appears.

## Student experience

- A fixed set of counters can move between the whole and its two parts. Tap a counter and its destination, drag it, or tap a part to move the next unplaced counter there. Counter identities persist through movement and animation.
- Move counters between the parts to discover another split. Undo and Bring back together are available during hand turns.
- An incomplete placement is exploration. A full placement settles for 1.2 seconds, then the application computes the hand verdict. A duplicate pair or a teen split without a ten can receive correction.
- After construction, the same counters remain visible and one part is highlighted. The tutor names the other part and asks for a single spoken count. The part numerals and equation are not supplied beforehand.
- Empty parts remain valid decompositions: the tutor calls one part empty and asks about the nonempty part, avoiding a spoken-zero dependency. Ten-and-ones asks for the ones beside a ten, on either side.
- The equation appears after the spoken affirmation. Pairs remain in the visual record; coached or modeled pairs are marked "with help". Counters stay where the student left them for the next split.
- Related Facts now keeps stable red/blue groups through `join â†’ say missing addend â†’ separate â†’ say remainder`. The two hand phases prepare the relationship; the two spoken turns remain the scored outcomes.
- Missing Part presents a visually and accessibly opaque covered region. A learner can answer once from the bond or request a seven-counter-style workspace; evidence distinguishes independent, counter-supported, and revealed paths.
- Build Equation asks the learner to choose a join or separation, perform it, and construct the equation for that exact action. Equivalent equality orientation is accepted. A true fact from the bond that describes a different action receives relationship-specific feedback rather than an arithmetic error.
- Fact Family repeats one persistent-model transform and one equation workspace at a time. Accepted work stays in the family record. Unequal parts require four distinct forms; equal parts require two, and reversing `=` does not create another form.

## Runtime and evidence

The existing source-content gates remain in `numberBondScript`. `numberBondSplit` retains Split and Say behavior, while `numberBondModes` expands the other source items into their model/response phases. Dynamic speech targets and symbolic checks derive from the committed counter model. The mounted component and headless DI drive use the same expansion, cues, transitions, and code-owned verdicts. The same shared DI runner owns audio, stillness, correction caps, replay, and progression; there is no second microphone or transcript judge.

Construction and speech outcomes are combined once per pair using the lower score; a successful spoken answer cannot erase an unsuccessful construction. `decomposePairsFound` is not doubled by the additional turn. Related Facts retains two logical relation outcomes, Build Equation one equation outcome, and Fact Family one aggregate outcome with per-form evidence. Raw turns, physical transitions, equations, support use, and assistance attribution are retained under `number-bond-model-v2`; existing evaluation-mode identities and the existing evaluation submission path remain intact.

Counters are the learning objects and remain visible at every support tier. Difficulty changes available scaffolding, not number magnitude or the assessment identity. The generator, catalog, source validator, component, headless drive, and oracle now agree on all six modes and on the two-form equal-parts family rule.

## Verification

- **87 focused tests passed across six suites**: immutable counter movement, pair novelty, bounded split/teen cases, dynamic spoken targets, action recognition, arithmetic-versus-action diagnosis, equality reversal, unequal/equal family coverage, logical-outcome aggregation, mounted tap/drag/keyboard paths, reveal timing, optional-support attribution, mixed-mode continuity, DI scripts, the stateful headless drive, and content oracles.
- **Six real generated sessions, 18 source challenges, 66 runtime turns**, covering decompose and ten-and-ones at easy/medium/hard. No contract issues. Fixtures and generator trace are beside this document.
- The changed Number Bond files have no TypeScript diagnostics. `typecheck:lumina` remains blocked by two pre-existing `JudgedCueOptions` errors in `baseTenScript.ts` (lines 267 and 295).
- Reproduce content checks from `my-tutoring-app` with `node scripts/number-bond-split-probe.mjs --run`.

The Number Bond headless drive now expands the same stateful runtime phases used by the mounted component. Its semantic checks still do not establish audio transport, ASR, VAD, animation, touch ergonomics, or classroom quality.

## Live acceptance remaining

Browser animation, touch behavior, and live microphone judging still need a drive:

1. Split five into two and three, answer the highlighted part, then move a counter directly between parts to make the next pair. Verify incomplete motion, Undo, Bring back together, a duplicate pair, and an empty part.
2. For fourteen, try six/eight, repair it to ten/four, then answer "four". Try the ten on either side.
3. In Related Facts, join three and four, answer "four", move the same blue group away, then answer "three". Replay and a correction must preserve the committed model.
4. In Missing Part, inspect the cover visually and with a screen reader. Answer both independently and after requesting counters; verify the cover never leaks through focus or animation and the affirmed counters join into the whole.
5. In Build Equation, join then submit `7 - 4 = 3` and confirm action-specific coaching; accept `4 + 3 = 7` and `7 = 3 + 4`. Repeat with a separation and an equal-part bond.
6. In Fact Family, complete four unequal-part transforms and two equal-part transforms. Confirm prior equations remain visible, reversed equality does not inflate coverage, and tutor-supplied work is marked assisted.
7. Across modes, check confident wrong answers, help questions, silence, replay, capped/modelled responses, source resets, mixed sessions, and assembled-lesson audio.
