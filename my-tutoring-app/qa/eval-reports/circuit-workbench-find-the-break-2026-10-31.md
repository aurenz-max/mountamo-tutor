# circuit-workbench `find_the_break` (2026-10-31, `/add-eval-modes`, SB-6)

**Mode:** a wired light stays dark because one part is broken. The learner guesses which part (never graded), tries
fixes one at a time (a new battery, a new bulb, push every clip on tight) and watches the light, then names what was
broken and presses Check. Code judges: it lights again and the part named is the broken one. β 0.5, scaffoldingMode 2,
answer `build`; catalog, backend prior, metrics type, resolveEvalModes (mixed = 3 light + 2 break).

| Tier | Fault |
|---|---|
| easy | a wire's clip came off (visible, lying on the table) |
| medium | a dead battery or a burnt-out bulb (look fine; only a test tells) |
| hard | two bulbs in a row, both dark: dead battery or either bulb burnt out |

**Misses:** `still_dark`, `wrong_part_named` (in `unanswered` until levers). The model gained `Faults` (dead battery,
burnt bulbs) in `evaluate`; `breakModel.ts` holds items and the check. Also: the light_it review finding (scene
`constraints` repeated `moves`) fixed.

**Verification:** `breakModel.test.ts` 6, mounted test (guess opens fixes, wrong part named is a miss, Try again keeps
the notebook, right part passes); `test:primitive circuit-workbench` 722/722; `typecheck:lumina` 0; full tsc 770.
Browser Grade 4 medium `drive-break.mjs` 20/21: the one fail is the 9 s scene probe firing before mount, every later
step drove the 3D table (screenshots `circuit-workbench-drive-2026-10-31/break-g4/`). $0 Gemini.

**Fixed 10-31:** the tester badge showed K-2 at Grade 4: `gradeLevel` is 'elementary' for grades 1-5; the band now reads
`ctx.grade` first (all three worlds, `scienceBuildBand.test.ts`).
