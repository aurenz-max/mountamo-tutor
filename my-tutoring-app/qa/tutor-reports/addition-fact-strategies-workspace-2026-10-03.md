# addition-fact-strategies on the teaching workspace, W1 (2026-10-03)

Executor: `/add-live-tutor-tools`, plain shape (P), workspace only (`withWorkspaceOnly`), as batch C9.
Asked for so the approved lever table (`../eval-reports/addition-fact-strategies-levers-2026-10-03.md`)
can be built on it.

## What shipped

- `additionFactStrategiesWorkspace.ts`: assignment (`What is a + b? Tap the answer on the number pad.`,
  gesture), scene (strategy, `a + b = ?`, the worked example by its addends only, the help on screen,
  no-timer line, constraints), the pad check, `additionFactMiss` (`addend`, `one_short`, `one_over`,
  `short_by_more`, `over_by_more`), harness inputs (`Answer N`).
- Component on `useWorkspaceProgress`; adapter `additionFactStrategiesLive.ts` (rejects non-digit addends
  or a wrong sum); catalog `teachingWorkspace` (G1-2, guidance, misses for all 6 modes); journey row;
  six W1 payloads; workspace test (every mode), Pip surface test ported onto the runtime.

## Behaviour changes (recorded)

- Removed: the "Let's play" intro gate, the Next button, `useLuminaAI` and every scripted cue
  (`[STRATEGY_INTRO]` ... `[ALL_COMPLETE]`). The catalog `tutoring` block added the same day no longer
  reaches the tutor on this path (the workspace sets `tutoring: null`); it stays for reference.
- Removed: comebacks (a missed fact re-asked two facts later). The workspace's item list is fixed at
  mount; a wrong tap is retried on the same fact until solved. `comebackCount`/`comebackFirstTryCount`
  dropped from the metrics.
- The worked example now sits beside the first fact instead of on a gate card.
- Success = every fact solved (was overall accuracy >= 80); the first-response gate scores it (J11).
- Help after a miss is unchanged (flipped fact / objects, then counted aloud) until the lever slice.

## Checks

- Workspace test 6 modes + example + clock + miss table + adapter: pass. Pip surface: pass.
- `components/live-activity` + catalog suites incl. dry journey J1-J11 on the six payloads: pass
  (J11 first failed on the success flag; fixed). `typecheck:lumina` 0.
- Tutor replay, gemini-3.8-flash, 6 payloads x 5 samples: 0 misses on every check
  (`replay/addition-fact-strategies-2026-10-03.json`). Replies read: no total before a try; each mode
  coaches its own strategy (count on from the bigger number, adding zero adds nothing, use the flip card).
- Not run: Live (none owed for a W1 gate), human browser check (HUMAN-CHECKS #167).
