# Workstreams — Archive

Historical `/pm` reconcile notes, prior snapshots, and EXECUTED blocks split out of
`WORKSTREAMS.md` on **2026-08-12** (user ruling: "split harder") after three consecutive
reconciles flagged the index at 358KB / 3,194 lines — four tool calls to read.

**Nothing here was deleted; it was moved verbatim.** The live index keeps the current
snapshot table, the newest `/pm` note, and the ACTIVE / DELEGATED / PARKED / CLOSED
sections. Everything below is history: read it for *why* a call was made, never for
what is true now. **Queues are authority over anything in this file.**

Live index: [`WORKSTREAMS.md`](../../WORKSTREAMS.md)

---
> ### ARCHIVED by `/pm` 2026-08-17 — the predecessor note (portfolio concentration)
>
> ### `/pm` 2026-08-16 — the portfolio-concentration reconcile (user question: *"are we
> doing port work on the same primitives over and over? 150+ primitives and I feel I'm
> working on the same 10-15"* and *"is this actually improving quality or is it busy work?"*)
>
> **⭐ FINDING 1 — THE FEELING IS ABOUT DEPTH, NOT BREADTH, AND THE BREADTH NUMBER IS FINE.**
> Measured, not estimated: **182 of 219 primitive components touched since 2026-06-01; 63
> distinct components in August alone.** So the portfolio is not idle and the 10-15 figure is
> not literal. What concentrates is **depth**: counting how many of the seven live queue files
> name each of the **197 catalog ids** gives **30 primitives in ZERO queue, 57 in exactly one,
> and 37 in four or more** — and the 4+ set is exactly this week's roster (`word-sorter` 6,
> then `word-workout`/`rhyme-studio`/`phoneme-explorer`/`letter-sound-link`/`cvc-speller`/
> `phonics-blender`/`planetary-explorer` at 5). **A primitive in four queues gets four slices;
> a primitive in zero gets none, forever.** Domain skew says the same thing: file-touches since
> 07-15 are literacy 175 · direct-instruction 129 · math 120 against **biology 23 · chemistry 13
> · physics 13**, while the catalog is math 61 · literacy 32 · **engineering 24** · core 19 ·
> biology 17 · chemistry 14. Engineering has 24 primitives and no lane.
>
> **The mechanism is already in memory and it has now been measured:
> [[feedback_worked-primitives-self-select]] — every lane picks its roster by what is CHEAP,
> and prior work is what makes a primitive cheap.** The DI sweep roster, the reader-fit roster
> and the support-tiers roster are substantially the SAME literacy-phonics set, because each
> lane inherits the previous lane's contracts, tests and probes. This was named on 08-03 (the
> coin-counter pilot swap) as a one-off judgement call; it is structural, and this is the first
> run to put a number on it.
>
> **⭐ FINDING 2 — THE PORT WORK IS NOT BUSY WORK, BUT THE VALUE IS NOT COMING FROM THE
> ADAPTER.** The adapter is ~15 lines (port 4's own report says so). The six shipped port
> commits are **759 / 964 / 1,115 / 1,268 / 1,269 / 1,760 lines**. The split per port is
> consistently: ~300–400 lines of `<primitive>Script.ts` (the judged dialogue contract — new
> pedagogical content), **30–85 lines of `gemini-<primitive>.ts` generator fixes**, 25–37 lines
> of catalog scaffolding fixes, a **net-NEGATIVE component diff** (click-era buttons deleted),
> and the balance in tests + live drive reports. **Two generator fixes were re-verified against
> the diff this run rather than taken from the report:**
> - `gemini-phoneme-explorer.ts`: `maxOutputTokens: 4096 → 8192` + retry-once. Before it, the
>   widest schema in the family truncated mid-object, `JSON.parse` failed, and a **hardcoded
>   fallback shipped silently and graded as success** — every `isolate` lesson was a one-item
>   lesson about a bear whatever the topic.
> - `gemini-letter-spotter.ts`: `startsWithADigraph` gate. The live probe drew *"Say the letter
>   that **sheep** starts with"*, answer key `S` — the primitive whose entire job is letter-sound
>   mapping was affirming a false one, and every gate passed it.
>
> **Neither defect is a DI defect. Both were live for the click-era surface and would still be
> live today if the port had not happened.** ⭐ **So the honest description of the lane is: the
> port is a FORCING FUNCTION. It is the only workflow that makes someone read one primitive
> end-to-end and run a live generation probe against it, and the probe is what finds the
> defects.** That is real quality, and it also means **the quality does not require the port** —
> which is the lever on the 10-15 problem.
>
> **⭐ FINDING 3 — THE SILENT-FALLBACK CLASS IS PORTFOLIO-WIDE, MACHINE-CHECKABLE, AND SITS IN
> THE DOMAIN WITH THE MOST PRIMITIVES AND THE LEAST ATTENTION.** Generalising phoneme-explorer's
> defect into a grep over the 209 production generators: **33 carry a hardcoded fallback with NO
> retry and NO `console.warn`/`error`** — i.e. they can ship fallback content to a child, and
> nothing anywhere says so. **32 of the 33 are `service/math/`** (the 33rd is calendar), and math
> is 61 catalog entries against literacy's 32. Full list in the queue row below. This is a
> **sweep, not a sitting** — it is greppable, it needs no mic, and it is the exact shape memory
> already parked on 07-06 as [[project_flash-lite-truncation-template]] ("~50-gen sweep") and
> never ran. **The 08-16 evidence upgrades it from a hardening chore to a measured
> content-integrity defect with a live citation.**
>
> **WIP: the rule is 2+1 and the board is running 1.** The judged loop has taken essentially
> everything since 08-09; **stream 00 (lesson ordering, item B′) is now STARVED 8 DAYS** — its
> top item is ~15 lines, no LLM call, success criterion already measured (19 of 72 scorable
> blocks inverted → 0). It was flagged starved at 6 days on 08-14 and has not moved. **Second
> ACTIVE slot proposed below, and it is deliberately NOT another literacy lane.**
>
> **Non-drift worth recording: the sweep's throughput is real.** Six ports in ~30 hours
> (`d7f4133b` 08-15 → `f43a804d` 08-16 16:36), 0 HIGH findings across ~40 drive sessions, tree
> clean at each. The lane is not slow; it is narrow. **Nothing in this note argues for stopping
> it** — 5 of 11 ports remain and the marginal port still finds 3–4 real defects.
>
> **Standing rule proposed from Finding 1 (needs no ruling to start, but say if you disagree):
> a lane's roster must be picked from DEMAND, not from what already has contracts.** Concretely
> — before a new sweep opens, check its roster against the zero-queue list; if the overlap is
> zero, the sweep is re-working the worked set.
>
> ### ⚖️ USER RULING, same session 2026-08-16 — **CAPABILITY BEFORE RE-TESTING**
>
> *"the better use of time is actually adding then testing DI-specific capabilities to the
> remaining math and literacy primitives before tons of testing on primitives I've already
> tested."* **Accepted, and it corrects this run's own move #1.** The silent-fallback sweep is
> DEMOTED from the top of the board — not because the defect is not real, but because
> **Finding 2 makes the sweep largely redundant with the plan the user picked: porting a math
> primitive FORCES the live generation probe that finds exactly that defect class.** 32 of the
> 33 silent-fallback generators are math. Do not run both lanes; **let the math ports harvest
> it**, and keep the 33-item list as the *checklist a math port consults*, not as its own sweep.
>
> **THE REAL FRONTIER, measured this run:** judged packs exist for **26** primitives. Catalog
> ids with NO judged pack: **57 of 61 math · 18 of 32 literacy = 75.** The current 19h-i-b sweep
> has **5** left. So the capability frontier is 15× the queue that has been absorbing the board.
>
> **⭐ BUT IT IS NOT ONE SWEEP — it splits three ways, and only one is a straight continuation:**
>
> | Class | Roster | Judge support today | Verdict |
> |---|---|---|---|
> | **A — word/number answer** | ~~`syllable-clapper`~~ ✅ (port 17) · ~~`word-builder`~~ ✅ (port 19) · `spelling-pattern-explorer` · ~~`word-sorter`~~ ✅ (port 18) · `poetry-lab` `rhyme_hunt`, plus the numeral-answer math set | ✅ `short_spoken_word`, `open_set_word`, `closed_set_choice`, numerals | **`/add-di-loop` works as-is.** Straight continuation of the proven pattern. |
> | **B — manipulation-native math** | `shape-composer` · `net-folder` · `transformation-lab` · `coordinate-graph` · `tape-diagram` · `place-value-chart` etc. | ◐ `manipulation` exists but is the LEAST-proven class | Portable, but the adapter shape differs — the answer is a BUILD, and per [[feedback_di-spoken-first-not-tap]] these are the ports where a tap **is** legitimately the answer. Pilot one before sweeping. |
> | **C — literacy PRODUCTION** | ~13 of the 18: `story-map` · `paragraph-architect` · `opinion-builder` · `revision-workshop` · `character-web` · `evidence-finder` · `story-planner` · `text-structure-analyzer` · `sentence-builder` · `context-clues-detective` · `figurative-language-finder` · `genre-explorer` · `sentence-analyzer` | 🔴 **NONE** | **BLOCKED on a judge capability that does not exist.** `ResponseClassId` in `judgedScriptContract.ts` has **11 classes and every one is closed or word-level — the ceiling is `open_set_word`.** Their eval modes are `oreo`, `cer`, `add_details`, `combine_sentences`, `transitions`, `reorganize`, `concision`, `theme_craft`, `trait_evidence`, `evaluate_evidence_strength`: the child PRODUCES a sentence or restructures text. `sentence_read_aloud` is recall of on-screen text, not production. This is [[feedback_production-modality-roadmap]] arriving as a hard blocker. |
>
> **⭐ THE LEVERAGE ARGUMENT FALLS OUT OF THE TABLE: one new response class (a produced
> sentence, judged on CRITERIA rather than string match) unlocks ~13 literacy primitives at
> once. The 5 remaining ports in the current sweep unlock 5.** That is the highest-leverage
> unbuilt capability on this board, and it is a capability, not a test — exactly the direction
> the ruling names.
>
> **⚠️ AND THE CHEAPEST UNBLOCK IS A 30-MINUTE SITTING THE USER CAN DO TODAY.** `HUMAN-CHECKS`
> **#63 is genuinely OPEN** (verified this run at `HUMAN-CHECKS.md:1328`, not inferred): it
> decides whether `di-math-facts counting_next` may ever reach 1–120 or must keep saturating at
> 20. **Math ports beyond 20 are gated on it.** `npm run dev` → di-bench 🎯 → probe set
> *"Counting to 120"* → mic on. It is the one human row standing between the ruling and the
> larger half of the math roster.

---

> ### Old WIP notes moved out of the live index's `## DELEGATED` heading — `/pm` 2026-08-13
>
> These are 2026-08-03-and-earlier reconcile WIP notes. They sat under `## DELEGATED` in the
> index, which reads as live state; they are history. Moved verbatim.

> **WIP note (`/pm` 2026-08-03 EVENING reconcile — supersedes the morning note below):** HEAD
> **`603cc82`**, main, **in sync with origin.** Movement since the morning reconcile: **two DI
> ladder rungs landed, committed AND pushed same-day** — `66a2d66` (di-word-reading L2, the family
> now entirely catalog-resolved, + 14g's di-word-reading half closed WRONG-PRIMITIVE with measured
> 2/3→0/3 steering) and `603cc82` (di-sentence-reading L4, first pack at L4, the family's L4
> template). Both commits carried their queue + WORKSTREAMS updates in the same slice — grooming
> held; this reconcile found only ONE staleness: the DI BACKLOG's 08-01 ordering block still said
> "next rung = di-word-reading L2" after both rungs landed (the ladder table below it was current).
> Fixed — **DI next serial rung = di-letter-sounds L4** (item-set composition per birth cert).
> **Human-check re-grep:** both 08-03 reports SELF-declare "no new row" and the claim verified —
> the L4 8-word cold read folds into existing #54(d) (clause added), the L2 chattiness glance rides
> the next DI sitting. Next free ID still **62**.
> **Uncommitted surface = pure register/skill docs, ONE `docs(pm)` slice, no code:** the
> primitive-contract **Phase 2b (G-series) REMOVAL** (user ruling 08-03 — contracts record what must
> stay TRUE, never an improvement wishlist; 9 contracts had manufactured 26 gaps, ~500 by
> construction at catalog scale; governing rulings `qa-is-a-gate-not-a-census` +
> `worked-primitives-self-select`) + the reader-fit **14m pilot swap coin-counter → number-line**
> (same ruling family; WORKSTREAMS already carried it committed, the BACKLOG edit is the lagging
> half) + this reconcile's corrections (DI pointer, #54(d) fold-in, this note).
> **Convergence worth naming:** 14m's number-line pilot is contract-first, and number-line is
> ALREADY item 5 of the contracts derivation queue — one slice serves both queues.
> Portfolio = **2 ACTIVE + 1 opportunistic, at the limit**; both ACTIVE streams touched today.
> ⚠️ **Standing flag, SEVENTH raising:** `.claude/settings.local.json` allow-list is still
> `["Read(**)"]` alone (re-verified this run). Either restore `Bash(*)` / `Glob` / `Grep` or record
> the narrowing as deliberate so `/pm` can stop raising it.
>
> **WIP note (`/pm` 2026-08-03 morning full reconcile — superseded by the note above):** HEAD
> **`8ce40ec`**, main. **Uncommitted surface = ONE stream's worth (reader-fit 14f knowledge-check)**
> — 4 source files + contract + reader-fit test + 5 QA docs + 5 shared registers. Clean to ship.
> **Ship proposal, 2 slices — EXECUTED `/ship` 2026-08-03:** (1) the 14f code + its contract + its
> reports (one stream, fully verified per its report: COMPATIBLE check, Lumina typecheck 0,
> real-Gemini probes) → **`7ba48ba`**; (2) the shared registers (WORKSTREAMS, EVAL_TRACKER,
> HUMAN-CHECKS, both BACKLOGs) in their own commit — they now carry this reconcile's corrections as
> well as 14f's, so they are genuinely a separate concern. Ship-time gates re-run on the whole tree:
> `typecheck:lumina` 0, **full suite 1286/1286** (the 14f report's 1085 was that session's count;
> the suite has grown by `423c58f` + `8ce40ec` since). Portfolio = **2 ACTIVE + 1 opportunistic**,
> at the limit.
>
> **Three staleness corrections made this run** (all of the "recorded-open but actually done" class
> the skill warns about, and all three were invisible from the queues alone):
> **(1) how-it-works HW-4/HW-5/HW-6 were recorded OPEN while the fix sat at HEAD.** The 08-02
> diagnosis session wrote the tracker rows; the fixing session landed `8ce40ec` and never struck
> them. Verified in the tree (`maxOutputTokens: 8192` + 2-attempt retry, `clampStr` across every
> free-text field, and a payload/longest-string detector in `eval-test/route.ts`). Struck as
> CODE-LANDED with re-verification named. **HW-2/HW-3 likewise cleared** — the 9-run sweep proved
> both fixed and said so in its report, but nobody carried it to the tracker.
> **(2) The eval-test harness is now runaway-instrumented for EVERY primitive** (HW-6's fix is
> route-level, not how-it-works-level). Any sweep that has been trusting `status: pass` was blind to
> the SP-6b class; it no longer is. That is a portfolio-wide gain hiding inside a single-primitive
> commit.
> **(3) A systemic defect was being met one instance at a time** — see reader-fit **14m**, opened
> this run. 14e made `ctx.grade` precise; **19 of the 26 generators carrying a local band resolver
> still substring-match `gradeContext` PROSE** (8 of them on the K-2 surface, 11 chemistry).
> coin-counter (14c), hundreds-chart (14i), and
> calendar-explorer were three independent sightings of one bug, and calendar-explorer was already
> fixed blind inside the support-tiers batch — which is exactly the fix template for the other 19.
>
> **Human-check debt re-grepped:** two rows added (**#60** support-tiers hard-tier feel pass — its
> own report names it; **#61** how-it-works HW-1, a CRITICAL open since 2026-03-22 that had no row
> at all, which is why it has been invisible rather than deprioritized). Next free ID = 62.
> ⚠️ **Standing flag, SIXTH raising:** `.claude/settings.local.json` allow-list is still
> `["Read(**)"]` alone (re-verified this run — file is 9 lines, `allow: ["Read(**)"]`). Every
> session pays permission prompts for routine shell/search. This has now outlived five reconciles;
> either restore `Bash(*)` / `Glob` / `Grep` or record that the narrowing is deliberate so `/pm`
> can stop raising it.
>
> **WIP note (`/pm` 2026-08-01 second run, handoff planning — superseded by the note above):** HEAD **`66b3cd8`**, main, **tree CLEAN, in sync with origin.** The earlier note's
> "uncommitted surface = DI stall-fix + guard" is DISCHARGED — that whole day landed
> (`f156f21` stall fix, `9af684c` math-facts L3, `79dcbdd` 14a census, `66b3cd8` rulings).
> **Three parallel-session handoffs written this run** (paste-able, line-exact, file-disjoint by
> construction): **(1)** reader-fit **14e** numeric Grade-1 dead band —
> `qa/HANDOFF-reader-fit-14e-numeric-grade-2026-08-01.md` (target verified:
> `geminiService.ts:30-37` collapses `Grade 1`/`1` → `elementary`; fix routes through
> `normalizeObjectiveGrade`, `resolveGenerationContext.ts:38`); **(2)** DI **di-letter-sounds L3**
> — `qa/HANDOFF-di-letter-sounds-L3-2026-08-01.md` (third use of the L3 template; owns
> `catalog/di.ts` serially); **(3)** reader-fit **14b** coin-counter G1 enacted-count widening —
> `qa/HANDOFF-reader-fit-14b-coin-counter-g1-2026-08-01.md` (contract-first, carries the β1.5
> decision). 14e+14b are one stream worked by two sessions (07-16 precedent); portfolio stays
> **2 ACTIVE + 0 DELEGATED**. Opportunistic 4th if a slot opens: DI queue item 6 (backend-only
> attribution probe, zero collision) — pull straight from the queue, no handoff needed.
> ⚠️ **Standing flag, FIFTH raising:** `.claude/settings.local.json` allow-list is still
> `["Read(**)"]` alone (re-verified this run).
>
> **WIP note (`/pm` 2026-08-01 — superseded by the note above):** HEAD `d906c68`, main.
> **Uncommitted surface = ONE stream's worth (DI) + this run's backend guard:** the 07-31/08-01
> item-5 stall-fix slice (engine hooks + 4 packs + session-liveness/fuzz tests + `DiStallCard` +
> recovery/disconnect hooks + `LuminaAIContext` + backend clock-skew & ledger edits + QA docs) plus
> the fault-flag persistence guard (`lumina_tutor.py`, `config.py`) landed by this `/pm`.
> **Ship proposal:** slice 1 = the DI stall-fix + guard (same files, one stream, all verified —
> vitest 1025/1025, typecheck:lumina 0, py_compile clean, level-2 recovery confirmed live);
> slice 2 = shared registers (WORKSTREAMS, HUMAN-CHECKS, DI BACKLOG) in their own commit.
> **Two user rulings recorded this run:**
> **(1) Fault-flag time bombs (defused + guarded).** `LUMINA_FAULT_MUTE_S=25` had been left in
> `backend/.env` — it would have silently muted the first DI session of every backend boot. Removed,
> and the class is closed in code: fault flags now REFUSE to arm from .env persistence (pydantic
> loads .env without touching os.environ, so the persisted form is detectable) — one loud ERROR
> names the fix; shell-scoped arming (`$env:LUMINA_FAULT_MUTE_S='25'; uvicorn …`) still works for
> deliberate drives. Guard exercised on all four paths via the backend venv. Memory:
> `feedback_no-persisted-fault-flags`.
> **(2) Scope pivot: PUSH DEVELOPMENT.** Testing of DI was good but must stop dominating sessions;
> favor platform capabilities that don't require substantial testing. DI re-pointed at its LADDER
> (machine-gated /add-* rungs) + item 2 design; item 9 Tier 2 (headless student = testing
> capability) demoted-but-queued, absorbing the level-3-card + end-coherent-run residuals.
> Reader-fit's §14a EMERGING census (pure agent work) fits the ruling and is that stream's pull.
> Portfolio = **2 ACTIVE + 0 DELEGATED**, within limit. Reader-fit idle since 07-25 — resume via
> 14a rather than parking (it IS the development frontier for the K-2 demand map).
> ⚠️ **Standing flag, FOURTH raising:** `.claude/settings.local.json` allow-list is still
> `["Read(**)"]` alone — every session pays permission prompts for routine shell/search. Restore
> `Bash(*)` / `Glob` / `Grep` if the narrowing wasn't deliberate (`/fewer-permission-prompts` can
> seed it); no other stream owns this.
>
> **WIP note (`/pm` status re-check 2026-07-27 late — superseded by the 2026-08-01 note above):** HEAD **`d906c68`**, main, **tree CLEAN, pushed** (main in sync with origin). Portfolio =
> **2 ACTIVE + 0 DELEGATED**, within the 2+1 limit. Reader-fit idle 2 days — within tolerance, queue
> freshly re-seeded (§14) so a session can pull cold.
>
> **The earlier reconcile note's `/ship` section is DISCHARGED — the entire 07-26 DI day landed in
> `d906c68`** (one commit rather than the proposed 3 slices; acceptable — it is one stream's work):
> turn-gate engine fix + fuzz suites + telemetry item 8 + misconception-evidence tests + all run
> reports + register updates (incl. this `/pm`'s #56 row and preamble refresh). **Both pre-ship
> gates were honored in the same commit:** `backend/logs/` is now gitignored with the "raw runtime
> logs never enter the repo" comment (and `git ls-files backend/logs` confirms nothing tracked), so
> the student-session-data exposure is closed.
> ⚠️ **Standing flag, still open (third `/pm` raising it):** `.claude/settings.local.json`
> allow-list remains `["Read(**)"]` alone — every session pays permission prompts for routine
> shell/search. Restore `Bash(*)` / `Glob` / `Grep` if the narrowing wasn't deliberate; no other
> stream owns this.
>
> **Post-commit movement (2026-07-27 evening): a child-paced `answer_fact` K run, COHERENT** —
> diagnosed from the auto-persisted log alone (item 8's zero-click path working in anger), 3
> plain-fallback corrections byte-stable → **#55(e) HALF-closed** (spoken-no-number half; the
> literal-SILENCE route still rides #56), counting-aloud supersession chains absorbed benignly
> (first live sight of item 9 Tier-2's "rapid double answers" class). Report:
> `qa/di-bench/run-2026-07-27-math-facts-answer-fact.md`.
> **Human-only residuals:** open rows run to **#56; next free ID = 57**. Two short runs remain:
> **#56** (the ~90s silence micro-run — no-verdict→resync live + #55(e)'s silence route + item 8's
> induced-stall acceptance gate) and the **sentence half** of the deliberately-wrong recipe
> (#54(a)/(b)/(d) + #55(a)/(b)/(d-reading) + #50(b) + #49(a)). Then **#45** (DI in a real K lesson),
> the evidence that would justify un-parking voice-transport.
> **DEV-FIRST RULING (user, 2026-07-27): human sittings must not be the critical path.** Recorded at
> the top of the DI BACKLOG queue. Code runway, none of it human-gated: **item 5** (stall fix) →
> **item 9 Tier 2** (headless student — machine-verifies item 5 + the silence path, shrinking #56 to
> an ear-check) → **item 8 flush sweep** → **item 6 probe** → **item 2 design**. Reader-fit's 14a
> EMERGING census is likewise pure agent work. **Item 7 (clock-skew) FIXED this session** —
> `clock_skew_seconds=10` at the tutor-WS + shared HTTP auth sites, py_compile clean, uncommitted.
> Only the contrastive-correction port stays frozen on a sitting (#55, family rule).

---

> ### `/pm` 2026-08-12 — what this run corrected
>
> **The headline is a non-drift: the prescription held.** The 08-11 run wrote "slice it TWO
> ways because the blast radii differ — (1) the engine cut-in, (2) the pack," held the ship
> because a concurrent session was mid-write, and named the release condition ("when the lane
> is quiet"). A day later a session read that row, waited, and executed it exactly: `ead9ae1`
> engine, `71cba07` pack, `9139cf1` ports. **A queue instruction survived a day, a session
> boundary, and a concurrent writer, and was executed without re-derivation.** That is the
> operating model working, and it is worth recording as loudly as the failures.
>
> **Drift #1 — the consequence moved one layer out and nobody followed it.** The ship closed
> the "is the tree committed?" question and silently opened a bigger one: **`main` is now 6
> commits behind and prod has none of tonight's work** — including `927b754`, the only
> *correctness* fix in the set (a primitive drawing the wrong picture for a child). The PROD
> row knew about exactly one of the six. **The generalized lesson, and it is the exact mirror
> of 08-11's drift #1:** that run found the index saying "held" after the ff was taken; this
> run finds it saying "deployed and live-verified" after the branch grew past the deploy.
> **A row that certifies a state is written at the moment of certification and re-read
> never** — so it decays in whichever direction the work moves. Both failures are the same
> row. Priced now as a decision, not a chore: the ff is mechanically clean, but it would put
> 8 unswept judged surfaces in front of the pilot family.
>
> **Drift #2 — the human queue's header is a day stale and undercounts itself.** #92 was
> struck 08-12 (user drove several sessions with deliberate errors: *"this passes human
> check"*) but the header still reads "as of 2026-08-11 / EIGHT rows remain" and lists #91 as
> open. **Actual: NINE open — #82–#87, #89, #90, #93.** Refreshed. Note the direction of this
> error: the register that gets *struck* correctly is the register whose *summary* goes stale,
> because striking a row is a local edit and the header is a global claim.
>
> **Drift #3 — the machine lane is outrunning the human gate, and it lapped it again during
> this very reconcile.** Port 8 (`rhyme-studio`) went from mid-write to SHIPPED + filed
> (#94) in the ~6 minutes `/pm` was running. **Nine judged surfaces now sit behind ONE
> user-owned sitting.** Two of two runner-era ports passed first drive, so the ports are
> probably fine — **which is exactly why the THREE rows that are not "the same contract on
> another surface" should be driven first and separately:**
> - **#93** — the first judged target that is a held SOUND; signature error = the letter NAME.
>   A *judging class* no strike covers.
> - **#94** — the only row on the queue asking a **product** question, not a verification one:
>   the accept set was narrowed to exactly the words on screen (a live probe caught the model
>   offering "nake" as a rhyme for "cake"), so a child who says a *true* rhyme off-card gets
>   corrected. Criterion (c) decides whether that trade stands or the `open_set_word` bench
>   finally has to happen. **A drive that answers this cannot be delegated to a machine gate.**
> - **#89** — the shared engine cut-in. It sits under *every* judged-loop consumer **including
>   #91 and #92**, so if it misbehaves it degrades two rows the user already blessed. **The one
>   row whose failure reaches backwards.**
>
> The board now stars #93 and #94 (the owning session added #94 mid-reconcile — correctly).
> **It still does not star #89, and that is the ranking error worth fixing:** #89 is filed as
> "`di-spoken-practice` re-drive," i.e. under the pack that happened to surface it, when the
> fix it carries is `ead9ae1` — engine-wide. Every other open row is a re-run of a contract
> with two user strikes on it.
>
> **Non-drift #2 — the concurrent-writer problem is SOLVED, and this run is the proof.** Third
> consecutive reconcile with a session writing mid-run, but this time the collision was total:
> port 8 shipped, filed its own DI-backlog block, wrote its own index row, and filed #94 — all
> inside this reconcile's window. **`/pm` touched nothing in that lane and pre-filed no row**,
> so there was nothing to retract (contrast 08-10, which filed and retracted within minutes).
> The 08-10 rule "prefer a retraction over two competing records" has graduated into **"the
> owning session files first, and `/pm` reconciles what it finds."** Treat concurrent writes
> as the normal condition, not an incident.
>
> **It did cost one real error, caught in-run and worth keeping:** `/pm` wrote "NINE rows open,
> next free ID = 94" into HUMAN-CHECKS at 22:29 — and #94 was filed at 22:29. A *count* is the
> most perishable thing a reconcile can write, and this one was stale before the edit landed.
> Corrected to TEN / next = 95 by re-grepping after writing. **New standing rule: re-verify
> every count AFTER the edit, not before — the read that justified it is already old.**
>
> **Ship hygiene:** the tree is one lane again (port 8) plus the `/add-di-loop` skill, which
> is recorded as "SHIPPED" in three places but is **untracked in git** — it and the three
> one-line L5 ladder edits (CLAUDE.md, PRIMITIVE_LIFECYCLE.md) are uncommitted *together*, so
> they will ship together naturally; the only failure mode is a selective commit that leaves
> the ladder pointing at a skill no other machine can see. **No `/ship` proposed this run —
> the lane is not quiet.**
>
> **WIP: 2+1, honestly held for the first time in three runs.** ACTIVE 1 judged-loop (hot),
> ACTIVE 2 pilot onboarding (untouched ~23h — not starved, but it owns the only *external*
> deadline on the board), +1 DI closeout (unwritten since 08-10). Port 8 is *inside* ACTIVE 1,
> unlike 08-11's multiplication-explorer, so there is no third stream to flag.
>
> **✅ INDEX HYGIENE — FLAGGED THREE TIMES, DONE THIS RUN.** The user ruled *"split harder"*:
> **3,194 lines / 358KB → 1,723 lines / 196KB**, with 1,479 lines moved verbatim to
> `my-tutoring-app/qa/WORKSTREAMS-archive.md` (all `/pm` notes back to 08-09, all prior
> snapshots back to 08-05, all EXECUTED blocks). Nothing deleted; accounting checks
> (123 + 1,479 + 1,592 = 3,194). Kept live: the snapshot table, this note, and
> ACTIVE / DELEGATED / PARKED / CLOSED. **The lesson for the register discipline: two runs
> flagged this and deferred it for "one user word" without ever asking for the word.** A
> deferral that never becomes a question is just a recurring line item.
>
> **➡️ NEXT HYGIENE LEVER, flagged not taken: `## ACTIVE` is now 1,364 lines — 79% of the
> trimmed index.** It is live content, not history, so it is not archive material; but a
> per-stream detail block that outgrows the portfolio table it serves probably belongs in
> that stream's own queue file, with the index carrying the pointer. **Needs a user call, and
> this run is asking early rather than flagging it three times first.**


> ### `/pm` 2026-08-11 — what this run corrected
>
> **Drift #1 — the biggest state change on the board happened and the index recorded the
> opposite. `main` was fast-forwarded to `f4facf5`; the top row still said "NOT
> fast-forwarded — deliberate."** The 08-10 row had written its own escape hatch ("or now if
> the pilot invite needs to go out first"), the hatch was taken during a live-test session,
> and **the queue that owned the consequence recorded it correctly** — `qa/pilot-onboarding/BACKLOG.md`
> gained a whole DEPLOY STATE section naming the commit and the reason. So this is the
> standing law holding again: **queues won, the index lagged.** Worth noting *which* index
> row lagged, though — the one about shipping. The row a session reads to decide whether it
> may ship is the row most likely to be written before the ship and never after it.
>
> **Drift #2 — and the reason drift #1 matters: the deploy that "unblocked" the family
> doesn't.** Buried in that same DEPLOY STATE block is the finding that **the prod bundle has
> no `NEXT_PUBLIC_API_BASE_URL` and carries the `localhost:8000` fallback** — read out of the
> deployed JS, not inferred. The site is live and talks to a machine only the owner has.
> **The index was still pricing the pilot's gate as #88, a browser sitting.** Promoted to its
> own PROD row with the cloudbuild env-var footgun (`--set-env-vars` REPLACES the set) flagged
> ahead of the deploy, because that mistake is the kind you make once and spend an evening on.
> **✅ AND IT WAS DONE THE SAME SESSION** — backend on Cloud Run, the env var set, and the user
> minting a real `test1grade3` account through the live site. The footgun did not bite.
>
> **Drift #2b — the follow-up check on that deploy produced this run's one WRONG CALL, and it
> is worth more than the drift it corrected.** Asked "are we good?", `/pm` curled prod, saw
> `<html id="__next_error__">` on `/login`, confirmed it came from the current build (matching
> chunk hashes, not a stale CDN entry), and reported the invite link as a dead front door.
> **It is not.** `useSearchParams()` without a `<Suspense>` boundary makes Next bail out of
> prerendering: the served HTML is an error-boundary shell that hydrates into the real form in
> a browser. The local build passing 39/39 was the tell and was read as contradiction instead
> of explanation. **The user had already driven the flow and had an account in Firestore.**
> The lesson is the Verification Doctrine's own, from the other side: *a type check is never
> verification of behaviour — and neither is a curl.* `/login` was never actually loaded. Any
> future headless check of an App-Router page must assert on the hydrated DOM; recorded at
> `qa/pilot-onboarding/BACKLOG.md` §residual 4 and on #88 so the next session does not
> re-derive the same false alarm.
>
> **Drift #3 — the day's third stream reached `origin` without touching a register.**
> `927b754` is 1,051 insertions across 10 files: a primitive rework, an oracle rewrite, two
> new test suites. **EVAL_TRACKER's row for that primitive still read `2026-06-14 / 6-6-0`
> — it had also missed the 07-07 oracle fix, so the row was stale through TWO fixes.** Filed
> now as a lane row (closed), a refreshed tracker row, **SP-30**, and human gate **#90**.
> The interesting part is not that it was unfiled — it is *why nobody noticed*: the 07-07
> fix pointed grading and the headline at the per-challenge fact, the desync count went to
> zero, and **the five representation panels kept drawing the shared fact for a month under
> a passing row.** Re-running the check that just went green is not the same as enumerating
> who reads the shared object.
>
> **Drift #4 — three live drives closed nothing, and the register showed no rows.**
> `di-spoken-practice` was driven three times on 08-11, found six defects, fixed all six —
> and **the sixth fix went into the SHARED engine** (`useJudgedSpeechLoop` off-script cut-in,
> now live under all 8 judged-loop consumers) **and has never fired in front of a person.**
> Filed as **#89**, written around the cut-in rather than the pack. The generalized form,
> added to the HUMAN-CHECKS header: *a drive that finds a defect does not close the row it
> opened — the fix inherits the row.* Same shape as the standing "a drive that answers
> everything correctly does not advance these rows," one layer later.
>
> **Drift #5 — the 08-10 snapshot contradicted itself, and nobody read it back.** Its SHIP row
> named `0207cd6` as the orphaned pair's resolution *and explained the ruling*; two rows below,
> the ORPHANED PAIR row still asked for that ruling and called itself "day 2, NOBODY'S." Both
> in the same table. Struck now (verified: the files are committed and out of the tree).
> **The mechanism is worth keeping — carried rows get copied, not re-read.** A reconcile
> naturally re-reads the rows it is *writing*; the rows it inherits ride along unexamined,
> which is exactly how a resolved item keeps asking for a decision. Cheap countermeasure:
> when a run closes something, grep the index for its name before finishing — not just the
> row being written.
>
> **WIP: unchanged at 2+1, but honestly there were THREE streams today** — judged-loop
> (ACTIVE 1), pilot onboarding (ACTIVE 2), and multiplication-explorer, which belongs to
> neither. It is *closed*, so it takes no slot going forward and no park is proposed; it is
> recorded because a 1,051-line slice outside both ACTIVE lanes is the thing WIP limits exist
> to make visible.
>
> **Drift #6 — a concurrent session shipped INTO this lane while the reconcile was running,
> and this time the discipline held.** `gemini-di-spoken-practice.ts` was written at 22:33
> and `add-number-pool-service/SKILL.md` at 22:38, mid-reconcile: a fourth live drive, the
> convergent-content defect, the seed pool, and the `findArithmeticMismatches` gate. **The
> queue block was written in the same slice**, so unlike drift #3 there was nothing to file —
> the register was simply newer than the copy this run had read. Caught only by re-reading
> the file before finishing, which is the 08-10 run's own standing gotcha paying off twice
> now. **Two consequences:** the ship pull is HELD until the lane is quiet (shipping a file
> another session is mid-edit is how a half-slice gets committed), and the gates quoted above
> were re-run against the post-edit tree rather than copied from the report.
> **One nit, flagged not edited** (it is a live file): that block is dated **2026-08-12**;
> the file was written 22:38 on **08-11**. Dated registers are what this index trades on.
>
> **Ship hygiene: the tree is dirty again the day after a ten-commit ship** — 1,822 new lines
> plus 490 changed, but all ONE lane, so this is a clean two-slice `/ship` (engine cut-in
> separate from the pack, because only the first touches code that already ships). Gates
> re-verified this run rather than taken from the report: **typecheck:lumina 0.**
>
> **⚠️ INDEX HYGIENE — SECOND CONSECUTIVE FLAG, and it has grown: 326KB / 3,050 lines.** The
> 08-10 run raised this and deliberately did not act, because prior snapshots have been kept
> in-file on purpose. It is now large enough that reading this file costs three tool calls.
> **Recommendation, needs one user word:** keep the current snapshot + the two most recent
> `/pm` notes here, move everything below to `qa/WORKSTREAMS-archive.md` with a link. Still
> not done unilaterally.

> ### `/pm` 2026-08-10 (evening) — what this run corrected
>
> **This reconcile ran CONCURRENTLY with the session doing the port-4 drive and the runner
> build, and the collision itself produced the run's sharpest lesson.** `/pm` first filed
> the runner + two pilots as DI item 17 — "work that reached HUMAN-CHECKS but no queue,
> fence crossed" — and had to RETRACT it minutes later: the owning record already existed
> inside item 16 (a dated block written mid-reconcile), and the framing was wrong — the
> runner was **user-directed** (*"build the general schema and capability"*), not a
> fence-crossing. The standing gotcha ("shared files change on disk mid-session; re-read
> before editing") extends to FILING: **re-grep the register immediately before writing a
> new entry, and prefer a retraction over two competing records.**
>
> **Drift #1 — the index and the human register lagged their own lanes by hours.** The DI
> row still said "port 4 NOT driven" under a headline saying it was; HUMAN-CHECKS' header
> said "FOUR rows open, next free ID = 86" while #86/#87 sat directly beneath it; the
> driving card said "one sitting, four primitives." All corrected (six judged rows + #88;
> next free = **89**; card points at #86/#87 and routes them to the runner block).
>
> **Drift #2 — the sitting's framing was stale the moment the build judge fired.** The
> registers said "no correction has ever fired"; now one has — on the BUILD judge only.
> Header and card re-scoped: the open debt is the SPOKEN judge refusing a deliberate
> error, on all six rows.
>
> **Drift #3 — the pilot lane's only human gate had no row.** Its queue owed "a browser
> pass on the signup form"; HUMAN-CHECKS carried nothing. Filed as **#88**, explicitly
> gating invite #1.
>
> **Drift #4 — the CTX-2 closeout was still priced as a measurement job after its number
> arrived.** The excavators lesson carries the post-fix floor-gate ledger (27 batches,
> wedged 0, superseded 0). Item 15 got the evidence pointer; the +1 is now a report plus
> a `wedged`-watchdog probe.
>
> **WIP ruling (the prior snapshot's own "next `/pm` reconciles slots" debt):** ACTIVE 1 =
> the judged-loop family — the literacy-ports row and the runner row were one register and
> one sitting, so they are one LANE for slot arithmetic. **ACTIVE 2 = pilot onboarding**
> (user-commissioned, real family waiting, machine-gated queue top). **Science depth
> PARKS** — untouched since 08-09, nothing gates on it, CELL-1 keeps its
> `/primitive-contract`-first instruction. +1 = DI closeout, now small.
>
> **Ship hygiene is the top item on the board — again, and bigger than the 08-08 record
> (five slices, ~2,450 insertions).** Nothing committed in two days. Note the inversion:
> BOTH ACTIVE lanes' pulls are user-owned sittings (#82–#87, #88), so the machine's best
> next move is `/ship`, not new reach.
>
> **Index hygiene flag, user call needed:** this file is **308KB / 2,940 lines — it can no
> longer be read in one tool call** (this run's first Read of it failed on size). The top
> snapshot still answers in 30 seconds, but everything below the prior snapshot should
> rotate to an archive file (e.g. `qa/WORKSTREAMS-archive.md`). Not done unilaterally:
> prior snapshots have been kept in-file deliberately.

---

## Prior snapshot — reconciled 2026-08-13 (full `/pm`) — **MOVED HERE VERBATIM BY `/pm` 2026-08-14**

> **Why it moved, and it is the same failure the 08-13 split was written to stop.** That
> split enforced *"the index carries state, the queues carry detail"* on the `## ACTIVE`
> section (1,368 → ~290 lines) and the bloat simply **reappeared one heading up, in the
> snapshot table**. Measured 2026-08-14: the table was **58,331 of the index's 97,481
> characters (60%)**, and the judged-loop row alone was **41,365 characters — 42% of the
> whole file in ONE table cell.** An orientation surface that costs four tool calls to read
> does not answer "what's next?" in 30 seconds, which is the only thing it is for.
> **The lesson for the next `/pm`: the rule is about the FILE, not about a heading.** Every
> live pull named in these rows was verified present in `qa/di/BACKLOG.md` before the move
> (items 15 · 16 · 17 · 18 incl. 18a/18b/18c · 19 incl. 19b/19h-i-b/c/e · 20 · 21), so
> nothing operational is only here.

## Current snapshot — reconciled 2026-08-13 (full `/pm`) (**The judged-loop lane shipped FIVE ports in ~24h and crossed into MATH — 8 `rhyme-studio`, 9 `read-aloud-studio`, 10 `decodable-reader`, 11 `letter-spotter`, 12 `ten-frame` — and the user drove two of them the same day. ⭐ THE BOARD'S CENTRAL FACT HAS CHANGED SHAPE: it is no longer "nine surfaces nobody has looked at". `ten-frame` was driven FOUR times and `letter-spotter` once; the drives found four blocking defects and all four are fixed. But EVERY drive answered CORRECTLY, so what is still unheard is not the machinery — it is the JUDGE, which on math has never refused anything at all. The mic sitting is re-ranked around that split. Two corrections this run were the registers contradicting themselves: `letter_name` was still doctrine-BLOCKED in two live places six hours after the user overturned it, and #97 existed twice with the two records disagreeing. ⚠️ `main` == `origin/main` == `6161a0f` and holds NONE of the five ports — the uncommitted tree is now ~6,300 lines, one lane, carrying five drives' worth of fixes.**)

| Lane | State | Pull now | Trusted as of |
|---|---|---|---|
| **🚀 PROD / `main`** | **✅ 2026-08-13 23:00 — THE WHOLE JUDGED-LOOP TREE SHIPPED AND `main` IS FAST-FORWARDED AGAIN: `main` == `origin/main` == `910e981`, NINE commits past `6161a0f`, working tree CLEAN.** What landed: `fc977d4` the shared di-script testkit (13 packs) · `e5d3c1a` `JudgedMicPanel` + `phaseResultsFromSummary` (item 19d) · `b186627` the four literacy ports 8–11 · `2f73725` `ten-frame` (port 12, first MATH) · `4468139` the 400-char cue-log preview · `838c917` `/add-di-loop` · `dc64e25` + `910e981` the register slices (queue closures; index/archive split). **⚠️ Every "uncommitted / lives only in the working tree" claim elsewhere on this board is now FALSE — including in the judged-loop row below, which still says "zero commits since `6161a0f`". That row was true when written and the ship invalidated it 40 minutes later; it is the same decay this file has now recorded four reconciles running.** ⚠️ **The DEPLOY is still unverified, as it was for `6161a0f`** — the push is confirmed, a Vercel build off `910e981` is not (`vercel.json` carries no branch config). **Check the dashboard; the backend did NOT move** (Cloud Run is a manual `gcloud builds submit`, and residual 1 — `cloudbuild.yaml` names `ai-tutor-backend` while the live service is `mountamo-education` — still bites the next backend deploy). *Prior state:* **✅ 2026-08-12 — FAST-FORWARDED AND PUSHED, ON A USER RULING ("FF everything now"). `main` == `origin/main` == `6161a0f`** (was `f4facf5`, 6 behind; `f4facf5..6161a0f` pushed clean, zero divergence). Prod now has: `927b754` multiplication-explorer (the only *correctness* fix in the set — five panels drew the WRONG picture for the child), `ead9ae1` the shared engine cut-in, `71cba07` di-spoken-practice, `9139cf1` ports 5–7, plus two doc commits. ⚠️ **WHAT THIS MEANS FOR THE HUMAN QUEUE — the mic sitting is now a PRODUCTION check, not a pre-ship one.** Eight judged surfaces the sitting has not cleared are live and manifest-routable; the user took that trade knowingly on the strength of #91 + #92 both passing first drive. **The sitting's priority goes UP, not down.** ⚠️ **WHAT ACTUALLY DEPLOYED IS UNVERIFIED — the push is confirmed, the deploy is NOT.** `vercel.json` carries no branch config (production branch is a dashboard setting), so whether `main` auto-deploys could not be established from the repo; a first draft of this row asserted it did and that claim was withdrawn before it shipped. **Check the Vercel dashboard for a build off `6161a0f`, and if none, trigger one.** The **BACKEND definitely did not move** — Cloud Run is a manual `gcloud builds submit`, so **residual 1 still bites the next backend deploy** (`cloudbuild.yaml` names `ai-tutor-backend`; the live service is `mountamo-education`). ⚠️ **WHAT IS NOT IN THIS FF HAS GROWN 5× SINCE THE ROW WAS WRITTEN (updated `/pm` 2026-08-13).** It said "port 8 `rhyme-studio` + `/add-di-loop`". Actual uncommitted surface on the ship branch is now **five ports** — 8 `rhyme-studio`, 9 `read-aloud-studio`, 10 `decodable-reader`, 11 `letter-spotter`, 12 `ten-frame` (the first MATH port) — **plus the shared runner/engine changes they landed** (`useJudgedScriptRunner`, `useJudgedSpeechLoop`, `judgedScriptContract`, `LuminaAIContext`, the `lumina_tutor.py` 400-char preview widening), the `/add-di-loop` skill, the L5 ladder edits, and three catalogs + `problem_type_registry.py`. **~6,300 changed lines, all ONE lane** — which is what makes it shippable in one slice, and also what makes leaving it uncommitted expensive: five user drives' worth of fixes exist only in this working tree. ⚠️ **Fix residual 1 BEFORE any next backend deploy** (`cloudbuild.yaml` names `ai-tutor-backend`; the live service is `mountamo-education` — the next `gcloud builds submit` targets a service that isn't there). *Prior state, still true:* **✅ DEPLOYED AND LIVE-VERIFIED 2026-08-11 — the whole checklist was taken the same day it was filed.** (fast-forwarded; the 08-10 row below saying "main NOT fast-forwarded, held for the mic sitting" is STALE — its own escape hatch was used). | **The blocker filed earlier this run is CLOSED. (1) Vercel env var took** — zero `http://localhost:8000` across 9.4MB of deployed JS (was the entire defect); the bundle points at `https://mountamo-education-869605204378.us-east5.run.app`. **(2) Backend is up on Cloud Run** — `/` returns the v4.0.0 welcome, `/docs` serves, and `/api/auth/invite/{code}` answers `{"valid":false,"reason":"not_found"}` on a bogus code, i.e. prod FastAPI is reaching prod Firestore. **The `--set-env-vars` footgun did NOT bite** (secrets survived). **(3) USER DROVE THE REAL FLOW on the live site** — a `test1grade3` account exists in Firestore, created through prod signup with a real invite. ⚠️ **Two residuals, both small: the service deployed as `mountamo-education`, NOT `ai-tutor-backend` as `cloudbuild.yaml` names** (reconcile before the next deploy or it targets a service that isn't there), **and first request cold-started at ~18s** — long for a child's first click; consider min-instances=1 before the family session. **⚠️ SUPERSEDED 2026-08-12 — SEE THE STATE CELL: `main` is now SIX commits behind, not one.** | 2026-08-13 |
| **🧮 `multiplication-explorer` per-challenge facts** | **✅ DONE + PUSHED `927b754` (2026-08-11, 1,051 insertions / 10 files) — and it reached `origin` with NO queue record in any register. Filed this run.** | The primitive was architected single-fact and grew a multi-fact `fluency` mode; grading was fixed 07-07 but **the five representation panels kept drawing the SHARED fact for another month while the tracker showed a pass** — the picture lied to the child in exactly the modes the oracle had certified. Now: `selectFacts` enumerates a code-owned pool with maximum spread, each challenge resolves `challenge.fact` → parsed `targetFact` → `data.fact`, and `MultiplicationRepresentation` assigns a visual modality per challenge. Filed as **EVAL_TRACKER SP-30** (the pattern: enumerate the readers of a shared session object, don't re-run the check that just went green) and the tracker row is refreshed off 2026-06-14. **Human gate = #90 (never looked at).** This is the execution of the standing *N challenges = N problems* ruling. | 2026-08-11 |
| **🚢 SHIP THE TREE** | **✅ DONE 2026-08-10 — TEN commits on `ship/2026-08-10-judged-loop`, pushed. ⚠️ ITS "main NOT fast-forwarded" CLAIM IS SUPERSEDED by the PROD row above — the ff was taken 2026-08-11. Tree is NO LONGER clean: the `di-spoken-practice` pack + the engine cut-in are uncommitted (see row below).** | `e5f84cf` DI-GREET-1 · `ce1fc80` the four literacy ports (+ `letterGroups`, `phonemeVoice`, the `verdictTimeoutMs` engine fix) · `021c8c0` the generalized runner + counting-board/push-pull-arena pilots · `763c617` invite-gated signup · `3226734` objective ordering + the A/B deletion · `8ba8c1e` hundreds-chart lesson window · `9e9cac2` letter-spotter emoji splice · `0207cd6` the orphaned pair · `9839eed` `/add-spoken-judge` retirement · `4ca1a54` this reconcile. Gates on the committed state: **typecheck:lumina 0 · vitest 207 files / 2700 passing · backend 26F/126P = documented baseline.** **THE ORPHANED PAIR WAS RULED — COMMIT, on evidence not ownership:** the backend's drop-don't-fill interpolation landed in `d895bfb`, so the frontend preview and `scaffoldAudit` were asserting `(not set)` text the runtime can no longer produce; reverting would have preserved a preview that lies. **The `/add-spoken-judge` retirement also found five DANGLING POINTERS in live source** (`useVoiceAnswer`, `useVoiceChoice`, `useSpokenWordCapture`, `MultipleChoiceProblem`, `PRD_MISCONCEPTION_LOOP` all cited the deleted skill as their doctrine authority) — re-pointed in the same commit; a first grep claim that the tree was clean was WRONG and was checked before the message shipped. **➡️ WHY `main` IS HELD:** six judged surfaces (#82–#87) have never heard a wrong spoken answer, and the mic sitting may produce script wording fixes. Fast-forward is clean and ready (`main` == `origin/main` == `d40d3da`, zero divergence) — take it after the sitting, or now if the pilot invite needs to go out first. | 2026-08-10 |
| **🔝 JUDGED-LOOP FAMILY — DI modality on literacy + **MATH** + the generalized runner** | **🆕 2026-08-14 (latest, user report "tutor is saying system instructions") — THE HARNESS'S FIRST CAP DRILL CAUGHT A PRODUCTION TRANSPORT DEFECT, FIXED SAME DAY: the backend prepended its `[CURRENT STATE]` block to judged cues whenever the runner's per-item context update changed state, and the Live model NARRATED it — target answer first, before the scripted ask (6/6 attach-beats echoed, 0/2 clean beats; the prompt rule forbidding it lost). Fixed at the TRANSPORT per standing doctrine: judged cues send `scripted: true` (runner + harness), `TextQueueEntry.scripted` skips the attach; improvising primitives keep the channel. The 12-HIGH pre-fix report was ONE mechanism — reports now cluster findings per mechanism so that reads as one fix, not harness noise. 4 new backend units; regression guard = `di-tag-spoken`+`di-answer-leak-in-ask` together on ask beats → check `state_attached` in the ledger. **RE-DRIVEN post-fix, 2 live runs: PASS with warnings — 0 HIGH confirmed, every ask beat clean, judge 13/13 refusals / 12/12 affirms;** the one new note is the SAME class on the RESUME channel (a real Gemini drop mid-run → the tutor narrated its system prompt's student-context section once) — queued as 19h-i-e with the fault-drop injection as the probe, not fixed blind. Record: `qa/di/BACKLOG.md` 19h-i-a + 19h-i-e.** *Prior same day:* **🆕 2026-08-14 (later, user ask) — THE JUDGE IS NOW MACHINE-TESTED: `/tutor-test --di` drives the judged loop HEADLESSLY (`run_tutor_live.py --di`), answering every spoken item WRONG on purpose then right, as TEXT — no TTS, because an untagged text turn reaches Gemini through the same floor a spoken answer does and is judged under the identical contract. Driven live twice on `ten-frame`: **7/7 wrong REFUSED, 7/7 right AFFIRMED**, and the `--di-cap` drill REPRODUCED BOTH OPEN 18c DEFECTS machine-side (verbatim-repeated correction; capped item that re-asks then withdraws) plus **a new class no drive had filed** — the tutor appends 26–37 unscripted words to a `say exactly` affirm line, which on run 1 told a five-year-old *"You're all done with this part!"* at item 4 of 7. Cues are NOT authored in the harness: `?di=1` serializes them from the port's own script module, so it cannot drift. Gates: typecheck:lumina 0 · tsc 803 = exact baseline · vitest 3125. **Scope: one adapter (`ten-frame`) — sweep queued as 19h-i-b; and a green `--di` run holds the SEMANTIC half only, never acoustics/mic/VAD.** *Prior this day:* **MATH P2 SHIPPED: `addition-subtraction-scene` IS ON THE JUDGED LOOP (port 13, all four eval modes; `qa/di/BACKLOG.md` item 18 P2).** The user's second example from the original thread — *"may benefit from speaking aloud instead of typing"* — and the typed numeral is exactly what died, at both bands, along with K's numeral-tile row. **The gate this port was waiting on CLEARED rather than being broken:** #98's drive landed 6/6 refusals / 6/6 affirms the same day and the user then closed the whole mic sitting, so P2 shipped on the new standing rule (machine gates + a live generation probe) and **filed no mic row** — no new response class, no new answer material, and the stimulus gate is 19c-i's, consumed not re-invented. **Fork:** `solve_story` (K+1) spoken · `act_out`@1 spoken (enact the departure, then say the count) · `act_out`@K enacted (contract R3 untouched) · `build_equation` + `create_story` built. ⭐ **THE FINDING: THREE MODES COULD NOT PRODUCE A WRONG ANSWER.** `act_out`@K and `create_story` auto-judged the instant the enacted count MATCHED — ten-frame's Check-button-that-presses-itself, twice more — and G1 `create_story` was worse: `const correct = true`, any scene+object selection accepted, so **an entire eval mode had been feeding IRT evidence that measured nothing at one band.** Stillness makes the first two judgeable; the third is deleted and G1 given K's construction. **Search every Class-B primitive for a commit that fires on a MATCH — that is a correctness gate wearing a close.** ⭐ **AND THE EQUATION TRAY NEEDED A NEW CLOSE SHAPE:** a finished `N op N = N` SHORTENS the stillness window to 1.2s rather than committing on the keystroke, because `3 + 2 = 1` is a complete sentence on its way to `3 + 2 = 10` — still not correctness-gated, and the verdict names which of three faults happened. ⭐ **WRITING THE SPOKEN ASK AUDITED THE CONTENT:** generated stories sometimes carry their own question (which may not be the one this item's `unknownPosition` is about — a wrong ask, not a redundant one) and sometimes STATE the value the child must produce; both are now build gates on both sides of the wire, imported not copied, and both held on all 40 live-drawn items. **Gates:** typecheck:lumina 0 · tsc **803 = exact baseline, 0 in touched files** · census greps 0 · own suites **79/79** · **full vitest 3120 / 0 failed** · **6-run live probe, both bands, 40/40 kept, zero drops** (deleted after the run) · the `cuedItemId` stimulus gate revert-bitten. **βs held on all four modes, deliberately** — the reasoning for `solve_story` (a K-only structural change on a per-MODE parameter) is in the queue block. **Inherited, not introduced:** this pack has both of 18c's authored defects by construction (a capped item re-asks then is withdrawn; corrections are byte-identical) — **18c is family-wide now, not ten-frame's.** ➡️ **P3 (`#63`, the >20 bench) is now the top of item 18** — both ports that could ship without it have shipped, so every remaining Class-A candidate sits behind that one acceptance. *(Prior note, still accurate for its own date:)* **🆕 LATE 2026-08-13 — THE LANE CHANGED SHAPE AFTER THIS SNAPSHOT WAS WRITTEN AND THE ROW BELOW PREDATES IT. Two new queue items, and the pull is no longer "the next port".** **Item 19 GENERALIZE THE PORT** (`qa/di/BACKLOG.md`) — the extraction generalized the LOOP but not the envelope, furniture, gates or test harness, so each port hand-authored ~1,100–2,000 lines and a live-drive fix landed in ONE pack while ~9 kept the defect. **19a (testkit sweep) ✅ and 19d (judged stage furniture) ✅ both SHIPPED 2026-08-13** — 13/13 suites on shared gates, `JudgedMicPanel` across 15 surfaces, −299 lines net, and **19d was USER-DRIVEN on ten-frame + letter-sound-link the same day**. **➡️ 19b (mic-level context churn) is the named NEXT MACHINE PULL and must ship WITH a mic drive, never on tsc.** **Item 20 OPENED** — the transcript is a lossy spectator view and 20 components build misconception evidence from it; probe before code. **AND #93 IS STRUCK** (see the pull cell). ~~⚠️ **Tree is now ~9,241 insertions / 8,378 deletions across 84 files, still ONE lane, still zero commits since `6161a0f` — SEVEN drives' worth of fixes exist only in the working tree.**~~ **✅ SHIPPED 2026-08-13 23:00 — nine commits, `main` ff'd to `910e981`, tree clean. See the PROD row.** *(Row below = the 22:19 snapshot, accurate as of then.)* **ACTIVE 1 (user rulings 2026-08-09 + 2026-08-10 *"build the general schema and capability, try it on 2-3 subjects"*). Machine side done to the fence; the SPOKEN judge is now USER-CONFIRMED refusing deliberate errors on the two driven runner surfaces (#91, #92) — the pre-runner surfaces and the SOUND target (#93) remain per-surface debt. **The lane crossed into MATH 2026-08-13 — and as of the `/pm` 2026-08-13 reconcile the math pilot has been DRIVEN FOUR TIMES (three blocking defects found and fixed, then all four modes walked end to end: *"tested all the modes, worked great"*). What has NOT been heard on any math surface is the JUDGE — every drive answered correctly.** | **🆕 2026-08-13 (LATEST) — PORT 10 `decodable-reader` REVISED BY DRIVE, uncommitted.** The user drove it and the judged loop itself held (*"DI worked great"*), but the drive found two defects, both now fixed. (1) **The proposition question could not be answered aloud** — *"i need to click on the button even though im speaking, this is the same issue with inference mode"*. Third time this ruling has landed (rhyme-studio, letter-spotter, now this) and all three times a BLOCKED class was taken as licence for buttons. New response class **`closed_set_choice`** (accepted-build-ahead; the child says which printed choice it is, judged against the exact menu), `answer_tap`/`[DR_TAP]` deleted, cards kept as the closed set but no longer buttons, plus an **ear-separability build gate** on both sides of the wire so a subset choice is dropped rather than judged leniently. (2) **The summary counted `solved` as `solved alone`** — it printed "N of N done all by yourself" over a corrected answer, because the port hand-rolled a completion block instead of using `PhaseSummaryPanel`. Now on the family panel. **Gates:** typecheck:lumina 0, di-script 48/48, literacy+hooks 731, service 1482, 4 fresh live probes with zero questions dropped by the new gate. **NOT mic-verified — HUMAN-CHECKS #96 (c)+(g) is the acceptance drive, and (c) is also the new class's.** · **✅ THE LANE REACHED MATH — `ten-frame` SHIPPED 2026-08-13, uncommitted, all four eval modes (qa/di/BACKLOG.md item 18 P1; mic row #98). ⚠️ FOUR USER DRIVES SAME DAY, and the first three each found a BLOCKING defect the 40-test suite could not (updated `/pm` 2026-08-13): (1) the frame went DEAD on item 2 — the component gated taps on `runner.stage === 'asking'` but the runner opens the next item without returning to that stage, and the bug HEALED ITSELF on a wrong answer, which is why every machine test missed it; (2) the flash never fired — the callback closed over `runner`, new every render, and `micLevel` ticks once per audio frame, so the prep timer was torn down faster than it could fire (⭐ the `lumina-context-identity-churn` failure mode again, and it only reproduces WITH THE MIC OPEN, i.e. the only way this primitive runs); (3) the flash ran BEFORE her line instead of after — now keyed to the falling edge of `runner.tutorSpeaking`, retiring the 3s-window criterion entirely. Drive 4 walked all four modes: *"tested all the modes, worked great."* **The row stays OPEN and the reason is narrow — every drive answered CORRECTLY, so the JUDGE is still unheard on every math surface.** The pilot the whole math sweep is gated on. **User call taken at the top of the slice:** ship the full port, not the two spoken modes — the runner owns the item list for the run, so a half-port means two progression systems in one file. **The fork math forced, and it is the lane's governing rule now:** in literacy the clicking was almost always a costume for a mouth; **in math the manipulative is often the skill**, so only the STEPPERS died — `build` and `make_ten`@K kept their hands and gained a JUDGE (contract R6, a standing user ruling, held as written and was the reason `build` stayed gestural too). ⭐ **THE FINDING WORTH CARRYING: how a hands-only turn CLOSES.** cvc-speller and counting-board both had structural commits (last slot filled / one tap = the answer); **`build` has no terminal state** — ten cells, a target of five — and the only alternatives were a button (deleted by doctrine) or the voice (unbenched). So: **a hands turn closes on STILLNESS, the exact analogue of the mic's silence bracket.** Not correctness-gated — a wrong placement commits as readily as a right one, which is what the Check button used to fake. **This generalises to every Class-B primitive** (base-ten-blocks, fraction-bar, balance-scale, sorting-station), all of which have the same problem. It also made `make_ten`@K **judgeable for the first time**: R6's frame-full auto-judge could only ever produce a correct answer; stopping early is now wrong. ⭐ **AND THE LEAK WAS PIXELS, NOT STRINGS** — every leak gate in this family scans TEXT, but on add/subtract the running-count readout **equals the sum the child is about to say aloud** (harmless while a button graded it; a straight leak the moment the answer became spoken). Withdrawn there, kept on build/make_ten as the child's own trace; the empty-space readout is no longer rendered at all, so R5 stops resting on a flag. **Gates:** typecheck:lumina 0, census greps 0, 40/40 own tests, **full vitest 3023 / 0 failed**, live 6-run pipeline probe **38/38 items kept, zero drops** (double frame stayed inside 20 unaided — the empirical half of why ten-frame was the right pilot). **βs unchanged on purpose:** the modality changed, the production demand did not. **NEXT: drive #98 and #86 together** (counting-board shares this engine and its number-word handling); **P2 `addition-subtraction-scene` does not move until #98 is heard.** Filed not fixed: `make_ten`@K is arguably performable without the skill — a *reader-fit* question about R6, not a DI one. Queued: **item 18a**, `numberWordFor` exists in THREE copies that disagree outside 1-20 (one throws, one falls back to a numeral and *relies* on it) — needs a ruling, not an edit, and not inside another port. · **✅ PORT 11 `letter-spotter` SHIPPED 2026-08-13, uncommitted — CALLED BY A LIVE DRIVE, NOT BY THE SWEEP, and it is the sharpest evidence yet for why the modality exists.** The user opened a session log (`42edfc52e539`) and asked whether the primitive was worth changing. It was failing four ways and all four were one mechanism — **nobody owned the clock**: THREE cue sites each ordered the sentence re-read (advance, wrong-answer, and — worst — the CORRECT cue's *"read the full sentence aloud as celebration"*), so one item was spoken 2-4× (*"I see an ant walk away"* three times in 13s); the child answered faster than the tutor spoke so the floor gate **coalesced a try-again hint and an answer reveal into one utterance** (`seq 81`, `cues: 2`, `waited_ms: 12625` — the gate was correct, the primitive was firing contradictory cues); **109s of tutor speech in a 125s session** (87% of wall clock) ran 8-16s behind a screen whose buttons were already live, so the log shows a child answering *before the question finished being asked*, with no replay; and Group 1's `newLetters` being the WHOLE group made the "NEW letter → hint at its shape" branch fire every item (*"a triangle with a line across the middle"*), handing the answer to any child who knows letterforms. ⚠️ **THE PORT'S CENTRAL CLAIM WAS OVERTURNED THE SAME DAY, BY THE USER, AND THIS ROW CARRIED THE DEAD VERSION FOR SIX HOURS (corrected by `/pm` 2026-08-13).** It shipped as *"the FIRST PACK IN THE FAMILY WITH NO SPOKEN MODE — all three directions TAP"*, on standing-gate-1 arithmetic: the answer is a GRAPHEME / a LOCATION / a FORM, and `letter_name` was BLOCKED with this primitive's own homophone ruling as the block's evidence line. **The user drove it (`6ada8c0a1bcf`) and ruled the opposite:** *"in real life if i have a sentence with a missing letter, and i ask the student to use context clues and the word to say the missing letter, they should be able to translate the sentence and missing letter verbally. they dont need to click a button."* **`name-it` is now SPOKEN (`letter_name` → `accepted-build-ahead`) and the four option tiles are DELETED — a PEDAGOGIC gain before a modality one**, since a menu turns production into recognition and floors a guess at 25% (the drive that produced the ruling was offered `n / s / i / a`, two of which sit in the same /ɛ/ cluster the option set was supposedly protecting the judge from). **The block's real content survives as a per-ITEM constraint, not a class-wide one:** the judge is handed ONE target, the pack accepts the letter's SOUND as well as its name (a cluster confusion must beat two channels), and the cluster table in `judgedScriptContract.ts` names the items to drop. `find-it` and `match-it` stay gestures — a LOCATION and a FORM are not sayable. **Second defect fixed on the same drive:** match-it repeated a byte-identical 26-word ask on all six items, so the DISTAR lead-in now speaks only when a direction is introduced. *(The original ⭐ argument is preserved here because it is still the right reasoning — it was the BLOCK that was wrong, not the arithmetic.)* Asking for the SOUND instead would unblock speech and **duplicate `letter-sound-link`**, which already owns grapheme→phoneme production. **THREE REVEAL POLICIES because the answer differs per mode** — `name-it` says the WORD (stimulus) but never the letter; `find-it` says the LETTER (stimulus) but never its position; `match-it` names nothing until it corrects — and **no cue may describe a letter's SHAPE at any tier**, with the tap contract telling the tutor so. **`find-it` CHANGED SHAPE:** select-every-instance-then-Check → **one target per grid, one tap per commit** (the Check button is what the modality deletes, and a batch commit gave no correction at the moment a b/d confusion actually happened); β held at 2.5 because β measures the discrimination load, which is untouched. **🔴 THE LIVE PROBE EARNED ITS PLACE TWICE OVER — two defects that EVERY semantic gate passed:** `targetWord` came back as **400 characters of the model's own deliberation** on four of eight drawn items (`"sheep-invalid-word-fix-start-with-s-no-dash-…"`) — the unbounded-string runaway the enums fixed for `options`, reappearing in the one field that cannot be enum-locked — and **nothing downstream could catch it**, because the string still started with the target letter and still occurred exactly once in a sentence built from it, so the drop-rate check read 8/8 askable, a false green. **Generalizable: a field with no enum needs a SHAPE gate, not only a meaning gate.** Also **duplicate challenge ids** (`ch1` twice), refused by the pack validator — the generator only filled MISSING ids and now stamps them positionally. Fixed from the same evidence: a/an agreement (*"I see a ant walk away"*, *"I see a inky paw print"* — read aloud to a five-year-old, in a **literacy** primitive) and a rotating fallback frame so two rejected sentences don't degrade to the same line. **Also restored: the printed word RESIDUE** — the click-era render replaced the whole target word with the marker (*"I see a ⭐ walk away"*), discarding the one decodable cue and leaving the sentence as pure decoration, though the data model had always stored the marker over just the first character. Deleted: the advance handler + every improvised tutor message, the 3-attempt reveal-and-lock ladder, Check + Next, eight cue tags and their catalog directives, the shape-hint branch, the ten-emoji marker pool (which changed the SPOKEN prompt every item — "the ⭐", "the 🌟", "the crystal ball", "the diamond", "the target" inside two minutes), and `strategyHint` (on-card prose at a band that cannot read; the lever moved into the spoken DISTAR lead-in). Port-11 gates: typecheck:lumina **0** · tsc **803 = baseline, zero in touched files** · census greps **0/0/0** (docblock prose reworded — comments count) · di-script **36/36** · full vitest **215 files / 2982** · **3 live real-pipeline probes, one per eval mode, 19/19 items askable** (probe deleted). **Mic row #97 — PARTIALLY DRIVEN 2026-08-13 (`de8a6a78d9db`): spoken name-it confirmed (*"much better"*) and the bracket hold held — zero stray tutor turns and no fabricated tags across six tap items. STILL OWED: the wrong-answer half** (say the WORD back → must be REFUSED; the SOUND channel → must ALSO be affirmed) **plus the match-it repetition re-drive, and no live generator probe has run since the spoken conversion, so the drawn words are unverified against the new ask.** **➡️ 2026-08-12 USER CALL — THIS STREAM'S FOCUS IS CONTINUED LITERACY DI BUILDOUT. THE PLAN IS FILED: `qa/di/BACKLOG.md` item 16 → "THE BUILDOUT PLAN" block.** Four phases: **P0** the mic sitting (upstream — #94's accept-set ruling decides how P1's scripts are written) · **P1 RETIRE THE INTERIM RUNG** — `interactive-book`, `story-talk`, `word-workout`, serial via `/add-di-loop`, **no bench needed, and it kills the last push-to-talk in literacy** · **P2** the three-way fork triage on the remaining 20, whose real output is the **🚫 DI-DOESN'T-FIT bucket** (composition primitives — porting them would be worse than leaving them) · **P3 ⭐ the read-aloud pair** (`read-aloud-studio` + `decodable-reader` — the two primitives *about* reading aloud, both with zero listening channel; blocked on ONE bench for `connected_text`, which is a LENGTH question, not the `open_set_word` openness question). **✅ PORT 9 `read-aloud-studio` SHIPPED 2026-08-12, uncommitted — P3's HALF DONE, AND ITS BENCH BLOCKER DISSOLVED RATHER THAN CLEARED.** The `connected_text` bench was assumed necessary because a read-aloud passage was assumed to reach the judge WHOLE. **Split into lines it never leaves the benched class at all** — `sentence_read_aloud`, 3-8 words, and `MIN/MAX_SENTENCE_WORDS` are IMPORTED from di-sentence-reading so the ceiling lives in one place. Free-length connected text still owes its sitting; so does `decodable-reader` if its reads cannot be split the same way. **✅ ANSWERED SAME DAY — PORT 10 `decodable-reader` SHIPPED 2026-08-12, uncommitted: P3 IS COMPLETE.** Its reads split *without a new seam* — a decodable passage already arrives as an array of sentences with per-word phonics tags, so the split needed a gate, not a redesign, and 24 live-generated sentences across 5 probes came in inside the 3-8 word window with **zero drops**. The census undersold this one the same way it undersold port 9: not "click-to-advance" but **an entirely unmeasured reading phase** — the only reading signal was `wordsTapped` (how often the child asked for a word) and it ended on a button reading **"I read it!"**, which a child who cannot read can press. **⭐ THE PORT'S HARDEST CALL: TWO ANSWER MATERIALS IN ONE RUN, and the fork follows the ANSWER, not the mode.** The reading is `sentence_read_aloud`; a LITERAL/read-along comprehension answer is a WORD STATED IN THE STORY so the child SAYS it (`short_spoken_word` — DI's own oral-comprehension form, and the only reason `read_along` has a spoken beat at all since a K pre-reader does no decoding); a SEQUENCE/INFERENCE/MAIN-IDEA answer is a whole PROPOSITION, which spoken is the BLOCKED `open_set_word`, so the picture cards close the set and the tap is the commit with a code-computed verdict. **And it forks per QUESTION, not per session** — a literal question with no usable one-word answer falls through to the cards, which is a change of MATERIAL, never a loosening of the judging. **The per-word "tap to hear it" — this primitive's signature affordance for a year — is DELETED as an answer-leak channel:** in a judged cold read it lets a child hear every word and echo the line. Help arrives through the correction, which re-models. **Two whole-run gates ship nothing rather than ship a broken ask:** a `read_along` whose STORY would open a sentence with a verdict sentinel (the tutor NARRATES it, there is no per-sentence item to drop, and the reducer would score its own narration as an affirm), and a decode run with no surviving line (one line on screen at a time means the child never met the story). **The live probe caught a content defect on the first draw** — `main_idea` asked *"What is the whole story mostly about?"* and *"What is the central message of this passage?"*, **one problem worded twice**, because a story has exactly ONE main idea; `questionCount` is now mode-aware (read_along 3 · main_idea 1 · rest 2). **Generator-side, KEEP-OR-DROP replaced a BACKFILL that invented answer keys** (an invalid `correctOptionId` used to default to the first option — harmless-ish under a tap, but under a judged loop it hands a fabricated key to a tutor that states it aloud as fact). **βs moved with the STRUCTURE:** literal 1.5→3.0, sequence 2.5→4.0, inference 3.5→5.0, main_idea 4.0→5.5, read_along 0.5→1.0. Port-10 gates: typecheck:lumina **0** · tsc **803 = baseline, zero in touched files** · vitest **214 files / 2946, 0 failures** · di-script **48/48** · census greps **0/0** · **5 live real-pipeline probes, one per eval mode, zero drops** (probe deleted). **Residual (queued): a dropped sentence is now a sentence the child never SEES** — the one-line stage means a drop removes story content a later question could ask about; zero drops observed across five probes, so the question↔surviving-lines consistency check is filed, not written. **Mic row #96.** **This was the lane's most deserving surface and the census undersold it: it did not merely lack a listening channel, it SCORED children off four button presses** (`modelListened + recordingMade + selfAssessment + comparisonUsed`), and "estimated WPM" was wall-clock ÷ word count — tap Start and Stop back to back and it read **6000 WPM**. **⭐ THE PORT'S HARDEST CALL, and the one worth copying: PROSODY IS TAUGHT, NOT GRADED.** Two of three modes are *about* how the reading sounds and the obvious port judges that — it must not. No prosody response class exists, and *"did that sound expressive?"* forced into a binary verdict is the ambiguous ask the family refuses: **a judge that cannot reliably refuse rubber-stamps, and refusing is the whole value.** So expression/dialogue model-and-imitate and grade the WORDS, with an explicit clause forbidding a sound-based refusal (*"A flat or plain reading that gets every word right is CORRECT"*) — without it the tutor invents a prosody refusal off the back of "say it just like that", **an unbenched judgment wearing a benched one's clothes.** That is #95's ⭐ criterion: read it back FLAT and it must be AFFIRMED. `accuracy` stays a COLD read (per-item `coldReadGuard`; tap-to-hear re-speaks the INSTRUCTION, never the line — otherwise it is an answer-on-demand button). **Stale steering caught and re-based in the same slice:** `catalog/di.ts` was still telling the manifest that read-aloud-studio is "student self-assessment only" and produces no graded evidence — the sentence di-sentence-reading forked on, now false in both halves, pinned by a test. **Sentinel gate had to run over GENERATED prose** (a line *"I was tired. Yes, very tired."* puts an affirm sentinel inside a CORRECTION and advances on a misread) — `findSentinelCollisions` reused as the build gate on both sides of the wire. **Shared runner change:** `useJudgedScriptRunner` gained `silenceCloseMs` (a number, not a config object — churn footgun), because connected text splits into two voice turns at the family default 500ms; this pack passes di-sentence-reading's proven 1100ms. **βs moved because the STRUCTURE did:** accuracy 2.0→**3.0** (pinned to `read_sentence`), expression 3.5→**4.5**, dialogue 4.5→**5.5**; catalog + `problem_type_registry.py` together. **No rate metric replaces `estimatedWPM` deliberately** — a real WPM needs voice-turn DURATION and the engine surfaces only latency TO it, so dividing by the item cycle ships a second wrong number; queued, not faked. Dead weight found by writing the ask: `comprehensionQuestion`/`comprehensionAnswer` were generated on every call for months and rendered nowhere. Port-9 gates: typecheck:lumina **0** · tsc **803 = baseline, zero in touched files** · vitest **215 files / 2901** · di-script **35/35** · census greps **0/0** (0 `setTimeout` in the component) · **3 live real-pipeline probes, one per mode, ZERO drops** (probe deleted). **Residual (queued): the G5 dialogue draw reads stilted** — Lexile pressure squeezed into a 7-word ceiling makes the model raise vocabulary because it cannot raise length; cheapest fix is prompt-side, the real fix is the `connected_text` sitting. **Mic row #95 — ✅ HALF-DRIVEN 2026-08-13, AND THE PORT'S CORE CLAIM NOW HAS SPOKEN EVIDENCE.** User drove `accuracy` (session `dc60915090e5`, 4 items / 73s): *"works great… i did an intentional miss and it nailed it."* `The cat sits on his lap.` read as *"sat"* → *"My turn: not sat — The cat sits on his lap. Your turn. Read it again."*, **no `context-update` on the miss** (the item did not advance), advance only after the corrected re-read. Cold read intact across three asks (*"Your turn. Read it."* and nothing else). So the split-into-lines bench argument holds on a real child's voice, not just di-sentence-reading's. **What this drive did NOT touch is the port's own hardest call: `expression` + `dialogue`, where a FLAT correct read must be AFFIRMED.** The prosody non-refusal is still unheard. Also owed: the skipped-word class, the twice-missed move-on, the 1100ms mid-line pause. ⚠️ **One watch item and it is a LOGGING defect first** — the second deliberate miss was cut off by a client disconnect and the contrastive slot may have inverted (transcript `Sam read the fast words.` → *"My turn: not **reads** —"*), **unresolvable from the log because `context-update` writes key NAMES only and the `text-to-gemini` preview truncated at 160 chars, landing just before the stimulus every single cue.** Preview widened to 400 in `lumina_tutor.py` this session so the next drive is adjudicable; a judged-loop log that omits the judged item cannot verify a judge. **Census corrected at import level: 8 ported · 3 interim · 20 no-voice** (the brief's §2 grep counts docblocks and reported two ports as un-ported). **🛑 ~~Pull = THE MIC SITTING (user-owned)~~ **— THE SITTING IS CLOSED, USER RULING 2026-08-14: *"lets just trust the tutor works ive done a lot here."* TWELVE ROWS STRUCK AS A BLOCK (#82–#87, #89, #94–#98); the judged-loop human queue is now EMPTY except #90, which survives because it is a screen glance at a correctness fix, not a tutor check.** The evidence under the ruling: the spoken judge has refused deliberate errors on THREE independent surfaces (#91, #92, #93) plus read-aloud-studio's word swap, and on 2026-08-14 `ten-frame` drove **6/6 refusals and 6/6 affirms, zero errors either way** — carrying the contract into MATH. Every struck row was a re-run of that one contract on another surface. **Knowingly carried:** the counting-vs-total split is unverified (`subitize` must refuse a counted-up answer where `counting-board` accepts it — a pedagogy risk, not a broken loop), and `make_ten`/`operate`/`build`-stillness were walked but never answered wrong. **New standing rule: a judged port ships on machine gates + a live generation probe; a mic row is filed only for something the contract has NOT already proven** — a new response class, answer material, or stimulus mechanism — never once per surface. **This is the bottleneck that gated the whole lane for five days, and it is gone.** *(Historic ranking, for the record: #94 · #98 + #86 · #89 · #97-tail · #96 · #95-tail · #82–#85 · #87.)* ⭐ THE RANKING CHANGED: #98 and #97 are no longer never-driven — four drives and one drive respectively — but BOTH were driven CORRECTLY, so what remains on them is exactly the judge. A surface that has been walked end-to-end reads as safer than it is: the machinery is proven and the refusal is not. ~~⭐ START WITH #93 (`letter-sound-link`)~~ **✅ DONE — #93 WAS DRIVEN AND STRUCK 2026-08-13, hours after this ranking was written: the user drove all three modes and the held-SOUND judge refused the letter name (*"the tutor did it right"*). The spoken judge is now user-confirmed on THREE runner surfaces (#91, #92, #93) — all literacy, all short spoken words or sounds.** ⭐ THEN #94 (`rhyme-studio`), which is the only row here asking a PRODUCT question rather than a verification one: its accept set was deliberately narrowed to the words on screen (a live probe caught the model offering "nake" as a rhyme for "cake"), so criterion (c) — say a REAL rhyme that is not on a card and watch it get corrected — decides whether that trade is acceptable or whether the `open_set_word` bench has to happen.** ✅ #91 STRUCK 2026-08-11: the user drove port 5 through every mode, wrong answers included — the lane's FIRST user evidence of the spoken judge refusing deliberate errors (per-surface; the older rows stay open).** The #85 sitting-B drive proved the BUILD judge (dog corrected once, bug twice then capped; gesture anchor proven; letter-group fix held live) and found+fixed `verdictTimeoutMs` dead-while-mic-open (live for four ports; revert-bitten test). The spoken contract — what all six open rows run on — is still unproven against a deliberate error. Driving card: `qa/HANDOFF-di-mic-sitting-2026-08-10.md` (now points at #86/#87 too). **✅ PORT 5 `picture-vocabulary` SHIPPED + USER-DRIVEN SAME DAY 2026-08-11 (#91 struck — "an incredibly strong modality from a learning standpoint") · ✅ PORT 6 `phoneme-explorer` SHIPPED 2026-08-11 (user portfolio call: convert), uncommitted — ALL FOUR modes verbal, the 4-choice grids died as costumes; segment's word is never printed (readers count letters); **✅ #92 STRUCK 2026-08-12 — user drove several sessions, wrong and right answers: "phoneme explorer is excellent… this passes human check."** **✅ PORT 7 `letter-sound-link` SHIPPED 2026-08-11 (user-pulled), uncommitted — THE PARKED PORTFOLIO CALL ANSWERED, and the note turned out to be the ANSWER not the obstacle:** the brief said *"receptive discrimination vs di-letter-sounds' production; it also covers stop consonants and the phoneme→grapheme direction — decide before porting"*, and both halves of that coverage survive **because the child's answer there is made of something other than an isolated stop** (in `hear-see` the TUTOR makes the stop and the child taps; in `keyword-match` the child says a whole word). The overlap is real in exactly ONE mode. **THE SPLIT: `see-hear` = say the SOUND (`continuant_sound`) · `keyword-match` = say the WORD (`short_spoken_word`) · `hear-see` TAPS, because naming a letter is `letter_name` — a BLOCKED class**; its verdict is code-computed and its correction re-models the sound without ever naming the letter, so the retry stays a real retry. **NEW CONTENT GATE:** `see-hear` may only target held sounds (`s n m f l r v z` + short vowels), enforced in code post-parse — stops keep full coverage in the other two directions. Two content bugs fell out of writing the spoken ask: **`x` is unaskable in keyword-match** ("box" does not start with /ks/ — a false anchor nobody had to SAY before) and **`y`'s keyword became "yo-yo"** ("yes" mid-correction would open a sentence with the affirm sentinel and be scanned as a VERDICT). Support tiers RE-BASED, not deleted, onto di-letter-sounds' DISTAR rungs. **`see_hear` beta 1.5 → 3.0** — it stopped being a 50%-guessable 1-of-2 and became unaided production. Port-7 gates: typecheck:lumina **0** · full suite **212 files / 2819** · **5 real-pipeline probes vs live Gemini** (gate held on every drawn item; packs from live content pass `validateJudgedScriptPack`; no keyword leaked; see_hear @ g1 drew `s a n i`, disproving the thin-pool worry). Gemini honored the constraint 5/5 so the code retarget never fired — it now has its own unit test rather than shipping as an unexecuted safety net. Deleted `LetterSoundLink.support-tiers.test.tsx` (every case asserted the audition protocol; intent moved to the di-script test). All three are runner consumers — the extraction held three times: a script + a stage, no loop wiring. Port-6 gates: typecheck:lumina 0 · slice suites 69/69 · live-gen probes 4/4 modes zero drops · §1 greps clean. **✅ `/add-di-loop` SHIPPED 2026-08-12 (user call)** — the thin skill wrapper (`.claude/skills/add-di-loop/SKILL.md`), written the moment its gate cleared (two of two runner-era mic rows passed on the user's first drive); the L5 ladder in CLAUDE.md + PRIMITIVE_LIFECYCLE.md now names DI as the strong form and `/add-voice-control` as the interim rung. **✅ PORT 8 `rhyme-studio` SHIPPED 2026-08-12 (user-pulled), uncommitted — THE LONGEST-BENCHED SURFACE, AND THE BENCH IS ANSWERED BY THE BANK, not cleared.** `open_set_word` is BLOCKED and *"tell me a word that rhymes with cat"* is its canonical case, which is why this one sat behind a sitting longer than any other literacy primitive. **The port is possible because the shipped `production` mode was never actually open** — it renders a four-tile word bank and the child taps one. The bank looked like scaffolding to delete on the way to DI; it is the only reason the mode is sayable at all. What ships is CONSTRAINED production; FREE production still owes its sitting, with a sharper question for it: can the judge hear an arbitrary child-invented rhyme, off any menu? **⚠️ REVISED THE SAME DAY BY THE USER'S FIRST DRIVE — ALL THREE MODES ARE NOW SPOKEN** (recognition = say yes/no, `yes_no` added as `accepted-build-ahead`; identification + production = say the word, `short_spoken_word`). Recognition shipped with a 👍/👎 tap for one day on the argument that a yes/no verdict is not made of language. **USER RULING:** *"i think its weird to need the thumbs up and thumbs down [for] do they rhyme? we should just be able to say yes to the tutor."* **⭐⭐ THE SESSION LOG IS THE LANE'S BIGGEST FINDING SO FAR: A SILENCE CONTRACT IS ONLY HONEST WHEN THE CHILD CANNOT ANSWER WITH THEIR VOICE.** Asked a SPOKEN question, the child answered ALOUD; the tap contract had **no scripted line for that branch**, so the model improvised all three of — **it spoke the bracket tags aloud AND invented them** (`[RS_TAP]` was never sent; it reproduced a tag name it had only seen *described* in the contract), **it invented a whole next item** ("cake, chair") while the screen still showed cat/hat, and **it affirmed with "Correct!" instead of the "Yes," sentinel so the engine read NO VERDICT and the run wedged on item 1**. Where the question is spoken and the answer is sayable, a tap surface does not restrain the model — it leaves it without a script at the moment it needs one. **The sentinel objection that justified the tap was never real: the verdict scan reads the TUTOR's output, never the child's** (the same log shows the child's "Yes." passing through clean). Two catalog directives now carry this and are worth copying to every pack: *"the bracket tag is an address on an envelope, not words for the child; after you judge, you STOP"* and *"the first word of a verdict is load-bearing"*. **⭐ PORT 7'S CONTENT RULE FIRED AGAIN AND HARDER — three FALSE ANSWER KEYS in five live probes**, all silent under a tap surface and all spoken under this one: `shark` carried family `-ank` and the answer `tank`; `crab` offered `fab` as a DISTRACTOR (a child saying it would be corrected for a right answer); `lamp` was listed as an acceptable rhyme for `jump`. All three are decidable from spelling — which is why the prompt was never the right place for the rule — and `holdsRhymeIntegrity` now repairs (`doesRhyme` recomputed from the words: the boolean is a claim, the words are the truth) or DROPS, pinned as unit regressions since live content is not deterministic. **⭐ A FOURTH DEFECT HAD NO CODE FIX AND CHANGED THE DESIGN:** for `cake` the model offered *"bake, lake, rake, **nake**, take"*, and the first draft read that whole list into the judge's accept clause because widening past the four tiles looked generous and free. **A closed set is only worth what its members are worth**; the accept set is now EXACTLY what is on screen. The cost is deliberate — a child who says a true rhyme not on a card gets corrected — and it is filed as an open PRODUCT question (#94 criterion (c)), not a settled one; if it reads unfair the answer is the bench, not a looser judge. Two reusable finds: the old `DISTRACTOR_POOL` shipped the literal word **"yes"** (port 7's near miss as a latent bug), now defended twice — `isSentinelSafeWord` on every pool AND **no cue sentence opens with a content word**, which is cheaper and stronger than the filter and worth copying to every pack; and `pickModelRhymePair` excludes by rhyme **FAMILY**, not just word (a `-at` model pair gives away every `-at` item despite sharing no letters). Port-8 gates: typecheck:lumina **0** · tsc **803 = baseline, zero in touched files** · vitest **212 files / 2854** · census greps 0/0 (0 `setTimeout` at all) · **5 live real-pipeline probes**, every pack from live content passing `validateJudgedScriptPack`; probe deleted after the run. Deleted `RhymeStudio.support-tiers.test.tsx` + the `showInstructionText` lever (it withdrew a restatement that no longer exists). **Residual (queued, not fixed): the G2 draw is weak** — the integrity gate dropped 2 of 4 on a Grade-2 probe before over-draw headroom was added (`challengeCount + 2`, then trim, so the gate never starves a lesson); the real fix is the curated per-family word menu K already has and G1/G2 do not. **Census after port 8: EVERY STOPWATCH PRIMITIVE IS NOW PORTED** — remaining are `interactive-book`/`word-workout`/`story-talk` on click-to-advance + 20 with no voice. **Filed residual, not fixed:** a stray utterance mid-build now costs up to 8s (`submitGestureAttempt` abandon rule — needs a bench or second drive). Queue: `qa/di/BACKLOG.md` item 16 (ports + runner + port-5/6 blocks). Detail: prior snapshot below. | 2026-08-13 |
| **🆕 `di-spoken-practice` — the CONTENT-GENERIC DI pack** | **SHIPPED 2026-08-11, UNCOMMITTED — THREE user live drives (`5813884d14d3`, `436dcb5616cb`, `f634f61b2b42` = 4/4 100%, drive-2 fixes confirmed), six defects found + fixed; the sixth (off-script hostage) fixed at the ENGINE level for all 8 judged-loop consumers (off-script cut-in, `interrupt: true`) — cut-in itself not yet heard live** | User question: why plug the loop into bespoke primitives instead of one schema-driven primitive? Measurement says the question is right — `WordFlip.tsx` (661) and `SoundSwap.tsx` (767) each expose ONE interactive element. **Fork: does the manipulative CARRY pedagogy?** Yes → bespoke; No → this pack. DISTAR skeleton is code, every sentence a slot; sentinels code-owned. THREE mechanical gates (because `expectedAnswer` is a field): benched-response-class refusal, answer-leak scan, and — new from drive 2 — `findUnspokenStimulus` (the ask must SAY the problem; drive 2 heard "Here is a groups problem. What is the answer?" over a printed "2 x 3"). **Drive 2 also produced a USER RULING that reversed drive 1's state-channel amputation:** the recitation root was mis-voiced `commonStruggles` text (directive prose in a field whose contract is words-the-tutor-speaks — she spoke it verbatim), so the full `contextFor`/`contextKeys` channel is RESTORED (stimulus-side only, di-math-facts rule), the WAIT doctrine moved to a session-start aiDirective, and the per-cue contract thinned to per-item data. This answers the filed family question: the hand-authored packs' channels were never the exposure. ⚠ Inherits the unproven spoken judge (#82-#87), manifest-selectable. **Open user calls: routing hold, and a re-drive of the restored channel + stated-problem ask.** Queue: `qa/di/BACKLOG.md` item 16, dated 2026-08-11 blocks. **➡️ FILED THIS RUN — the re-drive now has a row: #89**, and it is written around the cut-in because **that fix is not this pack's**: `useJudgedSpeechLoop` is shared, so the cut-in is live under all 8 judged-loop consumers (5 DI packs, 4 literacy ports, both runner pilots) having never fired in front of a person. **⚠️ MAKE IT FOUR DRIVES — a fourth (`592abf43424c`, "adding within 10", 92%) landed DURING this reconcile and found CONVERGENT CONTENT: all four items summed to 5** (3+2, 2+3, 4+1, 1+4 — every ordered pair). Root is neither schema nor response class: **flash-lite's structured output is convergent on free numeric fields** — it picks the answer first and back-solves operands, and "N DIFFERENT problems" was satisfied by commuted twins. Fixed with numberPoolService doctrine + the pack's content-generic wrinkle (a shuffled full-band seed list as a CONDITIONAL prompt section — no regex classifier, topic stays authoritative, literacy topics told to ignore it) plus a new `findArithmeticMismatches` gate that **drops, never patches** (the generated correction states the claimed answer). Re-driven 8 runs: "within 10" ×3 → 4/4, 4/4, 3/3 distinct (was 1/4). **✅ SHIPPED 2026-08-12 21:58–22:01 — the hold was released and the prescription was followed to the letter: `ead9ae1` the engine cut-in (blast radius = all 8 consumers) and `71cba07` the pack (touches nothing that already ships), sliced exactly as this row specified, plus `9139cf1` ports 5–7 and two doc commits. Pushed to `origin/ship/2026-08-10-judged-loop`. The lane is now CLOSED on the machine side; what remains is #89.** *(historical: ➡️ MACHINE PULL = `/ship`, BUT NOT YET — a concurrent session was writing this file 5 minutes before this reconcile finished.)* ~1,822 new lines + 490 changed, ALL one lane; gates re-verified against the post-edit tree (typecheck:lumina **0**). When the lane is quiet, slice it TWO ways because the blast radii differ: **(1) the engine cut-in** (`useJudgedSpeechLoop.ts` +59, its diagnostics test +71, `types.ts` +1 — touches all 8 consumers) and **(2) the pack** (5 new files + catalog/registry/generator/metrics/`problem_type_registry.py` — touches nothing that already ships). | 2026-08-11 |

---

## Prior snapshot — reconciled 2026-08-10 (afternoon) (**port 4 `cvc-speller` shipped AND DRIVEN — the correction branch finally FIRED (dog 2 attempts, bug 3 then capped), so the judge is discriminating, not permissive. The gesture anchor is proven in production. The drive also found a shared-engine bug live for four ports: `verdictTimeoutMs` was dead whenever the mic was open.**)

| Lane | State | Pull now | Trusted as of |
|---|---|---|---|
| **🔝 DI MODALITY → LITERACY** | **TOP PRIORITY — user ruling 2026-08-09. ACTIVE slot 1. Ports 1-4 (`phonics-blender`, `sound-swap`, `word-flip`, `cvc-speller`) ✅ SHIPPED; ports 2 and 3 DRIVEN LIVE, port 4 machine-green + real-pipeline-probed, NOT driven. 4 of 31. ⚠️ **PULL THE MIC SITTING NEXT — AND ANSWER DELIBERATELY WRONG.** Four ports, two live runs, and the correction branch has still never fired (9/9 then 5/5 first try). Every affirmation seen so far is compatible with a permissive judge. HUMAN-CHECKS #82 → #83 → #84 (+ **#85** for port 4), ~90s each — **driving card: `qa/HANDOFF-di-mic-sitting-2026-08-10.md`**, handed to the user 2026-08-10. **✅ PORT 4 `cvc-speller` (2026-08-10, user-pulled) — the gesture anchor has a production caller at last, and the port's finding is that TWO OF ITS THREE MODES DIED BY THE ANSWER-LEAK GATE, NOT THE TIMER:** `fill_vowel`'s two vowel buttons and `word_sort`'s two buckets each printed one of two options that INCLUDED the answer, captioned with its keyword — word-flip's chips exactly. Both answers are now spoken (the middle SOUND; letter names stay a blocked class). `spell_word` stays a placement — three ordered slots out of a distractor bank is not guessable, and encoding is what makes this primitive not a duplicate of phonics-blender — so the Check button and the stopwatch went instead and the third letter landing IS the commit. Brief is **rev 4**. 📄 `qa/HANDOFF-di-literacy-modality-2026-08-09.md`; queue record = `qa/di/BACKLOG.md` item 16.** | **User, after driving a real phonics lesson:** *"many language arts primitives still use a modality where the student needs to click the screen to continue. The DI modality fixes that."* **THE FRAME (two rulings, both 2026-08-09 — do not re-litigate).** (1) *"if the existing primitive asks the student to click the mic, then answer, the existing primitive is wrong."* Every literacy primitive should run a tutor-owned loop; **a primitive is never exempted because its interaction is manipulative, and never left broken because a DI pack could absorb its demand** — routing around a defect preserves it. (2) *"the exercise should be purely verbal using the DI capability, not a combination of clicking on tiles and speaking."* Where the skill is verbal, the whole task is verbal. **The test: can a child who cannot do the skill still perform this action correctly?** Arranging `c a t` tiles is sequencing, not blending — a costume; delete it. **⚠️ An earlier draft of this row proposed bucketing all 31 ROUTE/CONVERT/LEAVE — the user rejected it outright** (*"this misses the forest for the trees"*); rev 1 of the handoff was deleted. **✅ PILOT SHIPPED.** `phonics-blender` now shows the letters, taps speak one SOUND, the child SAYS the word, and the Live tutor's own affirmation is the advance. Deleted: the PTT mic, `Ready to Build!`/`Check`/`Blend!`/`Next Word`/`Clear`, the phase stepper, the tile build, the `setTimeout` between phases. Gates: typecheck:lumina 0 · tsc **803 = baseline** · vitest **195 files / 2487**. **ENGINE (generic):** the loop could only anchor an attempt on a closed voice turn (DI-1) — *which is why the rejected framing mistook an engine limit for pedagogy*; `LoopAttempt.source` + `gesture-close` + `submitGestureAttempt` widen it. **⚠️ zero production callers today** (the verbal ruling removed the pilot's use); first customer is `word-sorter`/`sentence-builder`/`story-map` — if the next two ports are also verbal, propose deleting it. **⚠️ THE PILOT IS NOT LIVE-VERIFIED AND THAT BLOCKS THE SECOND PORT → HUMAN-CHECKS #82.** One live K run happened mid-port (it produced ruling 2 and proved connect/model/mic/transcribe), but nobody has driven the shipped verbal task: that the tutor WAITS, affirms a sound-out that lands on the word, refuses a near neighbour (`cap`/`cat`), and advances on its own utterance is unproven. **A template verified once beats three ports built on an assumption.** **CENSUS re-measured after the pilot:** tutor-driven **1** · stopwatch **7** · click **3** · no voice **20**; separately **5 primitives still make the child press a mic button first** (`cvc-speller`, `interactive-book`, `letter-sound-link`, `rhyme-studio`, `sound-swap`) — an input axis the first census never measured, already violating the standing open-mic ruling. **✅ TWO checkable gates per port:** no advance timer / PTT hook / next-check button in the ported path, **and** nothing names the answer before the child gives it (the pilot shipped a printed target word AND a picture of it; only the live run caught them). **No `/add-di-loop` skill yet, deliberately** — extract one after the 2nd or 3rd port; the procedure is handoff §3. `letter-spotter` stays BLOCKED (letter names = unbenched homophonic class); `decodable-reader`/`read-aloud-studio` blocked (no judge for passage-length fluency). **✅ PORT 2 SHIPPED 2026-08-09 — `sound-swap`, and the costume was deeper than the pilot's.** Both census defects were present (a 1400ms stopwatch AND a PTT mic), but under them the ANSWER was a costume: the child tapped a tile or picked one of 3-5 sound buttons and the SCREEN computed the new word. Now the child SAYS the new word; deleted `Start Activity`, the answer buttons, the tile-tap, `Next Challenge`/`Finish`/`Skip →`, `useSpokenWordCapture`, and the auto-advance timer. contextKeys **12 → 4**. Gates: typecheck:lumina **0** · tsc **803 = baseline** · vitest **197 files / 2524** · both §1 greps clean · 2 revert-bites bit. **⚠️ One tier lever was RE-BASED by ruling:** `nameTargetSound: false` used to hide the sound to change — survivable only because answer buttons made it determinate. With them gone, *"change one sound in cat"* is answered correctly by cap, cot, bat and a dozen more; **an ambiguous ask is not a harder task, it is a broken one.** The tutor now names the change at every tier and the field withdraws the SEGMENTATION of the starting word instead (this primitive's own documented struggle). Structural axis (position) untouched. **➡️ Its human gate is #83** — that the tutor refuses the starting word said back (fluent, confident, unchanged: the error most likely to be affirmed), and that VC-length answers ("at", "in") are heard at all, which is the port's one honest standing-gate-1 residual. **Skill extraction: after port 3, and narrower than expected** — §3's five steps held verbatim; all the variance was in the SCRIPT, because in phonics-blender the model IS the answer and here it must not be. A template that hard-coded the pilot's cue would ship the answer in the ask. **✅ DRIVEN LIVE the same evening (`a964bccc5ca2`, 9/9, 2m34s): the tutor-owned clock is PROVEN** — 9 item cues, `superseded: 0`, `wedged: false`, every advance an affirmation, no leaked answer — **and DI-1 got its best evidence yet**: the ASR read "sept", the tutor affirmed "Yes, sit." from the audio. *Word-matching is the reporting channel, not the judge*, demonstrated rather than argued. **⚠️ USER RULING FROM THE RUN — the sound-by-sound walk is DELETED.** The ask was "Listen: an. /æ/ … /n/. Add /p/…" and **a voice cannot say `/æ/`**: *"she does sound funny during that part… the 'an… Add /p/' works great and the student can clearly hear the instructions, but the gibberish comes across as a distraction."* The first fix attempted was the wrong one (make the walk sayable); deleting it was right. The ask is three beats at every tier, `nameTargetSound` joins `optionCount` as DEAD, and within-mode difficulty now rides entirely on the structural axis + the two on-screen levers. **The glyph class is broader than the walk**, so `phonemeVoice.ts` (new, 9 tests) renders phonemes for the VOICE where they cannot be dropped — the ask, and **tap-to-hear on BOTH ports**, which had the identical defect and had never been driven. Non-Latin glyphs take di-letter-sounds' own spellings (`/æ/`→"aaa"); Latin ones pass through untouched. **TWO RESIDUALS, both TEMPLATE-level, fix before port 3:** SWAP-1 — the opener spoke its own `[DI_SWAP_ITEM]` tag and then improvised the ask instead of the scripted line (the anti-echo warning is already there and did not hold; phonics-blender's opener has the same shape, so it is not a sound-swap defect); SWAP-2 — an off-task utterance drew off-script chatter, though progression was unharmed (the `no-verdict` path behaved exactly as designed, observed live). **#83 is HALF-DRIVEN and deliberately not struck: all 9 items were addition and all correct, so the correction branch never fired — the discriminating half is still unproven.** Gates after the fix: typecheck:lumina 0 · tsc **803 = baseline** · vitest **198 files / 2534**. **✅ PORT 3 SHIPPED 2026-08-09 — `word-flip`, and its finding is that the costume and the leak were THE SAME OBJECT.** The three tap chips (*"the answer, the bare singular, the over-regularized form"*) made the task READING — a child who cannot form a plural taps "dogs" correctly every time — **and** the chip printed the answer on screen; the catalog defended them by noting a pre-reader cannot read them, and **Grade 1 can**, i.e. a band gate was doing a leak gate's job. One deletion closed both. Now the tutor models the rule on a noun the session never asks about, names the one thing, says how many there are now, waits, and its affirmation is the advance. Deleted: the chips, the whole tap path, the `Start with Voice`/`Start tap-only` fork, the `voiceMode` toggle, `Next`/`Finish`, and the 1600ms auto-advance. contextKeys **5 → 3**. Gates: typecheck:lumina **0** · tsc **803 = baseline** · vitest **199 files / 2568** · both §1 greps clean · 3/3 template keys resolve · 2 revert-bites bit. **A THIRD cue shape, which settles the skill-extraction question:** phonics-blender models the answer, sound-swap models nothing, word-flip models the RULE on a different word — so `/add-di-loop` carries the component skeleton + catalog checklist + gates + a *checklist of questions*, never a cue template. **The hand-over also had to change and it is pedagogy, not style:** *"Your turn. What word?"* is ambiguous after *"Now there are three"* (a child can answer "dog", name the picture, and be technically right), so the ask ends *"Three what?"* — `nameTargetSound`'s ruling arriving a second time. **✅ RESIDUAL SWAP-1 FIXED IN ALL THREE PORTS, and the diagnosis is the reusable part:** the anti-echo warning did not hold because the warning was never the problem — the CATALOG was asking the opening turn to do two jobs (compose a how-to-play, then recite a scripted line), and the model did the first and improvised the second. How-to-play is now TEXT INSIDE the quoted line in all three scripts; the directive is retitled *"THE OPENING LINE ALREADY SAYS HOW TO PLAY"* and only forbids adding to it. **Not yet heard live — it ships into #82/#83/#84, and #84 (f) is written for it.** SWAP-2 left open deliberately (compliance nudge, no structural cause; worth one wording pass after the sitting says whether a one-job opener already fixed it). **➡️ Its human gate is #84** — the singular said back must be REFUSED; "dogses" corrected; and (c) watches transcript-vs-verdict on a one-phoneme difference, which is the strongest DI-1 evidence this lane can produce. **⚠️ The gesture anchor's deletion clock has now EXPIRED at 2 of 2 verbal ports, and the ruling is KEEP** — every customer is queued and unported, so the count measured port ORDER, not demand, and port 4 (`cvc-speller`'s `spell_word`) is the customer. **✅ PORT 3 DRIVEN LIVE 2026-08-10 (`5269fc87d6da`, 5/5, 1m24s) — clean clock, no leak, and DI-1 twice more (`'trunks'`→"Yes, trucks.", `'Herz'`→"Yes, hats."). `pickModelNoun` earned itself live: the items were truck/star/cloud/bird/**hat** and the opener correctly modelled on "One cup, two cups".** **⚠️ AND IT FOUND DI-GREET-1 — the true root of SWAP-1, one layer below where the lane had been looking.** `lumina_tutor.py` queues *"Greet the student warmly…"* with `end_of_turn=True` on **every fresh connect**, so Gemini takes a turn the instant the socket opens — while the client is still waiting on the mic and has sent no cue. Measured: greeting **0.8s→15.7s**, scripted opener **16.4s**. The improvised turn ended with **the tutor's own question**; the child answered THAT, it barged in 1.2s into the scripted line, and **item 1 ran with no question at all.** Re-reading sound-swap's run shows the identical mechanism one primitive earlier. **So the 08-09 SWAP-1 fix was half right: deleting the catalog's "compose a how-to-play" directive removed one JOB from that turn, but could not remove the TURN, because the backend is what asks for it — *a prompt-level fix cannot close a transport-level defect*.** FIXED 2026-08-10 via `owns_opening` on the connect payload → `should_queue_greeting()`, extracted as a module-level predicate precisely because the inline `if` was untestable (part of why it survived two live runs), set by **all eight packs that script their opener** (3 literacy ports + 5 DI packs). **Scope fence: `curator-brief` and every ordinary surface still greet** — they read well live — and one of the 4 new backend units exists only to pin that. Gates: backend **26F/126P** (documented baseline 26F/122P + 4 new) · typecheck:lumina **0** · tsc **803 = baseline** · vitest **199 files / 2568** · 1 revert-bite, bit. **⚠️ NOT re-driven — #84 (f) is the check.** | 2026-08-10 |
| **🆕 JUDGED-SCRIPT RUNNER — the DI loop as a cross-subject CAPABILITY** | **ACTIVE — USER-DIRECTED 2026-08-10 (*"lets not retrofit but instead build the general schema and capability, try it on 2-3 subjects"*). Contract + runner SHIPPED, two cross-subject pilots SHIPPED same day; all machine gates green; NOTHING driven live (#86, #87). UNCOMMITTED.** | `lumina/hooks/judgedScriptContract.ts` + `useJudgedScriptRunner.ts`, DERIVED from the diff of the 8 hand-rolled consumers (5 DI packs + 4 literacy ports), which were deliberately NOT migrated — retrofit cost is denominated in mic sittings, not lines; existing consumers move only when a real reason touches them. **The standing gates became code:** a benched response-class registry (gate 1 — blocked classes refused with the ruling pointer; G1 counts 21-30 declare the build-ahead #63 class honestly) and a mechanical sentinel-collision validator (gate 2) that every pack's test asserts empty — **it caught its own first bug** (a number word inside the pre-numeric contract's correction line). Wording stays 100% pack-authored; the runner carries NO cue template (the lane's own three-ports-three-shapes finding). **Pilot A = `counting-board` (math):** the Check button measured exhaustive TAPPING, not counting — the spoken cardinal is now the graded act; tap-counting survives as the manipulative; `subitize_perceptual` is the gesture anchor's second production caller, fully number-free; the tally's "/ total" answer-print died. **Pilot B = `push-pull-arena` (science):** MCQ chips + labeled Push/Pull buttons + the instruction all NAMED the answer; every answer is now code-computed from the sim's own physics and spoken; predict/compare auto-run the sim at answer-commit so the truth plays while the tutor judges; also its overdue Lumina-kit migration. **Port economics changed: a conversion now costs a hand-authored script + a stage, not a loop wiring.** Gates: typecheck:lumina 0 · 71/71 across 6 slice test files · §1 greps clean · full suite green (the 3 failures were the old stepper surface's reader-fit test, rewritten with item-13 protections intact). **Owed: #86 + #87 mic sittings (the runner has never carried a real session), the literacy pilot (`picture-vocabulary` — skipped because a concurrent session was mid-edit in `literacy/`), and the queue's `/add-di-loop` skill as a thin wrapper after the sittings.** Queue record: `qa/di/BACKLOG.md` item 16 (dated block). | 2026-08-10 |
| **⚠️ ORPHANED IN THE TREE — `scaffoldAudit.ts` + `interpolateTemplate.ts`** | **NOBODY'S. Needs a one-line ruling, not a slice.** | Descoped from the 08-08 `/ship` as *"a concurrent session's, not ours to ship"* — correct at the time. **That session never came back.** ~24h later both files are still uncommitted and the lane they belonged to (tutor-test harness, `analyzeHookSite` learning the `ctx.connect({ primitive_data })` shape; `(not set)` → `''`) has no open slice. 82 lines across two files, riding along in every `git status` and silently joining whatever gets committed next. **The failure mode is specific: "it belongs to someone else" is a valid descope exactly once, and then it becomes nobody's.** Either commit it (it is the fix for cross-queue residual (iii), filed as a family-wide `/tutor-test` blind spot) or revert it. `/pm` will not decide which — it is unmeasured and unreported, and reverting throws away real work. | 2026-08-09 |
| **⚠️ `npm test` EXITS 1 WITH ZERO FAILING TESTS** | **FILED 2026-08-09, no lane — a one-line finding that will read as a broken gate to the next session** | Found while gating the word-flip port. The full suite reports **199 files passed / 2568 tests passed** and then **exits 1** on an *unhandled* error: `TypeError: Cannot read properties of null (reading 'clearRect')` in `canvas-confetti`'s rAF loop, originating in `src/components/lumina/primitives/visual-primitives/astronomy/__tests__/SolarSystemExplorer.eval-loop.test.tsx`. **It does NOT reproduce when that file is run alone** — the confetti animation frame fires after the jsdom environment it belongs to has been torn down, which only happens under parallel scheduling. Unrelated to the DI lane (no shared module). **Why it is filed rather than ignored: "all green but exit 1" is exactly the shape that trains people to stop reading the exit code**, and it would block a CI gate the moment one exists. Executor: cancel the confetti animation on unmount in the owning component (or stub `canvas-confetti` in that test's setup) — small, but it belongs to whoever next touches `solar-system-explorer`, which is HUMAN-CHECKS #77's primitive. | 2026-08-09 |
| **⚠️ IMG-1 — THE TUTOR IS BLIND TO EVERY IMAGE ON SCREEN** | **FILED + PARKED 2026-08-10, no lane — user call: *"I don't think we push this forward."* Record: `qa/tutor-reports/lesson-live-2026-08-10-excavators.md`** | Found in a **real lesson driven by the user with his son** (16m50s, 8 primitives, `cdab143abd9c`). Asked what colour the dump truck was, the tutor said **"That one is yellow!"** — it was red — then laundered the miss into the student's claim without acknowledging it. Asked what was in the background, it invented **"big green trees."** **0 of ~160 tutoring scaffolds across all 14 catalogs pass ANY image field** — not the URL, not even the prompt (`machine-profile` sends `machineName/category/era/sectionsOpened`, `catalog/engineering.ts:144`), **and there is no image input path at all**: client sends `text`/`audio` only, backend only calls `send_realtime_input(text=…)`/`(audio=…)`. The Live API accepts image frames; we have never wired one. **Even passing `imagePrompt` would not fix it — the image is AI-generated on demand from that prompt (`MachineProfile.tsx:120`), so the image model picks the colour and only the pixels are authoritative.** **Two independent halves, and the cheap one is the pedagogy one: (1)** the tutor must say *"I can't see the picture — you tell me!"* instead of confabulating a visual detail. **A warm, well-formed, WRONG answer to a child who can see the screen reads as quality until you know she is blind** — that is why three of these went unremarked in the same session, and one of them was cited in this run's own first pass as *evidence the QUESTIONS block was working*. **(2)** caption the ACTUAL returned pixels at generation time → `imageDescription` → `contextKeys`; text-only, rides the scaffold channel, survives a resume (a transient image frame does not — this session took 6). Executor: `/primitive-contract` on `machine-profile` first (it changes what the scaffold promises), then the caption pass. **Same report carries three smaller findings, all parked: TRN-1** (fabricated `[CURRENT STATE]`/`[CHALLENGE_COMPLETED]` preambles reach Pip's speech bubble in 14 of 22 turns — **not spoken**, proven by chars/sec: tails land at 17–21 cps like clean turns, full text implies 30–130); **ASR-1** (the input transcript is a separate parallel pass **the model never sees** — it read "Church" for *tracks* and one obscenity, while the tutor answered the real audio correctly; `AudioTranscriptionConfig` is literally `pass`, so **there is no language lever — on `google-genai==1.16.1`, which is well behind the model we call; bump-and-re-inspect before calling it unfixable** — and **any eval scoring tutor behaviour against `user-transcript` is scoring a channel the model never saw**); **FLOOR-1** (flat `silenceCloseMs: 900` put 35 of 57 tutor onsets within 1.5s of a human stopping, and at 165.3–183.0s **the tutor answered the parent's question to his son**; `proactive_audio` would be the server-side gate but is **unsupported on `gemini-3.1-flash-live-preview`** — do NOT swap models for it, this run is the evidence the current stack survives 6 drops — and we already own the gate anyway, since `manual_activity` disables Gemini's VAD). **What this run PROVED, do not re-verify: 6 drops (3× `1011`, 3× `1007`) all resumed in 282–391ms with zero cue loss; floor gate `wedged 0 / superseded 0` across 27 batches incl. an 8,650-char attachment; no `1008` in 17 min; tutor silent through 53% of student turns on a hot mic.** | 2026-08-10 |
| **SHIP THE TREE** | **✅ DONE 2026-08-08 — six commits on `ship/2026-08-08-five-slices`** | `1cf72ae` CTX-2 floor gate · `b37e931` DNA-1 + biology scan · `2220ac1` solar-system-explorer L1 · `997c875` Pip · `f749af6` deep-dive prose overlap · this reconcile. Gates: `typecheck:lumina` **0**, vitest **194 files / 2475 passing**, backend **26F/122P = documented baseline**. **DESCOPED deliberately: `scaffoldAudit.ts` + `interpolateTemplate.ts`** — they appeared mid-`/ship` from a **concurrent session** working the tutor-test harness item (`analyzeHookSite` learning the `ctx.connect({ primitive_data })` shape; `(not set)` → `''`). Not ours to ship; still uncommitted and still that session's. *(Historical note, kept because it is the pattern: **five slices, ~2,450 insertions, spanning five streams, had piled up with nothing shipped since `01cebd7` at 00:24.**)* They share almost no files, so this is a clean `/ship` slicing job, not a merge problem: **(1)** CTX-2 floor gate — backend only (`lumina_tutor.py` +452, `session_ledger.py`, its unit tests, `LuminaAIContext.tsx`); **(2)** DNA-1 fix + the biology domain scan (`gemini-dna-explorer.ts`, the oracle + its tests, the new answer-leak test, EVAL_TRACKER, the report); **(3)** `solar-system-explorer` L1 eval modes (component, generator, catalog, `evaluation/types.ts`, `problem_type_registry.py`, 2 new test files, the reader-fit BACKLOG strike); **(4)** **Pip** — the Curator's character (see below); **(5)** the deep-dive prose-overlap fix (`editorial-layout.ts` + `ProseBlock.tsx`). Plus CLAUDE.md's "Build over ceremony" section and this file. **`typecheck:lumina` is GREEN at 0 on the whole stack** (verified this run), so nothing is blocked on the gate — only on someone slicing it. | 2026-08-08 |
| **Lesson ordering & primitive selection** | **✅ CLOSED 2026-08-09 — defect fixed + measured at the OBJECTIVE layer; both downstream successors measured + REFUSED; A/B machinery deleted; residual re-homed to reader-fit item 18. ⚠️ THE PRODUCTION FIX IS STILL UNCOMMITTED.** | **Read `qa/topic-traces/order-audit-2026-08-08.md` first; it supersedes most of the handoff.** A K "counting to 10" lesson opened on a grid of written numerals. **The cause was the objective ORDER, not within-block ordering and not eval modes:** the curator brief ranked objectives by Bloom alone, and `identify`(1) outranks `apply`(3), so "recognize the numerals 1-10" was pinned ahead of "count a group of objects" in every counting lesson. **Bloom ranks the cognitive operation; it says nothing about whether the child is holding a thing or the symbol for it.** The two axes agree in engineering (naming visible machine parts is Bloom-1 AND concrete) — which is exactly why those lessons already sequenced well — and conflict in K number and early reading. **⚠️ And the 83%→100% Bloom-monotonicity "fix" shipped earlier the same day made it worse:** 100% monotone was a proxy pointing away from the goal, and hardening it removed the model’s room to deviate. A metric can point away from the thing it proxies. **FIX (shipped, in `gemini-curator-brief.ts`): three ranked rules — prerequisite → concrete-before-the-symbol-for-it → Bloom as tiebreak**, plus a K-2 calibration line that no longer says "focus on identify/explain" (the abstract-leaning verbs). The priority between the first two was itself measured: concrete-above-prerequisite put `[apply → identify]` on a CVC lesson and the judge caught it (blending requires letter-sounds), so they were swapped. **MEASURED** (12 topics × 3 lessons, absolute teacher-judgment of real lessons): mean sequence score **3.25 → 3.89 / 5**; wrong opening activity **39% → 22%**; symbol-before-concrete **42% → 17%**; math **2.67 → 3.93** (symbol-first 67% → 7%); **engineering control 4.33 → 4.67 with 0% wrong openers** — the rule correctly stays silent where there is no symbol/thing split. Origin lesson **1/5,1/5,1/5 → 5/5,5/5,4/5**, and `hundreds-chart → counting-board` (6× in the baseline swap table) is gone. **➡️ RESIDUAL, and it is NOT ordering: phonics 3.22/5 with a 56% wrong-opener rate is a PRIMITIVE-SELECTION question** (`vocabulary-explorer` opening a sight-word lesson on definitions and etymology for pre-readers — present in the baseline too). Executor `/reader-fit` or `/topic-fidelity`, in that lane. Part of the 56% is judge ambiguity: it names `phoneme-explorer → di-letter-sounds` and `di-letter-sounds → phoneme-explorer` in different runs. Also unexamined: `dependency violations` sits at 58% and barely moved — look before treating it as a target. **⚠️ TWO DOWNSTREAM ARMS WERE MEASURED AND REJECTED after that fix, and both confirm the ceiling is upstream:** (1) **manifest modality-first** (`manifest-modality-ab-2026-08-08.md`) did exactly what it was written to do — exposition-opens-block 50% → 17% — while quality FELL 4.03 → 3.75/5; within a block an explainer is usually the PREREQUISITE, not a symbol standing in for a thing, so absolute modality-first reproduces one layer down the error the objective layer ranks around. (2) **the resolver reordering blocks** (`armC-block-ordering-2026-08-08.md`) made directly contradictory calls on the same topic and verb across two passes, each with a rationale that read well — a plausible per-action rationale is not a policy. **✅ CLEANED UP 2026-08-09 (user call): all A/B machinery and all four harnesses are DELETED** — `ManifestExperiment`/`evalModeArm`/`manifestArm`/`compareArms`, the arm-B and arm-C code paths, `scripts/{order-audit,order-ab,bloom-order,block-ramp}-harness.mjs`, six result JSONs, four `audit:*` npm scripts, and the `arms`/`experiment` fields on the topic-trace response. **`npm run audit:order` no longer exists** — the reports in `qa/topic-traces/` keep every number and the method, so it is reconstructible, but no standing lesson-quality gauge remains. The rejection rationale for both arms was moved INTO the source it guards (`resolveLessonEvalModes.ts` header, `gemini-manifest.ts` `blockOrderRule`) so the next session cannot re-propose either without reading why it failed. Gates: `typecheck:lumina` **0**, full `tsc` **803** (baseline 806), vitest **195 files / 2483 passing**. | 2026-08-09 |
| **Pip — the Curator's embodied character** | **🆕 SHIPPED `997c875`, still UNFILED — no queue, no report, and it is the one lane on the board with NO machine gate that can judge it** | **The largest single thing found this run.** `PipCharacter.tsx` (21KB, new) extracts the Curator's face into a standalone creature: mic-RMS-driven halo off the lesson's open mic, pointer-tracked pupils on a spring, poke-to-squash with an earcon, per-side brow poses across six moods, ground shadow phase-locked to the float — every loop gated on `useReducedMotion()`. `PipLab.tsx` (new) is its audition surface, explicitly modelled on Sound Lab and for the same reason: *"Pip only appears inside a live lesson behind auth + an open Gemini session, which makes 'does the new listening pose read right?' an expensive question."* Plus `usePerchAnchor.ts` (+ test), `CuratorCompanion.tsx` rewritten (645 lines changed), and wiring into `IdleScreen` + `DevPanelRouter`. **This is a product surface a five-year-old looks at, and it is 100% pixels — there is no machine gate that can pass it.** It needs (a) an owning queue, (b) a human row, (c) a decision on whether it is a stream or a one-off. **`/pm` did not file it as a lane: that is the user's call, not a reconcile's.** | 2026-08-08 |
| **Direct Instruction family** | **➡️ PROMOTE TO ACTIVE 2026-08-09 — the ordering lane closed and freed its slot; DI is closeout-only and finishable** | *Only CLOSEOUT remains, not new reach: CTX-2 shipped and is live-signed-off, so what is left is its report, its post-fix ledger number, and the `wedged` watchdog check. Worth finishing while the session is fresh, but it does not need an ACTIVE slot.* **⚠️ The 08-07 snapshot's "next = di-shapes L4" is STALE — L4 CLOSED in `bd21cef`, same commit as L3.** `qa/di/BACKLOG.md` records it correctly at item 14 §(5); the index lagged. L4's lever was **exemplar typicality** (non-prototypical drawings, 62–100% scale, full-safe-ceiling rotation) — shipped with L3 precisely because L3 alone left the pictures byte-identical, which is CLAUDE.md's "a single ladder rung can be structurally low-yield" in the wild. **Next = CTX-2 (item 15, FILED this run): finish the floor gate that is already built in the tree.** It is unreported and its before/after number is unmeasured — the pre-fix figure (33 sends in 9 min, 3 turns killed by our own text 40–55ms after landing) is measured, so the post-fix one is a gate, not an opinion. | 2026-08-08 |
| **Science depth — DNA-1 ✅ / CB-1 ✅ / CELL-1 / LCS-1 / CS-1 / PA-1 / BIO-1 / BIO-2** | **ACTIVE (the only one) — top = CELL-1, and it needs `/primitive-contract` BEFORE `/eval-fix`** | **DNA-1 is FIXED** (19/20 leaking generations → 0/20; the old 6/10 row *under-counted* it — the dominant form was PARTIAL overlap, and the shipped oracle had the same blind spot, certifying 7 leaking generations as `pass`). **✅ CB-1 is ALSO FIXED — `528120f`, and this row was stale until 2026-08-09.** The palette no longer prints `Zone: <answer>` on unplaced organelles; the zone now appears on the *placed* organelle behind `placeChecked && !zoneCorrect`, i.e. as the corrective reveal. One correction to the row as originally filed: the drop zones never carried zone names, so the palette label was the *only* zone vocabulary on screen. **Human gate: #80** (is a corrective reveal the student can act on and re-check still teaching? — that question generalizes to every retryable primitive, incl. CS-1). **➡️ TOP = CELL-1, and it is a fork-vs-edit call, not a bug fix.** `ZONE_BOUNDS` overlap so heavily that grading barely discriminates: one drop point at (45,25) satisfies **5 of the 6 zones**; `peripheral` and `scattered` are byte-identical (64.3% of the cell); `center` ⊆ `large-central` ⊆ `peripheral` ≡ `scattered`. A student who drags everything upper-middle scores 100% on every organelle whose zone isn't `membrane-associated` — **and phase 2 feeds `zonePlacementAccuracy` into IRT evidence, so the selector is being fed a near-free score.** **This is why CB-1 went unnoticed for so long: the answer was printed, but the answer also hardly mattered.** Re-tuning the bounds changes grading semantics for every skill routing here and re-scores existing evidence, and **there is no `docs/contracts/cell-builder.md`** — so the executor is **`/primitive-contract` first, then `/eval-fix`**, never `/eval-fix` alone. LCS-1 / CS-1 / PA-1 are structural, filed with predicates, and need `/oracle-test` before their severity is asserted. | 2026-08-09 |
| **🆕 Pilot onboarding (invite-only)** | **ACTIVE — USER-OPENED 2026-08-10, above the WIP fence by direct commission; next `/pm` reconciles slots.** Slice 1 SHIPPED + runtime-verified (6/6 probe), UNCOMMITTED. | Signup is now invite-gated: Firestore `invite_codes` + validation at `POST /api/auth/register` (the single account-minting chokepoint — client never calls `createUserWithEmailAndPassword`, so no Identity Platform needed). Mint via `backend/scripts/mint_invite.py --grade K --name "Ava"` → send `/login?mode=signup&invite=CODE`; the form greets the child, locks the pre-provisioned grade, and the invite doc doubles as the pilot roster (redemption stamps uid + student_id). `INVITE_REQUIRED_FOR_SIGNUP` config, default ON. **Same slice closed a real bootstrap bug: register never wrote `students/{id}.grade_level`, so every brand-new K signup planned against the Grade 1 graph (first-doc-wins lexicographic scan) — probe proves invite grade `1st` beats form default `K` on the student doc.** Gates: probe 6/6 live · tsc **803 = baseline** · zero errors in touched files · backend py_compile clean. **Owed: one browser sitting on the deep-link signup flow (form → account → first lesson at the right grade).** Queue = `my-tutoring-app/qa/pilot-onboarding/BACKLOG.md`: (1) lesson session record — register the deferred `/api/evaluations/session-summary` stub + stamp `session_id` on submissions (a lesson currently leaves NO server-side session doc); (2) in-lesson feedback (greenfield — kid emoji scale + parent note at `LessonSummary`, carrying `EvaluationContext.sessionId`); (3) observer digest script joining attempts+reviews+sessions+feedback into a report Claude can narrate; (4) WATCH: `parent/link-student` has no verification — any signed-in user can read any student. Fine while every account is trusted; close before invite #2. | 2026-08-10 |
| **Reader-fit sweep** | **PARKED 2026-08-08 — item 17 is filed but GATED ON A HUMAN CHECK** | *Parked the same day it was demoted, and honestly: its top item (#17) is `/add-eval-modes` work whose template is unproven until HUMAN-CHECKS **#77** is driven. Pulling it before #77 risks copying a hit-layer bug three times. Nothing machine-gated sits above that. Resume the moment #77 is struck.* | Items 15 (15/15) and 16 (2/2) are both CLOSED and the astronomy prose-grade class is closed 10/10. **The queue had NO TOP again** — the successor was living as prose inside a closed item, the same hygiene defect `/pm` fixed on 08-07. **Item 17 is now filed: the owed portfolio decision, down from 4 primitives to 3** (`scale-comparator`, `organism-card`, `species-profile` — no evaluation hook at all, while the manifest can still route assessment at them). **⚠️ Its executor is `/add-eval-modes`, not `/reader-fit`** — this lane found them; only the lifecycle ladder can close them. `solar-system-explorer` was resolved in the ADD direction 08-08 and left a reusable template (build the answer surface; derive items AND key in code from what the component renders, so the key cannot contradict the screen). **Drive HUMAN-CHECKS #77 before copying that template three more times.** | 2026-08-08 |
| Support tiers (non-math) | PARKED (was OPPORTUNISTIC) | Untouched since 08-04 and now behind three lanes with live findings. Batch-3 evidence closure via `/eval-test`, serial. | 2026-08-04 |
| LA K-2 Grammar density | PARKED — BLOCKED on a user design ruling | Queue top (item 1b `in_front_of`/`behind`) is a design ruling, not code. Buildable alternates if resumed: item 2b (tracker SS-5) or item 4. | 2026-08-05 |
| Delegated lane | NONE | — | 2026-08-08 |

> ### `/pm` 2026-08-09 — what this run corrected
>
> **Drift #1 — the index lagged its own lane by two reports, and MEMORY was ahead of it.**
> The 08-08 snapshot for lesson ordering was written at ~23:00 and describes the objective
> fix correctly — but `manifest-modality-ab-2026-08-08.md` (23:18) and
> `armC-block-ordering-2026-08-08.md` (00:02) landed after it, and **both are rejections
> of downstream arms.** A cold session reading this file would have thought the manifest
> and resolver layers were still open questions and re-proposed exactly the two things
> that had just been measured and refused. **Note the inversion:** the memory hook already
> recorded arm C as rejected while the index did not. Memory is normally the thing that
> lags; queues won anyway, but this is the first run where the index was the stale party.
>
> **Drift #2 — the A/B machinery is now DELETED (user call, this run), and that changes
> what the index must say.** All four harnesses, six result JSONs, four `audit:*` scripts,
> and every arm in `resolveLessonEvalModes.ts` / `gemini-manifest.ts` / the topic-trace
> route are gone. The index claimed `npm run audit:order` as a **durable asset**; that
> sentence was true when written and is now false — corrected in the lane row. The
> rejection rationale for both arms was **moved into the source it guards** rather than
> deleted with the code, because the reason a rejected idea stays rejected has to live
> where the next person will edit. Gates after removal: `typecheck:lumina` **0**, full
> `tsc` **803** (baseline 806 — three fewer), vitest **195 files / 2483 passing**.
>
> **Drift #3 — the closing lane's residual named an executor and never reached a queue.
> Filed as reader-fit item 18.** `order-audit-2026-08-08.md` measured phonics at 3.22/5
> with a 56% wrong-opener rate, correctly identified it as **primitive selection, not
> ordering**, named `/reader-fit` or `/topic-fidelity`, and closed. It went into no
> backlog. **This is the third consecutive run where the failure mode is work that never
> reached a queue** — and the sharpest instance yet, because the lane that found it is now
> closed and cannot carry it. Item 18 also absorbs the two topics that score 2/5 under
> both manifest arms every run (`reading sentences with sight words`, `place value to
> 100`) and carries the explicit *do not reopen ordering for these* fence.
>
> **Drift #4 — two files have been orphaned in the tree for a day** (top row). Descoping
> them as another session's was right on 08-08; nobody re-owned them.
>
> **HUMAN-CHECKS: #81 opened** (the K `hundreds-chart` board — the origin screen of the
> whole lane, now generator-fixed and never looked at). Next free ID = **82**. Nothing was
> struck: **no browser or mic sitting has happened in over a day**, and #77 still gates
> reader-fit item 17.
>
> **WIP after this run = 2 ACTIVE + 1, and the user set the first one mid-reconcile.**
> **ACTIVE 1 = DI MODALITY → BASIC LITERACY** (top row; user ruling, outranks everything
> including DI closeout). **ACTIVE 2 = Science depth** (top: **CELL-1**, and it needs
> `/primitive-contract` before `/eval-fix`). **+1 = DI closeout** — CTX-2's report, its
> post-fix ledger number, the `wedged` watchdog; it rides along with ACTIVE 1 since both
> are the DI register, but it must not displace the literacy port.
> **Lesson ordering & primitive selection is CLOSED** — defect fixed and measured, both
> downstream successors measured and refused, instrument deleted, residual re-homed to
> reader-fit item 18. Reader-fit stays PARKED behind #77. Support-tiers and LA K-2 grammar
> stay PARKED. Pip remains deliberately unstated.
>
> **The literacy-modality lane rhymes with a finding this file already carries, and the
> executor should read it that way:** `/add-spoken-judge` wired push-to-talk one-shot
> capture onto six literacy primitives and every one still makes the child tap to
> continue — **so the skill was RETIRED 2026-08-09** (deleted, not tombstoned; doctrine
> relocated verbatim to `docs/SPOKEN_INTERACTION_DOCTRINE.md`). *`/add-voice-control`
> survives — it auto-advances and is NOT the culprit; an earlier line here said
> otherwise and was wrong.* **A ladder rung can be structurally low-yield** — CLAUDE.md's
> own warning, first written about `/add-support-tiers` leaving the problems
> byte-identical. This is the second instance of the same shape, and it is why the pilot's success
> criterion has to be the LOOP, not the presence of a microphone.
>
> ---
>
> *(Prior run's notes, 2026-08-08 midday, kept for the record:)*
>
> **Drift #1 — the tree, and it is the biggest one this run.** The previous snapshot's
> headline warned about *two* uncommitted slices. There are now **five**, from a session
> that ran 09:43–10:01 this morning and shipped none of them. They span backend
> transport, a biology answer-leak fix, an astronomy eval-mode rung, a new character
> component, and a prose-layout bug fix. **The gate is green** (`typecheck:lumina` 0,
> verified this run), so the only thing standing between this work and the student is
> five commits. Ship hygiene is now the top item on the board.
>
> **Drift #2 — a whole stream with no paperwork.** Pip is ~1,000 lines of new,
> carefully-reasoned character code plus a lab surface to audition it, and it appears in
> **no queue, no report, no human-check row, and nowhere in this file.** Every other lane
> on the board can be resumed by a cold session from its queue; this one exists only as
> files. It is also the one piece of work on the board with **no machine gate at all** —
> it is pixels and motion for a five-year-old, so jsdom and tsc can say nothing about
> whether it lands. `/pm` filed nothing for it deliberately: whether it is a stream or a
> one-off is a product call.
>
> **Drift #3 — three slices closed after the last HUMAN-CHECKS write, and two of them
> carry debt they name themselves. #77 / #78 / #79 opened, #72 EXTENDED (e).** #77 is the
> one to drive first: `solar-system-explorer`'s new eval modes make the answer *a tap on a
> body in a moving orbital model*, and jsdom cannot see whether a moving `<g>` is hittable
> — a class this repo has already been bitten by. If the taps don't land, five eval modes
> and 24 green tests are worth nothing, and three more primitives are queued to copy that
> template. **#72 (e)** covers L4's drawings, which nobody has seen; without it the row
> could have been struck on its voice half while a 62%-scale irregular hexagon at 30° went
> unlooked-at. Next free ID = **80**.
>
> **Drift #4 — CTX-2 was built and left unfiled. Now `qa/di/BACKLOG.md` item 15.** A
> `FloorGate` with batching, narrow supersession, send-time rendering and a
> client-declared `interrupt` flag is sitting in `lumina_tutor.py` with its entire
> evidence base in source docstrings and no report. It is the layer *after* CTX-1 — CTX-1
> removed one sender, CTX-2 arbitrates the ones that remain — and reading it as part of
> item 13 would lose the distinction and let #76 be struck for the wrong thing.
>
> **What did NOT drift, and it is worth saying:** every queue that was written to was
> truthful. `qa/di/BACKLOG.md` had already recorded L4 closed; `EVAL_TRACKER.md` had
> already struck DNA-1 and filed its four successors with real predicates;
> `qa/reader-fit/BACKLOG.md` had already struck S11. **The failure mode this run is not
> stale queues — it is work that never reached a queue at all** (Pip, CTX-2, the prose
> fix) and work that never reached a commit (all five slices). That is a different
> discipline problem from the last three runs, and it points at the same moment: **close
> time**.
>
> **WIP — RESHUFFLED 2026-08-08 (late) when the user scoped primitive selection.**
> Two ACTIVE = **Science depth** (top: CELL-1) + **ONE FREE SLOT**. Lesson ordering &
> primitive selection **solved its reported defect this run and measured the fix** — the
> bug was objective ordering, one layer above everything the queue had scoped; its only
> residual (phonics openers) belongs to reader-fit, so the slot is open; **DI is the
> obvious promotion into it.** DI had already dropped to the opportunistic +1 — an
> honest demotion, not
> a park: CTX-2 shipped and is signed off, so only closeout remains. **Reader-fit is
> PARKED**, because item 17's template is unproven until HUMAN-CHECKS #77 is driven and
> pulling it first risks copying a hit-layer bug three times; resume the moment #77 is
> struck. Support-tiers stays PARKED. Pip is deliberately **unstated** rather than
> parked, because nobody has said what it is yet.
>
> *(Earlier this run, pre-reshuffle: two ACTIVE were DI + Science depth, with reader-fit
> as the +1 and support-tiers newly parked after four idle days.)*

## Prior snapshot — reconciled 2026-08-07 (night) (**the queues were truthful again; the INDEXES lagged again — and one human gate had no row at all**)

| Lane | State | Pull now | Trusted as of |
|---|---|---|---|
| **Reader-fit sweep** | **ITEM 16 CLOSED 2/2 — needs a NEXT PULL** | **✅ `constellation-builder` (`ea5f60b`) + `planetary-explorer` both READY at PRE.** Reports in `qa/reader-fit/`. **The prose-grade class is now closed across astronomy, 10/10** — these were the last two, and the defect bit **K and Grade 1 identically in both** (the regex only matched prose literally spelling "grade N", so the whole spelled-out band fell to `'3'`). **No item 17 is filed** — `qa/reader-fit/BACKLOG.md` needs a new top before this lane can be pulled again; candidates already named in it: `telescope-simulator`'s Grade-2 band floor is a REVISIT under [[feedback_make-age-friendly-not-band-floor]], and the ~~four~~ **THREE remaining primitives with no evaluation hook at all** (~~solar-system-explorer~~, scale-comparator, organism-card, species-profile) still need the `/add-eval-modes`-or-declare-exploration-only decision. **✅ `solar-system-explorer` CLOSED 2026-08-08 (user-pulled `/add-eval-modes`) — the portfolio decision is answered in the ADD direction for the first of the four, and it came with a reusable shape: where there is no challenge enum to constrain, the rung BUILDS the surface — tap-a-body answers in the live model, with the items AND the key derived in code from the rendered `bodies` array (Fork A/SP-21), so the key cannot contradict the screen and a prompt cannot leak its own answer. 5 modes β 1.5→8.0, backend priors matched, 24 tests, Lumina gate now GREEN at 0 (it was red on HEAD with 3 errors from the `01cebd7` slice — fixed here). Residual: needs a browser drive; jsdom cannot see whether the moving `<g>` targets are hittable.** **Carry forward:** probe the tutor channel with `tutor-test?probe=1` BEFORE scoping (a full catalog block can arrive empty; 14 live moment tags can still never voice the question); a band failure can be a CONTENT gap only the generator closes; and a handoff's answer-leak "clean" bill is a claim to re-derive, not a finding (S2's first-attempt hint was leaking). | 2026-08-08 |
| **Direct Instruction family** | **ACTIVE** | **CTX-1 CLOSED and di-shapes is now L3** (rung 3 shipped 2026-08-07 — family script-composed fade, 8/8 revert-bites, real-pipeline 6/6; report `qa/eval-reports/di-shapes-support-tiers-2026-08-07.md`). Next machine pull = **di-shapes L4 `/add-structural-difficulty`** (rotation magnitude + size variation + non-prototypical exemplars — L3 deliberately left shape SELECTION alone, so the axis is clean). **⚠️ TWO slices UNCOMMITTED — CTX-1 first, then rung 3.** Rung 3 also **re-diagnosed cross-queue residual (iii)**: `supportTier: unresolved` is a family-wide `/tutor-test` blind spot (`analyzeHookSite` can't parse `ctx.connect({ primitive_data })` — all 5 DI packs report `data-bag-unparsed`), not a di-math-facts defect → filed to the tutor-test harness queue. Human side stays opportunistic: ONE mic session = **#63** + **#72** + **#76**, now also carrying the `hard`-tier cold-ask ear. | 2026-08-07 |
| Support tiers (non-math) | OPPORTUNISTIC (+1) | Batch-3 evidence closure via `/eval-test`, serial, one primitive per slice. | 2026-08-04 |
| LA K-2 Grammar density | PARKED — BLOCKED on a user design ruling | Queue top (item 1b `in_front_of`/`behind`) is a design ruling, not code. Buildable alternates if resumed: item 2b (tracker SS-5) or item 4. | 2026-08-05 |
| Science depth — DNA-1 / BIO-1 / BIO-2 | QUEUED (verified filed) | Real rows in `qa/EVAL_TRACKER.md:530-532`. DNA-1 is a measured, month-old, unfixed answer leak (6/10 generations). Rides as the +1. | 2026-08-07 |
| Delegated lane | NONE | — | 2026-08-07 |

> **✅ RESOLVED — the concurrent `constellation-builder` slice SHIPPED (2026-08-07).**
> This reconcile caught it mid-flight and read the diff correctly; it closed as
> READY at PRE, and item 16 is struck to 1/2 in `qa/reader-fit/BACKLOG.md`. What
> the mid-flight read could not see, and what the probes then showed:
> the prose-grade defect bit **Grade 1 as well as K** (`"first grade"` is not
> `"grade 1"`), and the primitive was **orphaned from the tutor** — a full catalog
> tutoring block delivered EMPTY (`sendTextTags: []`, 0/7 contextKeys resolved by
> the component, ~10 `(not set)` in the live prompt). That second finding is the
> severe one and is invisible to a source read.
>
> **⚠️ Now the OTHER direction: a concurrent DI session is live in this tree.**
> `DiShapes.tsx`, `diShapesScript.ts`, `gemini-di-shapes.{ts,test.ts}` modified plus
> two untracked test files. Its `DiShapes.support-tier-context.test.tsx` currently
> adds **2 errors to `typecheck:lumina`**, so that gate is red on the tree while
> being green on the reader-fit slice alone. Do not attribute those to reader-fit,
> and do not `/ship` them together — they are separate streams.
>
> **Ground truth: the tree is NOT clean — the CTX-1 slice is unshipped.**
> `backend/app/api/endpoints/lumina_tutor.py`, `backend/tests/test_lumina_tutor_session_units.py`,
> `my-tutoring-app/qa/di/BACKLOG.md`, plus two untracked reports
> (`qa/tutor-reports/{states-of-matter,lesson-refer-back}-live-lesson…-2026-08-07.md`).
> That is **one stream, one coherent slice** — no `/ship` slicing decision to make,
> just run it. Worth noting because the previous snapshot's headline was
> "a clean-tree reconcile" and the work that closed CTX-1 happened after it.
>
> **Drift #1 — `HUMAN-CHECKS.md` #72 had NO TABLE ROW, and it is the DI lane's only
> human gate. WRITTEN this run.** #72 was "opened" in an 08-06 preamble note and
> "EXTENDED" with a whole new criterion (c) in an 08-07 preamble note — but neither
> ever wrote a row into the table, while `qa/di/BACKLOG.md` item 14 and this file
> both route di-shapes' entire Tier-3 gate to "#72". **The consequence was
> concrete:** a user walking the table would have found #63, driven the
> counting-to-120 bench, and gone home — and di-shapes (pack #5, now L1, four eval
> modes, two spoken response classes) would have had no live evidence and no row
> saying so. **Discussion in a preamble note is not a queue entry.**
>
> **Drift #2 — three reader-fit slices closed AFTER the last HUMAN-CHECKS write and
> had nowhere to route. #75 opened.** S5/S6/S7 committed 22:18–22:48; HUMAN-CHECKS
> was last written 19:28. All three reports say *"live audio ✗ (→ HUMAN-CHECKS)"*.
> **#76 also opened** for CTX-1's one human ear — deliberately small (60 seconds,
> folds into any mic sitting), because the defect it retires was *heard*, not
> measured, and the harness never reproduced the timing that produced it.
> Next free ID = **77**.
>
> **Drift #3 — the `## ACTIVE` body lagged FOUR slices on reader-fit and TWO DAYS on
> DI. Both fixed.** Stream 1 read *"Progress: 11 of 15 · NEXT = 15A S5
> bio-compare-contrast"* after S5, S6 and S7 had all shipped. Stream 2's header still
> read *"last touched 2026-08-05"* with no mention of di-shapes' birth, its two
> ladder rungs, or CTX-1 — its 08-05 paragraph is now collapsed under a current-state
> block. **This is the third consecutive `/pm` run to correct a snapshot-vs-index
> divergence in this file**, always in the same direction: the narrative is written,
> the index is not. The durable fix is discipline at close time — *the closer updates
> the `## ACTIVE` body, not just the snapshot.*
>
> **Queue hygiene — item 15 was CLOSED with its successor living as prose inside it.
> Filed as item 16.** `qa/reader-fit/BACKLOG.md` correctly recorded 15/15 and
> correctly named the frontier, but the frontier sat in a "Pull order now" line
> *inside a completed item*. A cold session reading top-down would have hit a closed
> item first. Item 16 now carries the reproduced defect, the take-`constellation-builder`-first
> call, and a pointer to the method rulings rather than a copy of them.
>
> **WIP is 2 ACTIVE + 1, unchanged and honest.** Both ACTIVE lanes moved today.
> Nothing needs parking.
>
> **One portfolio decision is still owed, and it grew.** `solar-system-explorer`,
> `scale-comparator`, `organism-card` and **now `species-profile` (S6)** have **no
> evaluation hook at all**. Four primitives the manifest can route assessment demand
> at, that structurally cannot measure it. S6's report: *"that is now 4 of the
> sweep's primitives in the same state and it needs a decision, not another slice."*

## Prior snapshot — reconciled 2026-08-07 (earlier) (**a clean-tree reconcile: no drift in the queues, real drift in the two INDEXES**)

| Lane | State | Pull now | Trusted as of |
|---|---|---|---|
| **Reader-fit supply-side sweep** (item 15) | **ACTIVE — top slot** | **✅ 15A COMPLETE 7/7 (2026-08-07) — item 15 is now 15/15.** ~~S5 `bio-compare-contrast`~~ ~~S6 `species-profile`~~ ~~S7 `mission-planner`~~ all CLOSED, READY at PRE (reports `qa/reader-fit/{bio-compare-contrast,species-profile,mission-planner}-PRE-2026-08-07.md`). **NEXT = `planetary-explorer` + `constellation-builder`** — the ranked frontier item, and the last two astronomy generators still on the prose-grade contract violation; both now carry the K astronomy demand S1's floor and 15B's fixes redirected onto them. **⚠️ S7's lesson: the defect bit at GRADE 4, not K** — a `grade=4` request returned `gradeLevel:'1'`, so a Grade 4 student got the Grade 1 screen while K was already fine. Probe the band ABOVE as well as below. Prior state: ~~S5~~ ~~S6~~ **CLOSED, READY at PRE** (reports `qa/reader-fit/bio-compare-contrast-PRE-2026-08-07.md`, `qa/reader-fit/species-profile-PRE-2026-08-07.md`). Next: **15A S7 `mission-planner`** — the last 15A item. **⚠️ S6's lesson: the handoff's predicted grade-shape has now been wrong or incomplete twice running** — S6's predicted prose-grade was real but was NOT the defect (no dead char-compares); the causes were an unstamped rung and a prompt whose eight mandatory sections outvoted its one "younger students" bullet. Probe before scoping. **A portfolio decision is now owed on FOUR primitives** (S11, S12, S15, S6) that have no evaluation hook at all: `/add-eval-modes` or declare exploration-only so the manifest stops routing assessment demand at them. **⚠️ S5's two method lessons: (a) a generator with a CLEAN BODY can still be grade-blind if its band arrives as an argument — the defect was S9's map relocated to the registry call site, so probe rather than trust the predicted shape; (b) a jsdom suite that mocks `useLuminaAI` cannot see a missing `LuminaAIProvider` — the hook THROWS, and four already-shipped 15B primitives have been crashing the biology tester since they landed. Drive one real browser render per slice.** Handoff `qa/HANDOFF-reader-fit-2026-08-07.md` carries re-derived anchors + per-item predictions. | 2026-08-07 |
| **Direct Instruction family** | **ACTIVE** | **di-shapes rungs 1+2 CLOSED, and ~~CTX-1~~ CLOSED 2026-08-07 — the `[CONTEXT UPDATE]` push and `ContextUpdateGate` are deleted; state is kept server-side and attached to messages that already asked for a turn.** Verified at runtime on the live backend + real Gemini: slider moves produced 0 sends / 0 barge-ins, and the **fence held** — `[PRIMITIVE SWITCH]` still fires, is still debounced, and the tutor still answers about the right primitive (`lesson-refer-back` journey). Two findings worth carrying: **classify the cue tag BEFORE attaching state** (a prepended block otherwise reclassifies `[DI_ITEM]` to `"text"`), and **plan step 3 was correctly NOT built** — `student_action` has zero senders repo-wide, and struggle already ships as explicit client cues. Next machine pull = **di-shapes L3 `/add-support-tiers`** (family script-composed fade), then L4 structural. Human side is opportunistic and must never block it: **ONE mic session = #63 re-run (ACCEPTANCE) + #72 (di-shapes — now L0 naming **and** the NEW L1 counting contract, criterion (c))**; CTX-1's residual (i) — one real ear on a >8s turn — folds into it. | 2026-08-07 |
| Support tiers (non-math) | OPPORTUNISTIC (+1) | Batch-3 evidence closure via `/eval-test`, **serial, one primitive per slice**, appending the report + striking per item. | 2026-08-04 |
| **LA K-2 Grammar density** | **PARKED 2026-08-07 (was ACTIVE) — blocked on a user DESIGN RULING, not on code** | Its queue top is item **1b `in_front_of`/`behind`**, which the lane itself records as *"a DESIGN RULING, not code"* — viewer-relative is ambiguous with above/below in a top-down grid, a rule-#1 hazard. Nothing machine-gated sits above it. **If resumed, the buildable pulls are item 2b** (the `identify` hint hands over the answer, 2 of 3 hints — tracker SS-5) **or item 4** (`word-sorter` K picture-pair, 3 subskills). | 2026-08-05 |
| Science depth — DNA-1 / BIO-1 / BIO-2 | QUEUED (verified filed) | Confirmed this run: all three are real rows in `qa/EVAL_TRACKER.md` (`:530-532`), not memory-only. DNA-1 is a **measured, month-old, unfixed answer leak** (6/10 generations). Rides as the +1 the moment support-tiers closes or the sweep pauses. | 2026-08-07 |
| Delegated lane | NONE | — | 2026-08-07 |

> **Ground truth: the working tree is CLEAN.** Nothing uncommitted, so there is no
> `/ship` slicing to propose — the last three slices (`1ad319f`, `6dc3160` and the
> handoff `1eaff23`) each shipped with their own report and their own queue strike.
> That is the discipline working; the 08-06 snapshot's item-12 ship-hygiene warning
> is fully retired.
>
> **The queues were TRUTHFUL — I found no recorded-open-but-actually-done and no
> inverse.** `qa/reader-fit/BACKLOG.md` had already struck S2 and S3, named S4 as
> next, and recorded the two corrections those slices produced. That is worth
> stating plainly because it is the failure mode `/pm` exists to catch, and this
> run did not catch it.
>
> **Drift #1 — `HUMAN-CHECKS.md` #73 was scoped to 3 primitives while 10 slices
> pointed at it. FIXED this run.** Every one of the eight 15B slices plus 15A's S2
> and S3 recorded "no Tier-3 live audio run → HUMAN-CHECKS #73". The row itself was
> written after S10 and still named only `moon-phases-lab`, `classification-sorter`
> and `day-night-seasons`. **The consequence was concrete, not cosmetic:** a user
> walking the list would have driven three primitives, struck the row, and silently
> discarded the live-audio debt for five more — and the whole point of these ten
> slices was giving mute primitives a voice, so the *only* evidence that matters is
> someone hearing them. #73 now covers all eight 15B slices; **#74 is new** for the
> 15A pair, kept separate because its open questions are visual rather than audible
> (chiefly: `orbit-mechanics-lab`'s 🐢 "too slow" outcome draws an arc of ~51 km,
> **under one pixel** at this scale, so a K child may not be able to tell it apart
> from nothing happening). Next free ID = 75.
>
> **Drift #2 — the reader-fit stream was being WORKED while the `## ACTIVE` body
> still labelled it "PARKED — queue DRAINED". FIXED this run.** The 08-06 and 08-07
> snapshots above correctly describe the supply-side sweep as ACTIVE and top-slot,
> but a cold reader who scrolled past the narrative into `## ACTIVE` found LA K-2
> Grammar in slot 1 and reader-fit marked parked-and-drained — the exact defect this
> file called out on 2026-08-05 for the grammar lane, recurring in the other
> direction. **Snapshot prose is not the index.** A stream is ACTIVE in the `##
> ACTIVE` body or it is not ACTIVE.
>
> **WIP was at 3 ACTIVE + 1; now back to 2 + 1.** Reader-fit (08-07) and DI (08-06)
> are both genuinely moving. **LA K-2 Grammar is PARKED** — not for staleness, but
> because its top item is a design ruling the user has to make, so it is *blocked*
> rather than merely idle, and parking it is honest about that. Its two buildable
> alternates are named above so resuming costs nothing.
>
> **One portfolio decision is owed and cannot be resolved by a slice.** Three of the
> eight 15B primitives — `solar-system-explorer`, `scale-comparator`, `organism-card`
> — have **no evaluation hook at all**. They are pure instruments, so band-contract
> rule 8 is N/A rather than passing. Either they get `/add-eval-modes`, or they are
> declared exploration-only **so the manifest stops routing assessment demand at
> them**. Leaving it undecided is the bad outcome: today they can be selected to
> carry an objective they structurally cannot measure.
>
> **Recorded for the executor, from the 08-07 slices — three findings that change
> how the remaining sweep is worked:**
> **(a) Probe the NEIGHBOURING grade, not just K.** S2's generator was clean at K on
> the happy path and returned **Grade 3 content for a Grade 1 ask**. A K-only probe
> would have declared it clean.
> **(b) Drive the generator, not its helpers.** S3's first three revert-bites did not
> bite, because the tests only covered the exported pure helpers and not the
> generator's *use* of them. Stub `../geminiClient` and drive the real generator with
> a reply that OMITS every grade-shaped field — the only way to cover a degrade path,
> and both S3 and S11 had defects that live *only* there.
> **(c) Do NOT generalise S2's lexical-compare bug without biting it.** S3's ordinal
> rewrite was first framed as the same defect by analogy; it was not, and the
> revert-bite proved it (0 failures). `'K' > '3'` is what made S2 different.

## Prior snapshot — reconciled 2026-08-06 (**RE-PRIORITIZATION — the build pivot died on its own fit check**)

> **`/pm` 2026-08-06 (latest) — the user's read: *"feels like we don't have high impact work
> other than DI… feels like we were going through `/reader-fit` but then stopped, this may be
> higher value?"* Both halves tested against ground truth. The first is right for a reason
> nobody had recorded; the second is right about the VALUE and wrong about the CAUSE.**
>
> **1. The build stream `/pm` opened yesterday is DEAD — killed by its own fit check.**
> `sight-word-trainer` (GAP-008) was pulled as the new ACTIVE stream; `/curriculum-fit`, run
> pre-birth per the LA lane's standing *fit-before-birth* rule, returned **BIRTH → EXTEND, do
> not build.** `fast-fact` already occupies the space and names sight words in its catalog
> description verbatim; 3 of the 4 proposed modes already ship; and GAP-008's central mechanic
> (1s/0.5s/0.25s flash tiers — *"speed is the entire point"*) **violates a standing ruling**
> ([[feedback_no-timer-on-fact-fluency]]) that `fast-fact` already implements correctly. Its
> honest conversion is `/add-eval-modes` on `fast-fact` — which is **FF-4**, already open.
> GAP-008 marked **CLOSED-BY-EXTEND**. Report `qa/curriculum-fit/sight-word-trainer-2026-08-06.md`.
> **Second fit-before-birth save in two days** (the `spatial-scene` catch was the first) — the
> rule is paying for itself, but it also means the portfolio has now spent two consecutive
> `/pm` runs opening build streams that dissolved on contact with the catalog.
>
> **2. `/reader-fit` did not stop — it DRAINED, and its own queue says so.** Items 14a–14m are
> all closed (last: 14l, 2026-08-05), and `qa/reader-fit/BACKLOG.md` states outright: *"This
> queue has no EMERGING census pull left — the next item here is a fresh priority call, not a
> carried-over pointer."* Nothing was abandoned mid-stream. **But the user's instinct about its
> VALUE is correct and worth acting on** — reader-fit produced the highest-severity findings of
> the last month (rule-#1 answer leaks, bands that were structurally unreachable, hardcoded caps
> silently overriding lesson intent), none of which tsc, unit tests, or contracts can see.
>
> **3. ⚠️ `/pm` GOT THIS WRONG AND THE USER CAUGHT IT — recorded because the trap is
> reusable.** The first version of this snapshot argued reader-fit was "worked out" at
> PRE/EMERGING and that resuming it meant pulling its weakest band. The user's push-back:
> *"we have over 100 primitives — explaining to me we did 14/14 is missing so many other
> K-selectable primitives that aren't designed for non-readers. If you say only 14
> primitives are relevant to K, this is a lack of scope."* **Correct, and the error is
> precise: `/pm` read "the queue drained" as "the band is covered."** Those are different
> claims. The reader-fit queue was seeded from **demand SAMPLES** — 6 K subskills
> (2026-07-14), 6 G1 subskills (2026-08-01), then whatever routed in those 12 traces. A
> primitive that never surfaced in the sample was never audited, however selectable it is
> at K. **Sampling demand ≠ covering supply.**
>
> **Coverage measured against the live catalog this run — the number that was missing:**
> **196** catalog entries · **107 K-selectable** (text permits K, no `BAND FLOOR` /
> "Grade 1+ ONLY" / "not appropriate for younger grades") · **~38** with any reader-fit
> evidence → **≈69 K-selectable primitives never reader-fit audited.** The unaudited set
> holds near-certain PRE failures, not just unknowns: `stoichiometry-lab`,
> `gas-laws-simulator`, `orbit-mechanics-lab`, `telescope-simulator`, `blueprint-canvas`,
> `digital-skills-sim`, `two-way-table`, `story-planner`, `machine-profile` are all
> routable into a Kindergarten lesson today. Caveat kept honest: the 107 is a text proxy
> over description + constraints and over-counts incidental K-inclusive ranges, so triage
> verifies per primitive — but discount it heavily and the gap is still dozens.
>
> **Re-seed shape = a SUPPLY-SIDE sweep, not another demand census:** enumerate the 107 →
> subtract the ~38 → triage the ~69 by risk (text-primary interaction, no read-aloud
> `aiDirectives`, no component band gate, adult vocabulary in `constraints`) → `/reader-fit
> [--fix]` highest-risk first. The cheapest class of fix is a catalog **band floor** (the
> `word-sorter` `match_pairs` pattern) — no component work, and it removes the failure by
> making the primitive unselectable at K. The G2/DEVELOPING census stays genuinely
> never-run and legitimately queued, but BELOW this.
>
> **4. The transferable part of reader-fit — and where it has never been pointed.** What made
> it valuable was not the band rubric; it was that reader-fit was the only **demand-side census
> driven through the REAL pipeline** (published objective → manifest → generator → judged
> output). That method has been run on **K and G1 across LA / Math / SS**. It has **never been
> run on Science** — and Science is exactly where this run found two independent problems
> stacked on the same primitives:
>
> - **PEDAGOGY (CLAUDE.md #1) — a measured, month-old, un-queued answer leak.** `/oracle-test`
>   coverage of biology started 2026-07-09, ran **one** primitive, and stopped. That pilot
>   measured **6 of 10 real generations leaking the answer** in `dna-explorer` (the build
>   challenge's `givenStrand` equals the displayed `templateStrand`). It lived only in a memory
>   note saying "route to `/eval-fix`" — `/pm` verified this run that there is **no tracker row
>   and no fix in the tree**: `gemini-dna-explorer.ts` still has no constraint separating the
>   two. Now filed **DNA-1**. The other **13 evaluable biology primitives have never been
>   oracle- or eval-tested at all** (**BIO-1**). Expected yield is high on precedent: both leak
>   investigations that ran to completion — FF-1 (`fast-fact`) and DNA-1 — found the leak was
>   **domain-wide, not local**; `fast-fact` measured Math 6 / LA 24 / Science 15 violations once
>   someone actually looked.
> - **DENSITY (CLAUDE.md #3) — ≈42 primitives invisible to the IRT selector.** Re-measured
>   properly this run as `supportsEvaluation: true` vs `evalModes:` per catalog file (the first
>   pass counted total primitives and overstated it): **biology 14/0 — the entire domain**,
>   engineering 23/5, astronomy 10/3, core 10/7. Math (61/61), literacy (32/31), chemistry
>   (14/14), di (4/4) are clean. Filed **BIO-2**. **Demand caveat, measured not guessed:**
>   biology splits about half elementary (organism-card, classification-sorter,
>   life-cycle-sequencer, habitat-diorama, bio-compare-contrast, adaptation-investigator,
>   body-system-explorer, bio-process-animator) and half secondary-only (protein-folder 7-8,
>   inheritance-lab 6-8, energy-cycle-engine 5-8, evolution-timeline 4-8, cell-builder 4-8,
>   microscope-viewer 3-8) — so run a demand check before committing the domain.
>
> **These two share the same generator per primitive, so they are one slice, not two.**
>
> **RECOMMENDATION REVISED after the §3 correction — reader-fit supply-side sweep takes the
> ACTIVE slot; Science depth drops to second.** With the real coverage number in hand the
> ranking inverts, on three grounds: **(a) size** — ≈69 unaudited K-selectable primitives vs
> ≈42 at L0; **(b) priority** — a non-reader who cannot start is CLAUDE.md #1 (pedagogy),
> while an unrouteable primitive is #3 (density: it still teaches, it just isn't
> adaptively selected); **(c) severity** — the L0 failure mode is *sub-optimal routing*,
> the reader-fit failure mode is *a Kindergartener handed `stoichiometry-lab`*. The user's
> original instinct ("we were going through `/reader-fit`… this may be higher value") was
> right, and `/pm`'s first answer talked them out of it on a bad premise.
> **Science depth (DNA-1 / BIO-1 / BIO-2) stays fully queued and un-deleted** — the
> dna-explorer leak is measured, month-old and un-fixed, so it should ride as the
> opportunistic +1 or take the slot the moment the sweep's triage is authored.
>
> **5. DI is genuinely in progress and stays ACTIVE — the parking note below is superseded.**
> `3986f77` shipped item 10 (`counting_next` to 120, user-ruled build-ahead) plus the DI-120-1
> barge-bar floor, and an untracked `diShapesScript.ts` shows a new pack in flight. The
> "PARKED to make room" decision in the prior snapshot was made before that work landed.
> **COMPLETED same evening — both DI development slices are SHIPPED (the in-flight pack
> landed as `cabb3f0`).** The user's authoring call ("DI shapes… and the primitive to 120,
> we can move forward directly") became two committed slices:
> **(a) item 10 BUILT** — code-owned `numberWordFor` 0..120, counting-windowed pool
> (decade transitions + near-ceiling window + teen anchors, never rote-from-zero),
> per-type benched ceilings (facts stay ≤20 by construction), teen/decade + compound-
> completeness judging clauses, 1000ms compound close; gates 96/96 focused, full Vitest
> 1778/1778, **real-pipeline probes 5/5** (census reaches 119; within-5/10 controls
> unchanged; subtraction ≤20 under a 120 ask). **DI-120-1 FIXED** in the same slice
> (`MIN_BARGE_BAR 0.03`; design question settled AGAINST cap-skipping — DI-1 doctrine,
> the channel closed where the turn opens). Report
> `qa/tutor-reports/di-math-facts-item10-2026-08-06.md`.
> **(b) di-shapes L0 BORN (`cabb3f0`, pack #5)** — DISTAR shape naming ("this shape is a
> triangle — what shape is this?"), SVG stage at generator-stamped rotation, Fork A
> 9-shape menu, geometry-as-rule-#1-guard (rectangle ≥1.6:1 / oval non-circular),
> "diamond" judged alternate of rhombus, full registration incl. β + `di-shapes →
> MATHEMATICS`; bench `Shapes` probe set wired. Gates: DI sweep 304/304, full Vitest
> **1791/1791**, typecheck:lumina 0, py_compile clean, **real-Gemini probes 3/3**.
> Birth cert `qa/eval-reports/di-shapes-birth.md`; queue row = DI BACKLOG item 14.
> **Human gate = ONE mic session: #63 re-run (now an ACCEPTANCE drive on the fixed bar,
> unblocked) + NEW #72 (di-shapes L0 live loop + Shapes bench stress).** The DI lane's
> "no unblocked top item / author with the user" state is RESOLVED — authored, built,
> shipped; next lane pulls after the sitting = CTX-1 (item 13, the tutor-quality top)
> and the di-shapes ladder (curriculum-fit probe → L1 count_sides).
>
> **6. Ship hygiene — `addition-subtraction-scene` item-12 is STILL uncommitted** (4 files,
> browser-verified with a 10-check real-Chrome run, no commit) and now carries a modified
> contract + reader-fit test alongside. It is a clean standalone slice; ship it before starting
> anything new. **STALE as of the 08-06 sweep session — `git status` shows a clean tree apart
> from that session's own files; item-12 landed in `56b5dda`.**

## EXECUTED 2026-08-07 (latest) — DI lane: **CTX-1 CLOSED — the tutor is no longer notified when a child moves a slider**

> Lane: **Direct Instruction family**, ACTIVE. Queue of record `qa/di/BACKLOG.md` item 13.
> User pull, with the scope fence authored the same session. Reports
> `qa/tutor-reports/states-of-matter-live-2026-08-07.md`,
> `qa/tutor-reports/lesson-refer-back-live-lesson-2026-08-07.md`.
>
> **A whole failure class deleted, not a symptom patched.** Every within-primitive
> state change used to be pushed at Gemini as a nominally-silent `[CONTEXT UPDATE]`.
> This transport has no silent mode — every realtime text send closes the turn and
> registers as user activity — so `ContextUpdateGate` existed to park those updates,
> and its 8s ceiling force-released them into turns that routinely run longer, which
> is how a tutor came to read a prompt line aloud to a child mid-exploration. The
> push is gone, the gate (89 lines) is gone, the prompt budget spent telling the
> model to ignore what we had just pushed is gone. **The state is kept** in a
> server-side `PrimitiveState` and attached to the next message that already asked
> for a turn — fresher than the old push, which landed early and got buried.
>
> **The fence held, and it was checked, not assumed.** `[PRIMITIVE SWITCH]` is a
> different `elif` ~45 lines away in the same chain; it is untouched. Proven live:
> both switches announced, debounce intact at 2.5s, tutor acknowledged each new
> activity and then referred back to the **right** primitives.
>
> **Runtime evidence (real backend + real Gemini Live, not a type check).**
> `states-of-matter` 11 beats all correct — the three-slider `silent_slider_wiggle`
> beat produced **zero audio and zero sends**; ledger shows **6 `context-update`
> rows → 0 pushes → 0 barge-ins**, with `state_attached` climbing 1→2→3 across the
> phase-change cues then holding at 3 (live de-dupe). Units 28/28 (13 new replace 9
> gate tests); backend suite **26F/105P vs. a measured 26F/101P baseline**.
>
> **Two findings the plan could not have known.** (1) **Classify the cue tag BEFORE
> attaching state** — `classify_cue` reads the leading bracket, so prepending a
> state block silently reclassifies `[DI_ITEM]` to `"text"` and corrupts both the
> ledger and fault-injection arming. Pinned by a test. (2) **Plan step 3 (a
> server-side struggle trigger) was correctly NOT built:** `student_action` has
> **zero senders repo-wide** — the handler is dead code — and struggle already
> arrives as explicit client cues (`[ANSWER_INCORRECT]`, `[RHYME_MISS]`). The
> capability the plan wanted already exists in the shape it wanted.
>
> **Consumer check found a real one and preserved it:** the five DI packs push a
> contextKey bag to keep the tutor's runtime state truthful as facts advance, and
> catalog `{{key}}`s only resolve at switch/connect — so post-switch that push was
> the tutor's only source of the current item. It now rides on the `[DI_ITEM]` that
> asks for the judgment. No frontend change needed.
>
> **Residual:** voice-only exploration — audio bypasses the text queue, so a student
> who drags a slider then asks *aloud* has a tutor that was not handed the new
> state. And one human ear on a >8s turn, which folds into the standing mic session.
>
> **NEXT on this lane: di-shapes L3 `/add-support-tiers`.**

## EXECUTED 2026-08-07 (earlier) — reader-fit **15A S5 `bio-compare-contrast` CLOSED, READY at PRE**

> Lane: **reader-fit supply-side sweep**, ACTIVE. Queue of record
> `qa/reader-fit/BACKLOG.md` item 15A. Report
> `qa/reader-fit/bio-compare-contrast-PRE-2026-08-07.md`.
> Verdict **SCAFFOLD-GAP + PRIMITIVE-GAP**, not WRONG-BAND.
>
> **The handoff's "fourth grade-shape" prediction was right about the LOCATION and
> wrong about the SHAPE.** `gemini-compare-contrast.ts` genuinely is clean — it
> takes `gradeBand` as a parameter — but the registry call site held a **verbatim
> fifth copy of the S9 biology map** (`gradeBandMap[ctx.gradeContext] || '3-5'`).
> **Probed pre-fix, K, G1 AND G4 all returned `'3-5'`.** Fixed by importing S13's
> shared `resolveBiologyBand`; no fifth copy written. **Generalisable rule: a
> generator with a clean body can still be grade-blind if its band arrives as an
> argument — check the call site even when the generator greps clean.**
>
> **The biggest find was not the band.** Two answer-key defects at EVERY grade,
> unqueued, both CLAUDE.md #1: (a) the **B-only Venn region was structurally
> unreachable** — entity B was filtered by "category not already in entity A"
> while the generator prompt *demands* parallel categories, measuring **0 B-only
> cards at K, G1 and G4**; (b) the key **could contradict itself**, capping a
> perfect player at **60%** on the generator's own K-2 example, and it hides on
> long prose so **it fires hardest at the youngest band**.
>
> **A shipped 15B regression surfaced here:** `BiologyPrimitivesTester` has no
> `LuminaAIProvider`, and `useLuminaAI` **throws** rather than degrading — so
> `classification-sorter`, `life-cycle-sequencer`, `habitat-diorama` and
> `organism-card` **crash the biology tester today**. Missed because all four 15B
> biology slices verified in jsdom, **which mocks the hook**, and none drove a
> browser. Fixed in this slice.
>
> Gates: **50 tests, 12 revert-bites / 12 bite** — four did not bite at first and
> were restructured, and one of those was a **harness bug not a test gap** (the
> cap-override clause appears 5× in `biology.ts`, so the bite hit the wrong
> entry). src-scoped tsc **803 = baseline set-identical**, typecheck:lumina 0,
> full vitest **2219/2219**, tutor-test T1 `pass` + T2 `findings: []`,
> `dataBagDynamic: false`, zero `(not set)`.
> **Runtime A/B: K and G1 `3-5`→`K-2` with the register changing (*"Mammalian
> Predators… evolved as social pack runners"* → *"Comparing Our Furry Friends…
> furry pets that live in our homes"*); G4 control unchanged.**
> **Driven end-to-end in real Chrome** — 8 taps to completion, three picture
> targets, zero console errors — which **caught a bug jsdom rendered silently**
> (a `LuminaReadAloud` button nested inside a full-row button).
>
> Residuals: no Tier-3 live audio; rule 4 PARTIAL (6 elements); **rule 3 PARTIAL on
> the stimulus** — no per-attribute image exists in the schema, the biggest further
> PRE win; **the generator hard-THROWS when it cannot find two entities**
> (pre-existing, every grade, worth its own item); **`mode` is almost always
> `side-by-side`**, so the assessed K path is rarely routed while
> `supportsEvaluation: true` still attracts assessment demand to a viewer.
>
> **NEXT: S6 `species-profile`** — predicted `= ctx.gradeContext` @ `:241`, but
> **probe it**: S5 shows the predicted shape can be wrong.

## EXECUTED 2026-08-07 (later) — DI machine side: **di-shapes ladder rungs 1+2 CLOSED; the pack is L1**

> Lane: **Direct Instruction family**, ACTIVE. Queue of record `qa/di/BACKLOG.md` item 14
> (the di-shapes birth-cert ladder). User pull: *"DI machine side — di-shapes ladder
> (/curriculum-fit probe → L1 count_sides) or CTX-1"*. Both rungs shipped, in order,
> because a fit verdict can redirect what the modes should be — and it did.
>
> **RUNG 1 — `/curriculum-fit di-shapes`: MATCH at BOTH grades, 5/5 coherent** (K 0.795
> `GEOM001-01-A` *"Match and name basic 2D shapes… regardless of size, color, or
> orientation"*; G1 0.798 `GEOM001-01-c`). The birth cert's K.G.2 orientation-independence
> claim is now **measured** — the curriculum's own top-1 wording carries it, rather than
> our assertion. Report `qa/curriculum-fit/di-shapes-2026-08-07.md` (+ `.json`).
>
> **⚠️ The probe that answers this question was itself mis-scoped, and the failure was
> reproduced before it was fixed.** `curriculum_fit_probe.py:85` resolved the subject with
> `subject_for_domain`, while the live path (`submission_service.py:461`) uses
> `subject_for_primitive`, which consults `_PRIMITIVE_TO_SUBJECT` FIRST — and di-shapes /
> di-math-facts are exactly the two DI packs that override to MATHEMATICS. Pre-fix,
> di-shapes scoped to **LANGUAGE_ARTS** and ABSTAINed diffuse, ranking a geometry primitive
> against **Rhyme Recognition, Onset-Rime Blending and Phoneme Isolation** — verbatim the
> misattribution class `/curriculum-fit` was built to catch. A session trusting that output
> would have filed a **false K-geometry curriculum gap**. The gap was *masked, not absent*:
> the 07-24 di-math-facts report forced the right scope with a deliberately wrong
> `--domain math`, a workaround recorded in the report and never in the script — so it
> depended on the operator already knowing. `curriculum_fit_sweep.py` had the same defect
> **plus** a hoisted subject/grades loop that would have swept every DI pack under one
> subject. Both fixed; controls clean. Shipped `6e43315`.
>
> **RUNG 2 — L1 `/add-eval-modes`: `shape_review` 2.5 · `count_sides` 3.0 ·
> `count_corners` 3.5** alongside L0's `name_shape` 1.5, β mirrored into
> `problem_type_registry.py`. This closes the second half of the founding modality call —
> *"this is a triangle, what is this, **how many sides does it have**"*. Report
> `qa/eval-reports/di-shapes-eval-modes-2026-08-07.md`.
>
> **Rung 1 paid for rung 2 twice over, which is the argument for running fit BEFORE the
> build:** (a) it measured an exact home for the counting modes at BOTH grades, not just
> G1 — G1 `GEOM001-01-b` *"Count the number of sides and vertices"* @ 0.785, whose own
> example list enumerates **eight of the nine Fork A shapes with the same counts this pack
> judges**, and K `GEOM001-02-A` @ 0.786; and (b) it caught a **blocker**: `constraints`
> read *"no side/corner counting tasks yet"*, which is manifest-visible steering, so the
> new modes would have been **born unreachable**. Lifted (description too). The 3D-solids
> and composing exclusions were KEPT — rung 1 measured those neighbours at 0.770 / 0.769,
> above τ, so the fences are load-bearing.
>
> **Standing gate 1 (bench-first) cleared without a sitting, and the reason matters:** the
> counting answer is a number word in **3..6** — the #46-benched class — and the menu tops
> out at a hexagon, so **no multi-word numeral can arise**. That is precisely what keeps
> item 10 blocked behind #63; the gate does not reach this rung.
>
> **Two pedagogical rulings, recorded so they are not re-litigated.** (a) **Counting items
> are POLYGON-ONLY.** A curved shape carries `sides: null` — not-applicable, not zero — and
> *"how many sides does a circle have?"* has TWO arguable answers for a five-year-old (0
> straight sides, or 1 continuous curved edge), failing the pack's *one drawing, one
> defensible answer* birth discipline. A curves-only scope WIDENS rather than emitting an
> unanswerable item. This is a deliberate, stated coverage gap against `GEOM001-01-b`
> (which does list circle as 0,0) — the zero/none contrast is a real DISTAR move, but a
> different item shape and response class, so it is **queued, not smuggled in**.
> (b) Under a counting mode the shape's **NAME is withheld too** — it hands the count to
> any child who knows it (triangle → three).
>
> **Two defects found and fixed in-slice, each by a different instrument.**
> `shape_review`'s wide cumulative draw would have **overridden shapes the objective
> NAMED**, breaking the pack's own scope doctrine — caught by **revert-bite, not
> inspection** (it failed the pre-existing L0 test). And a **live probe** shipped chrome
> reading *"Curve Safari! … look at some smooth outlines"* over five polygons, because the
> wrapper is written from the objective before the pools are built; now reverts to neutral
> defaults on the widen path, with a non-widening control proving the guard is scoped.
>
> Gates: focused **28/28**, **6 revert-bites all bit** (3/2/2/1/2/1), full Vitest
> **2169/2169**, typecheck:lumina **0**, src-scoped tsc **803 = baseline exactly** with
> zero errors in any touched file, py_compile clean, tutor-test T1 `warn` = the **family
> baseline** (identical two WARNs on all three untouched sibling packs — DI cues via
> `queueCue`, never `sendText`) and T2 **zero `(not set)`**, cleaner than di-math-facts.
> **Real-pipeline probes 7/7** (real Gemini, real registry): `mixed` produced **all four
> identities in one 5-item session** (SP-21 holds live), and `count_sides` on *"Count the
> sides of circles and ovals"* produced **zero curved shapes** — rule #1 against an
> adversarial ask.
>
> **Residuals, stated rather than buried:** (i) **no Tier-3 live audio on the counting
> contract** — that the tutor waits out a child counting aloud, refuses an off-by-one, and
> never counts aloud itself is UNPROVEN; **#72 was EXTENDED with criterion (c)** rather
> than opening a new row, and the extension is written out so #72 cannot be struck on the
> naming half alone. (ii) the zero/none contrast. (iii) **cross-queue, filed not fixed:**
> di-math-facts' Tier-2 probe resolves `supportTier: unresolved` and renders one
> `(not set)` into the assembled prompt — its L3 rung, not this one.

## EXECUTED 2026-08-07 — 15A entered at S2; **the BAND-FLOOR strategy was OVERTURNED by user ruling**

> Lane: **reader-fit supply-side sweep**, still ACTIVE. Queue of record
> `qa/reader-fit/BACKLOG.md` item **15A**. Entered from
> `qa/HANDOFF-reader-fit-2026-08-07.md` (written after 15B closed 8/8).
>
> **⚠️ STRATEGY CHANGE — this is the durable outcome of the session, bigger than the slice.**
> 15A's stated theory was *"these primitives cannot serve K by design, so the fix is a catalog
> BAND FLOOR, no component work"*, with S1 `telescope-simulator` as the shipped precedent.
> Mid-slice the user ruled: *"i dont like band floor method, like if lumina routes to a certain
> primitive, its okay to use it and we should make it age friendly?"* **A floor removes a K
> failure by removing the primitive — it shrinks supply at exactly the band with the least
> content** (CLAUDE.md priority #3: the adaptive engine only works when there is enough content
> to route through). **WRONG-BAND is now a last resort**, legitimate only when the core act
> cannot exist at the band at all AND another primitive already covers the objective.
> Recorded as [[feedback_make-age-friendly-not-band-floor]]; BACKLOG 15A rewritten; **S1's
> Grade-2 floor is now a REVISIT CANDIDATE, not a precedent.**
>
> The ruling was corroborated live, not just accepted: a real `topic-trace` on *"Things that go
> around and around in space"* @ K **selected `orbit-mechanics-lab`**, so a floor would have
> deleted a card the curator actively wanted.
>
> **S2 `orbit-mechanics-lab` CLOSED — READY at PRE.** Verdict **SCAFFOLD-GAP +
> PRIMITIVE-GAP**, not WRONG-BAND. Report `qa/reader-fit/orbit-mechanics-lab-PRE-2026-08-07.md`.
> Four defects: prose grade (`:251`); a **second** bug that survives a correct resolver —
> `gradeLevel >= '3'` is TRUE for `'K'`, so burns/field-lines stayed on at K (a grep for the
> resolver finds only the first); the resolved rung was **never stamped onto the output**, so
> every new gate would have been dead on arrival (the S14 shape); and the missing channel
> (no catalog block, no `useLuminaAI`). Both numeric sliders (kN, degrees) replaced at K-1 by
> **three tappable pictures**, one tap sets thrust+angle and flies.
>
> **Correction to the handoff's own prediction, worth carrying:** it expected the prose-grade
> defect to bite at K. **It did not** — the K happy path was already correct. It bit at **G1**
> (*"Rocket to Orbit! - **Grade 3** Orbit Mechanics Lab"* with the full adult instrument) and on
> the degrade path. **A K-only probe would have passed this generator clean. Probe the
> neighbouring grade too.**
>
> Also found: **`showOrbitPath` was declared, generated at every grade, and read by NOBODY** —
> and it is the catalog's entire K rung (*"showOrbitPath only"*). Now implemented.
> `showApogeePerigee` was equally dead. Physics extracted to a pure
> `service/astronomy/orbitPhysics.ts` so the three speed presets are **proved against the same
> integrator the child's rocket flies on** (TWR 0.90 crash / 1.02 orbit on-screen / 2.50 flung
> off-screen) rather than asserted. **Answer leak caught in-flight:** the winning choice was
> labelled *"Just right"* — which names the answer, and the tutor reads labels aloud to a child
> who cannot read them. Relabelled "Medium", test-locked.
>
> Gates: 35 + 34 tests, **six revert-bites (1/2/4/2/20/1) — two did NOT bite at first** (the
> rung stamp, `showOrbitPath`) because the code was unreachable from a test, and were
> **restructured rather than left as decoration**; src-scoped tsc **803 = baseline zero new**,
> typecheck:lumina 0, full vitest **2049/2049**, tutor-test Tier 1 `pass` + Tier 2
> `findings: []` / `dataBagDynamic: false` / 9-of-9 keys `component` / zero `(not set)`.
> **Runtime A/B @ G1: `'3'` + full instrument → `'1'` + all off; G3 control unchanged.**
> Curator A/B reported as **no measurable change** (1/4 pre vs 0/4 post — inside noise at a
> ~25% base rate); selection is not what this slice changed, so it is a supply sanity check,
> not the decisive evidence.
>
> **S3 `rocket-builder` CLOSED the same day — READY at PRE.** Report
> `qa/reader-fit/rocket-builder-PRE-2026-08-07.md`. **First slice where rule 2
> already passed** — tapping a part already added it, so the K-fit core act needed
> no protocol surgery; the failures were the screen and the voice.
> `data.gradeLevel` was read in **exactly ONE place in 1,205 lines**: to print a
> literal `GRADE K` badge at the child. Prose grade bit on the **degrade path
> only** (happy path was correct at BOTH K and G1 — *a happy-path probe would have
> passed this generator*), plus the missing rung stamp, the missing channel, and
> 13 chrome classes gated. Gates: 26 + 31 tests, tsc **803 = baseline**,
> typecheck:lumina 0, vitest **2106/2106**, tutor-test T1 `pass` + T2 clean,
> runtime ladder K → G1 → G3 monotone.
>
> **Two things from S3 that change how later slices should be worked:**
> **(a) HONEST CORRECTION —** the ordinal budget-rung rewrite was first framed as
> "a second bug that survives the resolver", generalising from S2. **It is not**:
> once the rung is canonical, `includes()` and `rung >= 3` are equivalent, and the
> revert-bite proved it (0 failures). S2's `>= '3'` was different only because
> `'K' > '3'` lexically. **Do not generalise S2's second bug without biting it.**
> **(b) TESTING TECHNIQUE —** the first three bites did NOT bite, because the
> generator tests only covered the exported pure helpers, not the generator's own
> USE of them. Fixed by stubbing `../geminiClient` and driving the real generator
> with a reply that OMITS every grade-shaped field — the only way to cover a
> degrade path. Should be the default for this class.
>
> S3 residuals: **rule 4 still PARTIAL at K** (6 controls with 3 parts; the lever
> is a generator part-cap, a Tier-3 change not bundled) and a **live flash-lite
> truncation 1-in-4 on G1** (`availableComponents` unbounded) — which means the
> degrade path this slice fixed is genuinely reachable in production.
>
> **NEXT: 15A S4 `story-planner`** — its generator is already canonical
> (**do NOT "fix" it**); audit the component and scaffold only.
> Residuals: no Tier-3 live audio (→ HUMAN-CHECKS #73); 0 eval modes;
> `gravityVisualization`/`initialOrbit` still declared-but-unread; the 🐢 "too slow" arc is
> ~51 km ≈ **under 1 px**, so that outcome reads only from the 💥 + spoken beat.

## EXECUTED 2026-08-06 (same day) — reader-fit supply-side sweep TAKEN as ACTIVE, S1 CLOSED

> The re-prioritization above was acted on immediately. Lane state: **ACTIVE**, queue of
> record `qa/reader-fit/BACKLOG.md` **item 15**, triage
> `qa/reader-fit/supply-sweep-triage-2026-08-06.md`.
>
> **The ≈69 estimate was replaced with a real enumeration** (vitest harness importing
> `UNIVERSAL_CATALOG`, then deleted — not a grep): **196 entries · 118 K-selectable · 28
> audited → 90 never audited.** *Higher* than the estimate, not lower; the gap is 18 entries
> that state no grade at all, which the text proxy could not see.
>
> **The top risk band collapsed from "90 audits" to ONE verified class.** A primitive reaches
> a non-reader only via a catalog `tutoring` block or component `useLuminaAI`/`sendText`.
> **26 K-claiming primitives have NEITHER** — the tutor is handed the literal string *"No
> specific scaffolding instructions for this primitive type."* (`lumina_tutor.py:385`). PRE
> contract rule #1 fails before a single string is read. 20 of the 26 make an explicit
> `"K: …"` promise in `constraints`. **11 are ALREADY OWNED** by
> `qa/engineering-tutoring-scaffold/BACKLOG.md` Phase A (which found the same defect from the
> read-aloud side on 07-21) — confirmed, not re-filed. **The unowned 15 are item 15**, split
> WRONG-BAND (floor it) vs SCAFFOLD-GAP (give it a voice). All but one also carry 0 eval
> modes, so each is **one slice shared with the queued BIO-2 density deficit**.
>
> **Two `/pm` estimate corrections, recorded so they are not re-raised:**
> `stoichiometry-lab`/`gas-laws-simulator` are **not** top-band — their constraints say
> *"Best for grades 8-12"*; they matched only on a *"K-8 → HS gap"* boast. And `story-talk`
> was a **false positive** — it is the PRE reference model, driving read-aloud from component
> `sendText`; it became the negative control that proved the channel test discriminates.
>
> **S1 `telescope-simulator` CLOSED — WRONG-BAND, floored to Grade 2, A/B-verified against
> the real curator.** Report `qa/reader-fit/telescope-simulator-PRE-2026-08-06.md`.
> Audit A: every load-bearing string UNCOVERED (the task instruction is 12px text behind a
> "Show hints" toggle). Audit B: FAIL structurally — `tutor-test` returns HTTP 400
> `no-scaffold`. Audit C: **17+ simultaneous interactive elements vs the contract's ≤5**, plus
> an `AZ 225.0° · ALT 35.0° · 3×` readout in a five-year-old's field; `gradeLevel` is
> destructured at `TelescopeSimulator.tsx:265` and **never read again**, so K and Grade 5
> render an identical panel. Fix = catalog `BAND FLOOR: Grade 2+ ONLY` (states why + names the
> K-1 alternatives) + generator backstop (schema enum `["2".."5"]`, K/G1 rungs deleted).
> **Second defect fixed in the same slice:** the generator read PROSE `ctx.gradeContext` into
> `=== 'K'` / `<= '2'` comparisons that could never match — the **`14m` class, unwired here** —
> now canonical-first via exported `telescopeGradeFromGrade()`, prose resolver kept as fallback.
> Gates: 10 focused tests with **revert-bite 3/10**, tsc **805 vs 806 baseline** (one fewer,
> zero new), typecheck:lumina 0, full vitest **1801/1801**.
> **Runtime (Verification Doctrine): eval-test K→2, G1→2, G3→3 unchanged (control), and a
> curator A/B on "Looking at the night sky with telescopes" @ K — PRE-FIX the real pipeline
> selected `telescope-simulator`; POST-FIX it does not.** The predicted failure was reproduced
> live before it was fixed.
>
> **📋 HANDOFF WRITTEN — `qa/HANDOFF-reader-fit-supply-sweep-2026-08-06.md`** (paste-able
> prompt, line-exact anchors for all 15 queue rows, the S1 fix template, per-slice gates
> incl. the **curator A/B recipe**, and the scope fence). A fresh session can take S2 from
> that file alone. **It also carries a MEASURED, un-queued finding:** the astronomy domain
> violates `generationContext.ts:68` (*"NEVER parse grade out of `gradeContext` prose"*)
> **10 generators out of 10** — day-night-seasons 13 dead comparisons, moon-phases-lab 10,
> mission-planner 7, scale-comparator 7, orbit-mechanics-lab 4. Confirmed bite on S2:
> `gemini-orbit-mechanics-lab.ts:554/556` use `gradeLevel >= '3'` against prose, and
> `'e' > '3'` lexically, so **orbital burns and gravity field lines are ON at Kindergarten
> today** while `showOrbitalPeriod` (`:551`) is unreachable at every grade. Same `14m` class
> telescope-simulator carried; the sweep is surfacing it domain-wide, exactly as the FF-1 and
> DNA-1 leak investigations did.
>
> Two follow-ons deliberately left OPEN rather than silently closed:
> telescope-simulator still has **no tutoring block and 0 eval modes at the grades it DOES
> serve** (`/add-tutoring-scaffold`, `/add-eval-modes`).
> **Signal worth acting on:** the post-fix K manifest routed to `planetary-explorer` and
> `constellation-builder` — both flagged in the triage as *no read-aloud, no band gate*. K
> astronomy demand now lands squarely on the Class-B queue, which **raises** S8–S12's priority.

## EXECUTED 2026-08-06 (same day, later) — 15B taken (user-pulled), **S8 CLOSED**

> The user pulled **15B — SCAFFOLD-GAP (8)** directly: *"tap-and-watch primitives that are
> genuinely K-fit and just have no voice."* This is the interleave the handoff recommended
> (option **b**) and the priority raise the S1 routing signal argued for, so the queue was
> entered at 15B rather than draining 15A first. Serial, one primitive per slice.
>
> **S8 `moon-phases-lab` CLOSED — READY at PRE.** Report
> `qa/reader-fit/moon-phases-lab-PRE-2026-08-06.md`. Pre-fix failure reproduced at the
> mechanism first: `tutor-test` returned `{"status":"no-scaffold"}`. Fix = catalog `tutoring`
> block (11 contextKeys, 3 levels, 5 struggles **led by the primitive's own stated critical
> misconception — "phases are Earth's shadow" — which its explanation panel names but nothing
> had ever spoken**, 3 aiDirectives incl. a PRE-READER READ-ALOUD carrying the *"this OVERRIDES
> any one-sentence cap"* clause so it survives the lesson `[PRIMITIVE SWITCH]`) + component
> `useLuminaAI` with 5 moments + 4 read-aloud surfaces + K-1 band gating.
>
> **The slice's real finding: the queued fix would have shipped INERT.** The Tier-2 probe was
> requested at `grade=K` and came back **"Sunlight and the Moon: Grade 3 Space Explorer",
> `gradeLevel:'3'`, `viewMode:'split_view'`** — the `14m` prose-grade class the handoff had
> *measured* on this generator (10 char-compares, 0 reads of `ctx.grade`) but not queued.
> `gemini-moon-phases-lab.ts:223` regexed PROSE `ctx.gradeContext` for `/grade\s*(\d|K)/`;
> kindergarten prose has no "grade N", so it fell through to a literal `'3'`. Because the new
> component band gate keys off `data.gradeLevel`, **a generator that can never emit `'K'` makes
> `isPreReader` dead code** — a green scaffold report over an unchanged child experience. Fixed
> with the S1 template (exported `moonPhasesGradeFromGrade()`, prose kept as fallback) but
> **with NO floor** — unlike S1, this primitive genuinely is K-fit, so K must reach its own rung.
>
> Incidental bug fixed en route: the K/1 jump-to-phase branch rendered the emoji **twice**
> (`🌑 🌑`). Now one large glyph at K-1, `emoji + name` at 2+, locked by a test.
>
> Gates: 12 focused + 15 jsdom tests, **revert-bite 5/12 and 4/15** (both proven by restoring
> the pre-fix logic and watching it fail), tsc **805 = baseline**, typecheck:lumina 0, full
> vitest **1813/1813**, tutor-test Tier 1 `pass` + Tier 2 probe **every var
> `resolvedBy: component`, zero `(not set)`**.
> **Runtime A/B @ K (the gate that decides it): pre-fix `'3' / split_view / "Grade 3 Space
> Explorer"` → post-fix `'K' / from_earth / cycleSpeed 8 / "Peek-a-Boo Moon"`, with G3
> unchanged as the control proving the ladder was not flattened.**
>
> **Cross-queue finding, filed not fixed:** Tier 1 flagged `tagged-sendtext-not-silent` on the
> read-aloud. Checked at the mechanism (`LuminaAIContext.tsx:930-953`) — `silent` suppresses
> only the chat-transcript entry; the socket payload is identical, so a silent send still
> speaks. Engineering Phase A's `readBlockAloud` pattern sends read-alouds **non-silent** and
> evades the static check only by interpolating the tag (`` `${tag} …` ``) instead of a literal
> `[TAG]`, so it posts machine prompts into the conversation as if the child typed them. That
> belongs to `qa/engineering-tutoring-scaffold/BACKLOG.md`, not here.
>
> **Residuals (open):** no Tier-3 live audio run on S8 → HUMAN-CHECKS #73; still 0 eval modes →
> `/add-eval-modes`.
>
> **S9 `classification-sorter` CLOSED — READY at PRE, and the QUEUED VERDICT WAS INCOMPLETE.**
> Report `qa/reader-fit/classification-sorter-PRE-2026-08-06.md`. The triage called this
> SCAFFOLD-GAP — *"tap/drag creatures into groups"*, i.e. the interaction is fine and only the
> voice is missing. The voice was missing, but **the interaction was not fine**: the only
> placement path was HTML5 drag-and-drop, a two-part act a five-year-old cannot execute.
> Three defects closed, **two of them unqueued**:
> **(1) SCAFFOLD-GAP** — catalog block + 6 moments. The load-bearing design decision is the
> answer/question split: for a sorter the RULE and the GROUP NAMES are the *question* (a
> non-reader must hear them repeatedly or the task is unstateable), while the correct group is
> the *answer* — forbidden outright **including by elimination**, with `[SORT_INCORRECT]`
> deliberately never interpolating `correctCategoryId`. Locked by tests asserting the answer
> string is absent from those messages.
> **(2) PRIMITIVE-GAP (unqueued)** — fixed by reusing the **WordSorter PRE precedent** rather
> than inventing: at K-2 ONE item is staged at a time and the group cards become the answer
> buttons, so the two-part drag collapses to tap = choose (rules 2 + 4). Drag is untouched at
> 3-5/6-8, and both protocols funnel through a single `placeItem()` so scoring, feedback and
> the tutor moment cannot drift between bands.
> **(3) Prose-band lookup (unqueued)** — `gradeBandMap[ctx.gradeContext] || '3-5'`: the map is
> keyed on bare grade tokens but indexed with PROSE, so it missed at every grade and the
> `'3-5'` default always won. Probe at `grade=K` returned `gradeBand:'3-5'` with THREE
> categories against a catalog K-2 rung reading *"Binary sorts only (2 categories)"*.
> Also removed `item.imagePrompt` from the render — an image-GENERATION instruction ("a
> red-breasted robin on a branch") was being printed as student copy **at every grade**.
> Gates: 13 + 12 tests, **revert-bite 5/13 and 6/12**, src-scoped tsc **803 vs 804 baseline
> (one fewer, zero new)**, typecheck:lumina 0, full vitest **1853/1853**, tutor-test Tier 1
> `pass` + Tier 2 **14/14 vars `resolvedBy: component`**. **Runtime A/B @ K: `'3-5'` / 3
> categories → `'K-2'` / 2 categories, with G4 unchanged as control.**
>
> **⚠️ TWO METHOD FINDINGS that change how S10–S15 should be worked:**
> **(a) There are TWO grade-blindness mechanisms, and they do not share a grep.** Astronomy
> (S10/S11/S12) uses the S8 shape — regex `/grade\s*(\d|K)/` over prose. Biology (S13/S14/S15)
> uses the S9 shape — a map keyed on grade tokens but indexed with prose. Identical signature,
> different code. **Probe each primitive at `grade=K` before writing anything**; S8 and S9 both
> prove the scaffold fix ships inert on top of a grade-blind generator.
> **(b) The absolute `tsc` count is NOT a usable gate in this lane.** It read 805, then 806,
> then 807 on an unchanged tree. The drift is `.next/types/app/**` — in the tsc program, and
> regenerated by the dev server that these very probes require. Gate on the `src/`-scoped error
> SET diff (`comm -13 baseline current`). A future session comparing against the "805" quoted
> in the S8 report would chase a phantom. *(Same cause surfaced an S8 residual:
> `typecheck:lumina` had been run before the jsdom test file was added, so a `/u`-flag regex
> error in it went unseen; fixed in this slice.)*
>
> **S10 `day-night-seasons` CLOSED — READY at PRE.** Report
> `qa/reader-fit/day-night-seasons-PRE-2026-08-06.md`. **The queued verdict was incomplete for
> the second slice running.** Triage said SCAFFOLD-GAP ("rotate the Earth, watch the light").
> What was actually on a Kindergarten screen: a **free-text `<input placeholder="Type your
> answer..."/>`** — PRE rule 6 — and it was the *entire* assessment, **scoring any non-empty
> string as correct**. A K child who cannot type scored 0; a child who typed "aaa" scored 100.
> It measured nothing at either end. Fixed: typing removed at K-1 (the questions survive as a
> spoken 🔊 prompt), `<select>` → tappable emoji place buttons, degree/hours readouts gated,
> and **scoring moved to the instrument** — spun the Earth, ran it, observed ≥2 places — which
> is *stricter* at K than what it replaced. Plus the catalog scaffold (9 contextKeys, 5
> struggles leading with BOTH misconceptions the primitive exists to correct, and a
> `THE TILT, NOT THE DISTANCE` directive that forbids "closer"/"farther" as a cause *even as a
> thing to reject in passing* — a young child keeps the phrase and loses the correction).
> Third defect, predicted and probe-confirmed: the worst prose-grade offender in astronomy
> (13 char-compares, 0 reads of `ctx.grade`) served **every K rung wrong** — `'3'`,
> `showTiltAxis:true`, 4 markers, 3 objectives, `timeSpeed:5`.
> Gates: 12 + 13 tests, **revert-bite 12/25**, src-scoped tsc **803 = baseline zero new**,
> typecheck:lumina 0, full vitest **1878/1878**, tutor-test Tier 1 `pass`.
>
> **A thing NOT shipped, on purpose.** The catalog first carried a `[EARTH_DAY_NIGHT_FLIP]`
> beat — narrate when the watched place crosses into night. Whether a marker is lit depends on
> angle conventions in the D3 terminator math that I could not confirm visually this session,
> and a tutor confidently saying *"now it's night in New York"* over a daylit screen is worse
> than silence. So `isDaytimeAtMarker` is derived from the SAME expressions the renderer uses
> for the terminator (it cannot drift from the drawn shadow) and reported only on the
> jsdom-verifiable `[EARTH_LOCATION_SELECTED]` moment. **`tutor-test` then caught the dead
> directive tag I had left behind** (`directive-tag-never-emitted`) — rewritten to the tag
> actually emitted. The reading itself is queued for one pair of eyes at HUMAN-CHECKS #73; if
> it is inverted the fix is a single `!`.
>
> **⚠️ PATTERN, 3 slices for 3: the triage's "SCAFFOLD-GAP — interaction is fine, only the
> voice is missing" label has understated the work EVERY time.** S8 sat on a grade-blind
> generator, S9 was drag-only, S10 had typing at Kindergarten. The Class-B risk scores
> (3–8) were a text-proxy read of the catalog, not an Audit C. **Budget the remaining slices
> (S11–S15) for a component band-gate pass, not just a catalog block, and run Audit C rather
> than trusting the triage line.**
>
> **S11 `solar-system-explorer` CLOSED — READY at PRE.** Report
> `qa/reader-fit/solar-system-explorer-PRE-2026-08-06.md`. First slice where the generator's
> **happy path was already correct at K** (probe: `gradeLevel:'K'`, `initialZoom:'inner'`, 5
> bodies) — the prompt carries the audience in prose, which is the one place prose belongs.
> The defect was on the **degrade path**: `getDefaultBodies(gradeLevel)` was handed PROSE and
> its only branch is `=== 'K' || '1' || '2'`, so the K-2 branch was **unreachable** and a
> Kindergartener fell back to all 8 planets instead of the inner 4 — firing only when Gemini
> returned no bodies, i.e. exactly when the lesson was already degraded. **This is the
> `matter-explorer` inline-resolver shape ([[feedback_value-origin-not-code-touch]]): there is
> no named resolver to grep, AND no happy-path probe can reach it** — it is covered by the
> focused test instead, and that asymmetry is the finding rather than a gap in the evidence.
> Scaffold notes: a hard **no-measurements** directive at PRE (the detail card is six numeric
> cells — AU/km/days/hrs/°C/moons — with the replacement register supplied: "the biggest one",
> "really really hot"), dropped at 3-5 where the numbers are the point; plus a **SCALE
> HONESTY** directive, because 2 of the 5 struggles are misconceptions *the layout itself
> invites* (planets look lined up, look close together). Six categories of adult chrome gated
> at K-1, all kept at 3-5.
> **Reusable lesson: the first gating attempt used Tailwind `hidden` and the jsdom test failed
> it — correctly. CSS-hidden is NOT gone**; the text stays in the DOM and reachable by
> assistive tech. Conditional render is the only thing that satisfies rule 7.
> Gates: 12 + 13 tests, **revert-bite 5/13**, src-scoped tsc **803 = baseline zero new**,
> typecheck:lumina 0, full vitest **1903/1903**, tutor-test Tier 1 `pass`.
> *Residual worth knowing:* this primitive has **no evaluation hook at all** — pure explorer,
> so band-contract rule 8 is N/A rather than passing. `planetary-explorer` is the measured
> cousin if K astronomy ever needs a scored solar-system activity.
>
> **S12 `scale-comparator` CLOSED — READY at PRE, and it carried the most complete
> prose-grade instance in the whole sweep.** Report
> `qa/reader-fit/scale-comparator-PRE-2026-08-06.md`. This is the only one where the prose
> **escaped the generator and reached the component**, via
> `gradeLevel: gradeLevel as 'K'|'1'|…|'5'` — **a type assertion that silenced the compiler at
> exactly the boundary being violated.** Probe @ K returned
> `gradeLevel: "kindergarten students (ages 5-6) - Use clear language…"` alongside
> `showRatios: true` against a catalog rule reading *"showRatios should be false for K-1"*.
> Four live consequences: `getGradeConfig`'s `switch` never matched (every grade got the
> default rung); the prompt's audience line rendered as *"…for Grade kindergarten students
> (ages 5-6) - Use clear… students"*; all six per-grade prompt blocks were unreachable; and
> **the component's own pre-existing `formatNumber` K branch had never once run**, because the
> field it compares against held a sentence — meaning any band gate I added there would have
> been dead on arrival. That is the transferable lesson: **an `as` cast at a module boundary
> can propagate a contract violation into a second file where nothing looks wrong.**
> Also: catalog scaffold whose real job is a **non-numeric comparison register** ("much
> bigger", "tiny next to it") since the whole primitive is about magnitude a pre-reader cannot
> read; five categories of numeric chrome gated at K-1, with the "3.7× larger" ratio panel
> gated in the COMPONENT as well as the generator (tested by passing `showRatios:true` at K
> and asserting it still does not render).
> **A React footgun the test caught:** the object-added cue decided add-vs-remove with a flag
> assigned INSIDE the `setState` updater and read immediately after — React runs functional
> updaters during render processing, so it was always `false` and the cue never fired. Decide
> from the current render's state.
> Gates: 13 + 13 tests, **revert-bite 11/26**, src-scoped tsc **803 = baseline zero new**,
> typecheck:lumina 0, full vitest **1929/1929**, tutor-test Tier 1 `pass`. Runtime A/B @ K:
> prose → `'K'`, `showRatios` true → false, G4 control unchanged (and gains `interactiveWalk`
> + 5 objects).
>
> **Portfolio note worth a decision:** S11 and S12 both turned out to have **no evaluation
> hook at all** — pure instruments, so band-contract rule 8 is N/A rather than passing. Two of
> the eight 15B primitives cannot measure anything. Either they get `/add-eval-modes` or they
> should be declared exploration-only so the manifest stops routing assessment demand to them.
>
> **S13 / S14 / S15 CLOSED — and with them 15B is COMPLETE, 8/8.** Reports:
> `qa/reader-fit/{life-cycle-sequencer,habitat-diorama,organism-card}-PRE-2026-08-06.md`.
> - **S13 `life-cycle-sequencer`** — lowest triage risk in the class (3) and still needed a
>   component pass. The answer is an ORDER, so the scaffold forbids naming any position or
>   confirming a placement pre-check, and draws the line explicitly (describing what happens IN
>   a picture is stimulus and free; saying where it goes is the answer). Select-then-target
>   collapsed to **one tap places** at K-2. `imagePrompt` removed as student copy at every
>   grade. **The band resolver was EXTRACTED to `service/biology/gradeBand.ts`** rather than
>   copied a third time, with S9 re-pointed at it. Runtime A/B changed the *register*: K went
>   from *"The female butterfly lays a tiny egg on a milkweed leaf…"* to *"A mama butterfly
>   lays a tiny egg on a leaf. It is so small you can barely…"*.
> - **S14 `habitat-diorama`** — the most instructive shape: the component was **already written
>   band-aware, with five `gradeBand !== 'K-2'` gates that had never run**, because the
>   generator never emitted `'K-2'`. Most of the PRE improvement came from deleting one broken
>   lookup. Also: the roles legend was gated **backwards** (hid each role's description, kept
>   the five technical terms — jargon with its explanation removed), and the organism buttons
>   had **no accessible name at all**.
> - **S15 `organism-card`** — the scaffold's first draft promised "tap a fact to open it" and
>   `tutor-test` caught the tag as dead, because the fact boxes were static divs. Made it TRUE
>   rather than deleting it, since *size* and *locomotion* otherwise had no spoken twin. Fifth
>   and last copy of the prose-keyed map removed — **no fifth resolver written**.
>
> **What 15B actually was.** The triage label — *"interaction is K-fit, only the voice is
> missing"* — **understated the work 8 times out of 8**. It was true of the core mechanic every
> time and false about the screen every time: S9 was drag-only, S10 had **typing at
> Kindergarten** scored by any non-empty string, S11 had six classes of chrome around the tap,
> S12 printed kilometres and ratios, S13 was a two-act ordering protocol, S14's own gates were
> dead, S15 had no way to hear any of its five facts. **And every one of the eight sat on a
> grade-resolution defect** (seven outright, plus S11's degrade path) — the scaffold fix alone
> would have shipped inert in all of them. A supply-side triage read from catalog text cannot
> see chrome, protocol, or a grade-blind generator; only an Audit C plus a probe at the band
> can. **Do not trust a Class-B style label for 15A or any future sweep — budget every slice
> for a component pass.**
>
> **Reusable lessons, now in the reports:** CSS `hidden` is not gone (text stays in the DOM and
> reachable by AT); a component containing band-gating code is not evidence that gating
> happens; an `as` cast at a module boundary propagates a contract violation into a second file
> where nothing looks wrong; a `primitiveData` bag assembled behind local statements makes
> `tutor-test` report every key as "dynamic — verify at runtime", turning a real check into a
> shrug; never set a flag inside a `setState` updater and read it after; and the absolute `tsc`
> count is unusable while the dev server runs (`.next/types` churn) — gate on the `src/`-scoped
> error SET diff.
>
> Cumulative gates across the 8 slices: **1978/1978 vitest** (up from 1801 at S1), src-scoped
> tsc **803 vs the 804 baseline**, typecheck:lumina 0, tutor-test Tier 1 `pass` on all eight,
> and a runtime K-vs-control A/B on every one.
>
> **Open across the class:** no Tier-3 live audio run on any of the 8 → **HUMAN-CHECKS #73**
> (one sitting covers all three primitives listed there; the S10 day/night reading is the only
> genuinely open question in it). **S11, S12 and S15 have no evaluation hook at all**, so rule
> 8 is N/A rather than passing — either `/add-eval-modes` or declare them exploration-only so
> the manifest stops routing assessment demand at them. **All 8 still have 0 eval modes.**
>
> **📋 HANDOFF WRITTEN — `qa/HANDOFF-reader-fit-2026-08-07.md`** (the 08-06 one is marked
> SUPERSEDED in-file; its anchors went stale when 15B's tutoring blocks shifted every catalog
> id). The successor carries re-derived anchors, a per-item prediction of which
> grade-blindness shape each remaining generator has, the proven per-slice recipe, the
> corrected tsc gate, the seven traps, and the ranked frontier beyond item 15. A fresh session
> can take S2 from that file alone.
>
> **Two findings in it worth surfacing here, because both contradict "assume the pattern":**
> **`story-planner` (S4) is already CLEAN** — it reads `ctx.grade` canonically with an explicit
> contract comment, so a blanket "assume the defect" heuristic would have produced a pointless
> diff. And **`bio-compare-contrast` (S5) has a FOURTH shape**: `gradeBand` is a function
> parameter defaulting to `'3-5'`, so the defect (if any) lives at the **call site** and a grep
> for the other three misses it entirely. Predict from the code, confirm by probe, fix only
> what the probe shows.
>
> **Next pull: 15A S2 `orbit-mechanics-lab`** → S3 → S5 → S6 → S7 (S4's generator needs no
> fix; its band-floor question is catalog-only). Nominally cheaper per slice — catalog band
> floor, no component work by design — but that is the same shape of claim 15B disproved 8/8,
> so verify per primitive.
> **Then audit `planetary-explorer` + `constellation-builder`**, which are NOT in item 15
> (they have a channel) but now carry the K astronomy demand that S1's floor and 15B's fixes
> redirected onto them — the most likely site of the next real K failure.

## Prior snapshot — reconciled 2026-08-06 (**BUILD PIVOT — user-pulled; stream since CLOSED-BY-EXTEND, see above**)

> **`/pm` 2026-08-06 (late) — the portfolio was starved of BUILDABLE work, and that was
> structural, not a discipline failure.** The user's read — *"we've been doing lots of eval
> tests, contract work etc, but we need to make some real progress on real primitives"* — is
> confirmed by the queue tops: **LA K-2 Grammar's top was a DESIGN RULING** (item 1b,
> viewer-relative prepositions), **the DI lane's own row said "no unblocked top item — next
> pull is a development item to author with the user"**, and the opportunistic lane was
> **evidence closure**. Three streams, zero buildable tops. `/pm` opened a build stream.
>
> **NEW ACTIVE: K-1 Literacy Fluency — `sight-word-trainer` BIRTH (GAP-008), user-pulled.**
> Executor `/primitive` (L0), then the lifecycle ladder. Rationale: the gap tracker calls it
> *"the widest curriculum ROI of any unbuilt primitive in the K-1 literacy stack"* — sight-word
> automaticity is a prerequisite for fluent reading of any connected text, so every
> `decodable-reader` and read-aloud session is enhanced by it. **The decisive argument is
> capability timing:** this primitive needed a speak-and-be-judged loop the platform did NOT
> have when GAP-008 was written (2026-04) and now DOES — `useSpokenWordCapture` (Azure
> dual-signal → flash-latest), `LuminaMicListener`, and session-wide open mic from the
> `9d08687` voice-transport unification. Automaticity is measured in response latency on a
> spoken word; it no longer has to ship as a tap-only proxy. Serves LA001-07-a/b + LA005-08-a
> at K with cross-grade reach to G2.
>
> **WIP kept at 2+1 — the DI / voice lane is PARKED to make room.** It is the right one to
> park: its queue top is unauthored, and its live residuals (**HUMAN-CHECKS #63 bench sitting,
> #64(b) real-child drive, #65 calibration spread, #70, #71**) are all **user-only** gates that
> a Claude session cannot close anyway. Parked as of 2026-08-06 — **CTX-1 (item 13) landed
> first** (`a55c674`, `b87dd8b`, `aab8260`: the three recitable maxims the tutor read aloud to
> a child were deleted outright, per the user ruling to delete the channel rather than tune the
> gate). Resume condition: the user runs a mic session, or authors the next development item.
>
> **STALENESS SWEEP — `qa/PRIMITIVE_GAPS.md` had not been touched since 2026-04-01 and its own
> #1 and #3 priorities were ALREADY BUILT.** Re-verified every gap against the LIVE catalog
> (`service/manifest/catalog/*.ts`) rather than the dashboard: **GAP-010 `word-sorter` CLOSED**
> (catalog + component + generator + tests; the LA lane's open item against it is an eval-mode
> add, not a build) and **GAP-007 `coin-counter` CLOSED** (catalog + component + generator +
> a derived contract; it has since consumed multiple build slices). Totals corrected to
> **12 CLOSED / 7 OPEN**. Verified-still-missing: `sight-word-trainer`, `letter-tracer`,
> `book-explorer`, `capacity-lab`, `erosion-explorer`, `landform-mapper`,
> `earth-changes-timeline`, `bar-graph-builder` (the G2 Earth Science trio has **zero
> references anywhere in the repo** — genuinely unbuilt and unwired).
>
> **NEW FINDING, no register owned it — a DEPTH deficit larger than the gap list.** Measured
> against the live catalog: primitives carrying `supportsEvaluation: true` with **no
> `evalModes` block** are built and generating content but **invisible to the IRT selector**.
> **biology: 17 primitives, 0 eval modes — the entire domain at L0**; engineering ~19 at L0;
> astronomy ~8; core ~12. Biology is the sharpest case because the 2026-06-28 science sweep
> already fixed 11 of those generators for topic/intent fidelity — they honor an objective and
> produce good content that cannot be adaptively routed. This is CLAUDE.md's priority #3
> verbatim. **Recorded in `qa/PRIMITIVE_GAPS.md` under "Not a gap — a DEPTH deficit."**
> Executor `/add-eval-modes`, serial, pilot-then-sweep. **Honest caveat carried:** biology
> skews secondary (`protein-folder`, `dna-explorer`, `evolution-timeline`), so K-5 demand is
> likely thinner than 17 suggests — run a demand check before committing the domain.
> Offered to the user this run and **not** chosen; it is the standing next candidate.
>
> **UNSHIPPED, flagged: the `addition-subtraction-scene` item-12 work** (4 files, ~200 lines)
> is browser-verified with a 10-check real-Chrome run and has **no commit**. G1 `act_out`
> forked by operation — subtraction becomes an enacted scene, and the ten-frame answer leak
> (it mirrored stored `resultCount` on enacted scenes) is closed. Ship it as its own slice;
> it does not collide with the sight-word build, which lands new files plus a `literacy.ts`
> catalog entry.

## Prior snapshot — reconciled 2026-08-06 (**ship reconcile — 4 clusters uncommitted**)

> **`/pm` 2026-08-06 (evening) — EVERYTHING SHIPPED, AND THE TWO GATES CLOSED.** The
> four clusters below are committed and pushed (`a695574..f391cca`), and the user drove
> the browser in the same session: **HUMAN-CHECKS #69 struck** (the props-are-data repair
> verified in the lesson path — the only place it ever failed) and **#64 struck including
> criterion (b)**, with the dev backend confirmed restarted onto the fix first. That closes
> **DI BACKLOG item 11 end-to-end** and retires the last residual of the voice-transport
> unification `9d08687` apart from #65. **The DI lane's queue now has no unblocked top
> item — its next pull is a development item to author with the user.**
> **#63 was then RUN the same evening — and still does not close.** The `Counting to
> 120` bench probe drove 4 of 10 items, answered every one CORRECTLY, and stopped at
> `count-13`, so **none of #63's three criteria were exercised** and **no multi-word
> numeral was ever spoken** — the class the row exists to bench. Correct answers being
> affirmed cannot distinguish a discriminating judge from a permissive one; criterion
> (a) exists precisely because it needs a *deliberately wrong* answer. Banked as real:
> a clean **negative control** (thirteen not heard as thirty in either direction) and
> a steady `commitLagMs` ~1220. **DI item 10 stays BLOCKED.** New blocker **DI-120-1**
> (DI BACKLOG item 12): two noise blips at peak 0.018 opened turns over tutor audio,
> anchored EMPTY attempts and burned `count-39` without the user ever answering it —
> the barge-in bar (0.0108) sits below this device's leakage while real speech peaked
> 0.045–0.116, so 0.025–0.03 separates them cleanly. **Fix that before re-running.**
> Report `qa/di-bench/run-2026-08-06-counting-120-probe.md`. #70/#71 also stay open.
>
> **⚠️ CTX-1 — SAME-DAY REGRESSION IN `d895bfb`, user-reported from a live session
> 17:02 (DI BACKLOG item 13, now the lane's TOP pull).** The tutor spoke a
> self-directed stage direction aloud to the child — *"Silence is the invitation to
> keep exploring, not a question from the student. Wait for them to take the next
> step…"* — a **verbatim recitation of the style rule at `lumina_tutor.py:563`**,
> spliced with the new carve-out's vocabulary. Cause: `ContextUpdateGate`'s
> `MAX_HOLD_S = 8.0` force-releases a parked context update **without checking
> whether the tutor is still speaking**, and normal turns exceed 8s (item 11's own
> live report logged 8.2 / 8.4 / 14.5 / **20.5**s). So the gate built to prevent
> self-inflicted barge-ins causes one on every long turn; the landed update then
> hands Gemini the floor and, with nothing to answer, it reads the prompt out loud.
> **Same class as item 11's original defect and its `(not set)` rider** — internal
> machinery reaching the child's ears. **`/pm` reporting miss owned:**
> `ContextUpdateGate` was added in `d895bfb` and described in neither the commit
> message nor the slice report.
> **REFRAMED SAME DAY BY USER RULING — severity MEDIUM, and the fix is DELETION.**
> `/pm`'s first call (tune the gate's expiry) was treating the symptom. The user's
> read: *"this feels like we just reminded the tutor to talk when this capability
> wasn't actually necessary — can we make this more parsimonious?"* The code itself
> concedes the point at `:1039-1042` — it forwards every slider tick over a transport
> that **structurally cannot be silent**, then spends prompt budget telling the model
> to **ignore** what was just sent. So: stop pushing state; hold it server-side and
> prepend it to messages that already give the model the floor; make the struggle
> exception an explicit cue rather than a hope that the model notices. That makes the
> symptom unreachable, shrinks `ContextUpdateGate` toward deletion, and should retire
> most of the **9-of-17 self-caused barge-ins** its own docstring measured.

> **`/pm` 2026-08-06 — the portfolio is TRUTHFUL but UNSHIPPED.** Nothing has been
> committed since `a695574` (12:43) and the working tree holds **four independent
> clusters, ~2,200 added lines across 55 files**. Three are fully evidenced and recorded
> (fast-fact answer contract, DI item 11 lesson-tutor, plus their registers); the fourth
> had **no record anywhere** and is now written up below as "One-off, UNREPORTED".
> Whole-tree gates measured this run: **full Vitest 1768/1768**, **tsc 803 = baseline**
> (`/pm` cleared the 3 stray errors that were sitting above it). The portfolio's own
> risk right now is not correctness — it is that ~2,200 lines of verified work is
> one `rm -rf` or bad `git checkout` away from gone, and that a cold session reading
> `git log` sees none of it. **Ship first, pull next task second.**

## Prior snapshot — reconciled 2026-08-05 (**2nd pass, post-`bd1c535`**)

| Lane | State | Pull now | Ground truth |
|---|---|---|---|
| LA K-2 Grammar density (spatial-scene prepositions) | ACTIVE — top slot, user-pulled 2026-08-05 (item 1 CLOSED-BY-SPLIT 08-05 latest) (item 1 CLOSED-BY-SPLIT 08-05 late) | **Queue of record now SEEDED: `qa/la-k2-grammar/BACKLOG.md` (top = next).** Handoff Phases 0-3 EXECUTED 2026-08-05. **Queue RENUMBERED 2026-08-05 evening by `bd1c535` — a new item 2 was inserted, so every pointer below shifted by one (this row was stale until `/pm` re-reconciled it).** Current order: **item 1 `spatial-scene` containment/two-reference prepositions** (`in` / `between` / `in front of`-`behind`, 4-5 subskills) — contract **C2 OPEN** names the class; **`in` inverts contract R11** (`place` targets an EMPTY cell; `GridScene` only offers the tap affordance on empty cells) so read R11 before touching, and `in_front_of`/`behind` need a **design ruling before code** (viewer-relative is ambiguous in a top-down grid). **~~item 2 (contract C3, `above`/`on` ambiguity)~~ CLOSED 2026-08-05 late — see the ACTIVE section; it was a MEASURED 4/18 failure, now 0/36, promoted to contract R12, and its probe caught a second rule-#1 leak (answer at `options[0]` in 18/18)**. Then item 3 (path words through/around/across — the one preposition sub-cluster fit-first does NOT resolve into spatial-scene, likely a real birth), item 4 (word-sorter K picture-pair mode, 3 subskills), item 5 (Sentence Mechanic BIRTH, 4 — run `/curriculum-fit` FIRST), item 6 (**draft-first** re-target of the 11 already-served subskills), item 7 (sentence-builder @ K, the biggest EXTEND at 9 subskills — wants its own contract-first slice), item 8 (Conversation Studio — 16 grammar + most of LA005/LA003/LA007; a **lane DESIGN decision**, not a grammar item; do NOT force these into tap-primitives). Serial, one item per slice. **Item 2 CLOSED, then item 1 taken and SPLIT 2026-08-05 (latest): `in` + `between` SHIPPED as their OWN eval modes — `place_in` (β 1.5; **R11 INVERTED**, the answer is the cell the container OCCUPIES) and `place_between` (β 3.5, judged from TWO references). A **FORK, not an edit** (ladder rung 1), so `place`/R11 and the math K.G.1 window are byte-for-byte unchanged — neither word joins the position window at all (new **R15**). Contract **C2 OPEN → PARTIALLY RESOLVED**. The curator now routes LA004-05-B → `place_in` and LA004-01-F → a 3-mode blend unprompted; that routing probe also caught a real defect — a **blend pin resolving to null**, generating all six modes (a 17-challenge session). Gates: 27/27 real-Gemini clean incl. a math control, focused **49/49** (3-of-49 bite), a **NEW jsdom component drive 8/8** (2-of-8 bite — pre-fix the correct containment answer was *literally unclickable*), Vitest **1670/1670**, tsc **803 = baseline**. **Top is now item 1b (`in_front_of`/`behind`) — a DESIGN RULING, not code**; buildable alternatives are item 2b or item 4.** | **Phase 0/1 DONE — census of record is `qa/la-k2-grammar/census-2026-08-05.md`; it SUPERSEDES the 07-04 demand map.** Three corrections measured off the live published curriculum: (1) the count is **138, unchanged** — and it *cannot* shrink from primitive builds, because `target_primitive` is a **stored curriculum field**, so the handoff's "may have shrunk since word-sorter/sentence-builder shipped" premise is wrong by construction; (2) grammar is **50**, not ~37; (3) **131 of 138 are Kindergarten** (7 at G1, 0 at G2) — the pre-reader contract governs essentially the whole lane. Triage: 11 ROUTE / 19 EXTEND / 4 BIRTH / 16 TIER-3-by-design. **Phase 2 pilot CLOSED — and it was an ANTI-DUPLICATION CATCH.** The handoff's headline predicted birth ("Preposition/Spatial Scene") **already existed**: `spatial-scene`, `catalog/math.ts:3743`, fully built at L3 (4 eval modes + support tiers + ctx-native scope), invisible to the 07-04 map only because it is filed under **math**. Verdict flipped BIRTH → EXTEND before any code was written. Measured defect: the curator genuinely routes LA prepositions here and its own intent said *"Put the ball UNDER the table"*, but the generator's hardcoded K window ("ONLY above, below, beside, next_to" — the math K.G.1 vocabulary) silently overrode it and emitted above/below/beside ([[trust-intent-over-hardcoded-caps]]). Fixed with the **14l resolver template** — one temperature-0 schema-bound call resolves the lesson's named position words, UNIONed with the band default (**widens only**), and only in-window words get grid semantics stated so the LLM is never invited to emit a relation the checker cannot judge; `on`/`under` are CONTACT-scoped vs `above`/`below` any-distance — that contrast IS the LA skill. Math K.G.1 byte-compatible (no request → band default). Contract derived first (11 R, **C1 RESOLVED via the config-axis rung**, C2 open) + catalog projection applied (the 06-07 curriculum-fit sweep had already flagged this entry 0.766 "diffuse"). Gates: focused **15/15** w/ **2-of-15 revert-bite**, full Vitest **1,628/1,628**, typecheck:lumina **0**, tsc **803 = baseline**, real-Gemini census replay serves on/under/beside with placements matching the injected rule EXACTLY, math replay 11 challenges / 4 modes / **0 out-of-window**. **Honest residual: the 138 demand number did NOT move** — this made the primitive *able* to serve 7 subskills; converting demand needs the draft-first re-target (BACKLOG item 5), deliberately not entered (`curriculum_published` read-only throughout). No browser check (no component change shipped). Reports `qa/la-k2-grammar/{census,spatial-scene-prepositions}-2026-08-05.md`. **Second slice the same day (`bd1c535`, 18:52) — the routing re-probe the pilot skipped, and it came back CLEAN.** The catalog projection landed AFTER the pilot's last routing probe, so the description/`constraints` rewrite — the only text the manifest curator routes on, and it now names words to keep OUT — had never been re-verified. Both preposition subskills re-probed: **LA004-05-B still routes here and now claims TWO instances** (`place` + `follow_directions`, was one), with the curator's intent shifted off the unsupported `in` onto the supported window — the projection working as designed; **LA004-01-F still routes** and its `between` ask **saturated honestly** (3 `place` challenges, every placement rule-correct, zero out-of-window words in any judged field). Routing held and tightened; the re-probe's by-product was contract **C3** (queue item 2). **Evidence-hygiene note recorded by `/pm`:** that slice shipped no report file, so its evidence lives only in the commit message + the contract changelog — a future session has to `git show bd1c535` to find it. **Reader-fit K → EMERGING stays PARKED as of 08-05: queue fully drained** (14a–14m all closed; re-seed via a new band census when wanted) | **14l CLOSED + SHIPPED 2026-08-05**: flashcard-deck honors a requested review count and refuses untaught vocabulary; the K community-helpers census instance closed as a rider. Contract derived + C1/C2 resolved, `--check` COMPATIBLE. Focused 20/20 w/ revert-bite; full Vitest **1,589/1,589**; typecheck:lumina 0; tsc 803 baseline. Prior: 14j `f4147ef` + 14k `1fbf4a1` SHIPPED 08-05. |
| Direct Instruction family → session voice | ACTIVE | **14g `counting_next` CLOSED 2026-08-05** (handoff executed in its own session): the "within 120" → "within 12" parse bug is fixed, so a G1 counting ask now saturates at the benched twenty instead of collapsing to twelve — real-pipeline 5/5, 12 new tests w/ 4-of-6 revert-bite, full Vitest **1601/1601**, typecheck:lumina 0, tsc 0 new. User chose **Option B**, so the 1–120 extension is **DI item 10, BLOCKED on standing gate 1** (multi-word numerals = unbenched response class); its probe set "Counting to 120" is wired and the ~30-min sitting is **HUMAN-CHECKS #63** — a genuine fork gate, not pixel debt. Report `qa/tutor-reports/di-math-facts-14g-2026-08-05.md`. **VOICE TRANSPORT UNIFICATION SHIPPED `9d08687` 2026-08-05 — ALL FOUR charter phases, same day it was un-parked**: session-wide open mic (every lesson authenticates `manual_activity`, provider-owned turn authority, judged DI subscribes), calibration beat, contextual close-timing + viewport claim, refer-back journey live PASS 3/3 real Gemini sessions. Students can now natively speak to the tutor on any lesson section. **Residual = HUMAN-CHECKS #64 (mixed-lesson mic acceptance drive) + #65 (calibration hardware spread) — the user driving their own feature is the gate. Lane pull = author the next development item with the user** (#63 bench sitting unlocks DI item 10 counting-to-120; new pack in a benched class; voice-aware expansions now that the transport exists). **AUTHORED 2026-08-05 late — queue TOP is now item 11 (user-pulled): lesson-tutor curiosity-question deflection + resume continuity**, opened from the first real-child mixed-lesson drives (the #64 shape in the wild; **#64(b) FAILED** — a kid's "are they going to build a bunch of apartments?" got machine-profile's level1 scaffold line back verbatim; root cause = unscoped "never give direct answers" in `build_lesson_system_instruction`). **✅ ITEM 11 MACHINE HALF DONE 2026-08-06 (same-day user pull):** carve-out shipped in both builders + `[SESSION RESUMED]` steering + all three riders + `LUMINA_FAULT_DROP_S`; gates = pre-fix journey FAILED ≈50%/judged beat (non-vacuity; keyword anchors alone false-passed, so the harness gained a temp-0 LLM judge), post-fix `lesson-curiosity --runs 3` PASS zero findings, resume probe PASS non-vacuous (drop fired mid-reply, resumed 350ms, `resume-steering mid_turn=true`, no re-greet), units 22/22 w/ revert-bite. **Residual = the user's real-child #64(b) drive — restart the dev backend first (it ran pre-fix code all slice).** Slice report `qa/tutor-reports/lesson-tutor-item11-2026-08-06.md`; review `qa/tutor-reports/lumina-session-review-2026-08-05.md` | Focused 51/51, full Vitest 1,613/1,613 combined, typecheck:lumina 0, refer-back pytest + live 3/3. Item 2 closed (Probe G 11/11, full Vitest 1,569/1,569). **Item 6 DEPRIORITIZED by user ruling 08-05** — imperfect free-form calibration accepted; NO hardcoded grade guardrails in retrieval (pure-IRT family ruling); standalone-only exposure. Item 9 Tier 2 stays demoted-but-queued. Focus per user 08-05: active development — primitives, DI packs, audio/spoken modalities are the foundation. |
| Support tiers (non-math) | OPPORTUNISTIC (+1) | **Batch-3 verification/report closure** via `/eval-test` — **SERIAL, one primitive at a time (user ruling 08-05)**; no Workflow fan-out; append the report + strike per item so an interrupted session lands its progress | Commit `effc7a6` wired batch 3, taking the code surface to 31/36. Required per-item real-Gemini evidence and the batch report are still missing; HUMAN-CHECKS #60/#62 are non-blocking. |
| Delegated lane | NONE | — | No residual delegated report needs folding. |

**One-off closed 2026-08-06 — `fast-fact` answer contract (no lane needed; owning register
was `qa/EVAL_TRACKER.md` throughout).** A field-reported leak (a live "Super Counting Within
20" lesson rendered `text-large "7"` over *"Which number is shown here?"* with options 6/7/8)
turned out on `/oracle-test` to be the primitive's default behaviour in **every subject it
serves** — Math 6 / Language Arts 24 / Science 15 answer-leak violations across 5 runs each,
0% flakiness. `/eval-fix` closed FF-1 (CRITICAL) + FF-2 (HIGH) and promoted the missing
invariant to **SP-29 (representation shift)**. The load-bearing half was the *prompt*, not
the guard: "show the word, pick the word" is identity-shaped by construction, so a code guard
alone would have emptied the sight-word drill rather than fixed it — the LA drill that leaked
10/10 now generates 10/10 clean sentence-completion items. Re-running the same matrix:
**4/4 PASS, 197 challenges, 0 violations, 0/5 flakiness**. The re-test also caught a defect
nobody had queued (**FF-3**): pushing counting items off numerals onto emoji exposed SP-8 —
flash-lite keyed 10 over seven emoji — closed structurally with a `visualRepeat` count the
model can get right plus code that repeats the glyph. Gates: focused **37/37** with a
**13-of-37 revert-bite** (every guard disabled in turn), oracle seeded suite 25/25, full Vitest **1768/1768**,
typecheck:lumina 0 from this work, tsc **806 = 803 baseline + 3 pre-existing** in another
session's untracked `gemini-number-line.session-distinctness.test.ts`. Reports
`qa/eval-reports/fast-fact-2026-08-06.md` + `qa/oracle-test/fast-fact-2026-08-06.md`.
**Residuals, honest:** (1) the oracle's leak checks are now regression detectors for the
guard rather than independent findings; (2) **no browser look** at a K counting drill
rendering 19 emoji in the `text-5xl` visual box — the 25-glyph cap is a guess →
**HUMAN-CHECKS #68**; (3) reject-only (user ruling, no retry) can ship a short
drill on a leak-heavy topic — measured 9-10 items, but a total leak throws; (4) **FF-4 stays
open** — `fast-fact` is still L0 with `supportsEvaluation: true` and no `evalModes`, so it is
unrouteable by difficulty (`/add-eval-modes`); (5) **TU-1 stays open** by user ruling.

**One-off, UNREPORTED — found uncommitted by `/pm` 2026-08-06; the portfolio had NO
record of it.** A fourth cluster of 08-06 work sat in the working tree with no report
file, no queue row, and no WORKSTREAMS entry — evidence lived only in code comments and
two contract changelogs. Recorded here because a future session would otherwise have to
read the diff to find it. Four independent fixes:

1. **PLATFORM — the props-are-data render bug (the significant one).** Eight primitives
   were declared `React.FC<XData> = (data) => …`, i.e. props ARE the data, while EVERY
   renderer mounts a primitive as `<Component data={…} index={…} />` (ManifestOrderRenderer,
   PrimitiveRenderer, PracticeManifestRenderer, PulseActivityRenderer). Each therefore
   rendered **perfectly on its standalone tester** — which spreads the fields across props —
   and had `data.<anything>` undefined the first time it landed in a **real lesson**.
   Affected: the **whole DI family** (letter-sounds, word-reading, sentence-reading,
   math-facts), **calendar-explorer**, **timeline-builder**, **equation-workspace**.
   `PrimitiveConfig.component` was `ComponentType<any>`, which is what let them register
   cleanly; it is now typed to the `{ data, index? }` platform contract, so the class is a
   **compile error going forward** — the load-bearing half of the fix. Components with
   extra props (`onRowClick`, `totalCards`, `index`) must keep them OPTIONAL to stay
   assignable; ConceptCard/FeatureExhibit/GenerativeTable were adjusted for exactly that.
2. **base-ten-blocks answer channel.** The keypad is removed from `build_number` and
   `regroup` — wherever the target value is already on screen, typing it is transcription,
   not place value. Both are now judged from the built columns, with a `nonstandard`
   verdict (12 unit cubes total 12 but never show the ten) routing the student to the trade
   instead of scoring correct. `read_blocks` + the operate modes keep the keypad, where the
   number genuinely is not on screen. Tutor gains a `[CHANNEL]` clause so it never coaches
   a keypad that isn't rendered.
3. **number-line R9 + number-sequencer R9 — two field-reported session-shape bugs.**
   number-line: `reshapeOrderSet`/`reshapeBetweenPair` scored the POOL and returned the
   single best set, never reading their per-challenge argument — so an easy-tier G1
   "Counting within 20" order session rendered **12, 15, 17 four times**. number-sequencer:
   the hard-tier reshaper rebuilt `order-cards` as `[...set.slice(1), set[0]]`, i.e. the
   sorted set rotated by one, so the task was **solvable from layout** (a rule-#1 leak that
   read as a rendering bug). Both fixed with regression pins; the number-sequencer oracle
   gained the `answer-leak` rule that would have caught it. Evidence is in the contract
   changelogs (`docs/contracts/number-line.md`, `number-sequencer.md`), not a report.
4. **Two small guards.** `curator-brief` hook badge: flash-lite returned a WORD ("marbles")
   into a `text-5xl` glyph slot, so the model now picks a theme from an enum and code
   attaches the emoji (`utils/hookVisual.ts`) — the standard words-to-a-menu split.
   `LuminaAIContext.sendText`: identical cues within 50ms are dropped — StrictMode's
   double-invoke shipped every `[ANSWER_CORRECT]` **twice**, and the duplicate barged in on
   the turn the first copy had just started, clipping the tutor mid-sentence.

**Gates (measured by `/pm`, whole tree): full Vitest 1768/1768, tsc 803 = baseline.**
`/pm` fixed the one thing blocking that baseline — the untracked
`gemini-number-line.session-distinctness.test.ts` carried 3 `TS18048` errors on an optional
`challenges`; narrowed once through a `challengesOf` helper that asserts rather than
defaulting to `[]` (an empty default would pass every distinctness assertion vacuously).
That file's 7/7 still pass.

**✅ ITEM 1 RUNTIME-VERIFIED 2026-08-06 (evening) — HUMAN-CHECKS #69 STRUCK.** The user
drove ~15 minutes in the browser: *"worked great, DI worked great, each lumina primitive
worked great."* The DI half is the strongest evidence — those packs must mount, receive
content AND drive the judged mic loop, which a silently-undefined `data` could not have
survived. `ac2d342` moves from "machine-verified, needs a browser check" to **verified**.
Lesson recorded as [[tester-green-lesson-broken]]. **#70 and #71 stay OPEN** — neither was
named in the drive, and a general "the lesson worked" is not evidence for base-ten-blocks'
nonstandard-build rejection (you must deliberately build 12 as twelve unit cubes) or for
the curator-brief hook badge being a glyph rather than a word.

**Honest gaps, all QUEUED not fixed:** (a) ~~no runtime verification of item 1~~ **CLOSED
above 2026-08-06**; (b) **no regression pin for the
platform contract itself** — nothing fails if the next primitive is written props-are-data
and registered through an `any` escape hatch; executor `/primitive` (checklist) or a
registry-shape test; (c) base-ten-blocks keypad removal is a real UI change never clicked →
**#70**; (d) the hook-visual mapper is pure and **untested**, and nothing pins the generator
to the enum → **#71**; (e) the cue-dedup guard has **no test** and is folded into #64 as a
listen-for criterion; (f) **no EVAL_TRACKER rows** were written for the base-ten-blocks or
number-line/number-sequencer defects, so the dashboard still shows those primitives clean —
executor `/eval-test` or a tracker backfill.

**WIP:** back to **2 ACTIVE + 1 opportunistic — compliant.** The entire 08-04
surface SHIPPED 2026-08-05: reader-fit 14j `f4147ef`, 14k `1fbf4a1`, DI item 2
`62e22aa`, registers `f69aa86`, plus the **home-shell refresh `1b3e2db` —
user-approved in browser 08-05 ("home refresh is good") and CLOSED as a lane**
(compact header grade selector, constellation idle hero, simplified ribbon;
typecheck:lumina 0, full Vitest 1,569/1,569; no owning queue was ever needed —
it closed as a one-off approved surface). **Reader-fit 14l closed and SHIPPED
2026-08-05** (generator + new resolver + 20 focused tests + contract + catalog
constraints prose + registers). **DI 14g CLOSED 2026-08-05** — the
`counting_next` parse bug is fixed and a 120 ask saturates honestly at twenty;
the 1–120 extension is DI item 10, gated on bench sitting **#63** (multi-word
numerals, an unbenched response class — the probe is wired and waiting).
**DI 14g SHIPPED `4000434` and VOICE TRANSPORT SHIPPED `9d08687` (all four
charter phases, live refer-back 3/3) — both landed 08-05.** Pulls: **LA K-2 Grammar
density — handoff Phases 0-3 EXECUTED 2026-08-05; queue of record now seeded at
`qa/la-k2-grammar/BACKLOG.md` (top = next).** The census corrected the 07-04 map on
three counts (138 unchanged and structurally insensitive to primitive builds; grammar
50 not ~37; 131/138 are Kindergarten), and the pilot was an **anti-duplication catch** —
the predicted "Preposition/Spatial Scene" birth already existed as the math-filed
`spatial-scene`, so it shipped as an intent-driven preposition-window EXTEND instead
(contract C1 resolved on the config-axis rung; full Vitest 1,628/1,628, tsc 803
baseline). Next pull = **BACKLOG item 2** (contract **C3**, the `above`/`on` ambiguity —
a rule-#1 risk closed by an `identify`/`describe` probe plus a small exclusivity rule;
`/pm` recommends it ahead of item 1, whose containment/`between` build carries an
unresolved viewer-relative design ruling and is flagged against contract R11);
reader-fit is PARKED with a drained queue; DI/voice
lane: **item 11 MACHINE HALF DONE 2026-08-06** (carve-out + resume steering +
riders shipped; pre-fix journey failed ≈50%/beat, post-fix 3/3 PASS zero
findings, resume probe non-vacuous PASS, units 22/22; residual = the
real-child #64(b) drive — **restart the dev backend first**); one ~45-min mic
session closes #64 acceptance + #63 bench (which unlocks DI item 10
counting-to-120); support tiers **batch-3 evidence closure, serial**.
`.claude/settings.local.json` still permits
only `Read(**)`, so the standing routine-shell permission flag remains unresolved.

**Reconcile 2nd pass, `/pm` 2026-08-05 evening — four corrections, all drift from the
same cause: `bd1c535` landed after the day's first reconcile.** (1) The LA queue was
**renumbered** by that commit (a new item 2 inserted; every pointer shifted by one) and
the snapshot still named the old order — corrected, and items 7-8 that this file had
never listed are now named. (2) Contract **C3** was opened by the re-probe and appeared
nowhere in the portfolio — recorded. (3) **Structural:** the top ACTIVE lane had no body
section under `## ACTIVE` while PARKED reader-fit still held the `### 1.` slot — a cold
reader following the body found no grammar lane at all; the LA section is now authored at
`### 1.`, reader-fit's heading says PARKED in place, and reader-fit has a real PARKED-table
row with its resume condition (**run a new band census**, since its queue is drained rather
than blocked). (4) The `bd1c535` entries were stamped **2026-08-06** — a forward date, since
the commit is 08-05 18:52 -0400; fixed in `qa/la-k2-grammar/BACKLOG.md` and
`docs/contracts/spatial-scene.md` (both the C3 heading and the changelog). **HUMAN-CHECKS
needs no new row** — the C3 finding is machine territory (an `identify`/`describe` probe),
not pixel debt; the file is current through **#65, next free ID = 66**, and no report newer
than its as-of date carries unfolded browser debt.



---

## Archived by `/pm` 2026-08-16 — the 2026-08-13 reconcile note (verbatim)

> ### `/pm` 2026-08-13 — what this run corrected
>
> **Drift #1 — THE INDEX LAGGED ITS OWN QUEUES BY SIX HOURS, and every stale claim was about
> the same event: a design the user overturned mid-day.** `WORKSTREAMS.md` was last written
> 11:41; `qa/di/BACKLOG.md` and `HUMAN-CHECKS.md` at 17:15. In between, `letter-spotter`'s
> `name-it` went from a TAP to a SPOKEN answer on a user ruling, and `ten-frame` was driven
> four times. So the index sat there saying *"the math half is entirely undriven"* and *"the
> first pack in the family with NO SPOKEN MODE"* — both false, both written in good faith at
> the moment of shipping. **Third consecutive run with this exact shape** (08-11: index said
> "held" after the ff; 08-12: said "deployed" after the branch outgrew the deploy). The
> generalisation is now firm enough to act on: **a shipping session edits the queue, the
> source, and the human row — all local edits it is already in — and never walks back up to
> the global claim.** The index cannot be kept true by the sessions that invalidate it.
>
> **Drift #2 — A DEAD BLOCK WAS STILL LIVE DOCTRINE IN THREE PLACES, and one of them is the
> most-copied paragraph in the family.** *(Count raised from two to three later in the same run —
> the third copy was in this index's own CLOSED section, saying LetterSpotter has no voice wiring
> "by ruling". Even the run hunting the stale claims undercounted them on first pass.)* `letter_name` was overturned by the user's
> letter-spotter drive and is `accepted-build-ahead` in `judgedScriptContract.ts` — but
> `qa/di/BACKLOG.md` **standing gate 1** and `cvcSpellerScript.ts` both still read *"Letter
> NAMES remain BLOCKED"* hours later. Both fixed. **This one is not cosmetic:** standing gate 1
> is what a port consults to decide whether a mode may speak, so a stale block silently costs
> the next port a spoken mode it is allowed to have — the inverse of the defect this very
> ruling was correcting. **Where a class status lives in code, every prose copy is a dangling
> pointer** (the `/add-spoken-judge` retirement found five of these; the mechanism recurs
> because prose is cheap to write and invisible to `tsc`).
>
> **Drift #3 — HUMAN-CHECKS CONTRADICTED ITSELF, and the count was wrong for the third run
> running.** #97 exists **twice** — a `### ` section (filed by the porting session: "TAP-ONLY,
> NEVER DRIVEN") and a table row (filed by the drive session: "name-it SPOKEN, PARTIALLY
> DRIVEN"). Reconciled: the section is now the STATUS of record, the table row keeps the full
> criteria, each points at the other. #96 (`decodable-reader`) **does** have a row; the header
> both omitted it from the count and asserted it did not exist. **13 → 14.**
> **⭐ The count has now been wrong on three consecutive reconciles, and the standing rule from
> 08-12 ("re-verify counts AFTER the edit") did not save it — because the failure is not
> arithmetic.** A count is a *global* claim living in a file that only ever receives *local*
> edits, so it is stale by construction. **Proposal, needs a user word: stop maintaining a
> count.** Let the header carry the RANKING (what to drive first and why) and let the rows be
> their own census — a wrong ranking is visible to anyone reading it; a wrong count is not.
>
> **⭐ THE RUN'S REAL FINDING — A DRIVEN SURFACE READS AS SAFER THAN IT IS.** #98 (`ten-frame`)
> has FOUR drives; #97 (`letter-spotter`) has one; both stay open, for the same narrow reason:
> **every drive answered correctly.** The sitting has already paid for itself — drives 1–3 of
> ten-frame each found a *blocking* defect no machine test could have caught (a dead frame the
> 40-test suite missed **because the bug healed itself on a wrong answer**; a flash killed by
> `micLevel` re-render churn that **only reproduces with the mic open**; the flash firing before
> the tutor's line rather than after). But all three were **MACHINERY**. The judge — the thing
> the entire modality exists for — has still never been tested on any math surface, and on
> literacy it has two user strikes (#91, #92) plus one deliberate miss on #95's `accuracy`.
> **So the pull list is re-ranked to separate "the surface works" from "the judge refuses",**
> because a row that reads "driven, worked great" is the row a sitting will skip.
>
> **Non-drift — the machine lane's throughput is real and the gates held.** Five ports in ~24h
> (8 `rhyme-studio`, 9 `read-aloud-studio`, 10 `decodable-reader`, 11 `letter-spotter`, 12
> `ten-frame` = the first MATH port), each with typecheck:lumina 0, full-suite green, census
> greps clean, and live real-pipeline probes. The concurrent-writer discipline held for the
> fourth run: the owning sessions filed their own rows and `/pm` reconciled what it found.
>
> **Ship hygiene: the tree is ONE lane and it is now large.** ~6,300 changed lines across five
> ports plus the shared runner/engine, the `/add-di-loop` skill, three catalogs,
> `problem_type_registry.py` and the backend preview widening — all judged-loop, so it slices
> as one commit set, not two. Source has been quiet since 15:04; the queues were written at
> 17:15, ~19 minutes before this reconcile. **`/ship` proposed, not taken** — and the cost of
> waiting is now explicit: **five user drives' worth of fixes exist only in this working tree.**
>
> **WIP: 2+1, held.** ACTIVE 1 judged-loop (hot — five ports and five drives today). ACTIVE 2
> pilot onboarding (**untouched since 08-11, ~2 days** — not yet starved by the 3-day rule, but
> it owns the only *external* deadline on the board and its top item is machine-gated and
> unblocked). +1 DI closeout (unwritten since 08-10; still a documentation slice plus one probe).
>
> **✅ TWO HYGIENE CALLS — ASKED, RULED, AND EXECUTED IN THIS RUN.** Both had been flagged
> repeatedly without ever being put to the user as a question; the 08-12 note named that as its
> own failure mode (*"a deferral that never becomes a question is just a recurring line item"*)
> and this run closed it.
> 1. **`## ACTIVE` → the stream queues (user: move it).** 1,368 lines of per-stream detail moved
>    verbatim into the owning queues — `qa/di/BACKLOG.md` (708 lines, which had been carrying a
>    second copy of its own queue), `qa/reader-fit/BACKLOG.md` (362), `qa/la-k2-grammar/BACKLOG.md`
>    (99), `qa/topic-traces/HANDOFF-primitive-selection-2026-08-08.md` (85), `qa/support-tiers/BACKLOG.md`
>    (44), and a **new `qa/science-depth/BACKLOG.md`** (70) — that stream had no queue file at
>    all, which is precisely why its detail had nowhere to live but the index. `## DELEGATED`
>    also gave up 145 lines of 2026-08-03 WIP notes to the archive: history filed under a heading
>    that reads as live state. **Index: 1,727 → ~290 lines. Nothing deleted, every block linked.**
>    ⭐ The DI block is the one that mattered — a ~700-line duplicate of the queue it points at is
>    exactly how the two registers came to disagree about `letter_name` and about #97.
> 2. **HUMAN-CHECKS → one format (user: merge it).** All **68 table rows** are now `###` sections
>    carrying the same text; the two IDs that existed twice (#95, #97) became one row each with a
>    `#### … FULL CRITERIA` continuation. **78 open rows, #98 → #3, one list, newest first**, with
>    the older refresh notes moved to a "Filing history" section. Content preservation was checked
>    row by row, not eyeballed. The header now ranks before it counts: **14 judged-loop rows are
>    the sitting; the other ~64 are a July pixel-debt tail, not a queue.**
