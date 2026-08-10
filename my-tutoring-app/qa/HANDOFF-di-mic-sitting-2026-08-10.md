# MIC SITTING — DI literacy ports 1-4 (2026-08-10)

**One sitting, four primitives, ~15 minutes.** Full criteria live in `qa/HUMAN-CHECKS.md`
rows **#82 / #83 / #84 / #85**; this is the card to hold while driving. Route every result to
`qa/di/BACKLOG.md` item 16.

> **Updated by `/pm` 2026-08-10 (evening): the sitting has grown two rows this card does not
> cover.** `counting-board` (**#86**) and `push-pull-arena` (**#87**) shipped on the new
> judged-script runner after this card was written — same rules (scripted opener first, no
> greeting; **answer wrong on purpose**), ~2 minutes each; criteria live in their
> HUMAN-CHECKS rows. Route those two to `qa/di/BACKLOG.md` **item 16 (the dated
> generalized-runner block)**. If time is short, #82–#85 still come first — they verify the
> template the runner extracted.

> **Updated 2026-08-10: port 4 `cvc-speller` shipped and is section 4 below.** It is the
> only one with a **non-spoken** answer channel (Elkonin boxes), so it is also the first
> live look at the judged loop's gesture path — see §4b. Drive #82-#84 first: they are
> 90 seconds each and they verify the template #85 copies.

---

## ⚠️ THE ONE INSTRUCTION THAT MATTERS: ANSWER WRONG ON PURPOSE

> **✅ UPDATE 2026-08-10 — THE CORRECTION BRANCH HAS NOW FIRED, on cvc-speller's `spell_word`
> (#85 sitting B: dog 2 attempts, bug 3 then capped and moved on).** So the judge is
> discriminating rather than permissive, and the correction wording + the move-on cap are
> observed working. **That was the BUILD judge.** The SPOKEN judge — the one #82/#83/#84 and
> #85 sitting A all run on — is a different contract and is still unproven. Everything below
> stands.

Four ports have shipped and **the two spoken-mode live runs produced zero corrections** —
sound-swap went 9/9 first try, word-flip went 5/5 first try. Every affirmation those runs
produced is equally consistent with a discriminating judge and with a permissive one that
says "Yes" to anything. **A run where you answer everything correctly does not advance these
rows.** The same spoken judging shape is now copied four times, which is what makes this
cheap to fix now and expensive later.

Each row below names the exact wrong thing to say. Say it clearly and confidently — the
whole point is that these errors *sound* like answers.

---

## Before each run — the first 10 seconds (DI-GREET-1 check)

This is new since the last drive and applies to **all three** primitives.

**The first thing you should hear is the scripted line. No greeting before it.**

| primitive | first words you should hear |
|---|---|
| phonics-blender | *"Tap a letter to hear its sound. Then say the whole word out loud! Listen: …"* |
| sound-swap | *"I'll say a word and one sound to change. You say the new word out loud! Listen: …"* |
| word-flip | *"One \<noun\>, two \<noun\>s — when there is more than one, you say the new word. Listen: one …"* |
| cvc-speller (spoken) | *"We are listening for the sound in the middle of a word. I say a word, and you say just the middle sound out loud! Listen: …"* |
| cvc-speller (spell it) | *"I say a word, and you put a letter in each box for the sounds you hear! Listen: …"* |

❌ **If you hear "Hi there! I'm so excited to…" first, DI-GREET-1 has regressed.**
Until 2026-08-10 the backend queued *"Greet the student warmly…"* on every connect, which
took a 15-second improvised turn before the scripted opener existed. On word-flip it ended
with the tutor asking **its own question**, the child answered that, and the answer barged
in over the real ask — item 1 ran with no question at all.

**Also watch, on word-flip only:** the noun in the opening model (*"One hat, two hats"*)
must **not** be a noun the session later asks about.

---

## 1 · #82 — phonics-blender · NEVER DRIVEN

Grade-K phonics/CVC lesson, mic on.

| say this | expected |
|---|---|
| *"cuh — a — tuh … cat"* (sound it out, then say it) | **AFFIRMED.** Blending aloud IS the skill at this age. A correction here means the contract teaches a child their right answer was wrong. |
| **"cap"** for *cat* | **CORRECTED.** ← the one most likely to fail; over-affirmation is this response class's known failure mode. |
| say nothing for ~15s | tutor **WAITS** — no re-ask, no filling the pause, no sounding it out again. |

Also: the affirmation itself advances (no button, no fixed delay); nothing on screen shows
the word or its emoji before you say it; tapping a letter speaks the **sound**, never the word.

---

## 2 · #83 — sound-swap · HALF-DRIVEN (9/9 first try, correction never fired)

**Pick a DELETION or SUBSTITUTION lesson** — addition is the mode already exercised.

| say this | expected |
|---|---|
| **the starting word, unchanged** — *"cat"* when asked *"Listen: cat. Take away /k/. What word?"* | **CORRECTED.** ← the row exists for this. It is fluent, confident, unchanged, and it is the word the tutor just said itself. |
| **"cap"** for *"change /k/ in cat to /b/"* | **CORRECTED.** A near neighbour is a different, equally plausible manipulation. |
| a deletion answer said normally — *"at"*, *"in"*, *"up"* | **HEARD AND AFFIRMED.** These VC words are shorter than anything the bench has measured. If short answers are systematically missed, that is a bench finding, not a script fix. |

---

## 3 · #84 — word-flip · HALF-DRIVEN (5/5 first try, correction never fired)

Grade-K/1 grammar-plurals lesson. **This one is ~90 seconds.**

| say this | expected |
|---|---|
| **the singular, unchanged** — *"dog"* when asked *"Three what?"* | **CORRECTED.** ← the row exists for this. Same shape as sound-swap's starting-word-back. |
| **"dogses"** | **CORRECTED, warmly.** A real K error — the rule applied twice. Watch that the correction says the pair (*"one dog, three dogs"*) and then **re-asks**, rather than ending on the answer. |

**Already met on 2026-08-10 — no need to re-verify unless something looks off:** a phrase
answer (*"three dogs"*) is affirmed; the affirmation is the advance; no leaked plural;
and DI-1 twice (ASR read `'trunks'` → *"Yes, trucks."*, `'Herz'` → *"Yes, hats."*).

---

## 4 · #85 — cvc-speller · **4b DONE, 4a STILL OPEN** (port 4, shipped + driven 2026-08-10)

**Two short sittings, because this is the only port with two answer channels.**

> **✅ 4b is DONE — skip it unless something looks off.** Driven 2026-08-10: 5 items, 3m47s,
> cat/hen/pig first try, **dog 2 attempts, bug 3 then capped and moved on**. The gesture path
> works in production, and the correction branch fired for the first time in the lane. It also
> found a shared-engine bug (a stray word said mid-build jammed the lesson forever) — fixed, so
> if that recurs it is a regression, not a known issue. **4a below is the open half.**

### 4a · a SPOKEN mode — pick a `fill_vowel` or `word_sort` (middle-sound) lesson, Grade K

| say this | expected |
|---|---|
| **"cat"** — the whole word back, when asked for the middle sound | **CORRECTED.** ← the row exists for this. It is fluent, confident, and *exactly what the tutor just said itself*. Same shape as #83's starting-word-back and #84's bare singular, and neither has ever been heard. |
| **"ay"** — the letter NAME instead of the sound | **CORRECTED**, naming the sound rather than scolding. If the judge can't tell "ay" from "aaa" by ear, that's a bench finding, not a script fix. |
| **"aaa"** — and once as *"it's aaa"*, once held long *"aaaaa"* | **AFFIRMED**, all three. Holding a vowel is what a child does when they're sure. |
| say nothing for ~15s | tutor **WAITS** — no re-ask, no saying the sound for them. |

Also: tap **Hear It** three times — it must say the word twice and **nothing else**, never
stretching or isolating the middle sound. (Until this port, the third tap spoke the answer
outright.) The blank in `c _ t` stays empty until the tutor affirms.

### 4b · `spell_word` — the FIRST live run of the judged loop's gesture path

Nothing in the manipulation path has ever run in production. There is no Check button.

| do this | expected |
|---|---|
| fill all three boxes **correctly** | the tutor says *"Yes, sat."* **on the third letter landing** — no button, no timer. If no verdict ever comes, the gesture anchor doesn't work live, and that is the finding. |
| fill them **wrong in the middle** (`s e t` for *sat*) | **CORRECTED**, naming the sound at the middle box; the correct boxes stay, only the wrong one clears. |
| **talk while you build** ("hmm… ssss… where's the a…") | tutor stays **SILENT**, and the build still gets judged. ← the integration risk this port handled blind. |

The tutor must never name a letter, spell the word, or sound it out while you build.

---

## What to send back

The session ledger writes itself to
`backend/logs/lumina-sessions/<date>-lumina-tutor-<id>.jsonl` — **the filename is enough**,
it carries the cues, the tutor transcript, the ASR transcript, barge-ins and timings.

Say which of the three you drove and roughly what happened. If a **correction failed to
fire on a wrong answer**, that is the finding, and it is a judging-contract **wording** fix
in the matching `*Script.ts` — not a component fix — and it must land before port 4's
script copies the shape a fourth time.
