# digital-skills-sim levers, 2026-10-16

Built with the W1 binding (`../tutor-reports/digital-skills-sim-w1-2026-10-16.md`). Code: `digitalSkillsLevers.ts`.
Every lever starts released; `config.difficulty` changes the items (how many pictures or boxes, how big; capital,
small letter or word), not the levers.

## Failure inventory
No real-learner evidence (no demonstrations, misconception, remediation or eval files for this id). The old catalog
`commonStruggles` documented three failures: clicks that miss the target, a drag let go before the zone, and wrong
keys. The rest are inferred. The misses below are what the code check observes on the learner's own action.

| Mode | Failure (class) | Miss |
|---|---|---|
| click | clicks beside the pictures (documented) | `missed_picture` |
| click | clicks a picture that is not the named one: cannot hold the spoken name, or does not know the word (inferred) | `wrong_picture` |
| drag | lets go before the picture is over a box (documented) | `let_go_outside` |
| drag | drops into another box (inferred) | `wrong_box` |
| type | presses a key next to the right one, a motor slip (documented: wrong keys) | `neighbour_key` |
| type | presses a far key: cannot find the letter on the keyboard (documented) | `wrong_key` |
| type | presses d for b, q for p on a small letter; or does not match a small letter to its capital key (inferred) | `mirror_letter` (b/d/p/q only); otherwise `wrong_key` |

## Lever table

| Mode | Lever | Kind | What changes | Leak rule (code) |
|---|---|---|---|---|
| click | `show_picture` | help | a card beside the question with the picture to click | outside the arena; marks no place in it (mounted test) |
| click | `big_targets` | help | every picture and its click area grow 1.4 times | grows all alike; grown pictures never overlap (`bigLeverSeparate`) |
| click | `fewer_pictures` | simplify, 3+ pictures | a two-picture practice item with another target | never the item's target (`simplerItem`, tested over every built item) |
| drag | `show_picture` | help | a card beside the question with the picture of the box it goes into | outside the arena; marks no box |
| drag | `big_boxes` | help | every box's catch area grows 18 units on each side, drawn as a dashed edge | all alike; grown boxes never overlap |
| drag | `fewer_boxes` | simplify, 3+ boxes | a two-box practice item with another picture and box | never the item's picture or box |
| type | `glow_row` | help | the whole keyboard row holding the next letter glows | a whole row of 7 or more keys, never one key (`glowLeak`) |
| type | `big_keys` | help | the keys grow, with more space | all alike |
| type | `capital_card` | help, small letters | a card with the small letter beside its capital | shows letter forms, not the key's place |
| type | `one_letter` | simplify, words | one capital letter not in the word, then the word back | the letter is not in the word |

Every miss an item can show is answered by a help lever first (tested over every tier and theme). Practice items have
no levers and never shrink twice.

`capital_card` turns a small-letter item into a capital-letter one: it does the case match for the learner, which is
what the medium tier adds. It is a help lever (recorded as assisted), so the credit is not independent. Ruling needed
if the medium tier should have no such lever.

## Measured
- Workspace test: each help lever changes the screen and the scene fact in the same commit, and the next attempt
  records it (`assisted`, `levers`); `big_targets` and `big_boxes` turn a near miss into a hit, as drawn; each simplify
  lever opens `<id>~simpler` and the full item comes back.
- Sweep J9, J12, J13: 0 findings on the four payloads.
- Replay: the stuck and lever replies describe each card or glowing row by what it shows; see the W1 report for the
  one wording fix (a small letter's capital named).

## Failures without a lever
None observed. A learner who does not know the word ("duck") has only `show_picture`, which reduces the item to
picture matching; that is the intended help for a pre-reader.
