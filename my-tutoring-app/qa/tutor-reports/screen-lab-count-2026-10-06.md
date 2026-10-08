# Screen-share lab: first Live drive (2026-10-06)

Page `/lumina/lab/screen-count`, endpoint `/api/lab/screen-tutor` (dev-only). Code owns the steps; Live sees 1 JPEG/s of the stage, hears the mic, can call `point_at` / `reveal_numbers`. One headless drive, gemini-3.8-live, silent fake mic; child's answer injected as a `[SCREEN]` event.

| Moment | Result |
|---|---|
| Last tap -> loop drawn -> tutor asks | 1.9 s; said "How many trucks altogether?" |
| Injected "three" -> affirm + tool | 0.8 s; "Three trucks!" then `reveal_numbers` (screen advanced) |
| Numbers shown | Did NOT ask "Which number says three?"; emitted `<no speech>{pause}` |
| Correct tap | "Great job!" |

Defects seen:
- Output transcript of the "how many" turn carried a long unrelated Tamil passage (Indian constitution) after the English line. Audio for that turn was ~1.8 s, so it was likely transcript-only, but unconfirmed.
- `<no speech>{pause}` control text leaked into the transcript.

Not yet tested: a real child's voice, whether the model uses the frames (nothing here needed sight), `point_at` (never called).
Script mode (browser voice, no Live) drove the same item end to end.
