# oral-sentence-studio — L1 eval modes, 2026-09-26

Modes added (catalog + `problem_type_registry.py` + `discrimination_priors.py`):

| evalMode | β | a | Task |
|---|---:|---:|---|
| `describe_scene` | 3.5 | 1.6 | Describe the pictured scene with two shown words |
| `guided_writing_rehearsal` | 4.0 | 1.6 | Say the sentence for the next step of a class recipe/how-to/story; order word (code-assigned) + vocabulary word |
| `use_story_words` | 5.0 | 1.0 | Hear a 2-3 sentence story, reuse both words in a new sentence; a story line said back is refused |

Mixed (`evalMode=mixed` / no pin, no intent) schedules one of each, easiest first.

## Runtime probe (eval-test route, K, topic "Using new vocabulary words")

- Pinned runs: 2 sessions per mode before the fix, 2 per new mode after. 36/36 challenges matched the pinned type. Fallbacks: 1/36.
- Mixed: 2 sessions, each `describe_scene → guided_writing_rehearsal → use_story_words`.
- Fix applied between rounds: rehearsal order word was "then" in 5/6 slots; now code assigns it per slot (next, then, last; a retry shifts one along). Story-word anchors mentioned family ("My little sister"); the prompt now forbids family members and asks for the clearest sentence first, since `acceptedSentences[0]` is shown after the attempt.

## Open

- Anchor quality: one rehearsal anchor misused its word ("a quiet story"). Anchors are judging examples, but `[0]` is shown to the child as a model.
- Scene variety: library, garden and park scenes and the word "happy" recur across sessions (behaviour since L0, via `VARIETY_INSPIRATIONS`).
- Not exercised: intent resolution (`/topic-trace`), UI rendering of the story panel and prior-step chip (needs a browser check), live judging of the new copy and wrong-step refusals (needs a live sitting).
