# Picture vocabulary: K curriculum probes, 2026-09-07

Three modes, easy, exact published objective in topic + intent, two draws each.
Production item conversion and cue builders executed. [Task previews](../curriculum-coverage/index.html).

- `gradable_scale`: 10 usable items; target/scale alignment and spoken target concealment
  pass. Source masks the target before feedback. Ordered size/temperature vocabulary
  is supported in these samples; contextual sentence use and live voice are not certified.
- `sentence_frame`: 10 usable items; spoken targets withheld and plausible noun completions.
  Partial fit for LA005-02-H: source hides the noun emoji before solve, so there is no
  simultaneous contextual picture-clue task. This is a capability limitation, not a bug.
- `association`: 10 usable items; semantic pairing is oral production, not visual card
  matching. **PV-3 — HIGH, generator:** draw 2, `pv-2`, has `baseEmoji: "pillows"`, a plain
  string instead of a pictograph; source renders it as the pre-answer picture stimulus.
  Require a valid picture and regenerate invalid items. Do not replace the spoken mode
  with matching; that is a separate mode investment.

The three-mode scoped result is two modes with clean mechanical samples, one with a
confirmed defect. None has a live microphone drive in this audit. Evidence and source
hashes: `qa/curriculum-coverage/evidence/LA005-*picture-vocabulary*`.

## PV-3 fix and retest — 2026-09-09

- **Diagnosed:** association pool validation required non-empty `emoji` and
  `relatedEmoji` strings but never established that either value was a picture. The
  saved `relatedEmoji: "pillows"` therefore survived, was reversed during association
  expansion, and reached the rendered `baseEmoji` stimulus.
- **Implemented:** one shared single-pictograph invariant now rejects prose, multiple
  emoji, and missing picture values while preserving a single ZWJ pictograph. Every
  model-authored picture field uses it before assembly. The shared component/DI item
  builder applies the same gate to targets, pair stimuli, and receptive option cards,
  so old cached payloads cannot bypass generation validation. Rejection never invents
  a replacement; the existing pool floor triggers one corrective regeneration when
  fewer than five usable items survive.
- **Focused regression:** 46/46 Vitest checks passed. They include the exact
  `relatedEmoji: "pillows"` artifact, plain text on the other side, a multi-picture
  string, a valid neighboring pair, a valid joined profession emoji, and the cached
  payload boundary.
- **Live generator matrix:** 7 bounded `/api/lumina/eval-test` runs passed: two
  `association` draws on the original objective and one draw for each of
  `receptive_match`, `naming`, `opposite`, `sentence_frame`, and `gradable_scale`.
  Each response returned five usable challenges, and all 70 generated emoji-field
  occurrences inspected were single pictographs. The original association family
  produced 10/10 valid pre-answer picture stimuli.

  | Run | Returned item anchors |
  |---|---|
  | association 1 | plate/cup, key/lock, nest/bird, pencil/paper, spoon/fork |
  | association 2 | toothpaste/toothbrush, shoe/sock, key/lock, nest/bird, pencil/paper |
  | receptive_match | chair, cup, scissors, bed, clock (four picture options each) |
  | naming | lamp, door, box, cup, clock |
  | opposite | day/night, happy/sad, cold/hot, wet/dry, big/small |
  | sentence_frame | bed, lamp, cup, chair, clock |
  | gradable_scale | size, speed, loudness, brightness, temperature |

  The endpoint does not expose rejected raw-pool entries or retry counters, so these
  runs establish complete usable-session yield; they do not establish that no internal
  rejection or corrective retry occurred.
- **Typecheck:** before and after both report the same one unrelated diagnostic at
  `BarModel.tsx:717`; picture-vocabulary adds zero diagnostics.

PV-3 is resolved at the generator and consumer-contract boundaries. A real browser and
microphone interaction was not driven in this retest; that remains human acceptance,
not evidence needed to establish the saved text-stimulus generator defect is closed.
