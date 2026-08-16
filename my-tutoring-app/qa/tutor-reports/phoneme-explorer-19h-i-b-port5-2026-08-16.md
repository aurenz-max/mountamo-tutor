# phoneme-explorer joins the judged-loop harness — 19h-i-b, port 5 of 11 (2026-08-16)

**Queue:** `qa/di/BACKLOG.md` item **19h-i-b**. 18d rode inside this slice.
**Handoff followed:** `qa/HANDOFF-19h-i-b-adapter-sweep-2026-08-16b.md`.
**State after this slice: 5 of 11 done.** `counting-board` · `addition-subtraction-scene` ·
`push-pull-arena` · `picture-vocabulary` · **`phoneme-explorer` (this slice)**.

**Verdict: 10 live sessions, 0 HIGH, 0 findings on 9 of 10.** The tenth carried a single
`di-off-script-ask` WARN that did NOT reproduce on re-drive (1 of 2, below the ≥2/3 bar).

---

## 1. The drive budget: 1 cap contract shape, so 9 sessions, not 10

Per §1 of the handoff, cap drills are counted per **contract shape**, not per mode.
`moveOnCue` on this port is mode-invariant: one line (`"Good try! Here comes the next
one."`), one `judgingContract`, no close line, no per-mode correction, and — unlike
picture-vocabulary — **no tap fork at all**, because all four modes are voice. Four modes
collapse to **one** cap shape.

Every mode produces voice items, so the cap drill was genuinely drivable and nothing here
is gate-covered-only. Budget: 4 × (plain + signature) + 1 cap = **9**, the low end of the
handoff's 9–10 estimate. One extra blend-signature re-drive brings the session count to 10.

| Drill | isolate | blend | segment | manipulate |
|---|---|---|---|---|
| plain | PASS 5/5 | PASS 4/4 | PASS 5/5 | PASS 5/5 |
| signature | PASS 4/4 | PASS 5/5 (+1 re-drive PASS) | PASS 5/5 | PASS 5/5 |
| cap (1 shape) | — | PASS 3/3 `My turn:`, no `di-no-verdict` | — | — |

---

## 2. ⭐ The census said this entry had ONE bad rung. It had TWO, plus a third the rung census cannot see.

The handoff's corrected census listed `phoneme-explorer` at **1**. Regenerating it per
rung (as §2 instructs) found **2**, and reading `commonStruggles` found a third instance:

| Location | Was | Why it is 18d |
|---|---|---|
| `scaffoldingLevels.level1` | *"Say the question once more, then wait for them alone."* | counted by the census |
| `scaffoldingLevels.level2` | *"Say the sounds again, slowly and clearly, then wait."* | **missed** — on `blend` the sounds ARE the ask |
| `commonStruggles` letter-name row | *"say the sound once more, then ask again for the word"* | **invisible to a rung census** — a letter name is an ATTEMPT, so a verdict is owed |

**The lesson for the remaining ports: a fingerprint census undercounts wherever a port
names its own stimulus.** The family's rungs were caught by matching *"Say the question
once more"*; this port says *"Say the sounds again"* and `sound-swap` says *"Say the
starting word once more"* — same defect, different vocabulary. Census by MEANING (does
this reply to an attempt owe a verdict and not give one?), not by phrase.

All three are rewritten to route through the scripted correction, plus `TWO_BRANCH_LAW`
in the judging contract. **Verified live** by the cap drill: 3/3 corrections opened
`My turn:` and the model did *not* swap in the ladder on the 2nd or 3rd wrong answer —
which is exactly what counting-board and ASS did before their fix.

The full regenerated census is in §7 for whoever takes ports 6–11.

---

## 3. The port itself

The adapter is **12 lines** — no gesture commit, all-voice, so it is the smallest in the
sweep. Everything else below is a defect the port already had.

- Exported `phonemeExplorerPackBase(items)` and `phonemeExplorerHarnessAnswers(item)`;
  the component now spreads the surface and keeps only `statusLines` /
  `diagnosisObservation`. The di-script suite's hand-rolled pack literal is gone —
  it was the fifth port in a row carrying that drift.
- Registered in `DI_PORTS`.
- `NEVER_PERFORM` on `itemCue` / `moveOnCue` / `pronounceCue` / `hearWordCue` /
  `hearSoundCue` (this port has two extra tap-to-hear cue channels, so it gets the tail
  in five places rather than three).

**§4a, §4c: clean.** `contextFor` is question-side in all four modes and the component
was already bound to `items` throughout — including `phaseResultsFromSummary`, which was
port 4's worst positional trap. This port has had a build gate since birth, so the
bindings never had a chance to desync. **First port in the sweep clean on both.**

---

## 4. Four defects found, all in the port, none in the adapter

### (a) ⭐ `isolate` shipped a ONE-ITEM lesson about a Bear, whatever the topic

`maxOutputTokens` was 4096. `isolate` is by far the widest payload in the family — 5
challenges × (4 scalar fields + 4 choices × 3 fields) — and it was running out
mid-object. The failure is **silent and graded as success**: a truncated body fails
`JSON.parse`, the mode returns `[]`, every pool is empty, and `buildFallbackChallenge`
ships a single hardcoded item (`"Bear" / Ball, Cat, Dog, Sun`) under the title
`"Sound Safari: farm animals"`.

Measured across probe draws of `isolate`, same prompt, same grade:

| | before | after |
|---|---|---|
| items of 5 | 0, 0, 3, 5, 0 | 5, 4, 4 |
| fallback shipped | 3 of 5 draws | 0 of 3 |

Two fixes, both from the flash-lite truncation template this generator had only half of:
`maxOutputTokens` → **8192**, and a **retry-once** when a mode's pool comes back empty.
The arrays were already bounded, so those were the two missing legs.

*The one to carry forward: the other three modes were unaffected at 5/5 the whole time,
because they carry no `choices` array. A per-mode fan-out means a token ceiling can be
fatal for one mode and invisible for the rest — and the mode it kills is the one with the
richest schema, which is usually the flagship.*

### (b) ⭐ `blend` asked children to blend `/c/ … ooo … /w/` and expected "cow"

`segment`'s prompt has always carried a sounds-not-letters clause with a worked
counterexample. `blend`'s never did — and blend is the mode where it matters *more*,
because **the walk IS the ask**: segment only loses a correction scaffold, blend loses the
question. The probe returned `["c","o","w"]` for "cow" and `["d","u","c"]` for "duck", so
the tutor was speaking a sequence that does not blend to the answer.

Closed on both sides of the wire:
- **Prompt:** blend gets segment's clause, plus an explicit ban on `c`/`q`/`x`.
- **Code:** `c`, `q` and `x` are now unsayable phoneme tokens. Each stands for a sound it
  does not name (/k/ or /s/, /kw/, /ks/), so there is no single thing a voice can say for
  it. phonemeVoice passes them through because they are ASCII — correct for a glyph on
  *screen*, wrong for one that is *spoken* — so the rule lives in this module, which is
  the one that decides what is said. blend items drop; segment corrections degrade to
  naming the count, which is its documented failure mode.

Then the drop rate said the real cause was one level up. The gate was firing on **the same
slot every draw** — the model reliably *chose* "cow" for a farm topic and then spelled it:

| | drop rate on `blend` |
|---|---|
| after the sounds-not-letters clause | 4 of 20 (1–2 per draw, always the same position) |
| after also steering the WORD CHOICE away from c/q/x | **0 of 15** |

*Steering the spelling only fixed it some of the time; steering the word fixed it. The
symptom was in the phoneme array, the channel was in the vocabulary.*

### (c) `isolate`'s spoken sound label could hand over a card

`phonemeSound` is free text (`"buh"`, `"sss"`, `"mmm"`) and it is the **first thing the ask
says aloud**. A model that writes the mnemonic instead of the sound — `"mmm, as in moon"` —
gives away a card before the menu is read, and if it is the correct card the item answers
itself. Nothing upstream forbade it: the schema only *describes* the field, and every other
isolate gate looks at the menu. Now gated at build.

### (d) ⭐ §4d — the session invariant, and the one place the flat rule was WRONG

The generator fans out **one call per mode in parallel** — four prompts that never see each
other's words, all handed the same topic and (at K) the same worked list. Cross-mode word
collisions are the expected output of that architecture, not a bad draw. A `segment` item
asking *"how many sounds in sheep?"* before a `blend` item whose sounds make "sheep" turns
blending into recall. **Neither item is wrong alone**, so it cannot be a per-item gate; it
lives in `itemsFromChallenges`, the only boundary that sees the session — and the boundary
the DI runner reads, so it also covers hand-authored and cached payloads.

**The flat version of this rule was too strong, and the probe caught it.** First pass gated
every mode on "was this word heard earlier". A farm-animal `isolate` draw reuses ten words
across five menus and twenty card slots, so overlap is the norm — it was deleting real
items. The correct rule distinguishes **producing** an answer from **selecting** one:

- `blend` / `manipulate` build the word from nothing → a word the session already spoke
  hands it over → gate.
- `isolate` picks from four cards visible at the moment of the ask → having met "duck"
  before says nothing about which card starts with /d/ → **exempt as a recipient**, though
  it still *contributes* to the heard pool, because its cards are printed and read aloud.
- `segment` answers a count, so a repeat is arithmetic, not a leaked word → exempt, with a
  revert-bite test: gating it would delete every CVC item after the first, and K's
  guidelines specify CVC only.

---

## 5. What was driven, and what a green run does not buy

10 real Gemini Live sessions. `--di` holds the SEMANTIC half — refusal, affirmation, leak,
sentinel, correction shape, cue compliance. It says nothing about acoustics, ASR, mic
transport, VAD or the audio tail, because the student's turn crosses as TEXT.

**No mic row filed.** This port introduces no new answer material: `short_spoken_word` and
`number_word_to_20` are both benched and both proven on earlier ports. It is, however, the
first port to mix two response classes in one session, which the leak oracle held across.

The signature wrongs that mattered, all refused:

| Mode | Signature wrong | Why it is the sharp one |
|---|---|---|
| `isolate` | the tutor's own **example word** | genuinely starts with the target sound and was spoken seconds earlier, so a judge grading the rule it just stated affirms it — refused 4/4 |
| `blend` | the **separate sounds**, no word | carries every phoneme of the answer without landing on it — refused 5/5 |
| `segment` | a count running **one past** the total | the accept clause allows a count that ENDS on the answer, so this speaks it mid-stream — refused 5/5 |
| `manipulate` | the **original word** unchanged | fluent, confident, the catalog's own named signature error — refused 5/5 |

---

## 6. Open items

| Finding | Home | State |
|---|---|---|
| `di-off-script-ask` @ ask:c5 | — | **NOT a defect.** Single WARN, did not reproduce on re-drive (1 of 2). Audio was full length (394k b64 over 11.6s) while the transcript captured only the opening clause — the transcript is a spectator channel. |
| 18c pair on the cap drill | **18c** | Expected; these contracts deliberately command the verbatim repeat. Not re-filed. |
| `di-verdict-embellished` tail hypothesis | **19h-i-c** | Another **strong** data point: **0 of 45 affirm beats embellished** across 9 sessions, carrying `NEVER_PERFORM` from the start of this slice. Standing: ten-frame 5/7 (weak tail), counting-board 3/7 then 5/7 (weak), ASS 0/14, push-pull-arena 0/16, picture-vocabulary 0/74, **phoneme-explorer 0/45**. The owed cheap experiment is unchanged: one counting-board `count` re-drive over text is the direct before/after. |
| `segment` answers cluster on "three" at K | **queued, generator** | K guidelines specify CVC only, so 4 of 5 items answer "three" and a child can score 5/5 by saying it every time. Real, but it is a **curriculum** call about K segmentation, not a build gate — dropping duplicates would leave one item. Executor: `/add-eval-modes` or a K word-band decision. |
| `isolate` example word can be a prefix of its answer | **observation** | Probe drew *"puh, like Pig"* with "Piglet" as the answer. Inherent to having an example that shares the target sound; the child still does the phoneme work. Noted, not gated. |

---

## 7. ⭐ Regenerated 18d census for ports 6–11 — census by MEANING, not by phrase

Run per RUNG, live lines only, comments excluded. **This differs from the handoff's table**,
which matched one phrase; every entry below was re-read.

| Entry | rungs to fix | note |
|---|---|---|
| `decodable-reader` | 2 | level1 + level2, both *"Say the instruction once more"* |
| `letter-spotter` | 2 | level1 + level2 |
| `letter-sound-link` | 2 | level1 + level2 |
| `read-aloud-studio` | 2 | level1 + level2 |
| `sound-swap` | **1** | *"Say the starting word once more"* — **not in the handoff's table** |
| `cvc-speller` | **1** | *"Say the word once more"* — **not in the handoff's table** |
| `word-flip` | **1** | *"Say the one-thing word once more"* — **not in the handoff's table** |
| ~~`phoneme-explorer`~~ | fixed (this slice, 2 rungs + 1 struggle row) | |
| ~~`picture-vocabulary`~~ · ~~`interactive-book`~~ | fixed (port 4) | |

Also check `commonStruggles` on every entry: the letter-name row here was a fourth
instance no rung census reaches. **The "goes quiet" rows are NOT instances** — silence is
not an attempt, so no verdict is owed.

`astronomy.ts: planetary-explorer` level3 matches the fingerprint too, but it is not a
judged-loop port; left alone.

---

## 8. Gates

| Gate | Result |
|---|---|
| `./node_modules/.bin/tsc --noEmit -p tsconfig.json` | **803** = HEAD baseline, 0 new, 0 in any touched file |
| `npm run typecheck:lumina` | 0 |
| `npx vitest run` | **3363 pass / 4 skipped / 0 fail** (was 3346; +17 tests) |
| probe `.probe.diPlan` | `droppedChallenges` explained and driven to 0; `packGateIssues` empty on every draw |
| `--di` plain + signature per mode, cap per contract shape | 9 drives + 1 re-drive, **0 HIGH** |
| revert-bite | every new gate has a test that fails without it |

## 9. Files

`literacy/phonemeExplorerScript.ts` (cue surface + harness answers + `TWO_BRANCH_LAW` +
`NEVER_PERFORM` + the isolate sound gate + the c/q/x rule + the session gate) ·
`literacy/PhonemeExplorer.tsx` (spreads the surface) ·
`service/qa/di/diDrivePlan.ts` (adapter + registration) ·
`service/literacy/gemini-phoneme-explorer.ts` (8192 + retry + blend prompt) ·
`catalog/literacy.ts` (3 rungs + 1 struggle row) ·
`__tests__/PhonemeExplorer.di-script.test.ts` (rebased onto the exported surface, +17).
