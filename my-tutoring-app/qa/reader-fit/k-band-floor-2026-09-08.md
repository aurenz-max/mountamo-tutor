# Reader Fit: the twelve Grade-1-floored modes @ PRE — 2026-09-08

Origin: K Math atlas item `k-band-floor-reaudit` (slice 5). Sixteen live published K
Mathematics requirements land on modes the catalog floors at Grade 1 for reader-fit reasons
that predate the spoken ports. Those floors are contract-gated: moving one needs an audit,
not a catalog edit. This is the audit — **one verdict per mode**, and the floor moves only
where the verdict earns it.

Probes: one K eval-test draw per mode (12 draws, all `pass`) · component and DI-script read ·
`time-sequencer` additionally covered by [its own report](time-sequencer-PRE-2026-09-08.md).
Live tutor drives were not run.

## The question this audit answers

Not "is this mode hard?" — β is the difficulty axis and it is untouched. The floors were
written on a **reading** claim, so the question is narrow: **does the surface a K child now
faces carry printed text they must decode?** Where it does not, a floor below a published K
objective is a cap below what the curriculum asks, and the standing ruling makes that a repair.

## Verdicts

| Primitive / mode | K rows waiting | Audit A (text on the child's path) | Audit C (band contract) | Verdict | Floor |
|---|---|---|---|---|---|
| `sorting-station` / sort_attribute | PTRN001-02-C | none — spoken answer, emoji cards, trays `bucketEmoji`-primary | PASS (4-6 objects, ≤3 bins at K) | **READY** | **→ K** |
| `sorting-station` / sort_variety | PTRN001-02-C, -02-E, MEAS001-02-G | none | PASS | **READY** | **→ K** |
| `sorting-station` / count_compare | MEAS001-02-C | none — counts are spoken number words | PASS | **READY** | **→ K** |
| `sorting-station` / two_attributes | MEAS001-01-G, -02-D, PTRN001-02-D | none — spoken yes/no per object | PASS | **READY** | **→ K** |
| `sorting-station` / tally_record | MEAS001-02-C | none | PASS | **READY** | **→ K** |
| `compare-objects` / order_three | MEAS001-01-E | none — objects are drawings scaled by `visualSize`; the answer is the order they are touched in | PASS | **READY** | **→ K** |
| `length-lab` / order | MEAS001-01-E, MEAS001-05-F | names appear on picker chips, but every object is drawn as an `ObjectBar` above the workspace and the chip carries the same colour, so the child matches a picture | PASS — the Check button is sanctioned on a multi-part construction | **READY** (one nit, below) | **→ K** |
| `time-sequencer` / sequence-5 | PTRN001-03-F, TIME001-01-C | was the printed clock time; **fixed today** — sun-position picture | PASS | **READY** | **→ K** |
| `time-sequencer` / before-after | — (no K row routes here) | same fix | PASS | **READY** | **→ K** |
| `time-sequencer` / duration-compare | MEAS001-07-C, MEAS001-04-G | none once the third option got a picture | PASS | **READY** | **→ K** |
| `time-sequencer` / read-schedule | TIME001-01-C, TIME001-03-G | **printed clock times, and reading them IS the task** | — | **WRONG-BAND** | **HELD** |
| `number-bond` / fact_family | OPS001-02-G, OPS001-03-F | four equations **typed** into boxes | band rule 6 bans typing at PRE | **WRONG-BAND** | **HELD** |

Ten floors down, two held.

## Why the sorting-station five were floored against a surface that no longer exists

The floor text says it plainly: *"BAND FLOOR (unchanged by the spoken port — moving it needs a
reader-fit re-audit, not a catalog edit)"*. The port that prompted that sentence only **removed**
demand from the child's path — every answer became speech; the Check button, the drag-to-bin, the
attribute buttons, the number steppers and the odd-one-out tap are all gone. And the port went
further than "removed": `sortingStationScript.ts` carries an `isPreReader` flag whose own comment
reads *"Kindergarten. Forces the options to be named aloud at EVERY tier"*, and the catalog
constraints already discard any challenge *"whose tray labels cannot be told apart by ear"*.

The pre-reader path was built during the port. Only the floors were left standing.

K draws confirm the surface: `two_attributes` returned six emoji cards with a spoken
"find the needs that are also red"; `count_compare` returned four firefighter/doctor tools with
speakable one-word groups; `tally_record` returned needs-and-wants with `bucketEmoji` trays.
`two_attributes`'s catalog note had already conceded the point — *"what exceeds a pre-reader is
the medium, not the cognition"* — and the medium is what the port changed.

## Why two floors held

**`read-schedule`** already carries `affordances: { reader: 'developing' }` on its own eval mode.
Its task is to find a printed time in a table and read across to the activity. There is no
version of that for a child who cannot read a clock — the mode is correct and the routing was
wrong. TIME001-01-C and TIME001-03-G should route to `sequence-5` (now K) and `analog-clock`.

**`number-bond / fact_family`** asks the child to write all four related equations in boxes.
`answers: ['type']`. The PRE band contract bans typing outright, and unlike the sorting cases
there is no medium swap hiding inside — **symbolic written form IS the declared skill**, which
is what makes it a Grade 1 mode rather than a badly-dressed K one. Holding this floor is the
audit's success case, not its failure: OPS001-02-G and OPS001-03-F want the inverse-operation
*idea*, and `number-bond / missing_part` is spoken, K-allowed, and already teaches it. The
catalog now names that redirect at the point of the floor.

Neither hold contradicts the standing "make it age-friendly, not a band floor" ruling. Both
modes keep a floor because a K-friendly form of the same objective already exists elsewhere in
the catalog — the floor routes around them rather than denying the objective.

## What changed

Catalog prose only — the floors are prose the manifest LLM reads (`gemini-manifest.ts:327`
injects `description` + `constraints` verbatim), so editing the prose IS the floor move. Every
edit cites this file.

- `sorting-station`: the BAND FLOOR sentence in `constraints` and the "Grade 1+ ONLY" clause in
  all five mode descriptions; the `reader: 'none'` comment now records the post-port verdict the
  primitive owed.
- `compare-objects`: `constraints` and the `order_three` description.
- `length-lab`: `constraints` and the `order` description.
- `time-sequencer`: `constraints` rewritten (K now lists five modes and states that nothing on
  screen prints a clock time), plus the four mode descriptions.
- `number-bond`: `fact_family` description records the held floor and the K redirect.

## Residuals

1. **`length-lab / order` picker nit.** The chip is a 4×4px colour swatch plus the object's name.
   The colour does link it to its bar, but a proportional mini-bar would make the chip readable
   on its own. Not a floor blocker — queued.
2. **`sort_variety` yield.** The K draw returned 2 challenges where 5 were asked. Below the
   mastery floor; a distinctness/top-up issue for `/eval-fix sorting-station`, not reader-fit.
3. **One `two_attributes` content defect**: a card labelled "Red Banana" carrying 🍓. At PRE the
   picture IS the object, so a mismatched emoji makes the item unanswerable by eye. `/eval-fix`.
4. **No live drives.** Every sorting-station verdict rests on the script and the draw, not on a
   heard session. The five newly-K modes have never been driven at K with a mic.
5. **Sixteen rows still say `partial`** in the atlas review. They need a re-probe at K against
   the lowered floors before they move to `candidate` — the floor move makes them *routable*,
   which is not the same as *verified*.
