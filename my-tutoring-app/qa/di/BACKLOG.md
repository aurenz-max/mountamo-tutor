# Direct Instruction — Primitive Family Backlog

Working queue for the DI primitive family. Top = next. Graduated 2026-07-20 from
`qa/HANDOFF-di-bench-2026-07-16.md` per its own gate ("graduate to a BACKLOG file
if the bench passes") — the bench passed: open-mic run, probe run, hook-parity
run, engine-gate run all PASS (`qa/di-bench/run-2026-07-*.md`). User call
2026-07-20: DI becomes a **new primitive family** alongside core/math/literacy,
first set custom-made.

## Architecture (settled — do not re-litigate per item)

The engine stack is committed and runtime-verified; primitives are CONTENT PACKS
over it:

- `hooks/voiceTurnMachine.ts` + `hooks/useLiveVoiceTurns.ts` — open-mic turn
  authority (DI-2 dual barge-in threshold). Generic.
- `hooks/judgedLoopModel.ts` + `hooks/useJudgedSpeechLoop.ts` — live-judged
  call-response loop (voice-anchored attempts DI-1, arming DI-3,
  sentence-scoped sentinel verdicts, resync). Generic; sentinels parameterized.
- The Live tutor judges the AUDIO in-band per the cue's judging contract; the
  sentinel scan only reads which branch it took. Word-matching is the reporting
  channel, not the judge (proven: /s/ affirmed from audio over a "Shh." ASR).
- Bench (`di-bench` home card 🎯) stays the modality's measurement harness —
  every new response class benches there BEFORE a primitive wires it.

**"Custom-made" means:** cue scripts, judging contracts, sentinels, and
progression policy are HAND-AUTHORED per primitive (exact wording is the
pedagogy — DISTAR discipline). Item CONTENT is generator-scoped per objective:
curated speakable/picturable item menus injected into the prompt, attachments
made in code (rhyme-studio K pattern; scope-context contract). No
`DEFAULT_ITEMS`-style hardcoded content ships in a primitive.

**Registration:** new `primitives/direct-instruction/` family dir + new
`service/manifest/catalog/di.ts` catalog section. Entry through the normal
manifest/lesson path — catalog entries + eval modes, NO new launch surface
(lesson-entry principle). Response time captured silently; no visible timers.

## Standing gates (every DI primitive)

1. **Bench-first per response class:** a new class of expected spoken response
   (number words, blends, sight words…) gets a ~30-min bench sitting with a
   hand-rolled item list before any primitive wiring. Letter NAMES remain
   BLOCKED (LetterSpotter homophone ruling — needs a Voice Studio bench first).
2. **Sentinel-collision check:** the script contract ("never begin any other
   sentence with <affirm>/<correct>") must be re-verified per domain script —
   pick collision-free openers where the domain phrasing fights it (math tutors
   want to say "Yes!"). Engine sentinels are configurable per pack.
3. **Correction-opener directive:** the tutoring block must remind that EVERY
   correction begins with the correct sentinel (engine-gate run: model dropped
   "My turn:" on a re-correction).
4. Standard lifecycle: `/primitive` L0 birth + `/curriculum-fit` (every mode
   needs a curriculum home) + `/eval-test`; `/tutor-test` probe for the
   directive block. Open-mic doctrine holds: no force-mutes from the primitive.

## Queue

### 16. 🔝 **TOP PRIORITY (user ruling 2026-08-09) — PORT THE DI MODALITY ONTO THE LITERACY PRIMITIVES. Pilot `phonics-blender` ✅ SHIPPED · port 2 `sound-swap` ✅ SHIPPED · port 3 `word-flip` ✅ SHIPPED · port 4 `cvc-speller` ✅ SHIPPED 2026-08-10 (the gesture anchor now has a production caller) · ✅ THE LOOP IS NOW A GENERALIZED CAPABILITY (2026-08-10, user-directed): `judgedScriptContract` + `useJudgedScriptRunner` extracted from the eight consumers — NO retrofit — and proven cross-subject same day on `counting-board` (math, #86) and `push-pull-arena` (science, #87); port 5 `picture-vocabulary` ✅ SHIPPED **AND USER-DRIVEN SAME DAY 2026-08-11 (#91 STRUCK — the SPOKEN judge refused deliberate errors, first user evidence of the lane's core debt; "an incredibly strong modality from a learning standpoint")** · port 6 `phoneme-explorer` ✅ SHIPPED 2026-08-11 (user portfolio call: convert — ALL FOUR modes verbal; mic row #92) · port 7 `letter-sound-link` ✅ SHIPPED 2026-08-11 (the parked portfolio call ANSWERED: 2 directions verbal, `hear-see` taps because `letter_name` is BLOCKED; new continuant content gate; mic row #93) · next = the MIC SITTING (#82-#87, #89, #92, #93).**

> **✅ THE GENERALIZED RUNNER (2026-08-10, user directive: "lets not retrofit but instead
> build the general schema and capability, try it on 2-3 subjects").** Two new modules in
> `lumina/hooks/`, DERIVED from the diff of the 8 consumers (5 DI packs + 4 ports), zero
> of which were migrated — the no-retrofit ruling is explicit; existing consumers move
> opportunistically only when a real reason touches them, because migration cost is
> denominated in mic sittings, not lines.
> - **`judgedScriptContract.ts`** — the pack contract + THE STANDING GATES AS CODE:
>   a benched RESPONSE-CLASS registry (gate 1 — `letter_name` and `open_set_word` are
>   BLOCKED in data, refused by the validator with the ruling pointer; counts 21-30
>   honestly declare the build-ahead `number_word_to_120` class, #63 owed), a
>   sentinel-collision validator (gate 2, mechanical — it runs over every cue a pack can
>   emit, replacing per-pack authorship discipline), template-key checks, and
>   `validateJudgedScriptPack` which every pack's test asserts `toEqual([])` and the
>   runner console.errors in dev. **It caught its own first bug: the pre-numeric hand
>   correction said "look ONE more time" — a number word inside the number-free
>   contract.**
> - **`useJudgedScriptRunner.ts`** — the component half every port repeated: run
>   lifecycle (connect w/ `owns_opening` → mic → opening cue → arm, SWAP-1 order),
>   verdict→progression (corrections cap 2 → move on), the cvc gesture rules
>   (no-verdict/resync ignored mid-build; unanchored-verdict adopted only while a build
>   awaits), resync re-cues, `loop-deaf` re-arm, Tier-A diagnosis assembly, context
>   sync, tap-to-hear. Wording stays 100% pack-authored — the runner carries NO cue
>   template, exactly per this item's own extraction finding.
> - **Pilot A `counting-board` (math, Pre-K–G1):** the Check button was measuring
>   EXHAUSTIVE TAPPING, not counting — tap every object once and pass with no number
>   word; cardinality was a rhetorical tutor aside. Now the child tap-counts (the
>   manipulative survives) and SAYS how many; subitize flashes then judges the spoken
>   count; `subitize_perceptual` is the gesture anchor's SECOND production caller with a
>   fully number-free contract; the tally's "/ total" (the answer, printed) and the −/+
>   steppers died. Generator got an answer-leak guard (instruction naming the target →
>   code template). `CountingBoard.reader-fit.test.tsx` rewritten onto the new surface
>   (flash discipline preserved).
> - **Pilot B `push-pull-arena` (science, K-5):** the MCQ chips printed the answer
>   (word-flip's chips in a physics costume) and observe's own instruction + labeled
>   Push/Pull buttons NAMED it. Now every answer is CODE-COMPUTED from the sim's physics
>   (observe=pushDirection, predict=static-friction check w/ decisive margins,
>   compare=lighter object, design=needed-force threshold), spoken, judged in-band;
>   predict/compare auto-run the sim AT ANSWER COMMIT so the physics reveals the truth
>   while the tutor judges. `correctAnswer`/distractors/hint retired from schema+type.
>   Predict's menu is "moves/stays" NOT yes/no — an ask ending "Yes, or no?" collides
>   with the affirm sentinel in our own cue. Also its Lumina-kit migration (was raw
>   shadcn).
> - **Gates:** typecheck:lumina **0** · all 6 slice test files **71/71** (contract 13,
>   runner 16, counting script 19, counting render 8, arena script 10, reader-fit 3) ·
>   §1 greps clean on both components · full vitest suite green post-fix (the 3
>   reader-fit failures were the OLD stepper surface; rewritten). **NOT driven live —
>   HUMAN-CHECKS #86 (counting-board) + #87 (push-pull-arena), and the runner itself
>   has never carried a real mic session; #82-#85 remain the lane's blocking debt.**
> - **Deliberately NOT done:** a literacy pilot (a concurrent session was actively
>   editing `literacy/` + `catalog/literacy.ts` mid-slice — `picture-vocabulary` is the
>   named next literacy conversion); design-mode goal predicates beyond big/little; any
>   migration of the 8 existing consumers; `/add-di-loop` as a SKILL (the runner is its
>   stronger form — write the thin skill wrapper after the mic sittings prove the
>   template, per this item's own queue note).

> ### 2026-08-11 — `di-spoken-practice`: the CONTENT-GENERIC pack (user thread, exploratory)
>
> **User question:** why is the loop a plug-in on bespoke primitives rather than one
> standalone primitive with an overarching Gemini schema? **The measurement that says the
> question is right:** after the verbal ruling stripped the costumes, `WordFlip.tsx` (661
> lines) and `SoundSwap.tsx` (767) each expose ONE interactive element — a tap-to-hear. The
> 5 DI packs are 4,077 lines of component whose visual variance is "a letter / a word / a
> sentence / a fact". **The fork drawn (NOT the rejected ROUTE/CONVERT/LEAVE bucketing —
> that triaged which primitives get the treatment; this is about how the treatment is
> delivered):** does the manipulative CARRY pedagogy? Yes → bespoke (counting-board's
> touch-each-one IS one-to-one correspondence; Elkonin boxes ARE encoding; the sim IS the
> truth). No → this pack.
>
> **SHIPPED (uncommitted):** `diSpokenPracticeScript.ts` + `DiSpokenPractice.tsx` +
> `gemini-di-spoken-practice.ts` + `DiSpokenPracticeScriptPanel.tsx` (dev), fully
> registered (catalog, ComponentId, primitiveRegistry, diGenerators, metrics,
> `problem_type_registry.py`), 3 eval modes (`say_answer` / `read_aloud` / `count_and_say`).
> **1,493 lines TOTAL — including a dev panel and 21 tests — against 1,652 for ONE bespoke
> pack.**
>
> **The line that makes generation safe: the DISTAR skeleton is CODE, every sentence is a
> slot.** Sentinels ("Yes, …" / "My turn: …") are code-owned, so a generated correction
> that opens with a sentinel cannot break the verdict scan (asserted). The two interesting
> slots are `acceptRule` (a RIGHT answer that does not look right) and `signatureError` (a
> WRONG one that sounds right) — the clauses every port discovered by driving it live.
>
> **Two gates a bespoke pack cannot run**, both because `expectedAnswer` is a FIELD:
> `deriveResponseClass` REFUSES anything it cannot place in the benched registry (a 4-word
> answer is `open_set_word` = BLOCKED; the item drops rather than downgrades), and
> `findAnswerLeaks` scans ask/how-to-play/printed-stimulus mechanically — exempting the
> stimulus only on `decode` items, where the printed word IS the task.
>
> **DRIVEN THROUGH THE REAL PIPELINE (dev server + live Gemini, 3 modes × 4 items) AND IT
> FOUND TWO DEFECTS, BOTH FIXED:** (1) flash-lite returned `expectedAnswer: "2"` with
> `alternates: ["two"]` — written and spoken forms inverted — so the item shipped declaring
> `short_spoken_word` when the child says a number WORD; `normalizeSpokenAnswer` now owns it
> in code and a bare numeral surviving normalisation is refused (>20 = the #63 build-ahead
> class). (2) **half the generated `acceptRule`s referenced a channel the judge cannot
> perceive** — "counting on your fingers", "tapping objects" — because nothing told the model
> the judge only ever hears AUDIO. Prompt constraint added; re-driven, 0/12 silent-channel
> rules.
>
> **VERDICT ON THE EXPERIMENT (the point of the build):** `signatureError` is genuinely good
> — it independently found the echo-the-addend miss that `di-math-facts` hand-authored
> (`di-math-facts-echoes-last-number`) and, on decoding, rhyme substitution / sounds-without-
> blending / same-initial-letter. `acceptRule` needed the audio constraint and is now correct
> but repeats per skill rather than per item — arguably right, since it IS a skill property.
> **So the model can write the error analysis; it could not be trusted to know what the judge
> can hear.**
>
> **✅ DRIVEN LIVE 2026-08-11 by the user (`5813884d14d3`, standalone tester) — 3 items
> answered, and it found THREE defects, all fixed the same slice.** (1) **THE TUTOR READ THE
> `[CURRENT STATE]` BLOCK ALOUD TO THE CHILD** — turns 13-17, five consecutive turns of
> "activity: live direct instruction spoken practice, challengeType: say_answer, stimulus:
> 5 x 3…" carrying 14-55 audio frames each (clean speech in the same session runs 9-21 frames
> for a short line). It started right after an off-task utterance ("I'm going to go to the
> bathroom") drew a conversational turn with a state block batched onto it — SWAP-2's
> off-script contagion, escalated from chatter into reciting private metadata. **`lumina_tutor.py:556`
> already says "Never read it aloud, list it back, or comment on it", so this is a COMPLIANCE
> failure, not a missing rule — and a rule the model can break is not a gate.** FIX: this pack
> now pushes NO runtime state at all (`contextFor` → `{}`, `contextKeys: []`), which is correct
> rather than evasive — the state block informs IMPROVISED turns and a judged-script tutor never
> improvises; every word it may speak arrives inside a cue that already carries the stimulus and
> the full judging contract. The channel had no consumer and only a failure mode.
> **[OVERRULED by the user 2026-08-11 — see the `436dcb5616cb` addendum below: the channel is
> restored; the recitation root was mis-voiced scaffold text, not the channel.]**
> (2) **Generated `howToPlay` was filler** — "Look at the math fact, then say the answer out
> loud!" before every opening, in a pack where every item is answered out loud. Now CODE-OWNED,
> one line per mode, and removed from the schema. The rule it establishes: counting-board's
> how-to-play is a PROCEDURE ("touch each bear once as you count") because that pack has a
> manipulative; this one has none, so "what to do" is a property of the MODE, not the skill.
> (3) A barge-in at 5.2s killed turn 1 and the tutor re-spoke the whole opening line verbatim —
> which doubled the filler. Recovery behaviour, left alone now that the line is short.
> **Bonus DI-1 evidence:** ASR read the child's answer as **"sex"** and the tutor affirmed
> **"Yes, six."** — judged from audio, transcript is a spectator, fifth instance.
>
> **⚠ THE FIXES ARE NOT RE-DRIVEN.** Generation is re-verified (how-to-play is now the code line;
> `contextFor` returns `{}` so `attach()` has nothing to prepend) but **nobody has heard a session
> since** — the state-recitation fix in particular can only be confirmed live.
> **⚠ FAMILY QUESTION, FILED NOT ASSUMED: are the 5 hand-authored DI packs exposed to the same
> recitation?** They keep their contextKeys legitimately (`supportTier` gates whether the tutor
> may model before a cold ask), so they cannot take this fix as-is. TRN-1 recorded the same block
> reaching Pip's bubble *unspoken*; this run is the first with audio frames behind it.
>
> **⚠ It inherits the exact unproven spoken judge that gates #82-#87** —
> this is a generation-side artifact, not a verified loop, and it is now SELECTABLE BY THE
> MANIFEST (a catalog entry is required for the eval-test tester to resolve it). **Open user
> decision: hold it out of lesson routing until it has a mic row, or let it route.** Test
> ground: `/lumina` → dev panels → Direct Instruction → **"Spoken Practice (generic)"**; the
> script panel under the run shows every generated clause + the assembled cue.
>
> **Gates:** typecheck:lumina **0** · full tsc **803 = baseline** · vitest **210 files /
> 2746 passing** (the 1 suite error is the pre-filed `canvas-confetti` teardown, unrelated).
>
> **✅ DRIVEN LIVE AGAIN 2026-08-11 by the user (`436dcb5616cb`) — TWO defects, both fixed
> the same slice, and one USER RULING that reverses a fix above.**
> (1) **THE ASK NEVER SAID THE PROBLEM.** Turn 1 spoke the cue exactly as scripted — and the
> script was "Here is a groups problem. What is the answer?" over a printed "2 x 3": a question
> with no problem in it, inherited by every correction re-ask. Root: the generator's prompt only
> required the ask to speak the stimulus on `printStimulus: false` items; for printed stimuli it
> framed the child as reading the screen. FIX: prompt + `ask` schema now require the say_answer
> ask to STATE the problem ("Two plus one. What is two plus one?"), and a new mechanical gate
> `findUnspokenStimulus` drops any say_answer 'text'/'none' item whose ask omits its stimulus
> tokens (digit ↔ number-word equivalent; operator glyphs exempt; read_aloud / count_and_say /
> emoji exempt because THEIR stimulus must stay out of the ask).
> (2) **THE TUTOR SPOKE A `commonStruggles` RESPONSE VERBATIM** — turn 2, after an un-judgeable
> utterance (ASR: "¿Qué?"): "Wait. Think time is unbounded here; only re-ask if the application
> tells you to." That is the catalog scaffold's own text, byte-for-byte. NOT the state channel,
> NOT cue leakage: the field's contract is WORDS THE TUTOR SPEAKS (backend renders it as a quoted
> script line), and the pack had authored meta-commentary into it — she was primed at session
> start to say those instructions. A response that cannot be performed can only be recited.
> `di-math-facts` proves the contract: its five struggle responses are performable script moves
> and have never been recited. FIX: responses rewritten as performable moves; the standing WAIT
> doctrine moved to a new aiDirective ("THE LEARNER'S TURN") where priming belongs.
> **USER RULING — the state-channel amputation above is REVERSED:** every other primitive sends
> state + instructions through the full channel with no issues, and a GENERALIZED pack does not
> get to amputate platform channels to feel safe; post-hoc in-cue trailers ("don't say these
> instructions") cannot beat wrong session-start priming. `contextFor`/`contextKeys` restored
> (`challengeType` + `stimulus`), stimulus-side only per the di-math-facts rule — decode items
> push no stimulus (it IS the answer), counting items push the object word, never the count.
> The per-cue judging contract correspondingly thinned to per-item data ("Then wait for the
> learner." + answer/alternates/acceptRule/signatureError/branches); the doctrine paragraph and
> bracket-tag trailers deleted from every cue. This also ANSWERS the family question filed above:
> the hand-authored packs' channels were never the exposure — voice discipline in the scaffold is.
> **⚠ NOT RE-DRIVEN LIVE.** Gates re-run (typecheck:lumina 0; pack tests 29/29 including the new
> unspoken-stimulus + contextFor suites) but nobody has heard a session since — the restored
> state channel and the stated-problem ask can only be confirmed by a mic run in the tester.
>
> **✅ DRIVEN LIVE A THIRD TIME 2026-08-11 by the user (`f634f61b2b42`) — 4/4 items, 100%,
> drive-2's fixes all CONFIRMED, one NEW defect found and fixed at the ENGINE level.**
> Confirmed: every ask stated its problem aloud ("Two times three. What is two times three?");
> the scaffold was never recited; `[CURRENT STATE]` blocks attached to cues (state_attached
> 1-3) and were never spoken; verdicts stayed crisp ("Yes, six."). Bonus: DI-1 sixth instance
> — ASR transcribed the child's answer as "Nein.", the tutor affirmed "Yes, nine." from audio.
> **THE NEW DEFECT — the off-script hostage (turn 3):** a stray noise right after "Yes, six."
> drew an improvised turn, and the model INVENTED AN ITEM THAT DOES NOT EXIST in the session
> ("Two groups of six… twelve"; the real item 2 was 4 x 2) and recited it IN CUE FORMAT —
> "[SAY_ITEM] Say exactly… If it is wrong, say exactly…" — for 34 seconds / 116 audio frames.
> The real item-2 cue had been queued at 12.6s but the engine's own audio block held it behind
> the improvisation until 52.5s. Attempt anchoring HELD (the phantom item was never judged; the
> embedded "My turn:" sentence advanced nothing) — the engine refused the content but funded
> the airtime. **FIX (engine, all 8 judged-loop consumers): off-script cut-in in
> `useJudgedSpeechLoop`.** After the queue-time line's falling edge, a tutor turn that begins
> while a cue is queued is off-script by definition — the cue now ships THROUGH it with
> `interrupt: true` (`TextQueueEntry.interrupt`, the backend floor's caller-decides channel,
> previously never exercised by this engine). The child's own voice still always blocks; a
> scripted verdict line is never cut (quiet-edge stamp + a pendingJudge guard for the
> transcript-beats-playback race, demoted inside the verdict dispatch). Pinned by 2 new tests
> in `useJudgedSpeechLoop.diagnostics.test.tsx` (cut fires; verdict-lag never cuts); cue log
> gains `cutIn` on 'sent'. Gates: typecheck:lumina 0 · hooks 119/119 · DI folder 171/171.
> **⚠ The cut-in itself is NOT yet heard live** — next mic run should look for a `cut_in: true`
> send in the session ledger the first time a noise draws an improvised turn.
>
> **✅ DRIVEN LIVE A FOURTH TIME 2026-08-12 by the user (`592abf43424c`, "adding within 10",
> 92%) — ONE defect found and fixed the same slice: CONVERGENT CONTENT.** All four items
> summed to 5 (3+2, 2+3, 4+1, 1+4 — every ordered pair). Not the response class (that is a
> judging bucket derived after generation) and not the schema: flash-lite's structured output
> is convergent on free numeric fields — it picked the answer 5 first and back-solved operands,
> and the "N DIFFERENT problems" rule was satisfied by commuted twins. The known fix
> (numberPoolService doctrine) applied with the pack's content-generic wrinkle: a shuffled
> full-band seed list (1-20; 1-10 for counts) injected per attempt as a CONDITIONAL prompt
> section — the model reads whether the topic is numeric natively (no regex classifier), the
> TOPIC stays authoritative for range, and literacy topics are told to ignore it. Pooling the
> answer invites bad back-solves, so a new mechanical gate `findArithmeticMismatches` drops
> any say_answer item whose printed fact disagrees with its own answer (drop, never patch —
> the generated correctionBody states the claimed answer; also catches unbenched "zero").
> Rule 3 now names commuted twins as the same problem. **Re-driven through the real route,
> 8 runs:** "within 10" ×3 → 4/4, 4/4, 3/3 distinct answers (was 1/4); "within 5" ×2 → all
> answers ≤5 with all seeds >5 skipped; "rhyming words" → zero number contamination;
> count_and_say ×2 → counts walk the seed order (8,1,2,4). Gates: typecheck:lumina 0 ·
> pack tests 33/33. Seeds + answers now in the generator's run log.

> ### 2026-08-11 — ✅ PORT 5 SHIPPED: `picture-vocabulary`, the runner's first literacy consumer
>
> **User-pulled ("continue on the remaining spoken modalities"), and the extraction's promise
> held: the port cost a SCRIPT and a STAGE, no loop wiring.** Files:
> `pictureVocabularyScript.ts` (new, hand-authored DISTAR), `PictureVocabulary.tsx`
> (whole-file, on `useJudgedScriptRunner`), `gemini-picture-vocabulary.ts` (assembly),
> `catalog/literacy.ts` (audioInput + DI tutoring block + contextKeys **5 → 2**),
> `problem_type_registry.py` (β story, βs unchanged),
> `__tests__/PictureVocabulary.di-script.test.ts` (new, 22). Deleted: the Start with Voice /
> tap-only fork and the whole `voiceMode` axis, the 4-option word chips + "Show me choices",
> `MAX_WRONG_TAPS` + the reveal-after-3 ladder, the 1600ms auto-advance timer, Next/Finish,
> and every `sendText` choreography block.
> Gates: typecheck:lumina **0** · full tsc **803 = baseline** · vitest **211 files / 2782**
> (the 1 suite error is the pre-filed canvas-confetti teardown) · both §1 greps clean ·
> template keys **2/2, asserted in the test** · **live real-pipeline probes 6/6 modes** —
> packs built from live Gemini content pass `validateJudgedScriptPack`, sentinel scan over
> generated words included.
>
> **⚠️ THE SPLIT IS THE FINDING: four modes went verbal, two went INTO the hands — and the
> hands ruling is standing-gate-1 arithmetic, not a softening.** naming / opposite /
> gradable_scale / sentence_frame are spoken production (`short_spoken_word`, judged
> in-band). receptive_match keeps its tap (receptive identification IS a 1-in-4 selection
> skill — a child without the word cannot pick the referent). **association CONVERTS to a
> tap:** "what goes with sock?" has many honest spoken answers (shoe, foot, laundry), which
> is `open_set_word` — a BLOCKED class — so the emoji cards CLOSE the set while the relation
> stays the skill. Both tap modes commit through the gesture anchor (production callers 3-4)
> with CODE-COMPUTED verdicts ([PV_TAP], handVerdictCue's pattern) and spell_word's SILENCE
> contract.
>
> **The chips died in all four spoken modes (word-flip's leak, a third time) — and in
> gradable_scale they were also a COSTUME:** every same-scale distractor was already PRINTED
> on the scale, so the one option not on screen was the answer by string-matching, no
> gradient reasoning needed. Dropping options also freed the spoken modes from the
> 3-distractor pool floor. Generated content can no longer collide with the verdict scan:
> the generator refuses the word token "yes" in every pool and rejects frames whose
> sentences open with a sentinel.
>
> **Cue shapes reused, none invented:** opposite models the RULE on a code-owned pair the
> session never asks about (`pickModelOppositePair` — word-flip's `pickModelNoun` ruling);
> naming models nothing before the ask (the model IS the answer — sound-swap's shape);
> gradable/frame SPEAK their stimulus with the blank as "hmm" (the ask states its problem —
> drive-2's rule, and a pre-reader cannot read the scale); tap-to-hear re-speaks the
> QUESTION only (the old [ISOLATE]-style ladder pattern never returns). Accept clauses are
> hand-authored per mode ("puppy for a dog counts; affirm and echo the target") — the
> di-spoken-practice `acceptRule` finding arriving at a bespoke pack.
>
> **✅ DRIVEN BY THE USER THE SAME DAY — #91 STRUCK.** *"i did each round of tests and it
> worked great, this is an incredibly strong modality from a learning standpoint."* The
> spoken judge refused deliberate errors, the tap-verdict path landed, and the runner's
> first literacy outing held — all three unproven halves answered on this surface. (The
> #82-#87 rows stay open: the evidence is per-surface.) Remaining literacy census after
> port 5: `letter-sound-link`, `rhyme-studio`, `phoneme-explorer` on stopwatches;
> `interactive-book`, `word-workout`, `story-talk` on click-to-advance; 20 with no voice.

> ### 2026-08-11 — ✅ PORT 7 SHIPPED: `letter-sound-link` — THE PORTFOLIO CALL, ANSWERED BY THE SPLIT
>
> **User-pulled** (*"continue down the track of updating literacy primitives over to DI
> modality, specifically now letter-sound-link"*). Files: `letterSoundLinkScript.ts` (new,
> hand-authored DISTAR), `LetterSoundLink.tsx` (whole-file, on `useJudgedScriptRunner` —
> **third literacy consumer**), `gemini-letter-sound-link.ts` (the content gate),
> `catalog/literacy.ts` (audioInput + DI block + contextKeys **10 → 2**),
> `__tests__/LetterSoundLink.di-script.test.ts` (new, 29 cases) and
> `LetterSoundLink.reader-fit.test.tsx` (rewritten onto the new surface).
> **Deleted:** the two-tap audition protocol, `useSpokenWordCapture` + the "say the keyword"
> bonus beat + its 1400ms auto-advance, Next/Finish/Skip, `MAX_ATTEMPTS`, every
> `[ACTIVITY_START]`/`[NEXT_CHALLENGE]`/`[SAY_KEYWORD]`/`[TAP_OPTION]` tag, and the whole
> `KEYWORD_SAFE_PRE_ANSWER` reveal matrix. Also deleted:
> `LetterSoundLink.support-tiers.test.tsx` — every case asserted the audition protocol and
> the on-card tier text; its surviving intent (answer-leak + tier withdrawal) is now in the
> di-script test, where the leaks actually live.
>
> **⚠️ THE PORTFOLIO NOTE WAS THE ANSWER, NOT THE OBSTACLE.** The brief parked this one on a
> call: *"receptive discrimination vs di-letter-sounds' production; it also covers stop
> consonants and the phoneme→grapheme direction."* Both halves of that coverage claim survive
> the port **because the child's answer is made of something other than an isolated stop** —
> in `hear-see` the TUTOR makes the stop and the child taps; in `keyword-match` the child
> says a whole word. The overlap with `di-letter-sounds` is real in exactly ONE place
> (`see-hear` on a continuant), and routing around the primitive to avoid it would have
> preserved the defect in three modes to dodge a duplicate in one.
>
> **THE SPLIT: two directions go verbal, one stays in the hands — standing-gate-1
> arithmetic.** `see-hear` = the answer is a SOUND → spoken (`continuant_sound`).
> `keyword-match` = the answer is a WORD from a closed two-picture set → spoken
> (`short_spoken_word`). **`hear-see` TAPS**: the answer is a GRAPHEME, and naming a letter
> aloud is `letter_name` — a BLOCKED class (the LetterSpotter homophone ruling). A grapheme
> cannot be spoken, so it is touched; the verdict is code-computed and the tutor is handed
> its exact line ([LSL_TAP]), and its correction re-models the SOUND without ever naming the
> letter, so the retry stays a real retry.
>
> **THE CONTINUANT GATE IS THE PORT'S ONE NEW CONTENT RULE.** `see-hear` asks a five-year-old
> to produce a sound ALONE, and only held sounds are benched for that — so the generator may
> only target `s n m f l r v z` + the short vowels there, enforced in CODE post-parse
> (`retargetForMode`) rather than trusted to the prompt. Stops keep FULL coverage in the
> other two directions. Two content bugs fell out of writing the spoken ask: **`x` is
> unaskable in keyword-match** (its keyword "box" does not start with /ks/ — a false anchor
> that survived because nobody ever had to SAY the relation), and **`y`'s keyword became
> "yo-yo"**, because "yes" mid-correction would have opened a sentence with the affirm
> sentinel and been scanned as a VERDICT.
>
> **Support tiers were RE-BASED, not deleted** (the L3 contract): the old levers were on-card
> text a pre-reader cannot read plus an audition step this port removes, so the axis moved
> onto di-letter-sounds' proven DISTAR rungs — easy = model + guide + test, medium = model +
> test, hard = TEST ONLY with the cold-sound guard. `hear-see` is exempt from the guard: its
> sound is the STIMULUS, and withdrawing it deletes the question rather than the support.
>
> **`see_hear` beta RAISED 1.5 → 3.0.** It stopped being a 1-of-2 audio discrimination
> (guessable at 50%) and became unaided grapheme→phoneme production with nothing on screen.
> Leaving the old beta would have mis-calibrated the adaptive engine against a harder task.
>
> **EVIDENCE.** `typecheck:lumina` 0 · full suite 212 files / 2819 tests green · **5
> real-pipeline probes against live Gemini** (see_hear @ g1 + g3, hear_see @ g1,
> keyword_match @ g3, mixed @ g3): the continuant gate held on every drawn item, packs built
> from live content passed `validateJudgedScriptPack` (sentinel scan over generated words
> included), and no spoken line leaked its keyword. Gemini honored the constraint 5/5 so the
> code retarget never fired — which is why it now has its own unit test rather than shipping
> as an unexecuted safety net. **Pool worry disproved: see_hear @ group 1 drew `s a n i`,
> four distinct producible letters.**
>
> **⚠️ NOT DRIVEN LIVE — HUMAN-CHECKS #93.** No mic has heard this surface. #91 proved the
> spoken judge refuses deliberate errors on `picture-vocabulary`, but the evidence is
> per-surface and this one carries a NEW judging target: a held SOUND rather than a word.
> The row carries the per-mode wrong answers to say — the letter NAME is the one that
> matters. Remaining literacy census after port 7: `rhyme-studio` (behind a bench) on a
> stopwatch; `interactive-book`, `word-workout`, `story-talk` on click-to-advance; 20 with
> no voice at all.

> ### 2026-08-11 — ✅ PORT 6 SHIPPED: `phoneme-explorer` — ALL FOUR MODES GO VERBAL (user portfolio call)
>
> **User-pulled after driving port 5** (*"the judge is a little less smooth on phoneme
> explorer than our DI version — can we change to the DI modality?"*) — the old surface
> judged through transcribe-then-match (`useVoiceChoice`); now the Live tutor judges the
> audio in-band. Files: `phonemeExplorerScript.ts` (new, hand-authored DISTAR),
> `PhonemeExplorer.tsx` (whole-file, on `useJudgedScriptRunner` — second literacy consumer),
> `gemini-phoneme-explorer.ts` (schema restructure), `catalog/literacy.ts` (audioInput + DI
> block + contextKeys **5 → 2**), `problem_type_registry.py`,
> `__tests__/PhonemeExplorer.di-script.test.ts` (new) and
> `PhonemeExplorer.support-tiers.test.tsx` (rewritten onto the new surface). Deleted: the
> 4-choice answer grids in every mode, `MAX_ATTEMPTS` + the reveal-after-3 ladder, the
> 1800ms auto-advance timer, Next/Finish, the transcribe-then-match voice beat, and the
> whole `sendChallengeIntro` choreography.
>
> **THE 4-CHOICE GRID WAS A COSTUME ON ALL FOUR MODES, each a different way:** picking
> "cat" after hearing /k/ /a/ /t/ is word recognition, not blending; `manipulate` was
> sound-swap's exact ruling arriving in its sibling; `segment`'s printed breakdowns were
> reading. **`isolate` keeps its four cards ON SCREEN as the question-side MENU** (unmarked,
> so print is not a leak) and the answer is SAID from that closed set — which is also what
> keeps it off the unbenched produce-a-stop-sound class (standing gate 1: the child answers
> with a benched word, never an isolated stop). **`segment` becomes "say how many sounds" —
> and its WORD is never printed at any tier**: a reader counts LETTERS ("sheep": 5 letters,
> 3 sounds). The word arrives by voice + picture; the count is the benched number-word
> class; the correction earns the walk ("My turn: sheep. /sh/ … /ee/ … /p/. Three sounds.").
>
> **Two structural moves worth keeping:** (1) the generator's placeholder-backfill
> validators ("word"/"???" shells) became KEEP-OR-DROP — in a judged spoken loop a
> fabricated item is a spoken ask the tutor must then judge, so a broken challenge ships
> NOTHING; the same gates run again component-side (`itemsFromChallenges`), belt and
> suspenders on both sides of the wire. (2) bare vowel letters in spoken walks get
> di-letter-sounds' spellings (a bare 'a' reads as the letter NAME "ay" — cvc-speller's
> finding, now a script-layer rule via `spokenPhonemeToken`); an unsayable blend walk DROPS
> the item, because the walk IS the ask. Manipulate's operation prose is gated answer-free
> (an ask that contains its own answer ships nothing) — generator-side AND build-side.
>
> **Support tiers survive the port** (the L3 contract): worked-example card + sub-label,
> picture cues, blend furniture and operation print are still tier-withdrawn at render from
> the same generator-stamped flags; `readOptionsAloud` now governs whether the scripted ask
> ENUMERATES the menu. The `{{supportTier}}` reveal-policy directive died with the
> improvised turns it governed — tier latitude is in the cue now.
>
> **Gates:** typecheck:lumina **0** · slice suites **69/69** (both new di-script files, the
> rewritten support-tiers suite, both generators' tests) · both §1 greps clean · template
> keys **2/2 asserted** · **live real-pipeline probes 4/4 modes, ZERO items dropped**
> (isolate menus, real CVC blend words, varied segment counts, real manipulate transforms —
> every pack built from live content passes `validateJudgedScriptPack`). Full tsc reads 804
> vs the 803 baseline; the +1 is legacy noise outside components/lumina (lumina = 0, and
> nothing outside lumina imports this primitive) — flagged, not claimed. Full vitest is
> green except `letter-sound-link`'s old suites, which a CONCURRENT session has mid-port on
> disk — that lane's record belongs to that session.
>
> **⚠️ NOT DRIVEN LIVE — HUMAN-CHECKS #92.** Port 5's drive proved the spoken judge refuses
> errors on ITS surface; this port adds two firsts the row's criteria carry — COUNT answers
> (segment) and the family's first mixed-action how-to-play re-speak through the runner's
> `action` lever.

> **📄 THE BRIEF IS `qa/HANDOFF-di-literacy-modality-2026-08-09.md` (rev 4).** It carries the
> frame, the re-measured census, the step-by-step port procedure extracted from the pilot,
> and the recommended order for the remaining 30. This entry is the queue record; that is
> the brief. **Rev 1 of that handoff was deleted — its ROUTE/CONVERT/LEAVE bucketing was
> rejected by the user and must not be re-derived.**

> **The observation, in the user's words:** *"DI really pushed the boundary of using AI live
> tutor integrated into our primitives. I did a phonics lesson and noticed many language
> arts primitives still use a modality where the student needs to click the screen to
> continue etc. The DI modality fixes that."* **This outranks everything below it, including
> DI closeout.**
>
> **THE FRAME (two rulings, 2026-08-09 — do not re-litigate).**
> 1. *"if the existing primitive asks the student to click the mic, then answer, the existing
>    primitive is wrong. these instructions will result in worse pedagogy."* — Every literacy
>    primitive should run a tutor-owned loop. **A primitive is never exempted from the
>    modality because its interaction is manipulative**, and never left broken because a DI
>    pack could absorb its demand (routing around a defect preserves it). The per-primitive
>    question is only what the answer is MADE of — spoken, or a gesture.
> 2. *"the exercise should be purely verbal using the DI capability, not a combination of
>    clicking on tiles and speaking."* — **Where the skill is verbal, the whole task is
>    verbal.** The test: *can a child who cannot do the skill still perform this action
>    correctly?* Arranging `c a t` tiles is sequencing, not blending — a costume. Delete it.
>
> **✅ PILOT DONE — `phonics-blender` is the worked example.** The child sees the letters,
> taps any one to hear that sound, and SAYS the word; the Live tutor models, waits, judges
> the audio in-band and its own affirmation is the advance. Deleted: the push-to-talk mic,
> `Ready to Build!` / `Check` / `Blend!` / `Next Word` / `Clear`, the three-phase stepper,
> the tile build, and the `setTimeout` between phases. Files:
> `PhonicsBlender.tsx`, `phonicsBlenderScript.ts` (new, hand-authored DISTAR),
> `catalog/literacy.ts` (`audioInput` + DI tutoring block + contextKeys 9→4), both
> `__tests__/PhonicsBlender.*` rewritten, `docs/contracts/phonics-blender.md` (R4 re-based,
> R8 scoped, C3 + C4 filed).
> Gates: typecheck:lumina 0 · full tsc **803 = baseline** · vitest **195 files / 2487**.
>
> **⚠ THE PILOT IS NOT LIVE-VERIFIED, AND THIS BLOCKS THE SECOND PORT.** One live K run
> happened mid-port and produced ruling #2 (it proved the loop connects, the tutor models
> from the script, the mic captures and speech transcribes). The verbal task as shipped has
> NOT been driven: that the tutor waits, affirms a sound-out that lands on the word, refuses
> a near neighbour (`cap` for `cat`), and advances on its own affirmation is unproven.
> **Drive it before porting a second primitive** — a template verified once is worth more
> than three ports built on an assumption. → HUMAN-CHECKS **#82**.
>
> **ENGINE (generic, landed with the pilot):** `useJudgedSpeechLoop` could only anchor an
> attempt on a closed voice turn (DI-1), which is *why* rev 1 mistook an engine limit for
> pedagogy. `LoopAttempt.source` + `gesture-close` + `submitGestureAttempt` widen it, so a
> primitive whose answer is a manipulation can also have a tutor-owned clock. The cue is
> sent BEFORE the attempt opens (an attempt opened at commit time blocks the cue meant to
> provoke its verdict). **⚠ ZERO production callers today** — the verbal ruling removed the
> pilot's use of it. Its first real customer is `word-sorter` / `sentence-builder` /
> `story-map` / `cvc-speller`'s `spell_word`. **If the next two ports are also verbal,
> propose deleting it** rather than carrying unexercised capability.
>
> **✅ PORT 2 SHIPPED — `sound-swap`, 2026-08-09 (user-pulled).** The child sees the
> STARTING word and its sounds, taps any sound to hear it, and SAYS THE NEW WORD; the
> tutor states the word, names the one sound to add / take away / change, waits, judges
> the audio in-band and its own affirmation is the advance. Deleted: `Start Activity`, the
> 3-5 phoneme ANSWER BUTTONS, the deletion tile-tap, `Next Challenge` / `Finish` /
> `Skip →`, the `useSpokenWordCapture` push-to-talk say-it-again beat, and the 1400ms
> auto-advance `setTimeout`. Files: `SoundSwap.tsx` (whole-file), `soundSwapScript.ts`
> (new, hand-authored DISTAR), `catalog/literacy.ts` (`audioInput` + DI tutoring block +
> contextKeys **12 → 4**), `gemini-sound-swap.ts` (tier levers re-based, below), and two
> new test files (`SoundSwap.di-script.test.ts` 22 · `SoundSwap.di.test.tsx` 15).
> Gates: typecheck:lumina **0** · full tsc **803 = baseline**, zero errors in any touched
> file · vitest **197 files / 2524 passing** · both §1 greps clean · **4/4 template keys
> resolve** (every `{{key}}` in the block is pushed by the component at connect AND on
> every advance) · **2 revert-bites, both bit** (6 failures across both files).
>
> **⚠️ THE COSTUME WAS DEEPER HERE THAN THE PILOT'S, and that is the finding.** Both
> defects the census names were present (a 1400ms stopwatch AND a PTT mic), but under them
> the ANSWER itself was a costume: the child tapped a tile or picked one of 3-5 sound
> buttons and the SCREEN computed the new word. A child who cannot manipulate phonemes can
> still tap the highlighted tile; a child who can, can mis-tap. Holding a word in your head
> and changing one sound in it is an oral act end to end, so the whole answer is oral.
>
> **⚠️ ONE TIER LEVER HAD TO BE RE-BASED, and it is a ruling, not a rename.**
> `nameTargetSound: false` (the `hard` tier) meant *"the instruction does not name the
> sound to change"* — survivable only because 3-5 answer buttons made the answer
> determinate anyway. With the buttons gone, an unnamed target makes the ask **ambiguous**:
> *"change one sound in cat"* is answered correctly by cap, cot, bat, hat and a dozen more,
> and the judging contract would then correct a child who was right. **An ambiguous ask is
> not a harder task, it is a broken one** (di-shapes' *one drawing, one defensible answer*
> birth discipline, arriving from the other direction). So the tutor now names the change
> at EVERY tier, and the field governs the other scaffold the tier was reaching for:
> whether the tutor **segments the starting word aloud** before the ask — which is this
> primitive's own documented struggle (*"cannot hold the original word in memory"*). The
> structural axis (WHERE the sound sits: beginning → end → middle) is untouched and is
> still the primary lever. `optionCount` is now DEAD and is asserted dead, not ignored.
> Rationale lives in `soundSwapScript.ts`'s header, the component's, and the generator's,
> so it cannot be re-litigated by someone reading only one of them.
>
> **✅ DRIVEN LIVE THE SAME EVENING — session `a964bccc5ca2`, 9/9 first try, 2m34s, and it
> produced one user ruling plus three findings.** Ledger: 9 `[DI_SWAP_ITEM]` + 1
> `[DI_SWAP_COMPLETE]`, `superseded: 0` · `waited_ms: 0` after the opener · `wedged: false` ·
> `state_attached` 1→9. **The tutor-owned clock is now PROVEN, not argued:** every advance
> was an affirmation, no button, no timer. The ask never leaked the answer across 9 items,
> and the pre-reader how-to-play arrived by voice.
>
> **⚠️ RULING — THE SOUND-BY-SOUND WALK IS DELETED (user, from the run).** The shipped ask
> was *"Listen: an. /æ/ … /n/. Add /p/…"* and **the tutor's voice cannot say `/æ/`**:
> *"she does sound funny during that part, i think not necessary — the 'an… Add /p/' works
> great and the student can clearly hear the instructions, but the gibberish comes across as
> a distraction."* **The first fix attempted was the wrong one** (make the walk *sayable*);
> the ruling is to delete it. The ask is now three beats — starting word, the change,
> "What word?" — identical at every tier. **This kills the last axis-1 lever:**
> `nameTargetSound` is now DEAD alongside `optionCount`, so within-mode difficulty here is
> carried entirely by the STRUCTURAL axis (where the sound sits) plus the two on-screen
> perception levers. That is an honest outcome, not a gap.
>
> **↳ The glyph class is BROADER than the walk, so it got a shared fix:**
> `phonemeVoice.ts` (new, + 9 tests) renders a phoneme for the VOICE while the screen keeps
> what the generator wrote. Non-Latin glyphs map to **di-letter-sounds' own spellings**
> (`/æ/`→"aaa", `/ʃ/`→"shh") — that pack never put IPA in a spoken line, and this is the same
> move for generator-authored phonemes. **Latin-letter phonemes pass through untouched**
> (`/k/`, `/p/` read correctly live, and rewriting `/j/` would mean guessing whether a
> generation meant "yes" or "jump"). Applied to the two places a phoneme cannot be dropped:
> the ask itself (`Change /ɪ/ to /æ/` → *"Change iii to aaa"*) and **tap-to-hear on BOTH
> ports** — that channel had the identical defect and had never had a live run.
> **phonics-blender KEEPS its walk** (running sounds together is the skill there, not a
> scaffold) but now speaks it through the same renderer; its tests pass unchanged because
> its fixtures are ASCII. One behaviour change worth knowing: a CVCE word carries
> `sound: "//"` for silent-e, which is unsayable, so those words now drop the walk and the
> tutor models the whole word — the degrade is deliberate (`speakableWalk` → null).
>
> **✅ RESIDUAL SWAP-1 — FIXED 2026-08-09 in all three ports, and the diagnosis was the
> interesting part.** The run's opener gave the greeting and how-to-play, then emitted
> **`[DI_SWAP_ITEM]`** into its own speech, then said *"Now, let's try one. Start with 'at'.
> Add /k/ to the beginning. What word?"* — not the scripted line — and only reached
> *"Listen: at."* after a barge-in. Item 1 ran without its model. **The anti-echo warning was
> already in the opening cue and it did not hold, because the warning was never the problem:
> the CATALOG was asking the opening turn to do two jobs** — compose a how-to-play, then
> recite a scripted line — and the model did the first and improvised the second.
> **The fix is to delete the composing job, not to strengthen the warning:** the how-to-play
> is now TEXT INSIDE the quoted line (`HOW_TO_PLAY` in each script; `itemCue(item, {opening,
> howToPlay})`), so the opening turn's only job is the one every other turn has — speak this
> exactly. The catalog directive is retitled *"THE OPENING LINE ALREADY SAYS HOW TO PLAY"*
> and now only forbids adding to it. Landed in `phonicsBlenderScript.ts`,
> `soundSwapScript.ts`, `wordFlipScript.ts`, both earlier components, and all three catalog
> blocks; 8 new script assertions across the two earlier test files.
> **Band gating differs by port and it is deliberate:** on ports 1-2 the how-to-play is a
> Grade-K PROTOCOL statement (readers have it printed on screen) so it is passed only at K;
> on word-flip the opening line is the DI MODEL of the rule, so every child hears it.
> **⚠️ NOT yet heard live** — the fix ships into HUMAN-CHECKS #82/#83/#84, and #84 (f) is
> the criterion written for it.
>
> **➡️ RESIDUAL SWAP-2 — an off-task utterance drew an off-script reply.** The child said
> *"I'm going to go to the store."* and the tutor answered *"Alright, have fun and games!"*
> before continuing correctly. **Progression was NOT corrupted** — the reply carries no
> sentinel, so the reducer read no verdict, no correction was counted, and the next item went
> out (this is the `no-verdict` path behaving exactly as designed, observed live). The defect
> is only that the script says *speak nothing beyond these exact lines* and it chatted. Low
> severity; fold into the same wording pass as SWAP-1.
>
> **✅ DI-1 CONFIRMED LIVE, and this is the best evidence the doctrine has.** Final item, the
> ASR transcript reads **"sept"** and the tutor said **"Yes, sit."** — Live judged the AUDIO
> in-band and was RIGHT where the transcript was wrong. *Word-matching is the reporting
> channel, not the judge*, demonstrated in production rather than argued.
>
> **➡️ ITS MIC SITTING IS HUMAN-CHECKS #83, STILL OPEN — the run exercised the half that
> cannot fail.** All 9 items were ADDITION and all 9 correct on the first attempt, so **the
> correction branch never fired once.** Affirmations being affirmed cannot distinguish a
> discriminating judge from a permissive one — the same trap #63 fell into. What is still
> unproven is exactly what the row was opened for.
> Two things no test can reach: (a) that the tutor refuses **the starting word said back**
> — the signature error of this skill, and the one most likely to be mistaken for success
> because it is fluent, confident and completely unchanged; (b) deletion answers are VC
> words (`at`, `in`, `up`), **shorter than anything the bench has measured**. That is the
> one honest standing-gate-1 residual on this port: the response CLASS is benched (one
> short spoken word) but not at that length.
>
> **✅ PORT 3 SHIPPED — `word-flip`, 2026-08-09 (user-pulled).** The child sees the
> counted-picture frame (one 🐕 "dog" → three 🐕🐕🐕 `___`), may tap the picture card to hear
> the ONE-THING word, and SAYS THE PLURAL; the tutor models the rule on a noun this session
> never asks about, names the one thing, says how many there are now, waits, judges the audio
> in-band and its own affirmation is the advance. Deleted: **the three tap chips**, the whole
> tap path, the `Start with Voice` / `Start tap-only` fork, the `voiceMode` toggle, `Next` /
> `Finish`, and the 1600ms auto-advance `setTimeout`. Files: `WordFlip.tsx` (whole-file),
> `wordFlipScript.ts` (new, hand-authored DISTAR), `catalog/literacy.ts` (`audioInput` + DI
> tutoring block + contextKeys **5 → 3**), `gemini-word-flip.ts` (chips + the now-unrendered
> `description` removed from the schema), `WordFlip.reader-fit.test.tsx` (rewritten onto the
> new surface; it now carries the port's render gates too) and `__tests__/WordFlip.di-script.test.ts`
> (new, 23). Gates: typecheck:lumina **0** · full tsc **803 = baseline**, zero errors in any
> touched file · vitest **199 files / 2568 passing** · both §1 greps clean · **3/3 template
> keys resolve** · **2 revert-bites, both bit** (6 failures).
>
> **⚠️ THE COSTUME AND THE LEAK WERE THE SAME OBJECT, and that is this port's finding.**
> Ports 1 and 2 each had a costume *under* their defects; here one deletion closed both
> gates at once. The chips were *"the answer, the bare singular, and the over-regularized
> form"*: tapping "dogs" out of three printed words is READING (a child who cannot form a
> plural taps it correctly every time) **and** the chip PRINTED THE ANSWER on screen. The
> catalog defended them by noting a pre-reader cannot read them — **Grade 1 can**, and the
> band gate was doing the work a leak gate should have been doing. Both error shapes survive
> where they belong: named in the judging contract as answers that look right and are not.
>
> **⚠️ A THIRD CUE SHAPE, and it confirms the split rather than a template.** phonics-blender
> models the answer; sound-swap models nothing before the ask; **word-flip models the RULE on
> a different noun** — *"One hat, two hats — when there is more than one, you say the new
> word"* — chosen in code (`pickModelNoun`) so it is never a word the session goes on to ask
> about. A rule shown on a different word is taught, not given away.
> **The hand-over also had to change, and this is the load-bearing wording decision:** the
> family's *"Your turn. What word?"* is AMBIGUOUS here — after *"Now there are three"* a
> child can answer *"dog"*, name the picture, and be technically right. It is
> `nameTargetSound`'s ruling arriving a second time (*an ambiguous ask is not a harder task,
> it is a broken one*), so the ask ends *"Your turn. Three what?"*, which has exactly one
> correct English completion.
>
> **✅ PORT 3 DRIVEN LIVE — session `5269fc87d6da`, 2026-08-10, 5/5 first try, 1m24s — and
> it found the defect the whole lane had mis-attributed.** Ledger: 5 `[DI_FLIP_ITEM]` + 1
> `[DI_FLIP_COMPLETE]`, `superseded: 0`, `wedged: false`, `state_attached` 1→5, every
> advance an affirmation, no leaked plural across 5 items.
> **DI-1 got two more data points, both strong:** ASR read `'trunks'` → *"Yes, trucks."*;
> ASR read `'Herz'` → *"Yes, hats."* Judged from the audio, right where the transcript was
> wrong. **A phrase answer was affirmed** (`'four stars'` → *"Yes, stars."*), which is the
> contract behaving as written. **`pickModelNoun` earned its existence live:** the session's
> items were truck/star/cloud/bird/**hat**, and the opener correctly modelled on *"One cup,
> two cups"* — a hardcoded example noun would have modelled the exact word item 5 asks about.
> **SWAP-2 did not reproduce** (an off-task utterance drew no chatter this time).
>
> **⚠️ DI-GREET-1 — THE TRUE ROOT OF SWAP-1, AND THE EARLIER FIX ADDRESSED HALF OF IT.**
> The scripted opener held on its own terms — no bracket tag was spoken, and the tutor did
> begin the exact scripted line. It still failed, for a cause upstream of anything in the
> script or the catalog:
> `lumina_tutor.py` queues **"Greet the student warmly…" with `end_of_turn=True` on every
> fresh connect**, so Gemini takes a turn the instant the socket opens. A DI pack's first
> cue arrives seconds LATER — the client is still waiting on the microphone (`prepareLive`
> awaits connect, then the mic, then calls `startRun`). Measured on this run: greeting turn
> at **0.8s → 15.7s**, scripted opener sent at **16.4s**. Worse, the improvised turn ended
> with **the tutor's own question** (*"What do you see on the 'many' side?"*); the child
> answered THAT at 18.7s, which barged in 1.2s into the scripted line, so **only the model
> half — "One cup, two cups" — was ever spoken and item 1 ran with no question at all.**
> Re-reading sound-swap's run confirms the same mechanism one primitive earlier: its first
> turn was *"Hi there! I'm so excited to play some word games with you… I'll say a word
> and…"* — the greeting turn absorbing the catalog's how-to-play directive.
> **So SWAP-1's diagnosis was half right.** Deleting the "compose a how-to-play" directive
> removed one JOB from that turn; it could not remove the TURN, because the backend is what
> asks for it. *A prompt-level fix cannot close a transport-level defect.*
> **FIX (shipped 2026-08-10): `owns_opening` on the connect payload.** Backend:
> `should_queue_greeting(owns_opening, resumption_handle)` — extracted as a module-level
> predicate precisely because the inline `if` was untestable, which is part of why this
> survived two live runs. Client: `PrimitiveContext.owns_opening`, forwarded in the
> standalone authenticate payload and set by **all eight packs that script their opener** —
> `phonics-blender`, `sound-swap`, `word-flip`, `di-letter-sounds`, `di-word-reading`,
> `di-shapes`, `di-math-facts`, `di-sentence-reading`. **Scope fence, deliberately narrow:**
> `curator-brief` and every ordinary tutoring surface still greet, and they read well live
> (*"Hey there! I'm ready to help you explore these big machines."*) — 4 new backend units,
> one of which exists only to pin that. Gates: backend **26F/126P** (documented baseline
> 26F/122P + the 4 new) · typecheck:lumina **0** · tsc **803 = baseline**, 0 in any touched
> file · vitest **199 files / 2568** · 1 revert-bite, bit.
>
> **✅ PORT 4 SHIPPED — `cvc-speller`, 2026-08-10 (user-pulled), and it is the first port whose
> finding is a LEAK rather than a clock.** Deleted: the push-to-talk spoken-capture beat, the
> 1400ms auto-advance timer, the 500ms say-the-word timer, `Check Spelling`, `Next Word` /
> `Finish` / `Skip →`, `MAX_ATTEMPTS` and the attempt-counted scaffolding ladder, the two vowel
> option buttons and the two sort buckets. Files: `CvcSpeller.tsx` (whole-file),
> `cvcSpellerScript.ts` (new, hand-authored DISTAR), `catalog/literacy.ts` (`audioInput` + DI
> tutoring block + contextKeys **12 → 3** + description/constraints/evalMode labels rewritten),
> `gemini-cvc-speller.ts` (three dead schema fields retired), `__tests__/CvcSpeller.di-script.test.ts`
> (new, 34) and `__tests__/CvcSpeller.reader-fit.test.tsx` (rewritten onto the new surface, 11),
> plus `problem_type_registry.py` β-descriptions and the authoring-app catalog snapshot.
> Gates: typecheck:lumina **0** · full tsc **803 = baseline**, zero errors in any touched file ·
> vitest **200 files / 2609 passing** · both §1 greps clean · **3/3 template keys resolve** ·
> **5 revert-bites, all bit** · **real-pipeline probes 5/5**.
>
> **⚠️ TWO OF THE THREE MODES DIED BY THE ANSWER-LEAK GATE, NOT BY THE TIMER, and that is this
> port's contribution.** The census had this primitive filed under "stopwatch + push-to-talk", and
> both were real — but underneath, `fill_vowel` offered two vowel buttons ("a · apple" / "e · egg")
> and `word_sort` offered two buckets with the same captions. **In both, ONE OF THE TWO PRINTED
> OPTIONS IS THE ANSWER**, captioned with its keyword, and a Grade 1 child can read it: word-flip's
> chips, a second time, in a primitive nobody had flagged for it. It also made the task
> recognition — a child who cannot isolate the middle sound of "cat" taps correctly half the time.
> Both answers are now SPOKEN (the middle sound). **Worth checking on every remaining port: an
> option pair is a chip list with two entries.**
>
> **⚠️ `spell_word` STAYS IN THE HANDS, and refusing to voice-ify it is the other half of the
> ruling.** Three ordered slots out of a distractor-populated bank is ~1-in-60, so it is not a
> costume; and ENCODING (sound → letter) is the whole reason this primitive is not a duplicate of
> phonics-blender — porting it to speech would have deleted its own curriculum home. So the
> deletion went to the CHECK BUTTON and the stopwatch instead: **the third letter landing is the
> commit**, `submitGestureAttempt` carries what was built, and the tutor's verdict is the advance.
> **The gesture anchor therefore has its first production caller, and the KEEP ruling is now
> earned rather than argued.** Two integration facts the first caller found, both handled and
> commented in `CvcSpeller.tsx`: (a) a stray voice turn while the child builds opens an attempt the
> tutor was told not to answer, so `no-verdict` and `resync` are IGNORED on a build item — never
> re-ask over a board a child is still filling; (b) if that stray attempt times out before the
> build cue is sent, the verdict lands as **`unanchored-verdict`**, not `verdict`, and dropping it
> would wedge the lesson on a board that cannot be committed twice — so it is applied when, and
> only when, a build is awaiting judgment.
>
> **⚠️ THE "HEAR IT" BUTTON WAS AN ANSWER LEAK ON DEMAND, and it had shipped for months.** Its tap
> ladder escalated hear → stretch → **`[ISOLATE_VOWEL]`** — *"Listen to just the middle sound: /a/…
> That's the /a/ sound, like in apple."* On `fill_vowel` and `word_sort` that IS the answer, spoken,
> on request, with no attempt required. Tap-to-hear now says the word and stops; segmentation lives
> only in the correction, where it is earned. `[CONFIRM_SOUND]` went the same way — it made the
> tutor the answer-checker (place a letter, hear its sound, compare) during the child's own
> working time.
>
> **A FOURTH CUE SHAPE — and it is sound-swap's, which is the useful part.** The model is the
> stimulus only; the move is modeled in the correction. So the three shapes seen so far are not
> per-port: they answer *"is the answer reproduction?"*, and two packs can share an answer. What is
> genuinely new is **a SILENCE contract** — a `spell-word` item cue carries no judging contract at
> all, because there is nothing to judge, and instead spells out the four things a helpful model
> with an open mic and three visible boxes would otherwise do (repeat the word, name a letter,
> spell it, narrate). Two other per-skill decisions: the hand-over is **"Say the middle sound."**
> (`"What word?"` after `"Listen: cat"` is answered honestly with *"cat"* — the ambiguous-ask
> ruling, third use), and the correction **FADES** across its two allowed uses (sound only, then
> sound + letter) rather than repeating, which is what makes a second attempt worth having.
>
> **⚠️ THE HOW-TO-PLAY IS SPOKEN AT EVERY GRADE HERE, diverging from ports 1-2 deliberately.** They
> band-gate it to K because a reader sees the protocol printed on screen. This primitive has THREE
> actions and a blended session interleaves them (probe 5 drew all three in one session), so "what
> to do" is not static: it is re-spoken whenever the ACTION changes. A Grade 1 child who has been
> saying sounds for three items and is then handed letter boxes has no other channel.
>
> **⚠️ THE CONSTANT-ANSWER DEFECT — FILED, THEN USER-CORRECTED THE SAME DAY, AND THE REAL CAUSE
> WAS A FORKED LETTER-GROUP PROGRESSION.** The port made visible that `fill_vowel` pinned every
> word to one vowel, so the spoken answer was identical every item. I filed it as defensible DISTAR
> massed practice. **The user saw a real draw — `sat, pat, mat, map` — and rejected the framing:**
> *"vowel focus feels too narrow… i feel like in my curriculum service you will be able to find
> examples of letter groups, i would borrow from that instead."* That was right, and the diagnosis
> underneath it is the more valuable finding.
>
> **`cvc-speller` had FORKED the shared phonics progression, and the fork was invisible until the
> answer became audible.** `PRD_KINDERGARTEN_PHONICS_AND_ALPHABET.md` defines a four-group
> cumulative progression and names `letter-spotter`, `letter-sound-link`, `letter-tracing` **and
> `cvc-speller`** as its consumers. The first three ship identical copies (group 1 = `s a t i p n`,
> which **carries two vowels**). cvc-speller's private `LETTER_GROUP_SETS` was **consonant-only** —
> group 1 = `s t m p`, with `m` pulled forward out of group 2 and `n` missing — and it re-added
> exactly one vowel through `vowelFocus`, which **defaulted to `short-a` on any topic that did not
> literally match `/short[ -]?[aeiou]/`**. Those two together left a group-1 lesson a legal word
> space of roughly nine words. **The pool was exhausted by design, not by chance**, which is why
> three of four words shared a rime.
>
> **The curriculum settles the scoping question, and it does not ask for a vowel cap.**
> `backend/data/detailed_objectives_language-arts.csv`: `LA001-03-B` names all five short vowels
> outright (*"Match short vowel sounds (a, e, i, o, u)…"*), and *"Spell simple CVC words"* carries
> no vowel scoping at all — its one named narrowing is **WORD FAMILY** (*"-at: cat, hat"*), a
> different axis. So a DEFAULT single-vowel focus was a cap below stated lesson intent
> ([[feedback_trust-intent-over-hardcoded-caps]]), and the draw that exposed it was an accidental
> word-family set produced by starvation rather than by intent.
>
> **FIX (2026-08-10, same slice).** New `service/literacy/letterGroups.ts` holds the canonical
> progression. Scope is now **letterGroup = the ceiling** (cumulative, carries its own vowels) and
> **vowelFocus = a narrowing applied only when the objective names a vowel**; `resolveCvcVowelFocus`
> returns null instead of short-a and now reads `intent` as well as `topic`; `resolveCvcLetterGroup`
> defaults to group 3 (all five short vowels, per LA001-03-B) and **a named vowel can only RAISE the
> group, never lower it**. `vowelFocus` is optional on `CvcSpellerData` and `CvcSpellerMetrics`, and
> the vowel badge renders only when one was actually named. word_sort's contrast vowel is drawn from
> the group's own vowels (group 1 contrasts a/i — exactly what the progression introduces it for).
> **`enforceCvcScopeAndVariety` enforces scope + rime variety in CODE**, because the prompt asked for
> both and the model drifted anyway: a live probe caught `jam` (j outside group 3), `fox` (x), and
> **`pat` sitting next to `sat`** — the reported defect, reproduced and caught. It can only remove,
> and it refuses to cut below 3 items, warning instead of silently truncating.
> Gates: typecheck:lumina **0** · tsc **803 = baseline** · vitest **203 files / 2659** ·
> **7 revert-bites, all bit** · **real-pipeline probes 6/6**, with the fix visible in the words:
> unscoped `fill_vowel` went `sat pat mat map` → **`cat hen pig dog bug`**; group 1 yields
> `sat pin pan sit`; a focused *"short a"* set is still massed but now `cat map bag fan`; and a
> group-1 lesson asking for *"short o"* correctly RAISED itself to group 3.
>
> **This also re-bases the β story honestly.** `word_sort` (β 3.5) is harder than `fill_vowel`
> (β 1.5) because its pool deliberately mixes two vowels *against a focus*, not because one used
> buckets and the other used buttons; `problem_type_registry.py` descriptions say so, βs unchanged.
>
> **➡️ TWO ITEMS FILED OUT OF THIS.** (a) **Re-point `gemini-letter-spotter.ts` and
> `gemini-letter-sound-link.ts` at `letterGroups.ts`** — they still hold private copies, differing
> from each other only in group 4's tail (`q` vs `qu`). Pure dedupe, but a sweep across two
> primitives with their own live tests, so pilot-then-sweep says not in this slice. A test in
> `cvcSpellerScope.test.ts` pins the shared values against their copies so drift fails loudly.
> (b) **WORD FAMILY as a real narrowing axis** — the curriculum names it and we do not implement it;
> it is the coherence a set should get instead of accidental starvation.
>
> **DEAD LEVERS, asserted dead not ignored.** `vowelOptions` (fill_vowel's printed pair),
> `sortBucketLabel` (columns are read off the word's own middle letter at affirmation, so a
> generated label could only ever desync) and `commonErrors` (correction wording is hand-authored)
> are gone from the generator schema. **`fill_vowel` also loses its axis-2 lever entirely** — a
> decoy only exists where a child picks between printed options — exactly as sound-swap lost
> `nameTargetSound`. Its within-mode difficulty now rides on axis 1 alone (at `easy` the tutor
> repeats the word with its vowel held, *"caaat"*). `word_sort` keeps axis 2 and it now governs the
> POOL rather than a label, which is where it was always doing the real work; `spell_word` keeps
> both axes intact (probe: 1 distractor at `easy` → 5 at `hard`).
>
> **✅✅ DRIVEN LIVE 2026-08-10, AND IT CLOSED THE LANE'S BIGGEST DEBT: THE CORRECTION BRANCH FIRED.**
> A full 5-item `spell_word` session, 3m47s: **cat 100% (1 attempt) · hen 100% (1) · pig 100% (1) ·
> dog 67% (2 attempts) · bug 33% (3 attempts)**. User: *"the program worked great after that even
> on errors."*
> **`dog` took one correction and `bug` took two and then hit the cap and moved on** — so after
> four ports and two prior live runs that produced 9/9 and 5/5 first-try and NOT ONE correction,
> the correction branch, the correction wording, and `MAX_CORRECTIONS_PER_CHALLENGE` + `moveOnCue`
> are all now observed working. **The judge is discriminating, not permissive** — the question
> #82/#83/#84 were opened for, answered on port 4's surface.
> **The gesture anchor is PROVEN in production:** every advance was a spoken verdict on the third
> letter landing, with no Check button and no timer. Its deletion clock is now moot twice over.
> **The letter-group fix held live too** — the session drew `cat hen pig dog bug`, five different
> vowels, where the same lesson had previously produced `sat pat mat map`.
>
> **⚠️ AND IT FOUND A SHARED-ENGINE BUG THAT HAD BEEN LIVE FOR FOUR PORTS — `verdictTimeoutMs` was
> DEAD whenever the microphone was open.** Reported as *"if i say the word or spell the word, it
> doesnt move forward even after i click the tiles"*, with a backend log that named the mechanism:
> item 1 affirmed and advanced normally; on item 2 the child said **"h e n"** aloud; from then on
> **no `[DI_CVC_BUILD]` cue was ever sent**, while `[SAY_WORD]` kept flowing.
> **Diagnosis.** `[SAY_WORD]` is a direct `ctx.sendText`; the build cue goes through the loop's cue
> queue, and `schedulePendingCue` refuses to send while an attempt is open. The child's stray
> utterance opened a voice attempt, and the ONLY thing that can close an attempt the tutor never
> answers is the verdict-timeout tick — which was bound to `dispatch`:
> `}, [enabled, dispatch]);` with `TICK_MS` = 1000. `dispatch` → `schedulePendingCue` → `ctx`, and
> **`LuminaAIContext` builds its value as a plain object literal with no `useMemo` while
> `setMicLevel` fires on every audio frame**, so the provider re-renders every ~10-40ms, the effect
> re-ran every time, and a 1000-millisecond interval was torn down and recreated faster than it
> could ever fire. Not once, for a whole run. One word said aloud mid-build jammed the lesson
> permanently.
> **Why four ports missed it:** in every earlier pack the tutor ALWAYS speaks, so verdicts arrive
> through `tutor-text` and off-script through `tutor-quiet` — the tick is the one path they never
> need. `spell_word` is the first shape where the tutor is deliberately SILENT, so it is the first
> place the tick was load-bearing. **A shape change, not a code change, is what exposed it.**
> **Fix:** the tick effect depends on `enabled` alone and calls through `dispatchRef` (which is
> reassigned every render), so it is created once per run and never rebound to an identity that
> churns. `useJudgedSpeechLoop.tick.test.tsx` (new) reproduces it — it renders 40 times, as one
> second of mic frames would, and asserts the interval is created ONCE; **revert-bitten with the
> original `[enabled, dispatch]` deps and it bites.** Every existing test rendered once, which is
> precisely why nothing caught this.
>
> **➡️ RESIDUAL (filed, not fixed): a stray utterance mid-build now costs up to 8s.** With the tick
> alive the jam self-heals, but the build cue still waits out `verdictTimeoutMs` behind an attempt
> the tutor was told to ignore. The principled fix is for `submitGestureAttempt` to ABANDON an open
> voice attempt — on a build item a committed manipulation IS the answer, and the reducer's
> "a gesture never supersedes an attempt" rule was written for packs where speech is the answer.
> Deliberately not shipped in the same slice as the root fix: the drive that found this ran clean
> afterwards, so the extra change would be an unverified engine-semantics edit riding on a verified
> one. Do it with a bench or a second drive.
>
> **➡️ WHAT #85 STILL OWES.** The drive exercised `spell_word` end to end (and (i), talk-while-
> building, is what found the bug). Untouched: the SPOKEN modes' deliberate-wrong answers — the
> whole word said back, a letter NAME instead of a sound, a wrong-position sound. Those are ~90
> seconds and they are now the only unproven half.
>
> **⚠️ FAMILY-WIDE DEBT FOUND, NOT INTRODUCED: the tutor-live harness knows nothing about the DI
> modality.** `run_tutor_live.py` contains **zero** `DI_*` tags; `build_cvc_speller_journey`,
> `build_phonics_blender_journey` and friends still replay the click-era `sendText` messages and
> push 12-13-key context bags against 3-4-key catalogs. All four ports shipped with their journeys
> untouched, so a green run there is evidence about a prompt that no longer exists. The
> cvc-speller journey is now banner-marked STALE in its own docstring rather than silently
> false-greening; **teaching the harness a judged-loop journey shape is one job for all four packs,
> queued against the tutor-live harness — not a per-port fix.** Separately,
> `curriculum-designer-app/scripts/extract-catalog.ts` is ~70 primitives out of date AND mis-parses
> at least one entry (it emitted `"id": "In 1903, two brothers from Ohio…"`), so the cvc-speller
> row was hand-patched instead of regenerated; the extractor defect is filed here.
>
> **📄 MIC DRIVING CARD: `qa/HANDOFF-di-mic-sitting-2026-08-10.md`** — #82/#83/#84 in order,
> the exact wrong answers to say, and the shared DI-GREET-1 first-10-seconds check. Handed
> to the user 2026-08-10 to drive separately while port 4 is built.
>
> **➡️ THE CORRECTION BRANCH IS STILL UNHEARD AFTER THREE RUNS, AND THAT IS NOW THE LANE'S
> BIGGEST DEBT.** #83 ran 9/9 first try; #84 ran 5/5 first try; #82 undriven. Every
> affirmation so far is compatible with a permissive judge — including the two DI-1 wins
> above, which is uncomfortable but true. **The next sitting must answer deliberately wrong**
> (the singular said back; a near neighbour; "dogses"). ~90 seconds per row.
>
> **➡️ NEXT = `cvc-speller` (port 4).** It ends the gesture-anchor question (`spell_word`'s
> Elkonin boxes are its first real customer), and it still carries a PTT mic + 7 advance
> affordances. Letter NAMES must not become the answer (blocked class — `fill_vowel` is
> spoken, `spell_word` is a placement). It is the biggest and riskiest port left, so the
> honest read is that **the mic sitting is now the higher-value move**: three ports are
> shipped and the correction branch of the template has still never been heard.
> `phoneme-explorer` owes a portfolio call on `isolate`; `rhyme-studio` stays behind a bench
> sitting (production is open-set). Full order + blocked set: handoff §5.
>
> **ENGINE — the deletion clock on `submitGestureAttempt` has now run BOTH its ports, and
> the answer is KEEP.** The handoff's rule was *"if the next two ports are also verbal,
> propose deleting it"*; ports 2 and 3 were both verbal, so the clock has expired — and it
> was measuring the wrong thing. Every remaining gesture customer is still queued and
> unported (`cvc-speller`'s `spell_word` Elkonin boxes, `syllable-clapper`, `word-sorter`,
> `sentence-builder`, `story-map`), so **the count reflects port ORDER, not demand**, and
> port 4 is the customer. It stays, with its one non-obvious rule intact: the cue is sent
> BEFORE the attempt opens, because `schedulePendingCue` refuses to send while an attempt is
> open — an attempt opened at commit time would block the very cue meant to provoke its
> verdict. `submitGestureAttempt` handles the ordering; do not hand-roll it.
>
> **CENSUS, updated after port 3:** tutor-driven **3** (`phonics-blender`, `sound-swap`,
> `word-flip`) · stopwatch **5** (`cvc-speller`, `letter-sound-link`, `rhyme-studio`,
> `picture-vocabulary`, `phoneme-explorer`) · click-to-advance **3** · no voice **20**.
> Separately, **4 primitives still make the child press a mic button before answering**
> (`cvc-speller`, `interactive-book`, `letter-sound-link`, `rhyme-studio`) — an axis rev 1's
> census never measured, and already a violation of the standing open-mic ruling. 3 of 31
> down; the three ported are the only three with no advance timer anywhere.
>
> **✅ SUCCESS GATES, both checkable per port (handoff §1):** (a) no advance timer, no PTT
> hook, no next/check button anywhere in the ported path; (b) nothing names the answer
> before the child gives it. The pilot shipped a printed target word AND a picture of it,
> and only the live run caught them.
>
> **➡️ `/add-di-loop` IS NOW EXTRACTABLE, and three ports have measured exactly where the
> seam is.** Handoff §3's five steps held verbatim on all three; **everything that varied
> was inside step 1, the SCRIPT**, and the variation is a genuine per-skill question, not
> style: in phonics-blender the model IS the answer (blending is reproduction), in
> sound-swap it must NOT be (the answer is a word the child builds), and in word-flip the
> RULE is modeled on a different noun while the answer is withheld. Three ports, three cue
> shapes. A skill carrying any one of them as a template would have shipped the answer
> inside the ask on the other two. **So the skill carries: the component skeleton (port 3's
> component is port 2's with the nouns changed), the catalog checklist, the contextKey trim,
> the two §1 gates, and the scripted-opener rule from SWAP-1 — plus a CHECKLIST OF QUESTIONS
> for the script, never a cue template.** Questions the three ports actually answered: may
> the model contain the answer? what looks like an answer and is not, for THIS skill? is the
> hand-over unambiguous, or does the stimulus itself answer it? Queue: write it after the
> mic sitting, so the checklist ships a verified template rather than an assumed one.
>
> **`letter-spotter` stays BLOCKED regardless** — letter NAMES are an unbenched homophonic
> class ([[project_letterspotter-voice-blocked]]). `decodable-reader` / `read-aloud-studio`
> are blocked on passage-length fluency having no judge.
>
> **Doctrine that must survive the port** (all previously ruled): open mic over turn windows;
> the mic is never gated on tutor-busy; the tutor is quiet by default; cue on the FIRST audio
> frame; no visible timers; Live judges the AUDIO in-band — word-matching is the reporting
> channel, not the judge. `/add-voice-control` survives as the interim non-DI rung;
> `/add-spoken-judge` was RETIRED 2026-08-09 and its doctrine lives in
> `docs/SPOKEN_INTERACTION_DOCTRINE.md`.

> **ORDERING RULING (user, 2026-08-01): PUSH DEVELOPMENT — supersedes the 07-27
> pull order below.** After two weeks of testing-heavy DI iteration the user
> wants sessions spending tokens on PLATFORM CAPABILITY, favoring work that does
> not require substantial testing (machine-gated ladder rungs, design slices,
> mechanical sweeps) over test-infrastructure builds and mic sittings. New pull
> order: **the family ladder** (di-math-facts L3 → di-letter-sounds L3 →
> di-word-reading L2 → di-sentence-reading L4 — all script/config-level,
> eval-test/tutor-test gated, zero sittings required; **di-math-facts L3 DONE
> 2026-08-01** — the delegated slice landed (script-composed fade + `supportTier`
> contextKey + the tester's new family tier selector; 14/14 new tests, 3/3
> real-pipeline probes; ear-check → HUMAN-CHECKS #50(d); report
> `qa/eval-reports/di-math-facts-support-tiers-2026-08-01.md`);
> **di-letter-sounds L3 DONE 2026-08-01** — third use of the template
> (`leadInFor` + `coldSoundGuard` composed in the script; per-mode composition
> verified — onset keeps the WORD in the ask while its sound withdraws, vowels
> keep the keyword while "short a" naming withdraws; catalog audit clean like
> math's, no rewording; 20 new tests with non-vacuity ×7, 3/3 real-pipeline
> probes incl. mixed-all-tiered; ear-check → HUMAN-CHECKS **#57**; report
> `qa/eval-reports/di-letter-sounds-support-tiers-2026-08-01.md`); the ladder
> still runs SERIALLY and `catalog/di.ts` is free again — ~~next rung =
> di-word-reading L2~~ **✅ 08-03 `66a2d66`; di-sentence-reading L4 ✅ 08-03
> `603cc82`; di-letter-sounds L4 ✅ 08-03; di-math-facts L4 ✅ 08-04;
> di-word-reading L1 ✅ 08-04**) → **item 2 remediation implementation**
> (design closed 08-04; the misconception loop's consumption half — a real
> platform capability; gate = `/misconception-test`, automated) → ~~**item 8's
> flush sweep** (mechanical, pilot passed 3×)~~ **(DONE 2026-08-01, parallel
> lane — no file overlap with the L3 slice)** → ~~**item 6** probe
> (backend-only)~~ **item 6 DEPRIORITIZED 08-05 (user: free-form calibration
> imperfection accepted — see item 6). ~~The lane's remaining queue-of-record
> pulls are 14g's `counting_next` 1–120 fix (in-scope pack development), then
> NEW development items (next pack / spoken expansion) authored with the
> user.~~ **14g LANDED 2026-08-05 as far as machine work reaches:** the parse
> bug is fixed (a 120 ask now SATURATES at twenty instead of collapsing to
> twelve) and the 120 EXTENSION became **item 10 — BLOCKED on one ~30-min bench
> sitting** (standing gate 1, multi-word numerals), whose probe set "Counting to
> 120" is wired and waiting → HUMAN-CHECKS **#63**. **Next pull is therefore
> either that sitting (30 min; it unblocks item 10's build slice, or kills
> Option B on evidence) or authoring the NEXT development item with the user.**
> **Item 9 Tier 2 is DEMOTED from top pull but stays queued** as the absorber of
> item 5's residual runtime checks (the level-3 🔄 card via
> `LUMINA_FAULT_MUTE_EPISODES=2` + an end-coherent full run) — build it when a
> testing-capability slice is warranted again, not next.
>
> **FAULT-FLAG HYGIENE (user ruling, 2026-08-01: "we are making ticking time
> bombs").** `LUMINA_FAULT_MUTE_S=25` had been left in `backend/.env` and was
> silently sabotaging the first run of every backend boot. Defused + guarded
> the same day: the flag is gone from .env, and `lumina_tutor.py` now REFUSES
> to arm any fault flag that reaches settings without being in the PROCESS
> environment (pydantic loads .env without touching os.environ, so persistence
> is detectable) — it logs one loud ERROR naming the fix instead. Fault drives
> arm shell-scoped for one run only: `$env:LUMINA_FAULT_MUTE_S='25'; uvicorn
> app.main:app`. The rule generalizes: any dev/testing affordance must be
> impossible to leave armed — refuse persisted forms loudly, never rely on a
> human remembering to clean up.
>
> *(07-27 ruling, kept for the record — human sittings must not be the critical
> path; that half still stands. Its pull order — item 9 Tier 2 → flush sweep →
> item 6 → item 2 — is superseded above. Item 7 fixed 2026-07-27. Human rows
> (#56, the sentence sitting, #45) stay valuable but nothing waits on them —
> the ONLY code frozen on a sitting is the contrastive-correction port to
> di-letter-sounds/di-word-reading (#55, family rule; leave it last).)*

15. **CTX-2 — WHO HOLDS THE FLOOR. ✅ SHIPPED `1cf72ae` 2026-08-08 and SIGNED OFF
    LIVE by the user; still UNREPORTED and its number is still unmeasured.**
    *(Ship note: `1cf72ae` also carries the client half — `LuminaAIContext.tsx`
    gains the per-message `interrupt` option on `sendText`.)*
    *(Filed by `/pm` 2026-08-08 for work that already existed in the tree with no
    queue entry, then shipped the same session. It is the next layer after item
    13 and should not be read as part of it.)*
    **✅ RUNTIME GATE MET (user, 2026-08-08):** a real lesson driven with the
    Lumina tutor on — *"it worked great, honestly feels a little smoother"*. That
    is the acceptance half, and it is genuine evidence: the defect class this
    closes is *a child hearing a sentence cut in half*, which is heard, not
    typed. Backend units 38/38; full backend 26F/122P against a documented 26F
    baseline.
    **⚠️ STILL OPEN, and do not let the sign-off close it:** (i) **the post-fix
    ledger NUMBER.** The pre-fix rate is measured (33 sends / 9 min, five inside
    3.1s, three turns killed by our own text 40–55ms after landing), the ledger
    rows already exist, so the after is a *gate*, not an opinion — and "felt
    smoother" cannot distinguish 33 sends from 6. (ii) **a report** in
    `qa/tutor-reports/`; the design rationale still lives only in source
    docstrings. (iii) **the `wedged` watchdog** — a turn that never reports an
    end. Confirm it fires and that a wedged gate cannot silence the tutor
    permanently. **That is a failure mode a floor gate ADDS, and one smooth
    lesson is exactly the evidence that would not reveal it.**
    **What item 13 left open.** CTX-1 deleted the `[CONTEXT UPDATE]` push, which
    removed one *sender*. It did not arbitrate the senders that remain, and the
    transport is unchanged: `send_realtime_input(text=…)` always closes the turn,
    so the Live API has exactly **one floor** and every cue we forward cancels
    whatever the tutor is mid-way through saying. **The 2026-08-08 lesson session
    measured what that costs: 33 sends in 9 minutes, five of them inside 3.1s
    (13:01:29.5 → 13:01:32.7) of which only the last was ever spoken, and three
    turns killed outright by our own text 40–55ms after it landed.** Item 13's own
    8s hold ceiling is named in the new code as having made it worse, not better:
    it *"just interrupted 41s read-alouds 8 seconds late."*
    **The shape built.** (a) A `FloorGate` tracking whether the model is
    mid-utterance, held **outside** any one Gemini connection so a transparent
    resume cannot leave it believing a dead turn still holds the floor; a single
    sender waits for quiet. (b) **Batching** — five cues become one turn instead
    of four cancellations. (c) **Supersession**, deliberately narrow: only
    entries carrying a `render` callback collapse, and only against their own cue
    tag; anything with literal text always survives, because a drop rule wide
    enough to also eat `[ANSWER_CORRECT]` or the four `[ACTIVITY_START]`s a lesson
    fires at connect would lose things the tutor needs. (d) **Render at SEND
    time, not enqueue time** — a message whose wording depends on session state
    ("Previous activity: X") must not be frozen while it waits, and if it is
    superseded it was never said and must leave no trace in that state.
    (e) **`interrupt` is declared BY THE CLIENT, per message** — only the thing
    that fired it knows whether cutting in is worth it (a student tapping away to
    a new activity has left the screen being described; a slider tick on the
    current screen is not worth a severed sentence). One fallback, `False`, not
    one per handler branch: *"a per-type default is the same guess wearing a
    protocol's clothes."* Counters on the gate: `yielded` / `superseded` /
    `merged` / `interrupted` / `wedged`.
    **What this row still owes, and it is the whole verification story.**
    (i) **A report.** The evidence above lives only in source docstrings.
    (ii) **The before/after number.** The ledger already carries the rows, and
    the pre-fix figure is measured (33 sends / 9 min, 3 self-killed turns) — so
    the post-fix rate is measurable and has not been measured. That is the gate.
    (iii) **A live ear**, which is not the same thing: the defect class is *a
    child hearing a sentence cut in half*. Fold into the standing mic session
    (#63/#72/#76) rather than opening a fourth row — **but do not strike #76 for
    it**; #76 is CTX-1's acceptance and this is a different mechanism.
    (iv) **The `wedged` watchdog** — a turn that never reports an end. Confirm it
    fires and that a wedged gate cannot silence the tutor permanently; that is
    the failure mode a floor gate adds that no previous design had.
    **Do not ship this in the same slice as anything else** — it is backend +
    context transport and shares no file with the four other uncommitted slices.
    **➡️ EVIDENCE UPDATE (filed by `/pm` 2026-08-10):** the real-lesson run
    `qa/tutor-reports/lesson-live-2026-08-10-excavators.md` (16m50s, 8 primitives)
    already carries post-fix floor-gate numbers — **27 batches, `wedged 0 /
    superseded 0`, one 8,650-char attachment batched cleanly, tutor silent through
    53% of student turns on a hot mic** — against the measured pre-fix 33 sends /
    9 min with 3 self-killed turns. Owed items (i) and (iii) can cite that run;
    what remains genuinely unproven is **(iv) the `wedged` WATCHDOG** — a
    `wedged: 0` run is exactly the evidence that cannot show it fires. The
    closeout is now a documentation slice plus one watchdog probe.

14. **di-shapes — PACK #5 BORN 2026-08-06 (`cabb3f0`, user modality call:
    "this is a triangle — what is this?"). L0 live loop UNVERIFIED →
    HUMAN-CHECKS #72 (folds into the same mic session as #63's re-run).**
    DISTAR shape naming over the judged-loop engine: drawn SVG shape at a
    generator-stamped rotation (K.G.2 "regardless of orientation"), spoken
    shape-name answer, contrastive correction on near-names. Fork A menu
    service: code-owned 9-shape menu (K core five: circle/triangle/square/
    rectangle/hexagon; extended: oval/pentagon/rhombus/trapezoid), named
    shapes in the objective win, wrapper leak-guard keeps names out of the
    chrome. Geometry IS the rule-#1 guard (rectangle ≥1.6:1, oval clearly
    non-circular — one defensible name per drawing); "diamond" = judged
    alternate of rhombus, stated per-item. Answer-leak: contextKeys carry
    `challengeType` ONLY (the name is the whole answer). Bench: `Shapes`
    probe set + `shape` kind cue branches (adjacency stress + acceptAlso).
    Registration complete incl. β (name_shape 1.5) + `di-shapes →
    MATHEMATICS` in `_PRIMITIVE_TO_SUBJECT`. Gates: DI sweep 304/304, full
    Vitest 1791/1791, typecheck:lumina 0, py_compile clean, real-pipeline
    probes 3/3 (generic K = core five; named narrows; diamonds → rhombus).
    Report/birth cert: `qa/eval-reports/di-shapes-birth.md`.
    **Ladder (birth-cert follow-ups):** ~~(1) `/curriculum-fit di-shapes`~~
    **✅ RUNG 1 CLOSED 2026-08-07 — MATCH at BOTH K and G1, 5/5 coherent
    (K 0.795 `GEOM001-01-A` "Match and name basic 2D shapes… regardless of
    size, color, or orientation"; G1 0.798 `GEOM001-01-c` defining vs
    non-defining attributes). K.G.2 orientation-independence is now MEASURED —
    the curriculum's own top-1 wording carries it.** Report
    `qa/curriculum-fit/di-shapes-2026-08-07.md` (+ `.json` artifact).
    **Two things rung 2 must carry:** (a) `count_sides`/`count_corners` have an
    exact home at BOTH grades, not just G1 — G1 `GEOM001-01-b` @ 0.785 *"Count
    the number of sides and vertices of various 2D shapes"* (its own examples
    enumerate 8 of the 9 Fork A shapes with the same counts) and K
    `GEOM001-02-A` @ 0.786 *"…based on their attributes (sides and vertices)"*;
    (b) **BLOCKER — `catalog/di.ts:456` `constraints` says "no side/corner
    counting tasks yet… use a geometry primitive with those modes when counting
    IS the objective". That clause is manifest-visible steering: ship the modes
    without lifting it and they are born UNREACHABLE.** Keep the 3D-solids and
    composing exclusions — G1 ranks 4/5 are 3D solids (0.770) and pattern-block
    composing (0.769), both above τ, so those fences are load-bearing.
    **Probe defect found + fixed in the same slice:**
    `curriculum_fit_probe.py:85` scoped by `subject_for_domain`, not the live
    path's `subject_for_primitive` — pre-fix di-shapes scoped to LANGUAGE_ARTS
    and ABSTAINed diffuse against **Rhyme Recognition / Onset-Rime / Phoneme
    Isolation** (the exact misattribution class the skill exists to catch; it
    would have filed a false K-geometry curriculum gap). The 07-24 di-math-facts
    report had masked it with a deliberately-wrong `--domain math`.
    `curriculum_fit_sweep.py` had the same defect plus a hoisted subject/grades
    loop; both fixed, controls clean. `verify_retrieval_matcher.py:49` +
    `curriculum_fit_knowledge_check.py:149` still resolve by domain only — not
    wrong today (no DI fixture row), one row away from being wrong.
    ~~**(2) L1 `/add-eval-modes`**~~ **✅ RUNG 2 CLOSED 2026-08-07 — di-shapes
    is L1. Four identities: `name_shape` 1.5 · `shape_review` 2.5 ·
    `count_sides` 3.0 · `count_corners` 3.5** (β mirrored into
    `problem_type_registry.py`). The "how many sides does it have" half of the
    founding modality call is now shipped. Report
    `qa/eval-reports/di-shapes-eval-modes-2026-08-07.md`.
    **Standing gate 1 cleared without a sitting, and the reason is
    load-bearing:** the counting answer is a number word in **3..6** — the #46
    class — and the menu tops out at a hexagon, so **no multi-word numeral can
    arise**. That is exactly what blocks item 10 behind #63; the gate does not
    reach this rung. The catalog fence rung 1 flagged is LIFTED (constraints +
    description both now name the counting ask, or the modes ship unreachable);
    the 3D-solids and composing exclusions are KEPT — rung 1 measured them at
    0.770 / 0.769, above τ.
    **Two pedagogical rulings, recorded so they are not re-litigated:**
    (a) **counting items are POLYGON-ONLY** — a curved shape carries
    `sides: null` (not-applicable, not zero) and "how many sides does a circle
    have?" has TWO arguable answers for a five-year-old (0 straight sides, or 1
    curved edge), so it fails the pack's *one drawing, one defensible answer*
    birth discipline; a curves-only scope WIDENS rather than emitting an
    unanswerable item. (b) under a counting mode the shape's **NAME is withheld
    too** — it hands the count to a child who knows it (triangle → three).
    **Two defects found and fixed in-slice:** `shape_review`'s wide draw would
    have overridden shapes the objective NAMED (caught by revert-bite, not
    inspection — it failed the pre-existing L0 scope test); and a live probe
    shipped chrome reading *"Curve Safari! … smooth outlines"* over five
    polygons, because the wrapper is written before the pools are built.
    Gates: focused 28/28, **6 revert-bites all bit**, full Vitest **2169/2169**,
    typecheck:lumina 0, src-scoped tsc **803 = baseline** with zero errors in
    any touched file, py_compile clean, tutor-test T2 zero `(not set)`,
    **real-pipeline probes 7/7** — incl. `mixed` producing all four identities
    in one session (SP-21 live) and `count_sides` on *"circles and ovals"*
    producing **zero curved shapes**.
    **Residuals:** (i) **no Tier-3 live audio on the counting contract** — that
    the tutor waits out a child counting aloud, refuses an off-by-one, and never
    counts aloud itself is UNPROVEN; folds into the same mic session as #63/#72.
    (ii) the **zero/none contrast** ("a circle has no straight sides") is the one
    part of `GEOM001-01-b` this rung deliberately does not cover — its own item
    shape + a bench check on "zero"/"none" as a spoken answer.
    (iii) **Cross-queue, filed not fixed:** di-math-facts' Tier-2 probe resolves
    `supportTier: unresolved` and renders ONE `(not set)` into the assembled
    prompt — the L3 support-tier contextKey, a different rung.
    ~~**(3)/(4)**~~ (3) L2 catalog contextKeys stay minimal by design — revisit
    only with evidence *(rung 3 added exactly one, `supportTier`, on evidence:
    at `hard` the script hands the tutor nothing to say before the ask, so the
    tier is what tells it the silence is deliberate)*.
    ~~(4) L3 `/add-support-tiers`~~ **✅ RUNG 3 CLOSED 2026-08-07 — di-shapes is
    L3.** Fourth use of the family script-composed fade (easy model+guide+test /
    medium model+test / hard cold-answer), verified on real generated data.
    Report `qa/eval-reports/di-shapes-support-tiers-2026-08-07.md`.
    **Two pack-specific findings worth carrying forward:** (a) the fade needed
    **no per-mode carve-out**, and that is a PROPERTY not luck — the stimulus
    here is DRAWN (already on screen at every tier) and `ask()` is answer-free by
    construction, where di-letter-sounds had to keep SPEAKING its stimulus at
    hard and needed an inversion guard. Pinned as a test so a future mode that
    breaks it fails loudly. (b) **A cold COUNT withholds two tokens, not one:**
    the shape's name is not the answer but hands it over (triangle → three), so
    the counting guard names the count, the name, AND describing/counting the
    drawing aloud. Also reworded catalog `scaffoldingLevels.level2` — it said
    "say the answer once more *the way the script did*", a back-reference that
    points at silence once `hard` models nothing.
    Gates: focused 55/55, **8 revert-bites all bit** (incl. the classic
    gate-on-pinned-mode no-op), full Vitest **2349/2349**, typecheck:lumina 0,
    src-scoped tsc **803 = baseline** with zero errors in any touched file,
    real-pipeline probes **6/6** (incl. `mixed`@hard producing all four
    identities all tiered, and an untiered control byte-identical to easy).
    **Residual: no live audio on the `hard` tier** — that the tutor honours a
    cold ask (never names the shape, never counts the drawing aloud) is UNPROVEN
    live; folds into the same mic session as #63/#72.
    **↑ This ALSO diagnoses cross-queue residual (iii) above, and the diagnosis
    changes it.** The `supportTier: unresolved` / one `(not set)` that item 14
    filed against di-math-facts is **not a math-facts defect** — it is a
    family-wide harness blind spot: `scaffoldAudit.analyzeHookSite` parses
    `useLuminaAI({ primitiveData })` hook sites, but every DI pack passes its bag
    through `ctx.connect({ primitive_data })`, so **all five packs report
    `data-bag-unparsed` with `dataBagKeys: null`** (measured on
    di-letter-sounds / di-math-facts / di-sentence-reading, not assumed). The
    probe never sees the component key space, so its preview is not evidence
    about the shipped prompt. di-shapes closes the claim by EXECUTING the
    component instead (`DiShapes.support-tier-context.test.tsx`, jsdom). **Filed
    for the tutor-test harness queue: teach `analyzeHookSite` the
    `ctx.connect({ primitive_data })` shape**, or every DI pack's contextKeys
    stay audited blind.
    ~~(5) L4 structural~~ **✅ RUNG 4 CLOSED 2026-08-07 — di-shapes is L4.**
    Shipped in the same slice as rung 3, because L3 alone left easy/medium/hard
    drawing BYTE-IDENTICAL pictures with only the spoken scaffold toggled — the
    weak outcome the skill warns about, and a ceiling a child who had mastered
    the mode could not climb past. Lever = **exemplar typicality**: prototype →
    non-prototypical drawing (scalene obtuse triangle, irregular hexagon/
    pentagon, portrait rectangle, right trapezoid, tall oval), rotation ¼ →
    full safe ceiling, scale 100% → 62–100%, and confusable neighbours kept
    apart → placed side by side (adjacent COUNTS under a counting mode).
    **Three findings worth not re-deriving:**
    (a) **The rotation cap was hiding the standard.** The menu's
    `maxRotationDeg` capped a triangle at 25°, so a pack whose curriculum home
    is literally *"regardless of orientation"* had NEVER tested orientation.
    `SAFE_ROTATION_DEG` (in `diShapesGeometry.ts`) separates the gentle untiered
    default from the rule-#1 ceiling; a hard triangle now reaches point-down.
    Per-shape and principled: square 15° (45° = a DIAMOND, a judged alternate
    for rhombus → two right answers), hexagon 30° / pentagon 36° (rotational
    symmetry — beyond it you redraw a picture already seen), triangle and
    trapezoid the full 180°.
    (b) **Geometry became DATA (`diShapesGeometry.ts`) and the oracle earned it
    immediately** — every polygon's point count must equal the menu's `corners`,
    or a five-point "irregular hexagon" asks how many sides and then marks the
    child's correct answer WRONG. Plus rect ≥1.6:1 in both exemplars, oval
    non-circular, rhombus four equal sides, triangle variant provably scalene
    AND obtuse.
    (c) **Fork A makes this axis purely code-enforced** — the reference impls
    split the lever between a describing prompt and an enforcing post-process
    because the LLM drifts; here the LLM authors no item content at all, so
    there is one dial in one place and no drift is possible.
    **Two bugs the rung produced and caught:** a REAL one — the greedy adjacency
    walk could strand two of the same shape side by side, breaking the pack's
    pre-existing back-to-back variance rule (fixed, `repairBackToBack`); and a
    FLAKY TEST, which is worse than no test — the first adjacency assertion sat
    exactly on easy's measured mean and failed ~1/3 of runs. Rewritten against a
    measured 300-session distribution (easy 0.42 / medium 0.85 / hard 1.46) at
    ≥3σ, then hammered 12× green. **One change reverted ON MEASUREMENT:** seeding
    the greedy from an item with a partner sounded right, moved the mean 1.54 →
    1.46 (nothing), reverted rather than kept on a plausible argument.
    Gates: di-shapes suites **173/173**, **17/17 revert-bites** across both
    rungs, flake hammer 12/12, typecheck + tsc zero errors in any di-shapes
    file, real-pipeline probes **11/11**.
    **Residual: the hard drawings have not been seen by a human on screen** —
    geometry and render path are both asserted, but nobody has confirmed a
    62%-scale irregular hexagon at 30° still READS to a five-year-old. Folds
    into #72 with the cold-ask ear.
    **NEXT on this ladder = (6) L5 `/add-sound`.**

13. **CTX-1 — ✅ FIXED 2026-08-07. The `[CONTEXT UPDATE]` push is deleted; the
    state is kept and now rides out on messages that already asked for a turn.**
    *(Filed as a `d895bfb` gate regression; reframed twice by user ruling — first
    "the gate is scaffolding around a channel that shouldn't exist", then
    **re-scoped 2026-08-07** because the first reframe was read as deleting more
    than it should. See "SCOPE FENCE" immediately below, then "SEVERITY
    DOWNGRADED + FIX REFRAMED".)*
    User-reported from a live session 2026-08-06 17:02.**

    **WHAT SHIPPED.** `ContextUpdateGate` (89 lines) is **deleted outright**, and
    with it every `floor_taken`/`floor_released`/`reset`/`aclose` call site — the
    8s hold ceiling that force-released a parked update into a still-speaking
    tutor no longer exists because there is nothing left to park. `update_context`
    now merges into a server-side `PrimitiveState` and **queues nothing**: the
    `context-update` ledger row is unchanged, the state is retained in full, and
    the notification is gone. The state rides out on the next message that
    genuinely gives the model the floor, prepended so the ask stays last, and
    **only when it changed** since the model last saw it. The `[CONTEXT UPDATE]`
    prompt bullets at `:552`/`:641` and the advertisement at `:597-598` are
    deleted; the `[PRIMITIVE SWITCH]` half of `:597-598` and the transition
    handling at `:616` are untouched. Net **−1 class, −41 lines** in one file.

    **⚠️ ONE CODE FACT THE PLAN DID NOT KNOW, and it changes an instruction.**
    The plan said *prepend* the state block. Prepending naively **breaks cue
    classification**: `classify_cue` matches the LEADING bracket tag, so a state
    block in front of `[DI_ITEM] …` reclassifies it to `"text"` — corrupting the
    ledger's `kind` field and the fault-injection arming that keys off it. Fixed
    by classifying **before** attaching; pinned by
    `test_the_cue_tag_survives_attachment`. Any future session moving this
    attachment point must keep that ordering.

    **STEP 3 OF THE PLAN WAS NOT BUILT, and should not be — it is already done.**
    The plan asked for a server-side struggle trigger firing a real cue on
    repeated failed attempts. There is **no input signal to build it on**:
    `student_action` has **zero senders in the entire repo** (the handler at
    `:1052` is dead code), so the server cannot observe a failed attempt.
    Struggle already arrives as explicit `end_of_turn=True` cues the primitives
    send themselves — `[ANSWER_INCORRECT]`, `[RHYME_MISS]`, `[DI_ITEM]` — which
    is exactly the "speaking action should be a speaking message" shape step 3
    wanted. It was implemented client-side years before this item existed.

    **CONSUMER CHECK — the plan's "confirm no other consumer" clause found one,
    and it is preserved.** The five DI packs (`DiMathFacts`, `DiWordReading`,
    `DiSentenceReading`, `DiLetterSounds`, `DiShapes`) push a contextKey bag
    through `updateContext` to *"keep the tutor's RUNTIME STATE truthful as facts
    advance"*. Catalog `{{key}}`s resolve **server-side at switch/connect time**
    only, so post-switch that push WAS the tutor's only source of the current
    item. Under the fix it is strictly better: the bag now arrives **attached to
    the `[DI_ITEM]` that asks for the judgment**, instead of landing early and
    being buried under intervening audio. No frontend change was needed — clients
    keep sending `update_context` exactly as before.

    **VERIFICATION — driven at runtime against the live backend + real Gemini
    Live, both gates the item named.**
    (a) **`states-of-matter` full journey, 11 beats, all correct.** The
    `silent_slider_wiggle` beat — three slider moves — produced **zero audio and
    zero sends**. Ledger: **6 `context-update` rows** (state kept) → **0
    `[CONTEXT UPDATE]` sends** → **0 barge-ins**. `state_attached` climbed 1→2→3
    across the three phase-change cues and then **stayed at 3** for the next five
    messages: the de-dupe works live, not just in unit tests.
    (b) **REGRESSION GATE PASSED — `lesson-refer-back --lesson`, 6 beats.** Both
    switches announced (`switch-primitive` + `switch-announced` rows, debounce
    intact at 2.5s), the tutor acknowledged each new activity in one sentence
    (*"Now let's figure out how those parts move with hydraulics"*), and on
    `refer_back_to_section_1` it answered about the **right** primitives (boom /
    stick / bucket, then the cylinders). `state_attached` stayed **0** all
    session — switch resets the bag and marks it conveyed, so the announcement's
    own scaffold is not duplicated. 0 barge-ins.
    (c) Unit: **28 passed**; 13 new `PrimitiveState` tests replace the 9 gate
    tests, incl. the fence gate `test_lesson_prompt_still_announces_the_primitive_switch_channel`.
    Backend suite **26 failed / 105 passed vs. a measured 26 / 101 baseline** —
    same pre-existing failures (`test_planning_service`,
    `test_ai_recommendations_integration`, `test_assessment_feedback_integration`,
    none importing `lumina_tutor`; `test_dag_analysis` fails collection on a
    missing `app.models.diagnostic`). py_compile clean.

    **RESIDUALS.**
    (i) **No real-mic session.** The reported defect needed a state change to
    land *during* a >8s turn; the harness sends beat-synchronously, so that exact
    timing was not reproduced. The argument that it cannot recur is **structural,
    not statistical** — `update_context` no longer has any path to `text_queue`,
    so there is nothing to land at any timing. Still worth one human ear.
    (ii) **Voice-only exploration is the one place state can go stale.** Audio
    bypasses `text_queue`, so a student who drags a slider and then asks *aloud*
    gets a tutor that has not been handed the new state. Text/cue paths are
    covered. Cheap fix if it ever bites: attach on the transcription boundary.
    (iii) `[CONTEXT UPDATE]` is **deliberately left in `_CUE_TAGS`** so historical
    ledgers still classify correctly. Nothing can emit it.

    ---
    *Original filing below, kept for the reasoning and the fence.*

    **⚠️ SCOPE FENCE — USER RULING 2026-08-07. READ THIS BEFORE THE FIX SECTION.**
    *"the fix is not remove context update, its to not notify the LLM, this is
    just one of those parsimony items we can outright remove."*
    **What must survive:** the tutor must still know **which primitive the student
    is currently on**. Do NOT replace per-navigation awareness with a
    feed-everything-at-session-start dump — a static manifest of all primitives
    cannot tell the model that the student just scrolled to a different one, and
    the tutor's whole job depends on knowing where they are.
    **What is deleted:** the *notification* — the act of pushing within-primitive
    state at the model as a message. Outright removal, not a gate, not a delay,
    not a reworded prompt.
    **VERIFIED AT THE CODE, so the executor does not have to trust this
    framing:** navigation and state are **two different message types**, and only
    one of them is in scope.
    - `switch_primitive` → `[PRIMITIVE SWITCH]` (`lumina_tutor.py:1068`, announced
      at `:900`) is the **navigation** channel — *"the student has moved to a new
      activity"* — and it is already **debounced so only the primitive they SETTLE
      on is announced** (`:1087-1089`). **This channel is NOT part of CTX-1 and
      must be left exactly as it is.** It is what answers "where is the student".
    - `update_context` → `[CONTEXT UPDATE]` (`:1023`) carries only **state WITHIN
      the current primitive** — the prompt defines it at `:552`/`:641` as *"silent
      state change (slider moved, option selected)"*. **This is the only thing
      CTX-1 removes.**
    So the scroll/navigation signal is not at risk from this fix — but the fence
    is written here as a hard constraint anyway, because the two channels sit ~45
    lines apart in the same `elif` chain and a session working fast could delete
    the wrong one. **If a change would make the model stop learning that the
    student switched activities, it is out of scope and wrong.**
    **Symptom (what the child hears):** the tutor spoke a self-directed stage
    direction — *"Silence is the invitation to keep exploring, not a question
    from the student. Wait for them to take the next step in identifying the
    truck parts."* Third person, imperative, about the student. It is a
    **verbatim recitation of the style rule** at `lumina_tutor.py:563`/`:654`
    (*"…observations end cleanly — silence is the invitation to keep exploring,
    not 'What do you think?'"*), completed with vocabulary spliced from the new
    QUESTIONS FROM THE STUDENT block (*"a question from the student"*).
    **Same class as item 11's original defect** (prompt line recited as dialogue)
    and as its own `(not set)` rider: internal machinery reaching the child's ears.
    **STATUS NOTE (verified 2026-08-07): the SYMPTOM STRING is already gone; the
    MECHANISM is not.** The three recitable maxims — including this exact
    "silence is the invitation to keep exploring" line — were deleted outright on
    2026-08-06 (`a55c674`, `b87dd8b`, `aab8260`), and a grep of
    `lumina_tutor.py` now returns **no match** for it. So the tutor cannot say
    *that sentence* again. **This item is still open and still worth doing**,
    because nothing about the channel changed: a state push still lands mid-turn,
    still hands Gemini the floor (`:204`), and still invites an unbidden turn — it
    will simply recite *different* prompt text next time. Deleting the recited
    strings was closing the symptom; CTX-1 is closing the channel (CLAUDE.md
    Verification Doctrine: *"close the channel, not the symptom"*). **Do not read
    the missing string as evidence this is fixed.**
    **Root cause — layer 1, the one to fix.** `ContextUpdateGate._release_later`
    sleeps `MAX_HOLD_S = 8.0` then sets `_busy = False` and re-queues the parked
    update **unconditionally**, with no check on whether the tutor is still
    speaking. Normal tutor turns routinely exceed 8s — item 11's OWN live report
    recorded 8.2s, 8.4s, 14.5s and 20.5s turns. So the gate built to PREVENT
    self-inflicted barge-ins reliably CAUSES one on any turn longer than its
    ceiling. The log matches exactly: send at `19.104` → `barge-in` at `19.161`
    (57ms) → `AI turn finished` at `19.163`.
    **Layer 2 (why it then talks).** `send_realtime_input(text=…)` always closes
    the turn and hands Gemini the floor (documented at `:204`); `send_client_content`
    is NOT an option — Gemini 3.1+ rejects it mid-session with 1007 (`:1140`). So a
    landed update is an invitation to speak, and the only defence today is the
    prompt line at `:554`/`:645` ("STAY SILENT") which the model just demonstrably
    ignored. **Do NOT answer this by rewording `:563` or hardening "STAY SILENT"** —
    standing user ruling: a system prompt is not the fix for a coding failure.
    **SEVERITY DOWNGRADED + FIX REFRAMED 2026-08-06 (user ruling).** `/pm` first
    filed this as a HIGH regression with a fix that made the gate's expiry
    "discriminate" (stamp `last_model_output_at`, release only after ~1.5s of
    quiet). The user's read is better and supersedes it: *"this feels like we just
    reminded the tutor to talk when this capability wasn't actually necessary — can
    we make this more parsimonious?"*
    **The real defect is the CHANNEL, not the gate.** Look at what the code says it
    is doing (`:1039-1042`): *"Forward state change to Gemini (silent — no response
    expected)… the system prompt also says to IGNORE [CONTEXT UPDATE] unless the
    student is clearly struggling."* We push every slider tick and option select
    over a transport that **structurally cannot be silent** (`:204`), and then spend
    prompt budget at `:554`/`:645` instructing the model to ignore what we just
    pushed. `ContextUpdateGate` is scaffolding built to make an unnecessary channel
    survivable. Tuning its ceiling is treating the symptom — the channel is the
    symptom. ([[llm-window-code-builds-structure]] applies: state belongs in code
    until something needs it spoken.)
    **RECOMMENDED FIX — remove the notification. Keep the state.**
    *(Re-scoped 2026-08-07 per the fence above. The previous wording — "delete the
    push, attach state lazily" — described the same three steps but led with
    "delete", which reads as deleting context-awareness itself. It is not: step 1
    keeps the state, step 2 keeps the model informed, and `[PRIMITIVE SWITCH]` is
    untouched throughout.)*
    1. **`update_context` stops SENDING to Gemini** (`:1035-1050`). It keeps doing
       everything else: keep a server-side `latest_primitive_state` dict and the
       existing `context-update` ledger row. **The state is retained; only the
       notification goes.** This is the parsimony item — remove it outright rather
       than gating, delaying, or re-wording it.
    2. Any message that genuinely gives the model the floor — a cue, hint request,
       `switch_primitive`, `student_action` — prepends the CURRENT state block, so
       the model is **still fully informed about the primitive the student is on,
       and fresher at the moment it matters** than today's push, which lands early
       and gets buried under intervening audio. Nothing the model can act on is
       lost; what is lost is the *interruption*.
    3. The struggle exception becomes an explicit server-side trigger: on repeated
       failed attempts, emit a real cue (`end_of_turn=True`). That is a *speaking*
       action, so it should be a *speaking* message — today it is a hope that the
       model notices state it was told to ignore.
    4. **Delete the now-dead prompt budget**: the `[CONTEXT UPDATE]` bullets at
       `:552`/`:641` exist only to instruct the model to ignore a channel that will
       no longer exist, and `:597-598` advertises it to the model. Remove those.
       **Leave the `[PRIMITIVE SWITCH]` half of `:597-598` and the transition
       handling at `:616` intact** — that channel stays.
    5. `ContextUpdateGate` (added silently in `d895bfb`) is deleted with it. It has
       no purpose once nothing is pushed.
    **What this buys:** the self-inflicted barge-in class largely disappears (the
    gate's own docstring measured **9 of 17 barge-ins caused by our own sends, four
    by these supposedly-silent updates** — one clipped a celebration at *"Perf—"*);
    CTX-1's symptom becomes unreachable (you cannot provoke a turn you never send);
    `ContextUpdateGate` shrinks to near-nothing or goes away; and token spend drops.
    **Honest risk to name:** the model stops passively "watching" exploration. But
    the prompt already forbids it from reacting, so this deletes a capability that
    was instructed off — the only genuine consumer is the struggle path, which
    becomes explicit and more reliable. Confirm no other consumer depends on
    mid-exploration state before deleting.
    **Verification.** `context-update-hold-expired` and `context-update-held` are
    already in the ledger, so the before/after barge-in rate is measurable.
    (a) A live session with a slider dragged across a >8s tutor turn must produce
    **zero self-caused barge-ins and no recited prompt text** — that is the
    reported defect, reproduced then killed.
    (b) **REGRESSION GATE for the fence, and it is not optional:** in the same
    session, navigate to a different primitive and confirm the tutor still
    **acknowledges the new activity** — `[PRIMITIVE SWITCH]` fires, the
    `switch-primitive` ledger row is written, and the scaffold + one-sentence
    greeting still land. Then ask it something about the primitive you are on and
    confirm it answers about the RIGHT one. If either regresses, the wrong channel
    was deleted.
    (c) Confirm the model can still be *asked* about current state (step 2's
    prepend) — the information must remain reachable on demand; only the unsolicited
    push is gone.
    **Priority: MEDIUM, not HIGH.** It only fires when a state change coincides with
    a turn longer than 8s. Worth doing because the fix DELETES code and a whole
    failure class, not because the symptom is frequent.
    **Reporting miss recorded honestly:** `ContextUpdateGate` was ADDED in
    `d895bfb` but appears in neither that commit message nor
    `qa/tutor-reports/lesson-tutor-item11-2026-08-06.md` — `/pm` swept it into the
    item-11 slice without describing it. A future session reading either would not
    know it exists.

12. **DI-120-1 — ✅ FIXED 2026-08-06 (`3986f77`), same-day user-pulled slice.**
    Fix = `MIN_BARGE_BAR 0.03` floor in `voiceTurnCalibration.deriveVoiceThresholds`
    (both the calibrated and pre-calibration fallback paths): the 0.018 leakage
    class can no longer open a turn while every measured real barge-in answer
    (≥0.045 across all sittings) clears the bar with 33%+ headroom. The AMBIENT
    bar is untouched — answering into silence stays sensitive for quiet children.
    Unit pins replay the 08-06 device numbers (`voiceTurnCalibration.test.ts`,
    2 new tests). **Design question SETTLED — AGAINST cap-skipping:** a
    no-transcript correction still counts toward the miss/correction cap,
    because transcript absence is not evidence of silence (DI-1's whole thesis:
    ASR is a lossy annotation; the judge heard real audio — "Shh." for /s/,
    "SeaWorld" for zero). A transcript-presence rule would also have
    contradicted the pinned misconception-evidence behavior (untranscribed
    misses are Tier-A evidence). The channel is closed where the turn OPENS,
    not second-guessed at the cap. Residual, honest: 07-19 measured one echo
    blip at 0.033 — above the new floor; if that class recurs, the escalation
    stays threshold-above-residual → AEC workaround, never a cap rule.
    *(Original entry below, kept as the trail.)*
    **noise-opened turns anchor empty attempts and burn items.
    OPENED 2026-08-06 from the #63 sitting. Fix BEFORE re-running #63.**
    Evidence: `qa/di-bench/run-2026-08-06-counting-120-probe.md`. `count-39` was
    lost to two corrections and a move-on **without the user ever answering it**.
    Two mic events at peak **0.018**, both `opened over tutor audio`, produced no
    learner event and no transcript; DI-1 anchors an attempt at local voice-turn
    close, so each blip became an empty attempt, barged in on the tutor's own
    modeling line, and drew a "My turn:" — two of those hit
    `resyncAfterMisses: 2` and abandoned the item.
    Real speech in the same run peaked **0.045 / 0.115 / 0.116**; the barge-in bar
    is `silenceThreshold 0.008 × bargeInMultiplier 1.35 = 0.0108`. **A bar of
    0.025–0.03 rejects both blips and accepts every real answer** — DI-2's dual
    threshold re-tuned, not new machinery. Note calibration recorded
    `echoRms 0.0002` while live leakage hit 0.018 (90×), so the calibration beat
    may be under-sampling; worth a look while in there.
    `phantomCommitGuard` does NOT cover this — it guards *transcript without local
    voice*; this is the inverse, *local voice without transcript*.
    **Design question to settle in the same slice:** should an attempt that yields
    NO transcript at all count toward the miss cap? Today it does, and that is
    what burned `count-39`. Executor: bench re-tune + `voiceTurnMachine` /
    `judgedLoopModel` unit coverage, then re-run #63.

11. **LESSON-MODE SESSION TUTOR: the script outranks the student (+ resume
    continuity) — ✅✅ CLOSED END-TO-END 2026-08-06.** Machine half shipped
    `d895bfb`; **human acceptance PASSED the same day — HUMAN-CHECKS #64 struck
    including criterion (b), with the dev backend confirmed restarted onto the
    fix first** (the slice report had flagged that the user's :8000 server ran
    PRE-fix code throughout the build, so a drive against that would have proven
    nothing). A curiosity question during a NON-DI section now gets a real spoken
    answer instead of the primitive's level1 scaffold line recited back — the
    exact failure observed with the user's son on 08-05. This also retires the
    last residual of the voice-transport unification `9d08687` apart from #65.
    **NOTE for whoever pulls next: #63 was NOT covered by that sitting** — it is a
    separate ~30-min DI *bench* run on the `Counting to 120` probe set (are
    multi-word numerals judgeable?), not a lesson drive, so **item 10 stays
    BLOCKED**.
    *(Original design record retained below as the trail.)*
    **What shipped (slice report `qa/tutor-reports/lesson-tutor-item11-2026-08-06.md`):**
    Fix A carve-out in BOTH system builders (QUESTIONS FROM THE STUDENT
    outranks scripted beats; "never give direct answers" rescoped to the
    active challenge; + opinion-question line after the first post-fix run
    showed praise-then-redirect surviving on "what do YOU think?" asks);
    Fix B `[SESSION RESUMED]` steering (mid-turn → finish the thought, idle →
    silent note; `resume-steering` ledger event); riders — "(not set)"
    unreachable (unset keys omitted, unresolved script lines dropped whole),
    `SwitchDebouncer` 2.5s trailing settle (`switch-announced` + `coalesced`),
    `SessionCounters` (audio frames ≠ turns); `LUMINA_FAULT_DROP_S` companion
    fault (shared `_fault_flag_allowed` guard, process-env only). Harness:
    `Beat.forbid` + `Beat.judge` (gemini-flash temp-0 answer-vs-deflect judge —
    the pre-fix run PROVED keyword anchors false-pass: the deflection itself
    contained "building") + `require_events`, journeys `lesson-curiosity`
    (child's turn-8 utterance verbatim) + `lesson-resume-continuity`.
    **Gates, all real-Gemini on isolated :8003/:8004:** pre-fix judge caught
    genuine deflections ≈50%/judged beat (non-vacuity); post-fix
    `lesson-curiosity --runs 3` **PASS zero findings** (scene question answered
    3/3 AND own-guess offered 3/3); resume probe **PASS non-vacuous** — ledger
    shows `fault-drop-fired` mid-reply → reconnect **350ms** →
    `resume-steering mid_turn=true` → continuation, no re-greet, coherence beat
    held the thread ("I was just saying that this excavator…"). Units **22/22**
    with revert-bite (reverting Fix A fails the prompt tests). py_compile
    clean; fault-armed server stopped in-slice.
    *(Original finding + design record below, kept as the trail. The #64 drive
    should keep an ear on example-phrase parroting — post-fix answers leaned on
    the prompt's "big home for lots of people" example in this scene.)*
    **Evidence:** two real sessions 2026-08-05 (morning
    `…140310…fc0e95518468.jsonl` + evening `…235650…57f1dc98f7d5.jsonl` in
    `backend/logs/lumina-sessions/`), reviewed in
    `qa/tutor-reports/lumina-session-review-2026-08-05.md`.
    **Half A — the pedagogy bug (headline).** Mid-`machine-profile`, the child
    asked a rich curiosity question ("What do you think they're making here? Are
    they going to build a bunch of apartments? Can we go over there?") and the
    tutor replied with a **verbatim recitation of the primitive's level1
    scaffold line** ("What do you already know about an excavator? Have you ever
    seen one?" — `catalog/engineering.ts:146`). Root cause is a three-layer
    prompt-priority inversion, all fixable at ONE altitude:
    (1) `build_lesson_system_instruction` (`lumina_tutor.py:394-397`) says
    "Never give direct answers" + "Use Socratic questioning — ask guiding
    questions instead of stating facts" UNSCOPED, so the model generalizes an
    anti-answer-leak rule (written for graded challenges) to all student
    questions — machine-profile is display-only, there was nothing to protect;
    (2) the scaffold's own commonStruggles rule already says answer-then-redirect
    (`engineering.ts:152`) but sits at the lowest prompt altitude and loses;
    (3) scaffoldingLevels are hint-ladder lines but the model deploys level1 as
    its default re-engagement move.
    **Fix A (prompt carve-out, one place, no catalog changes):** add a
    "QUESTIONS FROM THE STUDENT" block to `build_lesson_system_instruction` (and
    the standalone twin above it if it shares the class): *a student's curiosity
    question about the scene/topic/world ALWAYS gets a real, age-appropriate
    answer FIRST — one sentence — then bridge back to the activity. "Never give
    direct answers" applies ONLY to the active challenge's answer.* This is the
    session-voice instance of [[feedback_tutor-illuminate-not-overbear]]: the
    spontaneous question is the highest-value moment in the session, not noise
    between script beats.
    **Half B — transport recovery works; conversational continuity doesn't.**
    7 Gemini-side connection deaths across the two sessions (1007 / 1011 / 5×
    1008 + one clean GoAway); the resumption layer held 7/7, ≤500ms each,
    pending mic audio requeued. But the child-visible episode (the 1011): cut
    mid-sentence → ~17s dead air → **re-orientation greeting** instead of
    continuing — the parent read it as "an error where it disconnected."
    **Fix B:** on any resume, inject a short `[SESSION RESUMED]` steering text —
    continue exactly where you left off; do NOT greet or re-orient; if mid-answer,
    finish it. (Optional, small, frontend: a subtle "thinking…" affordance while
    reconnecting so dead air doesn't read as broken. Preventing the Google-side
    errors themselves is OUT of scope.)
    **Riders (same file, same slice):**
    - **"(not set)" spoken aloud** (morning 14:12:44 seq 584): missing
      contextKeys render as `(not set)` (`lumina_tutor.py:204`) into outbound
      text and the model read it out. Omit unset keys from scaffold/context
      snapshots — the lesson-path version of the `/tutor-test` Tier-2 zero-`(not
      set)` gate the DI packs already pass.
    - **Switch-greeting debounce:** 7 switches in ~40s (child tab-flipping) each
      injected "Greet the student briefly" → greetings for stale activities.
      Only the LAST switch inside a ~3s settle window gets the greet
      instruction; earlier ones send silent context.
    - **Telemetry: every audio CHUNK increments
      `conversation_turns`/`voice_interactions`** (`lumina_tutor.py:844-846`) —
      evening `session-end` logged `turns: 3059` for a ~30-turn conversation.
      Count model turn-starts / user transcript turns instead.
    **AUTONOMOUS GATE (all machine, runs before the user re-drives):**
    1. **New Tier-3 journey `lesson-curiosity`** in `run_tutor_live.py`
       (JOURNEYS registry; copy the `build_lesson_refer_back_journey` shape):
       lesson mode, `machine-profile` with the REAL catalog tutoring scaffold,
       beats replaying the child's turn-8 utterance **verbatim** (the ~48s
       run-on blob, repetitions included). Code-judged anchor check
       (`grounds_in_prior`-style alternatives): the reply must engage the
       question's content — any of build/making/apartment/house/home/"place to
       live"/construction — and a reply that only re-asks the scaffold line
       FAILS. `--runs 3`, pass = 3/3. **Non-vacuity is mandatory: run it BEFORE
       the fix and it must FAIL (reproduces the deflection), or the journey is
       vacuous.**
    2. **Resume-continuity probe:** dev-gated fault injection in the
       `LUMINA_FAULT_MUTE_S` pattern (process-env only, refuses persisted forms
       — the fault-flag hygiene ruling above): e.g. `LUMINA_FAULT_DROP_CONN_N=1`
       force-closes the Gemini session once mid-journey. Assert from the session
       ledger + received transcripts: resume < 2s (existing behavior, pinned);
       the first post-resume tutor turn contains NO greeting/re-orientation
       anchors ("welcome", "which part do you want", "hi there") and continues
       the in-flight thread; zero `(not set)` in any ai-transcript.
    3. **Deterministic units (pytest):** session-end `turns` == turn-start
       count; unset contextKeys never serialize `(not set)` into outbound text;
       3 rapid switches → exactly 1 greet instruction.
    4. **Human acceptance AFTER the machine gate:** the user's next real-child
       drive = existing **HUMAN-CHECKS #64** (its criterion (b) — "ask the tutor
       a question during a NON-DI section and get a spoken answer" — is the
       exact failure). No new row.
    **Watch-item, no action:** child-speech ASR language drift (Korean/French/
    Spanish transcripts mid-session) — known Gemini Live weakness;
    judge-over-transcript covers the DI half, conversational turns have no
    mitigation on our side today.

10. **di-math-facts `counting_next` to 120 — ✅ IMPLEMENTATION SLICE BUILT +
    COMMITTED 2026-08-06 (`3986f77`) on a USER RULING the same day ("i feel
    like we can move forward directly now with DI primitives to 120") — the
    gate's meaning flipped from build-gate to ACCEPTANCE: #63's re-run (now
    unblocked by item 12's fix) drives the same three criteria against the
    SHIPPED config.** What landed, per this item's own spec: `numberWordFor`
    (code-owned 0..120 builder, bench-canonical forms, hard-throws out of
    range) replacing every `NUMBER_WORDS[n]` lookup; aliases mirror the probe
    set and never cross-alias teen/decade; `resolveTextScope` clamp 20 → 120
    with per-type `benchedCeilingFor` (counting 120, every FACT identity still
    20 — "119 − 3" is impossible by construction); `buildCountingPool` windowed
    above twenty (decade transitions + near-ceiling window + teen anchors,
    never rote-from-zero); counting-scoped judging clauses (teen/decade
    strictness + compound completeness, ported from the bench criteria —
    every fact mode's contract byte-identical); catalog NUMBER WORDS directive
    gains the multi-word clause; pack-scoped `silenceCloseMs` 1000 on sessions
    carrying compound answers (standalone; #63(b) confirms the number). L4
    operand axis honestly out-of-scope above twenty (a transition-count rung
    is /add-structural-difficulty territory). Gates: focused 96/96, full
    Vitest 1778/1778, typecheck:lumina 0, real-pipeline probes 5/5
    (census+hard reach 119; within-10/within-5 controls unchanged;
    subtraction under a 120 ask stays ≤20). Report:
    `qa/tutor-reports/di-math-facts-item10-2026-08-06.md`.
    **Residuals:** (a) the #63 acceptance sitting (teen/decade break,
    compound completeness, cue drag) — the judge's discrimination on
    multi-word numerals is still UNPROVEN live; if (a) fails, the honest
    rollback is dropping `benchedCeilingFor('counting_next')` back to 20 (one
    constant); (b) LESSON-mode close timing still comes from
    `lessonVoiceTurnPolicy` (420ms for di-math-facts) — content-aware policy
    is queued, not built.
    *(Original entry below, kept as the trail — its "do NOT start before the
    sitting" clause was superseded by the user ruling above.)*
    **STILL BLOCKED (standing gate 1).
    FIRST SITTING RUN 2026-08-06, verdict: none of #63's three criteria
    exercised.** Report: `qa/di-bench/run-2026-08-06-counting-120-probe.md`.
    The run drove 4 of 10 items, answered every one CORRECTLY, and stopped at
    `count-13` — so (a) the deliberate teen/decade break, (b) the "hundred
    seven" partial + paused "one hundred … twenty", and (c) cue drag on long
    numerals are all still open, and **no multi-word numeral was ever spoken**.
    What it DID establish is a clean negative control: thirteen/thirty/fourteen
    answered correctly were each affirmed with alias agreement, and thirteen was
    not heard as thirty in either direction. That is the safe half. The fork is
    decided by the *deliberately wrong* answer, which a run of correct answers
    cannot test — the same all-correct-run trap that carried the 07-24 and 07-25
    correction branches forward to #50.
    **NEW: DI-120-1 must be fixed BEFORE the re-run** (see below), or the same
    noise blips will burn items again.
    *(Original entry:)* **BLOCKED ON ONE ~30-MIN BENCH SITTING
    (standing gate 1). The probe is wired and waiting; the sitting is HUMAN-CHECKS
    #63.** *(opened 2026-08-05 from reader-fit 14g; user chose Option B — extend
    the pack — over Option A's saturate-and-steer. Report:
    `qa/tutor-reports/di-math-facts-14g-2026-08-05.md`.)*
    **✅ The parse half is CLOSED** — `resolveTextScope` read "within 120" as
    "within 12" (two-digit capture); now `(\d{1,3})\b`, so a 120 ask **saturates
    at the benched twenty** instead of collapsing to twelve. Real-pipeline probes
    5/5 (max answer 17 pinned, 18 at `hard`); K within-5 and G1 within-10 controls
    unchanged. Full Vitest 1601/1601, typecheck:lumina 0, tsc 0 new.
    **❌ What is NOT done: the pack still stops at twenty.** Everything past it is
    a MULTI-WORD numeral ("one hundred seven") — an unbenched spoken response
    class. `NUMBER_WORDS` (`gemini-di-math-facts.ts`) is 0..20 and
    `buildChallenge` speaks `NUMBER_WORDS[answer]`, so raising the clamp without
    the builder emits `undefined` into the cue.
    **THE GATE — run the sitting first:** `di-bench` home card 🎯 → probe set
    **"Counting to 120"** (10 items, `kind: 'counting'`,
    `components/di-bench/diScript.ts`). It decides three things, in order:
    **(a) teen/decade — make-or-break.** Drive at least one item deliberately
    across a pair (say "thirty" for thirteen). If Live affirms it, **Option B is
    dead on evidence** — keep saturating at twenty and take Option A's catalog
    steering instead (the 14g word-reading precedent: measure, then flip the
    verdict). **(b) completeness + `silenceCloseMs`** — a partial compound
    ("hundred seven") must correct, and a mid-numeral pause must not split one
    answer into two voice turns; if it does, raise `silenceCloseMs` PACK-scoped
    (di-sentence-reading used 1100ms), never the family default.
    **(c) cue drag** at two long numerals per line.
    **AFTER a passing sitting, the implementation slice (do NOT start it before):**
    - code-owned numeral builder + ASR aliases to 120 replacing the
      `NUMBER_WORDS[n]` lookups at `gemini-di-math-facts.ts` (`answerWord`,
      `problem`, `aliasesFor`) — one function, hyphenation and "one hundred N"
      forms decided by what the sitting actually affirmed;
    - raise the `Math.min(20, …)` clamp in `resolveTextScope` **and** `ceilingOf`
      to the sitting's proven ceiling — it stays a HARD CAP that saturates, never
      a difficulty knob;
    - `buildCountingPool` **windowed near the objective's range** — a 1–120
      session must drill decade transitions near the intent focus (96..120-style
      windows, the 14k focus-window idea), NEVER 0→1 rote from the bottom;
    - tier composition stays narrowing-only (`poolCeilingFor`, `:864-866`);
    - re-check the DISTAR cue lines and the catalog `constraints` + NUMBER WORDS
      directive for the longer spoken forms;
    - gates: the existing `.scope`/`.structural`/`.remediation` suites must stay
      green (they pin saturation at twenty — expect to UPDATE the scope suite's
      ceiling assertions, deliberately and in the same slice), plus real-pipeline
      probes on the census objective and the two controls.
    **Do NOT:** widen via prompt (Fork A — pools are code-owned), turn the ceiling
    into a difficulty knob, or regex-parse anything new out of NL.
    **Interim exposure, stated honestly:** while the gate is open a G1 "within
    120" ask still routes here for a within-20 session, though number-sequencer
    (14h) and number-line (14k) reach 120 today. If the sitting slips, take
    Option A's catalog steering as an interim — one `constraints` sentence plus
    the `manifestOnly` before/after measurement 14g's word-reading half templated.

8. **FAMILY-WIDE + BACKEND: DIAGNOSIS-GRADE TELEMETRY — ~~TOP PULL~~ built +
   smoke-verified; residual = acceptance gate ONLY (rides a sitting or item 9
   Tier 2) — the 3-pack flush sweep DONE 2026-08-01. Original ruling
   2026-07-26 ("first, we need enough logging to actually diagnose, evaluate,
   and improve").** *(Executor: dedicated slice, before item 5's fix and before
   any further sittings.)* Third consecutive failure sitting whose FIRST finding
   was "the record can't support diagnosis": 07-25 decoherence (no record
   survived), 07-26 morning (took two sittings to make `belowMinVoice` visible),
   07-26 child run (no client JSON — panel not copied; server log untimestamped
   and truncated). Scope:
   - **(a) timestamps + session/turn ids on every backend log line** (logging
     format change, trivial);
   - **(b) a server-side structured per-session JSONL ledger** — the server twin
     of the client panel: cue sent/acked, activity signals, transcription events
     with ts, verdict-relevant turns, **GoAway/resume stamped with whether a cue
     or attempt was IN FLIGHT** (makes item 5's suspect (a) directly readable);
   - **(c) client run log AUTO-PERSISTS** — every run, saved without a human
     click (localStorage ring + auto-download or dev-endpoint POST at run end
     AND on disconnect/beforeunload). Copy-run-JSON stays as the convenience
     path, never the only path;
   - **(d) a correlation key stamped on BOTH sides** (session id + cue seq) so
     client `seq` joins server turns;
   **Acceptance gate: a deliberately induced stall must be fully diagnosable
   from persisted artifacts alone — no human memory, no lucky copy.**
   **BUILT 2026-07-26 (same session as the ruling) — needs one live sitting to
   close.** Shipped: (a) `main.py` basicConfig gains `force=True` — the
   timestamped format was ALREADY configured but was a no-op because
   `gemini.py`'s import-time `basicConfig` (no format) won the root-logger race;
   (b) `services/session_ledger.py` (write-only, never-throws) + full wiring in
   `lumina_tutor.py` → `logs/lumina-sessions/<ts>-<id>.jsonl`: auth/init,
   text-to-Gemini classified by bracket tag, activity signals, both transcript
   streams, turn start/end, barge-ins, **GoAway stamped with `mid_turn` +
   pending queue depths** (item 5's suspect (a) becomes directly readable),
   resume/connect-failed/max-resumes, client disconnect, session errors (the
   clock-skew class now lands in the ledger), final metrics; (c)
   `POST /api/di-run-logs` (token auth) → `logs/di-runs/*.json`; (d) client:
   `diRunLog` mints `meta.runId`, mirrors every run into a localStorage ring
   (last 5, throttled 1s), and `flushDiRunLog(reason)` auto-uploads — piloted in
   **DiMathFacts only** (run-end + teardown, deduped) per pilot-then-sweep; (e)
   correlation: `clientRunId` registry → `client_run_id` in BOTH LuminaAIContext
   auth sends → stamped into the ledger `session-init`. Gates: py_compile clean,
   `typecheck:lumina` 0, full vitest 1014/1014.
   **SMOKE-VERIFIED LIVE 2026-07-26, two user runs.** Run 1 (3/4): timestamps ✓,
   ledger narrative ✓ (180 events), zero-click upload ✓ — but `client_run_id:
   None`: the runId was minted at arm time, ~200ms AFTER the auth message left.
   Fixed same slice (pack registers the id BEFORE `ctx.connect`; `startDiRunLog`
   claims it, second-run collision guarded) + a deduped 6s tail re-flush (run 1's
   `cuesStalled: 1` was flush truncation — `[DI_COMPLETE]` lands ~3s after
   submit). Run 2 (4/4): ledger `session-init client_run_id = 4b9baa743d20` ===
   both run files' runId; tail file shows cues 6/6, stalled 0. **Remaining:** the
   acceptance gate rides the item-1 recipe sitting (induced-stall diagnosability
   via the last-item silence segment); ~~then sweep flush wiring to the other
   three packs (pilot passed)~~ **FLUSH SWEEP DONE 2026-08-01** — the pilot's
   four pieces replicated byte-for-byte from DiMathFacts into DiLetterSounds /
   DiWordReading / DiSentenceReading: pre-connect `setClientRunId(mintRunId())`
   (the correlation-race fix — the WS auth message must already carry the id),
   `run-end` flush + deduped 6s `run-end-tail` re-flush (fits under
   `useDiPostRunDisconnect`'s 7s floor), and `teardown` flush on unmount. The
   stall-moment flush was already family-wide via shared `useDiStallRecovery`.
   Gates: `typecheck:lumina` 0, full vitest 1041/1041. Runtime status,
   honestly: the pattern passed 3 live runs in DiMathFacts and this is
   mechanical replication, but no non-math pack has flushed live yet — the next
   live run of each pack is the free confirmation (its artifact lands in
   `logs/di-runs/` joined to the session ledger, or this reopens).
   **Update 2026-07-31 (item 5 slice): the
   acceptance gate is now MACHINE-COVERABLE — `LUMINA_FAULT_MUTE_S` induces the
   stall on demand (dev-gated), and the artifacts to reconstruct it all exist:
   ledger `fault-mute-armed`/`go-away`/`gemini-resume` stamps + still-ledgered
   `ai-transcript` during the mute, client `cue-dead` events, `session-dead` /
   `stall-reconnect` / `stall` stage lines, and the NEW `flushDiRunLog('stall')`
   at the failure moment. Drive it via item 9 Tier 2's stall journey (or #56);
   if the episode can't be reconstructed from persisted files alone, this item
   reopens.**
1. **FAMILY-WIDE: SUSTAINED-MISS DECOHERENCE — CLOSED 2026-07-26** (root cause
   = turn gate, fixed, fix verified live, and the full recipe run re-driven
   COHERENT the same day — see the strike at the bottom of this item; residual
   = S1 console confirm + the 90s silence micro-run). *(opened 2026-07-25 from
   the user's first deliberately-wrong mic sitting; diagnosed 2026-07-26.)*
   **DIAGNOSED — none of the four hypotheses below; the channel was the voice
   turn GATE.** `minVoiceMs: 120` silently meant "three 85ms capture frames", so
   a two-frame one-word answer ("five") was rejected as a blip while its audio
   had already gone to Gemini → the judge affirmed → `unanchored-verdict` →
   dropped → desync. Exposure = the single-word response class (three of four
   packs). Full mechanism, why the bench never caught it (3 coin-flip turns at
   ~50ms margin), and fixes (framePeriodMs plumbed → `voicedMs`; retro-anchor
   inside 4s; belowMinVoice observability + cue ledger — all engine-level):
   `qa/di-bench/run-2026-07-26-math-facts-turn-gate.md`.
   **FIX VERIFIED LIVE 2026-07-26** (`run-2026-07-26-math-facts-turn-gate-verify.md`
   + JSON): coherent `fact_review` run, all four predicted numbers hit
   (unanchored 0 / retroAnchored 0 / voiced 165–254ms on one-word answers /
   move-on flagged), and **hypothesis (a) is retired — `[DI_MOVE_ON]` fired live
   for the first time in any pack and stayed coherent** through cap → cue held
   by audio → sent → recap. Contrastive correction (c) also held: two byte-identical
   filled contrasts, no drift, no marks spoken (#55 math half).
   **REMAINING — one capped item is not the sustained-miss stress:** re-drive the
   #50 recipe proper (wrong on MOST items, SAME rule, session mean < 60) to (i)
   stress resync-vs-re-elicitation (b) and rapid-retry unanchored (d) at
   MULTIPLE caps, and (ii) reach the S1 misconception live capture — the 07-26
   run's mean was 80, correctly below the write gate. Also still open from the
   turn-gate report: **watchdog** (no timeout on "item cued, nothing happened")
   and **`facts` in RUNTIME STATE** (the fabrication vector).
   **What happened:** the user drove `di-math-facts` answering with a consistent
   wrong rule (always the successor: `5 − 1` → "six"), per the #50 recipe. The
   run decohered. **No usable record survived**, which is itself the first
   finding.
   **✅ FIXED IN THE SAME SLICE — the packs were structurally blind to desync.**
   `diRunLog.ts` + `DiRunLogPanel.tsx` (new, shared by all four packs) give the
   primitive path bench parity. Before it, a pack handled 5 of the 8
   `LoopEmission` kinds and hit `default: return` on the three that MEAN
   decoherence — `attempt-superseded`, `phantom-transcript`, and
   `unanchored-verdict` (the canonical DI-1 signal) — and wired neither
   `onTutorText` nor `onVoiceTurnClose`, so **there was no record of what the
   tutor actually said** and none of the mic floors telemetry. The panel leads
   with a coherence row (superseded / phantom / unanchored / off-script /
   no-verdict) and has Copy-run-JSON mirroring the bench payload.
   Verified: `typecheck:lumina` 0; full vitest **997/997**; new
   `diRunLog.test.ts` 12/12 with **non-vacuity proven** (reverting the three
   captures fails 5). Logging is write-only — it cannot influence progression.
   **RULED OUT, do not re-chase:** the misconception slice that landed the same
   day. `awaitingJudgeTextRef` is pure record-keeping, cleared on `attempt-open`
   and on reset, and never gates progression; `off-script` is also handled
   correctly (returns, keeps listening).
   **LIVE HYPOTHESES, in order — all first-observation paths, which is why five
   all-correct sittings never surfaced this:**
   - **(a) `[DI_MOVE_ON]` at the correction cap.** A consistent wrong rule caps
     EVERY item, and move-on had never fired live in any pack. Now flagged
     `move-on` in the log.
   - **(b) resync fighting the tutor's own re-elicitation.** After 2 misses the
     engine emits `resync` and the pack re-cues, but the correction line already
     re-elicited in-band → two competing cues. Unit-covered, never observed live.
   - **(c) contrastive-correction fidelity (#55, UNBENCHED).** The tutor now
     fills a `⟨what they said⟩` slot; drift, editorialising, or speaking the
     `⟨ ⟩` marks would break sentinel classification → repeated off-script. The
     complete judging line is now captured via `verdict-text` + `onTutorText`,
     which is exactly where this shows.
   - **(d) unanchored verdicts under rapid retry** — previously invisible.
   **Cheap bisect available:** the `di-bench` math-facts probe (`kind: 'fact'`)
   has always been fully instrumented. Driving the same successor rule there
   separates an ENGINE fault (reproduces in the bench) from a PACK
   orchestration fault (bench clean, pack breaks) — the bench has no cue
   builders, reward beat, or advance scheduling.
   ~~**Next action: re-drive HUMAN-CHECKS #50 with the panel open and Copy run
   JSON**, save under `qa/di-bench/`, then triage by flag.~~ **Done 2026-07-26 —
   triage complete (see the status block above).** ~~Next action: the
   sustained-miss recipe run (mean < 60), same panel + Copy run JSON.~~
   **THE RECIPE RUN RAN 2026-07-26 EOD — COHERENT. Item 1's decoherence is
   CLOSED** (`qa/di-bench/run-2026-07-26-math-facts-sustained-miss.md`): all 5
   items capped, **5× `[DI_MOVE_ON]`**, 15 contrastive corrections all
   byte-template (#55 c/d-math at scale), 1 benign supersession absorbed, 0
   unanchored/phantom/no-verdict/stalled, no GoAway, no stall — under the exact
   conditions that decohered 07-25. Learner ran the ECHO rule 5/5 consistent
   (mean 0 → S1 gate reached; ASR wrote "SeaWorld"/"cero" for a spoken "zero",
   judge named it right — judge-over-transcript confirmed a 2nd time).
   ~~**Residuals, one micro-run + one console line:** (i) user to confirm the
   `[captureMisconception]` console result (stored/abstained);~~ **(i) CONFIRMED
   2026-07-26 — S1 CLOSED, the loop's FIRST LIVE CAPTURE:** `stored for
   di-math-facts: "The student identifies the answer to a subtraction fact as
   the second number in the expression."` — correct on all 5 items, bounded
   (subtraction-scoped, no overreach), generative (predicts unseen items), and
   distilled from Tier-A judge sentences over garbage ASR. A real active
   misconception now sits in Firestore under `misconceptionKey: "di-math-facts"`
   — **item 2's consumption design now has live data.** Remaining: (ii) the 90s
   SILENCE run (answer nothing on item 1) → no-verdict→resync live, #55(e)
   fallback, and item 8's induced-stall acceptance gate.
5. ~~**FAMILY-WIDE: mid-run STALL — no verdict ever arrives and the primitive
   dead-ends in silent "Listening…" (the first real-child run's biggest break).**~~
   **BUILT + UNIT-VERIFIED 2026-07-31; LEVEL-2 RECOVERY RUNTIME-CONFIRMED
   2026-08-01 (user fault drive, `LUMINA_FAULT_MUTE_S=25`):** dead cues at
   exactly 10s/20s → `session-dead` → warm reconnect in **327ms** →
   `session-resumed` → the in-flight item re-cued verbatim → answer affirmed →
   run advanced. Artifacts reconstruct the whole episode from files alone
   (run `7f0a1543ff7c`: client teardown flush + server ledgers). Two bugs the
   drives caught, both fixed same slice: the OPENER never armed the dead-cue
   watch (stale-`enabled` at arm time — the ladder slept for the from-birth-dead
   session; arm is now unconditional, gate at fire time) and `sessionDeads`
   double-counted (flag→kind). **Remaining runtime = the level-3 card
   (`LUMINA_FAULT_MUTE_EPISODES=2`) + an end-coherent full run — fold into
   item 9 Tier 2's stall journey.** Slice report:
   `qa/di-bench/slice-2026-07-31-item5-stall-fix.md`. What shipped, per the
   handoff's three parts:
   - **(i) Re-cue after ANY resume, client-owned:** `LuminaAIContext` exposes
     **`sessionResumeCount`** (bumped in the ONE `session_resumed` branch —
     covers transparent server resumes AND warm client reconnects, since the
     auth-supplied handle makes the backend's first connect a resume too);
     `useJudgedSpeechLoop` watches it and emits **`{ kind: 'session-resumed' }`**;
     all four packs handle it as a shared case with `resync` (beat-fight guard
     preserved in math/sentence). Bonus banked: the backend's COLD retry
     (history lost) is now safe for DI — a re-cued `[DI_ITEM]` carries the full
     contract.
   - **(ii) Escalation ladder:** engine-owned detection — after a cue is SENT,
     no tutor audio rise AND no output text within `CUE_DEAD_MS` (10s) = one
     dead cue (cue channel phase `'dead'`); 2 consecutive → **`{ kind:
     'session-dead' }`**, re-emitting on continued silence so failed recovery
     escalates. Liveness is cue→tutor-AUDIO, never cue→verdict — 40s think-time
     is unit-pinned benign. Pack-owned recovery — shared `useDiStallRecovery`:
     level 2 = `ctx.reconnect()` **warm** (NOT disconnect()+connect(), which
     would destroy the mic — open-mic doctrine); level 3 (second death on one
     item / 12s grace with no resume signal — covers the cold-retry corner,
     which sends no `session_resumed` / `sessionEnded` mid-run) = shared
     **`DiStallCard`** (picture-primary 🔄, tap = reconnect-and-re-cue) +
     **`flushDiRunLog('stall')` at the failure moment**. The ladder converges
     on (i). Mic untouched everywhere.
   - **(iii-a) Post-run GoAway flap, pack-side:** shared `useDiPostRunDisconnect`
     — standalone path only (`weConnectedRef`), disconnects after submit + the
     closing cue actually SENT + its recap audio risen-and-fallen, floor 7s
     (outlives the 6s tail re-flush), ceiling 20s. Lesson mode untouched.
     **(iii-b) — server-side terminal-GoAway-before-input — explicitly
     DEFERRED** per the handoff's "if unsure, ship (iii-a) alone"; revisit only
     if the flap survives (iii-a) in a ledger.
   - **Fault injection (serves item 8's gate too):** `LUMINA_FAULT_MUTE_S` (+
     `LUMINA_FAULT_MUTE_EPISODES`, default 1) in backend settings — the FIRST
     cue-classified text of a session arms an N-second mute of MODEL OUTPUT
     only (audio/transcription/text dropped client-ward; `ai-transcript` still
     ledgered, so the ledger shows what Gemini said while the client heard
     nothing — the diagnosable asymmetry). Refuses to arm unless
     `ENVIRONMENT` says dev (new setting, default production; local `.env` now
     carries `ENVIRONMENT=dev`). EPISODES=1 → recovery's reconnect gets a
     healthy session (run must END COHERENT); =2 → the reconnect stalls too →
     level-3 card.
   - **Verified (dev-first):** new `useJudgedSpeechLoop.session-liveness.test.tsx`
     (11 tests: resume signal incl. disabled-swallow + no-cue-resend; dead-cue
     ladder incl. think-time false-trigger guard, liveness clears, re-emission,
     ledger independence); fuzz hook-only-kinds invariant extended
     (`session-resumed`/`session-dead` never from the reducer — reducer
     untouched, stays fuzz-clean); full vitest **1025/1025**;
     `typecheck:lumina` **0**; backend py_compile clean. **NOT yet exercised at
     runtime** — the fault-injected drive is the confirmation gate and lands
     with item 9 Tier 2 (its stall journey MUST arm the flag).
   *(original finding, kept as the trail: opened 2026-07-26 from the child
   stress run, `qa/di-bench/run-2026-07-26-math-facts-stress-sitting.md`
   Finding 1 — CORRECTED report: the earlier "fabricated contrast" defect was
   withdrawn, the child really said "three"; ASR wrote "Please".)*
   **📋 HANDOFF (executed 2026-07-31): `qa/HANDOFF-di-stall-fix-2026-07-27.md`** — paste-able,
   line-exact, written after reading both sides (backend resume loop + client
   engine/pack). It SUPERSEDES the verification note above per the dev-first
   ruling: build + verify via unit tests + a dev-only fault-injection flag
   (`LUMINA_FAULT_MUTE_S`, which also machine-covers item 8's induced-stall
   acceptance gate); a sitting is confirmation, not the gate. Key findings from
   the read: `session_resumed` is swallowed inside `LuminaAIContext` (`:376-380`,
   flags only — the missing link for re-cue-on-resume); the liveness signal must
   be cue→tutor-AUDIO, never cue→verdict (35.9s benign think observed 07-27);
   the `DiMathFacts.tsx:542` resync branch is the worked re-cue template incl.
   the beat-fight guard; recovery converges on the resume signal (ladder level 2
   reconnects warm via the stashed handle, then part (i) re-cues). From ~turn 15 the child kept answering — repeated
   `activity_start`/`activity_end` pairs — with ZERO AI output and no verdict;
   "Waiting for Gemini response (turn 16)" never satisfied; no recovery, no visible
   failure state. **Mechanism candidates (log truncated + untimestamped, can't pin):
   (a) GoAway/resume mid-attempt drops the in-flight turn and nothing re-cues the
   active item on resume** (Session A shows GoAways cycling ~50s with instant
   re-GoAway); **(b) generation wedged under the barge-in storm.** The no-verdict
   timeout → resync exists and likely fired (same-item re-cue observed) but re-cueing
   a dead session is not recovery. **Fix shape: (i) re-cue the active `[DI_ITEM]`
   after any resume; (ii) client escalation ladder — N re-cues with no tutor audio →
   reconnect + re-cue → still dead = visible "let's reconnect" state, never silent
   Listening…; (iii) the GoAway watch-item's "run complete, stop resuming" exit.**
9. **STOCHASTIC ADVERSARIAL STUDENT — make the child run repeatable (opened
   2026-07-26 from the user's design question: the loop must be robust to a kid
   who finds wrong answers funny).** Three tiers, different failure classes:
   - **Tier 1 — reducer fuzz — SHIPPED 2026-07-26, green.**
     `voiceTurnMachine.fuzz.test.ts` + `judgedLoopModel.fuzz.test.ts`: seeded
     mulberry32 PRNG (a failure names its seed+step and replays exactly), 120
     seeds × 250-300 random events per suite, invariants asserted every step.
     Load-bearing oracles: the voice open/close ledger (alternation, post-close
     state === IDLE, `voicedMs = durationMs + frame`, quantised-config variant)
     and the **attempt ledger** — every attempt opened is accounted for
     (superseded / resolved by a non-retro verdict / discarded by arm-disarm /
     still open); an attempt lost with no verdict is the stall class. Also
     pinned: disarmed loop is inert, resync pairs with its miss-verdict in-step,
     reducer never emits `verdict-text`, no negative timing fields. Runs in
     `npm test` (1014/1014). Found no violations in current code — the reducers
     are clean; the stall lives ABOVE them (transport/session), which is item
     5's territory. Extend the event generator when new emission kinds land.
     **Extended 2026-07-31 (item 5 slice):** `session-resumed`/`session-dead`
     joined `verdict-text` in the hook-only-kinds invariant — the reducer stays
     untouched and fuzz-clean; the ladder lives in the hook's clocks.
   - **Tier 2 — headless adversarial live student (item 5 shipped 2026-07-31 —
     THIS IS NOW TOP PULL). Its stall journey MUST arm `LUMINA_FAULT_MUTE_S`
     (+ a second journey with `LUMINA_FAULT_MUTE_EPISODES=2` for the level-3
     card path) — that drive is item 5's runtime confirmation AND item 8's
     acceptance-gate evidence.** Build
     ON `backend/tests/tutor_live/run_tutor_live.py` (user call 2026-07-26 —
     take inspiration from /tutor-test): it already authenticates on the real WS
     like LuminaAIContext, replays beats, captures per-beat transcripts, judges
     with code oracles, and scores rate-based over `--runs N`; add a DI journey
     family + audio/activity-signal student turns (the WS protocol already
     accepts both), reusing its taxonomy/triage. NOT a new harness — the
     tutor-live Tier-3 pattern driving the REAL judged loop, `--runs N`, with
     behavior policies drawn stochastically per turn: wrong-same-rule,
     wrong-random, silence through a test prompt, barge-in mid-model,
     answer-over-tutor-audio, rapid double answers, walk-away. Pass criterion is
     the liveness invariant (no state older than X s without escalation), NOT
     item scores. TTS input will not reproduce child ACOUSTICS — fine; this tier
     targets orchestration, not ASR.
   - **Tier 3 — periodic real-child sittings:** the only source of the
     child-acoustics class (ASR collapse, judge-over-transcript) and of genuine
     adversarial creativity. Keep them; with item 8 landed, each one
     automatically leaves a diagnosable record.
2. ~~**FAMILY-WIDE: DI packs produce no REMEDIATION content from a stored
   misconception (S5).**~~ **DONE 2026-08-04 — STRUCK, see Done.** All four
   generators now consume narrow, task-bounded diagnoses through deterministic
   code-owned pool/menu ranking. Probe G passed **11/11** moves after the math
   subtraction pilot gate; null/cross-mode/tier/count/scope/no-leak contracts
   are pinned, full Vitest passes **1,569/1,569**, Probe R passes 9/9, and S4
   Firestore exposure passes. No diagnosis enters Gemini or returned data and no
   spoken copy changed. Report:
   `qa/misconception/di-family-2026-08-04.md`.
6. **Free-form DI attribution lands off-grade/off-family: K `fact_review` →
   `OPS002-04-c @ grade=2` (subject override ✓ MATHEMATICS).**
   **DEPRIORITIZED (user ruling 2026-08-05): imperfect free-form calibration is
   ACCEPTED for now.** Do NOT add hardcoded grade guardrails to the retrieval
   service (a "K can't achieve G2" clamp is exactly the heuristic the
   pure-IRT ruling forbids); if this is ever picked up, the fix is better
   retrieval SIGNAL, not grade rules. Not a pull while the focus is
   development (primitives / DI packs / spoken modalities). Standalone-only
   exposure; lesson mode is unaffected. *(opened 2026-07-26,
   stress-sitting report; #50(c) half-closed by the same evidence. Executor: probe
   `curriculum_retrieval_service` on the standalone free-form path — is the scope
   grade coming from student 1004's profile instead of the content, and is
   `fact_review`'s "across the whole grade range" evalModeDescription steering the
   embedding? Standalone-only exposure; lesson mode carries the objective's subskill.)*
   Birth-cert home is the OPS001 family (K OPS001-03 / G1 OPS001-01); the full data
   loop (calibration θ, mastery gate 0→2, XP) wrote against OPS002-04-c, so standalone
   DI sittings are calibrating the WRONG node.
7. ~~**Tutor WebSocket hard-fails on 1s clock skew.**~~ **FIXED 2026-07-27 (`/pm`
   session).** `clock_skew_seconds=10` passed at both scoped sites: the Lumina
   tutor WS auth (`lumina_tutor.py`, where the observed failure killed a live
   session) and the shared HTTP path (`auth.py` `verify_firebase_token`, which
   `require_auth` — incl. the DI run-log drop-box — rides). firebase-admin 6.9.0
   supports the param (≥6.4). py_compile clean. **Honest verification note:** the
   1s-skew condition cannot be reproduced on demand locally; this is the SDK's
   documented mitigation for exactly the logged error (`Token used too early,
   1785081560 < 1785081561`). Runtime evidence arrives free — the session ledger
   now records auth failures, so any recurrence would be visible in
   `logs/lumina-sessions/`. Other WS endpoints (gemini/education/practice/
   daily-briefing/core-utils) share the same class but were left untouched —
   out of the item's scope; sweep only if the ledger ever shows them failing.
   *(original finding: `Token used too early` → `InvalidIdTokenError` → session
   dead, client must reconnect; opened 2026-07-26, stress-sitting report.)*
3. ~~**FAMILY-WIDE: the wrong answer's CONTENT is discarded**~~ **DONE 2026-07-25 — STRUCK, see Done.**
   *(kept below for the reasoning trail.)* *(found 2026-07-25
   answering the user's "so you won't see an incorrect in the logs?" — executor:
   `/primitive` follow-up or a dedicated slice; all three packs, engine-adjacent
   but component-owned).* A miss IS recorded — `outcomes[]` carries
   `{correct, attempts, score}` and metrics carry `attemptsCount` /
   `firstTryCount` / `overallAccuracy`, so a wrong-then-right lands as
   `attempts: 2, score: 67` and a capped miss as `correct: false, score: 0`.
   **But WHAT the child said is thrown away.** The engine emits
   `attempt-transcript` with `text` (the heard answer); every DI component keeps
   only `emission.responseMs` and drops the text on the floor. So we can see
   THAT a child missed `5 - 1` twice, never that they said "four" both times —
   an off-by-one that is a textbook diagnosable misconception. This is exactly
   the input `project_misconception-loop` wants, and DI is the family best
   positioned to produce it (the tutor already judged the audio).
   **📋 HANDOFF: `qa/HANDOFF-di-misconception-evidence-2026-07-25.md`** — paste-able,
   line-exact, written after reading both sides. **It SUPERSEDES the fix shape
   stated below** (kept for the reasoning trail).
   *(superseded fix shape: "accumulate per-attempt `{text, judgment}` into the
   outcome and ship it in the evaluation payload's non-metric bag".)* The
   accumulation half is right; the destination is wrong — the non-metric bag
   (`studentWork`) is inert storage no consumer reads for diagnosis. The shipped
   channel is **`diagnosisEvidence`** (Misconception Loop S1,
   `evaluation/diagnosis/types.ts`), passed as `submitResult`'s 6th arg.
   **Two findings from the handoff read that change the job:**
   - **`catalog/di.ts` declares NO `misconceptionScope`,** so all four packs are
     invisible to the loop — `captureMisconception` gate 3 drops every DI
     submission before the distiller. Two gates must open: the declaration AND
     the packet. (Scope ruling + the `di-math-facts` cross-identity risk are
     worked in the handoff; recommendation is `'primitive'`.)
   - **The ENGINE discards the tutor's judging sentence too** — `judgedLoopModel.ts:252-255`
     computes `verdictText`, classifies it with `scanForSentinel`, and emits only
     the `judgment`. That sentence is what buys **Tier A** (`judgeFeedback`, the
     loop's highest-fidelity tier, written for exactly this family), and since
     contrastive correction it NAMES the error. One additive field.
   Template to copy, not design from scratch: `PhonicsBlender.tsx:540-566`
   (spoken, judge-driven, already Tier A). **Sequence this BEFORE the #54/#50/#55
   mic sitting** — that is the first deliberately-wrong DI run ever driven, and
   with this landed it yields recorded evidence instead of ears-only notes.
4. ~~**DI sentence reading — 4th pack.**~~ **BORN L0 2026-07-25 — STRUCK, see Done.**
   *(Kept below: the sitting's rulings, which are now the pack's design record and
   the input to its ladder. Standing gate 1 PASSED 2026-07-25, user mic sitting,
   "this worked so well!".)* 10/10 items, 10 affirmed / 3 corrected / **0
   off-script / 0 unanchored**. Report:
   `qa/di-bench/run-2026-07-25-sentence-reading-probe.md`.
   **What the sitting settled — carry ALL of it into `/primitive`:**
   - **(a) One-word errors ARE detectable: 2/2.** Deliberate OMISSIONS ("big"
     from a 6-word sentence, "red" from a 7-word) were both caught and
     corrected, both retries affirmed. Omission is the hardest class to hear —
     nothing wrong is said, something merely isn't. The pack is viable.
   - **(b) Whole-sentence correction is SETTLED — do not re-litigate.** The
     learner self-repaired the missing word on the FIRST retry both times.
     Word-targeted correction would buy nothing and costs the off-script risk of
     making the tutor fill a variable the script can't know.
   - **(c) Keep the restating affirm.** ~2-3s against a ~15-17s item cycle whose
     dominant term is learner think-time (8-11s). Tutor talk is not the
     bottleneck for connected text; the child reading is.
   - **SHIP-BLOCKING, cheap: `silenceCloseMs` must be raised for sentences.**
     Three "attempt superseded" events — a child reading connected text PAUSES
     mid-sentence, and the 500ms close (tuned for one-word answers) splits one
     read into two voice turns. It broke the alias cross-check (both alias
     disagreements in the run trace to this, NOT judge error) and nulled
     `responseMs` on second fragments. Pass ~1100ms via
     `useJudgedSpeechLoop({ voice: { config: { silenceCloseMs } } })`. **Do NOT
     change the family default** — 500ms is right for the three short-response
     packs.
   - **Scope: 3-8 words, no ceiling found.** The 8-word item read clean first
     try. Longer text is unbenched — don't let a generator exceed 8 until it is.
   - **Residual → HUMAN-CHECKS #53:** both deliberate errors landed on the 6-
     and 7-word items, so the SHORT end is unstressed, and item 1 ("The cat
     sat.") transcribed as "the car" yet affirmed — ASR artifact or false
     affirm, unresolved. A short sentence gives the judge less context to notice
     a swap, so it may be HARDER than the long ones.
   - Minor, family-wide: the opening turn added an unscripted greeting before
     the scripted "Listen:". `offScript: 0` didn't catch it (that counter
     classifies verdicts, not fidelity). Almost certainly present in all three
     shipped packs. Not a blocker.
   *(superseded — kept for the reasoning trail)* **PROBE WIRED 2026-07-25.** *(user call 2026-07-25:
   "can we turn read-aloud-studio into a DI-style primitive?" — yes, but as a
   FORK, see the ruling below.)*
   **Ruling — fork, do NOT convert `read-aloud-studio`.** It is a live catalog
   entry with 3 eval modes (`accuracy` β2.0 / `expression` β3.5 / `dialogue`
   β4.5), `supportsEvaluation: true`, and a row in the backend
   `problem_type_registry.py` — so the manifest can route to it today.
   Rewriting its modality in place would silently change what those three eval
   modes MEAN and invalidate their β calibration: the contract-first
   fork-on-conflict case. Instead, `di-sentence-reading` takes judged
   short-sentence accuracy at G1-2, and read-aloud-studio keeps the territory
   where self-assessment is defensible — longer passages, WPM tracking,
   expression/dialogue practice for older readers. Two primitives, one honest
   boundary; revisit read-aloud-studio's LOWER band only after the pack ships.
   **Probe now live in the bench** (`Sentence reading`, 10 items,
   `kind: 'sentence'`): length ladder 3→8 words, vocabulary carried from the
   word-reading probe so a failure is attributable to connected text rather
   than new words; one-word-error stress built in (hen/pen, hat/hut, had/has,
   and a repeated "we go" phrase where an omission is easy to produce). The
   sentence branch gets its OWN judging criteria — the generic "reasonably
   close for a kindergartener" is right for one short production and WRONG for
   connected text, where "close" rubber-stamps exactly the dropped/swapped word
   that reading fluency exists to catch. Verified: bench tests 22/22, tsc 0
   Lumina errors. **The sitting decides three things** (all named in the
   `SENTENCE_READING_PROBE_ITEMS` docblock): (a) can Live detect a ONE-WORD
   error inside a 5-8 word utterance — make-or-break; (b) does the safe
   whole-sentence correction hold, or does the pack need word-targeted
   correction and the off-script risk that carries; (c) does the restating
   affirm drag at sentence length.
   **Original framing, still the why:** `read-aloud-studio` already owns G1-6 fluency and its own
   catalog says **"Student self-assessment only, no AI speech grading" /
   "No AI grading of speech"** — it has a mic, records, tracks WPM, and judges
   nothing. A child cannot self-assess reading accuracy, so that primitive
   produces no real evidence for the IRT model. Converting connected-text
   fluency to a judged DI pack is the rung directly above di-word-reading
   (sound → word → sentence) and matches `feedback_production-modality-roadmap`.
   **Gated by standing gate 1:** connected text is a NEW response class — all
   three existing packs judge a SHORT response (one sound, one word, one number
   word), and judging a multi-word utterance brings partial credit,
   self-corrections, and pace. Needs its own ~30-min bench sitting before any
   wiring. Do NOT skip the bench because the mechanism looks familiar — the
   probe being wired is NOT the gate; the sitting is.

*(the ladder — the default pull once the numbered queue above is empty. Updated
`/pm` 2026-07-25 EOD; the prior note said "three packs at L0+" and was written
before di-sentence-reading existed.)*

**Family ladder state — four packs, all born, all L0 live-gated:**

| Pack | Born | L0 live gate | L1 modes | L2 scaffold | L3 tiers | Next rung |
|---|---|---|---|---|---|---|
| di-letter-sounds | 07-20 | ✅ 07-21 (#36) | ✅ 07-22 (3) | ✅ 07-23 | ✅ 08-01 | **✅ L4 08-03** → `/add-sound` (L5) |
| di-word-reading | 07-22 | ✅ 07-23 (#43) | ✅ 08-04 (4) | ✅ 08-03 | — | L1 backfill complete; family priority is item 2 remediation implementation |
| di-math-facts | 07-24 | ✅ 07-25 (#48) | ✅ 07-24 (4) | ✅ 07-25 | ✅ 08-01 | **✅ L4 08-04**; item 2 remediation piloted here ✅ 08-04. Next = **item 10's bench sitting** (#63) — the only thing between the pack and a real 1–120 `counting_next` |
| di-sentence-reading | 07-25 | ✅ 07-25 (#54) | ✅ 07-25 (4) | ✅ 07-25 | ✅ 07-25 | **✅ L4 08-03** → `/add-sound` (L5) |

~~**di-word-reading L2**~~ **DONE 2026-08-03** — the family is now ENTIRELY
catalog-resolved (no pack ships a script-local tutoring block). Added what L0
deferred: `{{challengeType}}` + 4 contextKeys (`challengeType`/`word`/`wordType`/
`words`), 5 observed `commonStruggles`, a generator flat `words` summary, the
component `updateContext` sync, and ONE new directive clause (the word list is
now visible in RUNTIME STATE, so the tutor is told never to preview a word that
is still coming). The handoff's 5th contextKey (`graphemes`/sound-out) was
dropped by design — absent on every sight word, derived rather than generated
(so it can never resolve at probe time), and already carried verbatim in the
`[DI_ITEM]` cue. Cue lines + `correctionLine` byte-untouched (#55 still gates the
contrastive port). Gates: typecheck:lumina 0, `npm test` 1286/1286, `/tutor-test`
Tier 1 **0 HIGH** (the family's 2 structural WARNs), **Tier 2 × 3 content shapes**
all keys resolved / zero `(not set)`; standing gates 2+3 re-verified mechanically
over the assembled prompt (37 sentences, 0 sentinel openers). Live glance (5
struggles → chattiness; the never-preview clause needs a run reaching item 2+)
rides the next DI sitting — not a new gate. Report
`qa/tutor-reports/di-word-reading-2026-08-03.md`.

~~**di-sentence-reading L4**~~ **DONE 2026-08-03 — first pack at L4, the
family's L4 template.** The tier now drives BOTH dials: DISTAR fade (L3) +
sentence-LENGTH band (L4) — easy [3,4] / medium [5,6] / hard [7,8] inside the
session ceiling, clamped in `resolveProblemShape` and enforced at selection by
`rankByBand` (one key, two places; the prompt line is advisory, the code
authoritative; the **benched 8-word ceiling stays a hard cap, never a knob** —
a K/narrowed ceiling saturates the ladder honestly). Pool identity outranks the
band (sight stays sight, review keeps nearest-band lesson anchors); 7 menu
additions (one 7-8w sentence per pure vowel + 2 sight-heavy, ALL from the
established vocabulary) give the hard band real pool support. Template lesson
for the L4 siblings: the variance rotation's family-novelty pull must be
trimmed to the band WINDOW first — caught by the new suite, it out-pulled the
band before ever running live. No spoken copy changed → **no new ear row**;
the 8-word COLD read (L4×L3 hard) folds into the pack's next sitting. Gates:
typecheck:lumina 0, tsc = 1021 baseline, 17 new tests (9 fail on revert),
full vitest 1303/1303, live `/eval-test` sweep **6/6** (hard 7-8w / easy 3-4w /
mixed+medium all-tiered / K saturation / scope-beats-band / no-tier control).
Report `qa/eval-reports/di-sentence-reading-structural-difficulty-2026-08-03.md`.

~~**di-letter-sounds L4**~~ **DONE 2026-08-03 — second pack at L4.** The tier
now drives DISTAR fade (L3) + whole-set composition (L4): easy = unique
continuants/no complete pair; medium = +≥1 short vowel/no pair; hard = the
confusable `m/n` and `f/v` pairs together when 3–6-item capacity permits.
`first_sound_in_word` keeps its continuant-only identity, so medium honestly
saturates at easy there; hard still advances to confusable continuant pairs.
`resolveProblemShape` is the single source for prompt + code enforcement; the
final count→honor→reconstruct pass runs AFTER objective selection and mixed-mode
rotation, so variance cannot pull an out-of-tier item across the composition
window. Item count, curated menu, and eval-mode slots never change; no spoken
copy changed. Gates: typecheck:lumina 0; tsc 803 = baseline; structural suite
17/17 incl. 2,048 varied-set stress (10 fail on revert); full vitest 1320/1320;
live `/eval-test` sweep 7/7. Existing HUMAN-CHECKS #57 now carries the hard
contrast-set glance; no new row. Report
`qa/eval-reports/di-letter-sounds-structural-difficulty-2026-08-03.md`.

Nearest rungs: ~~**di-math-facts L4**~~ **DONE 2026-08-04** ·
~~di-word-reading L1 backfill~~ **DONE 2026-08-04** · next lifecycle work is
L3 support tiers for word reading; the queue's top platform capability is item
2 remediation implementation from the new handoff.
~~di-math-facts L3~~ **DONE 2026-08-01**. ~~di-letter-sounds L3~~ **DONE
2026-08-01** (third template use; ear-check → #57; report
`qa/eval-reports/di-letter-sounds-support-tiers-2026-08-01.md`).

**Two family-wide debts sit ABOVE the ladder** and are why the numbered queue is
not empty: **item 2** (no remediation content from a stored misconception — the
consumption half of the loop, all four packs) and the **contrastive-correction
port** to di-letter-sounds + di-word-reading, which is gated on HUMAN-CHECKS #55
(the rewording is UNBENCHED until that sitting).
*(The prior first debt — the wrong answer's content being discarded — closed
2026-07-25; the packet now reaches the distiller and a real diagnosis comes back.
What is still missing is anything that USES it.)*

A **fifth pack** is a user phase call, not a queue default — the remaining
benched-class gap is **blends**. A "counting sequence" pack is no longer a
candidate at all: di-math-facts absorbed the next-number step as `counting_next`.
*(Update 2026-08-05: that absorption now carries a RANGE debt — `counting_next`
serves 0–20 and a published G1 objective asks for 1–120. It stays a pack
extension, not a fifth pack; see item 10.)*

**Benched response classes, one line each** — the family's real capability
surface, and the thing every new item checks itself against:
letter sounds ✅ (#36) · single words ✅ (#43) · single number words 0–20 ✅
(#46) · short sentences 3–8 words ✅ (#54) · **multi-word numerals ⏳ probe wired
2026-08-05, sitting #63** · letter NAMES ❌ BLOCKED (LetterSpotter homophone
ruling) · blends ❌ unbenched.

## Watch-items (from the engine-gate run)
- Resync + no-verdict timeout are unit-covered but not yet observed live —
  first primitive's live runs should try to trigger both. **Update 2026-07-26:
  the child stress run re-sent the same `[DI_ITEM]` (1+1) after ≥2 misses — the
  resync signature, LIKELY first live firing, but uninstrumented (no client run
  JSON); the item-1 recipe sitting confirms or denies.**
- ~~**(2026-07-26 stress run)** GoAway rapid-resume loop: post-run, 4×
  GoAway→resume→instant GoAway until client disconnect — no "run complete, stop
  resuming" exit in `lumina_tutor.py`. **Striking MID-run this is item 5's stall
  candidate (a)** — the fix rides that item.~~ **FOLDED INTO the item-5 strike
  2026-07-31:** the MID-run half is the shipped ladder; the POST-run flap's
  trigger is removed client-side by (iii-a) `useDiPostRunDisconnect` (standalone
  disconnects once the recap has played). **(iii-b) — server-side "resumed
  connection GoAways before ANY client input → terminal" — DEFERRED**; revisit
  only if a ledger still shows the flap after (iii-a). Watch the first
  fault-injected / #56 run's ledger tail for it.
- **(2026-07-26 stress run)** Session metrics counters count audio frames, not
  turns (`Turns: 28885` for a ~90s session) — fix before anyone charts them.
- **(2026-07-26 stress run — reading outcome data)** with a real child voice the
  ASR transcript is garbage ("Please" for a spoken "three", "sechs" for "six")
  while the in-band judge stays right — so `attempts` on a capped item are real
  answers even when transcripts read as noise, and NO channel that echoes ASR
  text (server log, panel `attempt-transcript`, misconception packet transcript
  field) is a trustworthy record of what a child said. The judge's own sentence
  (`verdict-text`/`judgeFeedback`, Tier A) is. Item 2's remediation design must
  lean on Tier A, never raw transcripts.
- Echo blip class: floors readout margin was ~6× in the hook-parity run; keep
  the floors readout available in primitive dev builds.
- **(2026-07-27 child-paced K run, `answer_fact`, runId `42279e964031`)**
  counting-up-aloud produces rapid supersession chains — 1+3 answered by counting
  "one → two → three → four" = 3 consecutive supersessions, and the engine absorbed
  all of them: intermediate count words were superseded BEFORE any verdict could
  bind, the final answer judged correctly (5 supersessions run-total, 0 unanchored).
  This is item 9 Tier-2's "rapid double answers" behavior class, first observed
  live, benign — keep it in the Tier-2 policy list as a REGRESSION check, not a new
  build item. Same run: third clean zero-click auto-persist for the item-8 pilot
  (tail flush captured `[DI_COMPLETE]`, cuesStalled 0) and three live firings of
  the plain correction FALLBACK, byte-stable → #55(e) half-closed.
  Report: `qa/di-bench/run-2026-07-27-math-facts-answer-fact.md`.

## Done
- **FAMILY-WIDE: the packs took the wrong PROP SHAPE and crashed on their first
  real lesson (2026-08-06).** All four DI components were declared props-are-data
  (`React.FC<DiXData> = (data) => …`), but every renderer mounts a registry
  primitive as `<Component data={…} index={…} />` with the evaluation props
  merged INTO `data`. The DI tester SPREADS the generated data across props, so
  the bench, the probes, and every eval/tutor-test sitting rendered perfectly for
  three weeks; the first time DI came up in a real lesson the pack got
  `{data, index}` and died on `data.challenges.map` (generation itself was fine —
  5 counting_next facts, tiers applied). Fixed at the signature, and the DI
  tester + the two DiMathFacts vitest files now mount through the lesson shape so
  the bench can never diverge from a lesson again.
  **Channel closed, not just the symptom:** `PrimitiveConfig.component` was
  `React.ComponentType<any>`, which is what let a non-conforming primitive
  register silently. It is now `ComponentType<{ data: any; index?: number;
  [key: string]: any }>` — that gate immediately caught **three more primitives
  with the identical live defect** (calendar-explorer, timeline-builder,
  equation-workspace), all fixed in the same slice. Components with extra props
  (onRowClick / onTermClick / totalCards / index) must keep them OPTIONAL to
  satisfy the contract; concept-card, generative-table and feature-exhibit were
  relaxed accordingly. Gates: `typecheck:lumina` 0 errors, full tsc 0 lumina
  errors, vitest 1670/1670. **Residual:** browser check that the DI pack now runs
  end-to-end in a real lesson (mic + Live judging) — the crash is gone and the
  render path is jsdom-exercised, but no lesson has been driven since.
- **FAMILY-WIDE: stored misconceptions now change the next DI item draw
  (2026-08-04, queue item 2 struck).** Typed resolvers and deterministic,
  bounded selection landed across math facts, letter sounds, word reading, and
  sentence reading. The pilot used Probe D's actual subtraction diagnosis, then
  the full 11-move family matrix passed real Probe G with 0 leak/drift/dead-field;
  Probe R 9/9 and S4 exposure also pass. The wrapper LLM never receives the
  diagnosis, and all bench-proven spoken copy remains byte-frozen. Report:
  `qa/misconception/di-family-2026-08-04.md`.
- **FAMILY-WIDE: the wrong answer now feeds the misconception loop (2026-07-25,
  queue item 1 struck).** All four packs. A DI miss used to produce
  `{correct: false, score: 0}` and nothing else; it now produces a **Tier-A
  `DiagnosisEvidence` packet** — what the child said, what the tutor said about
  it, and the earlier misses as `priorAttempts`. Executed per
  `qa/HANDOFF-di-misconception-evidence-2026-07-25.md`; the handoff's ruling held
  (the destination is `diagnosisEvidence`, submitResult's **6th** arg, NOT the
  inert non-metric bag).
  **THE HANDOFF'S STEP 1 WAS NOT SUFFICIENT, and the gap is the finding worth
  keeping.** It said to add `verdictText` to the verdict emission and populate it
  from the string the reducer already computes. Correct as far as it goes — but
  the reducer classifies from the sentinel **opener** and fires immediately (by
  design: progression must not wait on a sentence), while Gemini forwards
  `output_transcription` in **sub-word chunks** (which is why `couldBecomeOpener`
  exists at all). So `verdictText` is truncated at "My turn" — and for a
  contrastive correction the opener is precisely the part carrying **no
  diagnosis**; "not one — two plus one is three" arrives after it. Shipping that
  as `judgeFeedback` would have produced a Tier-A packet that names nothing,
  which is **worse than honest Tier B**. Fixed with a second, additive emission:
  `useJudgedSpeechLoop` keeps accumulating past the verdict and emits
  **`verdict-text`** when the line completes (audio falls, or the learner answers
  over it). Reducer untouched; one place, not four.
  **Two runtime details that only a test caught:** transcription chunks carry
  their own leading whitespace, so the accumulator concatenates WITHOUT a
  separator (joining with a space fabricates "My turn : not one"); and a capped
  correction on the FINAL item submits synchronously, mid-sentence, so the
  headline packet falls back to the fullest line captured for the **same item**
  (exact `challenge` match, never a heuristic on the text).
  **Scope ruling recorded: `misconceptionScope: 'primitive'` on all four packs**
  (module docblock in `catalog/di.ts` carries the full reasoning + the accepted
  risk). The `di-math-facts` cross-identity leak is real — 4 task identities, one
  key, and "counts up instead of back" is CORRECT on `counting_next` — and the
  mitigation is shipped, not deferred: each pack names its task identity inside
  `challengeSummary`. **Probe D confirmed it works at the sentence level:** both
  draws came back bounded ("treats *subtraction by one* as addition by one"),
  never the unbounded "the student counts up". Escalation if it ever fails stays
  a PRD amendment (identity += eval-mode family), NOT flipping DI to `'skill'`.
  Verified: `typecheck:lumina` **0**; vitest **985/985** (was 964; the engine
  suite and `diCorrectionContrast` 15/15 both stayed green); backend round-trip
  **9/9** with a new DI scope case; `/misconception-test di-math-facts` —
  **Probe D 10/10 draws** (3 GENERATIVE + 2 ABSTAINED, 0 LEAK, 0 OVERREACH, every
  packet at `tier=judge`), **Probe R CLOSED**, **S4 Firestore exposure pass**
  (`misconceptionKey: "di-math-facts"`). Non-vacuity proven twice: reverting the
  engine field drops the tier to `structured`, and reverting the same-item
  fallback leaves the headline as the bare "My turn" opener.
  **Gate is PARTIAL, deliberately: Probe G is NOT-WIRED → new queue item 1.**
  **S1 live capture stays browser-owned → HUMAN-CHECKS #54/#50/#55**, which is
  the first deliberately-wrong DI sitting and now yields RECORDED evidence.
  Report: `qa/misconception/di-math-facts-2026-07-25.md`.
- **Contrastive correction — di-sentence-reading + di-math-facts (2026-07-25, user
  ruling; MVP scope, audio only).** The first live correction run in ANY DI pack
  (#54 sitting) overturned the sentence pack's bench finding (b): a reader read
  "Mom got THE pot" for "Mom got a pot" **three times** against an identical
  whole-sentence re-model. A re-model asks the learner to diff it against their
  memory of what they just said — they never learn WHICH word was wrong. The
  bench's evidence for (b) was n=2 and both were OMISSIONS the learner
  self-repaired on the first retry; a SUBSTITUTION with no self-repair was never
  observed. **User ruling: name the error and contrast it, verbally only — no
  screen change.**
  **The sitting's stated blocker did not survive inspection.** It called
  word-targeting "a direct threat to the sentinel discipline"; sentinel
  classification matches **OPENERS only** (`matchesOpener`, `judgedLoopModel.ts`),
  so a mid-line slot cannot reach it. The residual risk is "speak exactly"
  fidelity alone — which is what #55 measures.
  **Shape (both packs, one pattern):** `correctionLine` survives **byte-for-byte**
  as the fallback for a miss with nothing to contrast (silence / unintelligible /
  no number), and a new `contrastCorrectionLine` is preferred whenever the miss is
  localisable — `My turn: not ⟨what they said⟩ — <correct form> Your turn. <ask>`.
  `⟨…⟩` is a slot the tutor fills from the audio it already judged (it heard the
  error; it is not inferring anything new). Opener unchanged, so zero engine
  change. Ends on the CORRECT form (recency) before re-eliciting, keeping standing
  gate 3. The judging contract now routes three ways (contrast / fallback /
  affirm), forbids drifting to a third wording on a repeat miss, and tells the
  tutor never to speak the ⟨ ⟩ marks. Math also carries the **echo misconception**
  the user named — answering "2 + 1" with "one", the last number heard — in the
  contract and as a 5th catalog `commonStruggle`.
  Verified: `typecheck:lumina` **0**; full vitest **964/964**; new
  `diCorrectionContrast.test.ts` **15/15** pinning the load-bearing invariant —
  both packs' contrast lines, **filled and unfilled**, still `scanForSentinel` →
  `corrected`, exactly one slot each, and the bench-proven fallbacks byte-identical.
  **UNBENCHED — the family rule is "do not re-word without a new sitting"
  → HUMAN-CHECKS #55, which rides the same mic run as #54/#50(a).** The same
  whole-sentence re-model is still in di-letter-sounds and di-word-reading; port
  it there only after #55 confirms the fidelity risk is acceptable.
- **di-sentence-reading L3 support tiers (2026-07-25, birth-cert follow-up #3
  struck) — the pack reached L0→L1→L2→L3 on its birth day.** The pack fits NONE
  of the skill's six archetypes (live-judged spoken production, where the Live
  tutor IS the interaction surface) and has **zero `showOptions`**, so the whole
  ladder is modality #2 instruction-as-scaffold — the AngleWorkshop case. The
  sub-steps were already there: **DISTAR's model→guide→test IS a scaffold
  ladder.** easy = model+guide+test (the L0 shape) / medium = model+test (choral
  "Together" withdrawn) / hard = **cold read** ("Your turn. Read it." — the child
  decodes print never having heard it). Lives in the SCRIPT (`leadInFor`) as the
  birth cert specified, never a UI flag.
  **`hard` closes the answer-leak caveat the birth audit could not resolve:** the
  model line speaks the sentence before the child reads, which is legitimate DI
  instruction but leaves an ECHO ROUTE open; at hard the sentence never enters
  the block the tutor may speak, so no echo route survives.
  NEVER withdrawn at any tier: the printed sentence (the manipulable object), the
  correction's re-model (standing gate 3 — remediation is not scaffolding), the
  restating affirm (bench question (c)), and the judging contract (or tiers stop
  being comparable evidence).
  **Tutor second-channel hole found + fixed** (the tier gotcha, in this pack's
  idiom): L2's `scaffoldingLevels` level 1 said "Read the sentence once more,
  slowly" — at hard that reads aloud the very sentence the tier withheld. Fixed
  three ways: level 1 reworded (levels 2-3 safe, they are post-attempt), a
  per-item `coldReadGuard` in the cue, and `supportTier` added as a contextKey +
  threaded through connect and `updateContext`.
  **Deliberate departure:** NO `tierSection` injected into the generator prompt.
  Under Fork A the model's only job is picking sentence ids, so a tier line could
  only nudge it toward different SENTENCES = tier→content leakage, i.e.
  structural difficulty by the back door. The tier is 100% code-composed.
  Verified: typecheck:lumina 0; full tsc 0 Lumina-surface; vitest **949/949**
  (89 files); new suite `diSentenceReadingScript.support-tiers.test.ts` 13/13
  with **non-vacuity proven** (5 fail when the tier logic is reverted, incl. the
  key "hard NEVER puts the sentence in the spoken block"). **A bad assertion of
  mine was caught and corrected in QA:** diffing generated content across
  easy/med/hard to prove "a tier never changes the numbers" CANNOT work — a
  same-tier control returned three different sets, so the call itself is
  nondeterministic; the rule is established structurally instead. That control
  also **retires the L0 report's convergent-selection note** — L1's selection
  path introduced real run-to-run variety. Report:
  `qa/eval-reports/di-sentence-reading-support-tiers-2026-07-25.md`.
  Ladder next = `/add-structural-difficulty` (L4, now unblocked; axis =
  sentence LENGTH, already carried as `wordCount`/`meanSentenceWords` — and the
  8-word benched ceiling is NOT a difficulty knob).
- **di-sentence-reading L2 tutoring scaffold (2026-07-25, birth-cert follow-up
  #2 struck) — the pack reached L0 → live → L1 → live → L2 in a single day.**
  The pack is the family's exception: it already shipped its catalog `tutoring:`
  block AT BIRTH (di-letter-sounds' L2 slice had built the family lesson-mode
  wiring, so putting it there cost nothing and made lesson mode work day one).
  L2 therefore added precisely what birth left out: `contextKeys`
  (challengeType/text/wordCount/sentences), the **`{{challengeType}}` placeholder
  those keys make safe** (an unfilled `{{key}}` renders SILENTLY, so it could not
  ship before its key), 5 `commonStruggles` describing behaviour actually
  observed in the bench sitting + two live runs, a generator `sentences` flat
  summary (RUNTIME STATE populated from the first auth-time prompt), and a
  component `updateContext` effect (silent channel — never perturbs the judged
  loop). Bench-proven `aiDirectives` + cue lines + judging contract untouched,
  byte for byte; sentinel discipline re-checked on all new copy.
  **Sibling difference recorded:** di-math-facts deliberately keeps its ANSWER
  out of RUNTIME STATE; that reasoning does NOT transfer here, because the
  printed sentence is stimulus and target both — the tutor must have it to model
  it and the child is already looking at it. No key is withheld.
  Verified: typecheck:lumina 0; vitest 936/936; `/tutor-test` **0 HIGH** — 2
  WARNs that are the DI family's SHAPE (`data-bag-unparsed`: DI connects via
  `ctx.connect`/`updateContext`, not a parseable `useLuminaAI` bag;
  `no-sendtext-moments`: DI cues ride `[DI_ITEM]`/`[DI_MOVE_ON]`/`[DI_COMPLETE]`
  so the tutor structurally cannot go silent) — the identical pair both siblings
  carry. Tier-2 probe on THREE modes: `probe.findings: []` every run, all four
  keys real and mode-correct, and the `sentences` summary tracks the pinned
  mode's pool (proof L1 and L2 did not drift). The 5 `(not set)` strings in the
  response are confined to `staticPromptPreview`, which by construction has no
  generated content — verified by walking every string field.
  **Tier 3 rides HUMAN-CHECKS #54** (no new gate): three of the five struggles
  only fire on a MISS, so #54's deliberately-wrong read exercises them. Watch
  the named risk — 5 struggles could loosen a scripted tutor into chattiness
  (di-math-facts cleared this with 4). Report:
  `qa/tutor-reports/di-sentence-reading-2026-07-25.md`.
  Ladder next = `/add-support-tiers` (L3).
- **di-sentence-reading L1 eval-modes (2026-07-25, birth-cert follow-up #1
  struck) — the pack went L0 → live-verified → L1 in ONE day.** Full 4-mode
  ladder: `decodable_sentence` (β2.5, every content word sound-it-out — blending
  transferred to connected text) / `read_sentence` (β3.0, L0 unchanged) /
  `sentence_review` (β3.5, cumulative wide mix) / `sight_phrase_sentence` (β4.0,
  irregular high-frequency density — whole-word recall). **Standing gate 1
  satisfied with NO new bench sitting** (every mode is the same response class),
  and — unlike di-math-facts, which needed one type-aware line — this ladder
  shipped with **ZERO new spoken copy**: the L0 script was already phrased around
  `it.text`, so all four skills read through the bench-proven sentences byte for
  byte. What a mode changes is the POOL. **These are identities, not tiers:**
  `decodable_sentence` and `read_sentence` have different curriculum homes at
  different grades, and `decodable_sentence` gives the pack the **K home** the
  birth fit probe abstained on. Verified: typecheck:lumina 0; full tsc 0
  Lumina-surface errors; vitest 936/936; backend β rows mirror the catalog;
  real-Gemini eval-test **10/10 clean** with per-mode **POOL** assertions (not
  just type stamps — all four modes render identically, so the route's own
  validator passes trivially): sight mode serves only sight-heavy, decodable
  never serves an un-blendable sentence, decodable+short-a stays vowel-pure,
  sight correctly IGNORES the vowel scope, **mixed yields all four types**
  (SP-21). `/topic-trace` closed the routing path the tester structurally cannot
  reach (it always pins): a sight-word objective → `sight_phrase_sentence`
  end-to-end, **newly live** (with one mode the resolver short-circuited).
  **Found + fixed in QA: `sentence_review` never broadened past the focus** — a
  short-a review returned 4/4 short-a, i.e. the base mode relabelled, because
  the model's picks (drawn from the focused prompt menu) crowded out the wide
  pool. This is di-math-facts' `fact_review` bug in MIRROR IMAGE — theirs drew
  zero focus items and lost the thread; this drew nothing else and lost the
  breadth. Review now stops at its ≤2 anchors, back-fills shuffled from the whole
  menu, and rotates by vowel even under a pinned scope. Deferred by design: a
  longer-text rung (leaves the benched scope) and pace/expression
  (read-aloud-studio's territory; L0 judging refuses to judge speed). Report:
  `qa/eval-reports/di-sentence-reading-evalmodes-2026-07-25.md` + trace
  `qa/topic-traces/reading-sentences-with-sight-words-2026-07-25.md`.
  **L1 VERIFIED LIVE same day (user mic run on `sight_phrase_sentence`, "these
  are so good!") — HUMAN-CHECKS #54(c) struck.** 4/4 affirmed, all four sentences
  from the sight-heavy pool: the mode means at runtime what the catalog says, and
  the bench-proven cue lines carried a vocabulary (see/go/you/my/and) that no
  prior sitting had spoken — the last plausible place for the ladder to have
  disturbed proven speech. Post-affirmation reward emoji confirmed rendering.
  Ladder next = `/add-tutoring-scaffold` (L2 — note the tutoring block is
  already in the catalog, so L2's real work is contextKeys + commonStruggles +
  the RUNTIME STATE sync).
- **di-sentence-reading L0 LIVE GATE CLOSED (2026-07-25, user mic run — "it
  worked fantastically!") — born and runtime-verified the SAME DAY.** 4/4
  affirmed (The rat ran. / I see a pig. / The red hen ran. / The dog is hot.),
  session completed and submitted, recap all-emerald. Closes three things at
  once: the judged loop end-to-end through THIS component (its `applyVerdict` →
  `recordResult` → `advance` path and cue builders had never run with a real
  mic), **the reward beat at SENTENCE length** (the named pacing risk — the
  affirm restates the whole sentence, ~2-3s, well past what the 900ms/3.5s beat
  was tuned against; not flagged as dragging or clipping), and the one-sentence
  stage invariant. **Residuals, both quantitative → HUMAN-CHECKS #54:** (a) the
  `silenceCloseMs: 1100` fix has no numeric proof yet — the run did not visibly
  break, but 0-supersessions / non-null `responseMs` / `aliasMatch` live in the
  `[DI eval]` console payload, not the UI; (b) the SHORT end (#53) and the
  correction branch stayed dark — **fourth consecutive all-correct DI sitting**,
  and `[DI_MOVE_ON]` has still never fired in any pack (note the difference from
  math-facts: the sentence correction WORDING is bench-proven, 3 corrections
  incl. 2 deliberate omissions; it is the COMPONENT's retry/cap path that is
  untested). Report: `qa/eval-reports/di-sentence-reading-live-2026-07-25.md`.
- **#2 di-sentence-reading — BORN L0 (2026-07-25). Fourth DI pack, and the
  family's first CONNECTED TEXT pack.** Separate content pack over the committed
  engine; sibling packs byte-untouched, NO `hooks/` change.
  `DiSentenceReading.tsx` + hand-authored `diSentenceReadingScript.ts` (every
  spoken line **byte-for-byte** the bench's proven `kind:'sentence'` branch) +
  `gemini-di-sentence-reading.ts` (Fork A: 37-sentence code-owned decodable menu,
  Gemini enum-selects ids + wrapper only; vocabulary carried from the
  word-reading menu so a miss is attributable to connected text, not new words) +
  full registration (catalog `read_sentence` β3.0 + `audioInput` + the L0
  `tutoring:` block, `registerContextGenerator`, metrics union, primitiveRegistry,
  ComponentId, backend `problem_type_registry`, tester **Sentence Reading**
  picker + a per-pack `defaultGrade` so the tester stops sending kindergarten for
  every pack).
  **The ship-blocking bench finding landed in the same slice:** `silenceCloseMs`
  **1100ms** pack-level (a mid-sentence pause is part of one response); the
  family default stays 500ms for the three short-response packs.
  **All three sitting rulings honoured:** whole-sentence correction (no
  word-targeting), restating affirm kept, 3-8 word scope code-capped with a final
  filter after every other rule.
  Verified: `typecheck:lumina` **0**; full tsc **0 Lumina-surface errors** (805
  pre-existing, all in the legacy graveyard); vitest **936/936**; real-Gemini
  eval-test **PASS ×11** with every check programmatic (wordCount recomputed from
  text, benched ceiling, sentinel safety, wrapper leak, teaching order, vowel
  purity) — `qa/eval-reports/di-sentence-reading-2026-07-25.md`; curriculum-fit
  **MATCH ×2** (G1 `LA003-01` Oral Reading Accuracy 0.824 — whose top subskill
  *"self-correct reading miscues by re-reading"* is a near-verbatim statement of
  the judging contract; G2 `LA001-05` Reading Fluency 0.807, whose sibling
  subskills are read-aloud-studio's self-assessment territory — independent
  confirmation of the fork ruling) —
  `qa/curriculum-fit/di-sentence-reading-2026-07-25.md`. EVAL_TRACKER row added
  (362/379).
  **Found + fixed during QA:** phonics scope was vowel OVERLAP, not purity — a
  "short a" objective was being served "Sam has a red cup." (a/e/u). The pool now
  prefers sentences whose vowels are a SUBSET of the scope and widens only if
  pure cannot fill the session; all five vowels now serve pure sets.
  **One departure worth knowing:** the tutoring block ships in the CATALOG at
  birth (not the script, as the two older reading packs did) because
  di-letter-sounds' L2 slice already built the family lesson-mode wiring that
  resolves both connect paths from there — so lesson mode works on day one. L2
  still owns `contextKeys` / `commonStruggles` / the RUNTIME STATE sync.
  Birth cert + 6-layer queue: `qa/eval-reports/di-sentence-reading-birth.md`.
  **L0 gate NOT closed — the live loop has never been driven → HUMAN-CHECKS #54**,
  which carries five named stresses, headed by the `silenceCloseMs` fix's own
  proof (0 attempt-supersessions + non-null `responseMs` + `aliasMatch` true) and
  the unresolved SHORT-end residual #53.
- **di-math-facts L0 LIVE GATE CLOSED (2026-07-25, user mic run — "worked
  great!").** `subtraction_fact` / "subtraction within 5": **5/5 affirmed** +
  recap. One sitting closed three layers at once: the L0 judged loop end-to-end
  (no desync, stall, or phantom verdict), the reworked reward beat (pacing not
  flagged as dragging or clipping — the audio-edge design holds live), and the
  **first live run of the L2 catalog scaffold** — the tutor held the scripted
  lines across 5 items, so the 4 new `commonStruggles` did not loosen it into
  chattiness, which was the named risk of adding them. Also confirmed
  `subtraction_fact` cue wording + code-built `solvedDisplay` live (#49b).
  **The pack is now runtime-verified at L0+L1+L2.** HUMAN-CHECKS #48 struck.
  **Residual — third consecutive ALL-CORRECT sitting:** the correction branch,
  the homophone/over-affirmation stress, and the MATHEMATICS submit attribution
  all still need a deliberately WRONG answer → new HUMAN-CHECKS **#50**.
  Report: `qa/eval-reports/di-math-facts-live-2026-07-25.md`.
- **di-math-facts reward beat — one fact on screen at a time (2026-07-25, user
  browser check; CONFIRMED live same day).** The stage was showing the NEXT problem while the LAST
  answer's equation sat in a chip below it — two facts at once, overload at K.
  Fixed in two halves: (1) the completed equation now REPLACES the printed
  problem in the big slot instead of stacking under it; (2) `advance()` is
  deferred to a reward beat instead of firing at verdict time. The beat is
  **edge-driven, not timed** — the engine already sends the next `[DI_ITEM]` cue
  400ms after the tutor's audio falls (`VERIFY_BEAT_MS`), so the visual rides
  that same falling edge and the swap lands exactly when the tutor stops talking
  about this fact; a 900ms floor stops a clipped affirmation flashing past, a
  3s cap releases the stage if the edge never comes, and `attempt-open` /
  `resync` flush the beat so a resolved fact can never be up while the child
  answers the next one. `commitAdvance` bumps `idxRef` with the state (emissions
  fire inside the loop's dispatch, a render before React catches up). Applies to
  the capped-correction path too — `moveOnCue` CONTAINS the next fact's model
  line, so its swap belongs at the same edge. Verified: new jsdom suite
  `DiMathFacts.reward-beat.test.tsx` **6/6** (non-vacuity probed: reverting the
  deferred advance fails 2, reverting the in-place render fails a 3rd), full
  vitest **921/921**, tsc 0 Lumina errors. **The FEEL still needs the mic
  sitting — HUMAN-CHECKS #48 updated** (its old text described the removed
  behavior).
- **di-math-facts L2 tutoring scaffold (2026-07-25, birth-cert follow-up #2
  struck).** `DI_MATH_FACTS_TUTORING` moved from `diMathFactsScript.ts` into
  `catalog/di.ts` `tutoring:` — both connect paths now resolve it from the
  catalog (the shared family lesson-mode wiring from di-letter-sounds' L2 was
  already in place, so this pack needed no transport work). Cue lines and
  `judgingContract` untouched: the bench-proven wording is byte-identical.
  Added at this layer: `contextKeys` (challengeType/display/problem/facts —
  **stimulus side only**, the answer reaches the tutor inside the `[DI_ITEM]`
  contract, never RUNTIME STATE), 4 `commonStruggles`, and one NUMBER WORDS
  clause for the #48 homophone stress (a word that SOUNDS like the target
  number IS it — "won"/one, "too"/two, "for"/four, "ate"/eight; widened for
  homophones of the TARGET only). Component drops the local `tutoring:` arg and
  gains an `updateContext` effect (silent channel — never perturbs the judged
  loop); generator attaches the flat `facts` summary so RUNTIME STATE is
  populated from the first auth-time prompt. Verified: tsc 0 Lumina errors;
  `/tutor-test` **0 HIGH** (2 WARNs = the DI family's shape — `useLuminaAI`-bag
  parsing and `sendText` moments don't apply to a judged-loop cue path; same
  two as di-letter-sounds); Tier-2 probe on TWO modes shows all 4 keys
  populated with real values, no `(not set)`, no answer in RUNTIME STATE.
  Report: `qa/tutor-reports/di-math-facts-2026-07-25.md`. **Tier-3 rides
  HUMAN-CHECKS #48/#49** — the new struggle/homophone copy is exercised by the
  same sitting that drives the correction branch. Ladder next = `/add-support-tiers` (L3).
- **di-math-facts L1 eval-modes (2026-07-24, birth-cert follow-up #1 struck).**
  User chose the FULL birth-cert ladder — 4 identities: `counting_next` (β1.5),
  `answer_fact` (β2.0, L0 unchanged), `fact_review` (β2.5), `subtraction_fact`
  (β3.0). Standing gate 1 satisfied WITHOUT a new bench sitting: every mode
  answers with a spoken NUMBER WORD, the class benched in #46. The bench-proven
  L0 cue wording is byte-for-byte intact — the L0 lines were already phrased
  around `it.problem`, so all four skills read through the same proven sentences
  ("three minus one is two", "the number after five is six"); the only
  type-aware line is the counting DIRECTION in the judging contract (subtraction
  counts back, not up). Fork A held: code owns pools/answers/aliases and stamps
  `challengeType`. New code-built `solvedDisplay` field so the post-affirmation
  reward is correct per skill ("5 → 6", not "5 → ? = 6"). Verified: real-Gemini
  eval-test **PASS ×8** (4 pinned single-type + mixed = all-four interleave
  (SP-21) + curated blend), **40/40 challenges recomputed correct**, and
  `/topic-trace` on a real K subtraction topic routed manifest →
  **`subtraction_fact`** end-to-end (intent routing was newly live — with one
  mode it could never fire); typecheck:lumina 0; vitest 915/915. Caught + closed
  in the run: `fact_review` on a doubles objective drew ZERO doubles (anchors
  only applied to explicitly named facts) — now anchors ≤2 items from the
  focused pool for any scope. **The 3 new modes' cue wording is UNVERIFIED live
  → HUMAN-CHECKS #49** (fold into #48, one sitting). Report:
  `qa/eval-reports/di-math-facts-evalmodes-2026-07-24.md`. Deferred by design:
  G3 `multiplication_fact` (needs its own curriculum-fit probe + grade gate) and
  missing-addend (L4). Ladder next = `/add-tutoring-scaffold` (L2).
- **#3 di-math-facts — BORN L0 (2026-07-24).** Third DI pack, first MATH pack —
  separate content pack over the committed engine, sibling files untouched, NO
  hooks/ change. `DiMathFacts.tsx` + hand-authored `diMathFactsScript.ts`
  (BENCH-PROVEN cue wording from the #46 probe; permissive on th-fronting +
  counting-up, STRICT on a different number; sentinels = engine defaults,
  collision-checked) + `gemini-di-math-facts.ts` (Fork A: code-owned fact pool,
  scope code-enforced named→make-10→doubles→within-N→grade default K=5/G1=10;
  Gemini wrapper-only with digit/number-word leak-guard on title/description)
  + registrations (catalog/di.ts `answer_fact` β2.0 + audioInput, diGenerators
  registerContextGenerator, metrics union + `meanResponseMs` silent fluency
  signal, primitiveRegistry, ComponentId, backend problem_type_registry,
  tester Math Facts picker). **Family REVISIT closed: `subject_for_primitive`
  per-primitive override (di-math-facts → MATHEMATICS)** wired through
  retrieval matcher + mapping service + submission_service (both the
  use_retrieval gate AND resolve_by_retrieval — the second one mattered).
  Answer-leak rule: sum gated behind affirmation everywhere (stage equation
  reward, recap, generator title guard). Verified: typecheck:lumina 0; vitest
  915/915; backend pytest identical to HEAD baseline (10 pre-existing
  failures, 0 new); real-Gemini eval-test PASS 6/6 scope matrix,
  programmatically recomputed (`qa/eval-reports/di-math-facts-2026-07-24.md`);
  curriculum-fit **MATCH ×2** (K OPS001-03 fluency-within-5 0.785; G1
  OPS001-01 addition-within-10 0.830; `qa/curriculum-fit/di-math-facts-2026-07-24.md`).
  Birth cert + follow-up queue: `qa/eval-reports/di-math-facts-birth.md`.
  **Live loop NOT yet driven — HUMAN-CHECKS #48 is the real L0 gate**
  (correction branch never heard live + #46's homophone stress + MATHEMATICS
  attribution as the subject-override runtime check).
- **di-letter-sounds L2 tutoring scaffold + FAMILY lesson-mode wiring (2026-07-23,
  birth-cert follow-up #2 struck).** DI tutoring block moved from
  `diLetterSoundsScript.ts` into `catalog/di.ts` `tutoring:` (single source of
  truth; +contextKeys challengeType/letter/keyword/letters, +3 commonStruggles
  from birth QA; sentinel-collision re-checked on the new copy). The two carried
  L0 gaps CLOSED for the whole family: (a) **lesson-mode connect** — new
  `ComponentDefinition.audioInput` (types.ts); both DI packs declare
  `{ manual_activity: true }`; `connectLesson` scans the manifest and opens the
  shared Gemini session with it (audio config is connect-time-fixed);
  `switch_primitive` carries `tutoring` + `audio_input`; standalone `connect`
  falls back to the catalog for both — DiLetterSounds dropped its explicit
  passes. Subskill carry comes free in lesson mode (ManifestOrderRenderer
  injection → usePrimitiveEvaluation), ending the 07-21 Gemini re-map watch-item.
  (b) **`subject_for_domain('di') → LANGUAGE_ARTS`** in the retrieval matcher
  (REVISIT at di-math-facts birth — family will span subjects). Generator grew a
  flat `letters` summary field so the auth-time prompt resolves; component syncs
  per-item RUNTIME STATE via silent `updateContext`. Verified: typecheck:lumina 0;
  tutor-test Tier 1 PASS (0 HIGH; 2 WARNs structural to the engine pattern) +
  Tier 2 probe PASS (0 `(not set)`): `qa/tutor-reports/di-letter-sounds-2026-07-23.md`.
  **Live lesson-mode loop NOT driven → HUMAN-CHECKS #45** (incl. the named
  trade-off: a DI-bearing lesson runs manual VAD session-wide, so non-DI chat
  turns in a MIXED lesson won't open). di-word-reading's own catalog `tutoring:`
  move stays its L2 item; the shared wiring is already in place for it.
- **#2 di-word-reading — BORN L0 (2026-07-22).** Second DI pack over the
  committed engine — separate content pack, letter-sounds files untouched, NO
  hooks/ change. `DiWordReading.tsx` + hand-authored `diWordReadingScript.ts`
  (DISTAR two-branch cues: CVC sound-out "sss-aaa-mmm… sam" / sight whole-word;
  STRICT near-neighbour judging contract) + `gemini-di-word-reading.ts` (Fork A:
  30-CVC-by-vowel + 8-sight menu in code, Gemini enum-selects words,
  graphemes/emoji/aliases attached in code, vowel + sight scope CODE-enforced) +
  registrations (catalog/di.ts single `read_word` mode β2.5, diGenerators,
  metrics union, primitiveRegistry, ComponentId, backend problem_type_registry)
  + direct-instruction-tester grew a **Letter Sounds ⇄ Word Reading primitive
  picker** (no cloned tester). Answer-leak rule inverted vs letter-sounds
  honored: printed word ONLY before the read; emoji = post-affirmation reward.
  Sentinel note: handoff §4's classic "My turn." model opener re-worded to
  "I'll sound it out…" (collision with the correction sentinel). **Standing
  gate 1 (bench sitting #41) WAIVED by user ruling 2026-07-22** — near-neighbour
  stress folded into the live-loop check. typecheck:lumina 0; eval-test PASS ×4
  (named words honored / generic → CVC spread + 1 sight / sight-scoped → sight
  set only / "short a" → hard vowel scope). Curriculum-fit: **MATCH @ G1
  LA001-01** (0.800; LA001-07 Sight Words in top-5); K diffuse-abstain =
  vote-splitting across sibling CVC families (top-1 0.819 IS the right
  concept), not a gap. Birth cert + follow-up queue:
  `qa/eval-reports/di-word-reading-birth.md`; eval report
  `qa/eval-reports/di-word-reading-2026-07-22.md`; fit report
  `qa/curriculum-fit/di-word-reading-2026-07-22.md`. **Live loop NOT yet
  driven — HUMAN-CHECKS #43 is the real L0 gate** (mirror of #36); shared
  lesson-mode connect + `subject_for_domain('di')` gaps carried to the family
  `/add-tutoring-scaffold` item, not re-solved.
- **#1 di-letter-sounds — BORN L0 (2026-07-20).** First DI primitive, first
  engine consumer. New family: `primitives/visual-primitives/direct-instruction/`
  (`DiLetterSounds.tsx` + hand-authored `diLetterSoundsScript.ts`), `catalog/di.ts`,
  `service/direct-instruction/gemini-di-letter-sounds.ts` (Fork A menu-scoped:
  curated continuant + short-vowel menu; Gemini picks target letters from the
  objective, code attaches spoken/keyword/emoji), `registry/generators/diGenerators.ts`.
  Standing gates met: sentinel-collision ✓ (engine defaults, no line opens with a
  sentinel), correction re-model/opener directive ✓ (in tutoring block + script).
  typecheck:lumina PASS; eval-test PASS ×3 (topic fidelity: named letters honored,
  generic → starter spread, vowels → keyword elicitation). Curriculum-fit: MATCH
  (K LANGUAGE_ARTS Letter-Sound Correspondence, top-1 0.788 — the starved GK band).
  Birth cert + follow-up queue: `qa/eval-reports/di-letter-sounds-birth.md`. **Live
  loop VERIFIED end-to-end 2026-07-21 (HUMAN-CHECKS #36 struck)** — user mic run PASS
  through the primitive; full data loop fired on submit (curriculum resolve → score
  9.2 → competency/calibration/mastery/+38 XP). **L0 fully runtime-verified; ladder
  UNBLOCKED (`/add-eval-modes` next).** Two known L0 gaps carried to
  `/add-tutoring-scaffold`: lesson-mode connect needs `manual_activity`+DI-tutoring
  through the shared session (the 07-21 run confirmed the standalone tester re-maps
  the subskill via Gemini — landed on CVC-decode LA001-01-a, not the letter-sound
  home; the lesson path must carry the objective's subskill instead); add
  `subject_for_domain('di')→LANGUAGE_ARTS` to the retrieval matcher.
- Engine stack steps 1–3 groundwork (bench POC → live-judged pivot → open-mic →
  extraction 1 `4af21b6` → engine `bc2d303`), runs 2026-07-19..21 all PASS.
  History lives in WORKSTREAMS (DI stream) + `qa/di-bench/` reports.
