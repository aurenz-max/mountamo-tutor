# ten-frame `subitize` — LIVE USER DRIVE, session `55166fef9a26` (2026-08-15)

**Verdict: PASS.** User: *"worked great."* 8 items, 2m24s, 90%, one item at 33% (3 attempts).
Log: `backend/logs/lumina-sessions/2026-08-15-132518-lumina-tutor-55166fef9a26.jsonl`.

This is the browser glance that 19c owed — the slice that moved the stimulus gate and the
stillness window into `useJudgedScriptRunner`, and made the reveal hold (18b). It is also, and
unplanned, **the first user drive on this port where the judge had to REFUSE.**

---

## 1. The judge — the thing four previous drives never tested

Every ten-frame drive before this one answered correctly, which is why the row stayed open for
so long. This one did not.

| Item | Child said | Tutor | Right call? |
|---|---|---|---|
| 1 | "three" | `Yes, three counters.` | ✅ affirm |
| 2 | "five" | `Yes, five counters.` | ✅ affirm |
| 3 | "four" | `Yes, four counters.` | ✅ affirm |
| **4** | **"sexo"** | **`My turn: it was seven.`** | ✅ **REFUSE** |
| **4** | **"¿Qué?"** | **`My turn: it was seven.`** | ✅ **REFUSE** |
| 4 | "seven" | `Yes, seven counters.` | ✅ affirm |
| 5 | "sechs" | `Yes, six counters.` | ✅ affirm |
| 6 | "eight" | `Yes, eight counters.` | ✅ affirm |
| 7 | "10" | `Yes, ten counters.` | ✅ affirm |

**7/7 correct affirmed, 2/2 wrong refused, and the item recovered in place** — the correction
did not cap, did not advance, and did not wedge.

**⭐ 18c(d) again, third citation, and this one is the cleanest yet.** *"sechs"* is German for
six; the answer WAS six and the tutor affirmed it correctly. *"sexo"* and *"¿Qué?"* are the ASR's
rendering of two wrong guesses. **The judge was right on 9 of 9 utterances while the transcript
was fiction on at least 3 of them.** Twenty components build misconception evidence off that
transcript. Nothing new to fix here; it is more weight on item 20.

---

## 2. What this proves about 19c specifically

**⭐ THE ADVANCE WINDOW IS 6–9 SECONDS WIDE, MEASURED.** This is the exposure `cuedItemId`
exists to cover, and it turns out to be an order of magnitude larger than "a moment":

| verdict | its audio | next item's ask actually SENT |
|---|---|---|
| `Yes, three counters.` | 7.9s | **+8.8s** |
| `Yes, five counters.` | 6.7s | +7.6s |
| `Yes, four counters.` | 6.0s | +6.9s |
| `Yes, seven counters.` | 6.6s | +7.6s |
| `Yes, six counters.` | 6.1s | +7.0s |
| `Yes, eight counters.` | 7.9s | +8.8s |

The runner opens the next item at the verdict, so **the new frame is on screen for six to nine
seconds before the tutor's ask for it is even sent.** A bare "she spoke, then stopped" latch
fills on the affirmation inside that window — which is exactly what the user heard on drive 5
(*"the very next one flashes way too fast, before she finishes her statement"*). The gate now
also requires `cuedItemId === item.id`, and across eight advances nothing flashed early.

**⭐ THE CORRECTION PATH SENDS NO CUE, WHICH IS WHY THE RE-FLASH GATE WORKS.** Between the wrong
answer at 56.8s and the affirm at 79.8s there are **zero `text-to-gemini` events** — both
corrections are in-band. So `cuedItemId` still named item 4 throughout, the runner re-armed the
gate on `onCorrectionRetry`, and the re-flash waited for her *correction* to finish. That is the
beat drive 3 fixed by hand in the component and 19c moved into the runner; it was watched live
and it held.

**Transport, all clean:** `state_attached: 0` on all 8 cues (the 19h-i-a fix holding) ·
`superseded: 0` · `wedged: 0` · `cut_in: false` · `waited_ms: 0` · floor-gate summary all zeros
· `owns_opening: true` · one barge-in, on the closing line, after the run had ended.

---

## 3. Two findings for the queue

**🔴 18c(c) CONFIRMED AT A MICROPHONE, and the number is worse than the text drive suggested.**
The correction is byte-identical: 2 corrections, **1 distinct string**, 20 words each. The child
heard *"My turn: it was seven. Look at the whole group at once instead of counting them. Your
turn. How many counters did you see?"* twice, for **11.9s and 11.8s — 23.7 seconds of identical
tutor speech on one item.** DISTAR firms by escalating, not repeating. Already filed as
family-wide 18c(c); this is its first user-drive citation and the first time its *duration* has
been measured.

**⭐ 19h-i-c DID NOT REPRODUCE OVER AUDIO — a real measurement, and it narrows the item.**
`di-verdict-embellished` fired on **5 of 7 affirmations (26–37 added words)** on the headless
`--di` drive of this same port. Here, over real audio: **7/7 affirms are the bare three-word
scripted line, zero embellishment, zero false-completion claims.** Same pack, same contract,
different channel. 19h-i-c says *"measure across ports first (is it ten-frame's affirm-tail
shape or family-wide?)"* — the more useful question may be **whether it is a property of the
TEXT-answer channel** rather than of the pack. Probe before code, as filed.

---

## 4. Residual

**`counting-board` `subitize` (#86) has NOT been glanced.** 19c fixed a live defect there — its
K flash was still starting on an 800ms beat measured from item-open, drive 3's original bug,
never propagated — and that fix is the one thing in the slice with no human eyes on it. Same
gate, same runner, so it is inherited rather than new; worth one screen on the next
counting-board touch.
