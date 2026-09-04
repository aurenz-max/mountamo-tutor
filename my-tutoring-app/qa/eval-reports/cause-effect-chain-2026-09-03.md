# Eval Report: cause-effect-chain — 2026-09-03

Birth QA (`/primitive` Phase 6). Live generations through
`/api/lumina/eval-test`, then the G1-G5 sync rules applied to each payload by script.

## Results

| Run | Topic / grade | Status | Challenges | Lengths | G1 | G2 | G4 | G5 | Verdict |
|-----|---------------|--------|-----------|---------|----|----|----|----|---------|
| 1 (pre-fix) | railroad towns @ G3 | pass | 4 | 2,2,2,2 | OK | OK | OK | **FAIL** | **FAIL** — see defects |
| 2 | why our community has rules @ G1 | pass | 3 | 3,3,3 | OK | OK | OK | OK | PASS |
| 3 | railroad towns @ G3 | pass | 3 | 3,3,3 | OK | OK | OK | OK | PASS |
| 4 | printing press @ G5 | pass | 4 | 4,4,4,4 | OK | OK | OK | OK | PASS |
| 5 | Ancient Egypt @ G6 | pass | 3 | 4,4,4 | OK | OK | OK | OK | PASS |

G3 is N/A at birth — there is one challenge type, so eval-mode differentiation has nothing to
compare. (The route needs `&evalMode=` to generate at all, so `evalMode=build_chain` was passed
and reported back as `No eval mode in catalog (skipped validation)` — expected at L0.)

## Defects the first run caught, and the fix

**D-1 — the chain was a coin flip.** Grade 3 shipped four chains of **two cards each**. Two
cards have exactly two arrangements, so a student who guesses is right half the time — and with
`MAX_TRIES = 2`, a guesser who is wrong on try 1 is right on try 2 *every* time. The score
would have measured nothing. The prompt's own wording invited it: it asked for "EXACTLY 3
causes" and then said "this grade gets a 3-link chain", and the model read the outcome as one
of the links.

*Fix:* `MIN_CAUSES` is **3, not 2**, and `chainLengthFor` can never return less — the floor is
a measurement property, not a preference, and the docblock says so where the next reader will
look. Grade-appropriateness for K-2 now rides the *reading level* of the cards, which is where
it belongs ([[make-age-friendly-not-band-floor]]). Prompt reworded to "EXACTLY N CAUSE CARDS
(the outcome is not one of them)". Attempt 1 insists on the grade's length; attempt 2 degrades
to the floor rather than dropping the session onto the fallback.

**D-2 — four chains, one problem.** All four G3 chains began with the railroad being built
("Railroad builders lay iron tracks…", "Workers finish building a transcontinental railroad…",
"Train companies build small wooden depots…", "Workers lay train tracks near wide farming
fields"). Cross-challenge dedup only compared *outcomes*, which all differed, so all four
passed. That is one problem asked four ways — the rule this project already settled
([[n-challenges-n-problems]]).

*Fix:* three layers, because semantic sameness is past what a regex can see
([[schema-over-regex-and-prompt]]) —
1. **schema**: a required `chainTheme` field ("town founding", "mail delivery"), with the
   instruction that every chain's theme must differ. The model has to commit to the
   distinction in its own output.
2. **code**: reject a duplicate theme, and reject a first cause whose content words overlap an
   accepted chain's first cause by ≥ 0.6 (the literal-repeat floor).
3. **prompt**: named the failure explicitly — *"if three of your chains begin with the railroad
   being built, you have written one chain three times, and only the first will be used"* —
   plus a list of directions to reach for (settlement, news, schooling, work, rules).

After the fix, run 3 on the same topic and grade returned themes `station store supplies` /
`daily mail delivery` / `schoolhouse construction`; G5 returned `bible translation access` /
`school textbook production` / `scientific discovery sharing` / `news pamphlet distribution`.

## G1-G5 Sync Check (runs 2-5): ALL PASS

- **G1 required fields** — every challenge carries `id`, `type`, `chainTheme`, `outcome`,
  `nodes`, `correctOrder`, `explanation`; every node carries `id`/`text`/`category`/`icon`;
  `nodes.length === correctOrder.length`; no chain under 3 cards.
- **G2 reconstruction** — the flat `cause0..cause3` fields rebuilt into `nodes` in all 13
  challenges across the four runs; zero empty banks. (Flat fields are the flash-lite
  nested-array workaround; icons are derived from `category` in code, so the schema never asks
  for an emoji beside an array.)
- **G4 answer derivable** — `correctOrder` references only ids present in `nodes` in every
  challenge, and no card carries a sequence word, a causal connective, or a year.
- **G5 fallback quality** — the curated fallback fired **zero times** in five runs. It is
  exercised instead by the audit suite, which holds it to the same leak audits as generated
  content.

## Offline audit gate — 27/27, mutation-checked

`gemini-cause-effect-chain.audit.test.ts` feeds the post-validation the adversarial responses
the live runs never produced: each leak class, a bank equal to the answer order at every chain
length (200 trials each), duplicate cards, a cause restating the outcome, a missing category,
and each of the three distinctness rules.

**Non-vacuity proven, not asserted:** removing the `ORDINAL_LEAK` branch and neutering the
shuffle fails **5** of the 27; restoring both returns 27/27.

## Gates

- `typecheck:lumina` — **0 errors**
- full `tsc --noEmit` — no error in any new or touched file (repo baseline unchanged)
- `vitest` audit suite — 27/27, mutation-checked ×2
- 5 live generations through the real pipeline, 4 grades, 4 topics — all `status: pass`

## Not verified

**Not browser-driven.** The render tree has not been exercised in Chrome — the tap-to-place
interaction, the drop-zone shake on a wrong chain, and the reveal are unproven at runtime. A
`HistoryPrimitivesTester` panel ships with this birth (`Dev → History Primitives`) specifically
so that check is one click away; `era-explorer` went L0→L4 without one and its own L3 report
says the same thing. **This is the top follow-up.**
