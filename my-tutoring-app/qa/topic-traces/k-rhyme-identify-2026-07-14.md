# Topic Trace: "Identify the rhyming word from a spoken set of three" (kindergarten) — 2026-07-14

Scope intended by the topic: spoken rhyme identification (phonological awareness, ear-first, K).
Part of the 2026-07-14 K demand census (6 topics × LA/Math/SS) feeding the reader-fit backlog.

## Components

| Component | In scope? | Off-scope value / issue | Broken link | Fix target |
|-----------|-----------|-------------------------|-------------|------------|
| rhyme-studio (recognition) | ✓ | — | — | — |
| rhyme-studio (identification) | ✓ | — | — | — |
| poetry-lab (rhyme_hunt) | ✓ | routed + generated to spec (RF-4 shipped) | — | — |
| phoneme-explorer | ✗ | **beginning**-sound isolation for an **ending**-sound objective | GENERATOR | `gemini-phoneme-explorer` — isolate mode ignores the "ending phonemes" intent |
| word-sorter | ✓ | rhyme-bucket binary_sort, emojis present | — | — |
| phonics-blender | ✓ | -at family + -og contrast | — | — |
| concept-card-grid | ✓ (scope) | dense prose at K — reader-fit concern, not scope | — | reader-fit backlog |
| knowledge-check ×2 | ✗ (modality) | spoken-language skill assessed via **reading text words** (DOG/HAT/PEN MCQ, text matching_activity) at K | GENERATOR | knowledge-check PRE band-gate (reader-fit backlog) |

## Scope drops

### phoneme-explorer — generates beginning-sound challenges for an ending-sound (rhyme) objective
- **Chain:** objective "Compare the ending sounds of two words to determine if they rhyme" ✓ → intent "match words based on their ending phonemes" ✓ → data: `mode: "isolate"` challenges match by INITIAL phoneme (Cat→Cup share /k/, Dog→Duck share /d/)
- **Broken link:** GENERATOR — intent carried the ending-sound focus; the generator's isolate mode is onset-only and silently substituted the task
- **Fix target:** `gemini-phoneme-explorer` (ending-position support or manifest constraint against routing it for rime objectives)

### knowledge-check — wrong modality for K phonological awareness
- Rhyme identification delivered as text-word reading (MCQ options "dog/hat/sun" as text; matching_activity text-to-text). A pre-reader cannot attempt it; a reader is doing decoding, not phonological awareness.
- **Broken link:** GENERATOR (no PRE palette / picture-primary rule like deep-dive's quiz got)
- **Fix target:** reader-fit `--fix` on knowledge-check (systemic — appeared text-primary in all 6 census traces)

Note: poetry-lab `rhyme_hunt` round 1 candidate emojis are weak (mat→🧘, tail→🐕) — content-quality, in scope, oracle already guards structure.
