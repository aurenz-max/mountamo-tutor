# spoken_miss from audio: first real-model run (2026-11-12)

`node scripts/spoken-audio-probe.mjs` (letter-sound-link see_hear, SAPI Zira/David, 38 cases; JSON: `spoken-audio-probe-2026-11-12.json`).

| arm | pass | false "correct" | false miss | p50 ms |
|---|---|---|---|---|
| jev / transcript | 25/38 | 3 | 0 | 94 |
| gemini-decision-1 / audio only | 35/76 | 35 | 1 | 449 |

- The audio arm reads almost every wrong answer as `correct`: letter names (s, a, t, i, p), other sounds, added vowels, and silence
  (p 0.3-0.6). It named 5 misses, 4 right; the wrong one was `letter_name` on a correct /p/ sound.
- Spot check through `/api/lumina/observe-spoken-audio` on the dev server: "cot" read as `correct` for "cat" (both voices),
  "ess" read as `correct` for /s/ (p 0.55/0.60).
- The 11-11 audio win was `item_score` (one right/wrong question). The `spoken_miss` question set (a choice across
  misses plus `correct`, `other_wrong`, `no_answer`) does not carry it: the model picks `correct` whenever the answer is near the task.

Decision: `spoken_audio` stays shadow-only (trace, nothing reads it). Promoting its reading to the attempt's miss was built,
tested and reverted on this evidence. Next: a binary per-miss audio question (item_score shape: "is this the letter's name,
not its sound?") benched on the same clips before any wiring; then real child clips.

## 2026-11-13: the audio is heard; the expected answer in the prompt causes the false credit

Same 32 SAPI clips (targets mat/cat/pig/sun, 24 wrong words), gemini-decision-1, audio only:

| question | right/wrong | wrong word called right |
|---|---|---|
| `item_score` (the 11-11 bench shape: task + expectedAnswer, "is it right?") | 18/32 | 14/24 |
| `spoken_miss` (task + expectedAnswer + misses, choice) | 12/32 | 20/24 |
| blind: "which word did you hear?", 15 words, no task | 25/30 identified | - |
| blind candidates: target hidden among miss examples, code maps | 23/32 | 8/24 |
| blind candidates + every one-sound CVC neighbour (13-16 words) | **27/32** | **5/24** |

Told the answer is "mat", the model calls "hat" right (0.89). Asked blind, it hears "hat" (0.95). Remaining misses:
SAPI-close vowels (cot/cat, peg/pig, Zira) and words two sounds off ("sit" for "sun"), which are not on the list.
Next: rebuild `spoken_miss_audio` as the blind choice (code builds the candidates from the word library and the item's
misses, code maps the heard word to correct / a miss), re-run spoken-audio-probe, then wire it into the attempt.
