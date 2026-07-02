# Topic Fidelity: math-fact-fluency — 2026-06-29

Trigger: lesson topic/title "Adding Within 20" but rendered content is all within 10
(badge reads "Within 10"; example shown 5 + 3 = 8, single ten-frame, eval mode visual-fact, support tier easy).

Scope/theme intended by the manifest item: sums **up to 20** (intent: "solve addition
problems using mental counting-on strategies for sums up to 20").

## Verdict: was structurally capped at 10 → user chose to RAISE the ceiling to 20

Initial read was WRONG-PRIMITIVE (topic asks MORE than the primitive's hardcoded ceiling).
But the user's call: "we're explicitly doing adding within 20 — trust the intent more than
the hardcoded rules." The within-10 cap was an arbitrary code/schema rule, NOT a true
pedagogical ceiling (within-20 is CCSS 1.OA.C.6, still Grade 1). So the fix is to remove the
hardcoded caps and let the lesson scope/intent drive the range, AND extend the one visual
that physically couldn't represent >10 (the ten-frame) so within-20 renders honestly.

Structural ceiling evidence:
| Source | Cap |
|--------|-----|
| `gemini-math-fact-fluency.ts:215` schema `maxNumber` desc | "Maximum number used in facts: **3, 5, or 10**" |
| `gemini-math-fact-fluency.ts:390-392` grade guidelines | Grade 1 → maxNumber **5-10** |
| `MathFactFluency.tsx:67` `gradeBand` type | only `'K' \| '1'` |
| `MathFactFluency.tsx:122-158` `TenFrameVisual` | a **single 10-cell** frame; cannot represent a count > 10 |
| `MathFactFluency.tsx:855` badge | renders `Within {maxNumber}` = "Within 10" |

"Adding within 20" (CCSS 1.OA.C.6) is a legitimate Grade-1 standard, but THIS primitive
was not built for it. The scope block (`scopeContext.ts`) DID carry "up to 20" into the
prompt, but the schema enum description hard-caps `maxNumber` at 10 and the ten-frame
visual (the mode the manifest pinned here) physically tops out at 10, so the model
correctly produced within-10 content.

Probes not run (dev server down). Verdict rests on the structural ceiling, which a probe
cannot move — a "within 5" probe would track DOWN, but nothing pushes the ceiling past 10.

## Secondary (real, in-generator) defect — title/description echo

The LLM freely echoes the topic's "20" into `title` ("Adding Within 20: Ten-Frame
Explorer") and `description` ("sums up to 20") even though every number is capped at 10.
That header directly contradicts the "Within 10" badge and is the visible symptom. It is
a symptom of the routing mismatch, not the root cause — patching the title alone would
mask the routing problem.

## Minor — redundant config.intent

`gemini-math-fact-fluency.ts:348` sets `config.intent = ctx.intent`, but the prompt never
reads `config.intent`; intent already reaches the prompt via `buildScopePromptSection(ctx.scope)`
("THIS COMPONENT'S INTENT"). The line 348 assignment is dead/redundant. Not the bug here.

## Implemented fix — raise the ceiling to 20, intent-driven

The eval-constrained render path (the screenshot) SKIPS the grade-guidelines block, so the
dominant cap was the **schema `maxNumber` description "3, 5, or 10"** — that single string is
what clamped intent.

| # | File | Change |
|---|------|--------|
| 1 | `gemini-math-fact-fluency.ts` schema | `maxNumber` desc: "3, 5, or 10" → scope-driven, supported up to 20, never cap below the topic's ask |
| 2 | `gemini-math-fact-fluency.ts` prompt | Removed hardcoded "GRADE GUIDELINES (K 3-5 / G1 5-10)" → "PRIMITIVE RANGE (intent-driven)" deferring to scope, ceiling 20 |
| 3 | `MathFactFluency.tsx` `TenFrameVisual` | Single 10-cell frame → **double ten-frame (20 cells)** when count > 10 |
| 4 | `MathFactFluency.tsx` interface | `maxNumber` comment "3, 5, or 10" → "5, 10, or 20" |
| 5 | `gemini-math-fact-fluency.ts` validation | `fingers` visual (caps at 10) → falls back to ten-frame when count > 10 |

**Range now follows the lesson scope**, not a hardcoded grade band. "within 5" stays ≤ 5,
"within 20" reaches 20; grade is a genuine ceiling (20), not a target.

tsc: 1417 (baseline 1419 — no new errors).

## Live probe verification (dev server :3001)

| Probe | topic | maxNumber | max result | verdict |
|-------|-------|-----------|-----------|---------|
| honored | Adding within 20 | **20** | 18 | honors intent (also produced ten-frame cnt=11 → exercises new double frame) |
| discrimination | Adding within 10 | 10 | 10 | tracks down |
| discrimination | Adding within 5 | 5 | 5 | tracks down |
| no-range | "Addition fact practice" (Grade 1) | 20 | 20 | defaults to ceiling — see tradeoff |

**Tradeoff:** removing the grade guidelines means a range-UNSPECIFIED Grade-1 topic now
defaults to maxNumber 20 (was ~10). Defensible (CCSS Grade 1 = within 20). If a gentler
silent default is wanted, add a soft "prefer 10 when no range is named" without restoring the
rigid 5-10 band. Not changed — pending user preference.
