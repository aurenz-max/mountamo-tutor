# 19h-i-b port 8 — `decodable-reader` joins the judged-loop harness (2026-08-16)

**Adapter: 8 lines.** Everything else was a defect the port already had — the eighth
port in a row where that sentence is true, and this time one of them was the port's
own cardinal sin.

---

## What shipped

- `decodableReaderScript.ts` exports `decodableReaderPackBase` +
  `itemsFromChallenges` + `decodableReaderHarnessAnswers` (+ `storyLeadInSpan`,
  `contentWordsOf`, `optionSayable`, `answerKeyOf`). The component spreads the
  surface and keeps only `statusLines` / `diagnosisObservation`. Registered in
  `DI_PORTS`.
- The di-script suite's hand-rolled pack literal is gone — **the eighth port to
  carry that drift.**
- `TWO_BRANCH_LAW` (family-verbatim) + `NEVER_PERFORM` (item 21's tail) on every
  cue, plus one clause this port had to write for itself (§4 below).
- **ALL-VOICE, five modes, three kinds of answer.** Nothing taps: the 2026-08-13
  ruling took the buttons out and the suite now revert-bites a `gesture` item.

### Two capabilities the port needed and the family gets

| | Why |
|---|---|
| `leakExemptSpan` accepts a **list** | First pack with TWO legitimate spans in one ask: a read-along choice question reads the whole story aloud AND names every card, with the QUESTION between them. One contiguous span would swallow the question — exactly where a tutor giving the answer away would do it. A bare string still works; no earlier port changed. |
| `--di-cap-item <id>` | **Closes half of §7's standing row.** `--di-cap` hangs off the first VOICE item, which in every decode mode is a read line, so the only move-on that NAMES the answer was unreachable. Voice items only; a gesture id raises with what would be needed instead. |

---

## The drive log — 16 sessions, 13 distinct shapes

Budget was ruled per §1: plain × 5 modes + signature × 5 modes + cap per CONTRACT
SHAPE. **No modes collapsed** — all five fork somewhere. **Three cap shapes, all
three drivable** (the `--di-cap-item` flag is why), and **no blended drive**: §1's
gesture caveat and port 6's signature-no-op caveat do not apply to an all-voice
port, and port 7's how-to-play blind spot does not either — every decode mode
changes ACTION mid-session (read → question), so all three how-to-play lines are
spoken across the mode set without one.

| # | Mode | Drill | Result |
|---|---|---|---|
| 1–2 | `literal` | plain, signature | PASS |
| 3 | `sequence` | plain | **HIGH** `di-answer-leak-in-ask` → oracle fix → **WARN** ×2 embellish → fix → PASS |
| 4 | `sequence` | signature | **4× HIGH** — fabricated `[CURRENT STATE]`, reading the line aloud → fix → PASS |
| 5–8 | `inference`, `main_idea` | plain, signature | PASS |
| 9–10 | `read_along` | plain, signature | PASS |
| 11 | cap — `read_line` move-on | `--di-cap` | PASS (+ known 18c pair) |
| 12 | cap — `answer_spoken` move-on | `--di-cap` on read_along | PASS (+ known 18c pair) |
| 13 | cap — `answer_choice` move-on | **`--di-cap-item q-1`** | PASS (+ known 18c) |
| 14–15 | `literal` | plain, signature | re-driven post-fix, PASS |

**0 HIGH outstanding.** Every refusal and every affirmation landed as scripted on
every post-fix session.

---

## 1. ⭐ THE WORST ONE: the tutor read the printed line aloud before the child did

Caught by the read-line leak oracle on its second outing, on three consecutive
asks of the `sequence` signature drive:

> `[CURRENT STATE]: The stimulus reading text on screen now is: "His frog can hop on a rug"`

Spoken. Out loud. Before the child decoded a word of it. That is the whole
measurement gone — the child echoes instead of reading — and it is precisely what
the catalog's `NEVER READ A LINE THE CHILD HAS NOT READ YET` directive exists to
forbid.

**The mechanism is this port's alone, and it is invisible on every other pack.** A
non-opening read ask is *"Your turn. Read it."* — four words that name nothing,
BY DESIGN, because the cold read is the mode. Hand a model a near-empty line and a
state block containing the sentence, and it fills the silence from the state
block. The catalog's own `taskDescription` was the invitation in as many words:
*"that thing … **reads**: {{stimulus}}"*.

**Closed at the channel, not the symptom.** A read item no longer sends its line
at all: `stimulusFor` now describes the item (*"a 6-word line of the story …
deliberately withheld from you"*) and the judging contract still quotes the exact
line, which is where the tutor genuinely needs it — at the moment it judges. The
`taskDescription` no longer asserts that whatever arrives is the text.

**`NEVER_PERFORM` was already present and did not prevent it.** That is worth
recording for item 21: a rule against narrating the state loses to a state block
that is the only content in the room.

## 2. ⭐ The leak oracle fired on a leak that had not happened — and the fix made it sharper

`di-answer-leak-in-ask` on *"What did the frog hop on first?"* against the card
"The frog did hop on a stem": **"hop"** is a distinctive word of that card and is
also how the question is asked.

Subtracting the words the QUESTION says narrows the tokens to `["stem"]` — the
actual answer, and the only word a tutor could give away. Third application of the
same rule in this port (the spoken signature skips question words; the choice
signature skips them; now the choice leak tokens do too), and the only one found
live rather than in a probe.

## 3. ⭐ 19h-i-c: the first port with the extended tail that embellished anyway

Standing evidence was one-directional — ASS 0/14, push-pull 0/16,
picture-vocabulary 0/74, letter-sound-link 0/42, all carrying the tail.
**decodable-reader embellished 2 of 7 affirm beats WITH the tail**, and both
embellishments end somewhere `TWO_BRANCH_LAW` does not reach:

> *"…Do you want to read another line?"* · *"…What kind of story would you like to read about next?"*

That is not praise. It is the tutor handing the FLOOR back, and it lands where the
model feels a phase closing. **This pack has real phase boundaries inside one run**
— the passage ends and the questions begin — so it offers two natural wrap-up
moments per session that a single-shape pack never does. And a question the tutor
asks is withdrawn by the next cue a moment later: 18c(b) arriving through a
different door.

Fixed with `NO_FLOOR_HANDBACK`, stated **separately** from the family tail so a
grep still finds `NEVER_PERFORM` byte-identical across all eight ports. **0 of 9
affirm beats embellished on the re-drive and 0 across every post-fix session.**

## 4. The session invariant, and the half of port 7's rule that does NOT transfer

**A. The tutor may not name the same answer twice.** Every comprehension item
closes by SAYING its answer ("Yes, mat."), so a second question with the same
answer measures recall of the tutor's own last sentence. A live risk, not a
theoretical one: a K passage is 2–3 sentences and the generator is asked for two
questions about it. A duplicate LINE goes with it — the read affirmation restates
the sentence, so a second printing of it is an echo, not a decode.

**B. An already-named answer is KEPT as a later distractor.** Port 7 had to bar
that and it does not transfer: a distractor that is a true story detail already
named is exactly what the generator is *told* to build for inference/main-idea,
and a child who picks it has made the intended error, not a free one. A later
answer WORD is not spent either — the whole story is in the room by design, since
the child read every sentence aloud or the tutor read it aloud. **What an earlier
item spends is a whole ANSWER the tutor named AS the answer, nothing less.**
Gating more would starve a two-question draw for nothing (port 7's pool ran dry
doing exactly that).

## 5. Content defects the probe and the drives read out

| Defect | Fix | State |
|---|---|---|
| **Ungrammatical printed lines** — *"They have a fish in tank"*, *"They went on a trip to park"*, *"His frog can hop on rug"*. The child reads the line EXACTLY as printed and a fluent reader who says "in **the** tank" is marked WRONG for reading English. | Prompt, three concrete WRONG/RIGHT pairs | **Reduced, not eliminated** — see residual |
| Adult metalanguage in K/G1 questions — *"Who is at home with **the speaker**?"*, *"What **action** do they like to do?"* | Prompt: concrete words only, never talk ABOUT the text | Fixed |
| Option text no five-year-old could say back — *"Various cute pets enjoying their day at home"* | Prompt + `optionSayable` code gate at the benched ceiling, both sides of the wire | Fixed (the gate did not catch this draw; the prompt did — the card was exactly 8 words) |
| Signature wrong came out a preposition (`"with"`, then `"have"`, then `"would"`) | Draw from the passage's CONTENT words — the `sight` phonics tag the generator already produces IS the function-word list — and skip words the question said | Fixed; now `"cats"` for *"What animal is in the tank?"* |
| Signature read said *"A pets are at home"*, which no child says | Skip an article before a plural, take the next candidate | Fixed |

## 6. Clean on the standing classes

- **§4(a) answer in the state block** — clean now by construction, and §1 above is
  the strongest version of that class the sweep has seen: the answer was not
  *pushed* as a key, it was the stimulus itself, legitimately, until the audio
  channel made it a leak.
- **§4(c) positional bindings** — clean. Every display was already bound to
  `items`, including `phaseResultsFromSummary`.
- **§4(e) agreement in a verdict line** — clean; no generated value sits in a
  frame that requires it.

---

## Residual — QUEUED, not fixed

1. **Article-dropping survives the prompt.** Measured across this slice: ~1 line
   in 4 before the prompt fix, ~1 in 9 after (still fired on drive 1's *"hop on
   rug"*). It manufactures a **false refusal on a fluent reader**, which is the
   worst direction for this primitive to fail in. Not code-gated deliberately: a
   grammar check needs a hand-written idiom list ("at home", "in bed", "on top")
   and a mass-noun list, which is §4(f)'s two-half-maps trap, and a false positive
   silently shortens the passage. **Executor: `/eval-fix` on
   `gemini-decodable-reader` — the lever is a model or a validate-and-redraw pass,
   not another prompt sentence.**
2. **`--di-cap-item` covers VOICE items only.** §7's row is now *half* closed
   from the other side: a cap whose payload is a tap contract was reachable from
   port 6, and a cap on a named VOICE item is reachable now. Still open: a cap on
   a GESTURE item, which needs the drill to replay `gestureVerdict.wrong` N times.
   The harness raises with that sentence rather than degrading.
3. **The 18d accept-side class is much wider than two rows.** A census across
   every catalog entry (not just DI ones) finds ~12 more `commonStruggles`
   responses of the form *"That is a correct answer — affirm it"* with no scripted
   line handed over, in `di.ts`, `literacy.ts` and elsewhere. Only
   `decodable-reader` (2 rows + 1 aiDirective) and `read-aloud-studio` (2 rungs +
   1 row, fixed off-queue and WHOLE so no later census reads a partial fix as a
   complete one) were closed here. **Gate-covered, not driven, on
   read-aloud-studio — port 9 drives it.** Executor for the rest: `/add-di-loop`
   per port, or one 18d sweep.

## Gates

| Gate | Result |
|---|---|
| `tsc --noEmit -p tsconfig.json` | **803 = HEAD baseline**, 0 new, **0 in any touched file** |
| `npm run typecheck:lumina` | **0** |
| `npx vitest run` | **3536 pass / 4 skipped / 0 fail** (port suite 70/70, +21) |
| probe `.probe.diPlan` | 0 dropped, 0 gate issues on every post-fix draw, all five modes |
| `--di` plain + signature × 5 modes, cap × 3 contract shapes | 16 sessions, **0 HIGH outstanding** |
| revert-bite | every new gate bites (stimulus, floor-handback, leak tokens, invariant, sayability, swap) |
