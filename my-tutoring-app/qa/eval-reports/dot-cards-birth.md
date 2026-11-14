# Birth Certificate — dot-cards (2026-11-11)

**Lifecycle layer: L0 (born).** The primitive is pedagogically sound and measurable, has one core mode, and is bound to the teaching workspace.

Origin: the "Dots" deck of the Mental Math Cards artifact (claude.ai/artifact/WVftQxGL58RM6pXd2n1iNb). Its perceptual levels (1-3, 1-5, ten-frame, one more) already exist in counting-board and ten-frame. This primitive takes the part the catalog lacked: two-color cards where the child composes the total from parts seen at a glance (conceptual subitizing).

- Core task identity: `quick_total`. The child flips a two-color dot card for one quick look, then says or taps the total.
- Generator fork: **C, code-only** (`service/math/dot-cards-generator.ts`). There is no model call. Tier and seed decide the group sizes (1-5 each), the arrangement (dice / rows / frame / scatter), the dot positions and the look length. A session has 5 cards: arrangements rotate, no card repeats, and the same total never comes twice in a row.
  - easy: totals 2-5, dice or rows, 3.0 s look · medium: totals 4-8, dice / rows / frame, 2.5 s · hard: totals 6-10, frame / dice / scatter, 2.0 s
- Workspace binding: `dotCardsWorkspace.ts` + `dotCards.card.ts` + `dotCards.boss.ts` on the **spoken preset** (`SAY_OR_SHOW`). Response is speech, with a tap on the 1-10 pad checked by the activity. Misses: `one_group`, `one_short`, `one_over`, `short_by_more`, `over_by_more`. All five are listed in `unanswered` until L3. The harness flips the card first (`speech.before`, keyed on the scene fact `looked`). `boss-card.mjs` prints the card. `npm run test:primitive -- dot-cards` passes 782 tests, and the workspaceContract and journey sweep pass 6/6 for dot-cards. Payload: `w1-payloads/dot-cards.quick_total.json` (generator, seed 20261111). No tutor replay or Live run yet.
- Answer-leak audit:
  - A face-down card renders no dots in the DOM.
  - The pad is always 1-10 and stays closed until the card is flipped.
  - The prompt and title carry no number.
  - The scene names the colors and the arrangement, never a group size or the total. The workspace test asserts this.
  - A miss turns the card back over and shows no answer.
  - The groups ("3 blue and 2 orange make 5") appear only after the card is solved.
- Design gate:
  - Manipulation: pass. The child flips the card and produces the number.
  - Simulation: exception. A dot card is a stimulus, not a system.
  - Production: pass. The child says the number or picks it from the full 1-10 pad, never from a short choice list.
  - Timer: pass. The look is short on purpose and no clock is drawn. First-response time is a silent metric.
  - Layout leak: pass (see the audit above).
- Curriculum home: **not yet checked.** Run `/curriculum-fit dot-cards`. The likely targets are K.CC.B.5, K.OA.A.3 and K.OA.A.5 subskills.
- Pip surface: framework Pip. `<PipDock />` sits between the card and the pad, and `<PipWorkspace>` wraps the pad as one region, never a single number. Covered by `WorkspacePip.surface.test.tsx`.
- Not verified in a browser: how the card renders (SVG dice/frame/scatter, the face-down back) and the flip-then-hide timing in a live session.

## Follow-up queue (run in order)

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| 0 | `/curriculum-fit dot-cards` | home | Check that the K subitizing / decompose-within-10 subskills route here, not only to counting-board[subitize]. |
| 1 | `/add-eval-modes` | L1 eval-dense | Ladder candidates: `name_parts` (say both groups, "3 and 2"), `one_color` (single-color card; the child finds their own groups), `match_cards` (which card shows the same amount, two different arrangements), `build_card` (make a 2-color card for a given total: production, and the decomposition counterpart). |
| 3 | `/add-support-tiers` | L3 levered | The misses expected: `one_group` (saw one color only), off-by-one from counting part way. Help levers: count together (each dot lights with its number, as the artifact does), a longer look, a look at one color at a time, the groups outlined. Simplify: the same total as dice patterns or rows; a smaller second group. |
| 5 | `/add-sound` | L5 polished | Card flip (already `pop`), card turning back over, the groups lighting on solve. |
| ✓ | `/eval-test dot-cards` | QA loop | Run after every layer. |
