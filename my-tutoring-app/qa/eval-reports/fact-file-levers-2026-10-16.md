# fact-file levers, 2026-10-16

Built with the W1 binding (`../tutor-reports/fact-file-w1-2026-10-16.md`). Code: `factFileLevers.ts`.
`config.difficulty` easy starts with the section note on screen (a starting position, not recorded as a pull).

## Failure inventory
No real-learner evidence (no demonstrations, misconception, remediation or eval files for this id). The old catalog
`commonStruggles` documented: skipping sections, reading too fast, and missing the self-check answer ("go back and
re-read the section"). The rest is inferred. The misses are what the code check observes on the tapped choice.

| Mode | Failure (class) | Miss |
|---|---|---|
| explore | does not know where in the file to look (documented) | `not_in_file`, `other_file_fact` |
| explore | finds a nearby fact and takes it (inferred) | `other_file_fact` |
| recall | cannot recall which part of the file held it (documented: re-read the section) | `not_in_file`, `other_file_fact` |
| recall | mixes up facts from the same file (inferred) | `other_file_fact` |
| apply | cannot connect the fact to the new situation (inferred) | `not_in_file`, `other_file_fact` |

## Lever table

| Mode | Lever | Kind | What changes | Leak rule (code) |
|---|---|---|---|---|
| all but K | `point_to_section` | help (shown + voiced) | a note under the question, "This is in: 🏆 Records"; on explore the tab is ringed too | names a section only, opens nothing, quotes nothing (the scene fact says the file stays closed on recall/apply); not offered when the note is already on (easy) |
| all | `drop_far_choice` | simplify, on the item | greys out one untried wrong choice, preferring one the file does not state | at least two untried choices remain, so the answer is never left alone |

Every miss is answered by `point_to_section` first (unit test over the three modes). Reopening the closed file was
not built as a lever: it turns recall into lookup (the explore mode) and puts the key on screen.

## Measured
- Workspace test: the note changes the screen and the scene fact in one commit and the next attempt records it;
  explore rings the tab and opens nothing (no key on screen); the drop greys out the expected choice and stops when
  two untried choices would not remain; a lever the item does not declare is refused with no change; easy starts with
  the note and records no lever.
- Sweep J9, J12, J13: 0 findings on the three payloads. The first draft opened the ringed tab on explore, which would
  have put the key on screen; it now only rings it. An easy tier with three choices left no lever after one wrong tap
  (J12, 3 findings); easy keeps four choices now.
- Replay: lever and stuck replies describe the note and the greyed choice; after the guidance fixes (r3) none names a
  section without the lever or describes the right choice.

## Failures without a lever
The apply failure (cannot connect the fact to the new situation) has only the section note and the drop; there is no
lever that shows the reasoning step, because code does not know which facts an inference rests on.
