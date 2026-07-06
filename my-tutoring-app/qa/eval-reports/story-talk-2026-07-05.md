# Eval Report — `story-talk`

**Date:** 2026-07-05
**Primitive:** `story-talk` (Kindergarten listening comprehension)
**Component:** `src/components/lumina/primitives/visual-primitives/literacy/StoryTalk.tsx`
**Generator:** `src/components/lumina/service/literacy/gemini-story-talk.ts`
**Core challenge type:** `who_what_where` (single mode at birth — no eval modes; catalog entry has no `evalModes`, so eval-test was invoked with a dummy `&evalMode=who_what_where` to trigger generation; catalog challenge-type validation is skipped for it).

## Verdict: PASS — no fixes required.

3 eval-test runs (default topic, "Farm Animals", "The Beach"), 5 challenges each, all `status: pass`. Every challenge satisfied G1, G2, G4, G5. Role variety present in all runs. No malformed items observed (0 rejections logged in these runs).

## Results table

| Run | Topic | API | Challenges | G1 | G2 | G4 | G5 | Roles seen | Verdict |
|-----|-------|-----|-----------|----|----|----|----|-----------|---------|
| 1 | (default "number sense") | pass (3662ms) | 5 | PASS | PASS | PASS | PASS | actor, object, place | PASS |
| 2 | Farm Animals | pass (3722ms) | 5 | PASS | PASS | PASS | PASS | object, actor, place | PASS |
| 3 | The Beach | pass (3955ms) | 5 | PASS | PASS | PASS | PASS | actor, object, place | PASS |

### Per-run challenge detail

**Run 1 — "Number Fun Adventure!"**
- actor / squirrel 🐿️ — "Who found the yummy snack in the park?" — opts: rabbit🐇 squirrel🐿️ bear🐻 mouse🐭 (animals)
- object / hat 🎩 — "What did the boy get to wear on his head?" — opts: shoe👟 shirt👕 glove🧤 hat🎩 (clothing)
- place / barn 🏚️ — "Where did the farmer go to check on his animals?" — opts: school🏫 barn🏚️ house🏠 store🏪 (buildings)
- place / pond 🌊 — "Where did the bird go to swim?" — opts: river🏞️ lake🛶 pond🌊 ocean🏖️ (water bodies)
- object / apple 🍎 — "What did Mia put into her basket to eat later?" — opts: apple🍎 banana🍌 peach🍑 grape🍇 (fruit)

**Run 2 — "Fun Farm Animal Adventures"**
- object / mud 💩 — "What is the animal playing inside?" — opts: water💧 hay🌾 dirt🌱 mud💩 (messy substances)
- actor / dog 🐕 — "Who is watching the cows come home?" — opts: dog🐕 cat🐈 goat🐐 duck🦆 (animals)
- place / barn 🏚️ — "Where are the animals going to stay dry?" — opts: house🏡 barn🏚️ farm🚜 shed🛖 (places)
- object / carrot 🥕 — "What snack is the animal eating?" — opts: carrot🥕 apple🍎 corn🌽 potato🥔 (foods)
- actor / rooster 🐓 — "Who is making noise to wake up the farm?" — opts: sheep🐑 rooster🐓 pig🐖 cow🐄 (farm animals)

**Run 3 — "Fun Day at the Beach!"**
- actor / gull 🐦 — "Who was flying over the water?" — opts: duck🦆 owl🦉 swan🦢 gull🐦 (birds)
- object / shell 🐚 — "What object did I find in the sand?" — opts: stone🪨 shell🐚 key🔑 coin🪙 (small objects)
- place / water 🌊 — "Where did the boy jump to cool off?" — opts: sand🏖️ deck🪵 water🌊 boat⛵ (beach locations)
- object / hat 👒 — "What did she wear on her head?" — opts: glasses🕶️ hat👒 shirt👕 towel🧖 (wearables)
- actor / crab 🦀 — "Which animal walked on the beach?" — opts: bird🐦 seal🦭 fish🐟 crab🦀 (animals)

## G1 / G2 / G4 / G5 Sync Check

- **G1 — Required fields:** PASS. All 15 challenges (3 runs × 5) have non-empty `storyTitle`, `story`, `question`, `answer`, `answerEmoji`, `answerRole`, and `options.length === 4`.
- **G2 — Flat-field reconstruction:** PASS. Every `options` array has exactly 4 entries, each with a non-empty `word` and non-empty `emoji`; the `answer` word appears in `options` exactly once; all 4 words and all 4 emojis are distinct in every challenge. 0 malformed/short.
- **G3 — N/A** (no eval modes at birth).
- **G4 — Answer derivability:** PASS. For all 15 challenges: (a) the `answer` token appears in the `story` text (case-insensitive, word-boundary); (b) the `answer` does NOT appear in the `question`; and `answer` is one of the 4 option words. Distractor same-category spot-check: all 15 challenges have same-category distractors (animals↔animals, places↔places, clothing↔clothing, fruit↔fruit, etc.) — no cross-category answer-leak-by-implausibility.
- **G5 — Fallback quality:** PASS. Generator source audit confirms REJECT-not-fabricate:
  - `validateStoryPool` rejects (continue + increment `rejected`) any item missing prose, with a non-single-token answer, an out-of-set `answerRole` (no default/clamp — line 218), a story that doesn't state its answer, a question that leaks the answer, or fewer than 3 valid distinct distractors.
  - `answerRole` is never defaulted — rejected if not in `VALID_ROLES`.
  - No `?? defaultValue` on any contract field. `title`/`description` use `|| ''` then THROW if empty (lines 381–389) — rejection, not silent fabrication.
  - Throws if the pool has < 5 usable stories after one corrective retry (line 384). Ids are index-derived, not `Date.now()`.
  - **Role variety:** PASS. `selectWithRoleVariety` picks one-per-distinct-role first, then back-fills. All 3 runs produced all three roles (actor/object/place); no collapse to a single role.

## Notes
- Run 2's `mud` answer used the 💩 emoji — picturable and contract-valid, though a nicer mud glyph would be preferable. Cosmetic only; not a gate failure and left to the LLM.
- No generator or component changes were made — the primitive is behaving to contract at birth (L0).
