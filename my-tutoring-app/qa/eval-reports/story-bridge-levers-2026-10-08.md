# story-bridge — spoken-mode levers (2026-10-09, class sweep of 2026-10-08)

`/add-support-tiers` for say_alike, say_different and main_idea_compare. Before this slice they had no misses and no levers ("open comparison, no bounded miss"). The tap modes already had their levers (handoff 22 L4) and were not changed.

## Failure inventory

| Mode | Failure (observable pattern) | Evidence class | Source |
|---|---|---|---|
| say_alike, say_different | tells about one friend only, with no link to the other (`one_friend_only`) | documented + synthetic | catalog `commonStruggles` ("detail from only one story"); harness `signatureWrong` / journey `plainWrong` |
| say_alike | tells only a way the friends differ (`told_difference`) | inferred | the task |
| say_different | tells only a way the friends are alike (`told_likeness`) | inferred | the task |
| main_idea_compare | tells about one story only (`one_story_only`) | documented + synthetic | same as the first row |

No real-learner evidence: no demonstrations, misconception or remediation material for story-bridge. The tutor reports (`qa/tutor-reports/story-bridge-*`) record scripted wrong answers only. main_idea_compare has no wrong-direction miss because a likeness and a difference both count.

## Lever table

| Mode | Miss | Lever | Kind | Carrier | Leak rule | Cost |
|---|---|---|---|---|---|---|
| say_alike, say_different | one_friend_only | `friend_events`: each named friend's card shows that friend's own event picture; the tutor re-reads the two friends' sentences, one from each story | help | both | the lever's own words (excluding the quoted story sentences and the "Do not" fence) never contain the reference comparison, the shared behaviour, a unique detail or a big idea; `does` tells the tutor not to say how the friends compare | render + fact |
| say_alike / say_different | told_difference / told_likeness | `ask_sign`: both friends' faces in the bridge with the ask's sign (🟰 or ↔️) between them; the tutor asks the same question again | help | both | same rule; it shows the question, never a way they compare | render + fact |
| main_idea_compare | one_story_only | `two_ideas`: an empty "mostly about?" check under each story picture; the tutor asks about one story at a time | help | both | same rule; neither big idea is drawn or said | render + fact |

No simplify on any spoken mode. Another pair of stories would use up a later item, and turning the comparison into a choice would make it a tap mode. Per-item check: every lever exists on every item of the fallback pair and of the three saved payloads (`story-bridge.<mode>.json`), and each of those items' own spoken misses is answered by a lever on that item (J12). No miss is unanswered, so nothing was added to the catalog `unanswered` list. story-bridge has no rows in `QUEUE-item-gaps-2026-10-09.md` and no J12 baseline entry.

## Built

- `storyBridgeWorkspace.ts`: `SpokenStoryBridgeMiss`, `storyBridgeSpokenMisses(item)` (pure, in precedence order, never published to the tutor). The spoken assignment now carries `misses`.
- `storyBridgeLevers.ts`: `friend_events`, `ask_sign`, `two_ideas`, plus a spoken branch of `leverLeak`. A lever that would leak on an item is dropped from that item.
- `StoryBridge.tsx`: `data-lever="friend-event"` on the two named friends' cards (matched by story and id), `ask-sign` in the bridge column, and `idea-check` under each story. All are hidden after credit, and the scene fact `levers_on_screen` reports what is drawn.
- Catalog `literacy.ts` story-bridge: the three modes' misses (`levers: true` was already set). Contract `story-bridge.md`: R4 updated and R5 added.
- Phase 6 (starting positions): the generator has no tier harness, and none was added.

## Tests

- `npm test -- storyBridge StoryBridge misses.test.ts`: 6 files, 156 passed. The mounted test `StoryBridge.levers.workspace.test.tsx` has 7 tests: a pull changes the screen and the scene fact in one commit, the next spoken answer is recorded with `levers: ['friend_events']` / `['two_ideas']` and `assisted`, and a refused second pull leaves the HTML, levers, attempts and item unchanged.
- `npm run typecheck:lumina`: 0 errors in story-bridge files. 3 errors are in `decodableReaderLevers*.ts`, a sibling's work in progress.
- Not run (left to the batch verify step): the journey sweep, tutor replay and Live.

## Left without a lever

None of the declared misses. A spoken answer that is wrong in some other way (an untrue comparison) is `other_wrong` and has no named lever.
