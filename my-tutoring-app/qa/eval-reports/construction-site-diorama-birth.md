# Birth Certificate: construction-site-diorama (2026-10-15)

**Lifecycle layer: L0 (born).** A 3D work site (three.js via @react-three/fiber, built in code): a tracked
excavator, a pile of dirt, sand, gravel or rocks, and a dump truck. It is the second primitive of the 3D diorama
vertical, after airplane-diorama. The user chose `load_truck` as the core task over find-the-part.

- **Core task:** `load_truck`. The learner works the excavator. A tap on the pile digs a scoop, and a tap on the
  truck dumps it. With an empty bucket, a tap on the truck takes a scoop back out. Each scoop lands as its own mound
  in the bed. Pressing Send is the check. A right load drives off to its job, and the next truck rolls in. On the
  finale, the excavator waves its bucket.
  - K-2 asks name the count: "Put 5 scoops of rocks in the dump truck...". Counting while loading is the task.
  - 3-5 asks give the truck's limit (also painted on the bed) and one scoop's weight. Code owns the weights:
    dirt 2, sand 3, gravel 4, rocks 5 tons. The scoop count is never on screen, and the weight shows only after Send:
    "The scale reads 10 tons." An overloaded truck squats on its springs.
- **Generator fork:** A. Gemini writes the title, the description, a made-up company (on the truck doors and the
  sign) and 5 destinations. Code picks the counts: 5 different counts per session (K-2 2-7, 3-5 3-8), with every
  material used before any repeats. Code also writes every ask.
- **Excavator:** a real 2-link IK arm (boom and stick) with the bucket angle on top. The hydraulic rams are re-aimed
  every frame. A tap on the arm passes through to what is behind it.
- **Workspace binding:** `constructionWorkspace.ts`. Response is `gesture`; misses are `one_short`, `too_few`,
  `one_over` and `too_many`. W1 checks:
  - `workspaceContract`: pass
  - `ConstructionSiteDiorama.workspace.test`: 5/5
  - `constructionModel.test`: 3/3
  - Journey sweep: J1 baselined (taps on a WebGL mesh, the same as airplane-diorama)
  - `lessonWorkspacePlan`: pass
  - Payload: `w1-payloads/construction-site-diorama.load_truck.json`
- **Answer-leak audit:**
  - No counter on screen. The mounds are the objects a K-2 learner counts, which is the skill, not a leak.
  - 3-5: there is no weight readout while loading, and the scale reads only after Send. The scoop count does not
    reach the tutor (test-asserted).
  - Send feedback names what was in the truck, never what it needed.
  - Guidance tells the tutor not to count for the learner or add up the weight.
- **Design gate:**
  - Manipulation: pass. The child picks every dig and every dump on the 3D site; the arm runs each move.
  - Simulation: pass. The arm digs and dumps, the bed fills, the truck sags with the load, squats when
    overloaded, and drives off.
  - Production: pass. The learner builds the load.
  - Timer: pass. No timer.
  - Layout leak: pass. No counter, and no weight while loading.
- **Curriculum home:** not run. `/curriculum-fit construction-site-diorama` is still owed.
- **Pip surface:** classic workspace. Pip outlines the whole site and never the truck bed. Surface test 1/1.

## Runtime verification (headless Chromium, real WebGL via SwiftShader, Engineering tester, offline levers)

Drive script and screenshots are in the session scratchpad; the screenshots below are summarised.

| Band | Result | Notes |
|---|---|---|
| K (Kindergarten) | 18/19 | The one FAIL is the drive: it read the last load's feedback after the finale had replaced it (the airplane drive has the same artifact). The check now accepts the finale. |
| 3-5 (Elementary) | 19/19 | The short load reads "The scale reads 10 tons."; the bench logs `miss one_short`. |

Both drives covered:
- real generation
- the scene mounts
- dig and dump by canvas taps
- a short load, then Try again, then the fix
- all 5 loads credited
- the departure, and the next truck rolling in
- the finale
- phone width (258 px canvas)
- no three.js or site errors in the console

Frame rate is 9-13 fps under software GL. A tablet frame-rate check is owed.

## Follow-up queue (run in order)

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| 1 | `/add-eval-modes` | L1 | **Ladder candidates:**<ul><li>**`plan_trips`:** a pile of N tons and a truck of C tons; how many trips (division with a remainder); the truck drives each trip.</li><li>**`limit_with_remainder`:** a limit that is not a multiple of the scoop weight ("as full as it can go without going over"; floor division).</li><li>**`which_limit`:** the density link from DumpTruckLoader: a bed volume against a weight limit; sand fills the weight first, debris fills the bed first.</li><li>**`operate`:** real controls (swing, boom, stick, bucket) to dig a trench to a marked depth, judged by geometry, as in the 2D ExcavatorArmSimulator jobs.</li><li>**`find_part`:** boom, stick, bucket, tracks, cab, dump bed, hoist cylinder, as in the airplane's mode.</li></ul> |
| 3 | `/add-support-tiers` | L3 | **K-2** fails by losing count while loading. Help: number each mound as it lands, or pause after each scoop for a count. Simplify: a smaller bed so the target fills it. **3-5** fails by counting tons as scoops or by adding wrong. Help: a running scale while loading. Simplify: a 2-ton scoop. |
| 5 | `/add-sound` | L5 | The diesel idle and rev on each move, the bucket scrape on a dig, the thud of a dump into the bed, the truck horn on departure, the hydraulic hiss. |
| ✓ | `/eval-test construction-site-diorama` | QA | After each layer. |

**Polish owed:**
- The tester preview column is narrow (a portrait canvas). Check a real lesson layout in the browser.
- The pile does not shrink as it is dug.
- There is no dust puff when a dump lands.
