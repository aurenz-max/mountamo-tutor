# Student interests → themed lessons → a board that shows them (the pilot student's profile)

Status: **all three slices SHIPPED 2026-09-16, plus the PreK objective cap slice 3 depended on.** Three slices, each with its own executor and verification. The
related PreK objective cap (1 objective at preschool, 2 at kindergarten, 3 above) is a SEPARATE slice and is not in
this handoff; slice 3 below depends on it. Queue: WORKSTREAMS row "Student interests".

## Why this exists

User observation 2026-09-15: paper worksheets themed on excavators and dump trucks hold the pilot student (age 4) far better than
generic ones, and the platform's only real learner is him. Lumina already has an interests path that reaches the
curator brief and the manifest, but (a) nothing ever writes interests, (b) the store it reads is the deprecated Cosmos
profile, and (c) the primitive that would show the theme, `counting-board`, cannot render anything outside six emoji.
The LLM generator is the advantage over a deterministic board only if the theme reaches it and it is allowed to act.

## What exists today (verified 2026-09-16; file:line)

1. **Source of interests.** `_build_student_persona` reads `preferences.interests` or `preferences.onboarding.interests`
   from `user_context`, caps at 8 strings (`backend/app/api/endpoints/student_profile.py:345-351`). Onboarding never
   collects them (comment at `:348`). `user_context` is the SIGNED-IN Firebase user's Cosmos `user_profiles` document,
   loaded on every authenticated request (`backend/app/core/middleware.py:39-46`; store:
   `backend/app/services/user_profiles.py:98-104`). Name and interests come from that account; last-session comes from
   `request.student_id` attempts.
2. **Persona → prompts.** `fetchStudentPersona(studentId, topic)` runs at every lesson launch, skipped when anonymous
   (`hooks/useExhibitSession.ts:192`). Curator brief: `buildBriefVoiceBlock` lists interests and may theme THE HOOK ONLY
   (`service/curator-brief/gemini-curator-brief.ts:24`, `:46`). Manifest: `buildStudentVoiceBlock` lists interests;
   rule "Theme AT MOST 2 component intents" (`service/manifest/gemini-manifest.ts:107-127`). Both are words-only blocks:
   they never change counts, scope, or component selection. Keep that.
3. **Manifest → generator.** The per-component `intent` string is stamped into the generator config; counting-board puts
   it in its prompt (`service/math/gemini-counting-board.ts:420`, `:535-541`). So "count the dump trucks" in an intent
   does reach Gemini for the board today.
4. **Where it dies.** `objects.type` is a closed enum of bears, apples, stars, blocks, fish, butterflies, custom
   (`primitives/visual-primitives/math/CountingBoard.tsx:123`; schema `gemini-counting-board.ts:291`). Post-generation
   validation forces anything else to stars (`:639-642`). `config.objectType` is a prompt hint nobody sets (`:578`; grep
   of manifest and registry: no writer). The component renders `OBJECT_EMOJI[type]`, custom → ⬤
   (`CountingBoard.tsx:161-169`, `:399`). The tutor's word comes from `objectWordFor`, custom → "objects"
   (`countingBoardScript.ts:479-480`), and every ask line uses it (`:190-203`), so a custom board today says "Touch the
   objects". The `SINGULAR` map already carries nouns the enum cannot produce (birds, dogs, cookies, rockets,
   `:147-168`): the tutor side is ready for a wider vocabulary; the enum is the bottleneck.
5. **The store is deprecated.** Cosmos is deprecated by user ruling 2026-07-08 (memory `cosmos-deprecated-firestore-
   exclusive`): never build new features on it. It is still live for auth. `PUT /api/user-profiles/profile` REPLACES the
   whole `preferences` dict (`user_profiles.py:98-99`): a write that omits `onboarding` wipes it.
6. **Firestore precedent.** `set_student_grade_level` merge-writes `students/{id}.grade_level`, written through from the
   profile PUT and settable by `backend/scripts/set_student_grade.py` (`backend/app/db/firestore_service.py:2258-2278`).
   Interests should follow this shape, not the Cosmos one.
7. **Whose account.** No dev pin in `.env.local`; `useStudent` resolves `studentId` from the signed-in user's mapping
   (`contexts/StudentContext.tsx:13-20`). the pilot student must play signed in as the account whose `student_id` is his. Find it
   from `/api/user-profiles/profile` while signed in as him, or the Firestore `students` collection.

## Slice 1 — interests on the Firestore student doc, read first (backend + script; no UI) — **SHIPPED 2026-09-16**

Executor: a plain backend slice; `student-data-loop` skill for the invariants. Backend ships only with its consumer:
the consumer is the persona block, which already exists.

- Add `students/{id}.interests: string[]` via a merge write next to `set_student_grade_level`
  (`set_student_interests(student_id, interests)`), and `backend/scripts/set_student_interests.py <student_id>
  "excavators" "dump trucks" "trash trucks"` mirroring `set_student_grade.py`.
- `_build_student_persona`: read the Firestore field first (it already holds the `firestore` handle), fall back to the
  Cosmos preferences. Keep the cap of 8 and the string filter. Do not touch the PUT.
- Do NOT add an onboarding form (pilot onboarding CLOSED 2026-08-14). Do NOT write interests through the PUT (replace
  semantics plus Cosmos debt).
- **Verify without a browser.** Signed in as the pilot student's account, `POST /api/student-profile/generation-context` with
  `include_persona: true` and empty `objectives` → `studentProfile.interests` and `summary` carry the three strings.
  Then `POST /api/lumina/topic-trace` with that `studentContext`, topic "Counting to 5", grade `kindergarten`: the
  manifest's counting-board intent names a truck in at most 2 components; the brief hook may. Save the run under
  `qa/topic-traces/`.
- **Verify at runtime.** Launch a K counting lesson signed in as him. Expected TODAY: the intent text mentions trucks,
  the board still shows stars (that is slice 2's before-state; record it).

## Slice 2 — counting-board renders the theme (generator + component + script) — **SHIPPED 2026-09-16**

Executor: `/eval-fix` shape (one primitive, a confirmed content contract gap), with `/primitive-contract --check`
first. Contract: `docs/contracts/counting-board.md` (R2 renders exactly `count` objects; the object vocabulary is where
the board's emoji meets the tutor's mouth, `countingBoardScript.ts:477-480`).

- **Generator schema.** `objects: { type, emoji?, word?, wordSingular? }`. Prompt: when the lesson intent names a theme,
  set `type: 'custom'` with one emoji and a plural noun. Code-validate: `emoji` is exactly one grapheme
  (`Intl.Segmenter`), `word` is 1-2 lowercase words, `wordSingular` present; otherwise fall back to the enum exactly as
  today. The enum stays the fallback, never the ceiling (memory: schema over regex/prompt; trust intent over caps).
- **Component.** `OBJECT_EMOJI[type]` becomes `objects.emoji ?? OBJECT_EMOJI[type]`; pass `objects.word` into the pack's
  `objectWord` and `objects.wordSingular` into the singular lookup (`SINGULAR[objectWord] ?? objectWord`,
  `countingBoardScript.ts:170`). Hit-testing is by center distance (`CountingBoard.tsx:216`), so glyph width does not
  matter.
- **Evidence strings** use `item.objectWord` (`countingBoardEvidence.ts:13`, `:45`): "Handed over three dump trucks."
  flows through; the capture test must still pass.
- **Emoji reality.** There is no excavator emoji. Nearest: 🚜 tractor, 🚛 lorry, 🚚 truck, 🏗️ crane, 🚧 barrier,
  🛻 pickup. An SVG object set is a later step, not this slice.
- **Verify.** `/eval-test counting-board` on `give_me_n` and `count_all` with intent "Count dump trucks to 4": board
  shows 🚛, the ask says "dump trucks" / "dump truck", evidence says "Handed over three dump trucks.", counts stay
  within the bound. Then the runtime check from slice 1 again: the themed component shows trucks. Headless recipe:
  memory `headless-chrome-drive-recipe`.

## Slice 3 — themed-count rule for one-objective lessons (after the objective cap ships) — **SHIPPED 2026-09-16**

`gemini-manifest.ts:127` "Theme AT MOST 2 component intents" is right for three objectives of 2-4 components. At
preschool the lesson is ONE objective, so two themed components is most or all of it and the rule reads as a limit
that is not there. Pass the objective count into `buildStudentVoiceBlock` and make the line "at most 2, or every
component when the lesson has one objective". Prompt wording only; the count is code. Do this only once the PreK
objective cap exists, or the line has nothing to read.

## What shipped (2026-09-16)

**Slice 1.** `set_student_interests` / `get_student_interests` merge-write and read `students/{id}.interests`
(`firestore_service.py`, next to `set_student_grade_level`), plus `backend/scripts/set_student_interests.py`
(`--student <id> "excavators" "dump trucks"`, `--clear` to undo). `_build_student_persona` reads Firestore first and
falls back to the Cosmos preferences; the PUT is untouched. Verified by driving `_build_student_persona` directly against
both sources: Firestore-only (Cosmos preferences empty) returned the three strings and the summary line; a student with no
Firestore field still read `['dinosaurs']` from Cosmos, so the legacy path is intact. `students/9001.interests` is now
`['excavators', 'dump trucks', 'trash trucks']` — **confirm 9001 is the pilot student's student_id** (it is the only K account).

**Slice 2.** `objects` grew `emoji` / `word` / `wordSingular` beside the enum `type`. The generator's prompt asks for the
triple when the intent names something to count; code validates it (emoji exactly one grapheme via `Intl.Segmenter` and
no ASCII, both nouns 1-2 lowercase words) and drops the WHOLE triple back to a random enum type if any part fails —
never to bare `custom`, which is the ⬤ / "objects" board this slice exists to stop. The component resolves
`objects.emoji ?? OBJECT_EMOJI[type]` and passes the two nouns into the script; `CountingItem` carries `objectSingular`
and `objectSingularFor`/`countedNoun` take it as an override, so the exact `SINGULAR` map stays authoritative for the
closed enums and an open themed noun brings its own singular. The component's hand-rolled `objectWord.replace(/s$/,'')`
in the double-count line is gone. Contract: **R12**.

Verification: `scripts/probe-counting-board-themed-objects.mjs` — 12/12 live draws clean (themed → complete triple and
the tutor says "Touch each **dump truck** one time as you count", never "objects"; an unthemed intent still lands on the
enum). Full pipeline via `/api/lumina/topic-trace` with the pilot student's persona: interests → voice block → counting-board intent
"1 to 5 excavators and dump trucks lined up in the work yard" → board `{custom, 🚛, "dump trucks", "dump truck"}`, saved
to `qa/topic-traces/counting-board-student-interests-2026-09-16.json`. `typecheck:lumina` 0; 1276/1276 math tests.

**Not yet done:** nobody has driven this in a browser. The board, the tap loop and the tutor's voice on a themed board
are verified through the generator, the script's real cue surface and the oracle, not through Chrome.

**Filed:** CNB-6 (EVAL_TRACKER) — on a tight bound the count_all instance count outruns the distinct boards available and
a card repeats. Fires on the unthemed control at the same rate; not caused by this slice.

## Objective cap + slice 3 (2026-09-16, same day)

Trigger: a Preschool lesson on "orange excavators and red dump trucks" still built 3 objectives / 10 components.

- `service/curator-brief/objectiveBudget.ts` — `maxObjectivesForGrade` (toddler/preschool/Pre-K → 1, K → 2,
  everything else → 3) and `capObjectivesForGrade`. The curator brief states the count in its prompt and schema
  AND trims in code after generation (drops from the end; the ordering rule puts the concrete objective first).
  The old "Objectives: 2-3 max" / "3-4" lines are gone, so grades 3-8 now also stop at 3 (was up to 4).
- Recommended fill (`IdleScreen.tsx`) asks for the band's count and accepts a one-objective fill at PreK
  (`< min(2, max)`); backend `session-targets` now allows `count=1` (the selector already handled it).
  Hand-picked Lesson Builder objectives are NOT trimmed — a person chose them.
- Slice 3: `buildStudentVoiceBlock(studentContext, objectiveCount)` — at one objective the line is "theme EVERY
  component intent"; otherwise the at-most-2 line is unchanged. Code picks the line; no new manifest rule.
- Verified: four parallel topic-traces — PreK "orange excavators…" 1 objective / 4 components; PreK "Counting to 5"
  1 / 4 with 3 of 3 intents themed; K 2 / 7 with 1 themed; Grade 1 3 / 8 with 2 themed.
  [evidence](topic-traces/objective-cap-by-band-2026-09-16.md). `typecheck:lumina` 0; full tsc unchanged (770).
- Not browser-driven: the idle-screen fill button at PreK was not clicked (no PreK curriculum is published, so the
  fill path is likely unreachable there today).

## Residuals and rulings owed

- The Cosmos fallback in the persona read stays until the user_profiles XP migration slice (memory, pending).
- Interests are not sent to the Live tutor's system prompt. In DI packs the tutor already gets the noun through
  `objectWord`; whether non-DI tutoring should hear interests is a separate decision.
- **Human check to file when slice 2 ships** (next HUMAN-CHECKS id was #166 on 2026-09-16; re-grep before filing):
  a mic sitting with the pilot student on `give_me_n`, trucks vs stars, same numbers. Does the theme change whether he stays for
  four items? Owner: user.
- ~~The recommended-fill guard refuses a one-objective fill~~ — fixed with the objective cap (2026-09-16).
