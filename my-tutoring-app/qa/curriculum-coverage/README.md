# K Language Arts coverage audit

**Build update, 2026-09-07:** Letter Workshop's first assisted-tracing task is now implemented and browser-tested. See [build status](build-status.md) for the implementation queue and remaining copy/independent writing work. The frozen coverage findings below are not promoted by this build.

Open [the HTML atlas](index.html). It is the primary report: 191 live published
requirements, explicit primitive/mode reviews in both directions, generated task
previews, and a grouped development queue with acceptance criteria.

Open [the design studio](design-studio.html) for 12 visual design themes covering all
35 requirements that have no reviewed primitive candidate. Each theme has three
authored storyboard frames, visual direction, a bounded first task, answer-visibility
rules, feedback, evidence requirements and an explicit treatment for every mapped
curriculum requirement. These are design studies, not implemented or evaluated learning
primitives. Classroom movement, peer performance and audibility retain their observation
requirements. `design-themes.json` is the authored source; the artifact build validates
that every unmapped requirement has exactly one theme and rebuilds both HTML files.

All 31 development tasks now include an authored modality prescription: stimulus,
student response, answer visibility, feedback timing and scored evidence. These appear
on each affected requirement and in the queue. Riddle masking and trace/copy/write have
visual design previews, explicitly distinct from observed generated-content previews.
These prescriptions describe work to implement; they do not change runtime behavior
or promote a finding to verified coverage. `modality-prescriptions.json` is the shared
source; the artifact build rejects missing prescriptions.

Letter formation has two existing display-only `LetterTracing` components. Neither
captures drawing or scores strokes. The recommendation is to reuse those displays and
inspect tracing infrastructure, then implement an evaluated letter-writing interaction.
This is not a claim that the repository has no writing-related code.

The current catalog now contains 202 primitives. The added `di-worked-procedure`
is restricted to multi-digit subtraction and has no K Language Arts home. Comparing
the catalog exports confirmed all previous capabilities were unchanged. The reviewed
catalog baseline records this check; saved probe hashes remain untouched, so the atlas
conservatively marks those draws as needing revalidation while retaining their findings.

2026-09-07 scope: 47 direct candidates, 109 partial fits, 35 development requirements.
These are catalog capability findings, not verified learning outcomes. Six pairs were
probed with two fresh generation draws each: 12 draws, 62 usable post-conversion items,
five draws with confirmed content findings. Production item/cue conversion ran; live
microphone interaction did not. Existing generator/script/render suites: 183/183 passed.
The specific failures remain failures despite those code tests and the endpoint's pass.

Run from `my-tutoring-app`, in order, checking each command succeeds:

```text
node scripts/curriculum-coverage-snapshot.mjs
python scripts/curriculum-coverage-review.py
node scripts/curriculum-coverage-probe.mjs
node scripts/curriculum-coverage-check.mjs
node scripts/curriculum-coverage-artifact.mjs
node --test scripts/curriculum-coverage-artifact.test.mjs
```

Snapshot needs the backend on 8000; probes use the frontend on 3000 and its configured
Gemini service. Probes reuse exact-input/source-hash evidence; change the source or remove
the specifically selected draw files to request fresh samples. This is a bounded pilot,
not a generic all-subject CLI yet. No published curriculum or student records are changed.

`review.py` contains explicit reviewed decisions, not a keyword classifier. The frozen
`review-basis.json` rejects curriculum/catalog drift until affected decisions are reviewed.
The atlas validates edge IDs/modes and marks source-changed content evidence stale.

Legacy `ai-tutor-session` appears only under provenance. It supplied no fit decisions.
Full generated payloads live in `evidence/`; the HTML embeds human-readable previews
and check results, so reading JSON is unnecessary. Different subject/grade snapshots
need their own reviews and must not inherit these decisions.

The next slice is the P0 repair queue in the atlas: empty subject-verb practice and
riddle answer pictures. Picture-pair tasks, K sentence construction and letter writing
are separate capability investments, not reasons to weaken curriculum requirements.
