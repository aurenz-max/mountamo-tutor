# Oral Sentence Studio — primitive birth certificate

Date: 2026-09-09

## Identity

- Primitive ID: `oral-sentence-studio`
- Lifecycle state: L0 core challenge
- Core challenge type: `describe_scene`
- Curriculum scope: Kindergarten Language Arts
- Generation fork: Fork B, content-bearing three-slot orchestrator

## Learning contract

The child studies a meaningful scene and two visible vocabulary words, then says one original complete sentence that describes the scene and uses both words meaningfully. The scene remains visible throughout the attempt. No model sentence, answer frame, accepted response, or hidden scene interpretation is exposed before the verdict.

The semantic judge accepts natural paraphrases, ordinary child grammar, and multiple valid word orders. It separately identifies fragments, missing vocabulary, vocabulary misuse, and irrelevant or memorized sentences. Feedback first recognizes conveyed meaning, then gives one focused revision cue or a post-attempt model.

## Design gate

1. Direct manipulation: the child's utterance is the learning object; the microphone begins the judged production run.
2. Living-simulation exception: a stable visible scene is pedagogically appropriate for oral scene description.
3. Production pass: there are no choices, sentence frames, or pre-attempt model sentences.
4. Time pressure: none.
5. Answer leak: scene details and word meanings are public; `sceneMeaning` and three accepted sentence anchors remain private. The UI reveals a model only after a completed attempt.

## Runtime and evaluation wiring

- Shared judged-script runner and microphone panel are wired.
- Script tags: `[OSS_ITEM]`, `[OSS_MOVE]`, `[OSS_COMPLETE]`, and `[OSS_HEAR]`.
- Response class: `vocabulary_sentence`.
- Canonical metrics: challenge type, challenge count, correct count, attempt count, first-try count, hints viewed, accuracy, and average attempts.
- Multi-instance rendering is enabled.
- Current evidence is automated contract and generator QA. A live microphone/judge acceptance sitting is still required before these results should award adaptive mastery credit.

## Generator contract

Each generated payload contains exactly three independently generated scene challenges. Every challenge has a concrete actor/action/object/setting scene, exactly two target words with child-friendly meanings, a private scene meaning, and exactly three distinct valid sentence anchors. Invalid, duplicated, incomplete, or answer-leaking slots receive up to two bounded retries and then a validated local fallback.

## Curriculum fit

The Kindergarten probe returned `ABSTAIN — diffuse` with a best cosine score of `0.7988` and coherence `2/5`. Its first two results are the intended requirements `LA005-01-C` and `LA005-04-I`. This is a multi-family routing/coherence miss, not a content gap; the threshold should not be weakened.

## Verification

- Script and generator contract tests cover accepted paraphrases, three valid scene-event anchors, fragment rejection, irrelevant-sentence rejection, missing/misused vocabulary feedback, malformed payload rejection, deterministic index IDs, deduplication, and fallback validity.
- Focused TypeScript filtering reports no diagnostics for Oral Sentence Studio files or symbols. The repository-wide typecheck remains blocked by unrelated pre-existing diagnostics.
- Runtime QA: three post-fix sessions passed G1/G2/G4/G5 with 9/9 valid challenges, 27/27 valid semantic anchors, three distinct scenes per session, and 0/9 fallback challenges. G3 is not applicable at L0. See `qa/eval-reports/oral-sentence-studio-2026-09-09.md`.

## Follow-up queue

| Layer | Candidate work | Readiness input |
|---|---|---|
| L1 evaluation modes | Add `use_story_words` and `guided_writing_rehearsal` only after the single scene-description identity is stable. | Keep `describe_scene` as the default task identity. |
| L2 tutoring scaffold | Add contextual hints for fragment, missing word, misuse, and irrelevant response. | Context keys: scene, target words and meanings, challenge index, prior judge category. |
| L3 support tiers | Vary visible definition support, scene-label support, and post-attempt revision prompts. | Do not expose a model sentence before the attempt. |
| L4 structural difficulty | Progress from concrete two-word scenes to layered scenes and an additional required word. | Preserve semantic judging and sentence completeness at every tier. |
| L5 sound | The shared runner already owns recording and outcome feedback; consider word-card pronunciation only if cards become interactive. | No new decorative sound is required. |
| Spoken judging | `/add-spoken-judge` is not applicable because its single-word contract excludes free-form sentences. | Keep the shared free-form judged runner; complete a live semantic acceptance sitting before mastery credit. |
| QA loop | Re-run eval-test after each lifecycle layer and maintain the deterministic contract cases. | Use the harness sentences in `oralSentenceStudioScript.ts`. |
