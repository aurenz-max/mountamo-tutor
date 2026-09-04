# matter-explorer — `change` (rung 2, the K-2 irreversible-change gap) — 2026-09-03

**Queue item 28. SHIPPED.** A fourth spoken mode: the tutor says what happened to an everyday
object and the child says whether it **can go back the way it was** or is **changed for ever**.

Both live DI drives **PASS, no findings** — [signature](../tutor-reports/matter-explorer-live-di-signature-2026-09-03.md)
5/5 refused + 5/5 affirmed, [plain](../tutor-reports/matter-explorer-live-di-plain-2026-09-03.md)
4/4 + 4/4. `typecheck:lumina` 0 · vitest **4466** (suite 46 → 48) · backend pytest 2/2 new.

## Why here, and not on `states-of-matter`

`states-of-matter.predict` covers the reversible half only, and teaches it from **thresholds**
("it melts at zero degrees") — a Grade 3-5 ask. Nothing in the catalog asked the other half at
all. `reaction-lab.observe` is the nearest neighbour and still wrong: K-8, tap/notebook, off the
judged loop, and it frames the contrast as *chemical vs physical*, the G3-5 vocabulary.
`matter-explorer` already owns the K-2 everyday-object vocabulary and the judged loop, so the
mode is one script item plus one catalog entry.

**Curriculum home (standing gate 4):** Grade 1 **`SCI001-02-H` — "Classify materials as
reversible or irreversible changes when exposed to heat"** (`backend/data/first-grade/science-first-grade-syllabus.csv`),
under SCI001-02 *Matter and Its Properties*. Six of the eight changes are heat changes; `tear`
and `rust` are broader than the subskill, not narrower. K's adjacent home is MATTER001-02
*Investigate simple physical changes*.

## The one design decision worth re-reading

Reversibility is **not derivable** from anything the generator already emits — `state` and
`shape` describe the object at rest, not what happened to it. So the LLM supplies a **key from a
closed menu** (`melt` `freeze` `boil_to_steam` `cook` `bake` `burn` `tear` `rust`) and
`CHANGE_CATALOG` owns the answer. A generated `reversible: true` would have been the click era's
free-text `targetAnswer` in new clothes.

The fit gate matches `canChangeState` for **equality**, which does work in both directions: a
reversible change needs an object that really changes state ("we melted the paper" cannot be
built), and an irreversible one needs an object that does not — **"we cooked the ice cube"** is
the pairing a K-2 generator reaches for, because ice is its favourite object. Dissolving is
deliberately absent: sugar in water is contested, and a contested item in a judged loop is a
FALSE key, not a hard one.

**Measurement:** two options means a real 50% guessing floor. Inference gave `c=0.0`, which would
have handed the mastery gates a coin flip scored as clean evidence; the mode is registered
`PATTERN_TRUE_FALSE` (a=1.0, c=0.50) in `discrimination_priors.py`, mirrored as
`discrimination: 1.0` in the catalog, and pinned by `backend/tests/test_matter_explorer_calibration.py`.
β=1.2 sits between `property` (0.5) and `mystery` (2.0).

## What the LIVE probes caught that every machine gate missed

1. **4 challenges → 2 items.** The no-repeated-answer rule strands a two-answer mode: after
   ice(go back) and paper(for ever), every remaining item repeated the previous answer and the
   run *stopped*. Fixed in the draw — alternation is now a preference and *select, never
   truncate* is the law, but **only where the answer set is two wide** (`ANSWER_SET_WIDTH`);
   the three-answer modes keep the hard stop byte-for-byte. Both halves are pinned by tests.
2. **An unasked-for field gets answered anyway.** A pinned `sort` probe came back with
   `everydayChange: "burn"` on a **rock** — harmless there (nothing reads it), but a nonsense
   pairing waiting for a mixed session, and no code gate can see it (a rock IS a solid that does
   not change state). Fixed by scoping: the rules *and the schema property* are omitted when the
   session cannot ask a change. Re-probed: the field is gone.
3. **Draw imbalance is a content lever, not a code one.** The first probe drew 1 reversible
   against 3 irreversible. Rule 12b now demands two challenges of each `canChangeState` kind —
   stated structurally, never as "which ones can be undone", so the model is not handed the
   answer vocabulary. Three probes since: **2/2 balanced, every time**.

## Verified at runtime

| Gate | Result |
|---|---|
| `--di --eval-mode change --di-wrong signature` | **PASS, 0 findings** — 5/5 state-instead-of-undo refused, 5/5 affirmed, 0 dropped |
| `--di --eval-mode change --di-wrong plain` | **PASS, 0 findings** — 4/4 opposite-option refused, 4/4 affirmed |
| Live generation, mode pinned (×4) | all `change`, all pairings valid, 2/2 balanced after the 12b fix |
| Live generation, `sort` pinned (×3) | unchanged; after the scoping fix the change field is absent |
| Live generation, mixed | all four identities drawn in one session |
| **Full pipeline** (`/topic-trace`, real curator brief → manifest → generator) | topic *"Changes we can undo and changes we cannot"* → objective *"Sort real objects and pictures into changes you can undo and changes you cannot"* → **`targetEvalMode: "change"`** → 4 change challenges, 2/2 balanced |

That last row is the gap actually closing: a lesson about undoing changes now **routes** to a
primitive that can teach it. It also exercises the resolver migration — the generator moved off
the pin-only `resolveEvalModeConstraint` onto `resolveEvalModes`, so intent routes the unpinned
path for all four modes.

## Residuals (named, not hidden)

1. **Mic row #126** — the drives prove the judge's SEMANTICS in text. Only a sitting proves the
   acoustics of a five-year-old saying "go back" / "for ever" — and whether they say bare
   "yes"/"no", which the contract accepts by the ask's clause order.
2. **Pairing plausibility is not code-gatable.** `changeFitsObject` checks state and
   changeability, not whether the object plausibly undergoes the change. Prompt-side only
   (rule 12a), now scoped to sessions that can ask a change. No bad pairing survived into a
   `change` session across five probes.
3. **`SCI001-02-H` says "when exposed to heat".** `tear` and `rust` are outside that wording. If
   a pinned G1 lesson ever wants strictly the standard, biasing the draw to heat changes is a
   generator content decision, not a script gate.
4. `boil_to_steam` is the one reversible change a K-2 child may argue with ("the steam is gone").
   The contract names it as the signature miss for that side; no drive has hit it yet.
