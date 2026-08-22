# HANDOFF — `picture-vocabulary`: turn `association` from a TAP into a spoken answer

**Opened:** 2026-08-19, on the close of item 24 (`open_set_word` benched + rhyme-studio pilot).
**Executor:** `/add-di-loop picture-vocabulary` (adapter exists; this is a mode conversion).
**Owning queue:** `qa/di/BACKLOG.md` — filed as item 26 (`25` collided with the science-ports item; corrected by `/pm` 2026-08-21).
**Status:** SCOPED, not started.

---

## 0. ⛔ READ THIS FIRST — item 24's §7 named the wrong mode

The `open_set_word` handoff queued this port as:

> *"`picture-vocabulary` — the tap becomes a name-it. Highest pedagogical delta: naming a
> picture aloud is the canonical vocabulary assessment."*

**`naming` is already spoken.** It has been since the port shipped: *"Look at the picture. Your
turn. What is this?"* → `answerKind: 'voice'`, `short_spoken_word`. There is no tap to convert
and no delta to collect there.

The code comment §7 was quoting — *"Association PRODUCTION would be `open_set_word` (BLOCKED) —
that is why it taps"* — sits on `responseClassFor` and refers to **`association`**. That is the
mode this handoff is about, and it is the ONLY tap in this primitive that exists because of the
block.

**Do not re-derive this. Do not "fix" naming.**

---

## 1. What taps, and why — the fork that must survive

`TAP_KINDS` has two members and they are there for **different reasons**. Only one is a
workaround.

| Mode | Why it taps | Verdict |
|---|---|---|
| `receptive_match` | *"a child without the word cannot pick the referent from four distinct pictures, so the tap is not a costume"* — it is RECEPTIVE identification, and the tap IS the skill | **LEAVE IT. Ruling, not debt.** |
| `association` | *"'what goes with sock?' is an OPEN production set spoken… `open_set_word` is a BLOCKED response class. The emoji cards CLOSE the set while the relation stays the skill"* | **THE TARGET.** The block is gone. |

The catalog says the same thing in the eval-mode description, so **both must change together**
or the manifest keeps describing a tap that no longer exists:

> *"Tapped rather than spoken: 'what goes with X' has many honest spoken answers, and an open
> answer set cannot be fairly judged — the cards close the set while the relation stays the
> skill."*

**A `receptive_match` conversion is out of scope and would be a regression.** DI is
spoken-first, but that ruling is about answers the child would naturally SAY; pointing at the
picture you heard named is page-work, and the decision rule in `judgedScriptContract.ts`
(`answerKind`) already resolves it that way.

---

## 2. ⭐ THE DESIGN PROBLEM: this is a HARDER open set than rhyme, and the guards do not transfer

This is the whole reason the handoff exists rather than a one-line "do what rhyme-studio did".

`open_set_word` cleared its bench on **rhyme**, where the rule is crisp and nearly binary:

> *does it share the rime, and is it a real word?*

A judge can be wrong about that, but it cannot **rationalise** its way to a wrong answer.
"Goes with" has no such floor. It is semantic, graded, and culture-dependent, and a
sufficiently helpful model can construct a chain to almost anything:

> *"A cat goes with a sock — cats love to play with socks!"*

That is the false-affirmation mode for this class, and it has no analogue in rhyme. **The bench
must be built to catch RATIONALISATION, not mispronunciation.**

### The guards, ported honestly

| Rhyme guard | Transfers? | Association form |
|---|---|---|
| ECHO | **yes** | "sock" said back to *"what goes with sock?"* |
| NONWORD | **yes** | invented word |
| ONSET-ONLY | **no analogue** | — |
| OFF-TASK | **yes** | "I don't know", filler |
| — | **NEW** | **RATIONALISED CHAIN** — any real word defended by an invented story. The signature failure. |
| — | **NEW** | **SAME-CATEGORY SWAP** — "shirt" for sock. Both clothes; they do not go *together*. |
| — | **NEW** | **CATEGORY WORD** — "clothes" for sock. Names the set, not a partner. |

### Three rulings the bench must settle BEFORE it can score anything

The key is worthless until these are decided, and **getting one wrong blocks the mode on our
error** — that is exactly what `zell` did on item 24 (§6).

1. **Is the relation symmetric?** The generator emits `sock/shoe` as a bidirectional pair
   (`expand*`, and `opposite`/`association` share that path). If the ask is *"what goes with
   shoe?"*, is "sock" the answer? Almost certainly yes — but the accept clause has to say so.
2. **How wide is "goes with"?** `sock → foot` and `sock → drawer` and `sock → laundry` are all
   honest answers a five-year-old could give, and **none of them is the generated partner.**
   This is the single biggest difference from rhyme: the correct answer set is genuinely large
   and genuinely fuzzy, and a clause that only accepts `shoe` fails real children.
   **Recommendation: accept any concrete, picturable thing with a plain everyday relation, and
   refuse the chain that needs a story to explain it.** Write that distinction INTO the clause;
   do not leave it to the judge's taste.
3. **Is a category word right or wrong?** *Recommendation: WRONG,* and named as its own guard —
   "clothes" names the set sock belongs to, which is the `opposite`-mode base-echo failure in a
   new coat.

---

## 3. What changes (and what must not)

### The mode fork

Follow rhyme-studio exactly: **`association` does not become a new mode — it BECOMES spoken.**
The eval-mode key, the IRT ladder and the metrics field stay put, because they measure a SKILL
and tap-versus-spoken is a change of MODALITY, not of construct. Renaming splits one ability
estimate into two half-populated ones.

- `TAP_KINDS` loses `association` (keeps `receptive_match`).
- `answerKindFor('association')` → `'voice'`; `responseClassFor` → `'open_set_word'`.
- Its `tapContract` silence branch dies; it gains a spoken `judgingContract` with the guards.
- `askFor` drops "Tap the picture that goes with…" → *"…Your turn. What goes with sock?"*
- `howToPlayFor` drops "you tap the picture that goes with it".
- `gestureVerdictCue` / `pictureVocabularyTapVerdictCue` stop being reachable for this mode —
  **check whether `receptive_match` still needs them before deleting anything.**
- The four emoji option cards stop rendering for `association`. **That is the proof it works**,
  exactly as deleting the word bank was on item 24.

### ⚠️ THE NEAR-MISS TO CHECK FOR — a gate keyed to the data you are deleting

On item 24 `holdsRhymeIntegrity` dropped any production item whose `acceptableAnswers` held no
real rhyme. Deleting that list would have made the gate drop **every** production challenge and
ship an empty activity. It was caught by reading the validator, not by a test.

**The same shape is waiting here.** `association` items carry `options` (the 4 emoji cards),
and the build gate drops *"an `opposite`/`association` with no base word"*. Before you delete
anything, read the build/validation path end to end and answer: **what does this gate do when
`options` is absent?** Then check the generator's `associationPairsSchema` and the
`expand*`/partner logic at the same time.

### Do NOT change

- The transport. `useJudgedScriptRunner` + the sentinel scan are untouched.
- `receptive_match`. See §1.
- Open-mic doctrine, the tutor's clock, `audioInput`.
- **`maxCorrections`.** It is load-bearing for open classes in a way it is not elsewhere — an
  open item has no menu bounding its wrong answers (`open_set_word` notes).

---

## 4. The bench

`open_set_word` is `benched`, so **standing gate 1 does not require a new class sitting.** It
does require that this pack's guards work, and the guards here are *new* (§2). Bench the PACK,
not the class.

**`--di-bench` already exists.** Add a `benchBuild` to `pictureVocabularyAdapter` and a fixture
beside `openSetWordBench.ts`.

**The fixture's seed is already written and hand-checked:** the generator's own curated pair
list — `sock/shoe, spoon/fork, bed/pillow, cup/plate, dog/bone, key/lock, pencil/paper,
bird/nest, toothbrush/toothpaste`. Use it. It is code-owned and was authored for exactly the
"natural, concrete, picturable, a young child knows" bar the accept clause needs.

### Buckets (≥3 stimuli, weighted toward the wrong answers)

| Bucket | Example for *"what goes with sock?"* | Expect |
|---|---|---|
| partner (generated) | shoe | AFFIRM |
| **partner (unlisted but honest)** | foot, drawer | **AFFIRM** — the §2.2 ruling, and the probe that catches a judge re-closing the set around its own pair |
| echo | sock | REFUSE |
| nonword | blen | REFUSE |
| **rationalised chain** | cat, cloud | **REFUSE** — the signature failure. Weight this bucket heaviest. |
| **same-category swap** | shirt, hat | REFUSE |
| **category word** | clothes | REFUSE |
| off-task | "I don't know", "um" | REFUSE |

**Gate: zero false affirmations in the hard REFUSE buckets.** Asymmetric, as before — a missed
honest partner costs a turn, an affirmed rationalisation teaches a child that anything goes
with anything.

### ⚠️⚠️ THE INSTRUMENT MISTAKE THAT COST ITEM 24 A VERDICT — do not repeat it

**Probe material is STIMULUS-SPECIFIC.** Three separate times on 2026-08-19 the harness was
wrong and the tutor was right, and two of the three initially read as product failures:

1. `zell` filed as a nonword (it is a **surname**) → scored as the run's only false affirmation
   → **blocked the whole class** until the user pushed back.
2. A rime-matched fallback handed an item its own target as the "correct" answer → the tutor
   correctly refused it → `di-false-refusal` filed **against the tutor**.
3. `signatureWrong` borrowed from another stimulus's echo probe → a valid answer → the tutor
   correctly affirmed it → `di-false-affirm` filed **against the tutor**.

A borrowed or careless probe **does not fail loudly** — it produces a confident, well-formatted
finding pointing at the wrong component. **Audit the key before believing any finding that
indicts the tutor.** Association is *more* exposed to this than rhyme was, because whether a
probe is a "rationalised chain" or "an honest unlisted partner" is a judgment call **you** are
making when you author it. Where you are unsure, mark it `soft` (recorded, not counted) — that
is what the bucket is for.

### Owed before this bench runs

**F3: the bench does not honor `maxCorrections`** (item 24, carried). It drove up to 8
consecutive corrections where production caps at 2, which manufactures contract decay. Fix it
first or this run's severity numbers will not mean anything.

---

## 5. ⭐ THE ECHO NEEDS ITS OWN SCRIPTED CORRECTION — item 24's most transferable finding

The single defect the rhyme pilot found live, and it will land here too.

The child says the stimulus straight back. The generic correction re-models the item — which is
a **non-sequitur** to an echo — so the tutor goes off script to say something more apt:

> *"A word does not rhyme with itself in this game."*

Right teaching, right refusal, **opens with neither sentinel**, so the engine reads NO VERDICT
and the loop goes deaf. It hit **5 of 9 items**, always on the FIRST correction.

**And removing the menu makes it likelier**, because with nothing to pick from, "say the word
back" is the cheapest wrong answer available. That reasoning transfers directly.

**The fix, ported:** a dedicated scripted echo branch, written **AHEAD** of the catch-all so the
model reaches the specific case before *"if it is wrong"*, both branches opening with `My turn`.

Consequence to carry: the general correction becomes the **last** spoken span.
`DiDriveItem.correctionLine` already takes `spans[spans.length - 1]` for this reason — that is
generic and needs no change, but a pack test asserting `spans[2]` will break, and should.

`association` may want a THIRD branch for the category word ("clothes"), on the same argument:
the generic correction does not address it, so the model will improvise.

---

## 6. Gates before this is "done"

1. `TAP_KINDS`, `answerKindFor`, `responseClassFor` updated; `receptive_match` untouched.
2. Catalog: eval-mode description, the primitive description ("Four of the six modes are
   ANSWERED ALOUD" → five), and the constraints block.
3. **The build/validation path re-read end to end** for a gate keyed to `options` (§3).
4. `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit` — zero NEW errors vs
   baseline. Project-local binary, absolute path.
5. `npm run typecheck:lumina` → 0 **on the files you touched** (there is a pre-existing WordFlip
   failure set in the tree; do not adopt it, and do not report it as yours).
6. Vitest green. `PictureVocabulary.di-script.test.ts` asserts the tap contract for
   `association` — **rewrite those assertions, do not delete them**; they become the proof it is
   spoken, exactly as item 24 inverted rhyme-studio's block assertions in both directions.
7. Bench run recorded at `qa/di-bench/`, zero false affirmations in the hard REFUSE buckets.
8. A live `--di --eval-mode association` drive AND a `--di-wrong signature` drive — the latter
   sends the echo, which is the only way to exercise the new branch in §5.
9. A HUMAN-CHECKS mic row — **re-grep for the next free ID immediately before filing**; IDs move.

---

## 7. What this unblocks next

`open_set_word` is benched, so the remaining §7 queue from item 24 is now all downhill —
`word-builder` (morphology production), `knowledge-check` slice 2b, `addition-subtraction-scene`
(full story retell), and the six proposition packs. **Queue them; do not batch them into this
port.** Pilot-then-sweep.

`association` is the right next one specifically *because* it is the hardest: a fuzzy semantic
rule is the worst case for open-set judging, and if the guards hold here they will hold for
morphology and retell.

---

## 8. Do not re-derive

- **`naming` is already spoken.** §0.
- **`receptive_match` stays a tap.** §1. It is a ruling, not debt.
- **The class is BENCHED.** Do not re-run the `open_set_word` sitting; bench this PACK's guards.
- **Names count** (`"Bill" rhymes with "hill"`) — the item-24 correction. The analogue here is
  §2.2: an honest answer you did not list is still an honest answer.
- **The tutor owns the clock. DI is spoken-first. The runner owns the stimulus gate, stillness
  window and reveal hold — DECLARE them.**
- **Never edit anything under `backend/` while a live run is in flight.** uvicorn `--reload`
  restarts and the socket dies `1012`, losing every turn already spent. It cost a 96-beat bench
  at beat 6 on 2026-08-19. The harness itself lives there, so this is easy to do by accident.
