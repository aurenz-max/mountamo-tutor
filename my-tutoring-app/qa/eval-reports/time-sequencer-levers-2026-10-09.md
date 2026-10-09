# time-sequencer levers, all 7 modes (2026-10-09)

`/add-support-tiers` after the C10 W1 binding (7396dbce). Non-interactive batch: the Phase 2 table was built, not
stopped on.

## Failure inventory

Real-learner evidence: none (no demonstrations, misconception or remediation files name time-sequencer). Synthetic:
the journey's scripted wrongs (day reversed, neighbouring period, another card, the shorter activity, another row).
Documented: catalog `commonStruggles` (afternoon/evening boundary; events the child does not live; reading clock
times on a schedule). Every miss is what `timeSequencerMiss` already names.

| Mode | Misses (class) |
|---|---|
| sequence-3 / sequence-5 / clock-sequence | reversed, swapped_pair, wrong_first, out_of_order (synthetic; inferred: cards minutes apart in one morning — every saved payload) |
| time-of-day | next_period (synthetic + documented boundary), far_period (inferred) |
| before-after | other_event (synthetic) |
| duration-compare | shorter_one (synthetic), said_same, missed_same (inferred) |
| read-schedule | next_row, other_row, not_on_schedule (synthetic + documented) |

## Lever table (built)

| Mode | Lever | Kind | Carrier | Leak rule (code) |
|---|---|---|---|---|
| sequence-3/5 | `sky_strip`: sun-position strip on every card (tier aid counts as pulled) | help | shown | no card placed or numbered; needs every `dayFraction` |
| clock-sequence | `face_numbers`: faces drawn larger with all twelve numbers | help | shown | names no hour; no sky strip here (the face is the task) |
| ordering, all three | `far_apart_cards`: same card count, hours apart, from a bank | simplify | shown | no word family shared with the item (`clashes`, `practiceLeaks`); clock cards whole PM hours |
| time-of-day | `day_anchors`: one other activity's picture beside each period | help | shown | never on the item's card; anchors share no family with it |
| time-of-day | `two_choices`: another activity, its period + the opposite one | simplify | shown | never the item's period |
| before-after | `relation_model`: three other cards in day order, "before"/"after" the middle | help | shown | no reference or option card |
| before-after | `two_cards`: another reference, one near and one far option | simplify | shown | no item card |
| duration-compare | `duration_model`: two other pairs with bars (far, same) | help | shown | item cards get no bar; pairs share no family |
| duration-compare | `far_pair`: very short vs very long, never the model's pair | simplify | shown | answer never "same", side fixed per item |
| read-schedule | `option_pictures`: each choice shows its row's picture | help | shown | only its own row's picture; none for off-schedule choices |
| read-schedule | `short_schedule`: three whole-hour rows, other activities | simplify | shown | no item time or activity |

## Built

- `primitives/visual-primitives/math/timeSequencerLevers.ts` (new): declarations, banks, word-family leak rule,
  builders, `practiceItem`/`practiceParent`, `leverFacts`.
- `TimeSequencer.tsx`: lever state keyed by item, practice item in place of the session item (Try again keeps it,
  `endPractice` brings the full item back blank), `pullLever`/`endPractice`, scene fact per pulled lever, the five
  renders, `periodChoices`, "Practice" marker, `aria-label` on schedule choices.
- `timeSequencerWorkspace.ts`: time-of-day choices read `periodChoices`.
- Catalog `levers: true`; `liveJourneySpec.ts` row rebuilds `~smaller` items; contract R4.

## Gates

- `typecheck:lumina`: 0 in time-sequencer files (1 error in `liveJourneySpec.ts:763`, measure-lab's row, sibling mid-edit).
- `timeSequencerLevers.test.ts` 19/19, `TimeSequencer.levers.workspace.test.tsx` 7/7, with workspace + Pip surface 43/43.
- journeySweep + workspaceContract + misses, `-t time-sequencer`: 37/37; 7 payloads, 0 findings (J1-J12), every
  catalog miss answered on every item.
- Tutor replay (7 x 5, gemini-3.8-flash) `replay/time-sequencer-2026-10-09.json` (overwrote the W1 file; moments in
  `replay/time-sequencer-levers-moments-2026-10-09.json`): every check 0 misses, `stuck no_change_before_receipt` 0/35.
  Read by hand: the tutor describes the change with its tool call, names no key.
- The first replay recording failed on read-schedule: `option_pictures` put an emoji into the choice's accessible
  name, so the driver could not press it. Fixed with `aria-label`; the dry journey never pulls a lever, so J1-J12
  could not see it.

## Open

- **read-schedule's always-on row highlight** finds the asked time for the learner, which is the mode's reading
  demand; with `option_pictures` the tutor coaches "match the picture in the highlighted row". The highlight should
  become a help lever (start position from the tier). Contract change: `/eval-fix`.
- Not run: browser check of the five renders, Live (class gate waits on all C10 modes).
