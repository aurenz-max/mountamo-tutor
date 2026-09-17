# Direct visual tools in the Live Activity sandbox

Added four optional nonblocking tool declarations: `show_counters`, `show_fraction`,
`show_letter_tiles`, and `highlight_visual`. The first three mount validated model
parameters directly, without a generator fetch or second model call. The fourth
points to existing items without clearing student work. All remain development-only
and opt-in through the sandbox connection. The tester defaults to enabling both
number-line and direct visuals; either group can be disabled before connecting.

## Interaction contract

- Counters: 0–20 in rows or ten-frame layout; taps cross out/restore counters.
- Fractions: one whole with 2–12 equal parts; taps toggle shading.
- Letter tiles: 1–12 alphabetic letter/grapheme tiles; taps select units, including
  multi-letter graphemes such as `sh`.
- Highlight: bounded zero-based indices on the matching mounted direct visual;
  does not modify removed counters, fraction shading, or selected tiles.

Mount and highlight responses follow React commit and two animation frames.
The backend correlates tool and instance IDs, preserves the original function name
for continuing state responses, and streams student actions silently. Replacing
a visual closes the prior state stream. A direct visual supersedes pending
number-line generation, and late generator results cannot replace it.

These are conversational sandbox surfaces, not ports of the catalog primitives'
full DI scripts. There are no Check/Next controls on the direct visuals and no
verified assessment/mastery writes. New show calls replace the workspace and
reset its student work. Number-line generation and its guarded advance tool
remain available when enabled.

## Verification

- 18 frontend tests passed across direct visual behavior, sandbox orchestration,
  number-line contracts and progression. Includes actual rendered taps, shading,
  grapheme selection, two-frame receipts, retained student work under pointing,
  disabled number-line selection, and cross-type stale generation rejection.
- 14 backend tests passed for parameter validation, enabled-tool declarations,
  original function-name preservation, silent state streams, command correlation,
  cancellation/replacement, and rejecting number-line advancement on direct visuals.
- TypeScript: no diagnostics in the changed frontend files. Repository-wide
  checking retains 770 pre-existing diagnostics elsewhere.
- Two real authenticated backend/Gemini sessions completed counters → student
  state question → counter highlighting → fractions → grapheme tiles → tile
  highlighting on one connection, with number-line tools disabled. Both returned
  four remaining counters after synthetic removal of two from six, represented
  three quarters correctly, preserved `sh` as one tile, and pointed to requested
  indices. Raw events: `live-visual-tools-2026-09-16.json`.

The live probe explicitly simulates browser receipts and taps; component tests
exercise the real React interaction separately. Actual browser layout, microphone
recognition, and audible playback still need a human try. Restart the tester
session to receive the expanded tool declarations, then use the three preset
prompts or ask naturally for counters, fractions, or letter tiles.
