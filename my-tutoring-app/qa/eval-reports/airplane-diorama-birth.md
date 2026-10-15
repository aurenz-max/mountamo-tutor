# Birth Certificate: airplane-diorama (2026-10-14)

**Lifecycle layer: L0 (born).** A 3D passenger jet on a display stand (three.js via @react-three/fiber, built in
code from the user's E175 artifact). One core mode, bound to the teaching workspace. It is the first primitive of the
3D diorama vertical (user 10-14).

- **Core task:** `find_part`. The learner taps the asked part on the 3D jet. K-2 asks name the part; 3-5 asks name only
  its job. A right tap makes the part show what it does: the engines spool up, the flaps drop and the ailerons rock,
  the rudder and elevators move, the gear bounces, the cockpit or cabin opens in X-ray, or the nose radar sweeps.
  The jet takes off when the session ends.
- **Generator fork:** A. Gemini writes the title, the description, a made-up airline (painted on the jet) and which
  parts the lesson is about. Code picks 5 different parts (focus parts first) and writes every ask.
- **Workspace binding:** `airplaneWorkspace.ts`; response `gesture`; misses `close_part` (a neighbouring or look-alike
  part) and `wrong_part`. W1 checks:
  - `workspaceContract`: pass
  - `AirplaneDiorama.workspace.test`: 3/3
  - Journey sweep: J1 baselined. A tap on a WebGL mesh cannot be driven in jsdom; open-builder has the same entry.
  - Tutor replay: opening 0/5 misses.
- **Answer-leak audit:**
  - Nothing names a part on screen while the learner looks.
  - After a tap, the screen names only the part that was tapped.
  - Two leaks found and fixed. The scene told the tutor "a two-engine jet", which named the answer on an engines job
    ask; the fact is now "a passenger jet". Gemini titled a 3-5 job-ask session "Wings and Engines"; the prompt now
    forbids part names, and code replaces framing that holds a part word on a job-ask session.
- **Design gate:**
  - Manipulation: pass. The child turns and zooms the jet and taps the part itself.
  - Simulation: pass. Each part shows its job when found.
  - Production: exception. Finding a part is recognition, so it is the entry rung. Production comes with the
    flight-plan mode and a build mode, listed below.
  - Timer: pass. No timer.
  - Layout leak: pass. There are no labels or hotspots while asking.
- **Curriculum home:** not run. `/curriculum-fit airplane-diorama` is still owed.
- **Pip surface:** classic workspace. Pip points at the jet as a whole and never at a part. Surface test passes.

## Runtime verification (headless Chromium, real WebGL via SwiftShader)

- Driven in the Engineering tester with offline levers. Drive script and screenshots:
  `airplane-diorama-drive-2026-10-14/`.
- **K session:** 18/19.
- **3-5 session:** 18/19.
- **What each drive covered:**
  - real generation
  - the 3D scene mounts
  - a wrong tap names the tapped part, and the bench logs `miss close_part` and Try again
  - every ask credited on the right tap
  - auto-advance
  - the takeoff finale
  - phone width (390 px, tester sidebars hidden)
  - no three.js or airplane errors in the console
- **The one FAIL per run is the drive itself:** it reads the last ask's feedback, which the finale replaces.
- **Frame rate:** 7-8 fps under headless software GL. On a real GPU it should be smooth, but that is unmeasured, and a
  tablet frame-rate check is owed.

## Also changed

The Engineering tester had no teaching-workspace host. Every bound engineering family (train-yard, tower-stacker,
gear-train-builder, ramp-lab) rendered "needs the tutor" there. It now previews them inside
`TesterWorkspace`, with an Offline / Live toggle like the Math tester.

## Follow-up queue (run in order)

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| 1 | `/add-eval-modes` | L1 | **Ladder (user 10-14):** <ul><li>**`flight_plan`: DONE 10-15** (record: `airplane-diorama-flight-plan-2026-10-15/README.md`). a simplified itinerary between two airports on a map; load the fuel the distance needs (code-owned burn per km plus reserve); misses `too_little_fuel` and `too_much_fuel`.</li><li>**`preflight`:** the preflight checklist done on the 3D jet (walk around: check the tyres, the flaps move, the engine inlets are clear, the lights work); misses for a skipped or out-of-order item.</li><li>A split of `find_part` into `find_by_name` (K-2) and `find_by_job` (3-5), so routing picks the style by skill, not by grade.</li><li>**A build mode:** put a plane together for a job (wing size, engine count, fuel), the jet flies it, and code judges lift against weight and range against the trip.</li></ul> |
| 3 | `/add-support-tiers` | L3 | Learners fail by confusing look-alike parts (the tail's small back wings vs the wings, the nose vs the cockpit) and by not turning the jet (the gear is hidden from above). Lever candidates: **help** turns the camera to a view where the part is visible but unnamed, or outlines the region; **simplify** narrows the tappable jet to two halves. |
| 5 | `/add-sound` | L5 | The engine spool (the artifact's procedural Web Audio jet sound), the gear thump, the takeoff roar. |
| ✓ | `/eval-test airplane-diorama` | QA | After each layer. |

**Polish owed:**
- The cockpit X-ray turns the whole skin see-through. It reads, but a front-only X-ray would frame the pilot seats
  better.
- The tester preview column is narrow (portrait canvas). Check a real lesson layout in the browser.
