# Topic Fidelity: sorting-station — 2026-07-14

Scope intended: the sorting action must demonstrate the assigned lesson objective; color/size variety must not replace a semantic or shape-classification objective.

## Finding

`ctx.intent` reached the context-native registry boundary but the generator never consumed it. In `sort-by-one`, the prompt explicitly required a different sorting attribute in every challenge. In `two-attributes`, the response schema hardcoded color + type, making a perceptual criterion structurally primary even for conceptual lessons.

| Probe | topic | intent | result | verdict |
|---|---|---|---|---|
| before | Match/name 2D shapes | sort by shape category | `shape, color, size, type` | FIDELITY BUG |
| discrimination | Sorting/classifying familiar objects | sort by shape category | `shape ×4` | tracks intent |
| discrimination | Sorting/classifying familiar objects | Need vs Want groups | `category ×4` (need/want) | tracks intent |
| discrimination | Sorting/classifying familiar objects | gear by helper owner | `category ×4` (helper roles) | tracks intent |
| two criteria | Sorting/classifying familiar objects | needs using two relevant clues | `category + type`; rules such as `{category: need, type: food}` | objective remains primary |
| no regression | Sorting familiar objects | one visible attribute | 4 challenges, 4 objects each, 2 groups each, grade band K | grade defaults preserved |

**Verdict:** FIDELITY BUG → fixed without an additional LLM call.

**Mechanism:** dead intent field + prompt-commanded attribute variety + hardcoded two-attribute schema.

**Change:** `gemini-sorting-station.ts` now binds every prompt to `ctx.intent`, provides a semantic `category` axis, keeps the taught rule stable across challenge variety, and makes the objective category criterion one in `two-attributes`. Catalog routing language now describes objective-relevant classification rather than color/shape/size as the primitive's default identity.

**Verification:** focused generator regression tests 2/2; full suite 793/793; Lumina typecheck 0 errors; live eval-test probes above all `status=pass`. Repository-wide `tsc --noEmit` remains at its pre-existing legacy baseline (808 errors), with 0 sorting-station errors.

**Reader-fit follow-up:** PRE presentation audit remains open (instructions and labels are still text while objects are emoji-primary).
