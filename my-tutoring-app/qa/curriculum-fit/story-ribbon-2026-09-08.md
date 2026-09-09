# Curriculum fit: story-ribbon — 2026-09-08

Live `backend/scripts/curriculum_fit_probe.py`, using the verbatim catalog description, `literacy` → `LANGUAGE_ARTS`, grade K. This is a description-only retrieval probe, not evidence that a generated item teaches or assesses the skill.

| Grade | Verdict | Best cosine | Coherence | Top match |
|---|---|---:|---:|---|
| Kindergarten | abstain (`diffuse`) | 0.8479 | 2 coherent results; 1 coherent skill family | LA006-01-C — Sequence 3–4 major story events using picture cards and label beginning, middle, and end |

The nearest neighbors are pedagogically plausible: LA006-01-C at 0.8479, LA003-02-E (sequence events with transition words in personal stories) at 0.8448, and LA007-01-A (retell a simple story in one's own words using sequential terms) at 0.8361. The probe still abstained because those strong matches span several skill families and did not meet its minimum coherence of 3.

Conclusion: Story Ribbon has strong Kindergarten oral-storytelling neighbors, but this run does not justify pinning a single curriculum attribution. No curriculum or mapping changes were made. Reprobe after the later `story_to_experience` and tense modes are split into explicit task identities rather than broadening the L0 catalog description.
