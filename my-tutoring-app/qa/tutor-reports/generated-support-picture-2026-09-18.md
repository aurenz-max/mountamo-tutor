# Generated support pictures (LA-10b trial) — 2026-09-18

The tutor's new tool `generate_visual_support { purpose, concept, description, counts }`, driven in
the real host (`/lumina/live-activity`, signed-in headless Chrome, real Live model, real image model).
Two questions were under test: does the tutor write the right description, and does the picture help
the child do the problem without doing it for them.

## Pipeline

Tutor calls the tool → backend relays the request (no generation server-side) → the browser runtime
refuses it if any number in `counts` belongs to the saved task (`adapter.drawsTask`) → Next route draws
with `gemini-3.1-flash-lite-image` → a separate `gemini-flash-latest` vision read says what it SEES,
then compares with the description and counts → on a mismatch, one redraw with the complaint fed back →
only a passing picture opens, in the same returnable shell as the prepared shapes → tutor explains,
child returns to the saved task. One picture per item.

## Drives

| # | Activity (task) | Tutor's description, counts | Draw + check | Outcome |
|---|---|---|---|---|
| 1 | Ten frame, 8 shown (+2) | "seven blue counters filling the top row and two on the bottom, with three empty squares" | not drawn | REFUSED by my first sweep, a word-regex over prose that read "two on the bottom" as the answer 2. The description was right; the sweep was wrong. Replaced by structured `counts`. |
| 2 | Ten frame, 3 shown (+7) | "four blue counters in the top row and six empty white spaces", [4,6] | 3.4 s + 5.8 s, 1 attempt | SHOWN. Exact. Tutor: "four blue counters and six empty spaces… we count the empty spots to find how many more". |
| 3 | Comparison, 16 vs 11 | "six circles… four squares, lined up directly under the first four circles", [6,4] | 2.2 s + 2.8 s | REJECTED: squares drawn centred, not under the first four. Child saw nothing; tutor went on in words. |
| 4 | Comparison | "5 apples… 7 apples. Lines connect each apple…", [5,7] | 5.3 s + 6.1 s, 2 attempts | REJECTED twice: drew 5 and 5. Verified by eye: the checker was right. |
| 5 | Comparison (after steering line) | "top row has 5 yellow stars, bottom row has 3, lined up", [5,3] | 2.3 s + 3.2 s, 1 attempt | SHOWN. Exact. Tutor's spoken line omitted the counts ("the longer row has more"). |

Probe of the route alone (no tutor): ten frame 6+4, apples 5 over 3 with the last two ringed, and a
coloured b/d contrast all drew exactly and passed, about 5–6 s each.

## Findings

1. **Descriptions: 5 of 5 were nearby examples with numbers different from the task**, literal, and
   within ten. The tutor never tried to draw the task. The weak point is not the description.
2. **The image model is exact on one collection and on two separate things, and unreliable when
   objects must line up against each other or be joined by lines** (3 of 3 such drawings wrong).
   That is the case the deterministic `contrast-pair` shape draws exactly, so the instruction now
   sends "how two groups line up" to the advertised contrast example.
3. **The check is what makes this safe.** Every wrong drawing was caught before the child saw it, and
   each rejection was a true one. Without it, drive 4 would have taught "5 is as many as 7".
4. **Latency:** request to visible was about 15 s (tool call, 2–3 s draw, 3–6 s check). A rejected
   picture costs the child 10–12 s and yields nothing, so the tutor is told to prefer words, a
   reminder, then a prepared example, and a picture last.
5. **Spoken explanation after the picture** named the counts in drive 2 and not in drive 5. The
   `exampleTaught` journey judge does not cover generated pictures yet.

## Not done

Mic sitting. `--runs 3` through the Python journey harness (it has no `generate` intent yet). A
literacy adopter (b/d passed the route probe; no literacy adapter declares `drawsTask`). Rejected
drawings are logged as text only; the reviewer cannot see them in the host.

Shots: `generated-picture-ten-frame-host-example-2026-09-18.png`,
`generated-picture-comparison-host-card-2026-09-18.png`.
