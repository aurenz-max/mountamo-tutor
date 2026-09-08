# Curriculum fit: story-bridge — 2026-09-07

Live `backend/scripts/curriculum_fit_probe.py`, verbatim catalog description, literacy → LANGUAGE_ARTS, grades K and 1. Description-only regime (not a replayed student submission).

| Grade | Verdict | Best cosine | Skill-family coherence | Top match |
|---|---|---|---|---|
| Kindergarten | MATCH | 0.8154 | 4/5 (`coherent=5`, `coherent_skill=4`) | LA006-04-A — Identify basic story elements (main character, setting) in a single story |
| Grade 1 | abstain (diffuse) | 0.7507 | 1/5 | LA007-06-a — Listen to an audio passage and identify specific details |

191 published K candidates. Four of the five top results belong to Comparing Texts (LA006-04): A (0.8154), D "how two characters are alike" (0.8104), E "how two characters are different" (0.7992), B "Match similar characters from different stories using visual aids" (0.7922); LA006-03-J "Compare main ideas between two simple stories" sits at rank 4 (0.7931). The birth task identity is B; it ranks fifth but inside the family, so attribution lands on the right skill. Residual: the description could lead with "match … using visual aids" to lift B above A, which is a single-story skill this primitive does not assess. Grade 1 has no published comparing-texts skill, so the abstain is a curriculum fact, not a description defect. No curriculum or mapping changes made. A MATCH is a retrieval home, not verified content or assessability — see the eval report.
