# Curriculum-Fit: sight-word-trainer (GAP-008) — 2026-08-06

**Run as a PRE-BIRTH fit check**, not the standard probe: `sight-word-trainer` has no
catalog entry, so Step 0/1 (embed the verbatim catalog `description`) cannot run. The
question answered here is the one the LA K-2 lane's standing lesson demands — *fit before
birth* — after the 2026-08-05 census found a predicted BIRTH already existed under another
domain.

## Verdict: **BIRTH → EXTEND. Do not build `sight-word-trainer`.**

`fast-fact` (`catalog/core.ts`) already occupies this space, and its catalog description
names the use case **verbatim**:

> "Untimed fluency drill for rapid recall across any subject. … response time is measured
> silently for the automaticity signal only. **Use for: math facts, sight words,
> vocabulary** … any domain requiring automaticity. … **ESSENTIAL for building fluency and
> automaticity at any grade level.**"

It carries `targetResponseTime` and `averageTime` in `contextKeys` — the automaticity
signal GAP-008 was written to introduce.

## GAP-008's four proposed eval modes, mapped to what already ships

| GAP-008 mode | Status | Where it lives today |
|---|---|---|
| `flash` (recognition + silent latency) | **ALREADY SERVED** | `fast-fact` — the untimed drill loop; latency measured silently |
| `sentence_context` (fill-blank) | **ALREADY SERVED** | `fast-fact` — the 2026-08-06 FF-1/FF-2 closure specifically converted the LA sight-word drill to clean sentence-completion items (10/10 measured) |
| `production` (letter-bank spelling) | **ALREADY SERVED** | `cvc-speller` (`catalog/literacy.ts`) |
| `find_it` (find all instances in running text) | **GENUINELY MISSING** | nearest is `decodable-reader`'s per-word tap tracking — no find-all mechanic |

## The decisive finding: GAP-008's core premise was overtaken by a user ruling

GAP-008 justifies the birth as *"MC quiz cannot simulate the rapid flash/recall loop…
**Speed is the entire point**"* and specifies `displayDuration` of 1s / 0.5s / 0.25s by
tier.

The platform has since **ruled against exactly that** ([[no-timer-on-fact-fluency]]): no
visible timers, measure response time silently. `fast-fact`'s own `constraints` now read
*"No timers — never frame challenges around speed or deadlines."* GAP-008's central
mechanic, as written, would violate a standing ruling — and `fast-fact` already implements
the ruling-compliant version of the same idea.

## The real blocker is already queued, and it is not a build

`fast-fact` is `supportsEvaluation: true` with **zero `evalModes`** — confirmed against
`catalog/core.ts` this run. It is **L0 and unrouteable by difficulty**, which is precisely
why sight-word demand cannot be adaptively served today. That is **FF-4**, already open in
the portfolio.

So the honest conversion path for LA001-07-a/b + LA005-08-a is:
1. **`/add-eval-modes` on `fast-fact`** (closes FF-4) — turns one already-working,
   already-answer-leak-hardened primitive into something the IRT selector can route. This
   is the load-bearing move.
2. **Optionally add `find_it`** as the one genuinely new task identity.
3. Re-run this fit check against the real catalog entry once modes exist.

## What would still justify a birth (not claimed here)

Two GAP-008 mechanics have no home in `fast-fact` and are real:
- **Per-word mastery state** — a working set of 8–10 words cycled to 3-correct-in-a-row
  with spaced repetition. `fast-fact` tracks streak/accuracy per *session*, not per *word*.
- **Spoken recognition judged by voice** — the capability that did not exist in 2026-04 and
  now does (`useSpokenWordCapture`, `LuminaMicListener`). `fast-fact` is MC-based.

If those are wanted, the cheaper ladder rung is `/add-eval-modes` + `/add-spoken-judge` on
`fast-fact` before considering a fork.

## Recommendation

**Do not birth `sight-word-trainer`.** Mark **GAP-008 as CLOSED-BY-EXTEND** in
`qa/PRIMITIVE_GAPS.md` and re-point its demand at `fast-fact`. Pull **FF-4
(`/add-eval-modes` on `fast-fact`)** as the build item.
