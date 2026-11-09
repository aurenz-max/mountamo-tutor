# Birth Certificate — wonder-walk (2026-11-05)

**Lifecycle layer: L0 (born)**: one core mode, bound to the teaching workspace, content written by an author agent under code checks.

- Core task identity: `which-one`. A scene teaches the idea with one example; the child taps which of 2-3 pictures fits the idea. The right picture is never the scene's example.
- Generator: an agentic author (deep-dive pattern, smaller). `service/core/wonder-walk/agent-wonder-walk.ts` runs plan_walk / write_stop / remove_stop / finish, with `checks.ts` on every write and an independent solve (`review.ts`) at finish that sends stops back once. Code owns the pictures (the word library's reviewed emoji, `pictures.ts`), option order (seeded shuffle, correct position varied), ids and every leak rule. One scene image per stop renders in the background; a stop whose image fails shows its emoji row.
- Workspace binding: `wonderWalkWorkspace.ts` + `wonderWalk.card.ts` + `wonderWalk.boss.ts` on the tap preset (`TAP_ONE`/`tapBoss`). Response is `gesture`. Misses are `repeated_pick`, `looks_like`, `goes_with` and `off_idea`, from the trap the author tags on each wrong picture. All are `unanswered` (no levers at birth). `boss-card.mjs` printed clean.
- Checks: `typecheck:lumina` 0; full tsc 771 = baseline. `test:primitive wonder-walk` 757/758; the one failure is `body-workshop` (another session's in-progress primitive, missing its W1 payload). Own tests: workspace 5/5, checks 8/8, agent loop 2/2 against a scripted model.
- Answer-leak audit: the ask, narration, why-card and image prompt are blocked from naming the right picture (plural-blind), and so is the scene's own picture. All options render the same size and order is code-shuffled. The tutor's scene carries the picture names but no key and no traps. No counter, meter or prompt text on screen. The why-card restates the idea and never names the picture.
- Design gate: manipulation — exception: tap-to-choose, which is the K pre-reader contract and leaves production to later modes (say-it, sort, order). Simulation — N/A (knowledge walk, not a system). Production — exception at birth: recognition only, with the say-it and sort modes queued. Timer — pass: none. Layout leak — pass: see the audit above.
- Curriculum home: NOT RUN. The automated Gemini cap was spent ($4.95/$5.00 when checked), so `/curriculum-fit wonder-walk` is queued.
- Pip surface: framework (boss runner). `<PipDock/>` sits between the scene and the pictures; `<PipWorkspace>` wraps the picture grid. Pip outlines the whole region and never points at one picture. The `WorkspacePip.surface.test` row passes.
- NOT exercised: a real generation (`/eval-test`, `save_payload.py`), because the spend cap blocked both. The W1 payload is code-built from `buildStops` and marked for replacement. No browser check.

## L1 — math modes (2026-11-05, `/add-eval-modes wonder-walk math`)

- `how-many` (β 0.8, scaffolding 2, K.CC.B.5): the scene draws a group and the tutor counts it; the child taps which of 3 drawn groups has the number the ask says. `more-fewer` (β 1.5, K.CC.C.6): the scene draws two groups the tutor compares; the child taps which of 2 groups has more (or fewer). Backend priors added beside `which-one`.
- Code owns every number: `planNumberSlots` picks 5 slots per math type from the seed before the author writes; the range is read from the lesson ("to 5", "within 10", "1-20"; default 10, held to 3-20). The author writes words for a slot; the checks hold the ask to its number (or to more/fewer), block other counts in the ask, and block naming one of two different group objects. The scene count is never the answer count.
- Support tier (single mode only): how-many easy = wrong groups 2+ away, medium = one group one away, hard = one more and one fewer. more-fewer gap 3+ / 2 / 1.
- Routing: `resolveEvalModes` picks the modes; the author is given only the write tools of the picked types (`toolsFor`). Mixed (no pin, broad intent) opens all three. A walk of only math stops ships as `domain: 'math'`.
- Groups draw in rows of five, one emoji size per stop, no word or numeral on the tile. Math stops get no scene image (an image model cannot be trusted to draw an exact count) and skip the independent solve (code knows the answer). The tutor scene names the groups without their counts.
- Misses: `off_by_one`, `miscount` (how-many), `reversed` (more-fewer), plus `repeated_pick`; all unanswered (no levers yet).
- Checks: `typecheck:lumina` 0; full tsc 771 = baseline. Own tests: checks 12/12, agent 5/5 (incl. a scripted how-many walk), workspace 7/7. `test:primitive wonder-walk`: the math payloads pass the journey sweep; `wonder-walk.which-one` fails J14 (a which-one answer is a sayable word but the item is tap-only), unchanged by this slice; it is the say-it rung below.
- NOT exercised: a real generation of any mode (spend cap $4.95/$5.00). The `how-many` and `more-fewer` W1 payloads are code-built from the slot planner and marked for replacement. No browser check.

## Follow-up queue (run in order)

| # | Skill | Layer | Input from this birth |
|---|-------|-------|----------------------|
| 0 | `/eval-test wonder-walk` + `save_payload.py --primitive wonder-walk --mode which-one` | QA | First real generations once the cap resets. Watch: turns to ship, how often the review sends stops back, whether the author keeps the right picture out of the narration on topics where the obvious example is the answer ("what plants need" → water), and the image hit rate |
| 1 | `/curriculum-fit wonder-walk` | home | Expect K science: living/nonliving, needs of plants/animals, weather, senses |
| 2 | `/add-eval-modes` | L1 | **Math done 11-05** (how-many, more-fewer). Remaining candidates: `find-it` (tap the thing in the scene image; needs labelled hotspots), `sort` (two picture baskets, 4-6 pictures), `order` (3 pictures in sequence: seed → sprout → plant), `say-it` (spoken answer + tap fallback, SAY_OR_SHOW). Then grow by `domain`: language (category and word-meaning walks over the same library) and math: a `how-many` mode whose options are code-drawn sets of 1-10 library emoji with the count computed in code (11-05: "Counting to five" ran 7 turns and failed, because a which-one stop cannot ask how many; the author now declines such topics) |
| 3 | `/add-support-tiers` | L3 | Help: show the scene's example beside the pictures again, ring the feature that decides it. Simplify: drop to 2 pictures (remove the `looks_like` trap first) |
| 5 | `/add-sound` | L5 | Tap, right and wrong are wired through SoundManager already; add a soft stop-change chime |
| ✓ | `/eval-test wonder-walk` | QA loop | After every layer |

## L1 revision — math stops built from blocks (2026-11-06, `/agent-primitive`)

User 11-06: the 11-05 math modes were a schema with retries (one writer per mode, code-picked number slots, the agent wrote three sentences). Revised under the new `/agent-primitive` invariants.

| Invariant | 11-05 | 11-06 |
|---|---|---|
| I1 agent owns teaching decisions | fail: words only | task, numbers (within the lesson range), arrangements, distractors, sequence |
| I2 breadth (coverage test) | 2 of the K.CC rows | 10 compositions over K.CC.B.4a-c, B.5 (line, rows to 20, ten-frame, scattered to 10, count out), C.6 (more, fewer, same) pass in `math.test.ts` |
| I3 blocks, not writers | fail: `write_count_stop`, `write_compare_stop` | one `write_math_stop` (task, number/relation, scene and answer groups) |
| I4 code derives the key | pass (slots) | pass (`mathKey` from the structure; the boss re-derives it) |
| I5 shortcut solver | fail: wording lint only | blocks: pick by size, odd arrangement, match the shape, scene shows the answer, "more" with three groups |
| I6 difficulty from structure | fail: tier was a slot property | `mathDifficulty` returns band + reasons on every write; a walk off its tier blocks (first stop may warm up) |
| I7 variety | slot reuse only | 2+ arrangements, 2+ tasks when open, no repeated item |
| I8 three faces | levers queued | render + grade, tool, tutor scene (arrangement words, no key); levers still queued (`/add-support-tiers`) |
| I9 modes = declared tasks | 2 modes | `how-many` (find-number), `more-fewer` (compare, match), new `count-out` (β 1.2; pile → basket → Done) |

- Real generations (5 + 3 payloads + 4 browser): every walk hit its requested tier (hard 3.5s, medium, easy). The agent used scattered, ten-frame, line and rows; match one-more with the "same" count as a distractor; rows to 18 on a "to 20" topic. Turns 3-6, 10-31 s. Not reached by the agent in any run: a compare where the longer-looking group has fewer (the prompt names it; no run chose it).
- Findings the runs gave, fixed: a three-group compare asking "more" (blocked; asks "the most"), `relation` stored on find-number stops, a false "images did not render" advisory on math walks, "berrys" in the tutor scene, a line of 7+ overflowing a one-third tile (size now from the widest row and the column count; checked in headless Chromium: no emoji outside its tile).
- Browser (headless Chromium, offline tester): count-out pile → 3 taps → basket holds 3, pile slots stay in place; scattered, ten-frame and line groups render.
- Checks: `typecheck:lumina` 0; full tsc 771 = baseline. Own tests 43/43 (math 22 incl. coverage, checks 7, agent 2 with a scripted model, workspace 8). `test:primitive wonder-walk` 765/765 + sweep: the 3 math payloads (now saved generations) pass; `which-one` J14 unchanged (say-it).
- Spend: $0.26 over 72 calls today (generations, payloads, browser runs).
- Live: the shared tap path is unchanged; count-out adds `moves` to the card. One Live sample on count-out answers whether the tutor counts along without saying when to stop: `backend/tests/tutor_live/` journey for `wonder-walk` mode `count-out` (user runs it).

## L1 rebuild — math as a world and a goal (2026-11-06, second revision)

User 11-06: four tasks times four layouts was still a menu (about 5 of 22 K math standards). Rebuilt so the author describes a world: places (group, pile, basket, coloured plate, ten-frame, a cup that hides some), contents (word, count, colour), up to 2 story events (join, leave), and an answer: tap a place by a rule, tap a number (code picks the wrong numbers: one off, a part of the story), or move things until goal conditions hold (counts, sums across places, a full frame, only one colour or kind). Code derives the key, names the eval mode and standards from the structure, blocks shortcuts, checks a solver can reach a move goal, and scores difficulty (`service/core/wonder-walk/world.ts`; shared rules in `wonderWalkWorld.ts`).

- Modes (catalog + backend priors): how-many 0.8, more-fewer 1.5, count-out 1.2, and new add-take 1.5, parts 2.0, teens 2.0, sort-count 1.0, count-on 1.8.
- Coverage test (`world.test.ts`): 17 hand-built worlds over K.CC.A.2-3, B.4a-c, B.5, C.6, K.OA.A.1-5, K.NBT.A.1, K.MD.B.3. Each passes the checks, builds, passes the validator, has the expected mode, and is solved by the harness. Not covered: K.CC.A.1 (counting to 100), K.CC.C.7 (comparing numerals), K.MD.A, K.G (other worlds or primitives).
- Real runs: all 8 math payloads are saved generations (24 stops). The agent built join and leave stories, decomposition onto two plates, make-ten, teens on two frames, colour sorting, counting one colour, and counting on from a cup, all with correct keys. Not used by the agent yet: same-as, building a teen.
- Findings from real runs, all fixed: the narration told the parts the child should count ("ten stars and five more", "two more shells beside it"), so a new rule blocks it and the payloads were regenerated. The teens topic was declined because the range defaulted to 10 (the agent was right); "teen" in the lesson, or the teens mode, now sets 20. Target labels collided with why-card words (J3 false positive), so labels are now `spot a`, `apple 3`. The runtime's re-open at mount wiped moves made in the first second; found in Chromium and fixed.
- Checks: `typecheck:lumina` 0; full tsc 771 = baseline. Own tests 54/54 (world 26, checks 7, agent 2, workspace 15 incl. the journey taps on all 8 math payloads); gate 772/772. Sweep: count-out and parts pass. J14 on how-many, more-fewer, add-take, teens, sort-count, count-on and which-one: a number is a sayable answer and these stops take only a tap. This is the voice rung (USER 10-13), not baselined.
- Browser (headless Chromium, offline tester): plates take moved things; joining ducks are ringed; the cup, two frames and number buttons render; no place sits outside the scene; an early tap moves a counter. Polish: dark counter emoji over the colour disc reads weakly.
- Spend today: $0.74 of $5.00 (generations, payloads, browser runs).

| # | Next | Skill |
|---|---|---|
| 1 | Voice beside the tap for number answers (J14 on 6 math payloads + which-one) | `/add-voice-control` |
| 2 | Math levers: recount highlight, ten-frame regroup, cup peek | `/add-support-tiers` |
| 3 | One Live sample on add-take and parts (does the tutor tell the parts without the total, and stay quiet while the child moves) | user |
| 4 | Audit deep-dive and annotated-example | `/agent-primitive` |

## L1 language — a word world (2026-11-06, `/agent-primitive`)

User 11-06: build K language arts on the agent's capabilities. Built as a world plus a condition (`service/core/wonder-walk/words.ts`, shared rules in `wonderWalkWords.ts`, renderer `WonderWalkWordStage.tsx`), not a writer per mode. The author describes refs (what the scene shows and the tutor names), cards (library pictures, letter tiles, one or many, in/on/under/next to a landmark), an optional 2-3 event story, and an answer: tap the one card a condition holds for, sort cards into baskets by conditions, or order cards on a track (story order, or a word's spelling). Code reads every card's sounds, claps, kind and spelling from the word library, derives the key, says the sounds (`[sound]`, `[sounds]`, `[from]`/`[to]` filled by code: "kuh - aaa - tuh"), names the mode and standards, blocks shortcuts and scores difficulty.

| Invariant | Status |
|---|---|
| I1 agent owns teaching decisions | task form (tap/sort/order), condition, target sound or word, distractors (near sounds, same-kind, look-alike letters, other story parts), refs, story, sequence across stops, wording |
| I2 breadth | 21 hand-built worlds over 15 modes pass checks, build, validate and are solved by the harness (`words.test.ts`) |
| I3 world + condition, no task enum | one `write_word_stop`; 14 condition types compose with 3 answer forms |
| I4 code derives the key | `ruleHolds` over stored library facts; the boss re-derives every key; story wording goes to the independent reader |
| I5 solver | pick by meaning (only animal like the cat), odd one out by kind, blend by first sound alone, story: only thing heard / only one of its kind, one-many: only card with that picture, sound sort that is a kind sort, sort by an identity condition, a card matching a ref by sight, two labels alike, unannounced leftover card, "look at the tree" with no tree, the answer said aloud. Each has a test. |
| I6 difficulty | `wordDifficulty` band + reasons on every write; tier checked |
| I7 variety | no answer twice; no condition asked twice; 2+ modes when open; a sort in single sortable-mode walks |
| I8 three faces | render + grade, tool, tutor scene (pictures named; letters unordered; where/one-many cards described without the giveaway); levers queued |
| I9 mode from structure | 15 modes by fixed precedence; catalog, backend priors, card, tester list them |
| I10 decline is a signal | 11-06: 5 single-mode walks declined, naming a contradiction in my variety rule (tap-only modes were required to sort); rule fixed, all regenerated |

Modes (β): rhyme -0.5 (RF.K.2a), first-sound -0.3, last-sound 0.6, middle-sound 1.4 (RF.K.2d), syllables 0.0 (RF.K.2b), blend 0.8 (RF.K.2b-d), change-sound 1.8 (RF.K.2e), letter-name -0.8 (RF.K.1d), letter-sound 0.3 (RF.K.3a-b), spell-word 1.6 (L.K.2c-d), word-kinds -1.0 (L.K.5a, L.K.1b), one-many -0.2 (L.K.1c), where-is -0.4 (L.K.1e), story-detail 0.2 (RL.K.1/3, SL.K.2), story-order 0.9 (RL.K.2). Not covered: opposites (L.K.5b), multiple meanings (L.K.4a), sight words (RF.K.3c), print concepts beyond letters (RF.K.1a-c).

Breadth verdict (real generations, one walk per mode, saved as W1 payloads): all 15 modes covered by a real run. Final runs took 3-6 turns and 12-27 s, except change-sound's first run (12 turns, salvaged) before the rule fix. The agent used sorts (rhyme, first sound with heard-word labels, last sound, middle vowel, claps, kind), onset-rime and phoneme blends with same-first-sound distractors, a first/last/middle change-sound progression, b among p and d, and in/on/under/next to with one landmark.

Findings from reading the real items, all fixed at the class level and regenerated: a sort card that fits no basket with nothing telling the child; sorts by identity conditions (cat card into the cat basket, m tiles onto m, two identical bear labels for on/under); `[sound]` left unfilled in why-cards; a crash when difficulty scored a draft before its structure checks; narration pointing at a tree the screen did not show; a variety rule that contradicted the sort rule (the declines); "Who did we see first?" after "A duck saw a dog" (story-detail now goes to the independent reader). Still seen, not blocked: the author sometimes writes sounds itself in the narration ("Pan has a in the middle"); a token there is filled, free text is not checked.

Checks: `typecheck:lumina` 0; full tsc 771 = baseline. Own tests: words 48, wonder-walk service 88, component/workspace 30 (every language payload mounted, solved by the journey taps, a wrong answer a named miss, no key or printed word). `test:primitive wonder-walk` 788/788; sweep: all 15 language payloads pass; the 7 J14 failures (which-one + 6 math) are unchanged. Spend today $2.01 of $5.00 (of it, about $1.27 this slice).

NOT exercised: a browser look at the word stage (the in/on/under drawings, baskets, track) — exercised in jsdom only; needs a headless Chromium check. No Live run.

| # | Next | Skill |
|---|---|---|
| 1 | Browser check of the word stage: in/on/under composition, baskets, track, letter tiles at phone width | headless Chromium (recipe in memory) |
| 2 | Voice beside the tap: blend, rhyme, story and letter answers are sayable words (USER 10-13); the sweep does not flag them | `/add-voice-control` |
| 3 | Language levers: say the sounds slower, drop a card, replay the ref word, show the basket's example again | `/add-support-tiers` |
| 4 | One Live sample on blend and change-sound: does the tutor say the code's sounds exactly and never the word | user |
| 5 | `/eval-test wonder-walk` over the language modes | `/eval-test` |

## L5 voice — the author designs what the child produces (2026-11-06, `/agent-primitive` I11)

Moved from `tapBoss` to `spokenBoss`. The author sets `respond` per stop (`show | say | say-any`). `wonderWalkSpoken.ts` decides what can be said, refuses a production that does not fit (`respondError`, also run by `validate`), and derives the spoken key, the misses and the harness answers from the stored world. `say-any` (make a word: rhymes, first or last sound, same sound, kind) accepts library examples computed at build, plus an accept rule. Walk rule: 3+ language stops whose rules allow it include one `say-any`. Card: 16 modes `SAY_OR_SHOW`, 7 always-shown modes `TAP_ONE`, `SPOKEN_AUDIO`; catalog answers `tap, spoken`. Shared: `JUDGED_BY.either` now says "a task with no key is shown only" (reworded to keep analog-clock under the 4000 guidance cap); J14 treats `spot <x>` labels as positions.

| Production | Math | Language |
|---|---|---|
| say the value | built (number answers; teens also "ten and three") | built (picture or letter answer) |
| make any | queued (two numbers that make five) | built (rhymes, first/last sound, same sound, kind) |
| parts in order | queued (count on aloud) | queued (segment a word: a new SPOKEN mode) |
| choose aloud | queued | queued |
| show | built | built |

Checks: gate 788/788 and sweep 136/136 (J14: 7 failures to 0); full live-activity suite 36 files, 4787 passed; respond tests 8/8; service tests 96/96; typecheck:lumina 0; full tsc 771 errors, none in touched files. Real generations (`--name respond`, rhyme, first-sound, how-many): the author set `respond` correctly on every stop but chose no `say-any` until the walk rule existed; with it, the rhyme walk chose `say-any` itself ("Can you think of a word that rhymes with cat?", examples at, bat, chat, fat, pat, sat). Spend about $0.09. JEV spoken-miss probe (real model, 20 payloads, 188 cases): 186/188, 0 false positives; the 2 unnamed (change-sound `meaning`) record a plain miss.

| # | Next | Executor |
|---|---|---|
| 6 | ONE Live sample (shared doctrine line + new `special` sentence): does the tutor invite the child's own rhyme first, credit a rhyme that is not on a card, and never name a card as the answer? `cd backend && venv/Scripts/python tests/tutor_live/run_live_runtime.py --primitive wonder-walk --mode rhyme --runs 1 --input ../my-tutoring-app/src/components/lumina/components/live-activity/runtime/testing/w1-payloads/wonder-walk.rhyme-respond.json` | user |
| 7 | Segment a word (say each sound): a new SPOKEN mode with its own β | `/agent-primitive` + `/add-eval-modes` |
| 8 | Math make-any and count on aloud | `/agent-primitive` |

**USER 11-07 — levers are authored, not hardcoded.** The lever lists above (recount highlight, ten-frame regroup, cup peek; slower sounds, drop a card, replay ref, basket example) are examples of what the agent may write, not an app-side menu. Next: per-stop `levers` in the world schema as block edits; code rebuilds each and checks it (simplify keeps the mode and lowers difficulty; help leaves no shortcut and hides the key; no text-only levers); the boss lever set comes from the stop. Executor: `/agent-primitive` (I13), with `/add-support-tiers` for the shared wiring only.
