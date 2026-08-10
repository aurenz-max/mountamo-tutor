# Arm C — does the eval-mode stage order a block well? — 2026-08-08

**Question asked:** the resolver now (uncommitted, gated on `experiment.evalModeArm === 'C'`)
reorders each objective block's components after it has picked their skills. *Is the order it
produces a logical order of primitives?*

**Answer: not reliably. Keep it gated off.** Across two passes it took **10 ordering actions
on 66 blocks**; by my judgment **5 were right, 3 defensible, 2 wrong**, and it made **directly
contradictory calls on the same topic and the same objective verb** across the two passes.
Four concrete defects were found and fixed; the fixes killed the specific failure modes they
targeted, but the arm still does not apply a stable ordering principle — and after the fixes
it spent **4 of 7 actions on the engineering CONTROL**, the one domain the ordering audit says
already sequences well (4.67/5, 0% bad openers).

Instrument: `armC-probe.mjs` (scratch), 12 topics × 1 lesson, `manifestOnly`, serial. The
BEFORE order is the manifest's own, read off the resolver's `↕️` log lines — so every action
is an exactly paired before/after **on the same manifest**, with no re-sampling. (Pass 1 vs
pass 2 as wholes are NOT paired; the manifests re-sample.)

---

## Pass 1 — the arm as written

33 blocks / 13 traces. **3 reorders (9%)**, plus 1 hallucinated permutation the guard rejected.

| lesson / block | manifest order → arm C | verdict |
|---|---|---|
| counting to 20, b1 `[identify] "Recognize and name the written numbers 1-20"` | `hundreds-chart → number-sequencer → number-tracer → fast-fact` → **`fast-fact` FIRST** | **WRONG** |
| place value to 100, b0 `[apply] "Group loose counters into bundles of ten"` | `counting-board → base-ten-blocks → ten-frame` → **`ten-frame` before `base-ten-blocks`** | RIGHT |
| excavator, b1 `[explain] "…cylinders make the arm move"` | `how-it-works → hydraulics-lab → lever-lab` → **`hydraulics-lab` FIRST** | see below |
| parts of a plant, b2 (2 components) | model returned `[b2c0, b2c1, b2c2]` | guard rejected |

**The `fast-fact` move is the diagnostic one.** It is an automaticity drill ("rapid recall…
response time measured silently"), moved to the front of a Kindergarten block whose job is to
*build* the recognition the drill automates. It also inverted the arm's own rule 3: after the
move the block's demand falls monotonically (drill → chart hunt → ordering → tracing). And the
model had the least information about precisely the component it moved — `fast-fact` has no
eval modes, so the listing showed a bare id marked `[single-purpose]` and nothing about what
it is.

## The four defects behind that behaviour — all fixed

1. **The ordering model could not see what a primitive IS.** The listing carried `componentId`,
   intent and mode keys — no catalog `description`. Rule 2 ("the thing before the words about
   it") is unanswerable from `fast-fact` or `how-it-works` alone. `order-audit-harness.mjs`
   closed the same gap for its judge, for the same reason.
2. **The schema declared `blockOrders` before `picks`, with no `propertyOrdering`.** Nothing
   guaranteed the model emitted its skill assignments before its ordering — so the arm's whole
   premise ("you know the skill each one will carry now") was not guaranteed to hold. Now
   `picks` is declared first and pinned.
3. **Rule 3 said "rising demand" but never named the case that breaks it** — a fluency / speed
   / recall drill ends a block, never opens it. Now stated.
4. **The arm fell silent on exactly the lessons it was built for.** `slots.length === 0`
   returned early *before* ordering, and biology has **0 of 17** primitives with eval modes —
   an all-expository lesson, whose ORDER is most in question, got no ordering at all.

Also fixed: `blockOrders`/`order` were unbounded arrays on a flash-lite call whose single
`JSON.parse` also carries the mode picks (an ordering truncation would have voided the picks
too — now bounded to the lesson's own block/component counts); `'none'` type-checked into the
resolver and silently ran arm A; a repeated `blockId` could act on an already-permuted array.

## Pass 2 — same 12 topics, after the fixes

33 blocks. **7 reorders (21%)** — the action rate roughly doubled. No rejected permutations.

| lesson / block | manifest order → arm C | verdict |
|---|---|---|
| shapes, b0 | `concept-card-grid → sorting-station → 3d-shape-explorer` → **explorer before sorting** | RIGHT |
| place value, b0 | `deep-dive → base-ten-blocks → ten-frame` → **ten-frame before base-ten-blocks** | RIGHT — *reproduces pass 1 on a different manifest* |
| sight words, b0 | `vocabulary-explorer → fast-fact → di-word-reading` → **`fast-fact` LAST** | RIGHT — **exact inverse of pass 1's error** |
| excavator, b0 `[identify]` | `foundation-explorer → machine-profile → sorting-station` → **machine-profile first** | defensible (whole machine before its named parts) |
| excavator, b1 `[explain]` | `hydraulics-lab → bio-process-animator → image-comparison` → **`hydraulics-lab` LAST** | **CONTRADICTS pass 1** |
| excavator, b2 `[apply]` | `excavator-arm-simulator → how-it-works → take-home-activity` → **`take-home-activity` FIRST** | **WRONG** |
| dump truck, b1 `[explain]` | `hydraulics-lab → engine-explorer → how-it-works` → **engine-explorer first** | defensible |

**The two that matter.**

- **`take-home-activity` opening a block.** It is "instructions for a hands-on activity using
  cardboard strips, brass fasteners and string" — an offline craft the student cannot do in
  session. Arm C made it the first thing in the `[apply]` block, ahead of the simulator that
  *is* the apply surface, and pushed `how-it-works` behind both. Its rationale — "hands-on
  model creation gives a physical anchor first" — is rule 2 fired on a component that is not a
  thing the student can touch now. This is pass 1's `fast-fact` error in a different costume:
  the arm reads a description and promotes it without a model of what is deliverable in-session.
  Note it left the *identically shaped* dump-truck b2 (`ramp-lab → dump-truck-loader →
  take-home-activity`) alone.
- **`hydraulics-lab` moved to the front in pass 1 and to the back in pass 2**, on the same
  topic, the same `[explain]` verb, and the same lab primitive — once citing "the thing before
  the words," once burying it behind two expository components. Both rationales read well. That
  is the finding: the rationale is post-hoc, not a policy.

**And the churn concentrated where it was least needed.** Engineering took 4 of 7 pass-2
actions (4 of its 9 blocks). That is the positive control — the domain `order-audit` measured
at 4.67/5 with a 0% bad-opener rate. A rule that improves math while stirring the control is
the trade `order-audit-2026-08-08.md` explicitly says to refuse.

---

## What this does and does not establish

- Paired per action, on the manifest each action was applied to. **Not** paired pass-to-pass —
  manifests re-sample, so "9% → 21%" is directional, not a measured effect of the fixes.
- 10 judged actions is a diagnosis, not a rate. Nothing here supports "arm C changes lesson
  quality by X".
- **The verdicts are mine, not the ratified judge's.** The success criterion for this lane is
  absolute teacher-judgment of the whole lesson — `npm run audit:order -- <port> N A,C` — and
  it has **not** been run on arm C. That is the gate if anyone wants to promote it, and the
  engineering control is exactly what would catch the churn above.

## Recommendation

**Keep arm C gated off; do not promote.** Its ceiling was already bounded: the reported
ordering defect was solved one layer up, at the OBJECTIVE layer (3.25 → 3.89/5), and arm C only
reorders *within* a block. The residual it could plausibly move is `dependency violations at
58%` — which `order-audit-2026-08-08.md` flags as **unexamined, possibly a maximalist judge
rather than a defect.** Establish that the 58% is real before spending a promotion on it.

If it is revived, the next lever is not more prompt prose. It is telling the model what a
component can actually be *in session* — the arm's two clear errors (`fast-fact`,
`take-home-activity`) are both the same missing fact, and both were invisible to a listing that
describes primitives only by what they contain.
