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
   hand-rolled item list before any primitive wiring. ⚠️ **`letter_name` is NO
   LONGER BLOCKED — the block was OVERTURNED by a user ruling 2026-08-13**
   (letter-spotter drive `6ada8c0a1bcf`; class status is now
   `accepted-build-ahead` in `judgedScriptContract.ts`, acceptance drive owed on
   HUMAN-CHECKS #97). *Corrected by `/pm` 2026-08-13 — this line still read
   "Letter NAMES remain BLOCKED" three hours after the pack that shipped them,
   and it is the most-copied paragraph in the family, so a stale block here
   silently costs the next port a spoken mode it is allowed to have.* The
   homophony that motivated the block is real but is a **per-ITEM** constraint,
   not a class-wide one: the judge is handed ONE target, packs must also accept
   the letter's SOUND, and the cluster table in `judgedScriptContract.ts` names
   the items to drop.
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

### 16. 🔝 **TOP PRIORITY (user ruling 2026-08-09) — PORT THE DI MODALITY ONTO THE LITERACY PRIMITIVES. Pilot `phonics-blender` ✅ SHIPPED · port 2 `sound-swap` ✅ SHIPPED · port 3 `word-flip` ✅ SHIPPED · port 4 `cvc-speller` ✅ SHIPPED 2026-08-10 (the gesture anchor now has a production caller) · ✅ THE LOOP IS NOW A GENERALIZED CAPABILITY (2026-08-10, user-directed): `judgedScriptContract` + `useJudgedScriptRunner` extracted from the eight consumers — NO retrofit — and proven cross-subject same day on `counting-board` (math, #86) and `push-pull-arena` (science, #87); port 5 `picture-vocabulary` ✅ SHIPPED **AND USER-DRIVEN SAME DAY 2026-08-11 (#91 STRUCK — the SPOKEN judge refused deliberate errors, first user evidence of the lane's core debt; "an incredibly strong modality from a learning standpoint")** · port 6 `phoneme-explorer` ✅ SHIPPED 2026-08-11 **AND USER-DRIVEN 2026-08-12 (#92 STRUCK — "several sessions in a row… some incorrect, some correct… this passes human check"; the spoken judge is now user-confirmed on TWO runner surfaces) · ✅ `/add-di-loop` SHIPPED 2026-08-12 (user call, the moment its gate cleared): the thin skill wrapper at `.claude/skills/add-di-loop/SKILL.md` — carries the DECISIONS (answer-material fork, script questions, leak gates, close discipline) and points at the runner/contract for the mechanics; L5 ladder re-pointed in CLAUDE.md + PRIMITIVE_LIFECYCLE.md (DI = the strong form, `/add-voice-control` = interim)** · port 7 `letter-sound-link` ✅ SHIPPED 2026-08-11 (the parked portfolio call ANSWERED: 2 directions verbal, `hear-see` taps because `letter_name` is BLOCKED; new continuant content gate; mic row #93) · port 11 `letter-spotter` ✅ SHIPPED 2026-08-13 (**called by a live drive, not the sweep** — the click-era session spoke one item 2-4×, coalesced a hint and a reveal into one turn, ran 16s behind the screen and volunteered a shape riddle per item; **REVISED TWICE BY DRIVE THE SAME DAY — `name-it` is now SPOKEN and `letter_name` is UNBLOCKED (accepted-build-ahead); the tiles are deleted; the `[LSP_TAP]`-read-aloud defect fixed at the TRANSPORT via the bracket hold, which covers all six gesture-bearing packs; the port-8 repetition rule promoted from this file into `/add-di-loop`**; `find-it` re-shaped from select-all-then-Check to one target/one commit; the live probe caught `targetWord` arriving as 400 chars of model deliberation that EVERY semantic gate passed → shape gates both sides; mic row #97) · port 10 `decodable-reader` ✅ SHIPPED 2026-08-12 (**P3 COMPLETE** — its reads split with no new seam; FIRST pack to fork its answer material INSIDE one run: read the line → say a one-word answer → tap a proposition; per-word tap-to-hear deleted as an answer-leak channel; mic row #96) · port 14 `interactive-book` ✅ SHIPPED 2026-08-14 (**Phase 1 of the interim-rung retirement, 1 of 3 — the last `useSpokenWordCapture` in literacy is GONE**; `read-focus-word` spoken oral cloze / `find-feature` taps a POSITION; headless drives green: 15/15 refusals + 15/15 affirms, gesture holds silent 5/5, cap→moveOn verbatim; ⭐ the probe's finding was SUPPLY — 5/6 draws shipped the fallback book until the reject path learned to say why) · the MIC SITTING IS CLOSED (user ruling 2026-08-14 — a port ships on machine gates + live probe + `--di` drive) · next = Phase-1 port `story-talk` (expect a per-mode split: naming goes verbal, `feeling_check`/`why_because` inference keeps the 4-picture answer space), then `word-workout` last (`real_vs_nonsense` stays a TAP — "yes" collides with the affirm sentinel).**

> ### ✅ 2026-08-14 — PORT 14 `interactive-book` SHIPPED (Phase 1 of the interim-rung retirement: the last push-to-talk in literacy is gone)
>
> **THE FORK (the table picture; no new response classes):** `read-focus-word` → VOICE
> `short_spoken_word` (shared reading IS spoken — the tutor reads the sentence lead and stops:
> *"Listen: Warm air melts the ice into a wet — hmm. Your turn. Read the glowing word."*);
> `find-feature` → GESTURE `manipulation` (the answer is WHICH printed element is the
> title/author/heading/caption/page number — a POSITION; concepts-of-print is assessed at a
> real table by POINTING, and reading the part's words aloud would be a different, harder
> skill than the print concept being measured). **Deleted:** the push-to-talk capture +
> tap-to-choose voice hooks (the standing open-mic violation this port existed to discharge),
> the tap-the-glowing-word fallback (it completed an ORAL READING task without reading — the
> costume test), the read-advance delay timer, the voice-mode fork, the 3-attempt
> reveal-and-lock ladder, free page navigation mid-run (the screen now follows the lesson to
> each item's page — the click-era catalog had a struggle entry for the child wandering off
> the target page), the hint disclosure, the focus-word exploration side quest, and seven
> improvised `sendText` sites. **The watch-item survived:** the manifest still supplies no
> book text, no answers, no challenges — the generator derives every scored contract from the
> visible book, and the script's build gates re-check each item at the seam (gates imported
> generator-side from `interactiveBookScript.ts`, one address).
>
> **Files:** `interactiveBookScript.ts` (new — cues, gates, packBase, harness answers) ·
> `InteractiveBook.tsx` (whole-file rewrite onto `useJudgedScriptRunner`) ·
> `gemini-interactive-book.ts` (script-imported gates; supply fixes below) · catalog entry
> (`[IB_*]` frame, `JUDGED_AUDIO_INPUT`, contextKeys `['challengeType','stimulus']`, βs held —
> find-feature's task identity is unchanged and read-focus-word was already priced as spoken
> production, its deleted tap escape only ever earned partial credit) ·
> `__tests__/InteractiveBook.di-script.test.ts` (34 pins, session-shaped repeat-ask packs) ·
> `diDrivePlan.ts` adapter (`DiHarnessAnswers` widened: gesture commits can carry tapped TEXT
> beside ten-frame's placed COUNTS).
>
> **⭐ THE PROBE'S FINDING WAS SUPPLY, NOT THE LOOP: 5 of 6 generation draws shipped the
> FALLBACK book, and nobody had ever seen why.** The reject path logged only "malformed"; it
> now logs the failing gate per rejection, and the reasons named flash-lite's focus-word
> placement contract (word repeated across the page's two paragraphs; field not copied
> verbatim from the paragraph). Fix: mechanical cross-field prompt rules + a THIRD generation
> attempt → next probe round **3/3 LIVE books** (*Pond Animals* / *Strong Bridges* / *Sun and
> Snow*), 0 fallbacks, 0 seam drops. The fallback book itself was re-authored so every focus
> word carries a ≥2-word lead (a fallback that ships under-count sessions defeats its purpose).
> Probe words drawn: frog bug duck fish snail bird · beam pier arch weight towers cable ·
> sunshine mud sun water snow wind.
>
> **Gates:** typecheck:lumina 0 · full tsc 0 Lumina errors · census greps 0/0 · vitest literacy
> 525/525 (34 new) · live probes 3/3 with `checkPackGates` `[]` over live content. **Headless
> drives** (`qa/tutor-reports/interactive-book-live-di-plain-2026-08-14-{read-focus-word,find-feature,cap-drill}.md`):
> `read-focus-word` ×3 runs — **15/15 refusals of deliberate wrongs, 15/15 exact scripted
> affirms**, harness verdict PASS · find-feature (all-gesture draw) — **all 5 hands-hold beats
> SILENT (0 audio bytes)**, every code-computed verdict line spoken verbatim, reveal-on-affirm
> reads the found text ("Yes, that is the title — it says Water Changes Shape!") · cap drill
> (spoken) — 3 deliberate wrongs → cap → **moveOn verbatim with the close-line naming the word**
> ("Good try! That glowing word is water."), run continues clean to the exact complete line.
>
> **Findings carried, not fixed here:**
> - **Item 21 RECURRED in FABRICATED form** (read-focus-word run 1: 3/5 asks after onset,
>   session-sticky; runs 2-3 clean). The model invented a `[CURRENT STATE]: … and the correct
>   answer being 'liquid'` narration before the ask — answer leaked. The transport fix HELD
>   (the real backend template never appeared and the pack's state push carries no answer);
>   this is the `[LSP_TAP]` fabrication class arriving on a VOICE turn. Both contracts now END
>   by naming the failure (fact-form); the structural fix remains item 21's cut-in ruling.
>   Recurrence bullet filed on item 21.
> - **`di-correction-verbatim-repeat` WARN accepted with rationale** (cap drill): corrections
>   2 and 3 are byte-identical BY DESIGN — decodable-reader's ruled position ("do not invent a
>   third wording"), and this pack's correction has no ⟨what they said⟩ contrast channel
>   because the printed word is static. The oracle is calibrated for packs that have one.
> - **No mic row filed** — standing rule (mic sitting closed 2026-08-14): nothing here is a
>   class the contract has not proven (`short_spoken_word` on its 5th surface, `manipulation`
>   on its 7th). For a voluntary human drive, the wrong answers worth saying: a context guess
>   that fits the sentence (say "water" where the glowing word is "ice"), the lead's last word
>   said back, a near-synonym ("mug" for "cup"); wrong taps: any other printed feature.
>
> ### ⚠️ 2026-08-13 — PORT 10 REVISED BY DRIVE: THE PROPOSITION ANSWER IS SPOKEN (`closed_set_choice`), AND THE SUMMARY STOPPED FLATTERING
>
> **THE RULING, third time of asking.** *"mode sequence/cause effect doesnt let me answer for
> the 2nd part verbally, i need to click on the button even though im speaking, this is the
> same issue with inference mode."* Same shape as rhyme-studio recognition and letter-spotter
> `name-it`: a BLOCKED response class (`open_set_word`, for free production of a proposition)
> was taken as licence to add buttons, and the buttons are what the child hits while already
> talking. **New class `closed_set_choice`** (accepted-build-ahead, acceptance drive =
> HUMAN-CHECKS #96 (c)): the child SAYS which of the N printed choices it is, and the judge is
> handed the exact choice texts plus which one is right — closed-set classification against a
> menu, not open recognition. `answer_tap` and `[DR_TAP]` are deleted; the cards stay on
> screen because they are what CLOSES the set (and their pictures are how a pre-reader holds
> four propositions at once), but nothing on this surface commits an answer by click.
>
> **Two things the class needs that no engine can give it.** (1) The contract ACCEPTS THE
> SHORT FORM — "the mat", "the second one", the picture — because a five-year-old does not
> recite a proposition back, and demanding it would fail children for recall while calling it
> comprehension. (2) A build gate on EAR-SEPARABILITY (`optionsEarSeparable`, run on both
> sides of the wire): every option must carry a word no other option has, so a SUBSET option
> ("A cat." beside "A cat and a dog.") is DROPPED rather than judged leniently — leniency
> there would score a wrong answer right half the time. Four fresh live probes
> (`sequence`/`inference`/`main_idea`/`literal`) dropped ZERO questions to the new gate, with
> choices drawn at 4-7 words.
>
> **THE SECOND DEFECT: the summary counted `solved` as `solved alone`.** Both drive runs ended
> *"N of N done all by yourself"*, every row ✅, after the user had missed a question and been
> corrected. The port had hand-rolled its completion block instead of using
> `PhaseSummaryPanel` — the one surface in this family that already renders score / attempts /
> first-try star — so the one distinction that matters was thrown away at render. Now on the
> family panel, with the celebration line counting `firstTryCount`. **Family lesson: a bespoke
> completion block is where an honest ledger goes to die; the runner had the number all
> along.**
>
> **Residual (queued, NOT done here):** `letter-sound-link`'s `hear-see` direction still taps
> because `letter_name` was blocked when it shipped — that block is GONE (port 11), so the
> mode is now a spoken conversion waiting on a slice. `picture-vocabulary` stays a tap on
> purpose: its answer is a PICTURE for a word the tutor just said, so saying it back is a
> costume, not a production.
>
> ### ⚠️ 2026-08-13 — PORT 11 REVISED TWICE BY DRIVE: `name-it` IS NOW SPOKEN, AND THE REPETITION CLASS BIT A SECOND TIME
>
> **DRIVE 1 (`6ada8c0a1bcf`) — USER RULING, and it overturns a response-class block.**
> *"this is not a great modality when i cant speak during a DI session? … in real life if i
> have a sentence with a missing letter, and i ask the student to use context clues and the
> word to say the missing letter, they should be able to translate the sentence and missing
> letter verbally. they dont need to click a button."* `letter_name` moved **blocked →
> accepted-build-ahead**; `name-it` is a SPOKEN answer and its four option tiles are deleted;
> β 1.5 → 2.0 (a 1-of-4 menu became unaided production). The tiles were never pedagogy — they
> were a consequence of the block, they floored a guess at 25%, and the drive's own option set
> (`n / s / i / a`) held two letters from the same /ɛ/ cluster the menu supposedly protected
> the judge from. The clusters survive as a per-ITEM gate, and the pack accepts the letter's
> SOUND as well as its name so a mishear must beat both channels.
>
> **The same log exposed a TRANSPORT defect the whole family shared.** Told "WAIT in complete
> silence — do not judge anything you hear", the tutor answered a stray voice turn by
> **fabricating `[LSP_TAP] Say exactly: … Then WAIT in complete silence…` and reading it
> aloud**, and invented a `[SESSION RESUMED]` tag (no resume occurred). A closed Gemini turn
> owes a reply and `proactive_audio` is unavailable on our model, so a tap item cannot get
> silence by asking for it — and the runner's `no-verdict` filter only muzzles OUR reaction.
> Fixed at the transport: `listenForVoice` holds the activity bracket for the whole gesture
> item (mic open, capture running, level meter live — **not** a mute, so the standing doctrine
> holds), with a ref-counted `ctx.holdVoiceTurns()` for the shared lesson bracket. Covers all
> six gesture-bearing packs. **`/add-di-loop` rewritten** around the spoken-first heart: the
> old Step 1 line telling authors a blocked class "gets closed by on-screen cards" is what
> produced this pack, and is now replaced by a sayability test plus the three answer shapes
> that may keep their hands (POSITION / FORM / BUILD).
>
> **DRIVE 2 (`de8a6a78d9db`) — the repetition class, hours after port 8 ruled it.** *"on
> match it, im hearing a lot of repeat information… maybe simplify?"* Six consecutive
> match-it items each spoke a **byte-identical** 26-word ask (~14s of speech against a ~13s
> answer), because that mode's ask may name nothing that varies. This is exactly port 8's
> rhyme-studio finding — *"if the model line does not change when the item changes, it is
> established once, not recited"* — and it recurred because that rule lived in this file
> instead of in the skill. It is now a Step 2 bullet in `/add-di-loop` with a gate
> (`cue(itemB) !== cue(itemA)`). `leadInFor` now fires only where the how-to-play does;
> match-it's repeat ask is 9 words (`easy` keeps the full frame as its last per-item lever);
> the opening no longer issues its one instruction twice.
>
> **The drive also CONFIRMED the bracket hold** — zero stray tutor turns and no fabricated
> tags across six tap items, where drive 1 had four in 103 seconds.
>
> **Changed:** `letterSpotterScript.ts` · `LetterSpotter.tsx` · `judgedScriptContract.ts`
> (+ its test) · `useJudgedSpeechLoop.ts` · `useJudgedScriptRunner.ts` · `LuminaAIContext.tsx`
> · `gemini-letter-spotter.ts` · `catalog/literacy.ts` · `LetterSpotter.di-script.test.ts` ·
> `.claude/skills/add-di-loop/SKILL.md`. **Gates:** typecheck:lumina **0** · hooks + literacy
> **43 files / 731** · di-script **43/43** · census greps 0/0.
>
> **RESIDUALS.** (1) **The repetition sweep is NOT done** — `leadInFor` speaks per item in
> six other packs (`diLetterSounds`, `diMathFacts`, `diSentenceReading`, `diShapes`,
> `letterSoundLink`, and `rhymeStudio` which is already fixed). Only the packs whose ask
> names nothing varying are actually affected; `letterSoundLink`'s `see-hear` ("What sound
> does this letter make?") is the strongest suspect. Executor `/add-di-loop`, one pack at a
> time, **after #97 re-drives**. (2) `name-it` has **no structural-difficulty axis** any
> more — it was distractor letterform similarity and it left with the menu. Needs a new axis
> (word length? sound position? cluster proximity?), executor `/add-structural-difficulty`.
> (3) No live generator probe has run against the new name-it prompt.
>
> ### ✅ 2026-08-13 — PORT 11 `letter-spotter` SHIPPED (called by a live drive, not by the sweep)
>
> **The port was requested off a session log the user opened, not off the queue.** Session
> `42edfc52e539` (`backend/logs/lumina-sessions/2026-08-13-033355-…jsonl`) showed the
> click-era primitive failing four ways at once, and all four were one mechanism — nobody
> owned the clock:
> 1. **The sentence was spoken 2–4× per item.** THREE cue sites each ordered a reading: the
>    advance cue, the wrong-answer cue (*"re-read the sentence slowly"*) and — worst — the
>    CORRECT cue (*"read the full sentence aloud as celebration"*), plus a catalog directive
>    saying it a fourth time. The log has *"I see an ant walk away"* three times in 13s.
> 2. **Two contradictory cues merged into one utterance.** The child answered faster than the
>    tutor spoke, so the floor gate coalesced a try-again hint and an answer reveal into one
>    turn (`seq 81`, `cues: 2`, `waited_ms: 12625`). The gate was behaving correctly; the
>    primitive was firing cues that contradict each other.
> 3. **The item existed only in audio, 8–16s behind the screen.** 109s of tutor speech in a
>    125s session (87% of wall clock) while the option buttons went live instantly — the log
>    shows the child answering while the tutor was still mid-sentence asking, with no replay.
> 4. **Every item came with a shape riddle.** Group 1's `newLetters` IS the whole group, so
>    the "NEW letter → hint at its shape" branch fired every time (*"a triangle with a line
>    across the middle"*), handing the answer to any child who knows letterforms.
>
> **ALL THREE MODES TAP — the first pack in the family with no spoken mode at all.** Standing
> gate 1 arithmetic: the answer is a GRAPHEME (`name-it`), a LOCATION (`find-it`) or a FORM
> (`match-it`), and `letter_name` is BLOCKED — *this primitive's own ruling is the block's
> evidence line*. Asking for the SOUND would unblock speech and duplicate `letter-sound-link`,
> which already owns grapheme→phoneme production. Each tap still passes the frame's test: a
> child who cannot map a first sound onto its letter cannot pick it from four.
>
> **THREE REVEAL POLICIES, because the answer differs per mode** — `name-it` says the WORD
> (stimulus) but never the letter; `find-it` says the LETTER (stimulus) but never its
> position; `match-it` names nothing until it corrects. No cue may describe a letter's SHAPE
> at any tier, and the tap contract tells the tutor so.
>
> **`find-it` CHANGED SHAPE.** "Select every instance, then press Check" → exactly ONE target
> per grid, one tap per commit. The Check button is what the modality deletes, and a batch
> commit gave no correction at the moment a b/d confusion actually happened. β stays 2.5:
> β measures the discrimination load (scan 16 cells, tier-controlled distractor similarity),
> which is untouched — rationale recorded in the eval-mode description.
>
> **Files:** `letterSpotterScript.ts` (new, hand-authored) · `LetterSpotter.tsx` (rewritten) ·
> `gemini-letter-spotter.ts` · `catalog/literacy.ts` · `__tests__/LetterSpotter.di-script.test.ts`
> (new, 36 tests).
> **Deleted:** the advance handler and every improvised tutor message; the 3-attempt
> reveal-and-lock ladder; Check + Next buttons; `[SENTENCE_SPOTTER]`/`[ANSWER_CORRECT]`/
> `[ANSWER_INCORRECT]`/`[SAY_LETTER_NAME]`/`[FIND_LETTER]`/`[NEW_LETTER_INTRO]`/
> `[ACTIVITY_START]`/`[ALL_COMPLETE]` and their catalog directives; the shape-hint branch;
> the ten-emoji marker pool; `strategyHint` (on-card prose at a band that cannot read — the
> lever moved into the spoken DISTAR lead-in).
> **Also restored:** the printed word RESIDUE. The click-era render replaced the whole target
> word with the marker ("I see a ⭐ walk away"), discarding the one decodable cue and leaving
> the sentence as decoration — the data model had always stored the marker over just the
> first character.
>
> **🔴 THE LIVE PROBE EARNED ITS PLACE — two real defects that every semantic gate passed.**
> - **`targetWord` came back as 400 characters of the model's own deliberation** on FOUR of
>   eight drawn items (`"sheep-invalid-word-fix-start-with-s-no-dash-sheep-is-fine-wait-…"`,
>   `"sit_is_not_farm_animal_well_farm_animal_words_preferred_when_possible_pig…"`). It is the
>   unbounded-string runaway the enums fixed for `options`, reappearing in the one field that
>   cannot be enum-locked (Gemini treats STRING `maxLength` as advisory). **Nothing downstream
>   could catch it:** the string still started with the target letter and still occurred
>   exactly once in a sentence built from it, so the drop-rate check read 8/8 askable — a
>   false green. → `isSayableWord` / `isSayableSentence` SHAPE gates, both sides of the wire.
>   **Generalizable: a field with no enum needs a shape gate, not only a meaning gate.**
> - **Duplicate challenge ids** (`ch1` twice in a find-it draw), refused by the pack validator.
>   The generator only filled MISSING ids; it now stamps them positionally.
> - Also fixed from the same evidence: a/an agreement ("I see a ant walk away", "I see a inky
>   paw print" — read aloud to a five-year-old, in a *literacy* primitive), and the fallback
>   sentence frame now rotates so two rejected sentences don't degrade to the same line.
>
> **Gates:** `typecheck:lumina` 0 · full `tsc --noEmit` no new vs baseline · §1 census greps
> 0/0/0 on the component (docblock prose reworded — comments count) · 36 pure tests · full
> vitest **2982 passed / 215 files** · live 3-mode pipeline probe **19/19 items askable**,
> probe file deleted. Probe words drawn: `sun` `sit` `ant` `pig` `nine` `ten` `two` `insects`
> `turkey` `sheep`; find-it `c m h d k e s a`; match-it `b g o u l f m`.
>
> **⚠️ SHIPPED, NOT VERIFIED — mic row #97.** The machine gates prove the pack; only a mic run
> proves the loop, and #97's headline is the SILENCE contract (this is the first whole-session
> tap-only pack, so a child talking while they search has nowhere legitimate to land).
>
> ### ➡️ 2026-08-12 — THE BUILDOUT PLAN (user call: *"active stream should focus on continued buildout of literacy DI based primitives"*)
>
> **Census re-measured this run at IMPORT level, and that correction comes first: the brief's
> §2 grep (`grep -ohE "useSpokenWordCapture|…" <primitive>.tsx`) reads WHOLE FILES INCLUDING
> DOCBLOCKS and produces false positives.** `letter-sound-link` and `word-flip` both "showed"
> retired push-to-talk hooks that exist only in comments *describing their own deletion* — a
> census that counts a primitive's obituary for its corpse. **Use `grep -lE "^import .*(…)"`**
> (note: the four runner-era ports use MULTI-LINE imports, so match on the hook line, not the
> `import` line, or they read as unported). Verified state, 31 literacy primitives:
>
> | | count | primitives |
> |---|---|---|
> | **DI judged loop** | **8** | `phonics-blender` `sound-swap` `word-flip` `cvc-speller` (pre-runner) · `picture-vocabulary` `phoneme-explorer` `letter-sound-link` `rhyme-studio` (runner) |
> | **interim voice rung** (`/add-voice-control` hooks) | **3** | `interactive-book` (`useVoiceChoice` + `useSpokenWordCapture`) · `story-talk` (`useVoiceChoice`) · `word-workout` (`useVoiceAnswer`) |
> | no voice at all | 20 | the remainder |
>
> ---
>
> #### PHASE 0 — the mic sitting is UPSTREAM of all of this, not parallel to it
>
> `main` was fast-forwarded tonight, so **8 judged surfaces are in PRODUCTION** and #93/#94/#89
> are unheard. This is not queue ceremony: **every Phase-1 port inherits the same engine and
> the same script conventions**, so #94's open product question — *the accept set was narrowed
> to exactly the words on screen, and a child saying a true-but-off-card answer gets corrected*
> — **is a ruling about how Phase-1 scripts get written**, not a rhyme-studio detail. Pilot-
> then-sweep says answer it before porting three more surfaces the same way. ~10 min.
>
> #### PHASE 1 — RETIRE THE INTERIM RUNG (3 ports, serial, `/add-di-loop`)
>
> **A completable milestone, not an open march: after these three, ZERO literacy primitives
> use `/add-voice-control`'s hooks and the last push-to-talk in literacy is gone** (owed
> independently since the rev-1 census — it violates the standing open-mic ruling). Both
> response classes involved are already benched, so **no bench sitting gates any of the three.**
>
> 1. ✅ **`interactive-book` — SHIPPED 2026-08-14 (port 14; dated block at the top of this
>    item).** As scoped: `read-focus-word` spoken, `find-feature` locate-and-tap, the doctrine
>    violation discharged, and the answer-leak constraint survived (gates now imported
>    generator-side from the script module).
> 2. **`story-talk`** — **already the DI shape minus the loop**: the tutor READS the story
>    aloud with character voices and the child answers a who/what/where question. Today the
>    answer is a tap on 1 of 4 pictures. **The fork question here is which modes go verbal:**
>    the answers are "single picturable words shown as pictures" and `picture-vocabulary` has
>    already proven spoken picture-naming, so the 4-grid may be a costume in the same way
>    `phoneme-explorer`'s was — but `feeling_check`/`why_because` are INFERENCE, where a
>    4-picture field is doing real work as a closed answer space. Expect a per-mode split, not
>    a blanket conversion. High K demand (Reading Comprehension + Speaking & Listening).
> 3. **`word-workout`** — CVC application, and it goes last because its split needs the most
>    thought. ⚠ **`real_vs_nonsense` must TAP by rhyme-studio's arithmetic** — its answer is a
>    yes/no verdict, where "yes" IS the affirm sentinel and "no" is the VC length
>    `short_spoken_word` still records as unbenched. Word chains are `short_spoken_word` and
>    go verbal.
>
> #### PHASE 2 — THE FORK TRIAGE ON THE 20 (one pass, NOT 20 ports)
>
> **This is the phase that prevents bad pedagogy, and it is cheap** (catalog read + census,
> ~1 slice). The `di-spoken-practice` lane already produced the rule — **does the manipulative
> CARRY the pedagogy? Yes → bespoke port · No → route to the content-generic pack.** But that
> fork has only two branches and the 20 need **three**:
>
> - **bespoke DI port** — the manipulative teaches (foundational, tight call-response).
> - **route to `di-spoken-practice`** — one interactive element wearing a costume.
> - **🚫 DI DOES NOT FIT — and naming this bucket is the whole point of the triage.**
>   `paragraph-architect`, `opinion-builder`, `revision-workshop`, `story-planner`,
>   `text-structure-analyzer`, `evidence-finder` are **extended composition, not call-response**.
>   DI's unit is a cue, a short answer, and an immediate verdict; a paragraph has none of those.
>   **A march down the census list without this bucket produces DI-shaped composition, which is
>   worse than leaving them alone.** Assert the bucket explicitly so no later session re-derives
>   it as a gap.
>
> Also pre-known: **`letter-spotter` stays BLOCKED** (`letter_name` = the unbenched homophonic
> class, LetterSpotter ruling — bench before wiring, do not port around it).
>
> #### PHASE 3 — ⭐ THE HIGHEST-VALUE TARGET LEFT, AND IT NEEDS ONE BENCH
>
> **`read-aloud-studio` + `decodable-reader` are the two primitives whose entire purpose is the
> child reading connected text ALOUD — and neither has any listening channel at all.**
> read-aloud-studio's own catalog entry states the gap as a *design constraint*: *"Student
> self-assessment only, no AI speech grading"* and *"No AI grading of speech."* A fluency
> primitive that records the child and then asks the child to grade themselves is describing
> exactly the hole the DI loop fills.
>
> **The blocker is a response-class bench — but a NARROWER one than it looks, and this is the
> plan's key claim.** Reading a known passage is a **CLOSED** target: the text is given, so the
> judge has a reference string. What is unbenched is **LENGTH** (a sentence or passage vs a
> word), *not* openness. That is a different and far more tractable question than
> `open_set_word`, which is genuinely open and which #94 just sharpened. **One bench sitting on
> a `connected_text` response class unlocks both primitives plus decodable-reader's G1–G2
> decode modes** — and decodable-reader is filed ESSENTIAL for K-2 reading.
>
> Sequence it after Phase 1 (Phase 1 needs no bench and retires a doctrine violation; this
> needs a bench and is the bigger product bet). **Do not fold it into Phase 2's triage** — it
> is not a fork question, it is a capability question.
>
> #### Standing constraints on all of the above
> Serial, one primitive at a time (user ruling: fan-out is opt-in). Pilot-then-sweep: no
> pattern rolls across primitives until the pilot is exercised at RUNTIME. Every port closes
> with a HUMAN-CHECKS row — and note what this lane's own history says about those rows:
> **two of two runner-era ports passed on first drive, but only because a human drove them.**

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

> ### 2026-08-12 — ✅ PORT 9 SHIPPED: `read-aloud-studio` — P3'S BENCH BLOCKER DISSOLVED BY THE UNIT, NOT CLEARED
>
> **The buildout plan filed this primitive under P3, "blocked on ONE bench for `connected_text`,
> which is a LENGTH question." That blocker does not bind, and the reason is worth carrying:
> the bench was assumed necessary because a read-aloud passage was assumed to be handed to the
> judge WHOLE.** Split into lines it never leaves the benched class at all —
> `sentence_read_aloud`, benched by di-sentence-reading (live-gated 2026-07-25, 10/10, and 2/2
> on deliberate single-word OMISSIONS, the hardest miss class), scoped 3-8 words per judged
> utterance. So the passage arrives already split and each line is one judged item, and
> `MIN_SENTENCE_WORDS` / `MAX_SENTENCE_WORDS` are **IMPORTED from that pack rather than
> re-declared** — the bench ceiling lives in exactly one place, so a future sitting moves it
> once. **What still owes a sitting is unchanged: free-length connected text, and
> `decodable-reader` if its reads cannot be split the same way.** Nothing was laundered; the
> ask was restructured until it fit the evidence, which is the family's own rule.
>
> **THIS WAS THE MOST DESERVING SURFACE IN THE LANE AND THE CENSUS UNDERSOLD IT.** It did not
> merely lack a listening channel — it *scored* children. Its evaluation was
> `modelListened + recordingMade + selfAssessment + comparisonUsed`: four button presses. Its
> headline metric, "estimated WPM", was wall-clock duration divided by the passage word count,
> computed whether or not the child said a single word — tap Start and Stop back to back and
> it read **6000 WPM**. A child who cannot read one word could tap Play, Start, Stop, then
> "5 out of 5" and finish with a full score, and that score went to the IRT model. Every
> graded action passed the costume test. The catalog said the quiet part out loud —
> *"Student self-assessment only, no AI speech grading"* — and that sentence is precisely why
> `di-sentence-reading` forked in the first place.
>
> **THE FORK SURVIVES, RE-BASED — and the old boundary line was a stale claim in live manifest
> steering.** `catalog/di.ts` told the manifest to prefer di-sentence-reading because
> read-aloud-studio *"(student self-assessment only)"* produces no graded evidence. Both halves
> of that are now false, and left alone it would have routed this primitive as an ungraded
> activity forever. Re-based in the same slice: **di-sentence-reading owns ISOLATED short
> sentences drawn from a phonics/sight-word menu at K-2; read-aloud-studio owns a PASSAGE whose
> lines read as one continuous text at G1-6.** A test pins the new steering (it fails if
> "self-assessment", "WPM" or "no AI grading" ever returns to the catalog prose).
>
> **⭐ THE PORT'S HARDEST CALL: PROSODY IS TAUGHT, NOT GRADED.** Two of the three eval modes are
> *about* how the reading sounds, and the obvious port judges that. It must not. There is no
> prosody response class in `RESPONSE_CLASSES` and inventing one needs its own sitting; forced
> into the runner's binary verdict, *"did that sound expressive?"* is exactly the ambiguous ask
> the family refuses — **a judge that cannot reliably refuse rubber-stamps, and the modality's
> entire value is that it refuses.** So expression and dialogue TEACH prosody by
> model-and-imitate and GRADE the words, and both contracts carry an explicit clause forbidding
> a sound-based refusal (*"A flat or plain reading that gets every word right is CORRECT… you
> never grade how it sounded"*). Without that clause the tutor invents a prosody refusal off
> the back of *"say it just like that"* — **an unbenched judgment wearing a benched one's
> clothes**, which is the failure mode this lane is least able to see from the outside. Pinned
> as a revert-bite.
>
> **THE MODE FORK, and where the model may speak.** `accuracy` is a COLD read — the tutor must
> not say the line before the child does, because decoding print unaided is the whole
> measurement and a model opens an echo route straight through it; a per-item `coldReadGuard`
> says so explicitly rather than relying on the omission, because the catalog's scaffolding
> levels are a second channel that could re-read it (di-sentence-reading's tier gotcha).
> `expression` and `dialogue` DO model first — a prosody you have never heard cannot be
> imitated — and those are the only lines ever spoken before the child speaks them.
> **Tap-to-hear re-speaks the INSTRUCTION, never the line** (cvc-speller's `[ISOLATE_VOWEL]`
> leak in this pack's dialect): on an accuracy item the affordance would otherwise be an
> answer-on-demand button.
>
> **⭐ THE SENTINEL GATE HAD TO RUN OVER GENERATED PROSE, NOT JUST OUR OWN.** The line text is
> interpolated into every affirmation and correction, so a passage line reading *"I was tired.
> Yes, very tired."* puts an AFFIRM sentinel inside a CORRECTION — the engine scores the
> tutor's correction as an affirmation and advances on a misread, silently. `findSentinelCollisions`
> is **reused as the build gate** rather than re-rolled, on both sides of the wire, and the
> generator prompt names the two forbidden openings. Same gate drops a dialogue line whose
> SPEAKER would open one.
>
> **RUNNER CHANGE (shared, derived, one option).** `useJudgedScriptRunner` gained
> `silenceCloseMs`, because the six packs it was extracted from were all short spoken answers
> and connected text is not: at the family default 500ms, three of ten probe reads split into
> TWO voice turns — di-sentence-reading's ship-blocking bench finding 2. This pack passes the
> same 1100ms. Taken as a **number, not a config object**, so a caller cannot churn the identity
> on every render (the lane's standing context-churn footgun). The default is untouched: 500ms
> stays correct for the short-answer packs.
>
> **WHAT WRITING THE SPOKEN ASK AUDITED IN THE DATA MODEL.** (a) `comprehensionQuestion` /
> `comprehensionAnswer` were generated on **every single call for months and rendered nowhere**
> — dead tokens in every request and dead weight in every payload; deleted. (b) markers were
> **indexes into a `passageWords` array** — a binding that costs nothing while it is only
> rendered and becomes an unaskable item the moment a tutor has to say it out loud; gone with
> the blob. (c) dialogue lines must arrive as the SPOKEN WORDS ONLY with the speaker in its own
> field, because a line carrying its own quotation marks would close the `Say exactly: "…"`
> span the tutor reads — `sanitizeLine` strips them and the component draws them back.
>
> **βs MOVED because the STRUCTURE did** (the skill's one licence to touch them): every mode
> went from an ungraded button press to unaided spoken production judged word by word.
> `accuracy` 2.0 → **3.0**, pinned to di-sentence-reading's `read_sentence` — the same act on
> the same benched utterance window. `expression` 3.5 → **4.5**, `dialogue` 4.5 → **5.5**,
> keeping their spacing. Catalog + `problem_type_registry.py` moved together; the eval-mode IDs
> are unchanged, so no calibration identity was broken.
>
> **METRICS: NO RATE FIELD REPLACES `estimatedWPM`, DELIBERATELY.** A real words-per-minute
> needs the DURATION of the learner's voice turn; the engine surfaces only the latency TO it
> (`responseMs`), and the runner's per-item `seconds` spans the tutor's ask as well — dividing
> by it ships a second wrong number in place of the first. **Queued, not faked.** What ships
> instead is `meanLineWords`, the pack's real structural axis (mirrors di-sentence-reading's
> `meanSentenceWords`).
>
> **Files:** `readAloudStudioScript.ts` (new, hand-authored) · `ReadAloudStudio.tsx`
> (whole-file rewrite) · `gemini-read-aloud-studio.ts` (new schema + both-sides gates) ·
> `evaluation/types.ts` (metrics rewritten) · `catalog/literacy.ts` (DI block) ·
> `catalog/di.ts` (stale steering re-based) · `useJudgedScriptRunner.ts` (`silenceCloseMs`) ·
> `problem_type_registry.py` (βs) · `__tests__/ReadAloudStudio.di-script.test.ts` (new, 35).
> **Deleted from the component:** the four-phase Listen/Practice/Record/Review stepper, the
> fake recorder + its WPM stat, the 1-5 self-rating, "Compare with Model", the playback-speed
> picker, every `LuminaActionButton`, all eight `sendText` choreography blocks, and the
> chunk-idleness `setTimeout` that decided when the model reading had ended.
>
> **Gates:** `typecheck:lumina` **0** · full `tsc --noEmit` **803 = baseline, zero in touched
> files** · vitest **215 files / 2901 passed** (1 unrelated `canvas-confetti` unhandled error
> from the astronomy suite; 4 skipped are the pre-existing letter-spotter live tests) · di-script
> suite **35/35** · census greps **0 / 0** (0 `setTimeout` in the component at all) ·
> **3 live real-pipeline probes, one per eval mode, ZERO drops** — probe deleted after the run.
> Drawn content: *accuracy @ G2 "Pond Animals" (400L)* — `Frogs sit on green lily pads.` /
> `Little fish swim in the water.` / `A turtle rests in the mud.` / `Ducks paddle across the
> quiet pond.` / `Many insects fly above the reeds.` (5/5, all 6w). *expression @ G4 "The Summer
> Storm" (700L)* — `Dark clouds gathered quickly overhead.` (lean: clouds) / `Heavy wind shook
> the tall trees.` (wind) / `Bright lightning flashed across the sky.` (lightning) / `Thunder
> rumbled with a loud roar.` (Thunder) / `Cold rain began to pour down.` (rain) / `Everyone
> hurried inside for shelter.` (shelter) (6/6, 5-6w). *dialogue @ G5 "The Big Climb" (850L)* —
> Leo/Maya alternating, 7/7, all 7w, every line with a speaker.
>
> **Residual (queued, not fixed): the G5 dialogue draw reads STILTED** — *"Safety protocols
> forbid attempting such reckless climbs"*, *"My determination will guarantee our ultimate
> success"*. That is Lexile pressure squeezed into a 7-word ceiling: the model raises
> vocabulary because it cannot raise length. It passed every gate and no child would be
> mis-taught by it, but it is not how a person talks, and dialogue is the one mode where that
> matters. Cheapest fix is prompt-side (ask for natural speech and let the Lexile ride lower on
> dialogue); the real fix is a longer-line rung, which is the `connected_text` sitting.
>
> **Mic row #95.** The machine gates prove the pack; only a mic proves the loop.
>
> **✅ 2026-08-13 — #95 HALF-DRIVEN, AND THE SPOKEN JUDGE REFUSED CONNECTED TEXT.** User drive
> (`…2026-08-13-033708-…dc60915090e5.jsonl`, `accuracy`, 4 items / 5 reads / 73s): *"works
> great… i did an intentional miss and it nailed it."* The bench argument this port rests on —
> that a passage split into 3-8 word lines never leaves `sentence_read_aloud` — now has spoken
> evidence on THIS surface, not just on di-sentence-reading. `The cat sits on his lap.` read as
> *"sat"* drew *"My turn: not sat — The cat sits on his lap. Your turn. Read it again."* with
> **no `context-update`**: the miss did not advance the item, and the re-read did. Cold read
> intact (*"Your turn. Read it."* and nothing else, three asks running). `owns_opening` verbatim,
> floor-gate summary all zeros, `state_attached` 1→2→3. **Owed:** `expression` + `dialogue`
> (the prosody non-refusal is the port's central risk and lives entirely in the unrun modes),
> the skipped-word class, the twice-missed move-on, the 1100ms mid-line pause.
>
> **⚠️ ONE WATCH ITEM, and it is a LOGGING gap first.** The second deliberate miss was cut off
> by a client disconnect mid-correction, and the contrastive slot may have inverted (transcript
> `Sam read the fast words.` → *"My turn: not **reads** —"*, i.e. plausibly the TARGET word in
> the slot that held the child's error one item earlier). **Unresolvable from the log by
> construction:** `context-update` writes key NAMES only and `text-to-gemini` truncates its
> preview at 160 chars — which lands just before the stimulus every time. A judged-loop session
> log cannot verify a judged loop without the item it judged.

> ### 2026-08-12 — ✅ PORT 10 SHIPPED: `decodable-reader` — P3 COMPLETE, AND THE FIRST PACK THAT FORKS ITS ANSWER MATERIAL *INSIDE* ONE RUN
>
> **P3's other half, and the same unit argument settles it.** The buildout plan filed
> `read-aloud-studio` + `decodable-reader` together as "blocked on ONE bench for
> `connected_text`", and port 9 dissolved that for passages by splitting them into 3-8 word
> lines. Port 9's own note left the open question — *"so does `decodable-reader` if its reads
> cannot be split the same way"* — **and here they already are**: a decodable passage arrives
> as an ARRAY OF SENTENCES with per-word phonics tags, so the split needs no new seam, only a
> gate. `MIN/MAX_SENTENCE_WORDS` are IMPORTED from di-sentence-reading for the third time; the
> ceiling still lives in exactly one place. **Live confirmation: five real-pipeline probes,
> 24 generated sentences, ZERO outside the window and zero drops.** Free-length connected text
> still owes its sitting; nothing here entered it.
>
> **WHAT THE PORT REPLACED IS WORSE THAN THE CENSUS SAID, in the same way port 9's was.** The
> census had this as "click-to-advance". It was not: **the reading phase measured NOTHING.**
> Its only reading signal was `wordsTapped` — how often the child asked for a word — and the
> phase ended on a button labelled **"I read it!"**. Pressing it requires no reading, so it
> fails the costume test outright, and a child who cannot read a word could press it, guess
> one of three pictures and score. Gone with it: the phase stepper, the words-tapped counter,
> the colour toggle, the Check button, the "Skip to Review" escape, the score ledger, and the
> phoneme popup.
>
> **⭐ THE PORT'S HARDEST CALL: TWO ANSWER MATERIALS IN ONE RUN, AND THE FORK FOLLOWS THE
> ANSWER, NOT THE MODE.** Every prior pack answers one question per item in one way. This one
> asks the child to *read* and then to *understand*, and the response-class arithmetic lands
> differently on each:
> - **the reading** → `sentence_read_aloud` (benched). One passage sentence, read cold.
> - **a LITERAL / read-along comprehension answer** → the answer is a WORD STATED IN THE STORY,
>   so the set is closed by the text itself: the child SAYS it (`short_spoken_word`, benched).
>   This is DI's own form — Reading Mastery asks comprehension orally — and it is the only
>   reason `read_along` has a spoken beat at all, since a K pre-reader does no decoding.
> - **a SEQUENCE / INFERENCE / MAIN-IDEA answer** → the answer is a whole PROPOSITION, which
>   spoken is `open_set_word`, **BLOCKED**. The picture cards close the set while comprehension
>   stays the skill; the tap is the commit and the verdict is code-computed
>   (picture-vocabulary's association resolution, third use). It survives the costume test: a
>   child who did not understand cannot pick reliably from three plausible distractors.
>
> **And the fork is per QUESTION, not per session** — a literal question whose one-word answer
> turns out not to exist falls through to the cards. That is a change of MATERIAL, not a
> degrade of the ask: the judging never loosens, only the channel moves. A question askable
> neither way is DROPPED.
>
> **PER-WORD "TAP TO HEAR IT" IS DELETED, and that is the answer-leak rule, not a
> simplification.** It was this primitive's signature affordance for a year. In a judged cold
> read it is a channel that speaks any word on demand — hear every word, echo the line, and the
> measurement is gone (di-sentence-reading's `hard` tier exists to close exactly that echo
> route). Help now arrives the way DISTAR gives it: through the correction, which re-models.
> Tap-to-hear survives as the runner's re-ask and **must not re-read the story either** — for a
> literal question the passage contains the answer verbatim, so re-speaking it on demand would
> answer the ask (cvc-speller's `[ISOLATE_VOWEL]` finding, applied to a passage).
>
> **TWO WHOLE-RUN GATES, because a comprehension question is only askable when the child has
> actually met the story.** (1) A `read_along` whose STORY would open a sentence with a verdict
> sentinel **ships nothing** — the tutor NARRATES that story, there is no per-sentence item to
> drop, and the reducer would score the tutor's own narration as an affirmation and advance
> before the child spoke. There is no safe degrade: cutting the line is a different story and
> the answer may live in it. (2) A DECODE run where every sentence dropped ships nothing
> either — the stage shows one line at a time, so with no lines the child never sees the
> passage, and a question about a story they were never shown is not a harder question.
>
> **A CONTENT DEFECT THE LIVE PROBE CAUGHT ON THE FIRST DRAW, and it is the "N challenges = N
> problems" ruling in a new shape:** `main_idea` produced *"What is the whole story mostly
> about?"* and *"What is the central message of this passage?"* — **one problem worded twice.**
> A story has exactly ONE main idea, so a second main-idea question cannot be a different
> question. `questionCount` is now mode-aware (read_along 3 · main_idea **1** · the rest 2), and
> in decode modes the reading itself already supplies most of the items.
>
> **Generator-side, KEEP-OR-DROP replaced a BACKFILL that was inventing answer keys.** The old
> post-processor defaulted an invalid `correctOptionId` to the first option — under a tap
> surface that quietly mis-scored one child; under a judged loop it hands a fabricated answer to
> a tutor that states it aloud as fact. Now the retry covers CONTENT (window + sentinel +
> askability) and what still fails is dropped. `phonemes` left the schema (nothing rendered it
> since the popup died) to pay for the questions array.
>
> **βs moved because the STRUCTURE did**, not for taste: every decode mode now contains unaided
> oral reading judged word by word, so the ladder starts above di-sentence-reading's
> `decodable_sentence` (2.5) — literal 1.5→**3.0**, sequence 2.5→**4.0**, inference 3.5→**5.0**,
> main_idea 4.0→**5.5**; `read_along` 0.5→**1.0** (a tap became a spoken answer, a smaller step).
>
> **Files:** `decodableReaderScript.ts` (new, hand-authored) · `DecodableReader.tsx` (whole-file
> rewrite, 1008→~570 lines) · `gemini-decodable-reader.ts` (questions array + `answerWord` +
> both-sides gates) · `catalog/literacy.ts` (DI block; contextKeys 13→2) ·
> `evaluation/types.ts` (metrics re-based off help-usage onto judged production) ·
> `__tests__/DecodableReader.di-script.test.ts` (new, 48 cases).
>
> **Gates:** `typecheck:lumina` **0** · full `tsc` **803 = baseline, zero in touched files** ·
> vitest **214 files / 2946 passing, 0 failures** · di-script **48/48** · census greps **0/0**
> (0 `setTimeout` in the component, 0 `sendText`, 0 `useLuminaAI`) · **5 live real-pipeline
> probes, one per eval mode, ZERO drops, every pack from live content passing
> `validateJudgedScriptPack`** (probe deleted after the run).
>
> **Probe draws.** *read_along @ K "A Dog at the Park"* — `The dog is at the park.` / `He can
> run and hop.` / `I see him sit.`; 3 spoken questions, answers **park · hop · sit**.
> *literal @ G1 "A Cat and a Hat"* — 4 lines (6w each), answers **hat · bike**. *sequence @ G1
> "Making a Snack"* — 4 lines, 2 card questions. *inference @ G2 "A Rainy Day at School"* — 6
> lines (5w each), 2 card questions. *main_idea @ G2 "Helping in the Garden"* — 7 lines, 1 card
> question (after the fix; the pre-fix draw is the duplicate above).
>
> **Residual (queued, not fixed): a dropped sentence is a sentence the child never SEES.** The
> stage shows one line at a time, so unlike the old whole-passage view a drop removes content
> from the story, and a later question could ask about it. Zero drops across five live probes
> and the generator retries on a bad draw, so this is a tail risk, not an observed one — but
> the honest fix is a question↔surviving-lines consistency check at build, which is only worth
> writing if a probe ever shows a drop.
>
> **Mic row #96.** The machine gates prove the pack; only a mic proves the loop.

> ### 2026-08-13 — ⚠️ PORT 8, SECOND DRIVE: THE TUTOR SAID THE SAME LESSON EIGHT TIMES
>
> **USER RULING, from the first full spoken run** (`…2026-08-13-025523-…f76f154cd898.jsonl`,
> 8 recognition items, the loop itself clean throughout): *"it feels over-done, she asks
> every time 'words rhyme when they end the same way, bee tree' each time, i think we can
> remove that after the first example."* The log has the model line **verbatim on all eight
> asks**.
>
> **The bug is a family-level reading error, not a wording nit.** The lead-in ladder was
> copied from di-letter-sounds and letter-sound-link, where the model teaches **the ITEM's
> own content** ("the letter m says mmm") — so re-modeling every item *is* the teaching.
> rhyme-studio's model is a **generic RULE on a code-owned pair**, identical every time. The
> tier was therefore being read as a property of the ITEM when it is a property of the RUN.
> **Rule for any future pack: if the model line does not change when the item changes, it is
> established once, not recited.** The lead-in now fades — full model on `opening` /
> `howToPlay` (the runner's own "is this a teaching moment?" signal) and on the ask after a
> CAPPED miss; steady state is the one-line listening guide at `easy` and nothing at
> `medium`. The ask, the judging and the correction's re-model are byte-identical.
>
> **Second finding in the same log — the di-spoken-practice voice defect, arriving a second
> time.** At turn 11 the tutor said *"Think time is unbounded — take your time."* to a child:
> catalog `commonStruggles[silence].response` was authored in **directive voice**, in a field
> whose contract is WORDS THE TUTOR SPEAKS, so a response that cannot be performed was
> recited. Re-voiced as a move (*"Wait for them without speaking… if the silence stretches
> long, say the scripted question once more, slowly"*), mirroring di.ts's own fix, and pinned
> as a unit regression on the catalog block.
>
> **Changed:** `rhymeStudioScript.ts` (fade), `catalog/literacy.ts` (struggle voice),
> `__tests__/RhymeStudio.di-script.test.ts` (+6 assertions). **Gates:** typecheck:lumina
> **0** · literacy + hooks **40 files / 605** · run rendered through the real cue builders
> (8-item medium and easy). **Not re-driven with a mic — #94 carries it.**

> ### 2026-08-12 — ⚠️ PORT 8 REVISION, SAME DAY: RECOGNITION TAPPED FOR ONE DAY AND THE FIRST DRIVE KILLED IT
>
> **USER RULING, from the first drive of the shipped port:** *"i think its weird to need the
> thumbs up and thumbs down [for] do they rhyme? we should just be able to say yes to the
> tutor, then DI mode answers is correctly?"* **Recognition is now VOICE (`yes_no`).**
> Nothing in this pack is answered with the hands any more.
>
> **The session log is the real finding, and it is bigger than this primitive.**
> `backend/logs/lumina-sessions/2026-08-13-023253-lumina-tutor-71bb8b7b1b5c.jsonl`:
> ```
> [  953] text-to-gemini  [RS_ITEM]   ← the ONLY message the app ever sent
>         AI: "…Do cat and hat rhyme? Tap thumbs up for yes, thumbs down for no."
> [27656] user-transcript turn 2: "Yes."          ← the child answered ALOUD
>         AI: "[RS_TAP] Correct! You got it: cat and hat rhyme because they both end
>              with at. Let's try another! [RS_MOVE] Listen to these two words:
>              cake, chair. Do cake and chair rhyme? Tap thumbs up for yes…"
> ```
> **Three failures, one cause.** (1) The tutor SPOKE THE BRACKET TAGS — and invented them:
> no `[RS_TAP]` was ever sent, so it reproduced tag names it had only seen *described* in the
> tap contract. (2) It invented a whole next item (`cake, chair`) while the screen still
> showed `cat/hat` — the user's screenshot is the app and the tutor talking about different
> problems. (3) It affirmed with **"Correct!"** instead of the `"Yes,"` sentinel, so the
> engine's scan read **no verdict at all**, nothing advanced, and the run wedged on item 1
> with the status stuck on "Listening…".
>
> **The cause was the silence contract itself.** It told the tutor *"WAIT in complete silence
> — the learner answers by TAPPING… do not judge anything you hear through the microphone.
> You will be told which thumb the learner tapped and given the exact line to say."* The
> child, asked a spoken question by a voice, answered with their voice. **The pack had no
> scripted line for that branch**, so the model improvised the tag, the verdict and the next
> question. **GENERAL LESSON, worth carrying to every pack: a silence contract is only honest
> when the child has no way to answer with their voice. Where the question is spoken and the
> answer is sayable, a tap surface does not restrain the model — it leaves it without a
> script at the exact moment it needs one.**
>
> **And the hazard that justified the tap was never real.** The original split argued "yes"
> is the affirm sentinel, so a spoken yes/no would collide. **The verdict scan reads the
> TUTOR's output, never the child's** — the same log shows the child's "Yes." arriving as
> `user-transcript` with no misfire anywhere. What was genuinely true is only that yes/no had
> no bench, so **`yes_no` is added to `RESPONSE_CLASSES` as `accepted-build-ahead`** on the
> user's ruling (the `number_word_to_120` mechanism), with the acceptance drive owed on #94.
> Its note carries the one real residual: **"no" is VC-length**, the length
> `short_spoken_word` records as unbenched, so the accept clause names the natural variants
> (*"yeah", "uh huh", "they do" / "nope", "uh uh", "they don't"*) and tells the judge to read
> the MEANING rather than demand the bare word.
>
> **Changed:** `judgedScriptContract.ts` (+`yes_no`), `rhymeStudioScript.ts` (recognition →
> voice; `tapVerdictCue` DELETED; `tapContract` DELETED; a real judging contract with both
> branches scripted; `affirmFor` centralised so every mode's affirmation opens with the
> sentinel — including when it affirms a correct **no**, where "Yes," means *you are right*),
> `RhymeStudio.tsx` (thumbs deleted; no gesture path at all), `catalog/literacy.ts`.
> **Two new catalog directives, both written from the log:** *SCRIPTED TURNS ONLY — AND NEVER
> INVENT THE NEXT ONE* ("the bracket tag is an address on an envelope, not words for the
> child"; after judging, stop) and *THE FIRST WORD OF A VERDICT IS LOAD-BEARING* (not
> "Correct", not "Great job" — the opening is how the lesson knows a verdict happened).
>
> **Gates:** typecheck:lumina **0** · full suite **212 files / 2857** · live probe @ K
> recognition — 4/4 items voice/`yes_no`, both verdict branches scripted, no thumbs prose
> anywhere, drawn `cat/hat ✓ · pig/dog ✗ · sun/run ✓ · pot/box ✗`. **Still not driven with a
> mic — #94 rewritten for the spoken surface.**

> ### 2026-08-12 — ✅ PORT 8 SHIPPED: `rhyme-studio` — THE BENCH, ANSWERED BY THE BANK
>
> **User-pulled** (*"can we continue the DI modality onto rhyme-studio?"*). This is the
> primitive that sat behind a bench sitting longer than any other literacy surface, and the
> block was real: `open_set_word` is a BLOCKED response class and *"tell me a word that
> rhymes with cat"* is its canonical case. **The bench is not cleared here and nothing
> pretends it is — the port is possible because the shipped `production` mode was never
> actually open.** It renders a FOUR-TILE WORD BANK and the child taps one. The bank looked
> like scaffolding to delete on the way to DI; it is in fact the only reason the mode is
> sayable at all — delete it and the class becomes blocked, keep it and the child produces a
> rhyme ALOUD from a closed, code-enumerable set. What ships is CONSTRAINED production (the
> generator's own long-standing name for the remediation move). Free production still owes
> its sitting, and the question that sitting must answer is now sharp: **can the judge hear
> an arbitrary child-invented rhyme, off any menu?**
>
> **Files:** `rhymeStudioScript.ts` (new, hand-authored DISTAR), `RhymeStudio.tsx`
> (whole-file, on `useJudgedScriptRunner` — **fourth literacy consumer**),
> `gemini-rhyme-studio.ts` (bankDistractors + the sentinel filter + the rhyme-integrity
> gate + keep-or-drop), `catalog/literacy.ts` (audioInput + DI block + contextKeys **10 →
> 2**), `problem_type_registry.py`, `__tests__/RhymeStudio.di-script.test.ts` (new) and
> `RhymeStudio.reader-fit.test.tsx` (rewritten onto the new surface).
> **Deleted:** the Start Activity gate, the push-to-talk say-it-again bonus beat and its
> 1400ms auto-advance, `MAX_ATTEMPTS` + the reveal-after-3 ladder, Next/Finish/Skip, all ten
> `sendText` tags, the `tutorRevealPolicy` prose, the on-screen question restatement, the
> `showInstructionText` tier lever (it withdrew a restatement that no longer exists), and
> `RhymeStudio.support-tiers.test.tsx` (the tier now lives in the script's lead-in ladder).
>
> **THE SPLIT (standing gate 1 arithmetic):** recognition = 👍/👎 TAP (`manipulation`) ·
> identification = SAY the word (`short_spoken_word`) · production = SAY a card
> (`short_spoken_word`). **Recognition taps and that is a ruling, not a softening:** its
> answer is a yes/no verdict, not language, and the two words that would carry it are the
> worst possible pair to hand a judge — **"no" is VC-length, the exact length
> `short_spoken_word` already records as unbenched, and "yes" IS the affirm sentinel.**
> letter-sound-link's `hear-see` shape, second use.
>
> **⭐ THE PORT-7 CONTENT RULE FIRED AGAIN, AND HARDER — three false answer keys in five
> live probes.** *"Where a port converts a tap to a spoken relation, re-check the content the
> tap never had to justify."* Live Gemini produced: target **`shark` with rhymeFamily `-ank`
> and the answer `tank`** (the correction would have taught a child that tank rhymes with
> shark); target **`crab` offering `fab` as a DISTRACTOR** (a child saying it would have been
> corrected for a right answer); and **`lamp` listed as an acceptable rhyme for `jump`**. All
> three were silent under a tap surface and all three are SPOKEN under this one. All three
> are decidable from spelling alone — which is exactly why the prompt was never the right
> place for the rule. `holdsRhymeIntegrity` now repairs what is repairable (`doesRhyme` is
> recomputed from the words: the boolean is a claim, the words are the truth; a missing
> isCorrect flag is resolved from the WORDS, never from position) and DROPS what is not.
> Pinned as unit regressions, because live content is not deterministic.
>
> **⭐ A FOURTH DEFECT HAS NO CODE FIX, AND IT CHANGED THE DESIGN.** For the target `cake`
> the model offered *"bake, lake, rake, **nake**, take"* — and the first draft of this pack
> read that whole list into the judge's accept clause, because widening production beyond
> the four tiles looked generous and free. It is not free: **a closed set is only worth what
> its members are worth, and an invented word the tutor has been told to affirm is worse
> than a narrow set.** The accept set is now EXACTLY what is on screen, in every mode. The
> pedagogical cost is real and deliberate — a child who says a true rhyme that is not on a
> card gets corrected — and it is **HUMAN-CHECKS #94 criterion (c)**, filed as an open
> product question rather than a settled one. If the drive says it reads unfair, the answer
> is the `open_set_word` bench, not a looser judge.
>
> **Two more findings, both small and both reusable:** (1) **the old hardcoded
> `DISTRACTOR_POOL` shipped the literal word "yes"** — port 7's near miss arriving as a
> latent bug rather than a catch. Two structural defences now: `isSentinelSafeWord` filters
> every pool, and **no sentence in any cue opens with a content word** — every sentence
> starts with an authored token, so a word that slips every filter still cannot land in an
> opener slot. That second rule is cheaper and stronger than the filter and is worth copying
> to every pack. (2) **`pickModelRhymePair` excludes by rhyme FAMILY, not just by word** —
> modeling the rule on "bee/tree" is safe, but a model pair from the `-at` family gives away
> every `-at` item in the run despite sharing no letters with them. The `pickModelNoun`
> ruling, fourth use, with the first domain-specific tightening.
>
> **EVIDENCE.** `typecheck:lumina` 0 · full project `tsc --noEmit` = 803 errors, **zero in
> any touched file** (baseline held) · full suite **212 files / 2854 tests green** · census
> greps on the component: 0 legacy voice hooks, 0 advance timers, 0 `setTimeout` at all ·
> **5 live real-pipeline probes** (recognition @ K, identification @ K, production @ 1,
> mixed @ 1 hard tier, identification @ 2 "Ocean Animals"): every pack built from live
> content passed `validateJudgedScriptPack`, the sentinel scan over generated words included,
> and no spoken line leaked a rime. Probe file deleted after the run. **Words drawn on the
> final pass:** K recognition `cat/hat pig/wig dog/sun sun/pen` · K identification
> `cat→hat|can, pig→wig|pot, sun→run|dog, top→mop|bed` · G1 production `cat→[dog bat* cup
> hat*], cake→[car bake* fish lake*], pig→[pen big* hop dig*], sun→[bed bun* hat run*]` ·
> G2 `bright→flight*, sound→found*, station→nation*, tank→sank*`.
>
> **⚠️ RESIDUAL — the Grade-2 draw is the weak one, twice over.** The integrity gate dropped
> **2 of 4** items on a Grade-2 probe before over-draw headroom was added (the generator now
> requests `challengeCount + 2` and trims, so a lesson is never starved by the gate). The
> gate makes it SAFE, not GOOD: the model is unreliable on harder rhyme families, and the
> real fix is the curated per-family word menu that grade K already has and G1/G2 do not
> (the K path drew 4/4 clean on every probe). Separately, the G2 "Ocean Animals" draw
> returned `bright`, `sound`, `station` — a topic-fidelity miss, pre-existing and not this
> port's. **Executor: `/add-number-pool-service` or a curated `G1_G2_RHYME_FAMILIES` menu on
> the K pattern; needs a content decision (which families per grade), not just code.**
>
> **⚠️ NOT DRIVEN LIVE — HUMAN-CHECKS #94.** No mic has heard this surface. The row carries
> the per-mode wrong answers to say; criterion (c) is the accept-set question above.
> **Remaining literacy census after port 8: `interactive-book`, `word-workout`, `story-talk`
> on click-to-advance; 20 with no voice at all. Every stopwatch primitive is now ported.**

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
> ~~**⚠️ NOT DRIVEN LIVE — HUMAN-CHECKS #92.**~~ **✅ DRIVEN BY THE USER 2026-08-12 — #92
> STRUCK.** *"phoneme explorer is excellent, i just did several sessions in a row… i did
> some incorrect, some correct, i would say this passes human check."* Several consecutive
> sessions, correction branch exercised deliberately — the two firsts this row carried
> (COUNT answers on segment; the mixed-action how-to-play re-speak) are now user-confirmed.
> **The spoken judge has refused deliberate errors on TWO consecutive runner surfaces
> (#91, #92)** — with two of two runner-era mic rows passing on first drive, the runner
> template is proven by the queue's own criterion (*"write the thin `/add-di-loop` skill
> wrapper after the mic sittings prove the template"*), so the wrapper is now unblocked.
> The pre-runner rows (#82-#84, #85-A, #86, #87) and #89/#93 stay open per-surface — #93
> especially, whose judged target is a SOUND, which no strike so far covers.

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

### 21. 🔴 **OPENED 2026-08-14 — THE TUTOR NARRATES ITS OWN INSTRUCTIONS ALOUD, AND IN A JUDGED LOOP THAT IS ALWAYS AN ANSWER LEAK.** Found by the FIRST use of `/tutor-test --di`, on `ten-frame` (live on `main` since `2f73725`).

**Evidence: 2 of 2 harness runs, same config, both FAIL — 12 and 18 HIGH.** The tutor opens turns with a `[CURRENT STATE]:` monologue describing what it was told: *"The problem on screen has advanced… The correct answer for this item is "four". Per the instructions…"*, *"as instructed by the `[TF_MOVE]` tag"*. Oracles: `di-tag-spoken` ×8-10 and **`di-answer-leak-in-ask` ×5-6 — the child hears the answer inside the ask.**

- ⭐ **THE STATE CHANNEL IS NOT THE SOURCE, AND THAT INVERTS THE 2026-08-11 DIAGNOSIS.** `tenFrameScript.stimulusFor` is answer-free by construction — `subitize` pushes the literal string `'a quick flash of counters on the frame'`. The spoken answer comes from the **judging contract inside the cue** (`The correct answer is "four"`), which the model paraphrases while narrating. So the drive-1 fix (amputate `contextFor` → `{}`) would NOT have fixed this, and the **user's overruling of it was right for a reason nobody had established.** Do not re-propose amputating the channel.
- ⭐ **WHY THIS CLASS CANNOT BE PROMPTED AWAY.** A judged cue MUST carry the answer — that is what makes the tutor a judge. So *any* recitation of instructions is automatically an answer leak, and the defense cannot be another "never read this aloud" line. `lumina_tutor.py:556` has said exactly that since drive 1, and this register already ruled on it: **"a rule the model can break is not a gate."**
- **The fix shape is TRANSPORT, and its precedent is already in the tree:** the off-script cut-in in `useJudgedSpeechLoop` (`interrupt: true`) built for the phantom-item hostage. A tutor turn that OPENS with control syntax (`[`, "Per the instructions", a tag name) is off-script by definition and can be cut the same way. **Needs a user ruling before code** — the last engine-level change in this exact area was overruled.
- ⚠️ **NOT ten-frame's, and not math's.** The cue shape is family-wide; ten-frame is just the first port the harness has ever driven. Assume every runner-era port carries it until driven.
- ⚠️ **`--runs 1` IS WHY THIS WAS MISSED.** The first ten-frame report (same config) came back **PASS, 0 HIGH** — the failure is intermittent, and at `--runs 1` the harness's own "confirmed at ≥2/3" rule degrades to "everything counts", which makes a finding's ABSENCE meaningless. **Drive judged ports at `--runs 3`.** Related harness wart: the report path is date-stamped only, so a same-day re-run silently OVERWRITES its own baseline.
- 🔁 **RECURRENCE 2026-08-14 — port 14 `interactive-book`, first drive, and it arrived in FABRICATED form with the transport fix in place.** 1 of 3 sessions: from item 3 onward the model prefixed every ask with `[CURRENT STATE]: The student is on attempt 0 for the challenge 'read-focus-word' with the prompt '…' and the correct answer being 'liquid'.` — answer spoken before the ask, 3/5 asks, session-sticky after onset; the other two sessions were clean. **The backend sent none of it:** the real template is `[CURRENT STATE] Where the student is in this activity:` + key/value lines, the pack's state push is `{challengeType, stimulus}` with no answer and no attempt counter, and `scripted: true` kept it off the cue — the model imitated the tag from its own system-prompt vocabulary and paraphrased the CUE's judging contract into it (the `[LSP_TAP]` fabrication shape on a VOICE turn). This CONFIRMS the "cannot be prompted away" bullet with the transport half eliminated: what remains is the cut-in, which still needs its user ruling. Port-side mitigation only: both interactive-book contracts now end by naming the failure (fact-form). Report: `interactive-book-live-di-plain-2026-08-14-read-focus-word.md`, run 1.

### 20. 🎙️ **OPENED 2026-08-13 — THE TRANSCRIPT IS NOT WHAT THE JUDGE HEARD, AND OUR EVIDENCE IS BUILT FROM THE TRANSCRIPT** (user, on the #93 drive: *"the tutor did it right, the transcription is never as good as the real phrasing"*)

**The distinction, and it is the whole item:** the judge hears **audio in-band** and is now user-confirmed on three surfaces (#91, #92, #93). The **text transcript is a lossy spectator view** of that same turn (`[[project_live-api-levers-that-dont-exist]]`). Nothing about grading is at risk — no port gates correctness on the transcript; the verdict is always the tutor's. **What is at risk is the EVIDENCE.**

- **`lastHeard` is the transcript**, set from the `attempt-transcript` emission (`useJudgedScriptRunner.ts:443`), and **20 judged components read it** to build the `observed` string of Tier-A misconception evidence. So the diagnosis loop quotes *"Heard "X"."* where X may not be what the child said.
- **letter-spotter goes further and derives DATA from it:** `name-it` regex-tests the transcript for a single letter and pushes a `[target, heard]` confusion pair. A lossy transcript makes that **silently under-collect** (anything not exactly one letter is dropped) — and it is NL parsed by regex, which `[[feedback_schema-over-regex-and-prompt]]` rules against.
- **The higher-fidelity channel already exists and is already wired:** `verdict-text` carries the judge's own finished correction line, which NAMES the error, and the runner already attaches it as `judgeFeedback` (preferring judge-backed observations at assembly). **The likely fix is provenance, not new plumbing** — prefer the judge's own words, treat `lastHeard` as corroboration, and stop presenting ASR text as if it were ground truth.
- **Probe BEFORE code** (`[[feedback_value-origin-not-code-touch]]`): one drive logging `lastHeard` beside what was actually said, to size the gap. If it is small on short spoken answers and large on connected text, that alone re-scopes the fix. Executor: probe slice → then a runner/evidence edit.

### 19. 🧰 **OPENED 2026-08-13 — GENERALIZE THE PORT (user thread: DI ports "hard to scale without detailed testing… each primitive is from scratch"; /simplify 4-agent review of ports 8–11 + ten-frame, cross-read against this register)**

**The diagnosis, in one line:** the extraction ruling generalized the LOOP (contract + runner) but not the ENVELOPE (cue frames), the FURNITURE (mic panel / phase results / status lines, ~60–80 identical lines per port), the GATES (sentinel + shape checks forked per file — five implementations, two semantics), or the TEST HARNESS (12 hand-copies, three divergent spoken-line parsers) — so each port hand-authors ~1,100–2,000 lines against ~1,060 shared, and a live-drive fix lands in ONE pack while ~9 keep the defect (the "[WAIT silently]" fact-form fix never propagated). The testing wall is the same shape: the only gate that exercises the JUDGE is a human sitting, which is why #82–#98 accumulate faster than they drain.

**✅ SHIPPED in the review slice (machine gates: typecheck:lumina 0 · full tsc 0 new in touched files · full vitest 3030 passed · pilot suites 28/28 + 126/126):**
- `hooks/judgedScriptContract.ts` — `spokenSpanOf`/`spokenSpansOf` (the ONE spoken-line parser), `opensWithSentinel` (per-sentence; replaces the weaker string-START forks that missed a second-sentence "Yes,"), `findPerformedStageDirections` (the performed-"[WAIT silently]" class), `findRepeatedConsecutiveAsks` (the port-8/port-11 byte-identical-ask class, now code), `JUDGED_AUDIO_INPUT` moved here (runner re-exports).
- `hooks/judgedScriptContract.testkit.ts` **NEW** — `checkPackGates` + `checkDiCatalogEntry`: the di-script plumbing once, `commonStruggles` always scanned. **Piloted on ten-frame; `/add-di-loop` step 6 re-pointed at it.**
- letter-spotter — generator now IMPORTS its shape/sentinel gates from the script (**the two sides of the wire disagreed live: 90 vs 100 sayable-sentence chars**; stricter wins), and `isSayableSentence` rejects double quotes (an embedded `"` closes the cue's `Say exactly: "…"` span early — quote-injection into the frame; decodable/read-aloud sanitize, this pack drops).
- runner — `currentSolved` + `canAttempt` exported (the anti-stage-gate API; ten-frame consumes `currentSolved`), `isAwaitingGesture` identity-stable, dead `run.hearTaps` removed (`summary.hearTaps` stays).
- ten-frame — dead `seededCount`/`reflashesRef` deleted ("Show again" rides `hearStimulus` → `summary.hearTaps`, the contract's named successor); mic orb label is now answerKind-aware (*"Show me on the frame"* on hands items). **Render-only change, un-driven — fold the glance into the #98 sitting.**

**QUEUED (each its own slice; pull order was 19a → 19b → 19c/19d → the rest. 19a, 19b and 19d are shipped — **19b's code has landed and its machine gates are green, but it is NOT closed until HUMAN-CHECKS #99 is driven at a real microphone**; next machine pull is 19c):**
- **19a. TESTKIT SWEEP ✅ SHIPPED 2026-08-13** — all 12 remaining di-script suites migrated; 13/13 now run the shared gates. Machine gates: di-script 388 pass (was 387) · full vitest 3043 pass · typecheck:lumina 0 · full tsc 0 in every touched file. **The prediction held and the worklist was exactly as scoped: nine packs opened their contract with the imperative `"Then WAIT silently — …"` and all nine are fixed to the ten-frame fact-form** (decodable-reader ×3, letter-spotter ×2, letter-sound-link ×2, picture-vocabulary ×2, counting-board ×2, read-aloud-studio, phoneme-explorer, rhyme-studio, push-pull-arena), plus a tenth wording class the sweep surfaced — `"and stop, then wait again"` (10 sites) and the pre-runner four's `"Then wait for the learner to speak."` opener, the same imperative shape one clause down. **Confirmation folded into the existing mic rows, no new row** (HUMAN-CHECKS.md, the ➕ block above the 2026-08-11 header): one thing to NOT hear on drives already scheduled.
  - **THREE things the sweep changed that the plan did not anticipate, each because a gate was wrong rather than a pack:**
    1. **`spokenSpanOf` learned the other three anchors.** It knew `Say exactly:` / `then wait:` only, and the four pre-runner ports speak through `Speak exactly:` (47 sites, the di-bench-era form) — so the "ONE parser" could not reach a third of the family. Now four anchors, pinned per era in `judgedScriptContract.test.ts`. This is not cosmetic: `findPerformedStageDirections` SUBTRACTS spoken spans before scanning, so an unknown anchor makes the tutor's own line searchable and can flag a clean cue.
    2. **`findRepeatedConsecutiveAsks` was mis-calibrated and is now length-gated (`REPEATED_ASK_WORD_LIMIT = 12`).** Byte-identical alone is the wrong finding: DI runs on invariant signals, and the gate flagged decodable-reader's `"Your turn. Read it."` (4 words, once per sentence of a passage, nothing in it CAN vary) exactly as loudly as rhyme-studio's 15-word rule model. A gate that forces packs to rotate a signal teaches worse. Calibrated against all four known spans — the two struck defects (15 and 16 words) FLAG, the shipped short repeat (10 words) and the bare signal (4) PASS — with each row pinned as its own test.
    3. **Every fixture pack was the ONE shape that cannot trigger the repeat gate.** They are all one-item-per-mode, and the gate compares consecutive SAME-action items, so adopting it would have been a no-op on 12 of 13 suites. Each suite now also builds the real shape (two same-mode items / two lines of one passage). **That is what caught the one live defect this slice found:** `decodable-reader` speaks a byte-identical ask on every consecutive sentence of a passage — the pack's most common path, shipped since port 10 and invisible to every gate that ran on it. Under the calibrated limit it is a PASS (the ask is the 4-word signal), and it is recorded here because the next pack with a long invariant lead-in will not be.
  - **The pre-runner four were NOT retrofitted (standing ruling upheld, see the fork below).** Their suites adopt the shared parser and run `findPerformedStageDirections` over a labelled cue list directly — the cue-level gates need no pack. `checkPackGates`/`checkDiCatalogEntry` need `answerKind`/`responseClass` per item, which those packs genuinely do not carry; fabricating them in a test would assert a contract production does not keep.
  - **Two ports gained a catalog check they never had:** `counting-board` and `push-pull-arena` had no catalog block in their suites at all. Both pass. `catalogProseCues` now also scans directive TITLES (rhyme-studio's hand-rolled scan covered them, so adopting the shared one would otherwise have LOST a check).
  - **FORK RULED (user, 2026-08-13): moving the pre-runner four onto `useJudgedScriptRunner` stays LAZY — only when one of them next needs real work.** The 2026-08-10 extraction ruling (no retrofit) stands; nothing in 19a reverses it.
  - Residual, deliberately not done here: the five di-bench `direct-instruction/di*Script.ts` packs still carry `"and stop, then wait again"` (11 sites). They are the bench family, have no di-script suite, and are gated by their own support-tiers tests — they adopt the wording with their next touch. The duplicated never-perform tail (`"Never read bracket tags aloud."` appearing twice in letter-spotter's item cue) is **19g**'s canonical tail, not this slice's.
- **19j. 🔴 `owns_opening` IS NEVER SENT ON THE LESSON PATH — DI-GREET-1, unfixed on the surface that matters most. OPENED 2026-08-14 (found on the 19b mic drive; NOT fixed in that slice).**
  - `connect()` forwards `owns_opening` (LuminaAIContext, standalone). **`connectLesson()` and `switchPrimitive()` do not send the field at all** — grep it: the only production senders are the standalone `connect` call in `useJudgedScriptRunner.start()` and the nine pre-runner packs, every one of which reaches the backend through the STANDALONE path.
  - So in a lesson the backend's *"Greet the student warmly…"* turn is never suppressed. The model takes a turn on connect, improvises over `primitive_data`, and **produces a plausible, specific, wrong instruction** — observed 2026-08-14 as *"put 2 counters on the frame"* (ten-frame) and a count-the-stars ask (counting-board), both spoken over a run that had not started. This is exactly the failure `owns_opening` was built for (word-flip, 2026-08-10) — it was only ever wired on the path the DI benches used.
  - **It compounded the 19i defect rather than causing it:** the board was dead because the run was unstartable, and the tutor's improvisation is what made a child (and the user) believe it should not be. Fixing 19i restores the start gesture; this item is what stops her talking before it is pressed.
  - ⚠️ **Scope note before anyone patches it:** in a lesson the Gemini session is SHARED across every primitive on the page, so `owns_opening` cannot stay a per-primitive flag there — it is fixed at session creation like `audio_input`. The likely shape is `connectLesson` scanning the manifest the way it already does for `audioInput`, and it needs a ruling on what a MIXED lesson (judged + non-judged blocks) should do. **Not a one-liner; do not fold it into another slice.** Executor: dedicated slice + a lesson drive.
- **19i. ✅ FIXED 2026-08-14 — EVERY JUDGED PORT WAS UNSTARTABLE IN A LESSON (found live by the user on the 19b drive: `ten-frame`, then `counting-board`).**
  - **Mechanism.** A lesson opens ONE shared microphone at connect, so `ctx.isListening` is true before the child acts. All fifteen surfaces computed `micState = preparing ? 'opening' : ctx.isListening ? 'armed' : 'idle'` — so the orb read **'armed'**, and `armed` is precisely the state in which `LuminaMicListener` renders the live surface INSTEAD of the tap-to-start button (`showButton = state === 'idle' && (dormant ?? true)`). **`onStart` is only wired to that button.** No affordance → `start()` unreachable → `running` false → `canAttempt` false → **every tap on the board dead**, under an orb captioned *"I'm listening"* / *"Show me on the frame"* and a status line reading *"Tap the microphone to start."* `cancelListening` is also `undefined` in a lesson, so there was no way back to 'idle' either. A hard dead end.
  - **Fix:** gate on `running && ctx.isListening`. `isListening` answers *"is the mic hardware open"*, which in a lesson is not the question; the orb asks *"is this RUN listening for an answer"*, and only `running` answers that. **Standalone is unaffected** — there `isListening` only goes true inside `start()`, so the two agree. Applied at all five sites: `useJudgedScriptRunner` (the eleven runner ports) + the four pre-runner ports' local copies (cvc-speller, phonics-blender, sound-swap, word-flip).
  - **Gate:** new lesson-mode case in `useJudgedScriptRunner.test.tsx` — pre-start `micState === 'idle'` and `canAttempt === false` with `sessionMode: 'lesson'` + `isListening: true`, armed and attemptable after `start()`. **Verified to FAIL against the reverted line.** typecheck:lumina 0 · full vitest 3131.
  - ~~⚠️ **STILL UNDRIVEN AT A MICROPHONE.** The fix restores the start gesture; that it then *runs* through a lesson's shared turn authority is what HUMAN-CHECKS #99's remaining half asks.~~ ✅ **DRIVEN 2026-08-14 (#99 drive 2, session `046ad3a42906`):** in a live K counting lesson both judged ports started AND ran through the lesson's shared turn authority — `counting-board` 7/7 spoken answers judged to completion, `ten-frame` `subitize` 2/2. The fix is live-verified; report `qa/tutor-reports/lesson-live-2026-08-14-k-counting-di.md`.
  - 🔎 **THE OPEN PRODUCT QUESTION THIS EXPOSES, deliberately NOT decided here: should a judged run auto-start in a lesson at all?** The tap-to-start exists because a browser will not open a microphone without a gesture — but in a lesson that gesture already happened at lesson entry and the mic is open. Auto-starting on mount is wrong (every judged block on the page would fire its opening cue at once), so it needs an active-primitive/viewport gate. **User call; the fix above is the conservative one that restores what the UI already claimed.**
- **19b. MIC-LEVEL CONTEXT CHURN** — ✅ **CODE SHIPPED 2026-08-14 · ✅ STANDALONE MIC DRIVE CLEAR (user, `ten-frame`/`subitize`: *"worked correctly"*) · ✅ CLOSED 2026-08-14 — LESSON PATH DRIVEN (#99 drive 2, session `046ad3a42906`).** The deaf-mic risk is retired on BOTH paths: standalone (drive 1), and the PROVIDER's shared turn instance in a live lesson (drive 2 — 11 voice turns opened and closed, `counting-board` 7/7 + `ten-frame` `subitize` 2/2 judged, superseded 0, wedged 0). The item's own bar — "one lesson launch closes it; do not close it on the machine gates" — was met at a microphone, not on tsc. Report `qa/tutor-reports/lesson-live-2026-08-14-k-counting-di.md`.
  - **What shipped, both halves of the item plus the one thing it did not anticipate:**
    1. **`micLevel` is out of the context value.** The provider holds `micLevelRef` + a listener set and publishes synchronously from `onAudioData`; the value exposes `subscribeMicLevel` and `micLevelRef` only. **Nothing in the provider re-renders on an audio frame any more.** A `useMicLevel()` hook wraps the subscription for the surfaces that PAINT the level, so the per-frame render stops inside the leaf that draws it.
    2. **`sendText` reaches `schedulePendingCue` through `sendTextRef`.** That makes `schedulePendingCue` → `dispatch` → `handleVoiceTurnClose` identity-stable, which unsticks all four effects the item named — including the per-frame **lesson-mode voice-turn RESUBSCRIBE**, now pinned by a revert-biting test in `useJudgedSpeechLoop.shared-turns`.
    3. **⭐ NOT ANTICIPATED, AND IT IS THE RISKY PART: `useLiveVoiceTurns` had to stop being render-driven.** The item says "only the orb consumes it", but the **turn machine consumed it too** — it stepped inside a `useEffect` keyed on `transport.micLevel`, i.e. every frame had to become React state and re-render the tree before a turn could open. The transport now takes `subscribeMicLevel` and the machine steps in that callback. **This is the seam every judged surface opens a turn through: get it wrong and the app goes deaf, which is worse than the churn.** Hence #99 criterion (a) and a new `useLiveVoiceTurns.frames` suite — frames alone open AND close a turn with zero renders, subscribe happens once across 40 renders, and the listener drops on disable and unmount.
    4. One behaviour came free: the old effect re-ran on unrelated dep changes and stepped the machine a second time on a sample it had already consumed. **Calibration now sees each frame exactly once** — which is why #99 (c) asks about the bar in BOTH directions.
  - **Blast radius, all mechanical:** `JudgedMicPanel` owns the subscription for the eleven runner ports (the `level` prop is gone; `micLevel` is off `JudgedScriptRun` and off `JudgedRunSurface` as a dead field). A new `components/LiveMicListener.tsx` — the ONE binding of the kit's orb to the live session — serves the five DI-bench ports and the bench, which drew `LuminaMicListener` directly. `CuratorCompanion` moved Pip's halo, the mic ring and `useHeardVoice` onto their own subscriptions, so the companion panel is off the frame path entirely. 22 suites gained a `useMicLevel` stub.
  - **Machine gates:** typecheck:lumina 0 · full tsc 0 new in every touched file · full vitest **3130 passed** (+5: 4 frame-path, 1 resubscribe) · both new gates verified to FAIL against the reverted code.
  - **Known and deliberately not closed here:** the context value is still an unmemoized object literal. That was the amplifier's *carrier*, not the amplifier — with the per-frame source gone it rebuilds on conversation chunks and audio-state flips (O(1/sec)), and a wrong dep array on a 25-field provider value is a worse trade than the churn it would remove. **If a future timer effect misbehaves, `useMemo` on that value is the next lever — not a re-litigation of this slice.**
- **18c. 🔴 THREE DEFECTS FROM THE FIRST JUDGING DRIVE ON MATH (session `e8093c77308e`, 2026-08-14, `subitize` 8 items / 183s). The drive PASSED its headline — 6/6 deliberate wrong answers refused, 6/6 correct affirmed, zero errors either way — and these are what the same log shows underneath it. None is fixed; each is its own slice.**
  - **(a) A SUB-SECOND NOISE RESTARTS A CORRECTION FROM THE TOP.** At t=135.2 an `activity_start`/`barge-in` pair with **no transcript at all** (600 ms: a breath, a chair, a false start) cut Gemini's turn 15 mid-correction; turn 16 then re-spoke the entire correction. The child heard *"My turn: it was seven. Look at the whole grou—"* and then the whole line again — **8.4 s of tutor speech for one correction.** This is the blip class `useLiveVoiceTurns` already reports (`loop-deaf`) reaching the CHILD rather than just the ledger, and it is the same "the tutor owns 87% of wall clock" problem letter-spotter had. **The open-mic ruling is not in question** — the fix is on the tutor's side (do not restart a line a blip interrupted), never a mute.
  - **(b) THE CAPPED ITEM ASKS A QUESTION AND THEN WITHDRAWS IT.** Item 3 (answer 5): after the third wrong answer the tutor's correction still ended *"Your turn. How many counters did you see?"*, and **0.9 s later** the runner's `TF_MOVE` cue said *"Good try! Here comes the next one."* The child was asked, then told to move on before they could answer. Root: the correction cue is authored to re-ask, and the runner decides the cap AFTER the tutor has already spoken. **The contract has to know it is the last attempt** — a final-attempt cue that models without re-asking — because the runner cannot retract an utterance. Same family as letter-spotter's coalesced hint-plus-reveal.
  - **(c) THE CORRECTION IS BYTE-IDENTICAL EVERY TIME.** *"My turn: it was five. Look at the whole group at once instead of counting them."* — three times in a row, 20 words each. DISTAR firms by escalating, not by repeating; a child who missed it once gets nothing new on the third pass. **Note the gate gap:** 19a's `findRepeatedConsecutiveAsks` (12-word limit) scans consecutive same-action ASKS and does not look at corrections at all, so this shipped clean through it. Widening that gate to correction spans is part of the fix, not just the wording.
  - **⭐ (d) NOT A DEFECT, BUT THE SHARPEST EVIDENCE YET FOR ITEM 20.** The ASR wrote **"Ciao"**, **"importante"** and **"sechs"** for answers the judge got RIGHT (affirmed as two, and six). The judge hears the audio in-band and was correct every time; **the transcript is fiction.** 20 components build misconception evidence from that transcript. This run is the citation item 20 was waiting for.
- **19c-i. ⚡ THE FALLING-EDGE GATE, HALF-ABSORBED 2026-08-14 — pulled forward out of 19c by a live drive, uncommitted.** The user drove `subitize` and heard the flash land *"way too fast, before she finishes her statement"* on the item after a wrong answer (HUMAN-CHECKS #98, drive 5). **Root cause is the cue QUEUE, and it is generic:** `applyVerdict` queues the next item's cue and calls `openNext()` in one dispatch, but a queued cue waits for the floor — so the next item is on screen for the whole tail of the previous item's affirmation, and any "she spoke, then stopped" latch fills on the WRONG utterance. Drive 3 fixed the wall-clock version of this bug; this is the same defect through a different door, which is the argument for 19c as a whole. **Shipped:** `useJudgedScriptRunner` exposes **`cuedItemId`** (the item its most recently SENT cue is about — `onCue` `phase: 'sent'` covers both the queued path and `sendCueNow`, so the run opener lands too), and ten-frame's gate now requires `cuedItemId === item.id` **as well as** the falling edge. No tuned constant; a correction needs no special case. Gates: `typecheck:lumina` 0 · tsc **803 = exact baseline, 0 in touched files** · vitest **3053** · the new regression is **revert-bitten**. ⚠️ **UNHEARD — re-drive #98 before trusting it.** ➡️ **What 19c still owes:** the gate is still hand-written in the component (~10 lines), so the runner should own the whole *stimulus* stage as an option; and the exposure to the rest of the family is **measured, not assumed: `tutorSpeaking` has exactly ONE consumer in `primitives/` today — ten-frame.** So nothing else is bleeding right now; the risk is prospective, and it is the reason the fix went into the runner rather than the component. **The runner's docblock now says "never gate a stimulus on `tutorSpeaking` alone" at the definition site**, which is where the next pack will read it.
- **19c. RUNNER ABSORBS THE TWO COMPONENT-BUILT TIMERS** — falling-edge tutor-turn gate + stillness close as runner options (ten-frame's ~40 local lines + two documented footguns become the deletion test); joint with **18b** (reveal-on-affirm), already filed as the family's reveal contract. Executor: runner slice + ten-frame re-drive (#98).
- **19d. JUDGED STAGE FURNITURE ✅ SHIPPED 2026-08-13** — piloted on `letter-spotter`, then swept serially, one port at a time, each type-checked and suite-gated before the next. Machine gates: **typecheck:lumina 0 · full tsc 803 = exact baseline with 0 errors in any touched file · full vitest 3049 pass / 4 skipped (3043 + the 6 new panel tests) · di-script + judgedScript 435 pass**. Net **−299 lines across the fifteen port files**, against +137 (panel) +63 (helper) production and +93 test. **📍 Pre-measured anchors: [`HANDOFF-19d-judged-stage-furniture-2026-08-13.md`](HANDOFF-19d-judged-stage-furniture-2026-08-13.md).**
  - **`components/JudgedMicPanel.tsx` — 15 surfaces** (the 14 census ports + `read-aloud-studio`). It WRAPS `LuminaMicListener`, never replaces it. Two prop shapes: `run={runner}` for the eleven runner ports, plain props for the four pre-runner ones. `children` carries the two ports with a tap-to-hear button under the status line (decodable-reader, read-aloud-studio), and the `isSupported` probe that was copy-pasted in all fifteen files now lives in the panel.
  - **THE LABEL LIE WAS FOUR PORTS WIDE, NOT ONE.** The item named cvc-speller (`spell-word`); the sweep found the same claim on **letter-sound-link** (hear-see), **picture-vocabulary** (both tap modes) and **counting-board** (`subitize_perceptual`) — every one of them a hands item whose orb said *"I'm listening"* for an answer the bracket guarantees will never arrive. Each now names its own gesture (*"tap the letter / tap the picture / tap the hand / fill the boxes"*), and ten-frame keeps *"Show me on the frame"*. The default is letter-spotter's proven *"Your turn — tap it"*, so the panel inherited behavior instead of inventing it, exactly as the pilot choice intended. **Render change, un-heard — folded into the existing mic rows (`qa/HUMAN-CHECKS.md`, the second ➕ block), no new row.**
  - **`phaseResultsFromSummary` — 14 copies collapsed**, living in `hooks/usePhaseResults.ts` beside the click-path hook with a file docblock stating why they are not duplicates of each other (different input, different output shape; the judged path must never re-derive a score the tutor already gave). Only the display config varies per port. `read-aloud-studio` was correctly outside the census — it renders a bespoke per-line completion, not `PhaseSummaryPanel`, and was left alone.
  - **THE STATUS-LINE COUNT WAS WRONG IN BOTH DIRECTIONS — measured, as instructed.** Zero of the eleven blocks is wholly redundant (the item guessed ~4), but **41 individual LINES were byte-identical restatements of the runner's defaults** across ten packs. Deleted only exact matches; every near-match stayed, because a near-match is pack-owned pedagogy. `read-aloud-studio` was the one block with **nothing** to delete — all eight of its lines differ. Per pack: letter-sound-link 5, picture-vocabulary 5, rhyme-studio 5, ten-frame 5, di-spoken-practice 4, phoneme-explorer 4, letter-spotter 4, decodable-reader 3, counting-board 3, push-pull-arena 3.
  - **Runner API migration rode along in the seven components it opened** (not one was opened just to migrate it): `revealed` latches deleted in six ports — letter-spotter, decodable-reader, letter-sound-link, phoneme-explorer, picture-vocabulary, rhyme-studio, read-aloud-studio — each replaced by `runner.currentSolved`, which removes the `onItemOpened`/`onAffirmed` reset pair that had to be kept in step by hand. Tap gates moved to `runner.canAttempt` (letter-spotter, letter-sound-link, picture-vocabulary, counting-board, ten-frame), including ten-frame's four-clause hand-composed gate. **`isAwaitingGesture()` was deliberately KEPT alongside `canAttempt` at every commit site:** `canAttempt` closes the pending window through `stage`, which is batched React state, while the ref flips synchronously — dropping it would let a second tap in the same tick record a second confusion pair. That is a check the shared gate does not cover (trap 2: diff what the hand-rolled copy checked).
  - **phonics-blender's ledger field `blended` was renamed to `solved`** so its rows could go through the shared builder — same field, same values, its own verb kept as the argument name and in the celebration copy. This is FURNITURE, not its loop: the standing ruling that the pre-runner four stay off `useJudgedScriptRunner` is untouched.
  - **✅ DRIVEN 2026-08-13 (user, both surfaces): `ten-frame` and `letter-sound-link`** — all 19d checks passed, letter-sound-link across all three modes (16 items, six consecutive TAPPED items with the letters staying live, and one mid-run correction that recovered on the surface). The panel + the gate migration are user-confirmed on two surfaces; the other thirteen ride their existing mic rows.
  - **⚠️ THE DRIVE FOUND THE SAME LIE ONE SCREEN LATER — and it was the same four ports.** A six-item `hear-see` run (every answer a tap) closed with *"You worked on 6 letter sounds **with your own voice**!"*. The orb learned `answerKind` in this slice; the COMPLETION copy had not. `judgedAnswerMix(items)` now lives in `judgedScriptContract.ts` (pure, 3 tests pinning the tapped-run case that shipped) and the phrasing stays per-primitive because it is pedagogy — fixed in **letter-sound-link, picture-vocabulary, ten-frame, counting-board**, i.e. exactly the four ports whose orb was lying. **Lesson worth keeping: a modality claim is a leak surface wherever text asserts one — the orb was where we looked, not where it ended.** The new lines are un-seen; folded into the same mic rows.
  - Residual, deliberately not done here: **the five di-bench `direct-instruction/Di*.tsx` components still render the raw orb** (di-letter-sounds, di-math-facts, di-sentence-reading, di-shapes, di-word-reading) — same family, outside the 14-port census, and they adopt the panel with the same touch that takes their `"and stop, then wait again"` wording. **`read-aloud-studio` is the one judged surface with no `PhaseSummaryPanel`** — it hand-rolls a per-line ✅/🔁 completion block, which is the shape `[[feedback_honest-completion-summary]]` warns about; worth a look when that port is next opened, not a blind swap.
- **19e. GENERATOR DEAD-FIELD CLEANUP** — ten-frame buys `hint`/`narration` prose + `counters.positions`/`allowFlip` nothing reads; letter-spotter's prompt SELF-CONTRADICTS on name-it `options` (rules say emit 4, doctrine deleted the menu, pack forces `options: []`) and still teaches multi-target find-it while code rebuilds the grid deterministically (`letterGrid` can leave the schema); `strategyHint`/`targetCount` write-only; decodable `imageDescription` unrendered. Token waste per generation + actively misleads the next editor. Executor: per-generator slice, each with its live probe.
- **19f. SENTENCE-READING CONTRACT SINGLE-SOURCE** — the benched judging contract + verdict lines ("Yes, that says…" / "My turn: not …") exist in THREE hand-synced copies (diSentenceReading → decodable + read-aloud, both annotated "byte-for-byte"); export builders from the pack that benched them so the next sitting edits one place (the `MIN/MAX_SENTENCE_WORDS` import is the precedent half-done). Executor: direct edit.
- **19g. CUE ENVELOPE + CATALOG BUILDER** — `composeCue` typed slots (tag registry, quote-safe span, canonical never-perform tail; the "no cue template" doctrine is right about the SPOKEN line and over-extended to the envelope, where quote-safety and tag naming are structural not pedagogic) + `diTutoringDirectives` deriving the 5-part catalog frame from the pack, with a pack↔catalog tag-drift test (~17 hand-written blocks today, the seam the tutor actually consumes and the least verified). Design slice — after 19a so the gates catch the rewrite.
- **19h. THE JUDGED-LOOP TESTING STORY** (the "eval-test does not scale" answer).
  - **19h(i). ✅ SHIPPED 2026-08-14 (user ask: "extend /tutor-test coverage to DI modality… add text response so we don't need TTS") — `run_tutor_live.py --di` DRIVES THE JUDGED LOOP HEADLESSLY, AND THE JUDGE IS NOW MACHINE-TESTED.** Machine gates: `typecheck:lumina` 0 · full tsc **803 = exact baseline, 0 in any touched file** · full vitest **3125 pass** / 218 files · ten-frame di-script 38 pass · backend harness units 7 pass. **Driven live twice against `ten-frame`/`subitize` (7 items, real Gemini Live sessions).**
    - **THE USER'S TEXT-ANSWER CALL IS WHAT MADE IT CHEAP, and it is transport-legal, not a shim:** an untagged `{"type":"text"}` reaches Gemini through the same `send_realtime_input` floor a spoken answer does — `classify_cue` returns `"text"`, so it is not a cue and arms no mute window — and the judge grades it under the identical contract. **Verified live: 7/7 deliberate wrong answers REFUSED with "My turn:", 7/7 correct answers AFFIRMED with "Yes, N counters."** No TTS anywhere.
    - **NOTHING IS AUTHORED IN PYTHON.** `/api/lumina/tutor-test?…&di=1` (new `&di=1` mode) serializes the loop from the port's OWN script module — real `itemFromChallenge` gates, real `itemCue`, real judging contract, the runner's opening/how-to-play policy — and the harness replays it. Every other journey in that file re-types the component's templates by hand; this one cannot drift. New: `service/qa/di/diDrivePlan.ts` (adapters + plan), `judgedScriptContract.JudgedCueSurface` (the wire half of a pack), `tenFramePackBase` + `tenFrameHarnessAnswers` (exported; **TenFrame.tsx now spreads the surface, and the di-script suite's hand-retyped pack fixture is deleted in favour of it** — that fixture could have passed every gate while production sent something else).
    - **IT REPRODUCED BOTH OPEN 18c DEFECTS ON THE FIRST CAP DRILL — machine-side, for the first time.** `--di-cap` drills one item past the corrections cap: `di-correction-verbatim-repeat` fired at wrong2 and wrong3 (the same 20-word correction three times — **18c(c)**, previously only a human sitting could see it), and `di-capped-item-asks-then-withdraws` fired at wrong3 (correction ends *"Your turn. How many counters did you see?"*, then `TF_MOVE` — **18c(b)** exactly as the human drive logged it). Both were user-confirmed defects, so this is corroboration of a known-true finding, which is the right way to trust a new instrument.
    - **⭐ AND IT FOUND A NEW CLASS NO DRIVE HAD FILED: `di-verdict-embellished` — the tutor appends improvised speech to a `say exactly` line, on 5 of 7 affirmations, 26–37 added words.** The scripted line always survived at 100% overlap, which is why recall-only checks (and human ears) let it through: nothing is *missing*, something is *added*. It matters because the addition is not benign — on run 1 it produced **"You're all done with this part!" at item 4 of 7 and again at item 6 of 7**, i.e. the tutor telling a five-year-old the work is over with three items still queued (now its own HIGH oracle, `di-false-completion-claim`). `say exactly` is the entire mechanism by which a DI pack controls what a child hears. **NOT FIXED — its own slice; the fix is prompt-layer (layer 2/3 in the `/tutor-test` triage), not pack copy, since every pack's affirm line is equally exposed.**
    - **Scope, honestly:** ONE adapter (`ten-frame`) — pilot-then-sweep, and the adapter is the whole per-port cost now that the machinery is generic. **The other ~13 ports have no adapter yet** (19h-i-b below). And a green `--di` run **does not close a mic row**: it holds the semantic half (refusal, affirmation, leak, sentinel, cue compliance) and says nothing about acoustics, ASR, mic transport, VAD or the audio tail — stated at the top of `diDrivePlan.ts`, in the journey docblock, and in both skills so the next reader cannot mistake it.
    - Also folded in: the plan runs `checkPackGates` over a pack built from LIVE generated content and reports it, so **step-7.3's sentinel-scan-over-generated-words now re-runs on every drive** instead of once behind a deleted file — that is most of 19h(ii) for any port with an adapter.
  - **19h-i-a. ✅ FIXED 2026-08-14 (the cap drill's own finding, user report: "tutor is saying system instructions") — THE TRANSPORT WAS NARRATING THE `[CURRENT STATE]` BLOCK, ANSWER INCLUDED, AND IT WAS PRODUCTION-REAL.** The cap-drill run filed 12 HIGHs that were ONE mechanism: every cue that arrived with the state block prepended (`PrimitiveState.attach`, fired because the runner's per-item `updateContext` had changed the state) was NARRATED — *"[CURRENT STATE]: The user has moved to the next item… The target answer for this new item is 'four'"* — **spoken to the child, target answer first, before the scripted ask.** 6/6 state-attached cues echoed; 0/2 clean cues did. The prompt already forbade it (`_CONTEXT_MESSAGES_BLOCK`: "Never read it aloud") and lost — same family as the fabricated-`[LSP_TAP]` class, and per standing doctrine the fix is TRANSPORT, not prompt: **`sendText(cue, { scripted: true })`** — the runner's three cue sends and the harness's `text_msg(cue, scripted=True)` both declare it — rides the wire to **`TextQueueEntry.scripted`**, and the floor gate skips the attach when every entry in the batch is scripted. Per-message like `interrupt`, because only the caller knows; a judged cue carries its own state by construction, an improvising primitive's cue keeps the channel (nothing else changes — the state stays pending for the next unscripted floor-giving message). The pre-fix `di-answer-leak-in-ask` HIGHs were echo fallout, not pack leaks — the leak WAS the narrated state block. **Gates:** 4 new backend units (46 pass) · typecheck:lumina 0 · tsc 0 in touched files · re-drive below. **Regression guards, permanent:** `di-tag-spoken` + `di-answer-leak-in-ask` (if both fire on ask/moveon beats, check `state_attached` in the session ledger — must stay 0 on a judged run). **Also this slice: the report clusters findings per MECHANISM** (one row per check with the beat list; verdict counts mechanisms with instances in parentheses) — 16 rows became 4 on the same evidence, and a real cross-cutting bug now reads as one fix instead of harness noise. Pre-fix evidence preserved: `qa/tutor-reports/ten-frame-live-di-plain-2026-08-14-pre-scripted-fix.md`. *The residual WARNs in that report all have homes already: verbatim-repeat correction + capped-item-asks-then-withdraws = 18c (family-wide), affirm-tail embellishment = 19h-i-c.* **✅ RE-DRIVEN 2026-08-14, 2 runs: PASS with warnings — 0 HIGH confirmed, every ask/moveon beat clean of the state block, judge 13/13 wrong REFUSED / 12/12 right AFFIRMED** (the one dash was the resume narration below, not a judging miss); the only confirmed finding is 18c(c)'s verbatim repeat, exactly where it was already filed.
  - **19h-i-e. QUEUED — THE RESUME RE-SEED NARRATES TOO (the same class on a rarer channel).** Run 1 of the verification drive hit a real Gemini drop mid-cap-drill and on the transparent resume the tutor spoke **"[STUDENT CONTEXT] Current attempt: 2 / Hints used: 0 [CURRENT STATE] challengeType: subitize … correctAns…"** — that text is the SYSTEM PROMPT's student-context section (`lumina_tutor.py` ~666), i.e. the model narrated its own instructions once, right after `session_resumed`, and opened with neither sentinel (the runner's resync is what un-stalls it). 1/2 runs, only under a real connection drop → note, not confirmed; **probe before code** with the committed fault injection (`LUMINA_FAULT_DROP_S` drives exactly this path) and look at what text the resume seeds and why the model treats it as speakable. Evidence: `qa/tutor-reports/ten-frame-live-di-plain-2026-08-14.md` run 1 `wrong3:c1`. Executor: probe, then a transport slice in the resume path.
  - **19h-i-b. QUEUED — SWEEP THE ADAPTERS.** One `DiPortAdapter` per remaining runner port; each needs its script module to export a cue surface (`<primitive>PackBase`, spread by the component) and its answer material including the **signature wrong** its `discriminationFor` clause claims to refuse. Serial, one port at a time, each with a `--di` drive. Executor: `/tutor-test --di` per port.
  - **19h-i-c. QUEUED — `di-verdict-embellished` / `di-false-completion-claim`.** Measure across ports first (is it ten-frame's affirm-tail shape or family-wide?), then fix at the prompt layer. **Probe before code.**
  - **19h(ii). MOSTLY ABSORBED** by the plan endpoint's live `checkPackGates` (above) for ports with an adapter; the committed env-gated generator probes (`gemini-letter-spotter.live.test.ts` pattern) are still owed for ports without one.
  - **19h(iii). QUEUED —** the §1 census greps become a vitest rule over every component importing `useJudgedScriptRunner` (two shipped ports already violate the comment clause). Executor: direct edit.
- *(19-adjacent, already filed: 18a `numberWordFor` ×3 — fold into 19f's barrel if convenient; 18b rides 19c.)*

### 18. 🔢 **P1 SHIPPED 2026-08-13 + DRIVEN (6/6 refusals) · P2 `addition-subtraction-scene` SHIPPED 2026-08-14 · `number-bond` SHIPPED 2026-08-14 (the P3-correction port) · P3 (#63) = THE REMAINING GATE — THE DI MODALITY ON MATH PRIMITIVES (user thread 2026-08-12: *"would there be value adding /add-di-loop to any of those? for example ten frame… addition subtraction scene may benefit from speaking aloud instead of typing"*)**

> #### ✅ 2026-08-14 — `number-bond` IS ON THE JUDGED LOOP (all four eval modes; the port the P3-correction block below authorized). Third math port; first to ship WITH its `DiPortAdapter` in the same slice, per 19h-i-b.
>
> **The fork as shipped** — one spoken, three built, one expansion:
> `missing_part` → **SPOKEN** (`number_word_to_20`; answers 1..9 by construction — whole ≤ 10, part
> 1..whole−1; the −/+ stepper and its Check button were the costume: a 0…max row is a weak MENU) ·
> `decompose` → **built**, and **EXPANDED: one challenge → one judged turn per pair** ("Make five
> with two parts." → "Find a different way…" → "Find the last way…"), the same one-pair-at-a-time
> pacing the click era ran through Submit Pair, with the verdict now judging sum AND novelty (a
> repeated pair is the mode's signature error, corrected not ignored) — precedent: decodable-reader's
> per-sentence split · `fact_family` → **built** (writing the four equations is FORM; the four boxes
> are the page; the Check button became a stillness close over TYPED input — a first for the family) ·
> `build_equation` → **built** (ASS's identical fork, consumed not re-derived). βs HELD ×4, rationale
> in the catalog comments (`missing_part` rides ASS's solve-story precedent: weak menu → speech, β
> per mode).
>
> **Files:** `math/numberBondScript.ts` (NEW — pack, build gates, code-computed verdicts, harness
> answers, `numberBondPackBase`) · `math/NumberBond.tsx` (whole-file rewrite) ·
> `service/math/gemini-number-bond.ts` (imports `isValidBondPart` from the script — ONE predicate on
> both sides of the wire; fixed `part1 = 0` surviving `?? `-fallbacks in three modes; decompose
> count 5 → 3, see residuals) · `catalog/math.ts` (DI frame, `audioInput`, contextKeys
> `['challengeType','stimulus']`) · `service/qa/di/diDrivePlan.ts` (adapter) ·
> `__tests__/NumberBond.di-script.test.ts` (NEW, 37 tests incl. the real-session-shape pack).
> **Deleted:** the missing-part stepper + Check, Check Fact Family, Check Equation, the Next control,
> the ≥2-attempt hint panel, the feedback strings that printed the answer, the old tutor hook and all
> improvised turns, the per-tier reveal clauses that governed them (render tier levers survive).
> No contract file existed (`docs/contracts/` has no number-bond entry), so no `--check` gate ran.
>
> **⭐ THE FINDING — THE CATALOG'S SCAFFOLDING LADDER IS A NO-VERDICT CHANNEL, AND ONLY A CAP DRILL
> SEES IT.** First cap drill: on the SECOND identical wrong answer the model balked at repeating the
> byte-identical scripted correction (18c) and recited the ladder's quoted hints instead — *"Think
> about the two parts that make the whole…"*, *"Take your time…"* — lines opening with NEITHER
> sentinel, so the engine saw no verdict and the correction counter stalled (2× CONFIRMED HIGH
> `di-no-verdict`). The ladder had handed the model sanctioned-sounding replacement lines for exactly
> the moment 18c makes it want one. **Fixed on both surfaces** (ladder now commands script fidelity
> and OFFERS no speakable line; the cue's correction clause now says "the SAME line on every wrong
> answer"), **re-driven clean** (cap drill: 3/3 byte-identical corrections, verdicts flow, move-on
> fires), and **pinned** (revert-biting test). **→ QUEUED as 18d below: the class is family-wide.**
>
> **Two answer-leak catches writing the ask surfaced** (same class, opposite sides): *"has TWO
> parts"* would speak the answer whenever whole − part = 2, and the context channel's *"one part
> shown"* whenever it = 1 — both re-worded, and `leakTokens` knows "one" is always-public ("One part
> is…") and the symmetric bond (6 = 3 + 3) legitimately states its answer as the known part.
>
> **Gates:** `typecheck:lumina` **0** · full `tsc` **803 = exact baseline, 0 in touched files** ·
> census greps **0 + 0** · own suite **37/37** · oracle suite **10/10 (untouched semantics)** · full
> vitest **3201 passed / 4 skipped / 0 failed** (the 1 error is the known solar-system-explorer
> confetti teardown, already filed) · **live 6-probe pipeline run, deleted after** — both bands ×
> both K modes + the two G1 modes — **30/30 challenges kept, ZERO drops**, `checkPackGates` clean on
> live content. Drawn values:
> > `missing_part@K(3=1+2, 4=2+2, 5=3+2, 4=1+3, 5=2+3)` · `missing_part@1(4=1+3, 6=2+4, 7=4+3,
> > 8=3+5, 10=6+4)` · `decompose@K(w=2,3,4,5,3 → 12 items)` · `decompose@1(w=6,7,8,9,10 → 24 items)` ·
> > `fact_family@1(4=1+3, 6=2+4, 7=3+4, 8=3+5, 10=4+6)` · `build_equation@1(5=2+3, 6=4+2, 7=3+4,
> > 8=5+3, 10=6+4)`.
> · **Headless judged drives** (`qa/tutor-reports/number-bond-live-di-{plain,signature}-2026-08-14.md`):
> `missing_part` ×3 runs **15/15 wrong answers refused, 15/15 right affirmed** · **signature drive
> 5/5** — the WHOLE said back was refused every time, the exact discrimination claim ·
> **cap drill clean after the 18d fix** (residual WARNs = 18c(b)+(c), inherited family-wide by
> construction, same as P2) · `build_equation` gesture drive: **hands-hold beats SILENT (0 audio
> bytes — the bracket held), 5/5 code-computed verdict lines spoken exactly**.
>
> **NO MIC ROW FILED, standing rule applied:** `number_word_to_20` and `manipulation` are proven
> classes; the count-up accept clause and whole-echo refusal are machine-proven above. **Knowingly
> carried:** the three settle closes are hand-tuned by ear (3s split / 6s typing / 4.5s tray, short
> structural forms 1.2–2s) and typing is a NEW commit surface for the family — same class as ASS's
> settle residual, priced only by a child's hands; 19c is where they stop being per-component
> constants. The decompose novelty verdict and the fact-family typed close have machine + cue-
> compliance evidence only — no browser run of the three closes yet ("should work — needs a browser
> check on the decompose/fact-family/build-equation closes").
>
> **RESIDUALS (filed, not fixed):** decompose sessions were 24 judged turns at G1 off 5 challenges —
> `COUNT_BY_MODE.decompose` cut to 3 in this slice (manifest override still wins); if a manifest
> pins 5+ the session runs long again — watch it. One `di-correction-verbatim-repeat` WARN pair per
> capped item is 18c(c) surfacing on every port now that cap drills exist; the fix is the runner
> knowing the final attempt (18c), not per-port wording.
>
> #### 18d. 🔴 QUEUED — SWEEP: every judged port's catalog `scaffoldingLevels`/`commonStruggles` that OFFERS a quoted replacement line is a no-verdict stall waiting for its cap drill
>
> The number-bond cap drill proved the mechanism (block above). ASS's ladder carries the same shape
> (*"Think about what happened in the story"*), and any port whose catalog quotes a speakable hint
> is suspect — the pre-runner four included. **Executor: targeted catalog edits on the letter-spotter
> pattern above + a `--di-cap` re-drive per port with an adapter (cheap since 19h-i-b); ports without
> adapters get the edit + their existing catalog sentinel scan.** Not fixed inline here because it
> touches ~14 catalog entries across two subject files while item 16's Phase-1 ports are actively
> editing the same literacy catalog — a sweep mid-collision would clobber a concurrent session.

> #### ✅ 2026-08-14 — P2 SHIPPED: `addition-subtraction-scene` IS ON THE JUDGED LOOP (all four eval modes). The user's second example, and the taxonomy's purest Class-A case.
>
> **THE GATE THIS ITEM CARRIED IS CLEARED, NOT BROKEN.** This item said *"P2 does not move until
> #98 is heard"*, and when the user asked to start the port that still read as a live gate. It was
> not: the ten-frame drive landed the same day at **6/6 deliberate wrong answers refused, 6/6
> correct affirmed** (session `e8093c77308e`), and the user then closed the whole mic sitting
> (`qa/HUMAN-CHECKS.md`, 2026-08-14: *"lets just trust the tutor works"*). Pilot-then-sweep was
> satisfied by the pilot's own drive. **P2 shipped on the new standing rule — machine gates + a
> live generation probe — and filed NO mic row**, because it introduces no new response class, no
> new answer material and no new stimulus mechanism: `number_word_to_20` and `manipulation` were
> both proven on ten-frame, and the falling-edge + `cuedItemId` stimulus gate is 19c-i's, consumed
> not re-invented. *(Recording the reasoning so a later session does not read the absent row as an
> omission.)*
>
> **Files:** `math/additionSubtractionSceneScript.ts` (NEW, the hand-authored pack) ·
> `math/AdditionSubtractionScene.tsx` (whole-file rewrite) ·
> `service/math/gemini-addition-subtraction-scene.ts` · `catalog/math.ts` ·
> `__tests__/AdditionSubtractionScene.di-script.test.ts` (NEW, 55 tests) ·
> `__tests__/AdditionSubtractionScene.reader-fit.test.tsx` (re-based onto the new surface, 24
> tests) · `docs/contracts/addition-subtraction-scene.md`.
>
> **The fork as shipped** — two spoken, three enacted, one band-split:
> `solve_story` (K + 1) → **spoken** · `act_out` @1 → **spoken** (enact the departure, then say
> the count) · `act_out` @K → **enacted**, contract R3 untouched · `build_equation` → **built** ·
> `create_story` (both bands) → **built**.
>
> **Deleted:** both numeric keyboards, the K `NumberTileRow`, `handleCheckAnswer` and all four
> per-mode checkers, the Check control, the Next control, the feedback card that named the target,
> the G1 scene+object picker, the old tutor hook and all fourteen of its improvised turns. Census
> greps: 0 (the first pass returned 1 — my own docblock naming the deleted hook; comments count).
>
> **⭐ THE FINDING — A MODE THAT COULD NOT PRODUCE A WRONG ANSWER, AND HOW OFTEN THAT SHAPE HIDES.**
> Ten-frame's `make_ten`@K taught us the frame-full auto-judge was a Check button that presses
> itself. This primitive had **three** of them: `act_out`@K and `create_story` both auto-judged the
> instant the enacted count MATCHED, and G1 `create_story` was worse — `const correct = true`, it
> accepted **any** scene+object selection. So a whole eval mode had been shipping evidence to IRT
> that measured nothing at one band. The stillness close makes the first two judgeable; the third
> was deleted and G1 given K's construction. **Generalisable smell: search Class-B primitives for a
> commit that fires on a MATCH — it is not a close, it is a correctness gate wearing one.**
>
> **⭐ THE NEW CLOSE SHAPE: STRUCTURAL, BUT NOT ON THE KEYSTROKE.** The equation tray has a
> terminal shape that stillness alone handles badly (a number sentence is five deliberate taps and
> a mid-build pause is normal). A finished sentence `N op N = N` therefore SHORTENS the window to
> 1.2s rather than committing immediately — because `3 + 2 = 1` is a complete sentence on its way
> to becoming `3 + 2 = 10`. Still not correctness-gated: `4 + 2 = 9` commits exactly as readily as
> `4 + 2 = 6`, and the verdict cue names WHICH of three faults happened (arithmetic / operator /
> wrong numbers) rather than issuing one generic correction for three different misconceptions.
>
> **⭐ WRITING THE SPOKEN ASK AUDITED THE CONTENT — TWICE, AND ONE IS A NEW GATE CLASS.**
> (1) **The story now has to earn being read aloud.** Generated `storyText` sometimes ends with its
> own question, and that question may not be the one this item's `unknownPosition` is about — a
> story asking *"how many now?"* under a start-unknown item is a straight-up wrong ask. So
> `situationOf` strips every interrogative sentence and the pack asks its own question, code-owned
> per band and per unknown. (2) **A story that STATES the value the child must produce hands the
> answer over in the tutor's own voice** — invisible under a Check button, fatal spoken.
> `storyLeaksAnswer` drops it, and it is precise: a value that is also a publicly stated operand is
> NOT a leak (4 − 2 = 2 legitimately prints "2" as the change). Both gates run on both sides of the
> wire, IMPORTED from the script module — letter-spotter's two hand-synced copies disagreeing live
> is the reason. Prompt-side rules were added to match, and they held on every live draw.
> **Also caught:** the `create-story` fallback's `objectType` was `'chickens'`, which is not in
> `VALID_OBJECT_TYPES`, so the scene drew ⭐ for it — harmless while nobody said the word, and a
> tutor saying *"make that story with the chickens"* over a picture of stars the moment it ships.
>
> **Gates:** `typecheck:lumina` **0** · full project `tsc` **803 = exact baseline, 0 errors in any
> touched file** · census greps **0** · own suites **79/79** (55 di-script + 24 stage) · **full
> vitest 3120 passed / 4 skipped / 0 failed** *(the one unhandled error is the known
> `canvas-confetti` rAF-after-teardown in solar-system-explorer, filed on WORKSTREAMS)* ·
> the `cuedItemId` stimulus gate is **revert-bitten** (removing it fails exactly the drive-5
> regression and nothing else).
> · **live 6-run pipeline probe, deleted after the run** — act_out@K, solve_story@K,
> create_story@K, act_out@1, solve_story@1, build_equation@1 — **40/40 items kept, ZERO drops**,
> `checkPackGates` clean over live content. The new prompt rules held on all 40: no story ended
> with a question, and no story stated its hidden value, including the change/start unknowns
> (*"3 ducks were swimming in the pond. Some more joined them, and now there are 5 ducks"* —
> change = 2, never spoken). Drawn values:
> > `act_out@K(2+1, 1+2, 2+2, 1+3, 4+1, 3+2)` · `solve_story@K(5−1, 4−2, 3−1, 5−3, 4−3, 5−4)` ·
> > `create_story@K(2+1, 3−1, 1+3, 4−2, 2+2, 3+2, 5−3)` · `act_out@1(5−2, 6−3, 7−4, 8−5, 9−4, 10−6)` ·
> > `solve_story@1(3+?=5 change, ?−3=4 start, 6−2 result, ?+4=9 start, 4+?=8 change, 10−?=6 change,
> > ?−3=5 start)` · `build_equation@1(3+2, 4+3, 6−2, 8−4, 5+3, 7−5, 4+5, 6+4)`.
>
> **βs HELD on all four modes, and `solve_story` is the one worth recording.** At Grade 1 nothing
> changed (typed numeral → spoken numeral, same production). At **K** a 0…max numeral row became
> unaided speech, which IS a structural change — but β is per MODE, not per band, and raising it
> would misprice every Grade-1 item to reprice the K half. The K menu was also a weak one (every
> numeral in range, no chosen distractors), so the guess floor it removed is smaller than the
> letter-spotter menu that moved 1.5 → 2.0. `create_story`'s G1 fix raises what the mode MEASURES
> from nothing to something — a validity fix, not a difficulty change.
>
> **INHERITED, NOT INTRODUCED — this pack has both of item 18c's authored defects by
> construction, and neither is fixable inside a port:** (b) every correction ends by re-asking, so
> a capped item asks and is withdrawn 0.9s later — the fix needs the contract to KNOW it is the
> final attempt, which is a runner change; (c) the correction is byte-identical across both
> attempts, and `findRepeatedConsecutiveAsks` does not scan correction spans. **18c should be read
> as family-wide now, not ten-frame's.**
>
> **RESIDUALS (filed, not fixed):**
> - **The settle windows are hand-tuned by ear** (3s scene, 4.5s tray, 1.2s finished sentence) and
>   only a child's hands can price them. Same class as the window drive 3 deleted from ten-frame;
>   19c is where they stop being per-component constants.
> - **One live draw wobbled its noun** — *"4 puppies are playing… Some more dogs run over… now
>   there are 8 dogs"* under `objectType: dogs`. Not a leak and not gated; the tutor says "dogs"
>   while the story opens on "puppies". Prompt-side if it recurs.
> - **`act_out`@1 is the family's first item where the hands do work that is NOT the answer** (the
>   child enacts the departure, then speaks the count). It rides the existing contract, but no
>   drive has heard a child do both halves in one turn.

> **CENSUS (measured 2026-08-12, 61 math primitives, same import/call-level method as the
> corrected literacy census):**
>
> | | count | note |
> |---|---|---|
> | on the DI judged loop | **1** | `counting-board` only — the 2026-08-10 runner pilot, **still undriven (#86)** |
> | interim voice hooks | **0** | math has NEVER had a spoken channel |
> | typed numeric answer (`type="number"` / `inputMode="numeric"`) | **21** | the child types a number |
> | on-screen Check button | **42** | an explicit commit that is not the tutor's verdict |
>
> **The clock question that organised the literacy census does not discriminate here — math is
> uniformly click-to-advance.** 42 of 61 have a Check button; that is math's structural
> equivalent of literacy's advance timer, and it is nearly universal. So the useful axis for
> math is not *what owns the clock* but **what the answer is MADE OF.**
>
> #### ⭐ THE STRATEGIC FINDING — THE LITERACY PLAYBOOK DOES NOT TRANSFER, AND THE USER'S INSTINCT IS THE REASON
>
> In literacy the move was **CONVERSION**: phoneme-explorer's 4-choice grids "died as
> costumes" because the skill was verbal and the clicking was a stand-in for a mouth.
> **In math the manipulative is frequently the pedagogy itself** — ten-frame's make-ten,
> base-ten regrouping, fraction-bar partitioning. Converting those to speech would ABLATE the
> skill, not modernise it.
>
> **So math's move is predominantly to ADD a task identity, not replace one** — which is
> exactly what the user proposed (*"maybe we have a NEW modality"*). That is also the
> doctrinally correct call: eval modes are TASK IDENTITIES, and the contract system says fork
> (eval-mode split) rather than edit in place over a conflict. **Record this as the lane's
> governing rule so no session ports math the way it ported literacy.**
>
> #### 🎯 PILOT = `ten-frame`, AND IT IS CHEAPER THAN PROPOSED — TWO OF ITS MODES ALREADY EXIST
>
> The user's framing was *"right now the full modality is student clicks the frame, maybe we
> have a new modality… the DI loop asks how many are filled in?"* — **that mode is already
> built.** `ten-frame` has four eval modes (`build`, `subitize`, `make_ten`, `operate`), and
> `subitize` + `make_ten` are already NON-manipulative: the child reports a NUMBER using
> **+/- stepper buttons and a Check button** (`subitizeInput`, `makeTenInput`,
> `handleCheckAnswer`). **So this is not a new eval mode at all — it is a modality swap on two
> existing ones**, and the stepper is the costume.
>
> **The split, which is the same shape letter-sound-link and rhyme-studio already shipped:**
> - `subitize` → **SPEAK** the count. Flash the frame, the tutor asks, the child says it.
> - `make_ten` → **SPEAK** how many more. Answer 1-10, comfortably benched.
> - `build` → **STAYS GESTURAL**, judged. Placing counters IS the pedagogy; use the proven
>   gesture anchor (`submitGestureAttempt`, cvc-speller's build judge, live-verified).
> - `operate` → decide at port time; likely gestural work + a spoken answer.
>
> Two verbal, one gestural, one hybrid — an exact structural rhyme with port 7. `/add-di-loop`
> is the executor and no bench is needed **if the content gate below holds.**
>
> #### 🚧 THE HARD GATE THAT BOUNDS ALL OF MATH — THE SPOKEN-NUMBER CEILING IS 20
>
> Already formalised in `countingBoardScript.ts:90` and it is the single most important
> constraint on this lane:
> - `number_word_to_20` — **BENCHED** ✅
> - `number_word_to_120` — **BUILD-AHEAD, NOT ACCEPTED: "#63 acceptance owed"** ❌
> - **ZERO is UNBENCHED** ("zero"/"none", di-shapes rung 2 residual) — counting items floor at 1.
>
> **Consequences, and they are not cosmetic:**
> - `ten-frame` `subitize` runs 0-10 (single) / 0-20 (double) — **in range, EXCEPT the empty
>   frame is a legitimate item and its answer is "zero".** Floor items at 1 or bench zero.
>   Same trap on any subtraction whose answer is 0.
> - `addition-subtraction-scene` — ✅ at K-1 (within 20), ❌ at G2+ (within 100).
> - `coin-counter` (cents to 100), `area-model` / `array-grid` (products), `skip-counting-runner`
>   (counts past 20) — **all blocked on #63**, which is an unaccepted human row, not a code task.
>
> **→ #63 is worth more to math than any single port.** Accepting it converts the whole
> ">20" tier from blocked to available. Price it as lane-unblocking, not as one row.
>
> #### THE TAXONOMY — apply before touching anything
> - **Class A — the answer is a NUMBER the child reports** (typed input or stepper + Check).
>   Convert the ANSWER modality, keep the visual. Cheapest, highest volume, bounded by ≤20.
>   *ten-frame subitize/make_ten · addition-subtraction-scene (K-1) · number-bond · ordinal-line.*
> - **Class B — the answer is a MANIPULATION the child performs.** Keep gestural; the tutor
>   judges the committed state via the gesture anchor. **Never convert to speech.**
>   *ten-frame build · base-ten-blocks · fraction-bar · balance-scale · sorting-station.*
> - **Class C — the answer is a SELECTION from printed options.** Apply the literacy test: is
>   the field a costume, or is it the answer space? Verbal if sayable, tapped if the options
>   carry the discrimination.
> - **Class D — 🚫 DI DOES NOT FIT.** Open-ended sandboxes with no single short answer:
>   *parameter-explorer · function-sketch · transformation-lab · coordinate-graph ·
>   systems-equations-visualizer.* Assert the bucket so nobody re-derives it as a gap.
>
> #### 📄 BRIEF FOR P1: `qa/HANDOFF-di-ten-frame-2026-08-12.md`
>
> **⚠️ IT CARRIES A CORRECTION TO THIS ITEM'S OWN PLAN.** `/primitive-contract ten-frame --check`
> found **R6 (the file's only REQUIRED requirement): `make_ten` @ K is ALREADY direct
> manipulation — seeded counters, tap to fill, auto-judged, no stepper and no Check button** —
> created deliberately by reader-fit item 12 under the standing direct-manipulation-first
> ruling. **The line above saying "`make_ten` → SPEAK how many more" is WRONG at K and must
> not be built**; converting it would reverse a user ruling. Corrected fork: `subitize` verbal
> (all bands) · `make_ten` verbal at **1–2 only**, untouched at K · `build` + `make_ten`@K stay
> gestural with a judged verdict · `operate` verbal, band-gated ≤20.
> **Carry the generalisation:** in literacy the click was usually a costume; in math the
> manipulative is often the skill — **read the contract before assuming a stepper is a costume,
> because sometimes it was already deleted for a better reason than yours.**
>
> #### PHASING
> - **P0** — drive **#86** (`counting-board`). Math's ONLY existing DI surface has never been
>   heard, and every plan below inherits its engine and its number-word handling.
> - **P1** — **`ten-frame` pilot** via `/add-di-loop`, per the brief above. Ten-frame tops out
>   at 20, so it fits ENTIRELY inside the benched range — a reason it is the right pilot.
>   Floor spoken answers at 1 (the zero gate). Pilot-then-sweep — no math sweep before this is
>   driven at runtime.
> - **P2** — ~~`addition-subtraction-scene`, **band-gated to within-20**, replacing the typed
>   input with the mouth. This is the user's second example and the purest Class-A case.~~
>   **✅ SHIPPED 2026-08-14 — see the block above. No band gate was needed:** this primitive tops
>   out at `maxNumber` 5 (K) / 10 (G1) and has no G2+ tier at all, so it sits entirely inside the
>   benched range. The line above was more cautious than the primitive is.
> - **P3** — accept **#63** (or re-bench) to unlock the >20 tier; that is the gate on
>   coin-counter, area-model, array-grid, skip-counting-runner and most of G2+. **NOW THE TOP OF
>   THIS ITEM.** ~~Both ports that could ship without it have shipped, so every remaining Class-A
>   candidate is behind this one acceptance~~ — price it as lane-unblocking, not as one row.
>   **⚠️ CORRECTED `/pm` 2026-08-14: `number-bond` is NOT behind #63.** Its `maxNumber` is
>   **5 (K) / 10 (G1)** (`gemini-number-bond.ts:318`) — entirely inside the benched ≤20 range,
>   the same over-caution this item's own P2 line had ("more cautious than the primitive is").
>   Fork on the P2 pattern: `missing_part` → **spoken** (the generator already forbids
>   trivially-0 parts, so the zero gate holds) · `decompose` / `fact_family` / `build_equation`
>   → stay **built** (finding all pairs / writing equations / dragging tiles IS the pedagogy).
>   Ships on the standing rule — machine gates + live generation probe + a `--di` drive (export
>   the cue surface + `DiPortAdapter` in the port, per 19h-i-b). Executor: `/add-di-loop`.
>   **✅ EXECUTED 2026-08-14 — see the `number-bond` block at the top of this item.** The fork
>   shipped exactly as scoped here, plus one expansion the scoping missed: decompose's
>   find-all-pairs shape becomes one judged turn per pair.
>   `ordinal-line` stays gated — not by #63 but by RESPONSE CLASS (ordinal words are unbenched;
>   `identify` is a tap anyway) — do not read this correction as unblocking it.
> - **P4** — Class-A sweep within the newly benched range, serial.
>
> #### ⚠️ Also found: `numberWordFor` now exists in TWO copies
> `diSpokenPracticeScript.ts` (1-20, no hyphenation) and `countingBoardScript.ts` (1-30, with
> `twenty-three`). A math port would make three — **the same triplication pattern flagged for
> insets in item 17.** Extract on the ten-frame port, not after.

---

#### ✅ 2026-08-13 — P1 SHIPPED: `ten-frame` IS ON THE JUDGED LOOP (all four eval modes). Mic row **#98**.

**The pilot the math sweep is gated on is built and machine-green. It is NOT verified — only a
mic run proves the loop, and #98 has never been driven.**

**User ruling taken at the top of the slice (handoff §8.2 was left open):** ship the FULL port,
all four modes, not the two spoken ones. The reason is structural, not ambition — the runner owns
the item list for the whole run, so a half-port means two progression systems in one file (a Check
button for `build` beside a judged loop for `subitize`). Doing it once was smaller than doing it
twice. §8.1 took its own recommendation (band-gate `operate` to within-20); §8.3 is filed below,
not fixed.

**Files:** `math/tenFrameScript.ts` (NEW, the hand-authored pack) · `math/TenFrame.tsx` (whole-file
rewrite) · `service/math/gemini-ten-frame.ts` · `catalog/math.ts` · `__tests__/TenFrame.di-script.test.ts`
(NEW, 29 tests) · `__tests__/TenFrame.reader-fit.test.tsx` (re-based onto the new surface, 11 tests)
· `docs/contracts/ten-frame.md`.

**The fork as shipped** — two verbal, two gestural-but-judged, one band-split, exactly as the brief
scoped it: `subitize` → spoken · `make_ten`@K → **enacted, R6 untouched** · `make_ten`@1-2 → spoken
· `build` → enacted · `operate` → spoken, ≤20.

**Deleted:** both -/+ steppers, `handleCheckAnswer`, the Next control, the hint ladder, the feedback
card that named the target, `useLuminaAI` and all nine of its `sendText` calls. Census greps: 0.

**⭐ THE FINDING — HOW A HANDS-ONLY TURN CLOSES, WHICH THE FAMILY HAD NO ANSWER FOR.**
The two gesture precedents both had a *structural* commit: cvc-speller's third letter fills the
last slot, counting-board's hand tap IS the whole answer. **`build` has neither — a frame of ten
cells with a target of five has no terminal state**, and the only correctness-free commit signals
available were a button (deleted by doctrine) or the child's voice (unbenched). So this port
introduced one: **a hands turn closes on STILLNESS, the exact analogue of the mic's silence
bracket** (`PLACEMENT_SETTLE_MS`, 3s). A voice turn ends when the child stops talking; a hands turn
ends when they stop touching. It is not correctness-gated — a wrong placement commits exactly as
readily as a right one, which is the property the Check button used to fake.
**This generalises to every Class-B primitive in the taxonomy** (base-ten-blocks, fraction-bar,
balance-scale, sorting-station), all of which have the same no-terminal-state problem. **Carry it.**
**It also made `make_ten`@K judgeable for the first time:** R6's frame-full auto-judge could only
ever produce a correct answer, so stopping early was unreachable. Stillness makes stopping early a
wrong answer the tutor corrects — a strict addition to R6, not a reversal.

**⭐ THE LEAK THAT WAS PIXELS, NOT STRINGS — and it was live in the click era.**
Every shipped leak gate in this family scans TEXT. On `add`/`subtract` the running-count readout
prints `filledCells.size`, which after the child places both addends **equals the sum they are
about to say out loud**. Harmless when a Check button graded the frame; a straight answer leak the
moment the answer became spoken. Withdrawn on those two modes, kept on `build`/`make_ten` where it
is the child's own trace (R3/R7). Same class of fix: the empty-space readout is **no longer
rendered at all** — R5 used to rest on the generator always writing `showEmptyCount: false`, and
the stage no longer trusts a flag for something that IS the make-ten answer. Both have revert-bites.

**Content gates (brief §4), both sides of the wire.** `itemFromChallenge` returns null and the
generator filters, for: a spoken answer of **0** (an empty frame is a legitimate subitize stimulus;
a subtraction can land on nothing — and "zero" is unbenched) and a spoken answer **above 20**.
KEEP-OR-DROP, no backfill. The K make-ten branch is deliberately exempt from the spoken window
because its complement is *enacted* — the band fork is what makes that legal, and it is tested.

**The one place this pack refuses what a sibling accepts.** `subitize`'s signature error is counting
aloud one-by-one after the flash: it reaches the right number by the wrong route and is the exact
skill the mode exists to defeat. **`counting-board` AFFIRMS the identical utterance** (cardinality:
the last number said tells the total). Both are correct for their mode, and the accept clause is
what keeps it honest — a child who says the total FIRST and then verifies by counting is right.
**That split is criterion (a) on #98 and it is the thing most likely to fail live.**

**β unchanged on all four modes, deliberately.** A stepper is a costume — a child who cannot
subitize can still operate one — but operating it still required *producing* the number. The
modality changed; the production demand did not. Changing β would break IRT comparability against
every ten-frame attempt already on record for no measured reason.

**Gates (re-run after the drive-3 fix):** `typecheck:lumina` 0 · full project `tsc` zero new vs.
baseline (0 errors in every touched file) · census greps 0 · own tests **48/48** plus the runner's
own 14, every new regression revert-bitten · **full vitest 3032 passed / 4 skipped / 0 failed.**
*(An intermediate run showed 5 failures in `judgedScriptContract.test.ts` and
`LetterSpotter.di-script.test.ts` — a concurrent session mid-flight flipping `letter_name` from
`blocked` to `accepted-build-ahead` on a fresh user ruling. Not this port; resolved by the time of
the final run. Own only your suites.)*
· **live 6-run pipeline probe, deleted after
the run**: build@K, subitize@K, make_ten@K, make_ten@1-2, operate@1-2 single, operate@1-2 **double**
— **38/38 items kept, zero drops**, `validateJudgedScriptPack` clean over live content,
`showEmptyCount` false on every run. Drawn values:
> `build(2,4,5,6,7,8,10)` · `subitize(1,2,3,4,5,4,5)` · `make_ten@K(9,8,7,6,5,4,3)` ·
> `make_ten@1-2(7,5,8,3,6,9,4)` · `operate single: 4+2, 5+2, 8−5, 6+3, 9−5` ·
> `operate DOUBLE: 8+3=11, 7+6=13, 14−6=8, 9+6=15, 17−6=11` — the double frame stayed inside 20
> unaided, which is the empirical half of why ten-frame was the right first math port.

**🔎 CORRECTION to this item's own `numberWordFor` flag — there are THREE copies, not two, and
they DISAGREE in load-bearing ways.** The ten-frame port did *not* add a fourth (it imports
`countingBoardScript`'s), so the triplication did not get worse — but the extraction was NOT done,
on purpose:
> | copy | range | outside range |
> |---|---|---|
> | `countingBoardScript.ts` | 0–30, hyphenated | returns `String(n)` |
> | `diSpokenPracticeScript.ts` | 1–20 | returns `String(n)` — **and a comment says the numeral fallback is relied on** |
> | `service/direct-instruction/gemini-di-math-facts.ts` | 0–120, "one hundred seven" | **THROWS** (tested) |
>
> Unifying them is not a move: `gemini-di-math-facts`'s version throws where `di-spoken-practice`
> deliberately falls back to a numeral, and di-spoken-practice is a shipped pack whose fixes are
> still unheard (#89). Turning a soft fallback into an exception inside an unrelated port is
> exactly the sweep-before-validate antipattern. **QUEUED as item 18a below — it needs a ruling on
> the out-of-range contract first, not an edit.**

**🐛 FIXED SAME DAY, FROM THE FIRST USER DRIVE — AND IT IS A TRAP FOR EVERY FUTURE PORT.**
User report: *"the first activity worked and i placed the counters, but the 2nd didnt, its not
letting me click the ten frame for Build mode on attempt 2."* The screenshot named the cause — the
stage word still read **YES!** on item 2. **`useJudgedScriptRunner` sets `stage = 'affirmed'` and
calls `openNext()` in the SAME dispatch, and nothing returns the stage to `'asking'` on the happy
path** — the only resets are a correction (`:358`), a move-on after the cap (`:367`), a
resync (`:447`) and `startRun` (`:536`). So `stage` is a *transition* signal, not a
"can-the-child-act-now" signal, and TenFrame's interaction gate (`stage !== 'asking'`) killed the
frame on every item after the first. **Vicious failure shape: it healed itself the moment the child
got something WRONG**, because a correction resets the stage — so a drive that answers correctly
sees a dead board and a drive that errs sees a working one.
**Fix:** interaction and reveal now key on **`runner.solvedIds`** ("is THIS item still open?"),
never on the stage word; only `stage === 'judging'` still blocks. Regression test bites the exact
sequence (commit item 1 → stage stays `affirmed` → open item 2 → frame must accept taps), plus the
converse (a solved item's frame is locked). 42/42 own tests, typecheck 0, census greps 0.
**→ Carry to every port with an interactive stage, and to `/add-di-loop` Step 3.** counting-board
and cvc-speller happen to be safe (they gate on `running` / `isAwaitingGesture()` / `judging`, never
on `asking`) — this port invented the stricter gate and it was wrong. **The runner is NOT being
changed to reset the stage:** eleven ports read it and the reveal-on-affirm renders key on
`'affirmed'`; that is a shared-engine decision, not a bug-fix decision.

**🐛🐛 DRIVE 2 (same day, `subitize` @Elementary) — TWO MORE, BOTH FIXED. Neither was reachable by
any machine gate this lane runs, and that is the finding.**

**(1) THE FRAME NEVER FLASHED.** Screen sat on *"Get ready to look…"* while the tutor asked *"How
many counters did you see?"* against an empty frame — the mode's entire stimulus never happened.
**Cause: the standing Lumina context-churn footgun, and this is its cleanest instance yet.** The
prep timer lives in an effect that depends on the flash callback; the callback closed over
`runner`, which `useJudgedScriptRunner` returns as a **fresh object every render**; and
`ctx.micLevel` updates **once per audio frame**. So with the mic open the effect tore down and
re-armed its 800ms timer many times a second and the timer could never reach its deadline.
**It is invisible at rest** — which is why 42 tests, a 6-run live generation probe and a full
`tsc` all passed over a primitive whose flagship mode could not present its stimulus.
**The gate that would have caught it did not exist:** every test in this family renders the
component and *lets it sit*. The new one **re-renders throughout the wait** and revert-bites.
> **⭐ RULE FOR THE LANE: in a judged-loop component, a callback used by a timer effect must never
> depend on `runner`.** Depend on `currentItem` (stable, out of the items memo) or a ref.
> `counting-board` is safe by luck — its flash callback happens to depend on `currentChallenge`.
> **Add this to `/add-di-loop` Step 3 and check every port that has a timed stimulus.**

**(2) THE TUTOR VOICED A STAGE DIRECTION TO THE CHILD.** Session log, straight after the ask:
`AI transcription: [WAIT` / `silently]`. The model took the contract's opener *"Then WAIT
silently — …"*, **wrapped it in a bracket tag mimicking `[TF_ITEM]`, and performed it** — an
imperative aimed at the tutor reads, to the model, like one more thing on the list of things to
say. The cue's existing *"Never read bracket tags aloud"* did not stop it because the model had
invented the tag itself. **Fix:** the wait is now stated as a FACT about the turn (*"The quoted
line is the ONLY thing you say on this turn; you then stay silent…"*) instead of an order, and
every contract-carrying cue ends by naming the exact failure (*"never announce that you are waiting
or listening — simply stop speaking"*). Revert-bitten.
> ⚠️ **`counting-board`, `picture-vocabulary` and `cvc-speller` all open their contracts with the
> same "Then WAIT…" imperative.** This port is the first to catch it being performed. **Not swept
> — sweeping an unverified prompt change across four live packs is the antipattern; each wants its
> own drive.** Watch for it on #86 and #85.

**⭐ DRIVE 3 (same day) — THE DOCTRINE EXTENDS: THE TUTOR OWNS THE STIMULUS CLOCK, NOT JUST THE
ADVANCE.** User: *"the ten frame needs to flash after her first intro, right now it flashes then she
instructs, this would be confusing for the child? subsequent challenges should follow the same
method."* Correct, and it is the deepest of the three drive findings.

The flash fired on an 800ms beat measured from ITEM-OPEN. Her opening line runs ~4s (session log:
cue sent `12:22:48.151`, transcription closes `12:22:52.5`). So the counters came and went while she
was still saying *"Watch the frame — the counters show for just a moment"*, and the ask
*"How many counters did you see?"* landed on a frame the child had never been told to look at.
**Both halves were individually correct and the composition was incoherent** — which is exactly the
failure a wall clock produces next to a speaker whose line takes as long as it takes.

**`tutor-owns-the-clock` was recorded as a rule about ADVANCE — voice control advances on
`setTimeout`, DI advances on the tutor's utterance. This drive shows it governs PRESENTATION too.**
Any stage that shows something the ask refers to — a flash, a reveal, an animation — must key it to
her voice. **Generalise it; it is not a ten-frame fact.**

**Mechanism:** `useJudgedScriptRunner` now passes through `tutorSpeaking` (`ctx.isAudioPlaying`,
which already existed and outlives `isAIResponding` by the audio tail). Additive, read-only, changes
nothing in the loop — but it is the signal every port with a timed stimulus needs, so it belongs on
the runner rather than in one component reaching around it.
**The gate is a FALLING EDGE, not a level:** "not speaking" is also true in the gap before her audio
starts, so the stage waits for her to have spoken for THIS item and then stopped (`tutorHasSpoken`,
cleared on item open and on every correction retry), plus a 12s fallback because a child cannot
answer about a frame that never flashed. Same gate on the first ask, on every subsequent challenge,
and on a correction's re-flash — which is what the user asked for with *"subsequent challenges
should follow the same method"*.
**It also DELETED a number I had tuned by ear:** the 3s "wait for the correction to finish"
window is gone, and with it #98's criterion (b). There is no window now — there is her voice.
5 new tests, all five revert-bitten.

**Observation the same fix surfaced, NOT fixed, no ruling taken:** the reveal panel ("3 + 2 = 5")
is set by `onAffirmed` and cleared by `onItemOpened` **in the same React batch**, so on every item
except the last it never paints. Family-wide (counting-board has the identical structure). Either
the reveal wants a hold, or it is honestly last-item-only and the other ports should stop pretending
otherwise. **Queued as 18b — it needs a product call, not an edit.**

#### 18b. 👁️ QUEUED — the reveal-on-affirm never paints except on the last item
**Executor:** a product call, then a small change in the runner or in every stage.
`onAffirmed` (set reward) and `onItemOpened` (clear it) fire in one dispatch on the advance path.
Affects at least `ten-frame` and `counting-board`. **Do not fix it in one primitive** — it is the
family's reveal contract.

**✅ DRIVE 4 — ALL FOUR MODES CONFIRMED WORKING (user: *"tested all the modes, worked great"*).** The
port is functionally live end to end. **#98 stays open on one narrow point:** every drive so far
answered correctly, and criteria (a)/(c)–(g) exist to test a JUDGE refusing a fluent wrong answer.
One short sitting closes it.

**⬆️ FED BACK INTO `/add-di-loop` (2026-08-13).** Six additions, all from this port's three failed
drives, none of which any machine gate in this lane could have produced:
1. **Step 3 — "A hands turn needs a CLOSE"** (NEW). The skill described `submitGestureAttempt` but
   never *when* to call it, because the first two ports had structural closes handed to them by
   their shape. Stillness-close + **the commit must not be correctness-gated**.
2. **Step 3 — "The tutor owns the STIMULUS clock"** (NEW) + `runner.tutorSpeaking`, with the
   falling-edge rule. Otherwise nobody discovers the passthrough exists.
3. **Step 3 — the two runner footguns**: never gate interaction on `runner.stage`; never let a timer
   effect depend on `runner`. Both shipped as blocking bugs here.
4. **Step 2 — contracts as FACTS, not ORDERS.** The `[WAIT silently]` leak, cross-referenced to
   letter-spotter's fabricated `[LSP_TAP]` — the same failure from the opposite direction.
5. **Step 6 — test under RE-RENDER, not at rest.** The reason 42 tests passed over a flash that
   could never fire.
6. **Step 7.3 — the probe harness gotcha** (dummy key + import hoisting → `await import()` inside
   the test), plus: probe both bands. And **Step 3 — hunt the leak in PIXELS, not just strings.**
Also: `tenFrameScript.ts` added to the worked examples, the read-the-contract-first caveat for
non-literacy ports, and Step 8's queue pointer corrected to item 16 (literacy) / item 18 (math).

**FILED, NOT FIXED (handoff §8.3, a standing user ruling — do not resolve silently):** `make_ten`@K
is arguably performable without the skill — fill until full. The stillness commit narrows this
(stopping early is now wrong) but does not close it: a child who fills every box still cannot be
wrong about *how many* they placed. That is a pedagogy question about R6, and changing it reverses
the direct-manipulation-first ruling. **It belongs to reader-fit, not to this lane.**

**→ NEXT: drive #98 and #86 in the same sitting** (counting-board shares this port's engine and its
number-word handling). **P2 (`addition-subtraction-scene`) does not move until #98 is heard** —
pilot-then-sweep.

#### 18a. 🔢 QUEUED — `numberWordFor` × 3, and they disagree outside 1–20
**Executor:** a ruling, then a small extraction (no skill). **Blocked on:** deciding the
out-of-range contract — throw (math-facts, safest, surfaces bugs) vs. numeral fallback
(di-spoken-practice, currently load-bearing). **Do not do this inside another port.** Drive #89
first or accept that di-spoken-practice's answer normalisation changes shape under an unheard fix.

### 17. 📐 **SCOPED, NOT STARTED — EMBEDDED INSETS IN `di-spoken-practice` (user thread 2026-08-12: *"add embedded insets similar to knowledge check… first do the schema, then build the ai capabilities, this will increase the overall surface area"*)**

> *(Number 17 was briefly used on 2026-08-10 for the generalized runner and RETRACTED
> the same run — the runner's record lives in item 16. 17 is free; this is its only use.)*

> **⚠️ THE PHASING NEEDS ONE CORRECTION, AND IT IS THE WHOLE POINT OF THIS SCOPE.**
> Schema-then-AI is the right instinct but both halves are the cheap half. **The schema is
> ~80% already written and the AI capability is ALREADY BUILT — TWICE.** What is NOT built,
> and what this feature actually costs, is a third thing sitting between them: **the pack's
> answer-leak gates do not survive the change.**
>
> #### What already exists (do not rebuild)
> - **Renderer + type union:** `primitives/problem-primitives/insets/` — 9 types
>   (`katex` `data-table` `passage` `chart` `code` `image` `number-line` `definition-box`
>   `equation-setup`), routed by `InsetRenderer`, typed as `Inset` in `types.ts:582`.
>   Knowledge-check carries it as **`inset?: Inset` on `BaseProblemData`** — i.e. the
>   "attach an optional inset to an item" pattern the user is asking for is already the
>   established shape. Copy the shape, not the code.
> - **Gemini generation, built twice:** `service/knowledge-check/gemini-knowledge-check.ts`
>   (`getInsetSchema` + `buildInsetPrompt`) and `service/annotated-example/inset-helpers.ts`
>   (`getInsetGeminiSchema` + `buildInsetPromptGuidance` + `serializeInsetForPrompt`). The
>   second file's own docblock says it *"mirrors the inset variants supported by the
>   knowledge-check pipeline"* and it imports nothing from it. **Two copies exist; DI would
>   be the third.** Both use the same sound trick — the caller picks ONE inset type up front
>   so the schema stays monomorphic and Gemini emits well-formed JSON (this is the
>   simplify-the-schema rule already in CLAUDE.md, applied).
> - **The hardest-sounding piece is already solved:** `serializeInsetForPrompt` flattens an
>   Inset to compact plain text *specifically so downstream LLM callers see the same problem
>   context the student does*. That is exactly what a voice-first pack needs in order to SAY
>   its stimulus. There is precedent; there is no research problem here.
>
> #### The real cost: three string-based gates stop being sound
> `di-spoken-practice`'s entire visual vocabulary today is derivable from a string —
> `stimulusKind: 'text' | 'picture' | 'objects' | 'none'` over `stimulusText` / one
> `stimulusEmoji` / a repeat count. **Every mechanical gate exploits that:**
> `findAnswerLeaks` (phrase-scans `ask`/`howToPlay`/`stimulusText`), `findUnspokenStimulus`
> (the ask must contain the stimulus TOKENS), `findPrintedNumerals` (no digit in `objects`),
> `findArithmeticMismatches` (regex over the printed fact).
>
> **An inset is structured data that renders a picture, so it leaks through channels a string
> scan cannot see:** a `number-line` with the answer tick marked, a `chart` whose tallest bar
> IS the answer, a `data-table` cell holding it. All four gates would pass. **This pack's
> whole justification is that `expectedAnswer` is a field and therefore leaks are mechanically
> catchable** (item-16 history: three gates were added, each after a live drive caught a leak).
> Admitting insets without a per-type leak rule silently retires that guarantee.
> **→ Deliverable: `findInsetAnswerLeaks`, one rule per admitted type. This is the feature.**
>
> #### Only 3 of the 9 types qualify — screen before building
> 1. **Pre-reader/band.** The pack's live consumers are K-2. `passage` `code` `katex`
>    `definition-box` `data-table` are reading-dependent → band-gate them (G2+), do not ship
>    them at K where this pack actually routes.
> 2. **The tutor is blind.** No image channel on the Live API (parked IMG-1), and BOTH
>    existing generators already exclude `image` (no base64 hop). → out.
> 3. **🚫 No interaction — and this is the boundary that keeps the pack generic.**
>    `equation-setup` is interactive and gateable (`isGateableInset`, `onCompletionChange`).
>    It would reintroduce the on-screen commit that every DI port deleted, and it contradicts
>    this pack's OWN catalog entry (*"there is NO manipulative the child needs to touch"*).
>    **Rule to adopt explicitly: insets are STIMULUS ONLY, never input.** The moment an inset
>    takes an answer, the generic pack has become the bespoke primitive it exists to avoid —
>    the same fork that created it.
>
> **Leaves `number-line` (strongest — K-2 math, picturable, easy to say aloud), `chart`
> (bar charts, G1-2 data), `data-table` (band-gated).**
>
> #### ⭐ The highest-value inset is not in the nine
> `objects` mode is already a hand-rolled inset — `Array.from({length: stimulusCount})` in a
> flat row. The stimulus that would actually unlock new K-2 math is an **ARRANGEMENT** inset
> (ten-frame, array, groups-of), which is a NEW type, not a borrowed one. If the goal is
> content reach rather than reuse, this beats porting `chart`.
>
> #### ⚠️ HONEST CEILING — read before committing the slice
> Insets widen the range of **stimulus**, not the range of **answer**. The catalog constraint
> and the benched response classes are untouched: the child still says 1-3 short words from a
> closed set. **More things the tutor can ask ABOUT; the same things the child can say.** If
> the goal is surface area, the bigger lever is a response-class bench (item 16 P3,
> `connected_text`), which adds *answers*. Insets are worth doing — but as a content-reach
> play, priced accordingly, not as the pack's next capability jump.
>
> #### Proposed phasing (revised from the user's two steps)
> - **P1 — extract, don't triplicate.** One shared inset module; forced by this work, pays
>   back knowledge-check + annotated-example. Small, and it is the right first commit.
> - **P2 — schema.** `inset?: Inset` on the item + `stimulusKind: 'inset'` + band gate +
>   type allow-list (3 types, not 9).
> - **P3 — the leak contract.** `findInsetAnswerLeaks`, per admitted type. **The real work.**
> - **P4 — the spoken bridge.** `serializeInsetForPrompt` into the ask; extend
>   `findUnspokenStimulus` to inset-derived tokens so the tutor still SAYS the problem.
> - **P5 — the arrangement inset** (new type), if the count modes matter.
>
> **Gate before any of it:** a live drive. This pack has found a defect on every one of its
> four drives, and each gate it owns was written after a drive, not before.

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

---

## 📥 MOVED FROM `WORKSTREAMS.md` — `/pm` 2026-08-13 (user ruling)

The index's `## ACTIVE` section had grown to ~1,360 lines (79% of the file), so each
stream's DETAIL now lives in its owning queue and the index carries the pointer plus the
one-line state. **Moved verbatim, nothing deleted.** The index remains authority for
STATE (active/parked, what to pull next); this block is authority for the detail behind
it. Where the two disagree, the queue wins on WHAT and reports win on EVIDENCE.

### 2. Direct Instruction primitive family (graduated from bench) — **OPPORTUNISTIC (+1) as of 2026-08-08** — last touched **2026-08-08**

*Demoted from ACTIVE by `/pm` 2026-08-08 to make room for the primitive-selection
lane, and it is an honest demotion rather than a park: **only CLOSEOUT remains.**
CTX-2 shipped (`1cf72ae`) and is live-signed-off, so what is left is its report,
its post-fix ledger number, and the `wedged` watchdog check — worth finishing
while the session is fresh, but not work that needs a slot. The human side (#63 /
#72 / #76) was always opportunistic and never blocked the machine lane.*

**CURRENT STATE (`/pm` 2026-08-08 — read this block, not the 08-05 header
paragraph below it, which is history).**
- **✅ di-shapes is L4. Rungs 3 AND 4 shipped together in `bd21cef`** (2026-08-08
  00:15). *(Corrected `/pm` 2026-08-08: the bullet below said "next machine pull =
  di-shapes L4" and L4 had already closed in the same commit as L3.
  `qa/di/BACKLOG.md` item 14 §(5) had it right; this index lagged — the fourth
  consecutive run correcting a divergence in the same direction.)*
  **They shipped together deliberately, and the reason is now doctrine:** L3 alone
  left `easy`/`medium`/`hard` drawing **byte-identical pictures** with only the
  spoken scaffold toggled — a ceiling a child who had mastered the mode could not
  climb past, and exactly the low-yield rung CLAUDE.md's "Build over ceremony"
  section warns about. L4's lever is **exemplar typicality**: prototype →
  non-prototypical drawing (scalene obtuse triangle, irregular hexagon/pentagon,
  portrait rectangle, right trapezoid), rotation ¼ → full safe ceiling, scale
  100% → 62–100%, confusable neighbours placed side by side. **The rotation cap
  was hiding the standard** — `maxRotationDeg` capped a triangle at 25°, so a pack
  whose curriculum home is literally *"regardless of orientation"* had never tested
  orientation; `SAFE_ROTATION_DEG` is now per-shape and principled (square 15°,
  because 45° is a DIAMOND and that is a judged alternate — two right answers).
  Geometry became **data** (`diShapesGeometry.ts`) and the oracle earned it
  immediately. Gates: 173/173, **17/17 revert-bites**, real-pipeline 11/11.
  **Residual: nobody has SEEN a `hard` drawing** → HUMAN-CHECKS **#72 (e)**,
  extended this run so the row cannot be struck on its voice half alone.
- **➡️ CTX-2 — `qa/di/BACKLOG.md` item 15 (filed AND shipped `1cf72ae`, 2026-08-08).
  ✅ SIGNED OFF LIVE by the user** (*"tested a lesson with lumina tutor on, it
  worked great, honestly feels a little smoother"*) — the acceptance half is met,
  and for a defect class that is *heard* rather than measured, that is real
  evidence. **But three things stay open and the sign-off does not close them:
  the post-fix ledger NUMBER** (the pre-fix rate is measured, so the after is a
  gate — "felt smoother" cannot tell 33 sends from 6), **a report**, and **the
  `wedged` watchdog**, which is the failure mode a floor gate ADDS and the one
  thing a smooth lesson would not reveal. A `FloorGate` in `lumina_tutor.py`
  (+452) with batching, narrow supersession, send-time rendering and a
  **client-declared `interrupt` flag**. It is the layer *after* CTX-1: CTX-1
  removed one sender, CTX-2 arbitrates the ones that remain, because the transport
  has exactly one floor and every text send closes the turn. Pre-fix measurement
  from the 08-08 lesson session: **33 sends in 9 minutes, five inside 3.1s of which
  only the last was ever spoken, three turns killed by our own text 40–55ms after
  it landed** — and item 13's 8s hold ceiling *"just interrupted 41s read-alouds 8
  seconds late"*. **What it owes: a report, the post-fix ledger number (the pre-fix
  one is measured, so this is a gate not an opinion), a live ear, and proof the
  `wedged` watchdog cannot silence the tutor permanently** — that last one is a
  failure mode a floor gate ADDS. Do not strike #76 for it; #76 is CTX-1's.
- ~~**di-shapes L3 SHIPPED 2026-08-07**~~ *(superseded by the L3+L4 bullet above;
  kept for its two carried findings)* (rung 3, fourth use of the family
  script-composed fade). Gates: focused 55/55, **8/8 revert-bites**, full Vitest
  2349/2349, typecheck:lumina 0, src-scoped tsc 803 = baseline, **real-pipeline
  6/6** incl. `mixed`@hard producing all four identities all tiered. Two findings
  worth carrying: (a) the fade needed **no per-mode carve-out** because the
  stimulus is DRAWN (di-letter-sounds needed an inversion guard because its onset
  ask must keep SPEAKING the stimulus) — pinned as a test; (b) **a cold COUNT
  withholds two tokens** — the shape's name hands over the count (triangle →
  three). Report `qa/eval-reports/di-shapes-support-tiers-2026-08-07.md`.
  **Residual: the `hard` cold ask has no live audio yet** → folds into #72.
- ~~**Next machine pull = di-shapes L4 `/add-structural-difficulty`**~~ **✅ DONE
  `bd21cef` — see the L3+L4 bullet at the top of this block. The prediction was
  right about the levers (rotation magnitude, size variation, non-prototypical
  exemplars) and wrong about the timing: it shipped in the SAME commit as L3, not
  after it.** Queue of record `qa/di/BACKLOG.md` **item 14**.
- **Cross-queue re-diagnosis from rung 3, worth not re-deriving:** the
  `supportTier: unresolved` / one `(not set)` that item 14 filed against
  di-math-facts is a **family-wide `/tutor-test` harness blind spot**, not a pack
  defect — `scaffoldAudit.analyzeHookSite` parses `useLuminaAI({ primitiveData })`
  hook sites while every DI pack passes its bag through
  `ctx.connect({ primitive_data })`, so **all five packs report
  `data-bag-unparsed`** (measured across letter-sounds / math-facts /
  sentence-reading). Its preview is therefore not evidence about the shipped
  prompt. di-shapes closes the claim by executing the component instead
  (`DiShapes.support-tier-context.test.tsx`). Fix belongs to the tutor-test queue.
- **di-shapes was L1** as of 2026-08-07: rung 1 `/curriculum-fit` returned **MATCH at
  both K and G1**, rung 2 shipped `shape_review` 2.5 / `count_sides` 3.0 /
  `count_corners` 3.5 alongside L0's `name_shape` 1.5. Rung 1 paid for rung 2 twice:
  it found the exact curriculum home for the counting modes at BOTH grades, and it
  caught a catalog `constraints` clause (*"no side/corner counting tasks yet"*) that
  would have shipped the new modes **born unreachable**.
- **CTX-1 CLOSED 2026-08-07** — the `[CONTEXT UPDATE]` push and `ContextUpdateGate`
  are deleted; state is kept server-side and attached to messages that already asked
  for a turn. Verified on the live backend + real Gemini (0 sends / 0 barge-ins on a
  three-slider beat; `[PRIMITIVE SWITCH]` fence held). **⚠️ This slice is
  UNCOMMITTED** — see the ship note in the current snapshot.
- **Human side is opportunistic and must never block the machine lane** — ONE mic
  session covers **#63** (re-run, now ACCEPTANCE on the fixed barge bar) + **#72**
  (di-shapes L0 naming *and* the L1 counting contract) + **#76** (CTX-1's ear).
  **#72 had no table row until `/pm` 2026-08-07 night wrote one** — it existed only
  as prose in two HUMAN-CHECKS preamble notes while two queues routed to it.
- Item 10 (`counting_next` to 120) is BUILT and committed; #63's re-run is its
  acceptance drive, not its build gate.

<details><summary>History (08-05 and earlier) — kept verbatim</summary>

**2026-08-05** (**reader-fit 14g CLOSED 2026-08-05 — `di-math-facts counting_next`, fork resolved as Option B and GATED.** The census finding had two layers and only one was a bug: `resolveTextScope` captured `(\d{1,2})`, so the published G1 objective "counting forward … within 120" parsed as **"within 12"** and every three-digit ask was silently MANGLED rather than saturated (100 → 10). Fixed to `(\d{1,3})\b` — the `\b` matters, since a bare `\d{1,3}` reads "202" out of "to 2026". **The clamp did not move:** `Math.min(20, …)` stays, so a 120 ask now saturates at the pack's benched twenty — the di-sentence-reading precedent (a benched ceiling is a hard cap that saturates, never a knob), and twenty is the last SINGLE-WORD entry in `NUMBER_WORDS`, i.e. the edge of the #46-benched response class. **Layer two is why this is a fork, not a wider clamp:** every answer past twenty is a multi-word numeral ("one hundred seven"), an unbenched spoken response class that DI standing gate 1 blocks. User chose Option B (extend) over Option A (saturate + steer high-range counting to number-sequencer/number-line), so what shipped is everything up to the gate PLUS the gate itself: a new bench set **"Counting to 120"** (10 hand-rolled items, new `DIItemKind: 'counting'`) whose cue LINES are the #46-benched wording byte-for-byte (already `problem`-phrased, so it reads correctly for counting) but whose JUDGING BAR forks — the generic "reasonably close for a kindergartener" would rubber-stamp exactly the teen/decade near-miss the sitting exists to detect, so the counting branch mirrors the pack's shipped contract (strict on a different number AND on an incomplete compound; permissive on child pronunciation and counting up). Teens are deliberately never cross-aliased with their decade siblings — that would hide the confusion in the disagreement meter. Gates: 12 new tests with **4-of-6 revert-bite** on the focused scope suite, DI+bench 212/212, full Vitest **1601/1601**, typecheck:lumina 0, tsc **1021 = HEAD baseline, 0 new**, standing gate 2 re-scanned mechanically (241 sentences, 0 unexpected sentinel openers), **real-pipeline 5/5** (census objective now reaches 17 pinned / 18 at `hard`, `subtraction_fact` shares the ceiling honestly, K within-5 + G1 within-10 controls unchanged, zero `undefined` answer words). **Honest residual: a 1–120 objective is served within TWENTY** until the sitting passes — that is saturation, not the defect, but it is not what the objective asks. Option A's catalog steering was deliberately NOT taken (B reverses it), so if the sitting slips, take it as an interim. Extension queued line-exact as **BACKLOG item 10**; sitting = **HUMAN-CHECKS #63**. Report `qa/tutor-reports/di-math-facts-14g-2026-08-05.md`. Prior: **TWO rungs closed 2026-08-03. (1) di-sentence-reading `/add-structural-difficulty` (L4) DONE — first pack at L4, the family's L4 template**: the tier now drives BOTH dials — DISTAR fade (L3) + sentence-LENGTH band (L4): easy [3,4] / medium [5,6] / hard [7,8] inside the session ceiling, clamped in `resolveProblemShape`, enforced at selection by `rankByBand` (one key two places; prompt advisory, code authoritative; the **benched 8-word ceiling stays a hard cap, never a knob** — K/narrowed ceilings saturate honestly); pool identity outranks the band (sight stays sight; review keeps nearest-band lesson anchors); 7 menu additions (one 7-8w sentence per pure vowel + 2 sight-heavy, all from established vocabulary) give the hard band real pool support; template lesson for the L4 siblings — trim candidates to the band WINDOW before the variance rotation (its family-novelty pull out-ranked the band; caught by the new suite pre-live); NO spoken copy changed → no new ear row, the 8-word COLD read (L4×L3 hard) folds into the pack's next sitting. Gates: typecheck:lumina 0, tsc = 1021 baseline, 17 new tests (non-vacuity: 9 fail on revert), full vitest 1303/1303, live `/eval-test` sweep 6/6 on an isolated :3005 (hard 7-8w / easy 3-4w / mixed+medium all-tiered / K saturation / scope-beats-band / no-tier control). Report `qa/eval-reports/di-sentence-reading-structural-difficulty-2026-08-03.md`. **Next serial rung = di-letter-sounds L4** (item-set composition per birth cert), then di-math-facts L4, then di-word-reading L1 backfill. **(2, earlier same day) di-word-reading `/add-tutoring-scaffold` (L2) DONE, committed `66a2d66` — the family is now ENTIRELY catalog-resolved; no pack ships a script-local tutoring block.** `DI_WORD_READING_TUTORING` moved into `catalog/di.ts`, so both connect paths resolve it from the single source of truth; cue lines + `correctionLine` byte-untouched (#55 still gates the contrastive port). Added what L0 deferred: `{{challengeType}}` + 4 contextKeys (`challengeType`/`word`/`wordType`/`words` — the SENTENCE precedent, nothing withheld, since the printed word is stimulus and target both), 5 observed `commonStruggles` (near-neighbour matt/son/read as the signature class, plus one PROTECTIVE struggle so an over-strict tutor cannot punish audible blending), a generator flat `words` summary, and the component `updateContext` sync. **ONE new directive clause**, because `words` newly puts unread words in RUNTIME STATE: never preview a word that is still coming. The handoff's 5th key (`graphemes`/sound-out) was dropped by design — absent on every sight word, derived rather than generated (so it can never resolve at probe time; the first probe run showed the `(not set)` break), and already carried verbatim in the `[DI_ITEM]` cue. Gates: typecheck:lumina 0, `npm test` 1286/1286, Tier 1 **0 HIGH** (the family's 2 structural WARNs), **Tier 2 × 3 content shapes** all keys resolved / zero `(not set)`, standing gates 2+3 re-verified mechanically over the assembled prompt. Live glance (5 struggles → chattiness; the never-preview clause needs a run reaching item 2+) rides the next DI sitting — NOT a new gate. **Second slice: reader-fit 14g's di-word-reading half CLOSED — verdict WRONG-PRIMITIVE, not the GENERATOR bug it was filed as**: a CVCe ask is out of this pack's benched scope, so serving short-vowel CVC is the correct degradation; the defect was the entry's own steering (the old constraints excluded digraphs/blends/multisyllable, and CVCe is none of those). Fixed in `constraints` + measured: `manifestOnly` traces on 14g's exact topic **2/3 → 0/3** picks, while the real homes still route 3/3 (short-a CVC @ G1) and 2/2 (sight words @ K). 14g's `di-math-facts counting_next` 1–120 half stays open as a genuine in-scope failure. Report `qa/tutor-reports/di-word-reading-2026-08-03.md`. **Next serial rung = di-sentence-reading L4** (axis built + measured; the 8-word benched ceiling is NOT a difficulty knob), then di-letter-sounds L4 / di-math-facts L4; di-word-reading's OWN next rung is `/add-eval-modes` (L1). Prior 08-01: **di-letter-sounds `/add-support-tiers` (L3) DONE — third use of the DI L3 template, the pack is now L0→L1→L2→L3**: the DISTAR fade composed in the SCRIPT (`leadInFor` + `coldSoundGuard`, easy = model+guide+test byte-for-byte the bench-proven block / medium = model+test / hard = COLD grapheme→sound retrieval); per-mode composition verified for the pack's three cue structures — the onset ask keeps the stimulus WORD while its first sound withdraws, the keyword-vowel ask keeps "Say apple" while the "short a" sound-naming withdraws (the cold guard is SOUND-scoped, never word-scoped); catalog second-channel audit came back clean like math's (level 1 repeats the PROMPT; levels 2-3 + struggles are correction territory — recorded in `catalog/di.ts`), plus the three closures anyway: per-item cold guard, `supportTier` contextKey threaded through connect/updateContext/`startDiRunLog`, cold-items clause in the LIVE-JUDGED directive; PLAIN correction untouched (contrastive port stays frozen on #55) and byte-pinned at every tier; no `tierSection` in the prompt (Fork A: a tier line could only nudge LETTER selection — L4's axis); no tester work (the family tier selector drove it unchanged). Gates: `typecheck:lumina` 0, new script suite 16/16 + 4 generator tier tests, **non-vacuity ×7** (siblings proved ×5), full vitest 1067/1068 (the 1 = CoinCounter.reader-fit, the concurrent 14b stream's in-flight file — not this slice), **3/3 real-pipeline probes** (pinned+hard all-hard scope-intact / mixed+medium all three identities tiered / no-param no-field byte-compatible; probes 2-3 ran on an isolated :3005 dev server after the shared :3000 broke under 14e's in-flight edits). Live `hard` ear-check → **HUMAN-CHECKS #57** (new row, mirrors #50(d)/#54(d), carries the onset+vowel glances). Report `qa/eval-reports/di-letter-sounds-support-tiers-2026-08-01.md`. **Next serial rung = di-word-reading L2** (catalog `tutoring:` move), then di-sentence-reading L4; `catalog/di.ts` is free again. Prior same-day: **item 8's 3-pack FLUSH SWEEP DONE, parallel lane** — `run-end` + deduped 6s tail + `teardown` flushes and the pre-connect `setClientRunId(mintRunId())` registration replicated byte-for-byte from the DiMathFacts pilot into di-letter-sounds / di-word-reading / di-sentence-reading; typecheck:lumina 0, full vitest 1041/1041; item 8 residual = the acceptance gate only (rides item 9 Tier 2 / a sitting); no non-math pack has flushed LIVE yet — each pack's next live run confirms free, artifact in `logs/di-runs/`. **BACKLOG item 5 STRUCK — stall fix BUILT, and LEVEL-2 RECOVERY CONFIRMED LIVE in a user fault drive**: dead cues at exactly 10s/20s → `session-dead` → warm reconnect **327ms** → `session-resumed` → in-flight item re-cued verbatim → affirm → advance; whole episode reconstructed from persisted artifacts alone (run `7f0a1543ff7c`, client teardown flush + server ledger = item 8's acceptance shape demonstrated); the drives caught two real bugs, both fixed same slice — the OPENER never armed the dead-cue watch (stale-`enabled` at arm time; ladder slept for the from-birth-dead session) and `sessionDeads` double-counted (flag→kind); residual runtime = level-3 card (`EPISODES=2`) + an end-coherent full run, folded into item 9 Tier 2's stall journey. Build detail, 07-31 per the dev-first ruling and the 07-27 handoff executed line-exact: (i) `LuminaAIContext.sessionResumeCount` → engine `session-resumed` emission → all 4 packs re-cue the item in flight through their resync branch (backend cold retry now safe for DI); (ii) engine dead-cue watch — cue→tutor-AUDIO liveness, never cue→verdict, 10s × 2 → `session-dead` → shared `useDiStallRecovery`: level 2 = warm `ctx.reconnect()` (mic never touched, open-mic doctrine), level 3 = picture-primary `DiStallCard` 🔄 + `flushDiRunLog('stall')` at the failure moment — never silent "Listening…"; (iii-a) standalone post-run disconnect removes the GoAway-flap trigger, (iii-b) server-side variant DEFERRED; dev-gated **`LUMINA_FAULT_MUTE_S`** fault injection (backend, refuses to arm unless `ENVIRONMENT=dev`) machine-covers item 8's induced-stall acceptance gate; verified vitest **1025/1025** (new session-liveness suite 11/11, fuzz hook-only-kinds invariant extended, reducer untouched/fuzz-clean) + `typecheck:lumina` 0 + py_compile clean; **runtime confirmation = the fault-injected drive**; #56 shrinks to the ear halves; slice report `qa/di-bench/slice-2026-07-31-item5-stall-fix.md`. **RE-POINTED `/pm` 2026-08-01 (user ruling: PUSH DEVELOPMENT):** top pull is the **family ladder** — **di-math-facts `/add-support-tiers` (L3) DONE 2026-08-01** (the birth-cert fade composed in the SCRIPT; 14/14 new tests with non-vacuity + 3/3 real-pipeline probes incl. the blended path; the tester gained the family tier selector that also makes #54(d) drivable; live `hard` ear-check → **#50(d)**; see the DONE entry below) — ~~next rung = di-letter-sounds L3~~ **DONE 2026-08-01, see the headline** (handoff `qa/HANDOFF-di-letter-sounds-L3-2026-08-01.md` executed; next = di-word-reading L2 → di-sentence-reading L4), then **item 2** remediation-lever design; **item 9 Tier 2 DEMOTED but queued** — it stays the absorber of item 5's residual runtime checks (level-3 🔄 card via `EPISODES=2` + an end-coherent run), build it when testing capability is warranted again. **Fault-flag time bomb DEFUSED same day** (user: "we are making ticking time bombs"): `LUMINA_FAULT_MUTE_S=25` removed from `backend/.env`, and the backend now REFUSES .env-persisted fault flags (process-env only, one loud ERROR; guard exercised 4-path in the venv). Full ruling text at the top of the BACKLOG. Prior 07-27: child-paced `answer_fact` K run COHERENT, diagnosed from the AUTO-PERSISTED log alone — no human copy: 5/5 completed, 3 plain-fallback corrections byte-stable → **#55(e) HALF-closed** (spoken-no-number half; the SILENCE route still rides the 90s micro-run), counting-aloud supersession chains absorbed benignly (item 9 Tier-2 "rapid double answers" class, first live observation → watch-item), `[DI_COMPLETE]` tail flush held, cuesStalled 0; report `qa/di-bench/run-2026-07-27-math-facts-answer-fact.md`. Prior 07-26: decoherence ROOT-CAUSED — voice turn gate `minVoiceMs` frame quantization, engine fix + retro-anchor — and VERIFIED live same day: coherent run through the family's **first live `[DI_MOVE_ON]`**; #49(c) + #50(a) CLOSED (both ear halves user-confirmed: move-on line heard, "My turn" works for math), #55(c)/(d-math) closed, #50(c) HALF-closed (subject override ✓ MATHEMATICS, but free-form landed `OPS002-04-c @ G2` → BACKLOG item 6). **PLUS the family's first REAL-CHILD run** (`qa/di-bench/run-2026-07-26-math-facts-stress-sitting.md`, corrected same day): judge-over-transcript HELD — ASR collapsed on child speech ("Please" for a spoken "three", user-confirmed) while the in-band judge contrasted the right number — and turn-gate fix + script shape held under barge-in chaos; **the real break = a mid-run STALL** (no verdict ever arrives, silent "Listening…", GoAway-resume drops the in-flight turn as lead suspect) → **BACKLOG item 5** (escalation ladder + re-cue-on-resume) + clock-skew WS hard-fail (item 7); residual — **user ruling: telemetry FIRST** — **item 8 BUILT + SMOKE-VERIFIED same day** (timestamps un-broken via basicConfig force; server JSONL session ledger with GoAway `mid_turn` stamping; `/api/di-run-logs` drop-box; client ring + auto-flush piloted in DiMathFacts; two live smokes: first caught the mint-after-auth correlation race + flush truncation, both fixed; second run 4/4 — `client_run_id` joins ledger↔run files; residual = induced-stall acceptance gate, rides the recipe sitting; then sweep flush to the other 3 packs) and **item 9 tier-1 SHIPPED** (seeded reducer fuzz in `npm test`, 0 violations → the stall lives above the reducers); **THE RECIPE RUN RAN EOD — COHERENT: item 1 CLOSED** (5/5 items capped, 5× `[DI_MOVE_ON]`, 14 byte-template contrastive corrections = #55 c/d-math at scale, echo rule 5/5 → mean 0 → S1 gate reached, no GoAway/stall; `qa/di-bench/run-2026-07-26-math-facts-sustained-miss.md`); **S1 CONFIRMED — the misconception loop's FIRST LIVE CAPTURE:** stored `"identifies the answer to a subtraction fact as the second number in the expression"` — correct 5/5, bounded, generative, Tier-A over garbage ASR; item 2's consumption half now has live Firestore data; next = 90s silence micro-run (no-verdict→resync + #55(e) + item-8 acceptance) → item-5 fix; tier-2 = DI journey family on `run_tutor_live.py`, not a new harness)

</details>

- **Item 11 OPENED 2026-08-05 late (user-pulled) — ✅ MACHINE HALF DONE 2026-08-06
  same-day: lesson-mode session tutor — the script outranks the student, + resume
  continuity.** Fixes shipped + machine-gated (pre-fix journey FAILED ≈50%/judged
  beat; post-fix 3/3 PASS zero findings; resume probe non-vacuous PASS; units
  22/22). Residual = the real-child #64(b) acceptance drive (restart the dev
  backend first). Slice report `qa/tutor-reports/lesson-tutor-item11-2026-08-06.md`. The user's son drove two real
  mixed-lesson open-mic sessions (the #64 shape in the wild) and **#64(b)
  failed**: his curiosity question mid-`machine-profile` ("are they going to
  build a bunch of apartments? can we go over there?") was answered with a
  verbatim recitation of the scaffold's level1 line. Root cause = prompt-priority
  inversion: unscoped "Never give direct answers"/"Socratic questioning" in
  `build_lesson_system_instruction` (`lumina_tutor.py:394-397`) beats the
  scaffold's own answer-then-redirect rule (`engineering.ts:152`) on a
  display-only primitive with nothing to protect. Separately: 7 Gemini-side
  connection deaths across the two sessions, resumption held 7/7 ≤500ms, but the
  visible one cut the tutor mid-sentence → ~17s dead air → re-orientation
  greeting instead of continuing ("the error where it disconnected"). Fixes =
  one prompt carve-out (curiosity questions get a real answer FIRST, one
  sentence, then bridge back; anti-leak rescoped to the active challenge) + a
  `[SESSION RESUMED] continue-don't-greet` injection + three riders ("(not set)"
  spoken aloud, switch-greeting debounce, chunk-inflated `session-end` turns).
  **Autonomous gate before the user re-drives:** new `lesson-curiosity` Tier-3
  journey in `run_tutor_live.py` replaying the child's exact 48s utterance blob
  (must FAIL pre-fix, then 3/3), fault-injected resume-continuity probe
  (`LUMINA_FAULT_MUTE_S` pattern, process-env only), 3 pytest units. Human
  acceptance = the next real-child drive (existing #64, no new row). Full
  analysis: `qa/tutor-reports/lumina-session-review-2026-08-05.md`; queue detail:
  `qa/di/BACKLOG.md` item 11.
- **Item 2 misconception consumption CLOSED 2026-08-04.** The restored
  `/add-misconception-loop` executor wired typed diagnosis→move resolvers and
  deterministic up-to-two-item emphasis across all four code-owned DI pools.
  Math pilot passed first, then the family Probe G matrix passed 11/11 with
  mode/scope/tier/count intact and zero diagnosis/remediation fields serialized;
  focused 91/91, full Vitest 1,569/1,569, Probe R 9/9, S4 pass. No wrapper prompt
  or spoken copy changed. Report `qa/misconception/di-family-2026-08-04.md`.
- **Latest closures (2026-08-04): requested serial run COMPLETE.** `di-math-facts` L4 now composes the DISTAR fade with the birth-certificate operand window: within-five → cross-five → cross-ten, clamped to the existing pool (normal within-ten K/G1 hard saturates at cross-five; no silent widening); 17/17 focused, 10/17 non-vacuity, live eval 10/10. `di-word-reading` L1 backfill adds `cvc_reading` β2.0 / preserved `read_word` β2.5 / `sight_word` β3.0 / `word_reading_review` β3.5 with real Fork-A single/blend/mixed pools; 12/12 focused and live pinned/blend/mixed PASS; the live sweep caught and closed the default review-window sight omission. Full Vitest passes 1,385/1,385; touched DI TypeScript errors 0 (global 805 vs 803 pre-slice due two concurrent unrelated math grade-band tests). Reports: `qa/eval-reports/di-math-facts-structural-difficulty-2026-08-04.md`, `qa/eval-reports/di-word-reading-evalmodes-2026-08-04.md`. **Item 2 remediation-lever DESIGN also CLOSED**: code-owned item re-ranking only, up to two targets + transfer, unknown/cross-mode no-op, no diagnosis sent to Gemini and no spoken-copy changes; pilot math subtraction then Probe G before sweep. Handoff `qa/di/HANDOFF-di-remediation-levers-2026-08-04.md`; implementation closed in the item 2 entry above.
- **Prior ladder closure (2026-08-03): di-letter-sounds L4 DONE.** The birth-certificate item-set axis now composes with the L3 fade: easy = unique continuants/no complete pair; medium = +short vowel/no pair; hard = `m/n` + `f/v` together at the default four-item capacity. Onset medium honestly saturates because vowels are forbidden by mode identity; hard still advances to the legal contrast pairs. The final composition window is enforced after mixed-mode rotation, closing the sentence-template variance trap. Gates: typecheck:lumina 0; tsc 803=baseline; new suite 17/17 incl. 2,048-set stress (10 fail on revert); full vitest 1320/1320; live eval-test 7/7. Existing #57 carries the live feel check; no new row. Report `qa/eval-reports/di-letter-sounds-structural-difficulty-2026-08-03.md`.
- **Queue:** `my-tutoring-app/qa/di/BACKLOG.md` — **GRADUATED 2026-07-20** (bench passed its
  architecture gate across 4 live runs; user call: DI = a new primitive FAMILY alongside
  core/math/literacy, first set custom-made). Old charter `qa/HANDOFF-di-bench-2026-07-16.md`
  is historical.
- **Executor skills:** `/primitive` (L0 birth per pack) + `/curriculum-fit` + `/eval-test` +
  `/tutor-test`; bench sitting per NEW response class before wiring (standing gate in the BACKLOG).
- **User-pulled 2026-07-16.** Test one turn controller over one Gemini Live audio session: exact
  I-do/we-do/you-do scripts, Live input/output transcription, and an asynchronous Flash-Lite JSON
  report that alone authorizes advance/retry.
- **DONE 2026-07-16 (POC slice):** **Direct Instruction Bench** (`di-bench`, home card 🎯).
  Shared Lumina owns only Live transport plus a generic ordered `structured_state_update` channel.
  `backend/app/services/di_turn_reducer.py` owns the DI schema, transcript aliases, and Flash-Lite
  reduction. `diBenchModel.ts` owns report parsing and authority (fresh aligned `match` advances;
  retry/unclear stays). `diScript.ts` owns exact pedagogy/cues; the panel owns orchestration and
  Copy-run-JSON diagnostics. The abandoned Azure phoneme/warm clip-judge branch was removed from
  shared production files. `typecheck:lumina` 0 errors; focused tests 11 frontend + 7 backend.
- **SUPERSEDED same-day (2026-07-16, live-judged pivot):** the Flash-Lite reducer was DELETED after
  run 1 of the live-judged rewrite PASSED (`qa/eval-reports/di-bench-live-judged-2026-07-16.md`).
  Live now judges in-band via sentinel openers ("Yes," / "My turn."); `diBenchModel.ts` classifies
  and alone advances; Gemini auto-VAD off, local amplitude VAD = turn authority (runs 3–4 tuned).
- **DONE 2026-07-18 (open-mic slice, user ruling: no force-mutes from the primitive):** echo gate
  removed from the bench VAD (speaking over the tutor = native barge-in); backend forwards Gemini
  `server_content.interrupted` → `ai_interrupted`, `LuminaAIContext` flushes playback on it (tutor
  audibly stops — generic transport, benefits all Live surfaces); cue pacing re-entrant (cues fire
  only into silence, held cues re-fire on audio-fall/voice-close/verdict edges); echo telemetry
  (`turnsOverTutorAudio`). tsc 0 new, vitest 12/12, py_compile OK. NOT live-exercised.
- **RUN 2026-07-19 (first open-mic live run): PASS on the full scripted loop** — 4/4 items affirmed,
  exact script fidelity, 4 clean VAD bracket pairs, **0 phantom turns**, cue cadence held; the Live
  judge affirmed a sustained /s/ from AUDIO while ASR wrote "Shh." (the architecture's thesis,
  demonstrated). Report: `qa/di-bench/run-2026-07-19-open-mic.md`. **Barge-in and speaker-echo were
  NOT triggered in this run** (no `ai_interrupted` in the backend log) — HUMAN-CHECKS #30 narrowed
  to that ~2-min probe.
- **PROBE RUN 2026-07-19 (run 2, run JSON): barge-in + echo EXERCISED, #30 STRUCK.** Barge-in
  verified end-to-end (deliberate talk-over interrupted + judged; /sss/ over tutor audio affirmed
  from audio). Echo leakage = 1 blip (peak 0.033 vs threshold 0.025) that chopped a cue line.
  **Three findings promoted to build inputs** (`qa/di-bench/run-2026-07-19-open-mic-probe.md`):
  **DI-1 (BUG)** — a sentinel verdict with no transcript-backed attempt is silently dropped →
  bench/model desync → model self-advanced (read bracketed cue aloud) → wrong-item credit; engine
  must anchor attempts to LOCAL voice-turn close, bind unanchored verdicts to the last unmatched
  voice turn, resync via re-cue after N off-script. **DI-2** — dual threshold: turn-open bar during
  tutor audio ≈ 2× silence bar (echo 0.033 vs real speech ≥0.068); calibration beat measures both
  floors. **DI-3** — ignore attempts until the first cue begins.
- **SHIPPED 2026-07-19:** open-mic slice + run reports committed `6635877` (+ QA docs `10b17d9`);
  main pushed & in sync.
- **Extraction step 1 DONE + RUNTIME-VERIFIED 2026-07-20, committed `4af21b6` (#32 struck):**
  `hooks/voiceTurnMachine.ts` (pure turn authority, DI-2 dual threshold, vitest 7/7 incl. the
  probe-run echo regression) + `hooks/useLiveVoiceTurns.ts` (activity brackets, ambient/echo EMA
  floors) + bench as pilot consumer. **User live run PASS**
  (`qa/di-bench/run-2026-07-20-hook-parity.md`): 4/4 items, **0 unanchored verdicts, 0 echo-opened
  turns** (floors 0.0008/0.0082 vs 0.05 barge-in bar — ~6× margin), barge-ins interrupted + judged,
  response times improved (1706/1192ms vs probe 2986/1882ms). New engine input from the run:
  a mid-cue attempt can consume a cue FRAGMENT as its verdict (benign off-script) — verdict
  classification must only consume tutor output that begins a NEW turn after the attempt closed.
- **Extraction step 2 CODE-COMPLETE 2026-07-20 (uncommitted):** the judged-loop engine.
  `hooks/judgedLoopModel.ts` (pure reducer: voice-anchored attempts DI-1 — attempts exist at LOCAL
  voice-turn close, transcripts only annotate; sentence-scoped sentinel scanning — fixes the
  mid-cue-fragment misread; off-script only on sentence+quiet; DI-3 arming; no-verdict timeout 8s;
  resync emission after 2 misses; vitest 13/13, every case traced to a live-run shape) +
  `hooks/useJudgedSpeechLoop.ts` (conversation feed, tutor-quiet clock, tick, cue queue with
  verify-beat + fire-into-silence; disable keeps the queued closing cue, clearQueuedCue for abrupt
  stops) + bench rewritten as pilot consumer (owns only DI pedagogy: script, progression policy,
  alias cross-check, run log; `classifyTutorJudgment` deleted from diBenchModel — collision test now
  runs against engine DI_SENTINELS). typecheck:lumina 0, full suite 844/844.
- **Step 2 RUNTIME-VERIFIED 2026-07-21 + COMMITTED (#33 struck):** user run PASS
  (`qa/di-bench/run-2026-07-21-engine-gate.md`) — 4/4, 0 unanchored, and the crown jewel: the
  probe run's transcript-loss failure RECURRED live (voice turn, no transcript, "Yes, sss.") and
  the voice-anchored attempt absorbed it — judged, advanced, no desync. Off-script-at-quiet
  exercised (tutor re-modeled without the "My turn" opener; engine stayed correctly). Resync/
  timeout unit-covered, not yet observed live (watch-items). Primitive note: tutoring directive
  should remind that EVERY correction begins "My turn:" (model dropped it on a re-correction).
- **DONE 2026-07-20 — `di-letter-sounds` BORN L0** (BACKLOG item 1 struck). First custom-made pack
  over the committed engine stack: new family `primitives/visual-primitives/direct-instruction/`
  (`DiLetterSounds.tsx` + hand-authored `diLetterSoundsScript.ts`), `catalog/di.ts`,
  `service/direct-instruction/gemini-di-letter-sounds.ts` (Fork A menu-scoped generator, no
  hardcoded items), `registry/generators/diGenerators.ts`, evaluation metrics + a
  `direct-instruction-tester` dev panel. typecheck:lumina PASS; eval-test PASS ×3 (topic fidelity
  confirmed); curriculum-fit MATCH (K LA Letter-Sound Correspondence, 0.788 — the starved GK band).
  Birth cert + 6-layer follow-up queue: `qa/eval-reports/di-letter-sounds-birth.md`. **Live loop
  UNVERIFIED through the primitive → HUMAN-CHECKS #36** (engine 4 runs PASS). Two L0 gaps to
  `/add-tutoring-scaffold`: lesson-mode connect needs `manual_activity`+DI-tutoring through the
  shared session; add `subject_for_domain('di')→LANGUAGE_ARTS` to the retrieval matcher.
- **LIVE LOOP VERIFIED 2026-07-21 (HUMAN-CHECKS #36 STRUCK):** user drove `direct-instruction-tester`
  with a real mic — **PASS end-to-end through the primitive**, and the backend log confirms the FULL
  data loop fired on submit (curriculum resolve → score 9.2/correct → competency + calibration
  item_beta=2.96 θ=4.71 P=0.92 + mastery lifecycle + +38 XP). **di-letter-sounds L0 is now fully
  runtime-verified; its lifecycle ladder is UNBLOCKED.** Watch-item (not a defect): the standalone
  submission mapped to LA001-01-a "Decode short vowel CVC words" (runtime Gemini re-mapper), not the
  birth-cert home "Letter-Sound Correspondence" — expected under the L0 lesson-mode gap; raises the
  priority of `/add-tutoring-scaffold` carrying the objective's subskill instead of re-deriving.
- **DONE 2026-07-21 — di-word-reading bench set WIRED (BACKLOG item 2 in progress).** The single-word
  response class is a standing-gate-1 bench sitting before `/primitive`; the bench already models
  `kind: 'word'` end-to-end, so this was content + a set toggle, no engine work. Added
  `WORD_READING_PROBE_ITEMS` (10: sam·mat·pig·dog·sun·red·cup + sight the·see·go; near-neighbours
  matt/son/read/sea left in to stress over-affirmation) + `BENCH_SETS` registry in `diScript.ts`,
  and a **Letter sounds ⇄ Word reading** set toggle in `DirectInstructionBench.tsx` (letter-sounds
  set untouched). typecheck:lumina PASS. **Probe sitting PENDING → HUMAN-CHECKS #41** (mic run).
  Gate: judge reliable on lone words → `/primitive`; over-affirms neighbours → log the failure class.
- **DONE 2026-07-22 — di-letter-sounds L1 eval-modes (birth-cert follow-up #1 struck).** 3-mode
  ladder, task identities all within the benched continuant response class: `letter_sound` (β1.5,
  base focused cluster), `letter_sound_review` (β2.5, cumulative mixed-set — anchors the recent
  focus then broadens across the menu so it isn't a copy of the base cluster), `first_sound_in_word`
  (β3.5, onset isolation from a spoken word; continuant keywords only, NEW hand-authored DISTAR cue
  lines + picture/word stage so the lone grapheme never leaks the onset). Fork A: `resolveEvalModes`
  routes intent→mode, code builds+stamps `challengeType` (no Gemini enum to constrain); the mixed
  path interleaves all three modes staggered so it never stacks one keyword (SP-21). Wired
  `catalog/di.ts` evalModes + backend `problem_type_registry.py` (β mirrored) + metrics union +
  eval-test validator reads `challengeType` + tester mode selector. Verified: real-Gemini eval-test
  PASS ×4 (each pinned mode single-type; onset drops vowels; mixed = 3-type interleave) + keepable
  oracle `gemini-di-letter-sounds.test.ts` (4/4); typecheck:lumina clean of this work. **New onset
  live-tutor wording UNVERIFIED live → HUMAN-CHECKS #42.** Ladder next = `/add-tutoring-scaffold` (L2,
  birth-cert follow-up #2: move DI block into catalog `tutoring:` + wire the lesson-mode connect gap).
  Report: `my-tutoring-app/qa/eval-reports/di-letter-sounds-evalmodes-2026-07-22.md`.
- **DONE 2026-07-22 — `di-word-reading` BORN L0 (BACKLOG item 2 struck).** Second custom-made pack
  over the committed engine (separate pack; letter-sounds files untouched; no hooks/ change):
  `DiWordReading.tsx` + hand-authored `diWordReadingScript.ts` (DISTAR two-branch cues — CVC
  sound-out "sss-aaa-mmm… sam" / sight whole-word; STRICT near-neighbour judging contract; handoff's
  classic "My turn." model opener re-worded to "I'll sound it out…" — sentinel collision) +
  `gemini-di-word-reading.ts` (Fork A: 30-CVC-by-vowel + 8-sight menu in code, Gemini enum-selects,
  vowel/sight scope CODE-enforced) + full registrations (catalog single `read_word` β2.5, backend β,
  metrics, registry, ComponentId) + a **Letter Sounds ⇄ Word Reading primitive picker** in the
  direct-instruction-tester (no cloned tester). Answer-leak inversion honored: printed word ONLY
  before the read; emoji = post-affirmation reward; sight words just affirm. **Standing gate 1
  (bench sitting #41) WAIVED by user ruling 2026-07-22** — near-neighbour stress folded into the
  live-loop check. typecheck:lumina 0; eval-test PASS ×4 (named/generic/sight/short-a scope);
  curriculum-fit **MATCH @ G1 LA001-01** (K = diffuse vote-splitting across sibling CVC families,
  not a gap). Birth cert + 6-layer queue: `qa/eval-reports/di-word-reading-birth.md`. **Live loop
  NOT yet driven → HUMAN-CHECKS #43 is the real L0 gate** (mirror of #36; also carries the
  near-neighbour stress + resync/timeout watch-items).
- **DONE 2026-07-23 — di-letter-sounds L2 tutoring scaffold + FAMILY lesson-mode wiring
  (birth-cert follow-up #2 struck; both carried L0 gaps CLOSED).** DI tutoring block moved to
  `catalog/di.ts` `tutoring:` (+contextKeys challengeType/letter/keyword/letters, +3
  commonStruggles; sentinel-collision re-checked). Shared wiring, benefits the whole family: new
  `ComponentDefinition.audioInput` — both DI packs declare `{manual_activity:true}` in the catalog;
  `connectLesson` scans the manifest and opens the shared Gemini session with it (audio config is
  connect-time-fixed); `switch_primitive` carries tutoring + audio_input; standalone connect falls
  back to the catalog (component's explicit passes removed). Subskill carry comes free in lesson
  mode (ManifestOrderRenderer injection) — ends the 07-21 re-map watch-item.
  `subject_for_domain('di')→LANGUAGE_ARTS` added (REVISIT at di-math-facts). Generator grew a flat
  `letters` field; component syncs per-item RUNTIME STATE via silent updateContext. Verified:
  typecheck:lumina 0; tutor-test Tier 1 PASS (0 HIGH) + Tier 2 probe PASS (0 `(not set)`) —
  `qa/tutor-reports/di-letter-sounds-2026-07-23.md`. **Lesson-mode live loop → HUMAN-CHECKS #45**
  (incl. the mixed-lesson trade-off: DI-bearing lessons run manual VAD session-wide, non-DI chat
  turns won't open). **Committed `2e5814a` 2026-07-23** (L0 word-reading + L1 letter-sounds modes +
  L2 scaffold/lesson-mode wiring + useVoiceViewportGate all in one commit; tree clean).
- **#42 + #43 VERIFIED LIVE 2026-07-23/24 (both struck).** User mic runs: word-reading (sam·mat·cat·hat
  all read+affirmed, printed-word-only stage) + letter-sounds onset + mixed (SP-21 interleave m·s·f·s).
  User verdict: "a true awesome Lumina-native modality." Tester mode-switch kickoff bug fixed
  (`DirectInstructionPrimitivesTester` remounts the pack per Generate via `runKey` — components kick off
  a mic gesture and don't reset on new data; a lesson gives each objective a fresh instance so it's a
  tester-only artifact). typecheck:lumina 0; **needs the same mode-switch glance to confirm live.**
- **PHASE SET 2026-07-24 (user): "more DI packs" — content density within DI** (voice-transport
  unification stays PARKED; not this phase). WIP unchanged (reader-fit TOP + DI).
- **#46 math-facts probe sitting PASSED 2026-07-24 (struck; user: "worked great!").** Number words
  judged reliably from audio: 3/3 affirmed, aliasAgree 3/3 (ASR wrote WORDS — digit aliases never
  needed), 0 unanchored/phantom/echo-opened, commit lag ~933ms CONSTANT → silent response-time viable
  as the fluency signal. Carried to the primitive's L0 live loop (mirror of #41→#43): fact correction
  branch never fired (3/10 items, all correct) + homophone stress. Sentinel gate 2 resolved: engine
  defaults kept. Report + run JSON: `qa/di-bench/run-2026-07-24-math-facts-probe.md`. (Probe wiring
  `8e30a52`; ship-prereq slices `ec6d16e` ledger-gate fix — DI gens were the last legacy registrations,
  context-native migration now 100% — + `7283ef5` tester runKey + `d99ad29` charter/reconcile.)
- **#3 di-math-facts — BORN L0 2026-07-24 (BACKLOG item 3 STRUCK; the first custom-made set is
  complete: three packs at L0+).** Third DI pack, first MATH pack — `DiMathFacts.tsx` +
  hand-authored `diMathFactsScript.ts` (bench-proven #46 cue wording; strict on a different number,
  permissive on th-fronting/counting-up) + `gemini-di-math-facts.ts` (Fork A code-owned fact pool,
  scope code-enforced named→make-10→doubles→within-N→grade default, wrapper leak-guard) + full
  registration (catalog `answer_fact` β2.0 + audioInput, registerContextGenerator, metrics union
  incl. silent `meanResponseMs` fluency signal, backend registry, tester picker). Verified:
  typecheck:lumina 0; vitest 915/915; backend pytest = HEAD baseline (0 new); real-Gemini eval-test
  **PASS 6/6** (30 challenges programmatically recomputed); curriculum-fit **MATCH ×2** (K OPS001-03
  fluency-within-5 0.785 / G1 OPS001-01 addition-within-10 0.830). EVAL_TRACKER row added
  (358/375). Birth cert + ladder queue: `qa/eval-reports/di-math-facts-birth.md` (L1 candidates
  counting_next / fact_review / subtraction_fact — all still number words, the benched class, so no
  new bench sitting gates the ladder).
  **L0 gate NOT closed: the live loop has never been driven → HUMAN-CHECKS #48**, carrying three
  named stresses — (a) the fact CORRECTION branch ("My turn: …") has never been heard live (the #46
  bench sitting was all-correct) + the live half of the sentinel-opener judgment, (b)
  homophone/over-affirmation stress (one/won, two/too, four/for, eight/ate), (c) the submit must
  attribute to MATHEMATICS (OPS001), which is what exercises the new subject override at runtime.
- **DONE 2026-07-24 — di-math-facts L1 eval-modes (birth-cert follow-up #1 struck).** User chose the
  FULL birth-cert ladder: `counting_next` (β1.5) / `answer_fact` (β2.0, L0 unchanged) /
  `fact_review` (β2.5) / `subtraction_fact` (β3.0). **Standing gate 1 satisfied with NO new bench
  sitting** — every mode answers with a spoken NUMBER WORD, the class benched in #46. The
  bench-proven L0 cue wording survives byte-for-byte: the L0 lines were already phrased around
  `it.problem`, so all four skills read through the same proven sentences ("three minus one is two",
  "the number after five is six") — the ONLY type-aware line is the counting DIRECTION in the
  judging contract (subtraction counts back, not up). Fork A held (code owns pools/answers/aliases,
  stamps `challengeType`); new code-built `solvedDisplay` so the post-affirmation reward is right per
  skill ("5 → 6", not "5 → ? = 6"). Catalog description/constraints widened WITH a routing boundary
  ("use a dedicated counting primitive when counting itself is the objective") so the pack doesn't
  poach counting-board/number-line territory. Verified: real-Gemini eval-test **PASS ×8** (4 pinned
  single-type + mixed = all-four interleave (SP-21) + curated blend), **40/40 challenges recomputed
  correct**, and `/topic-trace` on a real K subtraction topic routed manifest →
  **`subtraction_fact`** end-to-end — intent routing was NEWLY live (with one mode the resolver
  short-circuits to mixed, so this path had never run for this pack). typecheck:lumina 0; full tsc
  0-new (1021 pre-existing legacy); vitest **915/915**. One design gap caught by the run and closed:
  `fact_review` on a doubles objective drew ZERO doubles — anchors now hold for any scope.
  EVAL_TRACKER 361/378. **The 3 NEW modes' cue wording is UNVERIFIED live → HUMAN-CHECKS #49, which
  folds into #48 (one mic sitting closes both).** Report:
  `qa/eval-reports/di-math-facts-evalmodes-2026-07-24.md`. Deferred by design: G3
  `multiplication_fact` (needs its own curriculum-fit + grade gate) and missing-addend (L4).
- **DONE 2026-07-25 — di-math-facts L2 tutoring scaffold (birth-cert follow-up #2 struck; the pack is
  now L2 one day after birth).** `DI_MATH_FACTS_TUTORING` moved from `diMathFactsScript.ts` into
  `catalog/di.ts` `tutoring:`, so both connect paths (standalone fallback + lesson
  auth/`switch_primitive`) resolve it from the single source of truth. **No transport work needed** —
  di-letter-sounds' 07-23 L2 slice already built the family lesson-mode wiring, which is exactly the
  leverage that slice was for. The bench-proven cue lines + `judgingContract` are untouched,
  byte-for-byte. Added AT this layer (the L0 block had none of it): `contextKeys`
  (challengeType/display/problem/facts — **stimulus side only**; `answerWord`/`solvedDisplay` stay
  out because the tutor already gets the answer inside the `[DI_ITEM]` contract and RUNTIME STATE is
  echoed far more loosely than a scripted line), 4 `commonStruggles`, and one NUMBER WORDS clause
  aimed at the #48 homophone stress (judging is by SOUND, so a homophone of the TARGET number is the
  target — "won"/one, "too"/two, "for"/four, "ate"/eight; the "a DIFFERENT number is always wrong"
  rule is untouched). Component drops its local `tutoring:` arg and gains an `updateContext` effect
  (silent channel, never perturbs the judged loop); generator attaches the flat `facts` summary so
  RUNTIME STATE is populated from the first auth-time prompt (mirrors letter-sounds' `letters`).
  Verified: tsc **0 Lumina-surface errors**; `/tutor-test di-math-facts` **0 HIGH** — 2 WARNs that
  are the DI family's SHAPE, not defects (`data-bag-unparsed`: DI connects via
  `ctx.connect`/`updateContext`, not a `useLuminaAI` bag the auditor can parse; `no-sendtext-moments`:
  DI cues ride `[DI_ITEM]`/`[DI_MOVE_ON]`/`[DI_COMPLETE]` through the judged-loop engine, so the
  tutor cannot go silent) — di-letter-sounds carries the identical pair. Tier-2 probe on TWO modes
  (`answer_fact` @ K, `subtraction_fact` @ G1) shows all 4 keys resolving with real values, **no
  `(not set)`, no answer in RUNTIME STATE**. Report: `qa/tutor-reports/di-math-facts-2026-07-25.md`.
  **Tier-3 rides #48/#49** — the new struggle/homophone copy is exercised by the same mic sitting
  that drives the correction branch, so no new human gate was created.
- **L0 LIVE GATE CLOSED 2026-07-25 (user mic run — "worked great!") — di-math-facts is now
  runtime-verified at L0 + L1 + L2.** `subtraction_fact` / "subtraction within 5": **5/5 affirmed**
  + recap. One sitting closed three layers: the judged loop end-to-end (no desync/stall/phantom),
  the reworked reward beat (audio-edge pacing holds live — not flagged as dragging or clipping),
  and the **first live run of the catalog-resolved L2 scaffold** — the tutor held the scripted lines
  across 5 items, so the 4 added `commonStruggles` did NOT loosen it into chattiness (the named risk
  of adding them). `subtraction_fact` cue wording + code-built `solvedDisplay` confirmed live (#49b).
  HUMAN-CHECKS **#48 struck**. **Residual: third consecutive ALL-CORRECT sitting** — the correction
  branch has still never been heard, the L2 homophone clause has never been exercised, and the
  MATHEMATICS submit attribution is unconfirmed; all three need a deliberately WRONG answer →
  new HUMAN-CHECKS **#50**. Report: `qa/eval-reports/di-math-facts-live-2026-07-25.md`.
- **DONE 2026-07-25 — di-math-facts reward beat (user browser check, same session as L2).** The stage
  showed the NEXT problem while the LAST answer's equation sat in a chip below it — two facts at once,
  overload at K. Fixed in two halves: the completed equation now REPLACES the printed problem in the
  big slot (never stacks under it), and `advance()` is deferred to a reward beat instead of firing at
  verdict time. **The beat is edge-driven, not timed** — the engine already sends the next `[DI_ITEM]`
  cue 400ms after the tutor's audio falls (`VERIFY_BEAT_MS`), so the visual rides that same falling
  edge and the swap lands exactly when the tutor stops talking about this fact (900ms floor, 3s cap,
  and `attempt-open`/`resync` flush the beat so a resolved fact is never up while the child answers
  the next one). Verified: new jsdom suite `DiMathFacts.reward-beat.test.tsx` **6/6**, non-vacuity
  probed (reverting the deferred advance fails 2 of them, reverting the in-place render fails a 3rd);
  full vitest **921/921**; tsc 0 Lumina errors. **The FEEL still needs the mic — HUMAN-CHECKS #48
  updated**, since its old text described the behavior this replaced. Reinforces the July
  retrospective's antipattern #1: the 07-24 answer-leak fix was tsc-and-eval-green and still shipped a
  UX regression that only a human at the browser could see.
- **STANDING GATE 1 PASSED 2026-07-25 (user mic sitting — "this worked so well!") —
  `di-sentence-reading` is CLEARED FOR `/primitive`, and it is now the stream's top pull.**
  10/10 items, 10 affirmed / 3 corrected / **0 off-script / 0 unanchored**. **The make-or-break
  answered YES 2/2:** two deliberate one-word OMISSIONS inside 6- and 7-word sentences ("big",
  "red") were both caught and corrected, both retries affirmed — omission is the hardest error class
  to hear, and a rubber-stamp there would have killed the pack. **Whole-sentence correction is
  settled** (learner self-repaired on the first retry both times → word-targeting, and its
  off-script risk, is unnecessary). **Restating affirm stays** (~2-3s against a ~15-17s cycle whose
  dominant term is learner think-time, 8-11s — tutor talk is not the bottleneck for connected text).
  **One ship-blocking finding, cheap:** a read sentence splits into TWO voice turns (3
  supersessions) because `silenceCloseMs: 500` is tuned for one-word answers — a mid-sentence pause
  is part of the response. It broke the alias cross-check (BOTH alias disagreements trace to the
  split, not judge error) and nulled `responseMs` on second fragments; the pack passes ~1100ms via
  `useJudgedSpeechLoop({ voice: { config } })` and the family default stays 500ms. Scope confirmed
  3-8 words, no ceiling found. Residual → HUMAN-CHECKS **#53** (short end unstressed; item 1
  transcribed "the car" yet affirmed — ASR artifact or false affirm, unresolved). Report:
  `qa/di-bench/run-2026-07-25-sentence-reading-probe.md`.
- **Context for the above — QUEUE REOPENED 2026-07-25 (user phase call: "can we turn
  read-aloud-studio into a DI-style primitive?") — 4th pack = `di-sentence-reading`.** Ruling: **fork,
  do NOT convert.** `read-aloud-studio` is live (3 eval modes accuracy/expression/dialogue with
  calibrated βs, `supportsEvaluation`, a `problem_type_registry` row) so the manifest can route to it
  today; rewriting its modality in place would silently change what those eval modes MEAN and
  invalidate their calibration — the contract-first fork-on-conflict case. The new pack takes judged
  short-sentence accuracy at G1-2; read-aloud-studio keeps passages, WPM, and expression/dialogue for
  older readers, where self-assessment is defensible. **Why it's worth a pack:** read-aloud-studio's
  own catalog says *"Student self-assessment only, no AI speech grading"* — it has a mic, records,
  tracks WPM, and judges nothing, so it produces no evidence the IRT model can use. This is
  `feedback_production-modality-roadmap` exactly. **Standing gate 1 honored:** connected text is the
  family's biggest response-class jump (every benched class so far is a SHORT production judged
  whole), so it benched before wiring — `kind: 'sentence'` + a 10-item `Sentence reading` probe
  (3→8-word ladder, word-reading vocabulary carried over, one-word-error stress: hen/pen, hat/hut,
  a repeated phrase where omission is easy). The sentence branch gets its OWN judging criteria: the
  generic "reasonably close for a kindergartener" is right for one short production and WRONG for
  connected text, where "close" rubber-stamps the dropped word fluency exists to catch. Bench tests
  **22/22**, tsc 0 Lumina errors. **The sitting (HUMAN-CHECKS #51) decides three things:** (a) can
  Live detect a ONE-WORD error in a 5-8 word utterance — make-or-break; (b) whole-sentence correction
  vs. word-targeted (which costs off-script risk); (c) does the restating affirm drag at sentence
  length. `/primitive` only after it passes.
- **DONE 2026-07-25 — `di-sentence-reading` BORN L0 (BACKLOG item 2 STRUCK). Fourth DI pack, the
  family's first CONNECTED TEXT pack, and the first born on a gate cleared the same day.**
  `DiSentenceReading.tsx` + hand-authored `diSentenceReadingScript.ts` — **every spoken line is
  byte-for-byte the bench's proven `kind:'sentence'` branch**, so all three sitting rulings ship
  intact: whole-sentence correction (no word-targeting and its off-script risk), the restating
  affirm kept, 3-8 word scope. `gemini-di-sentence-reading.ts` is Fork A over a **37-sentence
  code-owned decodable menu** (vocabulary carried from the word-reading menu so a miss is
  attributable to connected text, not new words; a model-written "sentence for a first grader"
  would be undecodable and turn every miss into a content bug). Full registration incl. catalog
  `read_sentence` β3.0 + `audioInput` + the L0 `tutoring:` block, backend β mirror, and a tester
  **Sentence Reading** picker with a per-pack `defaultGrade` (the tester had been sending
  kindergarten for every pack).
  **The ship-blocking bench finding landed in the same slice:** `silenceCloseMs` **1100ms**
  pack-level — a mid-sentence pause is part of one response, not the end of it. The family default
  stays 500ms; the three short-response packs are untouched.
  Verified: `typecheck:lumina` **0**; full tsc **0 Lumina-surface errors** (805 pre-existing, all in
  the legacy graveyard); vitest **936/936**; real-Gemini eval-test **PASS ×11** with every check
  programmatic — wordCount recomputed from text, benched ceiling, sentinel safety, wrapper leak,
  teaching order, vowel purity (`qa/eval-reports/di-sentence-reading-2026-07-25.md`);
  curriculum-fit **MATCH ×2** — G1 `LA003-01` Oral Reading Accuracy 0.824 (its top subskill,
  *"self-correct reading miscues by re-reading"*, is a near-verbatim statement of the judging
  contract) and G2 `LA001-05` Reading Fluency 0.807, **whose sibling subskills are
  read-aloud-studio's self-assessment territory — independent confirmation of the fork ruling**
  (`qa/curriculum-fit/di-sentence-reading-2026-07-25.md`). EVAL_TRACKER 362/379.
  **One real issue found + fixed by QA:** phonics scope was vowel OVERLAP, not purity — a "short a"
  objective was served "Sam has a red cup." (a/e/u). The pool now prefers vowel-SUBSET sentences and
  widens only if pure cannot fill the session; all five vowels now serve pure sets. (Automated
  checks had passed — this one only surfaced by reading the content.)
  **Departure worth knowing:** the tutoring block ships in the CATALOG at birth rather than the
  script (as the two older reading packs did), because di-letter-sounds' L2 slice already built the
  family lesson-mode wiring that resolves both connect paths from there — so lesson mode works day
  one. L2 still owns `contextKeys` / `commonStruggles` / RUNTIME STATE sync.
  Birth cert + 6-layer queue: `qa/eval-reports/di-sentence-reading-birth.md`.
- **L0 LIVE GATE CLOSED 2026-07-25 (user mic run — "it worked fantastically!") — the pack was born
  and runtime-verified the SAME DAY, a family first.** 4/4 affirmed, session completed + submitted,
  recap all-emerald. One sitting closed three things: the judged loop end-to-end through THIS
  component (its `applyVerdict` → `recordResult` → `advance` path, cue builders, and generator had
  never run together with a real mic), **the reward beat at SENTENCE length** — the named pacing
  risk, since the affirm restates the WHOLE sentence (~2-3s), well past what the 900ms floor / 3.5s
  cap were tuned against, and it neither dragged nor clipped — and the one-sentence stage invariant
  (the exact failure di-math-facts shipped and had to fix a day earlier).
  **Residuals are now both QUANTITATIVE, not behavioural → HUMAN-CHECKS #54:** (a) the
  `silenceCloseMs: 1100` fix has no numeric proof — the run did not visibly break, but its evidence
  (0 attempt-supersessions / non-null `responseMs` / `aliasMatch` true) lives in the `[DI eval]`
  console payload, not the UI; (b) the SHORT end (#53) and the correction branch stayed dark —
  **the fourth consecutive all-correct DI sitting through a primitive**, with `[DI_MOVE_ON]` still
  never fired in ANY pack. Note the difference from math-facts' equivalent gap: the sentence
  correction WORDING is bench-proven (3 corrections incl. the 2 deliberate omissions), so what is
  untested is only the COMPONENT's retry-in-place branch and 2-correction cap. Report:
  `qa/eval-reports/di-sentence-reading-live-2026-07-25.md`.
- **DONE 2026-07-25 — di-sentence-reading L1 eval-modes (birth-cert follow-up #1 struck). The pack
  went BORN → LIVE-VERIFIED → L1 in a single day.** Full 4-mode ladder: `decodable_sentence` (β2.5)
  / `read_sentence` (β3.0, L0 unchanged) / `sentence_review` (β3.5) / `sight_phrase_sentence` (β4.0).
  Standing gate 1 satisfied with **no new bench sitting** (every mode is the same response class) and
  — unlike di-math-facts, which needed one type-aware line — this ladder shipped with **ZERO new
  spoken copy**: the L0 script was already phrased around `it.text`, so all four skills read through
  the bench-proven sentences byte for byte. **Identities, not tiers:** `decodable_sentence` and
  `read_sentence` have different curriculum homes at different grades, and `decodable_sentence` gives
  the pack the **K home the birth's fit probe abstained on**. Verified: typecheck:lumina 0; full tsc
  0 Lumina-surface errors (803 pre-existing); vitest 936/936; backend β rows mirror the catalog;
  real-Gemini eval-test **10/10 clean** with per-mode **POOL** assertions rather than type stamps
  (all four modes render identically, so the route's own validator passes trivially) — incl. **mixed
  yielding all four types (SP-21)**. `/topic-trace` closed the routing path the tester structurally
  cannot reach: a sight-word objective → `sight_phrase_sentence` end-to-end, **newly live** (with one
  mode the resolver short-circuits). **Found + fixed in QA: `sentence_review` never broadened** — a
  short-a review returned 4/4 short-a, the base mode relabelled, because the model's picks (drawn
  from the focused prompt menu) crowded out the wide pool. **di-math-facts' `fact_review` bug in
  mirror image** — theirs drew zero focus items and lost the thread; this drew nothing else and lost
  the breadth; both are the same underlying question caught from opposite sides. Reports:
  `qa/eval-reports/di-sentence-reading-evalmodes-2026-07-25.md`,
  `qa/topic-traces/reading-sentences-with-sight-words-2026-07-25.md`. EVAL_TRACKER 365/382.
  **L1 VERIFIED LIVE the same day (user mic run on `sight_phrase_sentence` — "these are so good!");
  HUMAN-CHECKS #54(c) struck.** 4/4 affirmed, all four sentences from the sight-heavy pool → the mode
  means at runtime what the catalog claims, and the bench-proven cue lines carried a vocabulary
  (see/go/you/my/and) no prior sitting had spoken, which was the last plausible place for the ladder
  to have disturbed proven speech. **So di-sentence-reading is runtime-verified at BOTH L0 and L1 on
  its birth day** — a family first (letter-sounds took 1 day to its L0 gate, word-reading 1, math-facts 1).
- **DONE 2026-07-25 — di-sentence-reading L2 tutoring scaffold (birth-cert follow-up #2 struck). The
  pack ran L0 → live → L1 → live → L2 in ONE day.** Because it already shipped its catalog
  `tutoring:` block at birth (the deliberate departure — di-letter-sounds' L2 had already built the
  family lesson-mode wiring), L2 added precisely the omitted half: `contextKeys`
  (challengeType/text/wordCount/sentences), the **`{{challengeType}}` placeholder those keys make
  safe** (an unfilled `{{key}}` renders SILENTLY, so it could not ship before its key), 5
  `commonStruggles` drawn from behaviour actually observed in the bench sitting + both live runs, a
  generator `sentences` summary, and the component `updateContext` sync. Bench-proven aiDirectives,
  cue lines, and judging contract untouched byte-for-byte. **Sibling difference recorded:**
  di-math-facts keeps its ANSWER out of RUNTIME STATE; that reasoning does not transfer here, since
  the printed sentence is stimulus and target both — nothing is withheld. Verified: typecheck:lumina
  0; vitest 936/936; `/tutor-test` **0 HIGH** with the same 2 structural WARNs both siblings carry;
  **Tier-2 probe clean on 3 modes** (`probe.findings: []`, all keys real, and the `sentences` summary
  tracks the pinned mode's pool — proof L1 and L2 did not drift). The 5 `(not set)` strings are
  confined to `staticPromptPreview`, which by construction has no content to fill. **Tier 3 rides
  #54** — three of the five struggles only fire on a MISS, so the deliberately-wrong read exercises
  them; watch that 5 struggles don't loosen the scripted tutor into chattiness (math-facts cleared
  this with 4). Report: `qa/tutor-reports/di-sentence-reading-2026-07-25.md`.
- **DONE 2026-07-25 — di-sentence-reading L3 support tiers (birth-cert follow-up #3 struck). The pack
  ran L0 → L1 → L2 → L3 on its birth day.** Fits NONE of the skill's six archetypes (live-judged
  spoken production) and has **zero `showOptions`**, so the whole ladder is modality #2
  instruction-as-scaffold — the AngleWorkshop case. The sub-steps were already there: **DISTAR's
  model→guide→test IS a scaffold ladder.** easy = model+guide+test / medium = model+test / hard =
  **cold read**. In the SCRIPT (`leadInFor`), never a UI flag, exactly as the birth cert specified.
  **`hard` closes the answer-leak caveat the birth audit could not resolve** — the model line speaks
  the sentence before the child reads it (legitimate DI instruction, but an ECHO ROUTE); at hard the
  sentence never enters the block the tutor may speak. Never withdrawn at any tier: the printed
  sentence, the correction's re-model (gate 3), the restating affirm (bench (c)), the judging
  contract. **Tutor second-channel hole found + fixed:** L2's own `scaffoldingLevels` level 1 would
  have re-read the withheld sentence at hard. **Deliberate departure — no `tierSection` in the
  prompt:** under Fork A the model only picks sentence ids, so a tier line could only nudge CONTENT =
  structural difficulty by the back door. Verified: typecheck:lumina 0; full tsc 0 Lumina-surface;
  vitest **949/949**; new suite 13/13 with **non-vacuity proven** (5 fail when reverted). **A bad
  assertion of mine was caught in QA** — diffing content across tiers to prove "numbers never change"
  cannot work, since a same-tier control returned three different sets; the rule is established
  structurally instead. That control also **retires the L0 convergent-selection note** (L1's
  selection path introduced real variety). Report:
  `qa/eval-reports/di-sentence-reading-support-tiers-2026-07-25.md`.
- **DONE 2026-07-25 — contrastive correction (user ruling), di-sentence-reading + di-math-facts.**
  The first live correction run in ANY DI pack overturned the sentence pack's bench finding (b):
  a reader read "Mom got THE pot" **three times** against an identical whole-sentence re-model,
  because a re-model gives the learner nothing to diff their own words against. The bench's
  evidence for (b) was n=2, both OMISSIONS with first-retry self-repair — a SUBSTITUTION with no
  self-repair had never been seen. Corrections now NAME the error and contrast it
  (`My turn: not ⟨what they said⟩ — <correct form> Your turn. <ask>`), audio only, no screen
  change (user scope call). The sitting's stated blocker was inspected and does not hold —
  sentinels match OPENERS only (`matchesOpener`), so a mid-line slot carries zero engine risk;
  `correctionLine` survives byte-for-byte as the nothing-to-contrast fallback. Math also carries
  the user-named **echo misconception** (answering "2 + 1" with "one"). Verified typecheck:lumina 0,
  vitest **964/964**, new `diCorrectionContrast.test.ts` 15/15 (filled AND unfilled contrast lines
  still classify as `corrected`). **UNBENCHED per the family rule → HUMAN-CHECKS #55, riding the
  same mic run as #54/#50(a).** letter-sounds + word-reading still carry the old re-model — port
  only after #55.
- **DI misconception evidence — SHIPPED 2026-07-25 (BACKLOG item 1 struck; the ① below is DONE).**
  All four packs. A DI miss produced `{correct: false, score: 0}` and nothing else; it now produces a
  **Tier-A `DiagnosisEvidence` packet** — the child's transcript, the tutor's own judging sentence,
  and the earlier misses as `priorAttempts` — shipped as `submitResult`'s **6th** arg, with
  `misconceptionScope: 'primitive'` declared on all four catalog entries (the second gate, without
  which the packets are dropped before the distiller).
  **The handoff's step 1 was necessary but NOT sufficient — the finding worth carrying forward.**
  It said to expose the `verdictText` the reducer already computes. But the reducer classifies from
  the sentinel OPENER and fires immediately (by design — progression must not wait on a sentence),
  while Gemini forwards `output_transcription` in **sub-word chunks**. So `verdictText` is truncated
  at "My turn" — and for a contrastive correction the opener is exactly the part carrying **no
  diagnosis**. Shipping it as `judgeFeedback` would have produced a Tier-A packet that names nothing,
  **worse than honest Tier B**. Closed with a second additive emission: `useJudgedSpeechLoop` keeps
  accumulating past the verdict and emits **`verdict-text`** when the line completes. Reducer
  untouched; one place, not four.
  **Gate `/misconception-test di-math-facts` = PARTIAL, deliberately.** Probe D **10/10 draws**
  (3 GENERATIVE + 2 ABSTAINED, 0 LEAK, 0 OVERREACH, every packet at `tier=judge`) — and the abstains
  held on Tier-A packets, which was this design's likeliest failure mode. Probe R **CLOSED** (backend
  9/9, new DI scope case), S4 Firestore exposure **pass**. **Probe G is NOT-WIRED** → new DI BACKLOG
  item 1: no DI generator consumes `remediationFocus`, so a stored diagnosis changes nothing yet.
  That is a design question, not a missing import — DI's spoken copy is byte-frozen, so the only
  honest remediation lever is which ITEMS the pool draws. Verified: typecheck:lumina **0**, vitest
  **985/985**. Report: `qa/misconception/di-math-facts-2026-07-25.md`.
- **Next pull — ① is DONE (2026-07-25); ② is now the top pull.** *(The ① text below is kept as the
  reasoning trail for the slice that shipped.)*
  **① ~~DI BACKLOG item 1 — FAMILY-WIDE: the wrong answer's CONTENT is discarded~~ DONE 2026-07-25** (executor:
  `/primitive` follow-up or a dedicated slice; all four packs, component-owned). A miss IS recorded
  (`outcomes[]` carries `{correct, attempts, score}`; metrics carry `attemptsCount`/`firstTryCount`/
  `overallAccuracy`), but **WHAT the child said is thrown on the floor** — the engine emits
  `attempt-transcript` with `text` and every DI component keeps only `emission.responseMs`. So the
  data loop can see THAT a child missed `5 − 1` twice, never that they said "four" both times, which
  is a textbook diagnosable misconception. **📋 Handoff written `/pm` 2026-07-25:
  `qa/HANDOFF-di-misconception-evidence-2026-07-25.md`** (paste-able, line-exact).
  **User ruling — it feeds the FRONTEND misconception system, and the BACKLOG's "non-metric bag"
  fix shape is superseded:** the accumulation is right, the destination is wrong — the shipped
  channel is **`diagnosisEvidence`** (Misconception Loop S1), `submitResult`'s 6th arg. Two findings
  from the read change the job: **(1) `catalog/di.ts` declares no `misconceptionScope`**, so
  `captureMisconception` gate 3 drops every DI submission before the distiller — all four packs are
  invisible to the loop today; **(2) the ENGINE also discards the tutor's judging sentence**
  (`judgedLoopModel.ts:252-255` computes `verdictText`, emits only the `judgment`), and that
  sentence is what buys **Tier A** — the loop's highest-fidelity tier, written for judge-driven
  primitives, which DI is the only real instance of. Since contrastive correction landed, that
  discarded sentence NAMES the error. Template: `PhonicsBlender.tsx:540-566`. Gate:
  `/misconception-test di-math-facts`.
  **①ᵇ THE SITTING RAN 2026-07-25 AND DECOHERED — BACKLOG item 1. DIAGNOSED + FIXED + FIX
  VERIFIED LIVE 2026-07-26:** the channel was none of the four hypotheses — the voice turn gate's
  `minVoiceMs: 120` silently meant "three 85ms frames", so two-frame one-word answers were rejected
  while Gemini had already judged them → unanchored verdicts dropped → desync. Engine fix
  (framePeriodMs → `voicedMs`, retro-anchor, cue ledger) verified live same day: coherent
  `fact_review` run, first-ever live `[DI_MOVE_ON]` at the correction cap, contrastive correction
  held byte-identical (#55 math half). `qa/di-bench/run-2026-07-26-math-facts-turn-gate.md` +
  `-verify.md`. **Residual (now the top pull): the sustained-miss recipe run** — wrong on MOST
  items, same rule, mean < 60 — for multi-cap resync/rapid-retry stress + the S1 misconception
  capture (the 07-26 run's mean of 80 was correctly below the write gate). *(Original finding kept
  below as the reasoning trail.)* The user drove the consistent successor rule and the tutor + pack lost coherence.
  **No usable record survived**, and that is the first finding: the packs handled **5 of the 8**
  `LoopEmission` kinds and hit `default: return` on the three that MEAN desync
  (`attempt-superseded` / `phantom-transcript` / `unanchored-verdict` — the canonical DI-1 signal),
  and wired neither `onTutorText` nor `onVoiceTurnClose`, so nothing captured **what the tutor
  actually said**. The bench has had all of this since the open-mic runs, which is why every prior DI
  failure was diagnosable and this one was not.
  **Instrumentation landed in the same slice:** `diRunLog.ts` + `DiRunLogPanel.tsx` (shared, all four
  packs) give the primitive path bench parity — a coherence-flag row first, then attempts / affirmed /
  corrected / move-ons / resyncs / echo-opened / mean response + commit lag, and **Copy run JSON**
  mirroring the bench payload. Verified `typecheck:lumina` 0, full vitest **997/997**, new
  `diRunLog.test.ts` 12/12 with **non-vacuity proven** (reverting the three captures fails 5).
  Logging is write-only and cannot influence progression.
  **Ruled out, don't re-chase:** the misconception slice (`awaitingJudgeTextRef` is pure
  record-keeping, cleared on `attempt-open` and reset, never gates progression) and `off-script`
  (handled correctly — returns and keeps listening). **Live hypotheses:** `[DI_MOVE_ON]` at the
  correction cap (a consistent wrong rule caps EVERY item, and move-on has never fired live in any
  pack), resync fighting the tutor's own in-band re-elicitation, contrastive-correction drift (#55,
  still UNBENCHED), unanchored verdicts under rapid retry. **Cheap bisect:** the same rule in the
  always-instrumented `di-bench` math-facts probe separates an engine fault from pack orchestration.
  **② Then the mic sitting, RE-RUN with the panel open (#54 + #50 + #55 + #49(a)/(c) — ONE run).**
  ① is landed, so the ordering already paid off: this is the **first deliberately-WRONG DI run ever
  driven**, and it now produces the family's first recorded wrong-answer transcripts, judge
  sentences, and a real distiller call instead of ears-only evidence. It is also the S1 live-capture
  check no probe can reach — watch the console for
  `[captureMisconception] stored for di-math-facts: …` (or `abstained: …`, which is success) — and the
  gate that unblocks **porting contrastive correction to di-letter-sounds + di-word-reading** (family
  rule: the rewording is UNBENCHED until #55 closes).
  **③ Then the ladder.** di-sentence-reading `/add-structural-difficulty` (L4) — axis already built
  and measured (sentence LENGTH, carried as `wordCount` + `meanSentenceWords`), with one hard
  constraint: the **8-word benched ceiling is not a difficulty knob**; raising it needs a new bench
  sitting, not an L4 decision. Alternatives at the same rung: **di-math-facts `/add-support-tiers`
  (L3)** (birth cert already specifies the fade — easy = model+guide+test / medium = model+test /
  hard = test-only cold — as a per-tier cue variant in the SCRIPT, never a UI flag; di-sentence-reading's
  L3 is the worked template), di-word-reading catalog `tutoring:` move (L2), di-letter-sounds
  `/add-support-tiers` (L3).
  A **fifth pack** is a user phase call, not a queue default — the remaining benched-class gap is
  blends; a "counting sequence" pack is no longer a candidate at all (`counting_next` absorbed it).
  **Human gates in leverage order:** the ② sitting, then **#45** (DI in a real K lesson — the
  evidence that would justify un-parking voice-transport). #48 struck; #53 folded into #54(b).
- **DONE 2026-08-01 — di-math-facts L3 support tiers (birth-cert follow-up #3 struck; second pack at
  L3, first MATH pack tiered).** The ladder rung the 08-01 re-point named, executed on
  di-sentence-reading's L3 template point-for-point: zero `showOptions`, so the whole ladder is
  modality #2 instruction-as-scaffold over **DISTAR's own model→guide→test** — easy = model+guide+test
  (byte-for-byte the #46 bench-proven block) / medium = model+test / hard = **cold answer**, composed
  in the SCRIPT (`leadInFor` + `coldAnswerGuard` in `diMathFactsScript.ts`), never a UI flag.
  **`hard` matters MORE here than in the sentence pack:** the screen never shows the sum (answer-leak
  rule), so the model line was the ONLY pre-attempt channel carrying the answer — at hard the item
  becomes a genuine **retrieval probe**, and silent `responseMs` becomes true retrieval time instead
  of partly echo delay. Never withdrawn: printed problem, correction re-model (gate 3, plain AND
  contrastive), restating affirm, judging contract (byte-identical across tiers, test-pinned).
  **Tutor second-channel audit came back CLEAN, unlike the sibling** — level 1 repeats the QUESTION
  (stimulus, on screen), not the target; the fact-modeling levels/struggles are all post-attempt
  remediation = correction territory; audit note recorded in `catalog/di.ts`. Channel closed anyway:
  per-item cold-answer guard + `supportTier` contextKey (connect payload / `updateContext` /
  `startDiRunLog`) + one cold-items clause in the LIVE-JUDGED directive. Same Fork-A departure as the
  sibling: **no `tierSection` in the prompt** (a tier line could only nudge the fact RANGE =
  structural difficulty by the back door; operand structure is L4's axis). **Family gap closed in the
  same slice: the direct-instruction-tester had NO difficulty control**, so no DI tier (incl. the
  sibling's #54(d) hard cold-read check) was actually drivable — added the tier selector riding the
  eval-test route's existing `?difficulty=` tap. Verified: typecheck:lumina **0**; vitest
  **1041/1041** (new suite 14/14, non-vacuity proven — 5 fail when hard is reverted); **and 3/3
  probes through the REAL pipeline** (dev server + real Gemini): pinned `answer_fact`+hard → all
  challenges `'hard'`, scope intact; `mixed`+medium → the SP-21 four-identity interleave ALL got the
  tier (the gate-on-tier-not-mode rule live); no param → no field (pre-L3 byte-compatible). Live
  `hard` ear-check folded into **#50(d)** (rides the deliberately-wrong sitting). L4
  `/add-structural-difficulty` now unblocked. Report:
  `qa/eval-reports/di-math-facts-support-tiers-2026-08-01.md`.
- **`subject_for_domain('di')` REVISIT — RESOLVED AND NOW COMMITTED (`/pm` 2026-07-25 correction of
  its own 07-24 note).** The 07-24 line called this "resolved in the working tree (uncommitted)";
  that is now stale — `curriculum_retrieval_service.py` (`_PRIMITIVE_TO_SUBJECT`
  `di-math-facts → MATHEMATICS` + `subject_for_primitive()`, per-primitive override wins and the
  domain default falls through), `curriculum_mapping_service.subject_for_primitive()` and
  `submission_service` (passing `ctx.primitive_type`) all shipped in **`7be0883`**; the working tree
  carries none of them. The DI family can span subjects without splitting the domain. The ONLY
  uncommitted backend file is `problem_type_registry.py` (the L1 β mirror, part of the DI slice).
  **Still unverified at runtime** — a math-facts submission must be seen resolving to MATHEMATICS
  before this is called done; that check is HUMAN-CHECKS #48(c), same sitting as the data-loop trace
  that closed #36.
- **REGISTER GAP CLOSED (`/pm` 2026-07-24): the DI family was invisible in `qa/EVAL_TRACKER.md`.**
  Two shipped, eval-tested packs (di-letter-sounds 3 modes, di-word-reading 1 mode) had passing
  eval-tests with reports on disk but no dashboard row — so the tracker under-reported the portfolio
  and a session reading it would not know DI primitives existed. Backfilled from the committed
  reports (no re-run): totals 353/370 → **357/374**, 0 new open issues. Standing correction recorded
  in the tracker: a DI `/primitive` / `/add-eval-modes` run writes its row like any other primitive.
  `di-math-facts`'s row is owned by the in-flight session and lands with its birth cert.
- **Still open (not blocking the phase): HUMAN-CHECKS #45** — DI in a real K lesson (L2 lesson-mode
  behavior + the mixed-lesson VAD trade-off measurement). Worth running opportunistically; it's the
  evidence that would later justify un-parking voice-transport.
- **WIP note:** the 07-16 "proof-of-concept, not a build" framing is RETIRED (user call
  2026-07-20) — the bench proved the architecture; DI is now a build stream. ACTIVE = reader-fit
  (top) + DI = **2 ACTIVE, within the 2+1 limit.**

*(SP-27 Tutoring Context Integrity + media-player reimagining + voice-transport unification all
PARKED — see PARKED table. WIP = **2 ACTIVE + 0 DELEGATED** (reader-fit TOP-PRIORITY + DI family),
within the 2+1 limit as re-verified 2026-07-24; DI is the only lane with activity since 07-21.)*
