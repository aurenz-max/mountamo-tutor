# DI bench — sentence-reading probe (2026-07-25)

**Standing gate 1 for the 4th DI pack (`di-sentence-reading`). User mic sitting,
`Sentence reading` probe set, 10 items, 3→8 words. Verdict: PASS — "this worked
so well!"**

All 10 items completed. 13 anchored verdicts: **10 affirmed, 3 corrected, 0
off-script, 0 unanchored.** Raw (trimmed) export:
`run-2026-07-25-sentence-reading-probe.json`.

| | |
|---|---|
| affirmed / corrected / off-script | 10 / 3 / **0** |
| unanchored verdicts (DI-1) | **0** |
| alias agree / disagree | 11 / 2 (both explained — finding 2) |
| mean response (tutor-fall → transcript) | 3815ms |
| mean commit lag | 2745ms |
| turns over tutor audio | 1 (a real barge-in, judged correctly) |

## The gate question (a): can Live catch a ONE-WORD error in a 5-8 word utterance? **YES — 2/2.**

This was make-or-break, and the sitting drove it deliberately twice:

| Item | Read as | Verdict |
|---|---|---|
| "I can see the **big** pig." (6 words) | "I can see the pig." — `big` dropped | **corrected** ✅ |
| "The **red** hen ran to the pen." (7 words) | "The hen ran to the pen." — `red` dropped | **corrected** ✅ |

Both were single-word OMISSIONS — the hardest class to hear, because nothing
wrong is said, something merely isn't. Both were caught, and both retries were
affirmed. **The pack is viable in this shape.** A judge that rubber-stamped
these would have killed it.

No length ceiling appeared in 3-8 words: the longest item (8 words, "The big pig
had a red hat on.") read clean and affirmed on the first attempt.

## The gate question (b): is whole-sentence correction enough? **YES — ship it, skip word-targeting.**

The safe scripted form ran live twice:

> "My turn: I can see the big pig. Your turn. Read it again."

Both times the learner **self-repaired the missing word on the first retry**
(n=146, n=183). The DISTAR ideal — naming the missed word — would have bought
nothing here, and it costs real risk: the tutor would have to fill a variable
the script cannot know, which is a direct threat to "speak exactly" and the
sentinel discipline. **Decision: the pack ships the whole-sentence correction.**
That closes the open design question with evidence rather than preference.

## The gate question (c): does the restating affirm drag? **No — and it is not the bottleneck.**

"Yes, that says <whole sentence>" costs ~2-3s. But the per-item cycle is
~15-17s, and the dominant term is **learner think-time: 8-11s** between the
tutor's "Read it." and the first voice frame (cue ends 5166ms → mic opens
13768ms on item 1; 98055 → 107126 on item 5). Tutor talk-time is not what makes
a sentence item long — the child reading is. Keep the restatement; it models the
correct reading at the exact moment it is most useful.

---

## Finding 2 (SHIP-BLOCKING for the pack, cheap fix): a read sentence splits into TWO voice turns

**Three "attempt superseded before the verdict" events** — new to this response
class, and the most important engineering result of the sitting.

`silenceCloseMs: 500` is tuned for one-word answers. A child reading connected
text **pauses mid-sentence**, so one read produces two turns:

| Item | Turn 1 | Turn 2 |
|---|---|---|
| "Sam sat on the mat." | "Sam Saad" | " on Matt" |
| (retry) | "Sam sat" | " on the mat." |
| "We go up and we go down." | 0.7s fragment | 1.7s fragment, 2.4s later |

Consequences, all observed:
1. **The alias cross-check fails** — each fragment is matched alone, so a
   correct read scores `aliasMatch: false`. **Both** alias disagreements in this
   run are this, not judge error (n=90 affirmed a correct read with
   `aliasMatch: false`).
2. **Timing data is lost** — the second fragment carries `responseMs: null`;
   13 of 16 attempts were timed.
3. **Attempt anchoring gets fragile** — it survived here because Live judges the
   AUDIO (it heard the whole sentence either way), but the bench is binding
   verdicts to the last fragment by luck of ordering, not by design.

**Fix (one line, pack-level):** `useJudgedSpeechLoop` already accepts
`voice: { config }` → `VoiceTurnConfig.silenceCloseMs`. `di-sentence-reading`
should pass ~1100ms. A mid-sentence pause is part of the response, not the end
of it. Do NOT change the family default — 500ms is correct for the three
short-response packs.

## Finding 4 (needs the human's memory, not more data): one ambiguous affirm

Item 1, "The cat sat." — the transcript read **"the car"** and Live
**affirmed** (`aliasMatch: false`). Two readings, and the log cannot separate
them: either the sitting read it correctly and ASR mangled it (Live judges audio,
so the affirm was right), or it was a genuine false affirm on the shortest item.

The 0.85s turn length is consistent with a fast correct read. Given 2/2 on the
deliberate errors, the ASR-artifact reading is more likely — but **only the
person in the chair knows what they said.** If it was a false affirm, the
short-item end of the ladder needs its own stress before the pack locks.

## Finding 5 (minor, family-wide): unscripted opening greeting

The first tutor turn was *"It's great to see you! Let's practice some reading
together."* before the scripted "Listen:". Warm and harmless, but it is not in
the script, and `offScript: 0` did not catch it — that counter classifies
VERDICTS, not fidelity. The same leak is almost certainly present in the three
shipped packs. Not a blocker; worth a `scoreFidelity` glance at the opening turn
some time.

## Carried into `/primitive`

1. `silenceCloseMs` ≈ 1100 for sentence items (finding 2) — **do this first**;
   without it the pack ships with a broken alias cross-check and lossy timing.
2. Whole-sentence correction is SETTLED (b) — do not re-litigate word-targeting.
3. Keep the restating affirm (c).
4. Scope confirmed at 3-8 words; no ceiling found. Longer text is unbenched.
5. Resolve finding 4 before locking the short end of the ladder.
