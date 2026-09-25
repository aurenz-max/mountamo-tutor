# Workspace rollout C3: decodable-reader, interactive-book, story-bridge, story-ribbon (2026-09-25)

Queue: [`qa/workspace-rollout/ROLLOUT.md`](../workspace-rollout/ROLLOUT.md) row C3. Executor: `/add-live-tutor-tools`.

## What shipped

All four K reading and oral-language families now run only on the teaching workspace, with every catalog mode
bound (one-path ruling 09-23). All four were runner-era (R). Each moved straight to `withWorkspaceOnly` +
`useWorkspaceRunner`.

| Primitive | Commit | Items | Production (+/−) |
| --- | --- | --- | --- |
| decodable-reader | `762f476f` | Every item is spoken: a printed line read aloud cold, a one-word answer from the story, or the right printed choice said aloud | +212 / −110 |
| interactive-book | `2e6c6ce5` | Read the glowing word is spoken; find a book part is a tap the activity checks | +229 / −115 |
| story-bridge | `84d01c56` | Four tap modes the activity checks; say alike, say different and compare big ideas are spoken comparisons | +223 / −49 |
| story-ribbon | `0f7f6907` | One spoken account per item; the card board is a planning aid and is never graded | +202 / −72 |
| shared | `637f2553` | `runtime/sceneFacts.ts` and a generic W1 contract case (below) | +22 / −1 |

Each family has a `<X>.workspace.test.tsx` (every catalog mode, wrong then Try again, credit, a single completion,
the hear-again request, and Pip) and two w1 payloads. The four runner-mock Pip suites (`pip/<X>.surface.test.tsx`)
were deleted; their Pip cases now mount under the real runtime.

Properties carried over and now tested on the workspace:

- **decodable-reader:** a read line is read cold. The ask never carries the line, and the guidance says never to
  read it before the learner tries. In read-along the tutor reads the whole story first. An answer word is shown
  only after credit.
- **interactive-book:** the tutor reads the lead-in up to the glowing word and stops. The key for a tapped book part
  never reaches the tutor. `hotspotsFor` moved into the pure module, so the journey taps the real printed parts.
- **story-bridge:** the evidence panel appears only after credit. A tap key never reaches the tutor. A spoken
  comparison is credited for any true comparison across both stories, but not for a detail about one story.
- **story-ribbon:** the scene lists the picture labels alphabetically, so the list never gives the story order.
  Each item carries its tier's reveal policy. Try again keeps the learner's board.

Harness: a family whose items come from several fields (decodable-reader: a story's lines, then its questions) is
now driven whole. Before, the pool was trimmed to two items.

## Smoke drives (`--lesson-entry --progression-only`)

| Row | Result | Raw file |
| --- | --- | --- |
| decodable-reader literal text | PASS | `decodable-reader-w1-literal-text-2026-09-25.json` (4 lines + 2 questions; no line read before the learner) |
| decodable-reader read_along `--audio` | PASS | `decodable-reader-w1-read_along-audio-2026-09-25.json` |
| interactive-book find-feature text (tap) | PASS | `interactive-book-w1-find-feature-text-2026-09-25.json` |
| interactive-book read-focus-word `--audio` | PASS | `interactive-book-w1-read-focus-word-audio-2026-09-25.json` ("The tall red..." then stopped) |
| story-bridge match_character text (tap) | PASS | `story-bridge-w1-match_character-text-2026-09-25.json` |
| story-bridge say_alike `--audio` | FAIL r1, PASS r2 | `story-bridge-w1-say_alike-audio-2026-09-25.json` (r1 kept, below), `...-r2.json` |
| story-ribbon tell_past_account text | PASS | `story-ribbon-w1-tell_past_account-text-2026-09-25.json` |
| story-ribbon tell_connected_account `--audio` | PASS | `story-ribbon-w1-tell_connected_account-audio-2026-09-25.json` |

## Found and fixed (shared)

- **A scene fact over 500 characters makes the observer refuse every judgment on that item.**
  `validDialogueRequest` caps each fact at 500 characters. A request over the cap abstains in 0 ms with reason
  `unavailable`, so no spoken answer on the item is judged and the lesson times out. On story-bridge r1, both stories
  were in one fact of about 620 characters: two answers, two refusals, then a timeout. The fix is
  `runtime/sceneFacts.ts` `textFacts(key, text)`, which splits long text at sentence boundaries. It is used by
  story-bridge (one fact per story) and by decodable-reader's read-along story. The generic W1 contract now builds
  each saved payload's observer request and checks it with `validDialogueRequest`. All bound families pass. Before
  the split, story-bridge's saved `say_alike` payload failed the check.

## Findings (recorded, not patched)

- **Praise for a true but incomplete answer.** On story-bridge say_alike, the learner said something true about one
  story only ("Leo was in one story"). The tutor opened "That's right, Leo was in Fun At The Park!", then asked for
  the comparison. The observer did not credit it and the item stayed open, so the outcome is correct. A child still
  hears "that's right" for an answer that did not count. This is the intermediate-praise shape in the TW matrix. It
  is not specific to this primitive.
- **The stories were summarised, not read.** On story-bridge say_alike, the opening gave one sentence per story
  ("Leo shared his fast red car…") instead of reading both five-sentence stories. The guidance says to read both
  stories aloud. The comparison task still worked, but the stories were never read in full.
- **Account length and the voice-turn close.** The story-ribbon runner closed a learner turn after 1600 ms of
  silence. On the workspace the lesson default is 900 ms. A child pausing mid-story may have one account split into
  two turns. Synthetic audio has no pauses, so the drives cannot show this. It needs a mic check (#167).
- **decodable-reader's connected-text close.** The runner used 1100 ms. Lessons already used the 900 ms default
  before this slice. That is unchanged and needs the same mic check.

## Checks

- `typecheck:lumina` 0.
- live-activity + literacy + pip + literacy service + diagnosis suites: 2868 passed, 4 skipped.
- Generic W1 contract: every saved payload of every bound family, including the new observer-request case.

Human acceptance (browser and mic) remains open under HUMAN-CHECKS #167.
