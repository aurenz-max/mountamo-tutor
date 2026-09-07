# Topic-driven phonics evaluation

2026-09-07. Input: **learn about phonics sitpin**. Kindergarten. No tester-authored objectives, exact-letter restriction, or mandatory list of phonics subskills.

## Answer

The existing pipeline selected a useful, varied range of experiences for the three generated objectives. Exemplar-assisted selection also went beyond letter drills, but did not demonstrate an improvement. In these runs, production supplied a more explicit path through introduction, spoken production, and reading. The experimental shortlist omitted useful direct-instruction primitives: this exposes an incomplete candidate pool rather than establishing that exemplar retrieval is inherently inferior.

The user affirmed the three objectives as appropriate. Absence of separate onset/rime, segmentation, or spelling objectives is **not a defect**. Those may be supporting experiences within the objectives; lesson completeness is not a checklist of every phonics skill.

## Shared live objectives

1. Hear and produce individual letter sounds for s, i, t, p, and n. (`apply`)
2. Identify the written shapes of the letters s, i, t, p, and n. (`identify`)
3. Blend the sounds together to read simple words. (`create`)

The live `generateIntroBriefing` authored this set once. The brief and objectives, including verbs, were shared unchanged across two builds per arm. This measures selection/generation variability on one authored lesson, not objective-authoring variability.

## Learning experiences

| Objective | Current pipeline across two builds | Exemplar-assisted across two builds |
|---|---|---|
| Hear/produce sounds | Letter-sound practice and dedicated spoken sound instruction; one build also opens with concept cards | Produce sounds from letters, then select letters from heard sounds; one build adds initial-sound isolation |
| Recognize shapes | Concept cards or foundation-explorer plus letter search | Letter search plus uppercase/lowercase matching |
| Blend/read | Phoneme tiles, constructive spelling, dedicated spoken word reading | Phoneme tiles and printed-word/picture matching; one build also includes constructive spelling |
| Closing | Knowledge-check | Knowledge-check |

Both cast a sensible net over the objectives. Production combines explanation, practice, manipulation, and direct spoken application. The experiment supplies complementary recognition experiences, especially case matching and word meaning, but concentrates more heavily on practice and matching. This is a qualitative payload/selection review, not a human playback rating.

Constructive spelling can support sound-to-word understanding without being direct evidence of decoding. It is not useless because the objective says “read.” Likewise, additional CVC words are not automatically failures. No learner letter-mastery history was supplied, so the judge's claims that additional letters are “untaught” exceed what is known about the learner.

Some generated sets move from `sit/pin` blending into `cat/dog/cup` spelling. The useful review question is whether that transition is introduced and productive, not whether every word contains five fixed letters. Browser playback and a human rating remain unperformed.

## Unchanged judge and scorer

| Arm | Build 1: objectives sufficiently assessed | Build 2 | Generation time, excluding shared brief/judge |
|---|---:|---:|---|
| Production | 3/3 | 3/3 | 34.75 s; 35.62 s |
| Exemplar-assisted | 2/3 | 2/3 | 20.47 s; 30.02 s |

These are raw instrument readings, not holistic lesson-quality scores. Both experimental warnings concern objective 1. Build 1 omits `i` from sound-production targets. Build 2 includes the production targets but omits `n` from hear-and-select; the judge flags the amount of evidence. Production provides another spoken sound activity.

**Instrument caveat:** experimental build 2 also receives the claim that `see_hear` cannot judge t/p. Current `letterSoundLinkScript.ts:119–149` includes these clipped stops, while catalog prose still describes held-only production. That claim is unsupported by current implementation and must not become a primitive ban. The judge also recognizes embedded instruction inconsistently: build 1 marks experimental activities untaught, while build 2 credits similar modes. Raw labels are retained, not manually rescored.

All four evaluations completed without schema fallback or digest truncation. All packages passed `parseLessonPackage`, and every generated component returned data. Code checks found no invalid pinned modes or tap-only-production gate failure. The generic symbolic-opening citation on phonics blending is not by itself proof of inappropriate instruction. Human-only checks remain unrated.

## Experimental limitation and next step

The exemplar corpus comes from the literacy catalog file. It excludes `di-letter-sounds` and `di-word-reading`; neither was in the experimental candidate pool. Production selected both in both builds. Subject relevance crosses catalog-file boundaries: one catalog module does not contain every literacy capability.

Experimental retrieval unions the top eight hybrid primitive/mode pairs per generated objective with the core/assessment pool, adding reviewed capability notes. It reuses the captured production manifest prompt, model settings, objective-block structure, and native flattening. Exact task bindings replace the separate mode resolver. Retrieval, metadata, and joint mode selection change together; their effects are not isolated.

Manifest selection used `gemini-flash-latest` in both arms. Production additionally used `gemini-flash-lite-latest` for mode resolution. Generators and judge were unchanged. Timings include experimental retrieval, exclude offline corpus construction and the shared brief, and are too few/concurrency-sensitive to establish a general speed benefit.

The next comparison should preserve topic authoring and these objectives, expand retrieval across the live catalog, and retain description retrieval for primitives without exemplars. Test whether exemplars preserve strong instructional/spoken choices while finding useful alternatives. Keep capability facts current in both selector and judge. Do not add objectives or an inferred letter whitelist to make the benchmark stricter.

No production code or judge rules were changed.

## Artifacts

- [Shared live brief](first-topic-run/fixtures/phonics-sitpin.json)
- [Protocol and source hashes](first-topic-run/protocol.json)
- [Exact per-objective streams and package links](first-topic-run/STREAMS.md)
- [Machine-readable results](first-topic-run/summary.json)

From `my-tutoring-app`, using existing Gemini credentials:

```powershell
node scripts/literacy-topic-ab.mjs --run --out qa/lesson-planner/literacy-topic-ab/new-run
```
