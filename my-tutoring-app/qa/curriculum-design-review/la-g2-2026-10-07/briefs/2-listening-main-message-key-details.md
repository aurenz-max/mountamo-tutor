# Listening for the big message and the key details

Curriculum IDs: LA003-01-b, LA003-01-a (LANGUAGE_ARTS, grade 2). Source: design review la-g2-2026-10-07.

## Learning goal and gap

Grade 2 listeners (LANGUAGE_ARTS, unit LA003 Listening Comprehension and Oral Language, skill LA003-01 Recounting Key Details) learn to tell the whole-story message apart from single details, and to pick the details that matter most.

- **LA003-01-b:** "Students analyze a read-aloud passage to extract the main idea or central message... the student chooses the one best sentence that summarizes the entire passage from a list of distractors."
- **LA003-01-a:** "Students listen to short audio passages and select the most important facts to summarize the core events... a 100-word audio track followed by multiple-choice options to identify the top three key facts."

What exists now:
- **story-talk:** listening-only, but its stories are 3-5 sentences, the answers are single words, and it has no main-idea mode.
- **media-player `story_analysis`:** has no main-idea question type. In the grade 2 probe it narrated the summary sentence before asking for it, and it keeps the script printed during questions at grade 1+.
- **passage-studio:** text-first.
- **decodable-reader `main_idea`:** requires the child to read the passage.
- **Importance:** nothing asks the child to choose which facts matter most.

**Recommendation:** add two listening modes to one owner. story-talk is the likely owner because it is already audio-only and tutor-read. The implementing session may choose a different owner.

## Essential behavior

- The passage is heard, not shown, while the child answers. A re-listen control is fine.
- Passages are 80-120 words, one coherent story or short report.
- **Main message:** the child chooses (or says) the sentence that fits the WHOLE passage. The distractors are true but narrow details plus one off-topic sentence.
- **Key details:** the child keeps the 3 facts needed to retell the core events and leaves out 2-3 facts that are true but minor.

## Worked example

Passage: Pip the squirrel shares acorns with a hurt neighbor, and both end up happy.
- **Main message:**
  - Success: "Being kind to a friend in need makes everyone happier."
  - Misconception: "Ollie hurt his paw." This is true but only one detail.
- **Key details:**
  - Keep: Ollie was hurt and hungry; Pip shared his acorns; both were happy.
  - Leave out: the acorn pile was giant; the tree was hollow.

## Evidence of success

- **Independent evidence:** over several fresh passages, the child picks the whole-story sentence and an important-facts set without the text visible.
- **Should not earn credit:** an answer visible in the narration or on screen, or a set that includes a minor fact. Decide whether 2 of 3 earns partial credit.
- **Uncertainty:** "important" is a judgment. The generator must make the minor facts clearly minor (decorative, not causal) so the key is defensible.

## Constraints and open questions

- No narration may state the answer or the summary.
- Tap or spoken response? Choosing three items by voice is harder; tapping cards with picture support may suit grade 2.
- Fix the media-player leak separately (tracker MP-SA1); do not route around it.

## Handoff

Read the repository's current guidance (/add-eval-modes, /add-live-tutor-tools, story-talk and media-player contracts) and decide the owner, response form and scoring yourself. Build and verify with your own process.
