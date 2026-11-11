# H5: four picture canvases

Read `README.md` in this folder first, then `.claude/skills/canvas-primitive/SKILL.md` in full. Use
`/canvas-primitive`. One canvas per session.

**Do not start until the user has played `print-page`.** That canvas is the test of whether the tutor speaks a
canvas's `ask` to a child who cannot read. If the answer was no, this handoff changes; ask before building.

## The four canvases

The full objective record for each (objective, action, evidence, what must not get credit, misconceptions with the
wrong action each produces, progression) is in `../audit.json` under `families[].record`, on the family named
below. The record is the brief: its misconceptions are the spec's misses and its progression is the problems, in
order. If the build shows the record is wrong, change the record first.

| Canvas id | Family in `audit.json` | The child | Subskills (`n`) |
|---|---|---|---|
| `picture-chain` | `VO5` | drags pictures into order along a track: a size scale, a temperature scale, a seed-to-bee chain | 124, 138 |
| `feeling-faces` | `VO4` | matches a feeling to the face that shows it, then a situation picture to a face | 123, 153 |
| `treasure-map` | `GR14` | traces a route on a map that passes each position clue in order (next to, between, around, through, across) | 105, 106 |
| `do-two-things` | `VO12` | hears two steps once, then does both actions on objects in the scene, in order | 54, 140 |

## What is different for a kindergartner

- No text the child must read. The `ask` is spoken. Clues on `treasure-map` are picture cards (a tree, two rocks
  with a gap) that the tutor names.
- Pictures are drawn the same size unless size is the idea (`picture-chain` problem 2 depends on this).
- Big targets, forgiving drops. Check every drag with touch-sized hit areas, not only a mouse.
- The program gives no verdict of its own and shows no readout that can be matched. Check is the host's.
- `do-two-things`: the instruction is heard once. The page must not show it as text or as a numbered hint, and the
  goal is the order of the two actions, read from the scene's state history, not only its end state.

## Use an existing spec as the model

`my-tutoring-app/qa/canvas/specs/fair-measure/` and `zero-machine/` are Grade 1 canvases the user has played and
approved. Read
one `program.tsx` and `spec.json` pair before writing.

## Check before you call it done

```bash
cd "C:/Users/xbox3/claude web tutor/my-tutoring-app" && node scripts/canvas-check.mjs --spec=<id>
```

- `canvas-check` passes with every problem played both ways.
- You read every screenshot against the bar in `/canvas-primitive`. In the pilots the gate blocked nothing and
  every fix came from the screenshots.
- You did NOT run `--promote`. The user's play is the promotion gate.
- `../audit.json`: the covered subskills go to level 2 with the spec id and "canvas-check passed, screenshots
  read". Tell the user which canvas to play in the dev panel's "Canvas (agent)" saved list.
