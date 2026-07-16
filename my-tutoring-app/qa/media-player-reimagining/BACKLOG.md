# media-player Reimagining — Workstream Queue

Promoted OUT of reader-fit #9a on 2026-07-16 (user call: "this is a big reimagining — record
and start building the 3 reading modalities"). Contract-first: **read
`docs/contracts/media-player.md` before every edit** (status CONFLICTED — C1's resolution IS
this stream). Census + probe evidence: `qa/topic-traces/media-player-census-2026-07-16.md`.

**Product thesis (user, 2026-07-16):** the catalog undersells media-player because we never
invested in it. Rebuilt band by band, its catalog identity should earn routing the way
deep-dive's does — a first-class *narrated listening-comprehension* surface, not a generic
"multimedia player."

## Step 2 — Modality map (the charter; ratified against Step-1 evidence)

One primitive, one narrated-segment walkthrough spine (contract R1), three band modalities
as **eval-mode task identities** (each its own β, per [[structural-difficulty-not-numeric]] —
these are task KINDS, not knob settings):

| Band | Eval mode | Task identity | Check surface | Near-consumers (evidence) |
|---|---|---|---|---|
| PRE (K) | `listen_and_look` · β −1.5 · scaffold 1 | Listen to a narrated picture story segment; answer ONE main-idea/key-detail question about what was HEARD | `PreReaderSelfCheck`: emoji-primary options, tap=choose, eliminate-until-correct, question+options voiced (merged script+check read-aloud beat) | K census routing (needs-vs-wants 07-16, community-helpers 07-14); probe LA006-03 "main idea from three choices after listening" 0.731 |
| EMERGING (G1) | `listen_for_details` · β −0.5 · scaffold 2 | Listen to narrated segments; identify SPECIFIC details heard | MCQ with SHORT options (1–4 words), 🔊 replay, select+submit retained | authored SS001-05-c/SS004-05-c (live, 2/2 routing); LA007-06-a/LA007-01-a — authored to PHANTOM `listen-and-respond`, unserved (probe 0.767/0.763) |
| ESTABLISHED (G2+) | `story_analysis` · β +0.5 · scaffold 3 | Listen + read along; recount, connect, and reason about the narration (why/how, which-detail-supports, what-order) | full-sentence MCQ; deep-dive-spirit question kinds inside the segment check | LA003 recount/evidence family — probe **MATCH 0.774**, 4/5 coherent |

Grade default when the resolver doesn't pin: K→`listen_and_look`, 1→`listen_for_details`,
2+→`story_analysis` (grade = ceiling). Boundaries (contract G5): production→read-aloud-studio,
decoding→decodable-reader, text-reading-with-evidence→interactive-passage. Deeper interaction
shapes (annotate/predict/spoken retell via clip-judge) are LATER LAYERS on these identities,
not new launch surfaces.

## Queue (top = next)

### B2 — EMERGING band polish (`listen_for_details`)
Short-option enforcement audit + 🔊 option replay at G1 (options are read by
[READ_KNOWLEDGE_CHECK] but there is no per-option replay button yet); `/eval-test` @ 1 ×3;
contract `--check`. (B1 already verified the G1 pin lands: `listen_for_details` valid on the
authored Independence-Day topic.)

### B3 — ESTABLISHED band (`story_analysis` depth)
Question-kind ladder inside the check (recount / evidence / sequence); consider a
sequence-events interaction (deep-dive graded-block spirit) as a follow-up layer;
`/eval-test` @ 2/3; decide the `media-player_default` calibration identity migration
(2 obs — retire or map; record in contract changelog).

### B4 — Curriculum reconciliation (backend, ships WITH the surface)
Re-point the phantom `listen-and-respond` mappings (LA007-01-a, LA007-06-a) to media-player
via draft → lineage-check → publish (NEVER edit curriculum_published; lineage records first).
`/curriculum-fit media-player` confirm; then re-run the G1 census (reader-fit milestone
piggyback). ALSO: `/tutor-test media-player` re-probe after the directive edits.

### B5 — Close-out
`/reader-fit media-player` PRE audit; live `--lesson --runs 3` @ K (bespoke journey in
`run_tutor_live.py`); pixel pass → HUMAN-CHECKS; contract refresh (C1 → RESOLVED, status
ACTIVE; catalog projection = APPLIED); strike reader-fit #9a; `/ship` slice.

## Done

- **Tester refactor + USER BROWSER-CONFIRMED 2026-07-16.** `MediaPlayerTester.tsx` rebuilt:
  controls = compact collapsible top bar (auto-hides on generate), primitive renders
  FULL-WIDTH (the old side-by-side layout clipped the two-pane card); canonical-grade
  selector (`config.objectiveGrade` → `ctx.grade`, the production path) + eval-mode pin
  selector (auto/3 modes) + stamped `gradeLevel`/`evalMode` summary chips; stale "Gemini TTS"
  info text corrected to Gemini Live. typecheck:lumina 0. **User tested in browser and
  confirmed the PRE band renders correctly ("this is great") — the B1 pixel/browser glance
  of the K picture-check is HUMAN-VERIFIED via the tester harness.** Still distinct and
  queued: B5 live `--lesson` @ K (tutor narration beats in a real lesson session — the
  tester doesn't exercise the live tutor connection).
- **B1 — Foundations + PRE band — DONE 2026-07-16 (runtime-verified; uncommitted, rides the
  coordinated multi-session `/ship`).** Generator rebuilt (object schema + short `lessonTitle`
  → **MP-1 cleared**; `gradeToBand(ctx.grade)`+`buildGradeLine`+scope; stamps
  `gradeLevel`+`evalMode`; 3 mode docs w/ grade defaults; flat PRE emoji fields → validated
  `optionEmojis`). Component PRE branch (merged `[MEDIA_CHECK_READ_ALOUD]` beat, no
  double-speak; `PreReaderSelfCheck` per segment, first-try=mastery; PRE intro + icon-primary
  visuals; intro overflow hardening → **MP-2 cleared**; reader path unchanged). Catalog: 3
  evalModes (**MP-3/SP-13 cleared**) + listening-comprehension identity rewrite + PRE
  directives (contract projection **APPLIED**). **Verified:** eval-test draws 3/3 bands clean;
  post-rewrite manifest traces pin `listen_and_look` @ K + `listen_for_details` @ G1 (both
  valid — the curator routes on the new identity); jsdom **4/4**
  (`MediaPlayer.reader-fit.test.tsx`); full suite **804/804**; `typecheck:lumina` 0. Contract
  C1 → **RESOLVED** (changelog entry in the contract). Residuals queued: `/tutor-test` probe
  re-run (B4), live `--lesson` @ K + pixel pass (B5), EVAL_TRACKER MP-1..3 strike at ship time
  (shared file — avoid mid-flight collision).
- **Step 1 (contract) — 2026-07-16** — `docs/contracts/media-player.md` derived (8 R, 1 open
  C, 5 G, 3 standing defects); fresh census + LANGUAGE_ARTS probe; phantom `listen-and-respond`
  discovery. See `qa/primitive-contracts/BACKLOG.md` Done entry.
