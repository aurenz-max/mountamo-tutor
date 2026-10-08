# Open build — headless browser drive, 2026-10-07

Real app (`localhost:3000/lumina` → Math Primitives tester, offline lever bench), headless Chromium via
`playwright-core` (recipe: memory `headless-chrome-drive-recipe`). Scripts and screenshots in this folder.

| Mode | Drive | Result |
|---|---|---|
| coin-counter `show-amount` (Show 17¢) | 18¢ from the bins → I'm done → miss → Try again → tap a tray penny out → I'm done | all steps pass. Verdict: "Not yet. Count what your coins are worth, then fix your tray." Pass: "Yes! Your coins make 17¢!" Watcher: "Ooh, shiny silver and brown coins are lining up on the green tray!" Ladder updated after the wrong try |
| bar-model `make_graph` ("three more bananas than oranges") | oranges 1, bananas 3 (one short) → miss → Try again keeps → one more banana → pass | all pass. Verdict: "Not quite. Look at how many more bananas than oranges your graph shows." Watcher: "Ooh, yellow bananas are stacking up next to the orange!" Fits a 360px column |
| base-ten `build_two_ways` (Show 54 two ways) | 5 tens 4 ones → first way kept small ("Yes, that is one way to show 54. Now change the blocks…") → same blocks → `same_as_first` → Try again keeps → 4 tens 14 ones → pass | all pass. Verdict: "Those blocks make 54, but it is the same way as your first…" (54 is the stated target). Watcher: "Purple sticks are lined up by green cubes on the mat!" Fits a 360px column |

No console errors on any run. The empty box above the controls is the Pip dock (empty headless).

## Findings
- **Small tap targets:** base-ten's +/− buttons are 28×28 px (the column itself is also tappable, so the
  large target exists); coin-counter tray coins are drawn about 28 px, and tapping one is the only way to take
  a coin out. Below the 44 px child target. → `/eval-fix` or the families' next slice.
- **Phone width:** the tester page itself is not responsive (sidebar fills 390 px), so phone width was checked by
  squeezing the primitive's card to 360 px: bar-model and base-ten fit with nothing past the edge. Coin-counter
  was not re-checked this way.
- Not driven: the other 7 modes, lever pulls on screen (bench Pull buttons), Live tutor wording.
