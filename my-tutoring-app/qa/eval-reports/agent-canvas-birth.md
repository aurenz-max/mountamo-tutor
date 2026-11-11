# Birth Certificate: agent-canvas (2026-11-10)

**Lifecycle layer: L0 (born).** An agent primitive on the kit: the author writes a program, plays it, and code checks the plays.

- Core task identity: `canvas` (one mode; an eval mode is a capability, not a task).
- Generator: `service/core/agent-canvas/agent-canvas.ts` on `authorCanvas`; `canvasLesson.ts` builds the lesson from a fresh or a saved run.
- Workspace binding: `agentCanvasWorkspace.ts` + `agentCanvas.card.ts` + `agentCanvas.boss.ts` on the tap preset; response `gesture`; one miss `goal_unmet` (unanswered: no levers yet).
- Harness: the frame's page does not run in jsdom, so the journey delivers what the author's recorded proof or wrong attempt reported (`report` input), then presses Check.
- Answer-leak audit: the goal text stays out of the screen and the tutor's scene (tested). The scene is the page's `lumina.scene`, which the author prompt says never holds the answer; code does not check that.
- Design gate: manipulation pass (the child operates the program); simulation pass; production pass; no timer; layout leak depends on each authored canvas (the author's look stage reads the first screen only).
- Pip: framework (`PipDock`, `PipWorkspace`); points at the whole workspace.
- Verified: `test:primitive agent-canvas` passed; journey sweep file passed; headless Chrome drive on the saved patio canvas (miss, retry, solve; record passed, score 67, 2 checks; 5 taps gave 5 sounds); one eval-test run (forces, grade 3, 69 s, $0.05).
- Not run: `/curriculum-fit`, `/review-agent-primitive`, tutor replay.

## Follow-up queue (WORKSTREAMS row 18)

| # | Work | Input from this birth |
|---|------|-----------------------|
| 1 | `add_problems` in the canvas author | 3-4 more problems on one program through `params`, each played both ways; the page is 175-430 KB, so ship one page and several param sets, not several pages |
| 2 | Promotion path | A saved run holds source, params, goal, proof and miss steps: the spec for a native build |
| 3 | Where canvases are prepared | Authoring took 69-224 s; a lesson cannot wait for it |
| 4 | Look stage after the wrong attempt | A leak that appears after the child acts still ships |
| 5 | Levers | None yet; `goal_unmet` is unanswered |
