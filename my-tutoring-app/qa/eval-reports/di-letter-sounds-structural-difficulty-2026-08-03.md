# di-letter-sounds — L4 structural difficulty (2026-08-03)

**Layer: L3 → L4.** `/add-structural-difficulty` on the second DI-family pack
to reach this rung. The tier now drives BOTH within-mode dials: how much of the
DISTAR sequence precedes production (L3, `resolveSupportStructure`) **and the
composition of the whole item set** (L4, `resolveProblemShape`). A hard session
is a COLD production set containing the confusable continuant contrasts `m/n`
and `f/v` together.

**No spoken copy changed.** The model/guide/test lines, judging contract,
correction, and L3 fade are byte-identical. L4 changes which code-owned menu
items ship, then the existing script reads those items. No component, script,
catalog, or menu expansion was needed.

## The gradient (confirmed by the birth certificate)

| Mode scope | Lever | easy | medium | hard | Floor | Cap |
|---|---|---|---|---|---|---|
| `letter_sound`, `letter_sound_review`, mixed | whole-set composition | unique continuants; 0 complete pairs | continuants + ≥1 short vowel; 0 complete pairs | exact confusable-pair target: 1 pair at 3 items, both pairs at 4–6 | 3 items | existing 6-item/session cap; curated menu only |
| `first_sound_in_word` | whole-set composition inside onset identity | unique continuants; 0 pairs | same (honest saturation) | 1 pair at 3 items, both pairs at 4–6 | continuants only | vowels remain forbidden; 6 items |

The onset mode cannot take the middle rung's short vowel: its identity is
isolation of the onset from a continuant keyword, and the L1 ruling explicitly
forbids short-vowel onsets because they distort for K. Medium therefore
saturates at easy there. That is an honest mode cap, not a reason to smuggle a
vowel across the identity boundary; hard remains a genuine structural step.

## The hard rule in this pack

The tier never changes item count, the benched response class, the curated
menu, or a challenge's eval-mode slot. Composition is the shape: the
relationship among the same 3–6 items. Letter names, stops, blends, and
digraphs remain excluded. `first_sound_in_word` remains continuant-only.

## What changed

1. **`resolveProblemShape(mode, tier, count)`** is the one source of truth. It
   returns short-vowel floor/cap, exact confusable-pair target, honest-saturation
   status, and the advisory prompt line. Pair targets clamp to capacity: one at
   count 3, both at counts 4–6.
2. **One key, two places.** The normalized tier reaches the wrapper prompt and
   the deterministic post-process. Prompt wording is advisory; code is
   authoritative. The no-tier prompt and selection path are unchanged.
3. **Count → honor → reconstruct.** If the preliminary set is already unique
   and exactly satisfies its composition, it is retained. Otherwise code
   reconstructs from the prior selection, objective focus, starter ladder,
   review spread, and menu—in that preference order—while preserving every
   challenge's mode slot. `buildChallenge` then reattaches the sound, keyword,
   emoji, elicitation, and ASR aliases from the final letter, so no stale
   answer-bearing metadata survives.
4. **Window after rotation—the template's named trap.** The existing mixed path
   rotates focus per mode to stagger repeated keywords. L4 enforcement runs
   after that rotation and owns the final window. Rotation may influence
   within-shape preference, but can never pull a vowel into easy, remove a hard
   pair, or reintroduce a duplicate. The mixed tests pin all three cases.
5. **Set-level resolution is deliberate.** A confusable contrast is a
   relationship across items, not a property of one challenge. The session
   shape resolves once from the selected mode set; supportTier still stamps
   every challenge from its own `challengeType`. Mixed sessions retain all
   three identities.

## Verification

| Gate | Result |
|---|---|
| `npm run typecheck:lumina` | **0 errors** |
| project-local `tsc --noEmit` | **803 = baseline exactly**, 0 in touched files |
| Existing + new focused generator suites | **25/25** |
| New `gemini-di-letter-sounds.structural.test.ts` | **17/17** — resolver caps, every tier in base/review/onset/mixed, 3–6 item capacities, prompt/code spine, no-tier control |
| Offline builder stress | **2,048/2,048** varied objective sets — exact vowel/pair targets, uniqueness, fixed count, onset identity |
| Non-vacuity | disabling `enforceProblemShape` fails **10/17** structural tests; restored suite 17/17 |
| Full vitest | **1320/1320** (114 files) |
| Live `/eval-test` tier sweep (isolated `:3005`, real Gemini) | **7/7 PASS** |

| Live probe | Observed |
|---|---|
| `letter_sound` + easy | `s,m,f,r`; 0 vowels, 0 pairs, all `easy` |
| `letter_sound` + medium | `m,s,f,a`; 1 vowel, 0 pairs, all `medium` |
| `letter_sound` + hard | `m,n,f,v`; 0 vowels, 2 pairs, all `hard` |
| `first_sound_in_word` + medium | `m,s,f,r`; 0 vowels, 0 pairs—honest saturation, onset identity intact |
| `first_sound_in_word` + hard | `m,n,f,v`; 0 vowels, 2 pairs, onset identity intact |
| mixed + medium | `a,m,s,f`; 1 vowel, 0 pairs; all three identities present and tiered |
| no-difficulty control | `m,s,f,a`; no `supportTier`; the pre-L4 shape |

Claimed composition equals actual in every probe; all item metadata is rebuilt
from the final letter rather than trusted from the model.

## Tier 3 (live behaviour) — folded into existing row #57

No spoken line changed, so no new ear-check row is warranted. HUMAN-CHECKS #57
now asks for the hard `m/n/f/v` cold set in both isolated and onset modes. Its
old hard-vowel glance moved to medium because the default four-item hard set is
fully occupied by the two contrast pairs; medium still exercises the
keyword-elicited vowel wording with one model line and no guide line.

## Deferred by design

- More than two confusable families: none are in the benched menu. Expanding
  the response class is a bench decision, not L4.
- Making onset medium artificially distinct: adding a short vowel would change
  the mode; a new within-onset lever requires its own pedagogical ruling.
- Any item-count increase by tier: count is workload/magnitude here, not shape.
