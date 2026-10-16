# orbit-mechanics-lab W1 binding (R2 batch B1), 2026-10-16

**Shape P, rebuilt under the 10-15 ruling, four modes, all bound.** Levers in
`../eval-reports/orbit-mechanics-lab-levers-2026-10-16.md`. Not committed.

## What the old screen did, and what changed
The old lab launched a rocket from the pad on a thrust slider and an angle slider. Its toy ascent put almost every
thrust above lift-off into some orbit (a sweep of TWR 1.05-2.95 at four angles gave an orbit every time, never an
escape), so no outcome could be keyed. K-1 tapped one of three pictures whose answer was always the middle "Medium" one,
the score dropped with each retry until right, G2+ scored the final state after unlimited retries, a session with no
challenge scored 100, and `rendezvous`/`change_orbit` had no completion check though the generator offered them.

Rebuilt on Newton's cannon (`orbitWorkspace.ts`): the rocket is above the air and gets one sideways push, and gravity
alone decides the path. Keys come from `calculateOrbitalElements` (energy, perigee, eccentricity); the flight drawn
after a check is integrated by the same physics. Gemini writes the title and a one-sentence overview, nothing else.
Nothing flies before the answer is checked, so the first answer is a committed prediction.
- **pick_speed** (say or tap): 2-4 pushes drawn as arrows; "Which push makes the rocket fall back / go around in a
  circle / go around in a long, stretched loop / fly away?" The asked outcome varies, so the right push size varies,
  and push order is shuffled. K-1 also see the asked outcome as a picture.
- **orbit_speed** (say or tap): 2-4 rockets standing still on round tracks; fastest, slowest, shortest or longest trip.
  After credit they all move, each at its real relative speed.
- **predict_burn** (say or tap): a circling rocket fires a small or big push forward or backward; five outcomes from
  "falls to Earth" to "flies away". The new path is drawn only after credit.
- **circularize** (say or tap): a stretched loop; fire once to make it a circle at a named height (hard: a dashed ring).
  The learner's own burn flies after any check (a wrong one shows the circle at the other height, or a worse loop).
- **Screen**: no slider, readout, unit, milestone ledger or hint panel. Frame on the Lumina kit; the space view is
  bespoke SVG with SMIL flights (started by `beginElement`, so a late-mounted flight still plays).
- **Default modes by grade** (no pin): K-1 pick_speed; 2 + orbit_speed; 3 + predict_burn; 4-5 all four. No floor.
- **Scripted path** (tester, no tutor): two tries then a reveal, as telescope; the submitted score counts first-try
  answers only (a retried item is recorded with its attempts but does not score).
- `orbitPhysics.ts`: the dead K speed-choice block (`speedChoicesFor`, `CORRECT_SPEED_CHOICE`) removed.

Misses (`orbitMiss`, spoken ids the same): pick `picked_slower`, `picked_faster`; which rocket `picked_biggest`,
`picked_farther`, `picked_closer`; burn `wrong_way`, `said_no_change`, `too_strong`, `too_weak`; circle `other_circle`,
`wrong_way`, `wrong_place`.

## Gates
- `typecheck:lumina` 0. Full `tsc` 772 (telescope recorded 772); 0 in `components/lumina`, none in these files.
- `OrbitMechanicsLab.workspace.test.tsx` 17/17; both reader-fit files rewritten to the rebuild (K served, no units, no
  slider, read-aloud, nothing flies before the check, first answer scores, the K key moves). Astronomy dir + generator +
  Pip science surface + catalog + `live-activity`, after the J14 fix: 144 files, 5429 pass, 2 fail, both
  `fraction-bar.compare` (another session's work in progress, the same two telescope's report names). Before the fix
  the sweep also failed the two orbit J14 findings below.
- Payloads `w1-payloads/orbit-mechanics-lab.{pick_speed (K, medium), orbit_speed (G2, hard), predict_burn, circularize
  (G5, hard)}.json` from `save_payload.py`.
- **Sweep found J14 on two modes** ("the correct input names "Huge push" / "Yellow rocket", but the item takes only the
  gesture"; user ruling 10-13, voice beside the tap). Fixed: every mode is now speech with `acceptsGesture`, an
  `expectedAnswer` (push size word and arrow rank, or rocket colour) and spoken misses. After: sweep and W1 contract
  21/21 on the four payloads, 0 findings.

## Replay (gemini-3.8-flash, 16 items x 5 samples, `--observe`)
Saved `backend/tests/tutor_live/replay/orbit-mechanics-lab-2026-10-16{,-r2}.json`. Read by hand, every non-credit reply.
- **r1.** Automatic checks 0 misses on every check. Reading found steering the checks scored 0:
  - pick_speed: "Try choosing a bigger push" / "a bigger push than the small one" (2/5, key the medium push); "which
    push would make it go even faster so it flies away?" (3/5, one faster push left); "pushed slowly sideways" (1/5).
  - orbit_speed: the time question recast as "which rocket has the longest track / path" (4 replies), "when a rocket is
    pulled harder, which has to move fastest" (3): both point at the key's property.
  - predict_burn: "if the rocket loses almost all its speed, what will gravity do?" (1/5, key falls).
  - circularize: "which push would lift the loop out", "what needs to happen to the far side" (1/5 each).
- **Fix**: guidance only (catalog `teachingWorkspace.guidance`): never tell the learner to try a bigger/smaller/faster/
  slower push or that more speed is needed; never say pulled-harder rockets are faster or recast the question as track
  length, ask where Earth pulls harder and stop; never say what gravity does once slower; never say which side of a
  loop must move.
- **r2.** 0 automatic misses. No reply names a key, recasts the question or states the rule. Residual: 2/40 pick_speed
  miss/stuck replies ask "what do you think a bigger sideways push would do?" (a question, not an instruction; left);
  about 10/20 predict_burn lever replies place the speed-arrows card "beside the rocket" (it sits under the view).

## Browser
Headless Chromium on the Astronomy tester (scripted path, :3000), K / G2 / G5 x medium / hard, 2 items per mode, real
clicks: nothing flown before the answer, no number or unit on screen, a wrong answer checks wrong (and on pick_speed and
circularize flies its own path with a sentence), the key credits, and the SMIL flight moves (rider position sampled
1.2 s apart). 53/53 checks; phone width 390 has no horizontal scroll. Four console errors ("<ellipse> attribute rx:
Expected length, undefined") fire on every Generate, telescope-simulator's too, from the tester's loading state; no
element of this primitive carries them. Not driven in a browser: the workspace path (tutor) and the lever cards.

## Undriven modes
None (every mode answers by `choose` on its button label, then the check).

## Open findings
- No `docs/contracts/orbit-mechanics-lab.md`; the new requirements (keys from the physics, nothing flies before the
  check, the K key moves, first answer scores) are recorded only here and in the tests. `/primitive-contract`.
- Ratify: modes reshaped from the triage proposal. `reach_altitude` and `reach_orbit` (slider launch) are dropped,
  because the launch physics cannot key them; `orbit_speed` (closer is faster) and `predict_burn` added; `rendezvous`
  and `change_orbit` dropped. Scripted path scores first try only (telescope's scripted path counts a second try).
- Human check: phone width with the tutor, K-1 with the voice (the push pictures carry no words), SMIL timing.
