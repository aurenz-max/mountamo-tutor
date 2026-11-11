# Math K panel: subitizing, 2026-11-10

Targeted, not sampled: the user asked for the subitize subskills. Records and routes: `panel.json`.

**Score: 3 of 4 at level 2 or above. 0 played. 0 served.** Model spend: $0 (no model was called).

## Finding: K math has no subitizing subskill

No published K subskill is about subitizing (recognising a small amount at a glance). The word appears only in `target_eval_modes` hints on three subskills, and for each of them it is not the action the objective asks for. The one subskill whose task is subitizing, COUNT001-02-G ("briefly shown then hidden sets"), is hinted to `number-bond`.

| Subskill | Action | Route | Primitive | Level |
|---|---|---|---|---|
| COUNT001-02-G flashed and hidden sets to 10 | see a flash, say how many | specialist | `counting-board` `subitize` + `count_on`; `ten-frame` `subitize` | 2 checked |
| COUNT001-02-A touch-count to 5 | tap each once, say total | specialist | `counting-board` `count` (the subitize hint is the opposite action) | 2 checked |
| COUNT001-01-A count 0-10, match numerals | count, pick the numeral | add-mode | `counting-board`: no count-to-numeral mode | 1 routed |
| COUNT001-05-A find ten in 11-19 | mark exactly ten counters | specialist | `ten-frame` `decompose_teen` (the subitize hint does not apply) | 2 checked |

## Gaps in the subitize modes (code read)

1. **`counting-board` subitize prompt is stale.** `gemini-counting-board.ts:94` tells the model "Objects are always visible ... then types their answer". At K the component flashes and hides the objects and takes a spoken answer (`CountingBoard.tsx` `isKSubitize`).
2. **Difficulty is wording, not structure.** On both primitives, the model picks the subitize count and arrangement. Tiers change only arrangement wording and hint wording; ten-frame's flash duration is the only thing code sets. No code ladder exists: 1-3 → dice patterns → scattered → 6-10 as two parts.
3. **Conceptual subitizing has no mode.** Seeing 7 as 5 and 2 exists only as hard-tier hint text.

## Decision for the user

Kindergarten standard K.CC.B.4/5 relies on subitizing, but the curriculum never makes it an objective, so Pulse cannot measure it. One option is to add a draft subskill under COUNT001-02 (perceptual subitizing 1-5, then conceptual subitizing to 10) through `/curriculum-author`, using draft → lineage-check → publish. That changes the curriculum, so it is your call.

## Queued

- `/eval-fix counting-board`: rewrite the `subitize` promptDoc to match the K flash-then-hide, spoken component (COUNT001-02-G).
- `/add-item-space` subitize strand: code picks the count, arrangement family (line, dice, scattered, two-part) and flash time per tier, for `counting-board` and `ten-frame` (COUNT001-02-G).
- `/add-eval-modes counting-board`: count-to-numeral match for 0-10 (COUNT001-01-A).

## Fix 2026-11-10: gap 1, counting-board subitize prompt (`/eval-fix`)

**Cause.** The `subitize` promptDoc (`gemini-counting-board.ts` `CHALLENGE_TYPE_DOCS.subitize`) said objects stay visible and the child types the answer. Since the boss migration the answer is spoken in both bands. At K the board flashes the objects and then hides them; at Grade 1 they stay visible but cannot be tapped. At K the stale text has no effect the child can see: the instruction is hidden for pre-readers (`CountingBoard.tsx:970`), `hint` and `narration` have no consumer, and the tutor's ask is built in code (`countingBoardDomain.ts` `howToPlayFor`/`askFor`). The child who could be misled was the Grade 1 reader, who sees the instruction on screen.

**Change.** (1) The promptDoc describes both bands and the spoken answer, and forbids type/tap/touch/point/count-one-by-one. (2) `guardInstructionLeak` replaces any subitize instruction that names one of those answer channels with the code ask "How many do you see right away?". Test: `gemini-counting-board.subitize.test.ts` (both cases fail on the old code; valid spoken asks are kept).

**Evidence.** vitest counting-board generator tests 9/9 pass; `typecheck:lumina` 0 errors. Real `/api/lumina/eval-test` draws: subitize at K easy, K hard, Grade 1 medium, plus two runs that asked for grade 1 but came back as band K (5 sessions, 35 boards). Every instruction asks the child to look and say how many; none says type, tap or count. count_all sibling: 2 sessions are unchanged (they still say "touch each one"). Spend: $0.08 automated today.

**Still open.** Hints sometimes name the count ("this line of four"). The hint field has no consumer, so this is a dead-field note, not a leak. Gaps 2 and 3 (code-owned subitize ladder, conceptual subitizing) stay queued for `/add-item-space`.
