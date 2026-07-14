# Eval-Mode Report: interactive-book — 2026-07-14

## Modes added

| Eval mode | β | a | Task identity | Runtime result |
|---|---:|---:|---|---|
| `find-feature` | 1.5 | 1.8 | Locate title, author, heading, caption, and page number on the book surface | PASS — 5/5 challenges, only `find-feature` |
| `read-focus-word` | 2.5 | 1.6 | Continue a tutor-read sentence by saying one glowing underlined word | PASS — 6/6 challenges, only `read-focus-word` |

The unpinned path also passed through the production generator: six challenges alternated `find-feature → read-focus-word` three times. This is an honest mixed session rather than a single model-selected type mislabeled as mixed.

## Oral-reading contract

- Gemini authors the coherent book stimulus; code derives every cloze from an exact focus-word occurrence.
- Every focus word is one token, appears exactly once, and is not sentence-initial.
- The component sends `[FOCUS_WORD_READY]` with only the safe sentence lead-in. The target word is absent.
- The tutor reads that lead-in and stops. Push-to-talk judging then owns truth; the tutor never grades.
- A match earns production evidence, notifies the tutor, and auto-advances. Routine matches are voice-silent.
- `no-match`, unclear speech, and silence are neutral and never increment scored attempts.
- Tapping the glowing word remains the deterministic fallback and receives reduced production evidence (score 60 versus 100 for judge-confirmed speech).
- A safe picture cue and repeated lead-in provide the stronger scaffold without naming the answer.

## Generator hardening

The first live draw exposed Gemini-authored `<u>` tags in paragraph text. The generator now explicitly requests plain text and defensively removes only underline/Markdown emphasis markers before validation. Remaining markup is rejected. A subsequent generated Ocean Animals session passed with six clean focus-word challenges.

## Verification

- `eval-test?componentId=interactive-book&evalMode=find-feature`: PASS.
- `eval-test?componentId=interactive-book&evalMode=read-focus-word`: PASS on generated content.
- Unpinned `generateComponentContent`: PASS; mixed sequence contained both task identities.
- Tutor static audit: PASS, zero findings.
- Tutor generated-content probe for `read-focus-word`: PASS, zero missing variables/findings.
- Catalog β/a values match backend calibration registries.
- Filtered project-local TypeScript check: no Interactive Book diagnostics.
- Browser voice bench remains required for clean word, minimal-pair neighbor, mumble, and silence behavior.
