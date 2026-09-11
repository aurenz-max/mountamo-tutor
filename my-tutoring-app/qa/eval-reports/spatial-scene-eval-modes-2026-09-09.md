# Spatial Scene — Fixed-Perspective Spoken Mode (2026-09-09)

## Outcome

Added `describe_scene` as a distinct spoken-production evaluation mode at β 4.5 while
preserving the existing `identify`, `place_in`, `place`, `describe`, `place_between`,
and `follow_directions` contracts.

The scene uses one visible YOU viewpoint. Screen columns own left/right; depth lanes own
front/behind, with larger rows nearer the viewer. The target relation/model sentence is
hidden before the attempt. A judged microphone turn requires both the relation and named
reference object, then highlights the two objects and models the complete sentence.

The generator now uses shared `resolveEvalModes`. A direct pin produces only
`describe_scene`; a curated `describe_scene|place` blend produces only those two types;
an explicit `mixed` pin produces all seven registered modes. Unpinned legacy behavior
still keeps the original grid blend unless lesson scope explicitly asks for containment,
between, or viewer-depth relations.

## Verification

- Focused frontend suites: included in the **70/70** combined pass.
- Direct/blended/mixed mode contracts: pass.
- All four fixed-perspective relations (`left_of`, `right_of`, `in_front_of`, `behind`):
  code-derived and geometry-checked.
- Spoken pack validation: pass; pre-attempt cue does not speak the answer.
- Live registry/API: an explicit `describe_scene` pin returned four challenges, one per
  perspective relation, all carrying `scenePerspective=viewer_depth` and answer-safe
  instructions.
- Lumina typecheck: zero errors.
- Backend calibration parity: 2/2 passed; catalog and backend β values agree.

## Residual human check

Use a real microphone and browser to judge child speech variants and visually confirm
the depth cue, post-attempt object highlight, and animation timing. No automated suite can
establish microphone quality or child-facing visual clarity on a physical display.

