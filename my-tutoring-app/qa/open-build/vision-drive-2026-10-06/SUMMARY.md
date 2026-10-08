# Open Builder reimagined: vision judge drive, 2026-10-06

Headless Chromium against the dev server's Creation tester, offline lever bench, "Load preset" (no
generation). For each of the 9 scenes, the drive built an unfinished build, pressed "I'm done!", read the
buddy's reply, pressed Try again, finished the build, and pressed "I'm done!" again. The judge is
`gemini-flash-latest` reading a PNG of the board svg. Each `*.png` is the exact picture Gemini got.

| Scene | Unfinished build: verdict and question | Finished build |
|---|---|---|
| Over the River | not yet: "Can your bridge reach all the way across to the other side of the river?" | met |
| As Tall as the Giraffe | not yet: "How high does the giraffe's head reach compared to your blocks?" | met |
| A House for Puppy (v2) | not yet: "What will stop the rain from falling on top of Puppy?" | met |
| Up to the Kitten | not yet: "Can the bunny reach the cliff from your tallest step?" | met |
| A Castle for the King | not yet: "Where could the king's other tower go?" | met |
| Blast Off! | not yet: "How does the very top of your rocket look?" | met |
| Robot Friend | not yet: "How could your robot friend wave hello?" | met |
| The Apple Truck | not yet: "How will the truck roll along the ground to carry the apples?" | met |
| Save the Flowers | not yet: "Can the big sheep step right over that block?" | met |

- 18/18 verdicts were as expected, after one scene fix. No question gave away the fix.
- The buddy's question stayed on screen after Try again in 9/9 scenes (the old bug hid it).
- Scene fix: in v1 the puppy sat at the board's left edge. The judge correctly failed a good house built
  beside it ("Where is puppy sitting right now?"), because a child could not build around it. v2 puts the
  puppy in the middle and says "build a house over Puppy". v1 pictures are in this folder; v2 is in `puppy-v2/`.
- Not tested: a real child playing, generated goals (the presets only), 3-5 wording, the Live tutor.

## Live watcher (flash-lite while building), same day

The Annotated Example Try It pattern: 1.2 s after the last block, a PNG of the board goes to
`gemini-flash-lite-latest` (`watchOpenBuild`), which says one line about what the build looks like. The
verdict stays on flash-latest at "I'm done!". Runs: `watcher-run.json` (v1 prompt), `watcher-run-v2.json`.

- 20/20 looks returned and showed on screen; most in 0.7-1.5 s, slowest 7 s. Three fast drops fired one look.
- v1 prompt gave false passes ("the puppy is right inside a little orange block house!" with no roof;
  "three peachy blocks are bridging the river!"). v2 forbids saying it is finished or does the goal's job;
  0 such lines in v2. Lines now read "starting to look like walls / a truck / legs".
- Remaining weak spots: a lone dark wheel reads as an empty board ("blank", "empty" lines are now dropped
  in code); after the robot got arms it still said "starting to look like legs" (lite misses small changes).
