# Tier-3 Live Tutor Report — interactive-book — 2026-08-14

Headless synthetic student drove 1 real Gemini Live session(s) over the same
generated content; transcripts are the tutor's actual spoken words (`ai_transcription`).
A finding is CONFIRMED at ≥2/3 of runs (single run: everything counts).

- Journey meta: `{"journey": "di-judged-loop", "component": "interactive-book", "items": 5, "voice_items": 0, "gesture_items": 5, "dropped_challenges": 0, "pack_gate_issues": [], "wrong_kind": "plain", "cap_drill": false, "grade": "Grade 3"}`
- Message types seen: `['ai_audio', 'ai_transcription', 'ai_turn_end', 'auth_success', 'resumption_handle', 'session_ready']`

## Verdict

**PASS** — no findings.

## Findings

None.

## Judgment matrix

Each spoken item was answered WRONG on purpose, then right, in TEXT (no TTS — see the journey docblock for what that does and does not test).
`refused` = the tutor opened with the correction sentinel on the wrong answer. `affirmed` = it opened with the affirm sentinel on the right one.

| Item | Kind | Wrong answer said | refused? | Right answer said | affirmed? |
|---|---|---|---|---|---|
| `interactive-book-feature-1` | gesture/find-feature | (placement) | ✅ | (placement) | ✅ |
| `interactive-book-feature-2` | gesture/find-feature | (placement) | ✅ | (placement) | ✅ |
| `interactive-book-feature-3` | gesture/find-feature | (placement) | ✅ | (placement) | ✅ |
| `interactive-book-feature-4` | gesture/find-feature | (placement) | ✅ | (placement) | ✅ |
| `interactive-book-feature-5` | gesture/find-feature | (placement) | ✅ | (placement) | ✅ |

*✅ judged as scripted · ❌ the opposite verdict · — neither sentinel (the loop would stall). One glyph per run.*

Pack gates over this live content: `[]` — clean. Challenges dropped by the build gates: 0.

## Run 1 — beat-by-beat transcript

### ask:interactive-book-feature-1
*expect: turn · turn_ended: True · 12.3s · audio: 696360 b64 bytes*
*note: gesture item (find-feature)*

> Hi! Time to open our book! This is our picture book! I name a book part — you find it on the page and tap it! Find the title. Your turn. Tap the title.

### hands-hold:interactive-book-feature-1
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:interactive-book-feature-1
*expect: turn · turn_ended: True · 8.1s · audio: 417284 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the title is the big words that tell the name of the whole book. Your turn. Tap the title.

### commit-right:interactive-book-feature-1
*expect: turn · turn_ended: True · 6.5s · audio: 261124 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is the title — it says Water Changes Shape!

### ask:interactive-book-feature-2
*expect: turn · turn_ended: True · 5.3s · audio: 243844 b64 bytes*
*note: gesture item (find-feature)*

> Find the author's name. Your turn. Tap the author's name.

### hands-hold:interactive-book-feature-2
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:interactive-book-feature-2
*expect: turn · turn_ended: True · 8.5s · audio: 467204 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the author's name tells who wrote the book — smaller words near the title. Your turn. Tap the author's name.

### commit-right:interactive-book-feature-2
*expect: turn · turn_ended: True · 4.7s · audio: 222084 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is the author's name — it says Sam Bell!

### ask:interactive-book-feature-3
*expect: turn · turn_ended: True · 4.7s · audio: 190724 b64 bytes*
*note: gesture item (find-feature)*

> Find the heading. Your turn. Tap the heading.

### hands-hold:interactive-book-feature-3
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:interactive-book-feature-3
*expect: turn · turn_ended: True · 7.9s · audio: 432004 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: a heading sits at the top of the page and tells what the page is about. Your turn. Tap the heading.

### commit-right:interactive-book-feature-3
*expect: turn · turn_ended: True · 4.5s · audio: 207400 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is the heading — it says Hard Ice!

### ask:interactive-book-feature-4
*expect: turn · turn_ended: True · 5.9s · audio: 238084 b64 bytes*
*note: gesture item (find-feature)*

> Find the picture caption. Your turn. Tap the picture caption.

### hands-hold:interactive-book-feature-4
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:interactive-book-feature-4
*expect: turn · turn_ended: True · 8.2s · audio: 451844 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: a caption is the little line right beside the picture that tells about it. Your turn. Tap the picture caption.

### commit-right:interactive-book-feature-4
*expect: turn · turn_ended: True · 5.5s · audio: 268840 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is the picture caption — it says Wet flowing water!

### ask:interactive-book-feature-5
*expect: turn · turn_ended: True · 5.2s · audio: 219524 b64 bytes*
*note: gesture item (find-feature)*

> Find the page number. Your turn. Tap the page number.

### hands-hold:interactive-book-feature-5
*expect: silence · turn_ended: False · 6.0s · audio: 0 b64 bytes*
*note: the child is working on the surface — the tutor owes no turn*

> *(silent)*

### commit-wrong:interactive-book-feature-5
*expect: turn · turn_ended: True · 7.5s · audio: 405764 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> My turn: the page number is the small number that counts the pages. Your turn. Tap the page number.

### commit-right:interactive-book-feature-5
*expect: turn · turn_ended: True · 4.5s · audio: 214404 b64 bytes*
*note: placement described to the tutor; the MATCH IS COMPUTED IN CODE*

> Yes, that is the page number — it says Page 3!

### complete
*expect: turn · turn_ended: True · 6.3s · audio: 314280 b64 bytes*

> What great book work today! You know your way around a book now. See you next time!
