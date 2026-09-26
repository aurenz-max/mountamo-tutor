# Workspace rollout C7: genre-explorer, text-structure-analyzer, sentence-analyzer, read-aloud-studio (2026-09-26)

Queue: [`qa/workspace-rollout/ROLLOUT.md`](../workspace-rollout/ROLLOUT.md) row C7. Executor: `/add-live-tutor-tools`.

## What shipped

Four of the five Grade 1–6 literacy families now run only on the teaching workspace, with every catalog mode
bound (one-path ruling 09-23). The fifth, `oral-sentence-studio`, is held for a ruling (below).

| Primitive | Commit | Items | Production (+/−) |
| --- | --- | --- | --- |
| genre-explorer | `a7cdc839` | One spoken answer: yes or no about what is in a text, which of two texts something is true of, or the kind of writing from the printed menu. At grades 1–2 the ask carries the text for the tutor to read | +200 / −115 |
| text-structure-analyzer | `c1fcae9f` | One spoken answer: the linking word of a numbered sentence, the structure from the printed menu, or the labelled part an idea belongs in. The passage is never read aloud | +208 / −125 |
| sentence-analyzer | `6ae427fa` | One spoken grammar label: part of speech, job in the sentence, subject or predicate, kind of sentence | +192 / −113 |
| read-aloud-studio | `1d38ee93` | One printed line read aloud, judged word for word. Expression's phrase plan is a checked gesture that always commits (page work, never graded), then a first read and the modeled reread; only the reread is scored | +194 / −122 |
| harness | `929ee350` | Drain the runtime driver's stderr during a drive (below) | +3 / −2 |

Production +797 / −477. Tests +1,163 / −131: four `<X>.workspace.test.tsx` files, eight w1 payloads (most of the
lines), the runner-mock `ReadAloudStudio.phrasing.test.tsx` ported and deleted, and all four families left the
shared runner-mock Pip suite (`StimulusRunners.surface.test.tsx`); each workspace test now carries its Pip case.

Carried over and now tested on the workspace:

- A finding, a linking word, a grammar label or a genre badge reaches the screen only from a credited item (each
  surface keeps its own credited set in place of the runner's `solvedIds`).
- text-structure-analyzer: no task says a sentence of the passage; the structure menu keeps its per-instance order,
  now shared by component, adapter and journey (`textStructureItems`).
- read-aloud-studio accuracy: the task never says the line. Expression: marks toggle, the plan commits once and
  carries into both reads, the model groups appear only on the reread, marks reset per line, a one-phrase plan is
  fine, and a missed first read does not reach the line's score.

## Behaviour changes (recorded)

- The tap-to-hear / "Say that again" buttons are gone on all four; with the tutor present, the learner asks it to repeat.
- read-aloud-studio loses the runner's 1100 ms voice-turn floor for connected text. The workspace observes after the
  provider's own turn completion. No split read showed up in the two drives; a human sitting is the real check.
- Catalog descriptions that said the tutor's own affirmation advances the lesson now say a credited answer does.

## Smoke drives (`--lesson-entry --progression-only`)

| Row | Result | Raw file |
| --- | --- | --- |
| genre-explorer classify_genre text | PASS after the harness fix (three earlier runs failed on the harness defect; one kept as `.r1`) | `genre-explorer-w1-classify_genre-text-2026-09-26.json` |
| genre-explorer identify_basic `--audio` (Grade 1) | PASS | `genre-explorer-w1-identify_basic-audio-2026-09-26.json` |
| text-structure-analyzer cause_effect text | PASS | `text-structure-analyzer-w1-cause_effect-text-2026-09-26.json` |
| text-structure-analyzer chronological_description `--audio` (Grade 2) | PASS ×3 (guidance change between runs) | `…-chronological_description-audio-2026-09-26.json`, `.r2`, `.r3` |
| sentence-analyzer identify_pos text | PASS | `sentence-analyzer-w1-identify_pos-text-2026-09-26.json` |
| sentence-analyzer parse_structure `--audio` | PASS | `sentence-analyzer-w1-parse_structure-audio-2026-09-26.json` |
| read-aloud-studio accuracy text | PASS | `read-aloud-studio-w1-accuracy-text-2026-09-26.json` |
| read-aloud-studio dialogue `--audio` | PASS | `read-aloud-studio-w1-dialogue-audio-2026-09-26.json` |

Undriven modes, each covered by its workspace test on hand-built or generated items: genre compare_genres;
text-structure compare_contrast and problem_solution; sentence identify_role and label_all; read-aloud expression
(its phrase plan has no wrong answer to give, so the journey row throws with the mode's name).

## Harness defect found and fixed (`929ee350`)

genre-explorer's build gates log "held back N items" through `console.info` on every driver step. The driver sent
`console.info` to stdout, which broke the JSON-line protocol at mount; once redirected to stderr, the harness's
unread stderr pipe (4 KB on Windows) filled after about 35 steps and the driver blocked mid-drive, so the drive timed
out while the tutor was still reading the fable aloud. The harness now drains stderr in a thread and keeps the tail
for the "driver ended" error. Any family that logs per render would have hit this.

## Findings (recorded, not patched)

- **text-structure-analyzer: the tutor's own wording said the answer before the attempt.** On a time-order passage
  it asked about "the first sentence" when the linking word was "First" (the pack said "sentence one" for exactly
  this reason). A guidance sentence (name sentences by number; your own "first", "next", "then", "last" can be the
  answer) moved r2 to "sentence one" but r2 still asked "what happens next?" before "Next", and r3 said "the first
  sentence" again. Leaked in 2 of 3 audio drives. The sentence stays (it did not regress anything). Next step is W2:
  for example, highlight the asked sentence at every tier so the tutor can say "the highlighted sentence", or have
  the observer mark such a credit as exposed. Queued in ROLLOUT under W2.
- **After a wrong answer the tutor often gives or nearly gives the answer** (genre: "a god brings the sun across the
  sky"; sentence: "words that describe nouns"; text-structure: "the word at the very beginning of the sentence").
  C5's cross-family finding, now in seven families; the scoring question stays with `$student-data-loop`.
- **The credit line repeats once after the advance** in genre, sentence and read-aloud (for example "That's right!
  Dogs is a noun…" twice, about 7 s apart). Also visible in the C5 matter-explorer control run. Harmless to
  progression; a cross-family tutor behaviour to watch, not a W1 defect.
- **read-aloud dialogue: the tutor modeled each line but dropped the hand-over** ("say it like Mia"). The drive's
  learner read anyway; a real child may wait. Same family as C3/C4's shortened asks.
- **text-structure cause_effect: the first tutor turn was a LaTeX blob** (`$$\begin{array}…`) instead of the ask;
  it recovered on the next turn. Same family as C2's markdown "Answer Key" output. Recorded once.
- **genre at grade 3+: the tutor read every text aloud.** Harmless here (no text names its genre), so the guidance
  now permits it rather than forbidding something the tutor ignored.

## Held: oral-sentence-studio (needs a ruling)

The catalog entry has no `evalModes`, so `pinnedModes` finds nothing to pin, the family can never bind, and a
workspace-only switch would leave it showing only the needs-the-tutor card. Binding it takes one catalog mode
(`describe_scene`, the only challenge type; the generator needs no change). That gives the `vocabulary_sentence`
class an IRT prior and mode-keyed evidence, while its contract (`teachingItemContract.ts`) says a live
microphone/judge acceptance sitting is owed "before adaptive mastery credit". That is student-record semantics, the
user's call. Also to re-base on adoption: the pack's "two-correction cap is load-bearing" (workspace progression has
no cap; the observer's committed outcome advances). Until then it stays on its runner.

## Checks

- `typecheck:lumina` 0; full `tsc` 770 (baseline 770).
- Literacy, live-activity, pip and service/literacy: 181 files, 3,030 tests pass (4 skipped).
- The generic W1 contract passes on the eight new payloads.

Human acceptance (browser and mic) remains open under HUMAN-CHECKS #167, in particular read-aloud's connected-text
turn-taking without the 1100 ms floor.
