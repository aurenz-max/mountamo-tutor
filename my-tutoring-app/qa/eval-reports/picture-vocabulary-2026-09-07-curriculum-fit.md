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
