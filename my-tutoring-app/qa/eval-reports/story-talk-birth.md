# Birth Certificate — story-talk (2026-07-05)

**Lifecycle layer: L0 (born)** — pedagogically sound, measurable, single core mode, generic tutor.

Source: POC-4 "story-talk — Listen & Tell" from the *K Spoken-First Primitives — Imagining* PRD
(artifact ed01651e). Serves the K Reading Comprehension / Speaking & Listening "recall key
details from a read-aloud" cluster (the largest remaining K ai-session block).

- Core task identity: `who_what_where` (literal recall of one picturable word heard in a short story)
- Generator fork: **B (orchestrator / content-bearing)** — one Gemini call authors a pool of 6-8
  self-consistent stories (story + question + answer + distractors together); code validates,
  reconstructs the 4-option set, enforces role variety, and rejects-never-fabricates. Story primitives
  lesson honored: the LLM authors the story WITH its answer; code never reconstructs a story around a fixed answer.
- Interaction at birth: **tap-based** — the tutor reads the story aloud (generic tutor via `useLuminaAI`/
  `sendText`), the child taps 1 of 4 picture options. The spoken-answer beat ("say it or tap it") is the
  receptive rung's sibling and is layered later (`/add-spoken-judge`); tap is what IRT falls back to anyway.
- sendText tags wired: `[ACTIVITY_START]`, `[NEXT_ITEM]` (read story w/ character voices), `[READ_AGAIN]`
  (replay button), `[ANSWER_CORRECT]`, `[ANSWER_INCORRECT]`, `[ANSWER_REVEALED]`, `[ALL_COMPLETE]`.
- Answer-leak audit — walked: story text, question, option labels, story title.
  - **The story text contains the answer verbatim** → it is HIDDEN while the child answers (audio-only
    listening); it surfaces only AFTER the answer (reinforcement) or as a no-live-tutor fallback. This is
    the primary leak gate and it doubles as the "listening comprehension = hidden text" pedagogy.
  - **Question** is code-gated to never contain the answer token (generator rejects leaking items).
  - **Options** are emoji-primary with a subtle word caption; the answer is shuffled (never always first);
    distractors are same-category (generator + QA G4 verified) so it can't be solved by elimination.
- Curriculum home: **MATCH LA006-03 @ K** (cosine 0.749, coherence 4/5, LA006 Reading-Comprehension family).
  Ladder rungs also have homes: LA006-02 (why questions) → `why_because`; LA007-01 (listen & retell) → `retell`.
- QA (eval-test, 3 runs / 15 challenges, 3 topics): G1/G2/G4/G5 all PASS, role variety every run, no fixes.

## Follow-up queue (run in order — each skill is the single source of truth for its layer)

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| 1 | `/add-eval-modes` | L1 eval-dense | Ladder candidates from the PRD: `feeling_check` (β≈3, emotion inference from events), `why_because` (β≈4, tap the cause picture), `first_next_last` (β≈4, order 3 event pictures — a sequencing render, code-owned story plan). Widen `StoryTalkChallengeType`, `answerRole` plan (add `feeling`, `cause`), and the metrics `challengeType` union. `retell` (β≈6) is **Tier-2 / phrase-judge — do NOT build until the short-phrase judge is benched** (Blend Judge Lab). Route modes to LA006-02 / LA006-03 / LA007-01. |
| 2 | `/add-tutoring-scaffold` | L2 tutored | contextKeys candidates: `question`, `answer`, `answerRole`, `storyTitle`, current story text. Struggles seen in QA: none (clean) — expected K struggles = mishearing a detail, choosing a same-category distractor, wanting the story re-read. aiDirectives must enforce: read expressively with character voices, NEVER voice the answer, hint via a story detail not the word. |
| 3 | `/add-support-tiers` | L3 tiered | Scaffolding intrinsic to the interaction that could withdraw: option COUNT (2→3→4 pictures), story length (3→4→5 sentences), distractor closeness (obvious cross-referent → tight same-category), replay availability (unlimited → 1 → none). |
| 4 | `/add-structural-difficulty` | L4 shaped | (requires L3) Story-primitive archetype (see memory `project_structural-difficulty-story-primitives`): constrain the response-schema per tier so the LLM authors a self-consistent story at that structural load — e.g. answer stated explicitly (recall) → answer requires 1-step inference (why/feeling). Never code-reconstruct. |
| 5 | `/add-sound` | L5 polished | 2-4 candidate sound points: correct-tap chime (already via SoundManager.playCorrect), wrong-tap (playIncorrect), story-start "page turn", session-complete flourish. |
| 6 | `/add-spoken-judge` | L5 polished | **Yes — this is a spoken-first primitive.** who_what_where is single-word → inside the shipped judge ladder (`useSpokenTurn`, Azure dual-signal → flash escalation, asymmetric outcomes; clone the PictureVocabulary spoken wiring). Add the mic beat as the expressive path with tap as fallback. The `retell` phrase mode still waits on the short-phrase judge bench. |
| ✓ | `/eval-test story-talk` | QA loop | Re-run after EVERY layer lands (`/eval-fix` for findings). Birth run passed 2026-07-05. |
