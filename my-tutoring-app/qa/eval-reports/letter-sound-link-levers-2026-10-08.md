# letter-sound-link levers: hear_see per-item gaps (J12), 2026-10-09

Closes `qa/support-levers/QUEUE-item-gaps-2026-10-09.md` row `letter-sound-link.hear_see`. Earlier lever work: `letter-sound-link-levers-2026-09-28.md` (hear_see), handoff 24 (spoken modes).

## Failure inventory (hear_see)

| Miss (code: `letterSoundMiss`) | Evidence class | Lever before today |
|---|---|---|
| `other_letter` | observed-synthetic (journey wrong tap, saved payload ch1/ch3/ch4) | `keyword_under_both`, `far_letter_pair`, but only where they pass their leak rules |
| `other_short_vowel` | observed-synthetic (payload ch2 a/i) | same |
| `voicing_partner` | observed-synthetic (voicing payload) | `voice_feel_model` (unchanged) |

No real-learner evidence for this primitive.

**Why the saved group-1 payload had no lever on ch1 to ch4:** group 1 has six letters (s a t i p n) and the session uses all six. `keyword_under_both` is refused when a later item uses a card letter (R4: it would tell that item), and for any pair containing `i` (its picture does not read as its word). `far_letter_pair` needs two group letters the session never uses, and there are none. Only ch5, the last item, got the keyword lever. Any full group-1 session has the same gap.

## Lever table

| Mode | Failure (class) | Lever | Kind | Carrier | Leak rule | Exists? | Cost |
|---|---|---|---|---|---|---|---|
| hear_see | `other_letter`, `other_short_vowel` on items where the keyword and far-pair levers are refused (synthetic) | `pair_model`: two OTHER letter cards beside the item, each with its keyword picture, of the same sound kinds as the item's two cards; the tutor says each model sound | help | both | no session letter, keyword or picture; the kinds match the item's two cards as a set, so a vowel model never marks the vowel card; never c/k (same sound) or b/d (mirror letters) (`pairModelLeak`) | no | levers module + render block |

This is the parallel-item model (user ruling 10-02: model a DIFFERENT item). It does not change the item's cards, and the learner still has to match the sound they heard to a card. On a group-1 session the model letters come from outside the group (ch1 s/n → f, m; ch2 a/i → o, u; ch3 t/p → d, g; ch4 i/p → d, o), as `letter_model` already does on the spoken modes. The tutor says the model sounds, not the picture words. The catalog guidance line "where two pictures are shown ... never name either" would conflict with saying the words.

No simplify lever was added for group 1. A practice item made from letters the learner has not been taught would not be simpler.

## Built

- `letterSoundLinkLevers.ts`: `PAIR_MODEL_LEVER`, `pairModelLeak`, `pairModelFor`; the lever is declared on every hear_see item where a pair passes. It comes after `keyword_under_both`, so `nextLever` still picks the keyword pictures first when they are offered.
- `LetterSoundLinkTeaching.tsx`: the `data-lever="pair-model"` block and the scene fact `levers_on_screen` ("a model pair beside the cards ... They are not this item's letters"). The pull is the existing synchronous commit.
- `liveJourneySpec.ts` (letter-sound-link row only): a `~simpler` item is rebuilt from its parent with `fartherPair`. Before this, the row would have thrown on a practice item.
- `journey-sweep-baseline.json`: removed the `letter-sound-link.hear_see` J12 entry. Queue row closed. Contract R12 and its changelog updated.
- Catalog: no change. The misses are unchanged, and every hear_see miss has a lever on every item of both saved payloads.

## Tests

- `npm test -- letterSoundLinkLevers.test.ts LetterSoundLink.levers.workspace.test.tsx`: 46/46. New cases:
  - each payload item ch1 to ch4: miss → `pair_model`, no leak, kinds match;
  - the leak rule: a session letter, a kind mismatch, c/k, b/d;
  - groups 1 to 4: every two-item session gets a pair that passes its leak rule;
  - `does` names no model letter;
  - mounted group-1 test: a wrong tap; a refused pull (`far_letter_pair`, not offered) leaves the HTML, levers and attempts unchanged; the observer picks `pair_model`; the pull draws two non-session letters and the scene fact in one commit, with the cards unchanged; the credited retry records `levers: ['pair_model']`.
- The simplify path (practice item, retry kept, full item back blank and credited after) is covered by the existing group-3 mounted test, which still passes.
- All letter-sound-link tests (6 files): 98/98.
- `npm run typecheck:lumina`: 0 errors in my files. The one error is in `knowledgeCheckLevers.ts`, a sibling's file.
- Not run (per the task): the journey sweep, tutor replay, Live.

## Left without a lever

None on hear_see. `see_hear.other_sound` stays unanswered by an earlier decision (catalog `unanswered`).
