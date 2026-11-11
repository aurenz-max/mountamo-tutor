# Science G1 panel B, 2026-11-10

Second seeded sample of the day: 5 skills, 1 subskill each (`sample.json`, seed 12913678381985163131). Records and routes: `panel.json`. One subskill (SCI001-04-d) was also drawn by the first panel.

**Score: 5 of 5 at level 2 or above. 0 played. 0 served.** Model spend: none.

| Subskill | Action | Route | Primitive or canvas | Level |
|---|---|---|---|---|
| SCI001-02-c sort sounds | hear a tone, drag to a box | canvas-new | `sound-sort` | 2 checked (tones not heard) |
| SCI001-05-c material and shadow | drag a material into the beam | canvas-new | `shadow-materials` | 2 checked |
| SCI003-04-d seasonal star patterns | drag Earth around the Sun | canvas-new | `night-sky-orbit` | 2 checked |
| SCI002-04-b biomimicry | drag inventions to their inspiration | specialist | `classification-sorter` sort | 2 checked (catalog and generator read) |
| SCI001-04-d light needed to see | mark toys the flashlight shows | canvas-existing | `flashlight-room` (first panel) | 2 checked |

## The three new canvases

Each passed `canvas-check` with every problem played both ways, and the main session read the screenshots.

| Canvas | Author | Problems (what changes) | Open points |
|---|---|---|---|
| `sound-sort` | main session | Loud/Soft at one pitch; High/Low at one loudness; Loud/Soft with mixed pitch; High/Low with mixed loudness; four boxes | Headless Chromium has no audio: whether the tones play inside the sandboxed frame, and whether loud and soft are far enough apart, is unverified. The tutor's scene holds no pitch or loudness (that is the answer), so the tutor cannot tell which card is which. |
| `shadow-materials` | subagent, Opus 5.5 medium, 4.8 min | dark; none (white card and foil as decoys); faint; thick clear block against thin foil; three beams | The "None" card is a lit patch with nothing in it and may read as "nothing there". Glass and wrap, and wax paper and tissue, are told apart mostly by name. |
| `night-sky-orbit` | subagent, Opus 5.5 medium, 4.3 min | one pattern; a quarter-turn start with a smaller Earth; the pattern in the day sky; two patterns at once | Patterns are drawn at a finite distance and checked as if infinitely far, so near the 45° edge picture and check can differ by a few degrees. "Up in the day sky" may be abstract at this age. |

## Not confirmed

- `classification-sorter`: no generation was run. Its generator forces 2 bins at K-2; this subskill asks for 4-5 inspiration bins.

## The user plays next

Dev panel "Canvas (agent)" saved list: `sound-sort` (with sound on), `shadow-materials`, `night-sky-orbit`. After an approved play, add `serves` to the spec and run `node scripts/canvas-check.mjs --spec=<id> --promote`, then the serve check in `/canvas-primitive` step 8.

## Queued

- `/eval-fix classification-sorter`: the K-2 two-bin cap is below this lesson's intent (4-5 bins, SCI002-04-b).
