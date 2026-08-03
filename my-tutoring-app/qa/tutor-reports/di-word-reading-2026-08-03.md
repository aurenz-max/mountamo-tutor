# di-word-reading — L2 tutoring scaffold (2026-08-03)

**Layer: L0 → L2 (tutored).** `/add-tutoring-scaffold` on the last DI-family
pack whose tutoring block was still script-local. Executed from
`qa/HANDOFF-di-word-reading-L2-2026-08-01.md`. Like both sibling L2s, this is a
*relocation plus focusing*, not a new scaffold: `DI_WORD_READING_TUTORING` moved
out of `diWordReadingScript.ts` into `catalog/di.ts` `tutoring:`, so both connect
paths (standalone fallback + lesson auth/`switch_primitive`) resolve it from the
single source of truth. **The whole DI family is now catalog-resolved.**

The cue lines and the per-item judging contract in `diWordReadingScript.ts` are
**untouched, byte for byte** — the bench-proven wording is the pedagogy.

## What changed

| File | Change |
|---|---|
| `service/manifest/catalog/di.ts` | di-word-reading gains `tutoring:` — the moved block + `{{challengeType}}`, `contextKeys`, 5 `commonStruggles`, and one new clause on the WORD READING directive (all new at this layer). Separately: the entry's `constraints` gained silent-e/long-vowel steering — see the 14g slice below |
| `direct-instruction/diWordReadingScript.ts` | `DI_WORD_READING_TUTORING` deleted (+ its now-unused `TutoringScaffold` import); replaced by the siblings' pointer comment. Cue lines, `judgingContract`, `correctionLine` **untouched** |
| `direct-instruction/DiWordReading.tsx` | drops the local `tutoring:` connect arg (catalog resolves it); data bag grows `challengeType` / `word` / `wordType` / `words`; new `updateContext` effect keeps RUNTIME STATE truthful as words advance |
| `service/direct-instruction/gemini-di-word-reading.ts` | attaches the flat `words` summary, so RUNTIME STATE is populated from the **first auth-time prompt**, before the component's live sync takes over — same as letter-sounds' `letters` and sentence-reading's `sentences` |

## Scaffold content added at this layer

### contextKeys — `['challengeType', 'word', 'wordType', 'words']`

**Answer-in-state follows the SENTENCE precedent, not math's.** di-math-facts
withholds `answerWord`/`solvedDisplay` because RUNTIME STATE is echoed far more
loosely than a scripted line. That reasoning does not transfer: the printed word
is simultaneously the stimulus and the target — the tutor must have it to model
it, and the child is already looking at it — so there is no answer side to
withhold, and `word` sits in RUNTIME STATE legitimately.

`wordType` earns its place because it names the branch that matters: a decodable
word is BLENDED, an irregular sight word is recalled whole and must **never** be
sounded out. It is also the diagnostic split the component already treats as
load-bearing (`challengeSummaryFor` — a CVC miss is a blending failure, a sight
miss is a recall failure), and the split the pack's queued eval-mode ladder
(`cvc_reading` / `sight_word`) runs along. Both probe branches resolve it
correctly (`cvc` / `sight`).

**The handoff's fifth candidate — `graphemes` / the sound-out blend — was
deliberately dropped, and this is the one place the slice departs from the
handoff.** Three reasons, in order of weight:

1. It is **absent on every sight word** (a sight word has no graphemes), and an
   absent key renders the literal string `(not set)` into the tutor's prompt.
   The sight-word probe would have shipped that break.
2. It is **derived, not generated**. The Tier-2 probe resolves contextKeys against
   the generator's flattened output only (`route.ts:105-118`), so a
   component-computed value reports `unresolved` and renders `(not set)` in the
   probe preview — which is exactly what the first probe run showed before the
   key was dropped. Making it resolve would have meant duplicating
   `soundOutFor`'s derivation into generated data, i.e. a second source for the
   blend that can drift from `GRAPHEME_SOUNDS`.
3. It buys nothing: **the `[DI_ITEM]` cue already carries the blend verbatim**
   for the item in flight ("I'll sound it out: sss-aaa-mmm… sam"). RUNTIME STATE
   is the ambient frame, not a second copy of the script.

### `words` — and why the directive gained a clause

`words` is the sibling packs' flat item-set summary (`sentences` / `letters` /
`facts`). Unlike those, it interacts with this pack's own answer-leak rule: the
list names words the child **has not read yet**, and the pack's catalog
constraint is explicit — *"The printed word is the answer: no pictures or audio
pre-cues before the child reads."*

The L0 LIVE-JUDGED directive covers the adjacent case ("the application decides
which word comes next; never introduce one yourself") but nothing told the tutor
that the word list it can now see is not speakable. So the WORD READING
directive gained **one sentence** (the math-facts precedent for a bounded
directive delta at L2 — everything else is byte-identical):

> The practice word list in your runtime state is background only: the child must
> READ each word off the screen, so never say a word aloud before the quoted
> lesson text for that word asks you to, and never preview a word that is still
> coming.

It is a prohibition, not a permission, so it does not widen the tutor's licence
to speak.

### 5 commonStruggles — observed classes only

| Struggle | Where it comes from |
|---|---|
| Reads a close-sounding DIFFERENT word (matt/mat, son/sun, read/red) | the pack's signature error class — the near-neighbour over-affirmation stress that bench gate **#41 deferred into #43** when the pre-build bench was waived; the same pairs the L0 judging contract is written strict against |
| Spells the word with letter NAMES ("see-ay-tee") | the letter-NAME-instead-of-sound class di-letter-sounds observed, in its word-reading form |
| Sounds out but stops before saying it fast | the judging contract's own second failure branch ("a sound-out that never ends in the whole word") |
| Sounds it out slowly, then says the whole word correctly | **protective** — the contract counts this CORRECT ("straight through, or sounded out and then said fast"), and an over-strict tutor punishing audible blending is the live risk in the other direction. Mirrors di-sentence-reading's self-correction / slow-but-accurate pair |
| Stays silent after "Your turn. What word?" | family-wide; both siblings carry it |

Five is the sentence-reading count. The **named risk of adding struggles is
loosening a scripted tutor into chattiness** — math cleared it live with 4,
sentence shipped 5. This pack's next live run is the check (below).

### scaffoldingLevels — ported unchanged, re-audited

Byte-identical to the L0 block, re-audited against the pack's pre-read rule
(the handoff's pack-specific gate: *no scaffolding copy may read the word to the
child outside the scripted flow*):

- **Level 1** repeats the PROMPT — "Your turn. What word?", which never carries
  the word — not the model line. Same finding as letter-sounds and math-facts;
  this pack does **not** have sentence-reading's problem, whose level 1 used to
  read the target aloud.
- **Levels 2-3** describe what happens AFTER an attempt: correction territory,
  which re-models at every tier by design (standing gate 3 — remediation is not
  scaffolding). The same ruling covers the word-modeling struggle responses.

This is also the audit L3 will inherit, so it is recorded in the catalog comment.

## Standing gates 2 and 3

Both re-verified on the assembled Tier-2 prompt, mechanically:

- **Gate 2 (sentinel collision) — PASS.** 37 sentences scanned across TASK,
  RUNTIME STATE, scaffolding levels, struggles, and all three directives: **zero**
  begin with "Yes" or "My turn". The engine's sentence-scoped verdict scan can
  never see a phantom opener from the new copy.
- **Gate 3 (correction opener) — PASS.** "EVERY correction re-models the word …
  and begins with 'My turn'" survives verbatim in the directive, and
  `correctionLine` (the PLAIN re-model — the contrastive port stays frozen on
  HUMAN-CHECKS #55, family rule) was not touched.

**One answer-leak lint hit, accepted and recorded:** the near-neighbour struggle
names "mat", which was in probe 1's own word list. It is unavoidable — every
legible near-neighbour pair uses a menu word as its target — and it is precedented
twice over: sentence-reading ships "hen"/"pen", "hut"/"hat" (all di-word-reading
menu words), and **this pack's own L0 WORD READING directive already carried
"son"/"sun" and "read"/"red"** before this slice. The struggles section is
guidance about responses, not lines to speak, and BREVITY forbids narrating it.

## Results

### Tier 1 (static) — PASS, 0 HIGH

`status: warn`, 2 findings — the **identical pair all three siblings carry**.
They are the DI family's shape, not defects:

| Finding | Why it is structural |
|---|---|
| `data-bag-unparsed` | DI connects through `ctx.connect` + `updateContext`, not a `useLuminaAI` bag the static auditor can parse. **Resolved by the Tier-2 probes below**, which show every key populated |
| `no-sendtext-moments` | DI pedagogy rides `[DI_ITEM]` / `[DI_MOVE_ON]` / `[DI_COMPLETE]` through the judged-loop engine (`loop.sendCueNow` / `queueCue`), never `sendText`. The tutor **structurally cannot go silent** — every item is cued — so the condition this check exists to catch is unreachable here |

`contextKeys` (4) and `templateVars` (`challengeType`) both read correctly.

### Tier 2 (probe, real generated content) — PASS on 3 content shapes

All four keys resolve with real, shape-correct values on every run, and a walk of
every string in the probe section found **zero `(not set)` occurrences**:

```
short-a CVC @ G1        sight words @ K          generic @ K
  challengeType: read_word  challengeType: read_word  challengeType: read_word
  word:          sam        word:          the        word:          cat
  wordType:      cvc        wordType:      sight      wordType:      cvc
  words: sam, cat, mat, hat words: the, see, go, to   words: cat, pig, sun, the
```

The three shapes are the generator's three scope paths (code-enforced vowel
scope / sight scope / generic starter spread), so the L0 content ladder and the
L2 context are consistent with each other — the thing that breaks first if the
two layers drift. As with sentence-reading, the `(not set)` strings in the
response are confined to `staticPromptPreview`, the Tier-1 rendering that by
construction has no generated content to fill keys with.

### Gates

| Gate | Result |
|---|---|
| `npm run typecheck:lumina` | **0 errors** |
| `tsc --noEmit` (project-local, abs path) | **0 errors in every touched file** (`src/lib/*` graveyard unchanged) |
| `npm test` | **1286/1286**, 112 files |
| `/tutor-test di-word-reading` Tier 1 | **warn, 0 HIGH** — the family's two structural WARNs |
| Tier 2 × 3 | all keys resolved, no `(not set)`, no pre-read leak beyond the printed word |

## Tier 3 (live behaviour) — rides the next DI sitting

Not blocking, per the handoff. Two things want an ear:

1. **Chattiness** — 5 new struggles on a scripted tutor. Math cleared the same
   risk with 4; this is a glance, not an assumption.
2. **The never-preview clause** — the only genuinely new directive copy. It can
   only be exercised by a run that reaches item 2+, where a future word exists in
   RUNTIME STATE to be (not) previewed.

Both fold into the pack's existing live rows rather than a new gate.

---

# Second slice — the 14g word-reading verdict: **WRONG-PRIMITIVE**

Reader-fit 14g (evidence `qa/topic-traces/g1-silent-e-2026-08-01.md`) recorded
di-word-reading generating `cat, red, pig, sun` for a silent-e objective, and
filed the broken link as **GENERATOR** with fix target
`gemini-di-word-reading.ts`. Probed three ways; that target is wrong.

**Reproduced.** A CVCe-worded probe ("Read words with silent e (CVCe) like make,
ride, hope" @ G1) returned `cat, pin, dog, sun` — 14g's finding exactly.

**But the ask is out of scope, so it cannot be a FIDELITY-BUG.** The catalog
constrains this pack to short-vowel CVC words and starter sight words; the menu
contains no CVCe word and the generator cannot invent one without leaving the
benched single-word response class (birth-cert follow-up #4 is explicit: each new
word shape is a NEW spoken-response class → bench first). Serving in-scope words
instead of inventing out-of-scope ones is the **correct** degradation, so the
generator layer is HONORED-by-degradation.

**The defect is upstream, in this catalog entry's own steering.** The old
constraints excluded "digraphs, blends, or multisyllable words" — and CVCe is
none of those three. A single-syllable silent-e word therefore read as in-scope
to the manifest, which had no signal to exclude it.

**Measured, not assumed.** `manifestOnly` traces on 14g's exact topic
("Decode words featuring the silent e pattern to produce long vowel sounds" @
Grade 1):

| | di-word-reading picked |
|---|---|
| before the fix | **2 / 3 runs** |
| after the fix | **0 / 3 runs** |

Manifest selection is an LLM call, so 0/3 is a signal rather than a proof — but
the mechanism is now explicit rather than inferred: the constraints name silent-e
/ magic-e / long-vowel as out of scope, state that the pack falls back to
short-vowel CVC if routed anyway, and point at phonics-blender (`cvce_blend`),
cvc-speller, and decodable-reader — the three primitives 14g's own trace shows
handling CVCe correctly.

**Contract check — the steering did not ablate legitimate routing** (an edit for
one skill must not break what earlier skills depend on):

| Topic | di-word-reading picked |
|---|---|
| "Decode and read aloud short a CVC words" @ G1 | **3 / 3** |
| "Read high-frequency sight words on sight" @ K | **2 / 2** |

Both of the pack's real homes still route to it.

**Not done here:** the `di-math-facts counting_next` 1–120 half of 14g is a
separate item and stays queued. No generator code was touched for 14g.
