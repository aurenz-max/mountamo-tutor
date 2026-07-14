# Curriculum-Fit: interactive-book — 2026-07-14

**Domain → Subject:** literacy → LANGUAGE_ARTS  
**Query:** “Picture-rich, page-flippable nonfiction book for K-2 early literacy, print awareness, and text-feature learning. Students use high-image scaffolding to locate the printed title, author, headings, captions, and page numbers by voice or tap. Perfect for foundational find-feature practice before independent informational reading.”

## Results

| Grade | Verdict | Best cosine | Coherence | Best match |
|---|---:|---:|---:|---|
| K | **MATCH** | 0.7874 | 5/5 | LA006-06-D, locate headings in simple nonfiction texts |
| 1 | ABSTAIN (diffuse) | 0.7073 | 1/5 | LA005-07-a, word attributes |
| 2 | **MATCH** | 0.7951 | 5/5 | LA007-02-a, use captions/bold terms/index entries to navigate informational pages |

## Diagnosis

- **Kindergarten is a clean home.** All five nearest neighbors are in the LA006-06 Text Features family: headings, tables of contents, title/author/pictures, captions, and picture labels.
- **Grade 2 is a clean home.** The strongest result is the intended text-feature navigation skill, and the remaining neighbors support informational-text navigation and fact finding.
- **Grade 1 is not currently an honest attribution.** Retrieval is diffuse and does not surface a Grade 1 text-features cluster. This is a curriculum-graph/catalog coverage gap, not evidence that the primitive itself should be relabeled.

## Recommendation

Ship the primitive with K and Grade 2 curriculum attribution. Keep Grade 1 available as a generation/support band, but do not claim a specific Grade 1 curriculum node until the curriculum graph gains an appropriate text-features family or a future probe finds one.
