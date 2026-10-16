# timeline-explorer levers, 2026-10-16

Built with the W1 binding (`../tutor-reports/timeline-explorer-w1-2026-10-16.md`). Code: `timelineExplorerLevers.ts`.
Every lever starts released; `config.difficulty` changes the items, not the levers.

## Failure inventory
There is no real-learner evidence (no demonstrations, misconception or remediation files for this id). The old
catalog `commonStruggles` documented four failures: skipping the middle events, struggling with chronological
ordering, confusing similar events, and not reading the Impact lines. The rest are inferred from the tasks. The misses
below are what the code check observes.

| Kind (modes) | Failure (class) | Miss |
|---|---|---|
| identify (explore, order) | confuses two events close in time (documented) | `adjacent_event` |
| identify | does not remember the event at all (documented: skipped events) | `distant_event` |
| date (connect) | gives a neighbouring event's date (inferred) | `adjacent_date` |
| date | guesses a date far from the right time (inferred) | `distant_date` |
| order (order) | runs time the wrong way (inferred) | `reversed` |
| order | swaps two events close in time (documented: ordering) | `adjacent_swap`, `two_swapped` |
| order | misplaces one event (documented: ordering) | `one_moved`, `mixed_order` |
| cause_effect (connect) | matches an effect that happened before its cause (inferred) | `effect_before_cause`, `used_extra` |
| cause_effect | swaps two links, or does not know what caused what (documented: impact lines) | `pairs_swapped`, `mixed_links` |

## Lever table

| Kind | Lever | Kind | What changes | Leak rule (code) |
|---|---|---|---|---|
| identify | `show_timeline` | help | the timeline strip comes back: every title in time order with its date | the clue names no word only its title has, and not its year (`clueLeaks`); nothing marks the clue's event |
| identify | `two_choices` | simplify | another event's clue with two choices far apart in time | never the item's own event; avoids other items' keys |
| date | `before_after` | help | a card naming the events just before and just after it, by title, no dates | no date; never "nothing comes before/after" (that picks the earliest or latest choice) |
| date | `date_line` | help | the date choices laid out in time order | does not say which is this event's |
| date | `two_dates` | simplify | another event with two dates far apart | never the item's own event |
| order | `read_cards` | help | under each card, its description with every date taken out (`redactDates`) | no year, month-day, century or era left |
| order | `led_to` | help | "led to" arrows between cards | arrows share no card and always leave more than one order (`ledToArrows`, `linksLeaveDoubt`) |
| order | `fewer_cards` | simplify | three cards spread out in time | shares at most one card with the item |
| cause_effect | `read_cards` | help | each card's dateless description | a line naming its partner's title words is left out (`cardLine`) |
| cause_effect | `show_dates` | help | each card's date | offered only when the dates leave more than one matching (`datesLeaveDoubt`) |
| cause_effect | `two_links` | simplify | two other links to match | no event shared with the item |

Every miss an item can show is answered by a help lever first (tested over every tier and seed on the fixture).
Practice items have no levers and never shrink twice.

## Measured
- Workspace test: each help lever changes the screen and the scene fact in the same commit, and the next attempt
  records it (`assisted`, `levers`); `two_choices` and `fewer_cards` open `<id>~simpler` and the full item comes back.
- Sweep: 0 findings on the three payloads, the lever rules included (J15 drove a spoken practice credit). Lever inventory: explore `show_timeline`,
  `two_choices`; order `read_cards`, `led_to`, `fewer_cards` (+ identify's); connect `read_cards`, `before_after`,
  `date_line`, `two_dates`.
- Replay: r1 found the before_after card's "nothing comes before it" let the tutor say "the very first event" (fixed in
  the lever, not only in wording); r3 and r4 found the tutor pointing at the swapped cards after an order miss (fixed
  in guidance). r5 and r6 clean.

## Failures without a lever
- cause_effect `show_dates` and `two_links` were not offered on the connect payload: the dates decide every pair there,
  and every link is on the item. `read_cards` is the only lever there; it answers every cause_effect miss.
- The model's `ledTo` links are a chain to the next event, so a cause_effect item mostly tests order, not cause. No
  lever can fix that; it is a generation finding (W1 report).
