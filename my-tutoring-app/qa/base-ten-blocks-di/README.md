# Base-Ten Blocks: Read the Blocks / Trade Ten

The judged loop for `base-ten-blocks` shipped in September with four new files, no
tests, and no drive adapter — so the only way to exercise it was a human at a
browser. This slice closed that: 99 focused tests across four suites, a
registered `DI_PORTS` adapter, a live generation probe, and the port's **first
headless drives**, which found four defects no machine gate could see.

## Student experience

- **Read the Blocks** (`read_blocks`). A mat of blocks is on screen with no
  counts, no total and no number printed anywhere. The tutor asks about one
  size at a time, twice: how many blocks of that size are there, and what are
  they worth altogether. The child answers out loud. The child never says the
  composed numeral — the tutor puts the whole number together in its
  affirmation, which is where it belongs.
- **Trade Ten** (`regroup`). The child predicts the result of a trade aloud
  while the mat is still untraded, then makes the trade by tapping a block.
  Every block above the ones column is tappable, so tapping the wrong size is a
  real wrong answer the tutor corrects — not an inert tap. There is no "Check my
  trade" button: the placement commits on stillness and code computes the
  verdict.
- Both modes are a staged port. `build_number` and the operate modes keep the
  click transport, and a payload mixing them with a judged mode keeps the whole
  deck on clicks.

## What the drives found

Four defects, every one of them spoken aloud to a child by the real tutor, and
every one of them invisible to `tsc`, the pack gates and the probe:

1. **⭐ `regroup` on a mat with an empty receiving place stated its own answer.**
   "You are going to trade one ten-stick for TEN ones cubes. How many ones cubes
   will you have then?" — with no ones on the mat, the answer is ten, and the
   ask says it. The judging contract was self-contradictory as well: `Private
   expected count: 10` beside `the signature wrong answer is "ten" … and it is
   incorrect`. Every multiple of ten with an empty receiving column is now
   dropped by the build gate, and the generator re-selects an outward neighbour.
2. **The verdict lines were invisible to every span-based gate.** The pack wrote
   `say exactly "…"` without the colon the family's shared span parser anchors
   on, so the drive plan read `affirmLine` as undefined and `correctionLine` as
   the ASK — a headless drive would have compared the tutor's correction against
   the question it had just asked.
3. **Subject-verb agreement broke at a count of one.** Heard live: *"My turn:
   there are one thousand-block"*, *"Yes, one thousand-block ARE worth one
   thousand"*, and a correction that restated its own premise — *"one
   thousand-block is worth one thousand, so one of them is worth one thousand"*.
   The one-block mat now takes singular verbs and the short correction.
4. **The sign-off and the hands correction described the wrong work.** A
   `regroup` session ended with "You read the blocks and said what they are
   worth", and a wrong trade drew *"My turn: Now make that trade. Tap one
   ten-stick"* — a "My turn" that demonstrates nothing and hands the job
   straight back. The sign-off is mode-aware now, and the hands correction
   models the trade before re-eliciting it.

## Runtime and evidence

`baseTenModel` owns the arithmetic, `baseTenModes` the task identities,
`baseTenScript` the cue shapes and judging contracts; the mounted stage and the
headless drive spread the same exported cue surface, so neither can drift from
the other. The gesture payload is a PLACE, and the mat it produces is computed
by the same `tradedColumns` the component calls.

- **99 tests across four suites, all passing**: 58 script (build gates, item
  shape, the three signature errors, answer leak in the ask, the opening-only
  how-to-play, the catalog contract, harness answer material), 20 stage (the
  pixel leak, both modes driven through real interaction, the stillness commit,
  undo, the build gates reaching the DOM, submitted metrics), 8 drive plan, and
  13 in the click-era answer-channel suite, whose four broken cases were
  re-based rather than deleted — the routing rules live there now, the
  interaction intents moved to the stage suite, and "never state the target in
  the miss" moved to `add_with_blocks`, where the keypad still lives.
  `typecheck:lumina` 0.
- **Revert-bites**: reverting either of the first two production fixes turns 9
  script tests red.
- **Six real generated sessions** — `read_blocks` and `regroup` at easy, medium
  and hard — 24 challenges, 48 judged items, **zero dropped, zero pack-gate
  issues, zero answer-leak hits**. Fixtures and the generator trace are beside
  this file. Reproduce from `my-tutoring-app` with
  `node scripts/base-ten-blocks-probe.mjs --run`.
- **Three complete headless drives, all PASS with zero findings** — the first
  this port has ever had:
  - `--di --eval-mode read_blocks` (plain): 8/8 refused-then-affirmed. This was
    the drive that surfaced defects 3 and 4; its report was overwritten by the
    later same-day runs, and the signature drive below supersedes it.
  - `--di --eval-mode regroup` (plain): 8/8, including all four hands items —
    the hands hold was silent, the wrong placement drew the correction, the
    right one drew the code-computed affirmation.
    [Report](drive-regroup-plain-2026-09-12.md).
  - `--di --di-wrong signature --eval-mode read_blocks`: **10/10**, and this is
    the strongest evidence in the slice. The two signature errors are mirror
    images — the value said where the count was asked, and the bare count said
    for the value — so the judge has to discriminate in both directions on the
    same mat. It did, on all five, including the two one-block mats where the
    pair is "ten"/"one".
    [Report](drive-read-blocks-signature-2026-09-12.md).

Reproduce a drive from `backend/tests/tutor_live`:

```bash
python run_tutor_live.py --component base-ten-blocks --di --eval-mode read_blocks \
  --topic "place value with base-ten blocks" --grade "Grade 2"
python run_tutor_live.py --component base-ten-blocks --di --di-wrong signature \
  --eval-mode read_blocks --topic "place value with base-ten blocks" --grade "Grade 2"
```

A drive sends TEXT, so a green run retires the SEMANTIC half of the acceptance
criteria and never the acoustic half. It establishes the loop and the judge's
semantics — refusal, affirmation, leak discipline, correction shape. It
establishes nothing about audio transport, ASR, VAD, touch or animation.

## Live acceptance remaining

Tracked as **HUMAN-CHECKS #155**. Real microphone, real fingers, tablet width:

1. **Read the Blocks.** Answer the count with the VALUE ("forty" where "four"
   was asked) and confirm the refusal by ear, then the value with the bare count
   ("four" for "forty"). Both are refused headlessly; what is unknown is whether
   a G2 child's "forty" and "fourteen" survive ASR — the `-ty`/`-teen` ear is
   the known near-pair for the **#63** sitting, and `place_value_word` is
   accepted-build-ahead on that sitting.
2. **A one-block mat.** Find a mat with a single ten-stick and check the pair
   "ten" (the value) against "one" (the count) out loud. This is the hardest
   discrimination in the pack and the place the grammar was broken.
3. **The trade, with a finger.** Tap the asked-for block and watch it split;
   confirm the 900 ms commit fires before a child changes their mind, and that
   the 1500 ms wrong-trade hold is long enough to notice the mat changed. Tap
   the WRONG size and confirm the correction. Use "Put the blocks back" mid-turn
   and confirm the tutor re-coaches without issuing a verdict.
4. **Fourteen blocks on one column.** A traded mat holds 14 ten-sticks or 17
   ones cubes. Check it does not overflow or reflow illegibly at tablet width,
   and that the layout animation reads as "one block became ten".
5. **The prediction, with pauses.** Say "ten… and four more… fourteen" — does it
   arrive as ONE turn under the close, or split into three and draw a verdict on
   a child who was mid-sentence?
