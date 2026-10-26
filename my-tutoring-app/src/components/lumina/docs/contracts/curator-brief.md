# Contract: curator-brief

- **Derived:** 2026-10-11 · evidence window: static read of all 37 referencing files, git log of component + generator (2026-07-14 → 2026-09-16), qa/HUMAN-CHECKS #71, qa/HANDOFF_read-aloud-sweep, qa/HANDOFF-student-interests-themed-lessons-2026-09-16. No census needed: the manifest places this primitive first in every lesson (catalog `core.ts`, `flattenManifest.ts` step 1).
- **Component:** `primitives/CuratorBrief.tsx` · **Generator:** `service/curator-brief/gemini-curator-brief.ts` (registered in `service/registry/generators/coreGenerators.ts`; also called by `app/api/lumina/build-stream/route.ts` and `app/api/lumina/route.ts`) · **Catalog:** `service/manifest/catalog/core.ts` (first entry)
- **Status:** ACTIVE

## Consumers (blast radius)

| Consumer | Channel | Evidence | Last seen |
|---|---|---|---|
| Every lesson (manifest layout, item 0) | code | `flattenManifest.ts` step 1, `exhibitAssembly.ts:67` | live |
| Manifest objective blocks (brief objectives seed the blocks) | code | `useExhibitSession.ts`, `build-stream/route.ts`, `topic-trace/route.ts:512` (replay identity compares objectives JSON) | live |
| Lesson Bench package / scorer / journey / rerun identity | code + tests | `lessonPackage.ts:262-265`, `lessonBenchScorer.ts:135,170`, `journey/extract.ts:61`, `rerunIdentity.ts:19` | live |
| Exhibit `intro` legacy field, LessonScreen objectives + K-stage grade detection, ExhibitContext | code | `exhibitAssembly.ts:103-106`, `LessonScreen.tsx:119,148` | live |
| GeneratingScreen objective preview | code | `GeneratingScreen.tsx:36` | live |
| Kindergarten stage (pre-readers) | code + reader-fit | `KindergartenStage.tsx` display-section dwell; read-aloud sweep | 2026-07 |
| Lesson tutor (Gemini Live) | code | catalog `tutoring` block + `[READ_SECTION]` (retired 2026-10-11 for the ungraded workspace) | 2026-10 |
| Personalisation (name, interests, mid-session handoff) | git | 704fa9cc, `buildBriefVoiceBlock` | 2026-09-16 |

## Requirements

### R1 — Output shape is additive-only · OBSERVED
- **Property:** `IntroBriefingData` keeps every existing field and type: `hook.content` string, `hook.type`, `hook.visual` glyph, `objectives[] {id,text,verb,icon}`, `prerequisites`, `roadmap`, `connections`, `mindset`, `topic`, `subject`, `gradeLevel`, `preparedFor`. New fields are optional on the type.
- **Demanded by:** Lesson Bench package validation, exhibit assembly, topic-trace replay.
- **Evidence:** `lessonPackage.ts:262-265`, `exhibitAssembly.ts:103-106`, `topic-trace/route.ts:512`.
- **Probe:** `npm test -- src/components/lumina/service/qa/lessonBench src/components/lumina/service/exhibitAssembly.test.ts src/app/api/lumina/build-stream`; one `topic-trace?manifestOnly=true` call returns `curatorBrief.hook.content` as a string and `objectives[]` with all four keys.

### R2 — Objectives are produced exactly as before · OBSERVED
- **Property:** count capped by `capObjectivesForGrade` (K → 2, pre-K → 1, else 3), ordered prerequisite → concrete-before-symbol → non-decreasing Bloom. They seed the manifest blocks.
- **Demanded by:** every lesson's manifest; Lesson Bench.
- **Evidence:** 32267345, `objectiveBudget.ts`.
- **Probe:** K patterns topic-trace → ≤ 2 objectives, first is the concrete one.

### R3 — The quick-check answer is never revealed by default · OBSERVED
- **Property:** `prerequisites.quickCheck.answer` appears in no default UI state, caption, tutor fact or image prompt.
- **Demanded by:** CLAUDE.md pedagogy rule 1; the old catalog directive "NEVER REVEAL THE QUICK-CHECK ANSWER".
- **Evidence:** old `buildSectionSpeech` excluded it on purpose.
- **Probe:** `primitives/CuratorBrief.workspace.test.tsx` leak case (scene facts, DOM text and image prompt exclude the answer).

### R4 — A pre-reader can use it without reading · OBSERVED
- **Property:** at K / pre-K grades every caption reaches the learner by voice, and every control works by picture and position.
- **Demanded by:** K stage; reader-fit read-aloud sweep.
- **Evidence:** `qa/HANDOFF_read-aloud-sweep.md:17,28`; old `isPreReader` path.
- **Probe:** browser render at K: choices carry a picture, Start carries an icon; the tutor's scene facts carry every caption.

### R5 — The hook badge is a glyph, never a word · OBSERVED
- **Property:** `hook.visual` comes from `emojiForHookTheme` and renders through `resolveHookVisual`.
- **Demanded by:** HUMAN-CHECKS #71.
- **Evidence:** ca360cc9.
- **Probe:** a rendered brief shows one emoji in the placeholder, not a word.

### R6 — Personal framing stays wording-only · OBSERVED
- **Property:** the name and interests change only hook wording; `preparedFor` is stamped by code.
- **Demanded by:** personalisation (704fa9cc).
- **Probe:** a generation with a persona keeps the objectives unchanged and has `preparedFor` set.

### R7 — One opening, no greeting race · OBSERVED
- **Property:** the tutor's first turn in a lesson is the brief's opening. The brief must not fire a second turn on mount next to a greeting.
- **Demanded by:** the lesson tutor; old component comment "auto-firing on mount races that greeting".
- **Evidence:** `ADDING_TUTORING_SCAFFOLD` "Avoiding Gemini Turn Races"; backend `should_queue_greeting(owns_opening)`.
- **Probe:** `lessonPrimitiveContext` for a bound brief carries `owns_opening: true` and `tutoring: null` (vitest).

### R8 — Ungraded, first and single · OBSERVED
- **Property:** it submits no evaluation; it is first in the layout and appears at most once; scorers and journeys skip it.
- **Demanded by:** K stage display-dwell, Lesson Bench scorer and journey, manifest.
- **Evidence:** catalog `maxPerLesson: 1`, `lessonBenchScorer.ts:135`, `journey/extract.ts:61`.
- **Probe:** the workspace test asserts no submit.

### R9 — Legacy `IntroData` still renders · INFERRED
- **Property:** an old `{hook, objectives[]}` payload converts through `convertToIntroBriefing`.
- **Probe:** the vitest render case for the legacy shape.

## Conflicts

None open. The tabbed layout had no code consumer. R4 (pre-reader voicing) and R7 (no mount turn) conflicted inside the old component, which voiced the hook only after navigation. The ungraded teaching workspace resolves this: the bound brief owns the lesson opening (`owns_opening`), so one opening carries the hook.

## Catalog projection

- **description:** faithful as of 2026-10-11 ("Introduction, learning objectives, and hook. REQUIRED: Always include this first.").
- **constraints:** faithful.
- **teachingWorkspace:** added 2026-10-11 (ungraded); the `tutoring` block is retired with it.

## Changelog

- 2026-10-26 — **onto an ungraded boss card (COMPATIBLE; USER RULING 10-26).** `curatorBrief.card.ts` + `curatorBrief.boss.ts`: the hand guidance is now the card's words (`TEACHING_ROTATION`) plus `TEACHING_DOCTRINE`. The unbound read-aloud channel (`LegacyReadAloud`, `useLuminaAI`) is deleted: an unbound mount (BriefLab, a layout item with no objective) shows the shared "needs the tutor" card. Pip is the shared runner's. R1-R4 unchanged (R3: the quick-check answer is still in no fact or caption).

- 2026-10-11: derived (initial, static). 9 requirements, 0 open conflicts. Done before the one-screen rebuild.
- 2026-10-11: one-screen rebuild, checked against R1-R9. **COMPATIBLE.** Added fields only (`hook.question`, `hook.imagePrompt`, `today`, `wonders`); objectives prompt and cap unchanged. R3 is held in code (`briefOpening.finishOpeningFields` drops any field naming the answer; the quick check is off the screen and out of the tutor's facts). R7: a bound brief sends `owns_opening`. Probes: `CuratorBrief.workspace.test.tsx` (8), workspaceContract, lessonBench, exhibitAssembly and build-stream suites green; three real briefs rendered in headless Chromium.
