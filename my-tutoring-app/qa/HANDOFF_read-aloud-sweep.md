# Handoff: LuminaReadAloud — browser-verify the pilot, then sweep the remaining 🔊 sites

## Context (already shipped, uncommitted)

`LuminaReadAloud` is the ONE "the tutor reads this to me" affordance in the Lumina UI kit:
`my-tutoring-app/src/components/lumina/ui/LuminaReadAloud.tsx`, exported from `ui/index.ts`
(both `LuminaReadAloud` button and bare `LuminaReadAloudGlyph`).

Design decisions that are settled — do not relitigate:
- **Glyph = the Aurora Core reading aloud**: three neutral text lines → luminous brand core (the tutor) → cyan sound arcs (its voice). The `speaking` prop ripples the arcs while the tutor voice actually plays.
- **Audio-channel color doctrine**: voice OUT (tutor speaks) = cyan `LuminaReadAloud`; voice IN (student speaks) = emerald `LuminaMicListener`/`LuminaVoiceTarget`. Accent is overridable but the default stays cyan so students learn the pairing once.
- **Sizes**: `sm` inline pill, `md` default, `lg` = pre-reader tier (≥44px tap target) — `lg` replaces every hand-rolled `isPreReader` big-button branch.
- **`iconOnly`** replaces raw 🔊 emoji buttons; always pass an `aria-label`.
- The kit component does NOT play sounds; call sites keep their own `SoundManager.tap()` in `onClick`.

Pilot already migrated + passing (jsdom 7/7, `npm run typecheck:lumina` 0 errors):
- `primitives/CuratorBrief.tsx` — section read-aloud, `lg` when pre-reader.
- `primitives/visual-primitives/core/passage-studio/ReadAloudButton.tsx` — now a thin wrapper (keeps per-stimulus-kind labels).
- `core/deep-dive/blocks/ProseBlock.tsx` — pre-reader `lg` "Read to me" + reader `sm` "Read this section" (both moved off BlockTutorHelp; BlockTutorHelp remains for the non-read-aloud "Talk about this with your tutor").
- `core/deep-dive/blocks/MultipleChoiceBlock.tsx` — `iconOnly` replay; **aria-label "Hear the question again" is load-bearing** (MultipleChoiceBlock.test.tsx queries it).

Design preview artifact (states/sizes/before-after): https://claude.ai/code/artifact/771e0b98-6e12-4a7e-8c6e-fa9eec174be2

## Task 1 — browser-verify the pilot (do this FIRST, before any sweep)

Per CLAUDE.md verification doctrine (and the pilot-then-sweep rule), the pilot is tsc/jsdom-verified but NOT browser-verified. Drive the running app (`cd my-tutoring-app && npm run dev`) and confirm:
1. A DeepDive lesson at pre-reader grade: ProseBlock shows the `lg` "Read to me" button, MultipleChoiceBlock shows the round `iconOnly` glyph next to the question, taps reach the tutor.
2. CuratorBrief: "Read this to me" renders under the section content at both pre-reader (`lg`) and reader (`md`) grades.
3. PassageStudio: the `sm` "Listen" pill renders and triggers `[READ_ALOUD]`.
4. Glyph quality at each size: text lines legible at `sm` 16px; arcs not clipped; hover/active scale feels right on glass.

If anything renders wrong, fix the KIT component (geometry/sizing), not the call sites. Report honestly if a flow can't be exercised.

## Task 2 — sweep the remaining 🔊 sites

For each, first decide: is this an **interactive read-aloud button** (→ migrate to `LuminaReadAloud`/`iconOnly`) or a **decorative/status emoji** (→ candidate for the bare `LuminaReadAloudGlyph`, or leave as-is if it's genuinely decorative)? Don't blindly swap decorative emoji.

- `literacy/WordWorkout.tsx` ~line 1067 — "🔊 Hear the Sentence" (real button → migrate; likely `md` or `lg` by band). Also 🔊 at ~827 and ~856 (classify first).
- `literacy/WordSorter.tsx` ~line 576 — 🔊 span (classify: button vs decoration).
- `literacy/StoryTalk.tsx` ~line 534 — large 🔊 div (likely decorative "tutor is reading" cue → consider `LuminaReadAloudGlyph speaking`).
- `literacy/PhonemeExplorer.tsx` ~791 + mode-config icons at ~101/110 — mode icons are config data, probably leave; ~791 classify.
- `literacy/DecodableReader.tsx` ~731 — `option.emoji || '🔊'` fallback inside answer options (decorative fallback; if touched, use the bare glyph, and do NOT break the emoji tap=choose behavior — it's a shipped reader-fit fix).
- Also grep `Volume2` across `lumina/` for any straggler read-aloud pills not in this list.

Sweep rules:
- Never regress a tutor message string — labels/UI change, `[READ_ALOUD]`/`[BLOCK_READ_ALOUD]`-style sendText payloads stay identical.
- Keep any aria-label a test queries; run the nearest `*.test.tsx` after touching a file (`npx vitest run <file>`).
- Prefer complete replacement of a JSX region over fragile multi-step partial edits.

## Verification gates (all three, in order)

1. Targeted jsdom tests for every touched file that has them.
2. Typecheck: `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit` — zero NEW errors (legacy baseline ~808 errors exists; the real gate is `npm run typecheck:lumina` = 0).
3. Runtime: drive at least one migrated flow per primitive in the browser. "tsc passed" alone is NOT done.

Do not commit — leave changes in the working tree unless the user says otherwise. When finished, update the memory file `project_lumina-read-aloud.md` (sweep status + browser-verified or not).
