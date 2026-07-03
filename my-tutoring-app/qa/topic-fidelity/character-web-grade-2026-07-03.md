# topic-fidelity --grade — character-web (2026-07-03)

**Generator:** `my-tutoring-app/src/components/lumina/service/literacy/gemini-character-web.ts`
**Ladder:** grades 2–6 (TOP_RUNG `6`, MID_RUNG `4`; floor `2`). Catalog: "literary analysis grades 2-6".
**Verdict:** FIDELITY_BUG_FIXED

## Mechanism (parse-and-fallback)

The generator read the numeric grade from the wrong field and then matched it against numeric strings:

```ts
const gradeLevel = ctx.gradeContext;                                  // PROSE sentence
const gradeLevelKey = ['2','3','4','5','6'].includes(gradeLevel) ? gradeLevel : '4';
```

`ctx.gradeContext` is a prose sentence, so `includes(...)` never hit and `gradeLevelKey`
was **constant at `'4'`** for every objective. The prompt line `TARGET GRADE LEVEL: 4`
was therefore hardcoded regardless of the objective's canonical grade.

Second, latent problem: even the (broken) grade note was gated behind `!evalConstraint`,
so whenever a mode was pinned — the production and eval-test path — grade shaped **nothing**.

## The fix (mirrors gemini-poetry-lab / gemini-decodable-reader)

1. Read `ctx.grade`, clamp to the real 2–6 ladder; above-ceiling → `'6'`, below-floor
   (grade 1 / K band) → `'2'`; band fallback → `'2'` for kindergarten/preschool else `'4'`.
2. Removed the dead `ctx.gradeContext` read.
3. Rewrote `gradeNotes` to be **realization-only** (reading level, vocabulary, cast size,
   sentence complexity, story length) and inject them **unconditionally**, so grade governs
   how the story reads at every mode. The `analysisFocus` enum and the per-mode
   `CHALLENGE_TYPE_DOCS` (cognitive KIND axis) are unchanged.

## Probe table (mode `trait_evidence`, topic "a community helper")

| probe | grade | out.gradeLevel | cast | storyWords | avgSentLen | longWords(>=8ch) | verdict |
|---|---|---|---|---|---|---|---|
| BEFORE | 2 | **4** | 2 | 82 | — | — | constant (bug) |
| BEFORE | 6 | **4** | 2 | 104 | — | — | constant (bug) |
| AFTER | 2 | 2 | 1 | 66 | 9.4 | 3 | tracks |
| AFTER | 4 | 4 | 2 | 113 | 22.6 | 17 | tracks |
| AFTER | 6 | 6 | 2 | 139 | 27.8 | 20 | tracks |
| AFTER | none (band only) | 4 | 2 | 116 | 23.2 | 11 | falls to MID rung 4 (no regression) |

BEFORE: the output's own `gradeLevel` field is pinned to `4` for both grade=2 and grade=6
(story-word variance is stochastic noise — the LLM was told "TARGET GRADE LEVEL: 4" both times).

AFTER: every structural signal scales monotonically with the objective grade — reported grade
tracks exactly, story length 66→113→139, avg sentence length 9.4→22.6→27.8, long-word count
3→17→20, cast size 1→2→2. The no-`&grade=` band control lands at the mid rung (4), unchanged.

Note: an earlier probe with the Tier-1 mode `trait_id` (whose promptDoc anchors "Grades 2-3")
partially masked high-grade tracking — the mode band fought a grade-6 objective while grade
notes were still gated off. Ungating the realization note (step 3) resolves that: grade and
mode are now orthogonal.

## Answer-leak check

No leak introduced. The grade notes describe reading level / cast size only; the existing
CRITICAL RULES forbidding trait/answer reveal in titles and labels are untouched.
