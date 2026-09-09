# Curriculum fit: oral-sentence-studio

Date: 2026-09-09

## Scope probed

- Subject: Language Arts
- Grade: Kindergarten
- Primitive summary: visible-scene description using exactly two target vocabulary words in one original complete spoken sentence; semantic judging accepts paraphrases and separates fragments, irrelevant responses, missing words, and word misuse.

## Result

- Verdict: `ABSTAIN — diffuse`
- Best cosine score: `0.7988`
- Coherence: `2/5`
- Top match: `LA005-01-C — Use new vocabulary words in complete oral sentences during guided activities`
- Second match: `LA005-04-I — Describe images or scenarios using multiple vocabulary words from a word bank` (`0.7857`)

The two highest-ranked candidates are direct intended homes for this primitive. The remaining top candidates come from adjacent sentence-structure and expressive-language families, so the current coherence rule does not produce three candidates from one family.

## Diagnosis

`MISS — scoping/retrieval coherence`, not a curriculum gap. The primitive deliberately combines vocabulary use, complete-sentence production, and scene description, while the curriculum represents those outcomes across multiple skill families. The catalog wording is specific and the grade scope is now restricted to Kindergarten.

## Recommendation

Keep the existing score threshold. Prefer explicit objective-level routing to `LA005-01-C` when the activity is assigned for vocabulary-in-sentences, and to `LA005-04-I` when assigned for word-bank scene description. If automatic attribution must choose one family, split the retrieval surface by instructional objective rather than broadening the primitive description.
