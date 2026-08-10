# HANDOFF — DI modality → literacy primitives (rev 4, 2026-08-09)

**Queue of record:** `qa/di/BACKLOG.md` **item 16**. **Board:** `WORKSTREAMS.md` ACTIVE 1.
**Doctrine:** `src/components/lumina/docs/SPOKEN_INTERACTION_DOCTRINE.md`.
**Worked examples — read all three diffs before porting anything, because the thing that
varies between them is the thing you have to decide:**
`PhonicsBlender.tsx` + `phonicsBlenderScript.ts` (port 1, model IS the answer),
`SoundSwap.tsx` + `soundSwapScript.ts` (port 2, model must NOT be the answer), and
`WordFlip.tsx` + `wordFlipScript.ts` (port 3, the RULE is modeled on a different noun).
Shared: `phonemeVoice.ts`, and the `phonics-blender` / `sound-swap` / `word-flip` entries in
`catalog/literacy.ts`.

> **Rev 3 → rev 4: three ports have shipped, one has been driven live, and residual SWAP-1
> is closed in all three.** The frame in §1 is unchanged and is not re-litigable. What
> changed: the census (§2, re-measured after port 3), the procedure's step 1 (§3 — three
> cue shapes now, and the opener rule from SWAP-1), the residual ledger (§4), the next port
> and the argument for pausing before it (§5), and the state (§6).
> **Rev 1 was deleted.** It proposed bucketing the 31 primitives ROUTE / CONVERT / **LEAVE**,
> where LEAVE meant "the interaction is manipulative, so exempt it". The user rejected that
> outright: *"this misses the forest for the trees… if the existing primitive asks the
> student to click the mic, then answer, the existing primitive is wrong."* Do not
> re-derive rev 1's buckets.

---

## 1. The frame (unchanged — do not re-litigate)

**Every literacy primitive should run a tutor-owned loop.** The tutor models, waits, judges
the answer, corrects contrastively, and **its own affirmation is the advance**. That is the
whole modality. A fixed `setTimeout` rushes the slow child and holds back the fast one, and
no value of `AUTO_ADVANCE_MS` fixes both.

The per-primitive question is **not** *whether* to port. It is only:

1. **What is the skill actually made of?** If the skill is verbal — blending, naming a
   sound, saying a rhyme, reading a word, producing a plural — the answer is **spoken**. If
   it genuinely lives in the hands — sorting into categories, composing a sentence from
   parts — the answer is a **gesture**, and the engine supports that too (§4).
2. **Does a DI pack already serve this skill better?** An ordinary portfolio question,
   answered on merit, **never** as a reason to leave a broken primitive shipping. Routing
   around a defect preserves it.

### The two rulings, verbatim

> *"if the existing primitive asks the student to click the mic, then answer, the existing
> primitive is wrong. these instructions will result in worse pedagogy."*

> *"the exercise should be purely verbal using the DI capability, not a combination of
> clicking on tiles and speaking."*

### The pedagogical test

**Can a child who cannot do the skill still perform this action correctly?** Arranging
`c a t` tiles is *sequencing*; picking `/b/` from three sound buttons is *recognition*;
tapping "dogs" from three chips is *reading*. A child who cannot blend, cannot manipulate
phonemes, and cannot form a plural can do all three. That is a costume, not the skill.
Delete it.

**Port 2 sharpened this:** the costume is often *under* the defects, not next to them.
sound-swap had both census defects (a 1400ms stopwatch AND a push-to-talk mic) — and
removing them would still have left a task where the SCREEN computed the answer.

### ✅ The gates — both checkable, run them before claiming a port is done

```bash
# 1. Nothing on screen may carry the child forward.
grep -nE 'setTimeout\([^;]*(ext|dvance)|AUTO_ADVANCE|useSpokenWordCapture|action="next"|action="check"' <Primitive>.tsx

# 2. Nothing may name the answer before the child gives it.
#    Read the render path AND the option/chip lists — a chip that prints the answer is a
#    leak even when a pre-reader cannot read it, because Grade 1 can.
```
Gate 1 must return nothing.

---

## 2. Census — re-measured by grep 2026-08-09, AFTER port 3

31 literacy primitives. **Two axes.**

| | count | primitives |
|---|---|---|
| **tutor-driven (DI judged loop)** | **3** | `phonics-blender` ✅ · `sound-swap` ✅ · `word-flip` ✅ |
| **stopwatch** (`setTimeout(next, …)` / `AUTO_ADVANCE_MS`) | 5 | `cvc-speller`, `letter-sound-link`, `rhyme-studio`, `picture-vocabulary`, `phoneme-explorer` |
| **click to advance** | 3 | `interactive-book`, `word-workout`, `story-talk` |
| no voice at all | 20 | the remainder |

**Push-to-talk (`useSpokenWordCapture`) — 4 left**, unchanged by port 3 (word-flip was
already open-mic): `cvc-speller`, `interactive-book`, `letter-sound-link`, `rhyme-studio`.
That already violates the standing open-mic ruling, independently of this lane.

Reproduce with:
```bash
grep -ohE "useSpokenWordCapture|useVoiceAnswer|useVoiceChoice|useVoiceCapture|useJudgedSpeechLoop" <primitive>.tsx
grep -cE 'setTimeout\(\(\) =>[^;]*(ext|dvance)|AUTO_ADVANCE' <primitive>.tsx
```

---

## 3. THE PORT PROCEDURE — extracted from TWO ports, follow it in order

**Step 0 — contract check.** `/primitive-contract <id> --check` if
`docs/contracts/<id>.md` exists. Expect conflicts: contracts written in the click-driven era
pin buttons by name. **Do not fork around them** — re-base the requirement onto what it
actually protected and record the conflict + ruling in the contract's Conflicts section.
phonics-blender C3/C4 are the worked example. *(Neither `sound-swap` nor `word-flip` has a
contract file, so this step is a no-op for them.)*

**Step 1 — write the script** (`<primitive>Script.ts`, next to the component). Hand-authored,
DISTAR. It owns the cue, the in-band judging contract, the correction wording, the move-on
and complete cues. **This is where all the variance between ports lives — copy the SHAPE,
never the wording.** Three ports have produced three cue shapes; treat the bullets below as
questions to answer, not a template to fill.

- **Ask first: is the model the answer, or not?** In phonics-blender the model IS the answer
  (blending is reproduction, so `Listen: /k/ … /a/ … /t/ … cat. Your turn. What word?` is a
  real test). In sound-swap it must NOT be (the answer is a word the child builds, so the
  cue models only the STIMULUS and the move is modeled in the CORRECTION). In word-flip a
  THIRD answer: the RULE is modeled, on a noun the session never asks about
  (`pickModelNoun`), and the answer is withheld — a rule shown on a different word is
  taught rather than given away. **A template that hard-coded port 1's cue would have
  shipped the answer inside the ask on the other two.**
- **Then ask: can the stimulus itself answer your hand-over?** The family's
  `Your turn. What word?` is not portable. After word-flip's `Now there are three` a child
  can say `dog`, name the picture, and be technically right — so the ask ends
  `Your turn. Three what?`, which has exactly one correct English completion. This is the
  same ruling as sound-swap's dead `nameTargetSound`, reached from the other direction:
  **an ambiguous ask is not a harder task, it is a broken one.**
- **The OPENING cue gets ONE job: speak this.** Do not put a "greet them / tell them how to
  play in kid words" directive in the catalog and a scripted line in the same turn — that
  is residual SWAP-1, and live it produced a spoken bracket tag plus an improvised ask, so
  item 1 ran without its model. Put the how-to-play in the quoted line
  (`HOW_TO_PLAY` + `itemCue(item, { opening, howToPlay })`) and let the catalog only forbid
  adding to it. Band-gate it if it is a PROTOCOL statement readers can see on screen
  (ports 1-2, Grade K only); do not band-gate it if it is the DI MODEL (port 3, everybody).
- Affirm opens `"Yes, …"`, correction opens `"My turn: …"` — **and nothing else may open
  with either** (standing gate 2). Classic DISTAR's `"My turn."` model opener is forbidden;
  open the model with `"Listen:"`.
- Every correction re-models then re-elicits (standing gate 3).
- **Keep the spoken ask short.** sound-swap's is three beats — stimulus, move, "What word?".
  A scaffold beat that reads as noise in the ear is worse than no scaffold (§4).
- **The judging contract must name what counts as an answer AND what looks like one but
  isn't.** That second list is the pedagogy, and it is per-skill:
  blending → "the separate sounds with no word at the end" is unfinished;
  phoneme manipulation → **"the starting word said back unchanged"** is the signature error,
  and it is fluent, confident and completely unchanged, so it is the one most likely to be
  wrongly affirmed;
  plurals → the bare singular, and the over-regularized form ("dogses").
- **Every phoneme in a spoken line goes through `phonemeVoice`** (§4).

**Step 2 — rewrite the component.** Whole-file replacement, not incremental edits.
`useLuminaAIContext` + `useJudgedSpeechLoop`, one attempt per item, progression driven only
by `applyVerdict`. Copy the skeleton from either port: `prepareLive` → `startRun` →
`sendCueNow(opening)` + `arm()`, then `handleEmission` switch, then `queueCue(next)` on
affirm. Cap corrections (2) then `moveOnCue`. **This half is genuinely reusable** — port 2's
component is port 1's with the nouns changed.

**Step 3 — the catalog entry** (`catalog/literacy.ts`). Four things, all mandatory:
- `audioInput: { manual_activity: true }` — our amplitude detector brackets each learner
  turn. Gemini's own VAD is unusable for short spoken answers (bench run-3 ruling).
- **Trim `contextKeys` to exactly what the component pushes** through `updateContext`, and
  make sure every one is ALSO in the connect-time `primitive_data` (catalog `{{key}}`s
  resolve server-side at connect/switch). An unpushed key renders the literal string
  `(not set)` into the prompt and the tutor reads it aloud as content. Port 1 went 9 → 4,
  port 2 went 12 → 4. Verify with:
  `awk '/id: .<id>./,/supportsEvaluation/' catalog/literacy.ts | grep -o '{{[a-zA-Z]*}}' | sort -u`
- **Rewrite `description` and `constraints` too.** They are manifest-visible steering: a
  description that still says "tap the tiles" will route this primitive at the wrong
  objectives forever.
- Rewrite `tutoring` to the DI frame: sentinel discipline, a WAIT directive (the tutor must
  be told that silence is the child working), a directive naming what counts as an answer,
  the pre-reader how-to-play, and the pronunciation channel. **Re-check sentinel collisions
  across every line you write.**

**Step 4 — tests.** Split them the way the DI family does:
- **Script tests (pure, real):** cue wording, sentinel discipline, the judging contract's
  branches, and anything the tier is supposed to change. This is where the pedagogy lives.
- **Render tests (jsdom):** band gate, answer-leak absence, no advance buttons, tap-to-hear,
  and **dead levers asserted dead** rather than quietly ignored.
- **Do not try to drive the live loop in jsdom.** It cannot be done honestly and a green
  test that never fired the path is worse than no test.
- Revert-bite anything load-bearing. Both ports did; both bit.

**Step 5 — gates.** `npm run typecheck:lumina` (0) · `cd my-tutoring-app &&
./node_modules/.bin/tsc --noEmit` (zero NEW vs baseline **803**) · full vitest · both §1
greps · **then a mic sitting**, which is the only thing that verifies a loop.

---

## 4. What the live run changed (2026-08-09, session `a964bccc5ca2`)

**A voice cannot say `/æ/`.** The shipped sound-swap ask walked the starting word sound by
sound — `Listen: an. /æ/ … /n/. Add /p/…` — and the user's report was: *"she does sound
funny during that part, i think not necessary — the 'an… Add /p/' works great and the
student can clearly hear the instructions, but the gibberish comes across as a
distraction."*

**Two rulings came out of that, and they generalize:**

1. **The walk is DELETED, not made sayable.** The first fix attempted was to render the walk
   in speakable spellings. That was the wrong instinct: the walk was a scaffold *around* an
   instruction that was already clear, so the cheaper and better move was to remove it.
   **When a scaffold reads as noise, delete the scaffold — do not improve its diction.**
   Note the cost, honestly: this killed sound-swap's last axis-1 tier lever, so its
   within-mode difficulty now rides entirely on the structural axis (where the sound sits)
   plus two on-screen perception levers. That is an acceptable outcome, not a gap.

2. **`phonemeVoice.ts` is the display→voice boundary, and every port must use it.** The
   screen keeps what the generator wrote (`/æ/`); the voice gets di-letter-sounds' own
   spellings (`aaa`). Two rules: **non-Latin glyphs map** (`/ʃ/`→"shh", `/θ/`→"th");
   **ASCII passes through untouched** (`/k/`, `/p/` read correctly live, and rewriting `/j/`
   would mean guessing whether a generation meant "yes" or "jump"). Where a phoneme can be
   dropped, `speakableWalk` returns null and the caller drops it — **the failure mode of an
   unknown glyph is less scaffold, never gibberish in a five-year-old's ear.** This applies
   to **tap-to-hear on every port**, which is the channel nobody had driven.

**✅ Proven live:** the tutor-owned clock (9 item cues, `superseded: 0`, `wedged: false`,
every advance an affirmation), the answer never leaking into the ask, the pre-reader
how-to-play arriving by voice — and **DI-1's best evidence yet**: the ASR transcript read
**"sept"** and the tutor affirmed **"Yes, sit."** It judged the audio in-band and was right
where the transcript was wrong. *Word-matching is the reporting channel, not the judge.*

**TEMPLATE RESIDUALS — one closed, one open.**

- **DI-GREET-1 — ⚠️ THE REAL ROOT OF SWAP-1, found live 2026-08-10 (word-flip,
  `5269fc87d6da`), fixed the same day, NOT yet re-driven.** `lumina_tutor.py` queues
  *"Greet the student warmly…"* with `end_of_turn=True` on **every fresh connect**, so
  Gemini takes a turn the instant the socket opens — and a DI pack's first cue arrives
  seconds later, because the client is still waiting on the microphone. Measured: greeting
  **0.8s → 15.7s**, scripted opener sent **16.4s**. The improvised turn ended with the
  tutor's OWN question; the child answered that, it barged in 1.2s into the scripted line,
  and item 1 ran with **no question at all** — only the model half was spoken.
  **The lesson generalizes beyond this lane: a prompt-level fix cannot close a
  transport-level defect.** SWAP-1 was read as a prompt problem for two runs because the
  symptom (improvised opener) is what a prompt problem looks like.
  **Fix:** `owns_opening` on the connect payload →
  `should_queue_greeting(owns_opening, resumption_handle)`, set by all eight packs that
  script their opener. Extracted as a module-level predicate on purpose: the inline `if`
  was untestable, which is part of why this survived two live runs. Ordinary surfaces
  (`curator-brief` et al.) still greet, and one of the four new backend units exists only
  to pin that.
- **SWAP-1 — ✅ FIXED 2026-08-09 in all three ports; correct, but only HALF the mechanism —
  see DI-GREET-1 above.** The opener spoke its own bracket tag and then improvised the ask: greeting →
  how-to-play → **`[DI_SWAP_ITEM]`** → *"Now, let's try one. Start with 'at'. Add /k/ to the
  beginning. What word?"* — not the scripted line — reaching *"Listen: at."* only after a
  barge-in, so item 1 ran without its model. **The anti-echo warning was already in the
  opening cue and it did not hold, because the warning was never the problem:** the catalog
  was asking one turn to do two jobs — compose a how-to-play, then recite a scripted line —
  and the model did the first and improvised the second. The fix deletes the composing job
  rather than strengthening the warning: how-to-play is now TEXT INSIDE the quoted line in
  all three scripts, and the catalog directive is retitled *"THE OPENING LINE ALREADY SAYS
  HOW TO PLAY"* and only forbids adding to it. **Not yet heard live** — it ships into #82 /
  #83 / #84, and #84 criterion (f) is written for it.
- **SWAP-2 — still OPEN, low severity.** An off-task utterance drew off-script chatter:
  *"I'm going to go to the store."* → *"Alright, have fun and games!"* **Progression was NOT
  corrupted** (no sentinel → no verdict → no correction counted → next item went out; the
  `no-verdict` path behaving exactly as designed, observed live). The defect is only that
  the script says *speak nothing beyond these exact lines* and it chatted. Deliberately not
  fixed alongside SWAP-1: SWAP-1 had a structural cause and this one is a compliance nudge,
  and adding prompt text to suppress chatter is worth doing once, after the mic sitting says
  whether it still happens with a one-job opener.

**The gesture anchor still has ZERO production callers, its deletion clock has EXPIRED, and
the ruling is KEEP.** `LoopAttempt.source` + `gesture-close` + `submitGestureAttempt` are
tested (5 reducer cases, revert-bitten) and unused, because all three ports were verbal.
Rev 2 said "if the next two ports are also verbal, propose deleting it" — that is now 2 of
2, and **the clock was measuring the wrong thing.** Every customer is queued and unported
(`cvc-speller`'s `spell_word` Elkonin boxes, `syllable-clapper`, `word-sorter`,
`sentence-builder`, `story-map`), so the count reflects port ORDER, not demand — and port 4
is the customer. **The one non-obvious rule when you use it:** the cue is sent **before**
the attempt opens — `schedulePendingCue` refuses to send while an attempt is open, so an
attempt opened at commit time would block the very cue meant to provoke its verdict.
`submitGestureAttempt` handles the ordering; don't hand-roll it.

---

## 5. NEXT — the mic first, then `cvc-speller`

**⚠️ THE HONEST RECOMMENDATION IS TO PAUSE PORTING AND DRIVE THE MIC.** Three ports are
shipped; the correction branch of the template has never been heard (§6). Port 4 is the
biggest and riskiest one left, and porting the hard case on top of an unverified template is
the mistake this lane has already named twice. One sitting — #82 → #83 → #84 — costs less
than a fourth port and can invalidate a wording decision that is now copied three times.

**When porting resumes, take `cvc-speller` (port 4).** `fill_vowel` is spoken; `spell_word`
(Elkonin boxes) is a genuine placement and **the gesture anchor's first real customer**, so
it is also what ends that open question. It still has a push-to-talk mic and 7 advance
affordances. **Letter NAMES must not become the answer** (blocked class — bench first).

**✅ PORT 3 DONE — `word-flip`.** What it added to the procedure, beyond another data point:

1. **The costume and the leak were the SAME OBJECT.** Ports 1-2 each had a costume *under*
   their defects; here one deletion closed both gates. The three chips (*"the answer, the
   bare singular, and the over-regularized form"*) made the task READING — a child who
   cannot form a plural taps "dogs" correctly every time — **and** printed the answer on
   screen. The catalog defended them by noting a pre-reader cannot read them; **Grade 1
   can**, i.e. a band gate was doing the work a leak gate should have been doing. Worth
   checking for on every remaining port: *is the on-screen support net also the answer key?*
2. **A third cue shape** — the RULE is modeled on a noun the session never asks about
   (`pickModelNoun`), and the answer is withheld. See §3 step 1.
3. **The hand-over is part of the pedagogy, not boilerplate** — `Your turn. What word?` is
   ambiguous after `Now there are three`, so the ask ends `Your turn. Three what?`. See §3.
4. **Its standing residual is ASR-shaped, not class-shaped.** The answer differs from the
   stimulus by one word-final /s/ or /z/, which transcripts drop routinely — which is
   exactly why the tutor judges the AUDIO. #84 (c) watches transcript vs verdict on purpose:
   a "dog"-transcript with a *"Yes, dogs."* verdict is the strongest DI-1 evidence available.

| primitive | shape | notes |
|---|---|---|
| **`cvc-speller`** ⬅ | **mixed** | **recommended next port.** Encoding, not decoding. `spell_word` = the gesture anchor's first customer. Letter names BLOCKED. |
| `phoneme-explorer` | verbal | `blend` mode is phonics-blender's twin; `isolate` overlaps `di-letter-sounds` — **portfolio question first**. |
| `story-talk` | verbal | answer is one pictured noun — closed set. No timer today; only a click. Listening comprehension. |
| `picture-vocabulary` | verbal | `useVoiceAnswer` + stopwatch. Naming is open-set — pictures bound it. |
| `word-workout` | verbal | `real_vs_nonsense` is a spoken judgement; `sentence_reading` overlaps `di-sentence-reading` — check the boundary. |
| `rhyme-studio` | verbal | recognition is closed-set; **production is open-set → needs a bench sitting** before wiring. PTT today. |
| `interactive-book` | verbal | reading glowing words aloud; PTT today. |
| `syllable-clapper` | **gesture** | the clap IS the response and is embodied. The count (1–4) is a benched number-word class if you want it spoken. |
| `word-sorter`, `sentence-builder`, `story-map` | **gesture** | what the gesture anchor was built for. |
| `letter-sound-link` | portfolio | receptive discrimination vs `di-letter-sounds`' production; it also covers stop consonants and the phoneme→grapheme direction. Decide before porting. |
| `letter-spotter` | **BLOCKED** | letter NAMES are an unbenched homophonic class. Bench in Voice Studio first. |
| `decodable-reader`, `read-aloud-studio` | **BLOCKED** | passage-length fluency has no judge; `di-sentence-reading` tops out at 8 words. |
| the 20 writing/analysis primitives (G2–6) | later | typing/highlighting/composing. Same frame; the pre-reader payoff is here first. |

**`/add-di-loop` is now extractable, and narrower than rev 2 assumed.** Steps 0/2/3/5 are
mechanical and reusable — port 3's component really is port 2's with the nouns changed.
**Step 1 is not**, and three ports have now produced three different cue shapes, because
whether the model may contain the answer is a per-skill question. The skill should carry the
component skeleton, the catalog checklist, the gates, the scripted-opener rule (SWAP-1), and
a *checklist of questions* for the script — not a cue template. **Write it after the mic
sitting**, so it ships a verified template rather than an assumed one.

---

## 6. State — what is proven, and what is not

**All three ports are SHIPPED and machine-green.** typecheck:lumina **0** · full `tsc`
**803 = baseline** · vitest **199 files / 2568 passing** · both §1 greps clean on all three
components · template keys resolve 4/4, 4/4, 3/3.
*(The full-suite run exits nonzero on a pre-existing unhandled `canvas-confetti` rAF error
from `SolarSystemExplorer.eval-loop.test.tsx`; it passes in isolation and is unrelated to
this lane. Filed on the board, not here.)*

**⚠️ THE CORRECTION BRANCH HAS NEVER BEEN HEARD, ACROSS THREE PORTS AND TWO LIVE RUNS.**
This is the single most important line in this document. #83 ran 9/9 first try; #84 ran 5/5
first try; #82 has never been driven. **Every affirmation observed so far is compatible with
both a discriminating judge and a permissive one** — including DI-1's two best wins
(`'trunks'`→*"Yes, trucks."*, `'Herz'`→*"Yes, hats."*), which is uncomfortable but true.
A drive that answers everything correctly does not advance these rows. **The next sitting
must answer deliberately WRONG at least twice per row** — ~90 seconds each.

- **#82 (phonics-blender) — OPEN, never driven.** That the tutor waits, affirms a sound-out
  that lands on the word, and refuses a near neighbour (`cap` for `cat`) is unproven.
- **#83 (sound-swap) — OPEN, HALF-DRIVEN.** The live run was clean, but **all 9 items were
  `addition` and all 9 were correct on the first attempt, so no correction ever fired.**
  Affirmations being affirmed cannot distinguish a discriminating judge from a permissive
  one — the exact trap #63 fell into. Next drive: a **deletion or substitution** lesson,
  answering **deliberately wrong** (say the starting word back; say a near neighbour).
- **#84 (word-flip) — OPEN, HALF-DRIVEN (2026-08-10, `5269fc87d6da`).** 5/5 first try in
  1m24s: (c), (d), (e) met, no leak, tutor-owned clock clean. **(a) and (b) untouched** —
  nothing wrong was ever said. **(f) FAILED and produced DI-GREET-1**; the fix has landed
  and the re-drive is the check for it.

**All three are one sitting, in order.** If any fails on judging, it is a WORDING fix in the
corresponding `*Script.ts` — and it is now copied three times, which is the cost of having
kept porting. **The recommendation in §5 is to drive the mic before port 4.**

**Tree — uncommitted.** This lane: `judgedLoopModel.ts` + test, `useJudgedSpeechLoop.ts`,
`diRunLog.ts` + test, `PhonicsBlender.tsx`, `phonicsBlenderScript.ts`, `SoundSwap.tsx`,
`soundSwapScript.ts`, `WordFlip.tsx`, `wordFlipScript.ts`, `phonemeVoice.ts`, seven test
files, `catalog/literacy.ts`, `gemini-sound-swap.ts`, `gemini-word-flip.ts`,
`docs/contracts/phonics-blender.md`.
**⚠ Still orphaned, ~2 days:** `scaffoldAudit.ts` + `interpolateTemplate.ts` — needs a
commit-or-revert ruling, not a slice.
**⚠ Concurrent session:** `gemini-letter-spotter.ts` + `.live.test.ts` are not ours.

---

## 7. Doctrine that must survive every port

Open mic over turn windows · the mic is never gated on tutor-busy signals · the tutor is
quiet by default (frame once, silent per round) · cue on the FIRST audio frame ·
no visible timers · Live judges the AUDIO in-band, word-matching is the reporting channel
not the judge · **nothing names the answer before the child gives it** — including a chip, an
option button, or a picture · **nothing enters a spoken line that a voice cannot say.**
