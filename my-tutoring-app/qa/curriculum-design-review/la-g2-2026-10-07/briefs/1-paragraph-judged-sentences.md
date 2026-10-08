# Judged topic and closing sentences in paragraph-architect

Curriculum IDs: LA002-02-a, LA002-02-c (LANGUAGE_ARTS, grade 2). Source: design review la-g2-2026-10-07.

## Learning goal and gap

Grade 2 writers (LANGUAGE_ARTS, unit LA002 Writing, skill LA002-02 Informative Writing) learn to open an informative paragraph with a sentence that defines the topic, and to close it with a sentence that restates the topic without adding a new fact.

- **LA002-02-a:** "Introduce a specific topic using a clear introductory sentence paired with a simple definition... Examples: A mammal is an animal with fur, Sharks are fish that live in the ocean... Constraints: Use fill-in-the-blanks to complete topic introduction sentences."
- **LA002-02-c:** "Draft a concluding statement that effectively brings the informative paragraph to a close... reinforces the topic without introducing new facts."

paragraph-architect already gives the child the writing surface: frames, a model paragraph, and typed topic, detail and closing sentences. It never checks what the child wrote. Practice passes when the fields are non-empty, and picking a frame while leaving the blank empty already counts (ParagraphArchitect.tsx:540-545). The score adds points for parts being present (:693-697). Its three modes change only the prompt. So a child can earn credit with "Sharks are ___." or a closing sentence that adds a new fact. knowledge-check can test recognition (choose the best ending), but nothing tests production.

**Recommendation:** extend paragraph-architect with judged sentence modes rather than build a new primitive. The implementing session should confirm this after reading the component.

## Essential behavior

- **Define the topic.** The child completes or writes one opening sentence that names the topic, gives a category it belongs to, and gives one true feature.
- **Close the paragraph.** Given a body paragraph, the child writes (or, at a simpler level, chooses) a closing sentence that refers back to the topic and adds no new fact.
- **Feedback names what is missing:** the category, the feature, or "that is a new fact".

## Worked examples

- **Define:** topic *insect*.
  - Success: "An insect is a small animal with six legs."
  - Misconception: "Insects are cool." This is an opinion with no category or feature.
  - Misconception: "A bee is an insect." This gives an example instead of a definition.
- **Close:** a body paragraph about how bees collect nectar.
  - Success: "Now you know how bees make food for their hive."
  - Misconception: "Bees also have stingers." This is a new fact, not a close.

## Evidence of success

- **Independent evidence:** across 3 fresh topics, the opening sentence has a category and a true feature, and the closing sentence restates the topic with no new fact.
- **Should not earn credit:** an empty frame, an unchanged frame, a sentence about a different topic, or a close that adds a fact.
- **Uncertain cases:** loose categories ("a thing that..."). Decide whether a category that is true but very broad counts.

## Constraints and open questions

- Grade 2 spelling is unreliable. Judge the meaning, not the spelling.
- A spoken version (oral-sentence-studio already judges a spoken sentence by meaning) may suit weaker writers.
- Do not show the model paragraph's own opening or closing sentence while the child writes theirs.

## Handoff

Read the repository's current guidance (/add-eval-modes, the paragraph-architect contract if one exists) and related capabilities, then design, build and verify the mode with your own process. Schema, naming, judging approach and build order are yours to choose.
