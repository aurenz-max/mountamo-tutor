# K Language Arts audit: handoffs

Each file here is one session of work that came out of the K Language Arts audit (`../REPORT.md`, `../audit.json`,
WORKSTREAMS row 22). Start a session by reading this file, then the one handoff you were given. Do one handoff per
session.

| Handoff | Work | Skills | Depends on |
|---|---|---|---|
| `H1-spoken-grammar-frames.md` | a/an/the, pronoun, verb-form and tense frames on `di-spoken-practice` (20 subskills) | `/add-eval-modes`, `/add-word-space` | nothing |
| `H2-open-speech-modes.md` | ask a question, say why, retell, tell your own (13 subskills) | `/add-eval-modes` | nothing |
| `H3-scope-and-content-repairs.md` | parser, default-group and pool defects on phonics primitives | `/eval-fix` | nothing |
| `H4-mode-additions.md` | six small mode additions, one primitive per session (14 subskills) | `/add-eval-modes` | nothing |
| `H5-canvases.md` | four picture canvases (8 subskills) | `/canvas-primitive` | the user has played `print-page` |

Not handed off (the main session keeps these): the sentence track and the illustrated story in the `wonder-walk`
worlds, the `print-page` canvas, and letter-level component mastery.

## What the audit means by a subskill number

`audit.json` → `subskills[]` has `n` (1-191), the published `id`, the text, the family and the level.
`families[]` has the action, the evidence, the route and `routeWhy` (the file and line that showed the gap). Read the
entries for your subskills before reading code. For the full curriculum text of a subskill, look its `id` up in
`../snapshot.json`.

## Rules that apply to every handoff

1. **Read the contract first.** Before editing a primitive's generator or component, read
   `src/components/lumina/docs/contracts/<primitive-id>.md`. If the new demand contradicts a requirement there, add a
   mode or a config axis. Do not edit in place over a conflict.
2. **The learner cannot read.** Every stimulus is spoken by the tutor or shown as a picture. Printed words are
   allowed only when reading them is the skill. Never show the answer in a label, a default or a layout.
3. **Code picks the words and computes the key.** Items come from the word space (`service/wordSpace/`) with a
   code-computed answer and wrong options. The model writes wording only. Do not trust a key the model wrote.
4. **No paid tutor runs.** Do not run `backend/tests/tutor_live/run_*.py` or `tutor_replay.py`; a hook blocks them.
   Content generation through `/api/lumina/eval-test` is allowed and metered: stop on a `LUMINA_BUDGET` error and
   report the day's spend (`node scripts/gemini-spend.mjs`).
5. **Do not edit curriculum.** No `target_primitive` changes, no manifest or curator rules.
6. **Do not commit or push.** Leave the tree for the user to ship.

## Commands (run exactly these; the short forms pass falsely)

```bash
cd "C:/Users/xbox3/claude web tutor/my-tutoring-app" && npm run typecheck:lumina          # must be 0
cd "C:/Users/xbox3/claude web tutor/my-tutoring-app" && npm run test:primitive -- <id>    # one primitive's gate
cd "C:/Users/xbox3/claude web tutor/my-tutoring-app" && npm test -- <path>                # one vitest file
curl -s -m 120 -o /dev/null -w "%{http_code}" http://localhost:3000/api/lumina/topic-trace  # is the dev server up
```

Never start a second `next dev`. If nothing answers on :3000, say so in your report and skip the runtime step; do
not start one unless the user asks.

## Done means

- `typecheck:lumina` is 0 and `test:primitive -- <id>` passes for each primitive touched.
- Each new or repaired mode has one real generation through `/eval-test` at the curriculum text of one of its
  subskills, and you read the payload: the item is the action, the key is right, nothing on screen gives it away.
- The spoken path was not exercised by you. Say so, and give the user the exact Live command and the question it
  answers.
- `../audit.json`: edit it in place (several sessions write to it; never regenerate it). Raise each covered subskill to level 2 with the file read and the generation named in the
  family's `routeWhy`. Level 3 and 4 are the user's.
- WORKSTREAMS row 22 gets one sentence on what was built and what is owed.
- Your final message lists: what reaches the child now, what you could not verify, and the day's model spend.
