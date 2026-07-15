# Handoff: Derive the phonics-blender Primitive Contract (+ 1 rider)

Paste-ready brief for a separate session. Goal: the **second** primitive contract
(after the sorting-station pilot at
`src/components/lumina/docs/contracts/sorting-station.md` — read it first as the
worked example), making the contract system load-bearing in the ACTIVE reader-fit
stream. The procedure is `.claude/skills/primitive-contract/SKILL.md` — read it in
full before starting; this handoff is the briefing, the SKILL.md is the method.

**Why phonics-blender, why now:** it's in the reader-fit K queue (#7) AND the
contracts queue (#6). It just absorbed two waves of consumer-driven edits in one day
(2026-07-15: `clampGradeToK2` grade fix in `7cb5e5f`, plus RF-1/RF-2 PRE fixes) — the
exact "edited for one consumer while others depend on it" profile contracts exist for.
Deriving now captures all of that as durable requirements while the evidence is fresh,
BEFORE the next edit wave (rhyme-studio work will be tempted to share patterns with it).

**State caution (mid-flight):** the reader-fit #7 lane moved TODAY — EVAL_TRACKER
shows RF-1/RF-2 already RESOLVED with live 3/3. Re-read `qa/EVAL_TRACKER.md`,
`qa/reader-fit/BACKLOG.md`, and `git log --oneline -5` at session start; queues are
authority over this handoff. If more phonics-blender fixes landed since this was
written, they are additional R-series evidence, not conflicts with this brief.

## Ground rules (non-negotiable)

- **Derive-only.** This session writes the contract doc + queue updates. NO code
  changes to phonics-blender's component/generator/catalog, even if the derivation
  surfaces something broken — new findings get QUEUED in the owning register
  (reader-fit BACKLOG / EVAL_TRACKER) with an executor skill named. Sole exception:
  Task 3's two-line catalog rider, if taken.
- **Every R-requirement traces to a consumer + evidence; every G-gap traces to a
  NEAR-consumer + evidence** (probe score, verdict, audit finding). No wishes — those
  go to `/lumina-portfolio`.
- **OBSERVED requirements carry a runtime probe recipe** (eval-test route call,
  tutor-test invocation, jsdom test path, or saved replay). tsc is never a probe.
- If Task 3 is taken: typecheck exactly
  `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit` (project-local
  binary, absolute path) — zero NEW errors vs baseline; plus `npm run typecheck:lumina`.
- Shared multi-session files (EVAL_TRACKER, BACKLOG, WORKSTREAMS) may change on disk
  mid-session — re-read before editing.

## Task 1 — Derive `docs/contracts/phonics-blender.md`

Follow SKILL.md Phases 0–3 (including 2b gaps). File targets:

| What | Path |
|---|---|
| Catalog entry | `src/components/lumina/service/manifest/catalog/literacy.ts:117` |
| Generator | `src/components/lumina/service/literacy/gemini-phonics-blender.ts` |
| Component | `src/components/lumina/primitives/visual-primitives/literacy/PhonicsBlender.tsx` |
| jsdom band tests | `.../literacy/__tests__/PhonicsBlender.reader-fit.test.tsx` (7/7 as of 07-15) |

Evidence channels already known (start here, then sweep for more):

- **Reader-fit PRE (fresh, 2026-07-15):** `qa/reader-fit/phonics-blender-PRE-2026-07-15.md`
  + EVAL_TRACKER RF-1/RF-2 rows (~474–475). Expect R-requirements like: PRE-READER
  HOW-TO-PLAY aiDirective voices the play protocol at `[ACTIVITY_START]`/`[PHASE_TO_BUILD]`
  overriding the one-sentence cap; per-tap `[PRONOUNCE_SOUND]` stimulus; K band gate
  `isPreReaderGrade` → **letter-primary tiles** (sound still spoken on tap), adult
  chrome hidden, text feedback replaced by flash+SFX+spoken hint; **Check KEPT**
  (multi-part construction — same C3-class near-miss as sorting-station R7); tap a
  placed tile to remove (no Clear).
- **Live tutor lesson:** `qa/tutor-reports/phonics-blender-live-lesson-2026-07-15.md`
  (3/3 PASS, bespoke `build_phonics_blender_journey`) — the R5-style STIMULUS beat.
- **Grade fidelity (2026-07-15, `7cb5e5f`):** phonics-blender was one of the
  `clampGradeToK2` cohort — it read `ctx.gradeContext` prose and pinned to 'K', so
  grades 1–2 got kindergarten content. That fix IS a requirement ("grade 1–2 content
  tracks grade; K is not the default") — record it with the grade-discrimination
  probe from `qa/topic-fidelity/grade-fidelity-closeout-2026-07-15.md`.
- **Content contracts (2026-03):** EVAL_TRACKER PB2-1..3 (~626–628) + the phoneme
  validation incident (~174–178): silent-e is its own phoneme (no `a_e` underscore
  notation), every sound gets its own phoneme entry, irregular words excluded,
  cvce post-generation validation. These are R-series with oracle-style probes.
- **Audio identity:** phonics audio is **Gemini Live, not TTS**
  ([[audio-architecture-gemini-live]]) — any requirement touching sound goes through
  the live-tutor path.
- **Routing:** 2/6 K census lessons (`qa/reader-fit/BACKLOG.md` tally);
  `qa/topic-fidelity/phonics-blender-2026-03-15.md`; eval modes 4/4 pass (EVAL_TRACKER
  line ~19). Pull the authored long-tail too:
  `GET http://localhost:8000/api/curriculum/primitive-mappings/language-arts` (invert
  `.mappings`; try `language_arts`/`LANGUAGE_ARTS` casing if 404).

**Phase 2b close matches (G-series):**

```bash
cd backend && PYTHONPATH=$(pwd) ./venv/Scripts/python.exe \
  scripts/curriculum_fit_probe.py --primitive phonics-blender --domain literacy --grades K,1,2
```

(If `--domain literacy` isn't a valid mapping, check the domain→subject table in the
script header — the math run used `--domain math -> MATHEMATICS`.) Each gap: near-
consumer + score, shortfall as a testable property, fork rung + executor skill
(`/add-eval-modes`, `/add-spoken-judge`, band-gate…), relation to R-series with the
conflict ruling recorded NOW if it contradicts a requirement. Note
[[letterspotter-voice-blocked]]: letter-NAME voice tasks are an unbenched homophone
class — if a gap wants spoken letter names, mark it BLOCKED on the Voice Studio
bench, don't path it to `/add-voice-control`.

**Done when:** `docs/contracts/phonics-blender.md` exists with consumers table,
R-series (each with probe), conflicts (incl. any pre-detected), G-series from the
probe run, catalog projection diff (description/constraints vs evidence), changelog.

## Task 2 — Register the close in the same slice

- `qa/primitive-contracts/BACKLOG.md`: move phonics-blender (#6) to Done with date,
  requirement/gap counts, evidence pointers.
- `WORKSTREAMS.md` PARKED "Primitive contracts" row: update next-action + as-of.
- Do NOT reorder the reader-fit BACKLOG — if the contract suggests reader-fit work,
  add it as a queue item there and name `/reader-fit` as executor.

**Done when:** both registers updated; no other queue touched.

## Task 3 (rider, optional, bounded) — sorting-station catalog constraints projection

Unblocked by `7cb5e5f`. In `service/manifest/catalog/math.ts` sorting-station entry
(~line 2991), replace the constraints sentence `Max 4 sorting categories. Max 10
objects per challenge.` with the enforced reality: `Objects per challenge: 4–6 at
Kindergarten, 5–8 at Grade 1. Bins: max 3 at Kindergarten, max 4 at Grade 1.`
(Everything else in the constraints string stays.) Then: typecheck per ground rules,
append a line to `docs/contracts/sorting-station.md` changelog + flip the projection
bullet to applied.

**Done when:** math.ts edited, tsc 0-new + typecheck:lumina clean, contract changelog
updated. Skip cleanly if math.ts has unexpected local changes — report SKIPPED, why.

## Reporting back

End with a per-task verdict table — `DONE / DONE-NEEDS-FOLLOW-UP (what, queued where)
/ BLOCKED (on what) / SKIPPED (why)` — plus: requirement + gap + conflict counts, the
probe run's verdict lines (MATCH/ABSTAIN per grade), any NEW findings queued (register
+ item), and files touched. The main session folds this into WORKSTREAMS.
