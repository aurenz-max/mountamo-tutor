# di-sentence-reading on a sentence space (2026-10-14)

`/add-word-space`. Files: `service/wordSpace/sentenceSpaces.ts` (+ test), `service/wordSpace/sentenceBank.json` (752 sentences),
`scripts/word-space-lab/build-sentences.mjs`, the generator gate in `gemini-di-sentence-reading.ts`, `diGenerators.ts` (passes `grade`,
`remediationFocus`), the `wordSpace` stamp type in `diSentenceReadingDomain.ts`, contract R6. Probe: `run-probe.sh`, `before.txt`, `after.txt`.

## Before

The tier already chose the sentence length (the L4 band: easy 3-4 words, medium 5-6, hard 7-8, narrowed by grade and by "short" or
"simple" in the objective). But the 52-sentence hand menu meant:
- run 1 and run 2 of a tier gave the same four sentences in every mode;
- "Letter-Sound Group 1: s, a, t, i, p, n" served "The red hen ran", "The pig can dig", "The dog is hot" (r, e, h, d, g, o untaught):
  the menu held no sentence a group-1 reader could decode.

## What changed

- **A sentence bank, drafted once at build time.** For 13 scopes (letter groups 1-4, each short vowel, mixed CVC, CVC + sight, K and
  grade 1 sight words), Gemini was given only the words the scope allows and asked for sentences at three lengths. Code kept a sentence
  only if every word passes the same check the lesson runs, and dropped "fat" said of a person and hitting a person. 752 kept.
- **The check, per word:** a VC or CVC word whose letter-sound pairs are all taught (one letter per sound at K; the pack's catalog
  rules out blends and digraphs), a tricky word the mode allows, or a name spelled with taught letters. A short-a lesson binds every
  content word and name to short a; a letter-group lesson's sentence uses one of the group's new letter-sounds. No commas.
- **The pick:** the tier keeps its L4 band (other code depends on it); inside the band the draw is random, and no two sentences open
  on the same content word while another is left. No model call on this path.

## After (real items from `after.txt`)

| Mode | Easy | Medium | Hard |
|---|---|---|---|
| decodable, short a (K) | Dan had a map · Sam had a hat · Pat sat at it | Nan had ham in a pan · His cat sat in a bag | Tad sat in the van to nap · Nat had a nap in a tan cap |
| decodable, s a t i p n (K) | Nap in it · Sit at it · I tap a pan | Pat sat in the pan · Nan sat at the tap | Pip sat in it at the tap · Nan sat in the pan at the tap |
| sight_phrase (K) | Where is Dan · Do you want jam | We want to see him · Make the bed for me now | I saw one yellow bug hop away · Did you see who got in the box |
| read_sentence (G1, "simple": ceiling 5) | The rat hid · Max is in bed | Four men were wet · Can you open his box | Ken fed the hen · Rex ran to Dad |
| review (G1, "short": ceiling 5) | Ted fed his dog · Dad got a van | Give it to him · The fox ran away | Max hid in mud · Ben can get the bus |

Both runs of every tier now differ. Group 1 is repetitive (11 decodable words: tap, pan, sit, nap…); that is the scope, not the picker.

## Verification

- `sentenceSpaces.test.ts`: every sentence of 9 spaces builds an askable item inside its ceiling; tiers rank by beta; the scope rules
  (no untaught letter in group 1, a new letter in group 2, no other vowel or name in short a, sight sentences hold two sight words, no
  "Yes" or "my turn"); 20 seeds x 3 tiers x 9 spaces fill 6 distinct sentences in the band, each with a model sentence card (R2).
- The existing structural suite (L4 bands, ceilings, stress across mode x tier x grade) passes. Two of its assertions named menu ids
  ("deterministically the one 8-word pure-a entry", which held only because the menu was tiny); they now assert the requirement they
  protected (the L4 menu additions reach the space; a review anchor is a long short-a sentence).
- wordSpace, direct-instruction primitive and generator suites: 1213 pass. Full tsc: 770, the same as before this slice, none in touched
  files. `typecheck:lumina`: only the 4 errors in another session's untracked `skipFractionDivision.test.ts`.
- Not done: a browser check in the DI tester per tier. No Live run: the response class (a printed 3-8 word sentence) is the benched one.

## Follow-up (2026-10-15, user asked)

- **K easy and medium drew the same sentences.** The K bands (ceiling 6) overlap: easy 3-4, medium 4-5, hard 5-6. Each tier now
  targets the one length no other tier holds (`bandTarget`: easy 3, medium 5, hard 6), and uses the overlap only to fill. Grade 1's
  bands do not overlap and get no target. Test: K easy and medium share no sentence over 10 seeds x 3 scopes.
- **Awkward sentences.** A build-time sense check (`build-sentences.mjs --judge`, gemini-flash at temperature 0) read every bank
  sentence once and dropped 172 as odd, awkward or unsafe, each logged with its reason in `judge-drops.json` so a person can
  overrule it. "Pat sat on Dan", "The hog is not as hot" and "Four men had to fix the dull ax" are among them. It leans strict
  ("A mad fox ran to get the hen" was dropped as scary). New drafts are judged before they enter the bank.
- **Short o was thin.** Re-drafted the five short vowels with judging: short o 24 -> 30 in the space, bank 755 sentences.
- Still thin: group 1 holds 25 sentences and few of 6 words, so its medium and hard overlap.

## For the user to rule on

1. **The bank is live without a person's review.** Code checks every word and a model judge checks sense; neither is a person. Keep
   it live, or gate it on a review page like the word ratings? `judge-drops.json` is the list to skim for wrongful drops.
2. **Group 1 sentences are repetitive** (11 words). Accept, or keep letter-group sentence lessons from group 2 on?

## Verdicts (0b)

| Mode | Verdict |
|---|---|
| decodable_sentence | needed a space: scope leaked, no variety. Built. |
| read_sentence | needed a space: no variety. Built. |
| sight_phrase_sentence | needed a space: one fixed set per tier. Built. |
| sentence_review | needed a space: one fixed set per tier. Built (cumulative, two scoped anchors). |
