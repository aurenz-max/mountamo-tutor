# Workstreams — Portfolio Index

The single orientation surface for all Lumina workstreams. Any session answering
"what's next?" starts HERE, not in memory or individual queues.

**Rules:** WIP limit = 2 ACTIVE streams + 1 DELEGATED lane. Everything else is
PARKED with a trusted-as-of date — act on a parked stream's queue only after
re-verifying its claims against EVAL_TRACKER + git. Maintained by `/pm` (Claude)
or `$pm` (Codex)
(reconcile → update → propose); every session that closes work updates the owning
queue AND this file's "last touched" in the same slice.

**⚖️ THE INDEX CARRIES STATE, THE QUEUES CARRY DETAIL (user ruling 2026-08-13).**
This file answers *what is being worked, what to pull next, and what is stale* —
in one screen per stream. **The reasoning, the evidence and the history live in
each stream's own queue file**, linked from its stub below. A per-stream block
that outgrows the portfolio table it serves belongs in that stream's queue, not
here. *Enforced 2026-08-13: `## ACTIVE` was 1,368 lines (79% of a 1,727-line
index) and `## DELEGATED` held 145 lines of 2026-08-03 WIP notes under a heading
that reads as live state. Index is now ~290 lines; nothing was deleted.*

**Standing rule for `/pm`: archive your predecessor's reconcile note as you write
your own.** The index carries exactly ONE note, so it cannot regrow.

| State | Meaning |
|---|---|
| ACTIVE | being worked now; queue is trusted |
| DELEGATED | handed to another session/agent; check its report before touching |
| PARKED | intentionally idle; queue trusted only as of the noted date |
| BLOCKED | waiting on a named dependency |

## Current snapshot — reconciled 2026-08-16 (full `/pm` — portfolio concentration)

**Two bottlenecks that gated this board for a week are both gone, and what replaced
them is machine-driveable.** (1) **The mic sitting is CLOSED** — user ruling 2026-08-14,
*"lets just trust the tutor works ive done a lot here"*; twelve rows struck as a block
(#82–#87, #89, #94–#98). The judged-loop human queue is now **empty except #90**, which
survives because it is a screen glance at a correctness fix, not a tutor check.
(2) **`/tutor-test --di` drives the judged loop HEADLESSLY** — every spoken item answered
wrong on purpose then right, as text. On its FIRST use it caught a **production transport
defect** (the backend prepended `[CURRENT STATE]` to judged cues and the model narrated it,
target answer first) — fixed at the transport, re-driven, 13/13 refusals / 12/12 affirms.
⭐ **The lane's verification model has flipped: the judge used to be provable only by a
human at a mic, and now a machine can drive it. That is what makes the remaining ~13
adapters (19h-i-b) a sweep rather than thirteen sittings.** *(Re-counted 2026-08-15: it is **11**; **7 are done** as of 2026-08-16.)*

✅ **SHIPPED SAME RUN — the tree is CLEAN.** Four commits off `910e981`: `e79006c0` the
`--di` harness · `990c90c7` the four judged-loop engine fixes · `d1c6a910` port 13 ·
this register slice. **`/ship` ran into the collision this board should expect more of:
two sessions worked the shared engine on the same day before either committed**, so six
files (`LuminaAIContext`, `useJudgedSpeechLoop`, `useJudgedScriptRunner`, `JudgedMicPanel`,
`TenFrame`, the runner suite) each held two mechanisms and could not be sliced apart
without hand-attributing hunks. ⭐ **The rule that falls out: in a lane two sessions are
both in, commit at the mechanism boundary while you still know which lines are yours.**

📐 **STRUCTURAL CORRECTION THIS RUN — the 08-13 split was enforced on a HEADING and the
bloat moved one heading up.** The snapshot table had regrown to **58,331 of this file's
97,481 characters (60%)**, with the judged-loop row alone at **41,365 chars — 42% of the
whole index in ONE table cell.** Moved verbatim to
[`the archive`](my-tutoring-app/qa/WORKSTREAMS-archive.md); every live pull it named was
verified present in `qa/di/BACKLOG.md` first. **The rule is about the FILE, not a section:
a row that needs scrolling belongs in its queue.**

| Lane | State | Pull now | Trusted as of |
|---|---|---|---|
| **🚀 PROD / `main`** | ✅ **SHIPPED 2026-08-14 — four commits on `ship/2026-08-10-judged-loop`, tree CLEAN:** `e79006c0` `/tutor-test --di` · `990c90c7` the four engine fixes (transport `scripted` · `cuedItemId` · 19b mic-level churn · 19i unstartable-in-lesson) · `d1c6a910` port 13 · this slice. Gates at ship: **typecheck:lumina 0 · vitest 3131 passed / 0 failed (219 files) · backend 130P/26F = the documented baseline, 126 → 130 on the new transport units.** ✅ **All four engine fixes now have live evidence (2026-08-14, #99 drive 2 — session `046ad3a42906`):** `cuedItemId` got its ten-frame `subitize` mic drives (standalone drive 1 + two in-lesson closes) and 19i's lesson half was driven — both judged ports started and ran in a live lesson. | **Fast-forward `main` when ready.** Two carried, unchanged: the **Vercel deploy off `910e981` is unverified** (push confirmed, build not; `vercel.json` has no branch config — check the dashboard), and the **backend did not move** — Cloud Run is a manual `gcloud builds submit`, and **residual 1 still bites the next one** (`cloudbuild.yaml` names `ai-tutor-backend`; the live service is `mountamo-education`). | 2026-08-14 |
| **🔝 JUDGED-LOOP FAMILY — the ACTIVE stream** | 🔴 **THE 19b LESSON DRIVE FOUND A BIGGER BUG THAN 19b: EVERY JUDGED PORT WAS UNSTARTABLE IN A LESSON** (user, 2026-08-14, `ten-frame` then `counting-board`). A lesson opens the shared mic at connect, so the orb read 'armed' and rendered the live surface instead of the tap-to-start button — no start affordance, run never ran, **every tap on the board dead**, while the tutor improvised a real-sounding instruction over it. **✅ FIXED (19i, all 15 surfaces, revert-biting gate) · 🔴 19j OPENED: `owns_opening` is never sent by `connectLesson`/`switchPrimitive`, which is why she was talking at all — its own slice, needs a mixed-lesson ruling.** ⭐ **The drive earned its keep: this was invisible to 3,131 tests and to every standalone drive the lane has ever run.** · **✅ 19b MIC-LEVEL CHURN — CODE SHIPPED + STANDALONE MIC DRIVE CLEAR 2026-08-14** (user, `ten-frame`/`subitize`) **· ✅ CLOSED 2026-08-14 — the lesson half DRIVEN (#99 drive 2, session `046ad3a42906`).** The mic level left the context value for a subscription, and the TURN MACHINE turned out to consume it too — so `useLiveVoiceTurns` is now frame-driven rather than render-driven. Machine gates green (vitest 3130, +5, both new gates revert-bite), **but the item's own words were "never ship this on tsc" and the deaf-mic failure mode is invisible to jsdom.** · **✅ PORT 13 `addition-subtraction-scene` SHIPPED 2026-08-14** (first port to ship with **no mic row**, on the new standing rule) · **✅ `/tutor-test --di` SHIPPED** — the judge is machine-testable · **✅ item 21 transport defect FIXED + re-driven** (judged cues send `scripted: true`; 4 new backend units). ⭐ **Port 13's finding is bigger than the port: THREE eval modes could not produce a wrong answer, and G1 `create_story` was literally `const correct = true` — an entire eval mode fed IRT evidence that measured nothing at one band.** Filed this run as **EVAL_TRACKER SP-31**, because it is a *content* defect class and a DI queue is not where a non-DI session looks. · **✅ PORT 14 `interactive-book` SHIPPED 2026-08-14 (literacy Phase 1, 1 of 3 — THE LAST PUSH-TO-TALK IN LITERACY IS GONE):** `read-focus-word` = spoken oral cloze, `find-feature` = tap-a-POSITION; adapter registered at ship, headless drives green (**15/15 refusals + 15/15 affirms ×3 runs; all 5 gesture holds SILENT at 0 audio bytes; cap→moveOn verbatim**). ⭐ **Its probe finding was SUPPLY: 5/6 generation draws silently shipped the FALLBACK book** — the reject path never said why until this slice gave it reasons (flash-lite fails focus-word placement); prompt fix + third attempt → 3/3 live books. ⚠️ **Item 21 recurred in FABRICATED form with the transport fix holding** (1/3 sessions narrated an invented `[CURRENT STATE]` with the answer in it — the cut-in ruling is still the open decision, recurrence filed on item 21). · **✅ `number-bond` SHIPPED 2026-08-14 (third math port, the item-18 P3-correction port):** `missing_part` = SPOKEN (stepper + Check deleted; answers 1..9), decompose EXPANDS one challenge → one judged turn per pair (novelty judged: a repeated pair is corrected), fact-family = a stillness close over TYPED input (family first), build-equation on the ASS fork. Headless drives green (**15/15 refusals + 15/15 affirms ×3; signature drive 5/5 — the WHOLE said back refused every time; gesture holds silent; cap drill clean after the fix below**), live probe 30/30 challenges kept, zero drops. ⭐ **Its cap drill found a family-wide defect class, QUEUED as 18d: a catalog `scaffoldingLevels` ladder that OFFERS quoted hint lines is a no-verdict channel** — on the second identical wrong answer the model swapped the byte-identical scripted correction (18c) for the ladder's quoted hints, which open with neither sentinel, stalling the correction counter. Fixed both surfaces on number-bond + revert-bitten; ASS and others carry the same shape. · **✅ PORT 15 `story-talk` SHIPPED 2026-08-14 (literacy Phase 1, 2 of 3):** all three modes went SPOKEN and the 4-picture menu is deleted — ⭐ **the queue predicted a per-mode split and the generator refuted it: every mode's answer is ONE WORD, so `closed_set_choice` never applied.** The prediction was made from the mode NAMES while the answer material sat one file away; the same re-check is now written into `word-workout`'s entry before anyone scopes it. Also **deleted the family's LAST tutor-busy mic gate** (correct for the click era's separate capture, obsolete once the judge IS the tutor) and added the **dialogue sentinel gate** — story-talk is the only judged surface whose read-aloud is character dialogue, so `"Yes, I found it!"` read verbatim was a phantom verdict waiting to happen. ⭐ **Its drive found a HARNESS defect rather than a pack one:** `di-answer-leak-in-ask` fired 5×3 because the oracle had no concept of a stimulus that legitimately contains the answer (literal recall from a read-aloud) — now `leakExemptSpan`, which keeps the scan STRONGER than emptying `leakTokens` would, and the cap drill caught the half I missed (the move-on cue carries the NEXT item's ask). Gates: typecheck 0 · tsc 803 = baseline · 35/35 + revert-bite · vitest 3237/0 · probe 15/15 kept · drives **15/15 refused + 15/15 affirmed ×3, signature 5/5, cap drill clean**. **Mic row #100 filed** — the first since the sitting closed, for a genuinely new stimulus mechanism. · **✅ PORT 16 `word-workout` SHIPPED 2026-08-14 — LITERACY PHASE 1 IS COMPLETE (3 of 3), and no Lumina visual primitive imports the interim voice hooks any more.** ⭐ **The re-check the queue demanded paid: `real_vs_nonsense` is SPOKEN** — the predicted blocker was a sentinel collision on "yes" and the challenge never carried a yes/no question at all, so that is TWO predicted splits in two days that died on contact with the answer material. Four spoken kinds, one earned tap (`picture_tap`: the word is printed, so naming its picture would only echo the print). ⭐ **One challenge is not one item** — a chain is a judged read PER WORD and a sentence is a read plus a spoken question, which is the port biggest measurement change: the click era scored EVERY chain 100 regardless of what was said, and the sentence was "read" by pressing **"I Read It!"**. ⭐ **The leak rule inverted** (everything printed is stimulus AND target, so it bites on the tutor mouth): per-item cold-read guard, three audio scaffolds deleted. ⭐ **The live probe found the content defect no gate predicted — the "nonsense" word is often a REAL word** (`ran`/`pan`, and `bag`/`fag` on a K-2 surface); fixed with a curated negative-only word oracle + blocklist, which then rejected ~3/6 live pairs. ⭐ **The cap drill found two more and both are fixed and re-driven clean:** improvised praise on the FIRST wrong answer (no-verdict stall — the contract rule read as being about repeats), and a FABRICATED `[CURRENT STATE]` block read aloud on the move-on beat **with the next answer inside it** (item 21 third sighting, transport fix holding). Gates: typecheck 0 · tsc 1021 = baseline · 66 tests across three suites (both legacy render suites rewritten, not deleted) · vitest 3268/3268 · probe 8 cases / 4 modes / 2 bands clean · drives plain 3/3+3/3, signature 8/8+8/8 ×2, chains 8/8+8/8, sentences 6/6+6/6, gesture holds silent 5/5, cap clean. **Mic row #101 filed** — new ANSWER MATERIAL (a NONWORD in the answer set), which `--di` cannot reach because it sends text.  · **✅ 19c SHIPPED 2026-08-15 — THE RUNNER OWNS BOTH COMPONENT-BUILT CLOCKS, and absorbing the first one FIXED A LIVE DEFECT NOBODY WAS LOOKING AT.** `onPresentStimulus`/`stimulus` (the falling-edge + `cuedItemId` stimulus gate) and `armStillness`/`clearStillness` are runner options now. ⭐ **`counting-board` still had drive 3's defect** — its K subitize flash fired on an 800ms beat measured from item-open, racing the tutor's voice, **nine days and three math ports after that exact bug was fixed inside ten-frame.** A fix written into ONE component is a fix the family does not have; item 19's thesis is now evidence rather than an argument. Deletion test held (four ports **−277/+199**, code-only +90, against **+96 runner lines serving fifteen ports**), and the timing rules are pinned ONCE against the real hook (runner suite **15 → 29**) instead of four times against four mocks. ⭐ **18b RULED BY THE USER AND SHIPPED IN THE SAME SLICE: the reveal HOLDS until her next cue is SENT** (`runner.revealHeld`) — it had painted **on the last item and nowhere else, in all four math ports, for a month**, because `onAffirmed` and `onItemOpened` fire in one dispatch and `currentSolved` describes the item that has already replaced the affirmed one. `/add-di-loop` updated in the same slice, so the next port DECLARES both clocks instead of rebuilding them. Gates: typecheck:lumina 0 · tsc **1021 = exact baseline, 0 in touched files** · vitest **3278** · four new gates revert-bitten. ✅ **DRIVEN LIVE BY THE USER THE SAME DAY** (`55166fef9a26`, 8 items, 90%: *"worked great"*) — and it turned into **the first ten-frame drive in which the JUDGE HAD TO REFUSE**: 7/7 correct affirmed, **2/2 wrong refused**, item recovered in place. ⭐ **It also measured the window `cuedItemId` covers, and it is 6–9 SECONDS** — each verdict's audio runs 6.0–7.9s and the next item's ask is not sent until +6.9–+8.8s, so the new frame sits on screen for most of ten seconds before she says anything about it. A bare falling edge does not fire *slightly* early. Nothing flashed early across eight advances; the correction path sent zero cues, so the re-flash gate worked from the runner. ⭐ **Two findings for other items:** 18c(c)'s byte-identical correction got its first mic citation **with a duration — 23.7s of identical speech on one item**; and **19h-i-c did NOT reproduce over audio** (7/7 bare affirms here vs. 5/7 embellished on the headless `--di` run of the same pack), which re-frames it as possibly a TEXT-CHANNEL artifact. Report: `qa/tutor-reports/ten-frame-live-19c-2026-08-15.md`. ⚠️ **One residual: `counting-board` `subitize` is un-glanced** — the one surface 19c changed behaviour on. | **➡️ `qa/di/BACKLOG.md` — 19h-i-b, ports 8–11** (next = `decodable-reader`; the remaining 4 are all in `literacy.ts` except `di-spoken-practice` — rebase before each). **📍 Handoff: `qa/HANDOFF-19h-i-b-adapter-sweep-2026-08-16b.md`** (supersedes the 08-16 one). ⭐ **THE DRIVE BUDGET IS RULED (user, 2026-08-16): cap drills are per CONTRACT SHAPE, not per mode — ≈58–62 sessions for the rest of the sweep, not 90.** **7 of 11 done** (`counting-board` `d7f4133b` · `addition-subtraction-scene` `6e114db1` · `push-pull-arena` `e41691d1` · `picture-vocabulary` `cfc4bcad` · `phoneme-explorer` `0cc11335` · `letter-spotter` `f43a804d` · **`letter-sound-link` 2026-08-16**). ⭐ **PORT 7 `letter-sound-link` — 12 sessions / 8 drive shapes, 0 HIGH outstanding, and the SIGNATURE DRIVE FOUND A FALSE AFFIRM THE CONTRACT HAD LEFT A HOLE FOR:** `keyword_match` AFFIRMED *"tuh"* and *"puh"* 2/2 — the child saying the letter's own SOUND instead of the picture word — and each false affirm then took the following CORRECT answer down with it (`di-no-verdict`, because the item was already closed). The contract named exactly ONE wrong answer (the other picture's word) and paired it with an accept clause telling the judge to be generous about naming; **`see-hear` has the OPPOSITE rule — a clipped try WITH an "uh" is explicitly correct there — so nothing carried over.** Re-driven 4/4 on the same two letters. ⭐ **THE PROBE FOUND AN ASK WITH NO ANSWER: *"say the picture word"* over 🤏.** The anchor WORD lived in the generator and the anchor PICTURE in the component with nothing joining them, so a pair with no entry on the other side rendered the 📝 fallback silently — and nobody had checked that the pictures which DID resolve could be NAMED (`i`→"itch"→🤏, `g`→"go"→🟢). One map now, six anchors re-chosen (**t tent ⛺ · g goat 🐐 · f fish 🐟 · j juice 🧃 · z zebra 🦓 · l leaf 🍃**), `i` barred from keyword-match as the `x` rule generalised. Gating only the TARGET was not enough — the re-probe drew "sun vs 🤏" twice. ⭐ **§4d has TWO HALVES and they are not the same rule:** "answered once" plus "an answered thing may not come back as the WRONG CHOICE" (three of six items in one draw were eliminable, each passing every per-item gate) — and **keep the sets separate**, because merging them ran the group-1 distractor pool dry on item 5 and stranded an item (1-in-5 draws → 0-in-6). ⭐ **18d LIVES ON THE ACCEPT SIDE TOO, and that version is worse:** two `commonStruggles` rows said *"count it as correct and warmly echo…"* / *"affirm it and echo the target word"* — telling the tutor to affirm without giving it the affirmation, so a **CORRECT** child stalls. No grep for a re-spoken ask finds it. ⭐ **A PINNED DRIVE CANNOT SEE A HOW-TO-PLAY DEFECT PAST ITEM 1** — the line is re-spoken only when the ACTION changes, so *"**I** say **a** sound"* (the pronoun and article are the answer for targets `i` and `a`) survived six pinned drives and fired on the blended one. ⭐ **PORT 6 `letter-spotter` — 7 drives, 0 HIGH, and the FIRST NON-FLAT LEAK ORACLE IN THE SWEEP, because its answer is ONE CHARACTER:** the harness scans `<token>` over lowercased text, so targets `a` and `i` collide with the article and the pronoun. **The fix was to reword three of OUR OWN lines** (*"**A** star is hiding the first letter of **a** word"* → *"**The** star … of **the** word"*, etc. — all three read better anyway) so the exemption is spent only on the GENERATED sentence: `match-it` stays flat for all 26 letters, `name-it` for 24. ⭐ **§4d ARRIVED WITH THE MODALITY: one letter may be ANSWERED once per session.** `find-it` NAMES its target aloud (there the letter is the question), and every item closes on an affirmation or a capped move-on that names the letter too — so a later `name-it`/`match-it` item on that letter is recall, and neither item is wrong alone. Invisible under the click-era tap surface because nothing said the answer out loud. ⭐ **THE FREE PROBE DREW *"Say the letter that sheep starts with"*, ANSWER KEY `S`** — every gate passed it, and /ʃ/ is not what `s` spells, so the affirm taught a false mapping inside the primitive whose job is to make it true. Gated as a CLASS (`sh ch th ph kn wr gn`); blends, `wh`, `gh`, `qu` deliberately kept. ⭐ **AND ONE `name_it` DRAW IN TWO CAME BACK ENTIRELY CODE-AUTHORED** — six challenges with only `targetLetter`, so every item fell to the fallback table: a well-formed, pedagogically sound, **entirely topic-free** lesson graded as success. `required` lists only what EVERY mode needs (a find-it challenge must not carry a sentence) — **but the manifest pins a mode for essentially every production lesson**, so the schema now demands the pinned mode's fields. 1-of-2 → 0-of-3. ⭐ **18d: the census was RIGHT about the rungs and blind to the row below them** — `commonStruggles` said *"only a touch is an answer here"*, written before `name-it` became SPOKEN and never revisited, so a tutor reading it in the sentence direction **sits silent through a child's CORRECT spoken letter**. ⭐ **Drive 7 half-closes §7's "tap-mode `moveOnCue` is UNDRIVABLE"**: a blended cap drill produces a move-on carrying a TAP contract, and the silence held. Still undrivable: a cap on a tap ITEM. Also recorded — **`--di-wrong signature` is a NO-OP on a gesture-only session**, so the honest budget was 7 drives, not 8. ⭐ **Port 5 was 9 drives (ONE cap shape — `moveOnCue` is mode-invariant and all four modes are voice), 10 sessions, 0 HIGH, and the first port CLEAN on both the answer-in-state-block and the positional-binding classes** — it has had a build gate since birth, so its displays never had a chance to desync. ⭐ **THE PROBE FOUND `isolate` SHIPPING A ONE-ITEM LESSON ABOUT A BEAR, WHATEVER THE TOPIC:** `maxOutputTokens` 4096 truncated the widest schema in the family mid-object, `JSON.parse` failed, and the hardcoded fallback shipped **silently, graded as success** — draws went **0, 0, 3, 5, 0 → 5, 4, 4** on 8192 + retry-once. *A per-mode fan-out lets a token ceiling be fatal for one mode and invisible for the other three — and it kills the one with the richest schema.* ⭐ **`blend` was asking children to blend `/c/ … ooo … /w/` and expecting "cow"** — `segment`'s prompt had a sounds-not-letters clause and blend's never did, though blend is where it matters more because **the walk IS the ask**. Fixed both sides (`c`/`q`/`x` are unsayable phoneme tokens in code now), then the drop rate showed the real channel was one level up: **4/20 → 0/15 once the prompt steered the WORD CHOICE, not the spelling.** ⭐ **TWO FINDINGS THAT OUTLIVE THE PORT:** (1) **the 18d census must go by MEANING, not by phrase** — this entry was listed at 1 rung and had 3, because `level2` said *"Say the sounds again"* rather than the family's *"Say the question once more"* (on `blend` the sounds ARE the ask) and a `commonStruggles` row no rung census can reach answered a letter NAME with a re-spoken ask. **Three more entries added to the census: `sound-swap`, `cvc-speller`, `word-flip`.** (2) **a session-level gate needs the produce-vs-select distinction** — gating every mode on "was this word heard earlier" deleted real `isolate` items, because its answer is picked from four cards visible at the ask; only `blend`/`manipulate`, which build the word from nothing, are actually handed the answer. ⭐ **Port 4 kept the streak — the adapter was ~15 lines and the slice was four defects the port already had, and the sharpest was only visible by reading the probe's ASK against its CONTEXT: `sentence_frame`'s spoken form arrived TRUNCATED AT THE BLANK**, so a pre-reader heard *"Turn on the... hmm... what?"* while the clause that decides the answer sat in printed text they cannot read — four of five asks undecidable, and the child corrected for saying "light". Also: `"My turn: this is a shoes."` (the article frame is gone, not computed), a generator that padded a thin scale pool by RE-BLANKING A USED SCALE so each ask spoke another's answer **while defeating the caller's own retry**, and a missing build gate that desynced five `challenges`-bound displays — one of which would score **a 0 against a word the child was never shown**. Gates: tsc 803 = baseline · typecheck:lumina 0 · vitest **3346/0** · 6 revert-bites · probe 6/6 modes clean · drives **15 sessions, 0 HIGH, 74/74 affirms + 77/77 corrections with correct sentinels, 0 embellished**. ⭐ **TWO FINDINGS THAT OUTLIVE THE PORT:** (1) **the 18d census had a structural blind spot** — it counted only UNPORTED primitives, but 18d lives in the CATALOG, so **`interactive-book` (SHIPPED 2026-08-14, adapter registered) had been carrying a live no-verdict stall**; fixed, gated and cap-re-driven in the same slice. Census EVERY DI catalog entry, not the queue. (2) **`--di-cap` silently degraded to a plain drive** on a gesture-only session (it drills the first VOICE item), so two of port 4's three planned cap drills were not cap drills at all — the harness now RAISES instead, and a tap mode's `moveOnCue` is recorded as gate-covered, never driven. ⭐ **19h-i-c got its largest sample: 0 of 74 affirm beats embellished** with the `NEVER_PERFORM`-style tail from birth (ten-frame 5/7 · counting-board 3/7 then 5/7 · ASS 0/14 · push-pull-arena 0/16 · picture-vocabulary 0/74). The tail is in; the one-session before/after on counting-board is still the owed next step. Then **19h-i-e** (resume re-seed narrates), **18a**. **19c, 18b and 19c-i are CLOSED 2026-08-15, ten-frame user-driven** — the only residual is a one-screen glance at `counting-board` `subitize` on its next touch. **19b is CLOSED (2026-08-14, both drives)** — see the human-queue row. Literacy Phase 1 COMPLETE. Further MATH ports are gated on **P3 = #63**, the >20 numeral bench — the only human row the lane still needs; `ordinal-line` stays gated by RESPONSE CLASS, not #63. | 2026-08-16 |
| **🎙️ Judged-loop human queue** | 🆕 **ONE NEW ROW, #100 — the standing rule working as designed.** `story-talk` (port 15) is the first port since the sitting closed to file one, because it is the first whose STIMULUS is a read-aloud containing the answer, and it deleted the click-era mic gate that existed to stop the tutor's own voice being credited to the child. `--di` cannot touch that: the student's turn crosses as TEXT, so tutor audio never competes with a learner utterance. ~4 min, one session. · ✅ **#99 STRUCK on the lesson drive (drive 2, session `046ad3a42906`):** a live K counting lesson ran `counting-board` (7/7 spoken answers judged to completion) and `ten-frame` `subitize` (2/2) through the PROVIDER's shared turn instance — 11 voice turns, superseded 0, wedged 0. Doctrine bonus: ASR transcribed spoken six/five/nine as "sechs"/"fünf"/"Nein." and the judge affirmed the right number every time — audio-judged, transcript a spectator, live-proven. **The human rows the lane still needs are #100 (above), #63 (unlocks >20 math) and #90.** · **✅ Otherwise CLOSED as a sitting 2026-08-14.** Evidence under the ruling: the spoken judge refused deliberate errors on `picture-vocabulary`, `phoneme-explorer`, `letter-sound-link`, `read-aloud-studio`'s word swap, and `ten-frame` at 6/6 + 6/6 — carrying the contract into math. Every struck row was a re-run of one contract on another surface. | **New standing rule: a judged port ships on machine gates + a live generation probe. A mic row is filed only for something the contract has NOT proven** — a new response class, answer material, or stimulus mechanism. **Knowingly carried:** the counting-vs-total split is unverified (`subitize` must refuse a counted-up answer where `counting-board` accepts it — pedagogy risk, not a broken loop). | 2026-08-14 |
| **🧮 `multiplication-explorer` per-challenge facts** | ✅ DONE + PUSHED `927b754` — the five representation panels drew the SHARED fact for a month after grading was fixed, i.e. the picture lied to the child in exactly the modes the oracle had certified. EVAL_TRACKER **SP-30**. | **Human gate #90 — never looked at, and it is now the ONLY open current-era row.** ~2 min screen glance. | 2026-08-11 |
| **🆕 `di-spoken-practice` — the content-generic DI pack** | ✅ SHIPPED `71cba07` + engine cut-in `ead9ae1`, both on `main`. Four user drives; six defects found and fixed. | Open: **item 17** (embedded insets — scoped, not started) and the routing hold. Detail: `qa/di/BACKLOG.md` items 16–17. | 2026-08-12 |
| ~~**Pilot onboarding (invite-only)**~~ | **✅ CLOSED 2026-08-14 (user: "onboarding is done").** Queue file deleted; invite-gated signup ships on `main`, invite #1 driven end-to-end on the live site. Items 1–3 (session record, in-lesson feedback, observer digest) retired unbuilt — deliberately, not dropped. | — | 2026-08-14 |
| ~~`parent/link-student` has no verification~~ | **NOT A ROW — user ruling 2026-08-14: the parent portal is VESTIGIAL, pre-Lumina, may be picked up at a future state.** | Recorded once so it is not re-discovered as new: `POST /api/parent/link-student` has a literal `# TODO` where verification should be. The surface is `/parent/dashboard` + `parentPortalApi.ts` + `parent_portal.py`, self-contained and outside the Lumina lesson path. **If the portal is ever revived, verification is the first thing it needs.** | 2026-08-14 |
| **DI closeout (CTX-2 report)** | **+1 — re-priced this reconcile: a DOCUMENTATION slice plus one probe** | The excavators run (`qa/tutor-reports/lesson-live-2026-08-10-excavators.md`) already carries the post-fix floor-gate numbers this closeout owed — **27 batches, wedged 0, superseded 0** vs the measured pre-fix 33 sends / 9 min with 3 self-killed turns. Write the report citing it. Genuinely unproven: **the `wedged` WATCHDOG** — a wedged-0 run is exactly the evidence that cannot show it fires. `qa/di/BACKLOG.md` item 15 (evidence pointer appended this run). | 2026-08-10 |
| **Science depth — CELL-1 / LCS-1 / CS-1 / PA-1 / BIO-1 / BIO-2** | **PARKED this reconcile (was ACTIVE)** — untouched since 08-09 while the judged loop + pilot absorbed everything; deliberate, not drift | Resume top = **CELL-1**: `ZONE_BOUNDS` barely discriminate (one drop point satisfies 5 of 6 zones) and feed IRT evidence — **`/primitive-contract` FIRST, then `/eval-fix`** (no contract exists; re-tuning re-scores evidence). DNA-1 ✅ and CB-1 ✅ stand; human gate #80 open. LCS-1/CS-1/PA-1 need `/oracle-test` before severity is asserted. | 2026-08-09 |
| ~~**⚠️ ORPHANED PAIR — `scaffoldAudit.ts` + `interpolateTemplate.ts`**~~ | **✅ CLOSED — committed `0207cd6`, verified in the tree this run.** | **This row was already dead when the 08-10 snapshot shipped it: the SHIP row two lines above it names `0207cd6` AND explains the ruling, while this row still asked for the ruling.** A same-table self-contradiction, and worth naming as its own failure mode — the 08-10 run wrote the resolution into the row it was *creating* and never went back to strike the row it was *carrying*. Carried rows are copied, not re-read. | 2026-08-11 |
| ⚠️ `npm test` exits 1, zero failing tests | FILED 2026-08-09 — unchanged | `canvas-confetti` rAF after jsdom teardown, parallel-only; belongs to whoever next touches `solar-system-explorer` (#77's primitive). | 2026-08-09 |
| ⚠️ IMG-1 — the tutor is blind to every image | **PARKED (user: "I don't think we push this forward")** | Record: `qa/tutor-reports/lesson-live-2026-08-10-excavators.md` (with TRN-1 / ASR-1 / FLOOR-1, all parked). If ever resumed, the cheap pedagogy half comes first: the tutor SAYING it cannot see, instead of confabulating. | 2026-08-10 |
| Pip — the Curator's character | SHIPPED `997c875`, still UNFILED — user product call (stream vs one-off); 100% pixels, no machine gate | Unchanged since 08-08. | 2026-08-08 |
| Reader-fit sweep | PARKED — item 17 gated on HUMAN-CHECKS #77 | Unchanged; resume the moment #77 is struck (executor `/add-eval-modes`, 3 primitives). | 2026-08-08 |
| Support tiers (non-math) · LA K-2 grammar | PARKED | Unchanged (batch-3 evidence via `/eval-test`; grammar blocked on a user design ruling). | 2026-08-05 |
| **🆕 SILENT GENERATOR FALLBACKS — 33 production generators, 32 of them MATH** | 🆕 **OPENED `/pm` 2026-08-16, and it is the first lane this board has opened from the UNWORKED side of the portfolio.** Generalised from port 5's live finding: `gemini-phoneme-explorer.ts` truncated at `maxOutputTokens: 4096`, `JSON.parse` failed, and the **hardcoded fallback shipped to a child silently and graded as success**. Grepping the 209 production generators for `fallback` with **no retry and no `console.warn`/`error`** returns **33**: `calendar-explorer` + `3d-shape-explorer` · `addition-subtraction-scene` · `analog-clock` · `area-model` · `balance-scale` · `bar-model` · `coin-counter` · `compare-objects` · `counting-board` · `dot-plot` · `equation-builder` · `fraction-bar` · `fraction-circles` · `histogram` · `length-lab` · `math-fact-fluency` · `measurement-tools` · `net-folder` · `number-bond` · `pattern-builder` · `percent-bar` · `regrouping-workbench` · `shape-composer` · `shape-sorter` · `shape-tracer` · `skip-counting-runner` · `strategy-picker` · `systems-equations` · `tape-diagram` · `ten-frame` · `time-sequencer` · `transformation-lab`. **This is a SWEEP, not a sitting** — greppable, no mic, no browser. It is [[project_flash-lite-truncation-template]] (parked 07-06, never run) with a live citation attached. ⚠️ **The grep is a SCREEN, not a verdict** — a generator may reach its fallback rarely or never; the pilot must measure draw rate before the sweep assumes severity. | **Pilot ONE, measure, then sweep.** Suggested pilot = a math generator with a wide schema and real routing volume; instrument the fallback path first (**a `console.warn` with the reason is the whole fix on the silent half**), draw 8–10 live generations, record the fallback rate, and only then decide whether the retry+8192 leg is warranted per generator. Executor `/eval-fix`, evidence via `/oracle-test`. **Roster check passed: 20 of the 33 are in ≤1 queue** — this lane does not re-work the worked set. | 2026-08-16 |
| Delegated lane | NONE | — | 2026-08-10 |

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
> | **A — word/number answer** | `syllable-clapper` · `word-builder` · `spelling-pattern-explorer` · `word-sorter` · `poetry-lab` `rhyme_hunt`, plus the numeral-answer math set | ✅ `short_spoken_word`, `open_set_word`, `closed_set_choice`, numerals | **`/add-di-loop` works as-is.** Straight continuation of the proven pattern. |
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

> ### Older reconcile notes, prior snapshots, and EXECUTED blocks
>
> **Split out 2026-08-12 (user ruling) → [`my-tutoring-app/qa/WORKSTREAMS-archive.md`](my-tutoring-app/qa/WORKSTREAMS-archive.md)** —
> 1,479 lines of `/pm` notes back to 2026-08-09, prior snapshots back to 2026-08-05, and the
> 2026-08-06/07 EXECUTED blocks. Moved verbatim, nothing deleted. Read it for *why* a call was
> made; never for what is true now. This index kept the current snapshot table, the newest
> `/pm` note, and the live ACTIVE / DELEGATED / PARKED / CLOSED sections below.
> **The 2026-08-12 note joined it on 2026-08-13** — from here the rule is standing, not a
> one-off cleanup: **each `/pm` run archives its predecessor's note as it writes its own**, so
> the index carries exactly ONE reconcile note and cannot regrow to 3,194 lines again.

## ACTIVE

### 00. Lesson ordering & primitive selection — **SCOPED ACTIVE 2026-08-08 (user call)** — last touched **2026-08-08** — ⚠️ **STARVED 6 DAYS (`/pm` 2026-08-14)**

> ⚠️ **This is the board's only WIP problem, and it is starvation, not overload.** The rule
> is 2 ACTIVE + 1; **exactly ONE stream has moved since 08-09** (the judged loop, which took
> everything). This stream is nominally ACTIVE and has not been touched in six days.
> **Do not park it — its top item is unusually cheap.** B′ is **~15 lines, no LLM call, and
> the data is already on all 541 modes**, with the success criterion **already measured**
> (19 of 72 scorable blocks inverted → 0). That ratio is the argument: it is the cheapest
> unclaimed pedagogy win on the board, and it has been sitting behind a lane that could
> absorb infinite attention. **Either pull B′ or park this deliberately — leaving it
> nominally ACTIVE is the one state that keeps costing.**

**📍 DETAIL MOVED `/pm` 2026-08-13 → [`my-tutoring-app/qa/topic-traces/HANDOFF-primitive-selection-2026-08-08.md`](my-tutoring-app/qa/topic-traces/HANDOFF-primitive-selection-2026-08-08.md)**
(§5 IS the queue; §4 is the do-not-rebuild list). That handoff is also where the moved
index detail now lives, appended verbatim at the end.

- **➡️ TOP = B′, the deterministic within-block sort** — after `resolveLessonEvalModes`,
  sort each objective block's components ascending by the resolved mode's
  `scaffoldingMode`. ~15 lines, no LLM call, and the data is already on all 541 modes.
  Success criterion is already measured: **19 of 72 scorable blocks inverted → 0**.
- **Then C** — thread the objective VERB into eval-mode resolution (the mode picker
  ignores it today; `ten-frame` resolves `build` under all four verbs).
- ⚠️ **§4 is REJECTED, do not rebuild** — sorting by IRT `beta` (user ruling: "learning
  objective should drive this") and Bloom-tagging 541 eval modes (killed by measurement).
- ✅ **Layer A SHIPPED** in `3226734`; hundreds-chart window in `8ba8c1e`. Both on `main`.

### 0. Science depth — the biology answer-leak class — **PROMOTED TO ACTIVE `/pm` 2026-08-08** — last touched **2026-08-08**

**📍 DETAIL MOVED `/pm` 2026-08-13 → [`my-tutoring-app/qa/science-depth/BACKLOG.md`](my-tutoring-app/qa/science-depth/BACKLOG.md)**
(a queue file created by that move — this stream had none, which is part of why its
detail lived in the index).

- **Resume top = CELL-1** — `ZONE_BOUNDS` barely discriminate (one drop point satisfies
  5 of 6 zones) and they feed IRT evidence. **`/primitive-contract` FIRST, then
  `/eval-fix`** — no contract exists, and re-tuning re-scores evidence already collected.
- DNA-1 ✅ and CB-1 ✅ stand; **human gate #80 open**. LCS-1 / CS-1 / PA-1 need
  `/oracle-test` before any severity is asserted.

### 1. Reader-fit supply-side sweep — items 15 + 16 CLOSED → **item 17, gated on a human check** — **PARKED 2026-08-08** — last touched **2026-08-08**

**📍 DETAIL MOVED `/pm` 2026-08-13 → [`my-tutoring-app/qa/reader-fit/BACKLOG.md`](my-tutoring-app/qa/reader-fit/BACKLOG.md)**
(items 15/16 closure detail and the item-15 history block, appended verbatim).

- **PARKED — item 17 is gated on HUMAN-CHECKS #77** (`solar-system-explorer`). Resume the
  moment #77 is struck; executor `/add-eval-modes`, 3 primitives.
- Item 17 is an **eval-hook portfolio decision**, not a band fix: probe the tutor channel
  BEFORE scoping, because a band failure can be a CONTENT gap.

### (PARKED 2026-08-07 by `/pm` — BLOCKED on a user design ruling, not idle; queue trusted as of 2026-08-05) LA K-2 Grammar density — was TOP SLOT (user-pulled 2026-08-05) — last touched **2026-08-05**

**📍 DETAIL MOVED `/pm` 2026-08-13 → [`my-tutoring-app/qa/la-k2-grammar/BACKLOG.md`](my-tutoring-app/qa/la-k2-grammar/BACKLOG.md)**

- **PARKED and BLOCKED, not idle:** it waits on a **user design ruling**, not on capacity.
  Queue trusted as of 2026-08-05.

### (PARKED 2026-08-05 — queue DRAINED; kept in place as the history record, not an ACTIVE pull. **⚠️ `/pm` 2026-08-07: this is NOT the active reader-fit lane — see stream 1 above.** This row is the *demand-side* K → EMERGING census queue, §14a–14m, which genuinely drained on 08-05. The ACTIVE lane is the *supply-side* sweep, BACKLOG item 15, seeded from a live-catalog enumeration rather than a demand sample. Two different queues in the same file; reading "reader-fit is parked" off this heading is the mistake that made `/pm` under-scope the band on 08-06.) Reader-fit K → EMERGING queue — last touched **2026-08-05** (**§14l CLOSED 2026-08-05 — flashcard-deck final-assessment scope/count binding.** The requested count and the taught-concept scope both lived in **intent prose**; `config.cardCount` is stamped by no manifest producer anywhere in the repo, so a "10 simple review cards" ask fell through to `defaultCount` 15 while the prompt's own rules invited expansion and the `cards` schema array was unbounded. New `service/flashcard-deck/resolveDeckRequest.ts` applies the 14h resolver template to a non-numeric axis — one temperature-0 structured call yielding `{requestedCount, isReview, taughtConcepts[]}`, never a regex. Binding is a **constraint-presence fork** (14j's shape, contract C1) so generic open-study decks stay byte-identical at 15; under a review scope the two expansion-inviting rules invert and a TAUGHT CONCEPTS block forbids new vocabulary, with code comparing count-vs-concepts so surplus cards revisit angles rather than pad. Schema array bound to the resolved count + post-parse slice; `buildGradeLine(ctx.grade)` threads canonical grade. **Contract C2 ruled: the K 6-card cap wins over a requested count at PRE** — a developmental load rule, deliberately narrow, with R8 still forbidding new caps elsewhere. Live: G1 census replay **exactly 10** cards with zero untaught vocabulary (no patent/prototype/Internet/medicine); the **K community-helpers census instance closed as a rider**; G5 generic control unchanged at 15; K PRE control 6 cards / 6 distinct emojis; tutor probe 0 findings. Contract derived same slice (9 R, 2 conflicts, **zero authored-map consumers — every consumer is manifest-emergent, mostly the finalAssessment slot**), `--check` **COMPATIBLE**; catalog `constraints` padding invitation removed. Focused 20/20 with revert-bite (10 fail pre-fix), full Vitest **1,589/1,589**, typecheck:lumina 0, tsc 803 baseline. Anchor correction recorded: the generator is `gemini-flashcard.ts`, not the `gemini-flashcard-deck.ts` the queue and both censuses name. Reports `qa/reader-fit/flashcard-deck-14l-2026-08-05.md` + `qa/primitive-contracts/flashcard-deck-check-2026-08-05.md`. **NEXT = re-read the §14 pull order; the EMERGING census is drained except 14g's DI-owned half.** Prior day: **§14m CLOSED 2026-08-04 — the FULL SWEEP shipped in one slice: 20 generators** (hundreds-chart/14i's hard `?? '2'` + the six K-2/elementary prose resolvers + coin-counter/14c per contract gap G2 + 12 chemistry incl. `matter-explorer`, an inline-resolver census under-count found in-flight) **now resolve canonical-first** — exported per-generator mapper over `ctx.grade`, legacy prose/default fallback kept everywhere, explicit `config.gradeBand` pins still outrank. **The chemistry "may not bite" guess was WRONG in the published band**: safety-lab sent K to 6-8 off the '6' in the kindergarten prose "(ages 5-6)"; states-of-matter/reaction-lab sent published G1/G2 to 3-5 — verified, fixed, probed (K→K-2, G1→K-2, G2→K-2). Where the LLM stamped `gradeBand` via schema (fraction-circles + 6 chemistry) code now stamps the band when a canonical grade exists. Headline probe wins: fraction-circles G1 dens ≤4 (was ≤12), timeline-builder G2/G4/G7 reach 2-3/4-5/6-8 (all previously unreachable), coin-counter G2 drew a **half-dollar** (`MEAS002-05` pool live for the first time), hundreds-chart G4 → [3,4,6,7,8]. Gates: 43 new tests / 7 suites with revert-bite per generator, typecheck:lumina 0, tsc 803 baseline, full vitest 1400/1400, 21 real-Gemini probes. Reports `qa/reader-fit/14m-sweep-2026-08-04.md` + `qa/reader-fit/hundreds-chart-14i-2026-08-04.md`. 14i's intent-focus half measured IN-DESIGN (6/7 on named intervals); its 120-grid capability half stays open (fork territory). NEXT by pull order = **14h number-sequencer** → 14j → 14k/14l. Prior day: **§14m PILOT DONE 2026-08-03 (evening): number-line ships the canonical-grade-first template — contract-first (`docs/contracts/number-line.md` derived, 12 R, C1 OPEN → 14k), `--check` COMPATIBLE, focused wiring tests 7/7 with revert-bite, typecheck:lumina 0 / tsc 803-baseline / full vitest 1327/1327, 10 real-Gemini eval-test probes incl. `grade=4 → 3-5/decimal` — the FIRST runtime 3-5 render on the ctx path — and `grade=1 → K-2` for all 8 authored G1 consumers. PREMISE CORRECTION recorded for the sweep: production passes grade-context PROSE and every production sentence matched the old K-2 substring test ("grades 1-5" has a `1`, "thinking" has a `k`), so the live defect was EVERYTHING-lands-K-2 / 3-5 unreachable — not G1→3-5; verify each sweep target's actual input string before predicting direction. 14k replay measured honestly: band fixed, 14k STAYS OPEN with mechanism pinned into contract C1 (K-2 ≤30 clamp vs authored ≤120 + uniform pool-window placement + any-interior accept — fork required). **Committed `dcfaac7`** (slice-only; the concurrent DI session's in-flight files left for its own commit). Report `qa/reader-fit/number-line-14m-2026-08-03.md`; check report `qa/primitive-contracts/number-line-check-2026-08-03.md`. NEXT = the 14m SWEEP: hundreds-chart (14i, the `?? '2'` shape) → sorting-station / number-tracer / fraction-circles / shape-composer / net-folder / timeline-builder → coin-counter (14c rides) → 11 chemistry last (verify the defect bites first). Earlier same day: §14f DONE & SHIPPED `7ba48ba`.** Pilot swapped off coin-counter by user ruling 08-03: the first version named coin-counter because its contract already documented the defect as gap G2 — i.e. it was the *cheapest* pull, not the highest-leverage one. That is the trap the user named — a heavily-worked primitive keeps winning pulls because prior work makes each next item cheap, regardless of demand (coin-counter routes **3** across both censuses yet had consumed 2 build slices + 2 contract checks + 2 human-check rows). number-line carries real census demand via **14k** and its defect is confirmed at `gemini-number-line.ts:890` — `elementary` prose contains no 'k'/'1'/'2', so a Grade-1 objective lands on the `3-5` band and the range resolver then falls back to grade-band defaults. Cost accepted honestly: number-line has no contract, so contract-first adds work coin-counter would not have needed — paying it once is the point. See [[feedback_worked-primitives-self-select]])

**📍 HISTORY BLOCK MOVED `/pm` 2026-08-13 → [`my-tutoring-app/qa/reader-fit/BACKLOG.md`](my-tutoring-app/qa/reader-fit/BACKLOG.md)**

- ⚠️ **This was the DRAINED 14x reader-fit queue, NOT the active reader-fit lane** — it was
  kept inline as a history record and mistaken for a pull at least once. It is history;
  the live lane is the stream above.

### 2. Direct Instruction primitive family (graduated from bench) — **OPPORTUNISTIC (+1) as of 2026-08-08** — last touched **2026-08-08**

**📍 DETAIL MOVED `/pm` 2026-08-13 → [`my-tutoring-app/qa/di/BACKLOG.md`](my-tutoring-app/qa/di/BACKLOG.md)**
— which was already this stream's queue of record, so the index was carrying a ~700-line
second copy of it. That duplication is exactly how the two registers came to disagree
about `letter_name` and about #97.

- **The lane's live state is the snapshot table above** (ACTIVE 1). Queue: item 16
  (literacy ports + the runner) and item 18 (the math sweep, P1 `ten-frame` shipped).
- **Pull = the mic sitting**, re-ranked: #98 + #86 together, then #93, #94, #89.
- **2026-08-13 (later): item 19 OPENED — GENERALIZE THE PORT.** A `/simplify` 4-agent
  review of ports 8–12 answered the user's scaling complaint: the extraction generalized
  the loop but not the envelope/furniture/gates/test-harness, and live-drive fixes don't
  propagate (the "[WAIT silently]" fix reached 1 pack of ~10). Shipped same slice: the
  di-script TESTKIT (`judgedScriptContract.testkit.ts`, piloted on ten-frame, skill step 6
  re-pointed), two new code gates (performed stage directions; byte-identical consecutive
  asks), the letter-spotter generator↔script gate drift fix (90 vs 100 was live) + a
  quote-injection guard, and runner `currentSolved`/`canAttempt`. Queued 19a–19h with
  executors — 19h is the "eval-test doesn't scale" answer (judged-loop journeys in
  `run_tutor_live.py`, committed live probes, census-as-vitest). Machine-gated only:
  full vitest 3030 ✅, typecheck:lumina 0, tsc 0-new; the mic-label render change rides #98.
- **2026-08-13 (later still): 19a SHIPPED — the testkit sweep, all 13 suites.** The
  horizontal retrofit the plan called for: one parser, one gate set, one catalog check.
  Nine packs failed the newly-on performed-direction gate exactly as predicted (every one
  opened its contract `"Then WAIT silently — …"`) and all nine are on the fact-form now.
  **Three gate-level corrections the plan did not anticipate:** the "ONE parser" knew only
  the runner-era anchor and could not read the four pre-runner ports at all; the repeat-ask
  gate was mis-calibrated (it flagged decodable-reader's 4-word DI signal as loudly as
  rhyme's 15-word rule model — now length-gated at 12 words, with all four known spans
  pinned); and every fixture pack was the one shape that CANNOT trigger the repeat gate, so
  adopting it would have been a no-op on 12 of 13 suites. Fixing that third one is what
  found the slice's only live defect (decodable-reader repeats its ask on every consecutive
  sentence of a passage — under the calibrated limit it is a legitimate signal, and it is
  recorded so the next long invariant lead-in is not). **User fork RULED: the pre-runner
  four stay off `useJudgedScriptRunner` until one needs real work.** Machine-gated only:
  di-script 388 ✅, full vitest 3043 ✅, typecheck:lumina 0, tsc 0 in every touched file —
  **the wording fix is UN-HEARD**, folded into the existing mic rows as one thing to not
  hear. Next by pull order: 19d (furniture pilot → sweep), with the Runner API migration
  riding along. Detail: `qa/di/BACKLOG.md` item 19a.
- **2026-08-13 (this slice): 19d SHIPPED — the judged STAGE FURNITURE, and it was a
  pedagogy fix wearing a deduplication hat.** `JudgedMicPanel` on all 15 judged surfaces
  (it wraps `LuminaMicListener`, never re-rolls it) + `phaseResultsFromSummary` collapsing
  14 copies + 41 status lines that only restated the runner's defaults. **The orb's label
  is now read from `answerKind`, and four ports — not the one the item named — were
  claiming "I'm listening" over items the child answers with their HANDS** (cvc-speller
  `spell-word`, letter-sound-link hear-see, picture-vocabulary's tap modes, counting-board
  `subitize_perceptual`); each now names its own gesture. **The status-line count in the
  item was wrong in both directions:** no block was wholly redundant (it guessed ~4), but
  41 individual lines were byte-identical — and read-aloud-studio's block had nothing to
  delete at all. Runner API migration rode along in the seven components the work opened:
  six `revealed` latches → `runner.currentSolved`, five tap gates → `runner.canAttempt`,
  with `isAwaitingGesture()` deliberately kept at every commit site (it is a synchronous
  ref; `canAttempt` closes that window through batched state, so dropping it would lose a
  real double-tap check). Serial, one port at a time, gated between each. Machine gates:
  full vitest 3049 ✅ / 4 skipped, di-script + judgedScript 435 ✅, typecheck:lumina 0,
  tsc 803 = exact baseline with 0 in every touched file. Net −299 lines across the port
  files. **DRIVEN SAME DAY on `ten-frame` and `letter-sound-link` (user, all three modes)
  — both clean, and the second drive FOUND A DEFECT the machine gates could not see: the
  completion copy was telling the same lie the orb had been.** A six-item TAPPED run
  congratulated the child *"with your own voice"*; `judgedAnswerMix` now derives it, fixed
  across the same four ports (letter-sound-link, picture-vocabulary, ten-frame,
  counting-board). Full vitest 3052 ✅, tsc still 803. The remaining #93 criteria are the
  deliberate-error ones — a clean run cannot reach them. **Next machine pull: 19b (micLevel context churn) — and
  it must ship WITH a mic drive, never on tsc.** Detail: `qa/di/BACKLOG.md` item 19d.

### 3. Support-tiers campaign (non-math) — **PARKED 2026-08-08 (was OPPORTUNISTIC +1)** — last touched **2026-08-04**

**📍 DETAIL MOVED `/pm` 2026-08-13 → [`my-tutoring-app/qa/support-tiers/BACKLOG.md`](my-tutoring-app/qa/support-tiers/BACKLOG.md)**

- **PARKED.** Batch 3 needs **evidence, not code** (`/eval-test`). Math 41/41 and non-math
  31/36 are complete and committed — **do not re-touch them.**

## DELEGATED

*(none — lane 3 closed 2026-07-15, folded to the PARKED contracts stream below.)*

*(Older `/pm` WIP notes that lived under this heading — 145 lines, 2026-08-03 and earlier — moved to [`the archive`](my-tutoring-app/qa/WORKSTREAMS-archive.md) by `/pm` 2026-08-13. They were history filed under a heading that reads as live state, which is its own small trap: a session scanning for delegated work found five screens of 08-03 reconcile notes.)*heading that reads as live state.)*


## PARKED (trusted-as-of date; re-verify before acting)

| Stream | Queue / doc | Next action | As of |
|---|---|---|---|
| Reader-fit K → EMERGING | `my-tutoring-app/qa/reader-fit/BACKLOG.md` (body section kept under `## ACTIVE` as the history record) | **PARKED 2026-08-05 with the queue DRAINED — this is a clean stop, not a stall.** 14a–14m are all closed; the queue file itself states it has **no EMERGING census pull left**, so the next item here is a **fresh priority call, not a carried-over pointer**. Resume by running a **new band census** (the 14a shape: ~6 published subskills across LA/Math/SS through the real `/topic-trace` pipeline) to re-seed at the next band. The `## Systemic items` section stays accumulate-evidence by design — not a pull. | 08-05 |
| Voice transport unification | `my-tutoring-app/qa/voice-transport/CHARTER.md` | **UN-PARKED 2026-08-05 → now the ACTIVE DI-lane pull (see snapshot); this row kept for the charter pointer.** **NEW 2026-07-23 (user direction).** Promote the DI-proven client-side turn authority (`voiceTurnMachine`/`useLiveVoiceTurns`) from DI-private mode to Lumina's SESSION-WIDE voice transport, so students can talk to the tutor throughout a lesson and verbally refer back to prior sections. Dissolves the DI mixed-lesson manual-VAD trade-off (L2 wiring 07-23, HUMAN-CHECKS #45 measures the interim). Phases: calibration beat → lesson-level turn authority (DI becomes a consumer) → contextual close-timing + viewport claim → refer-back Tier-3 journey beats (the raised live-testing bar). Charter has the evidence base + watch-items. Pull only when a WIP slot opens. | 07-23 |
| media-player reimagining | `qa/media-player-reimagining/BACKLOG.md` + `docs/contracts/media-player.md` | **PARKED 2026-07-16 (user — B1 shipped & browser-confirmed, `39f2543`).** B1 done: 3 eval modes live (PRE `listen_and_look` / EMERGING `listen_for_details` / ESTABLISHED `story_analysis`), MP-1/2/3 cleared, PRE band + tester refactor user-verified. Resume at **B2 (EMERGING polish)** or B4 `/tutor-test` probe; **B5 live `--lesson` @ K still queued** (live tutor beats, not tester-covered). Contract is CONFLICTED — C1's resolution IS this stream; read it first on resume. | 07-16 |
| SP-27 Tutoring Context Integrity | `docs/PRD_TUTORING_CONTEXT_INTEGRITY.md` + sweep `qa/tutor-reports/sweep-2026-07-14.md` | **PARKED 2026-07-16 (deliberate, single-stream focus on reader-fit).** Resume at Phase 0: harden `scaffoldAudit.ts` (invalid-syntax + studentPrompts coverage + fingerprints), **re-run the now-stale sweep** (comparison-builder edits since), cut the monotonic baseline, add the Vitest + report-only runtime gates. NOT urgent — failures cluster in physics/advanced-math sims students aren't routed to; K primitives are already green. **Carry-forward HIGH — RESOLVED + COMMITTED 2026-07-16 (`39f2543`):** the `fast-fact` spoken answer-leak (`scaffoldingLevels.level3` interpolated `{{correctAnswer}}` then said "try again") is FIXED — level3 rewritten answer-free in `catalog/core.ts`; Tier-1 audit re-run confirms the `answer-leak-in-scaffold` finding cleared (fast-fact HIGH→WARN; only a pre-existing `indirect-script` level2 copy nit remains). `correctAnswer` retained in taskDescription/RUNTIME STATE for tutor-reference (allowed). This was the single audibly-harmful SP-27 defect; the rest of the stream stays parked. | 07-16 |
| Primitive contracts | `my-tutoring-app/qa/primitive-contracts/BACKLOG.md` | **12 contracts on disk** — newest **number-sequencer and annotated-example, 2026-08-04**, both derived contract-first inside reader-fit 14h/14j and checked COMPATIBLE. **`--check` guard now exercised ×8, all COMPATIBLE**; reports live in `qa/primitive-contracts/`. Next = #3 **foundation-explorer**, then #4 concept-card-grid. **The pattern persists: contracts land as prerequisites of active fixes rather than standalone pulls**, so the queue's Done section must absorb those out-of-order derivations. | **08-04** |
| Engineering tutoring-scaffold wiring | `my-tutoring-app/qa/engineering-tutoring-scaffold/BACKLOG.md` | **NEW 2026-07-21 (user).** Bring engineering primitives to L2 (`/add-tutoring-scaffold`). **Phase A** = 12 primitives with NO `useLuminaAI` tutor channel (machine-profile, dump-truck-loader, bridge-builder, tower-stacker, gear-train-builder, pulley-system-builder, lever-lab, ramp-lab, wheel-axle-explorer, shape-strength-tester, foundation-builder, blueprint-canvas) — wiring the channel also unlocks read-aloud there (finishes the 07-21 sweep). Pilot A1 machine-profile end-to-end + live-verify BEFORE sweeping A2–A12. **Phase B** = `/tutor-test` the 12 that already have the channel for L2 *sufficiency* (not just presence). Executors: `/add-tutoring-scaffold` → `/tutor-test` → `/reader-fit --fix`. | 07-21 |
| Misconception loop | memory `project_misconception-loop` | Phase 3A | 07-12 |
| Literacy eval-modes densification | memory `project_literacy-evalmodes-densification` | tree is CLEAN (no longer uncommitted — /ship step moot); remaining = `/eval-test` the 6 task-identity ladders to confirm they draw, then close | 07-15 |
| Flash-lite truncation hardening | memory `project_flash-lite-truncation-template` | **⚠️ SUPERSEDED `/pm` 2026-08-16 — do not pull from here.** The "~50-gen sweep" was an estimate with no citation; it is now MEASURED at **33 production generators with a silent fallback (32 math)** and promoted to its own row in the snapshot table above, with a live defect citation from port 5. Pull it there. | **08-16** |
| LuminaReadAloud 🔊 sweep | `qa/HANDOFF_read-aloud-sweep.md` | pilot browser-VERIFIED 07-15 (user); remaining = 🔊 sweep across the other hand-rolled read-aloud surfaces | 07-15 |
| Lumina kit roadmap | `docs/DROPZONE_MIGRATION_PRD.md` + memory `project_lumina-kit-motion-roadmap` | motion tokens + LuminaDropZone COMMITTED (e17679f, e450cb0). DropZone Batch 1 (+2) are CODE-COMPLETE (◐ browser spot-checks pending, PRD tracks them) — "next = B1" was STALE. **DropZone Batch-3 tail CODE-COMPLETE 2026-07-15** (10 migrated + 3 triaged; typecheck:lumina clean; browser spot-checks → HUMAN-CHECKS #13/#14; uncommitted). Next = Batch-4 triage or LuminaCompletionScreen (106 hand-rolled 🎉 blocks). PRD §2 rulings settled | 07-15 |
| Curriculum authoring | memory (K-5 archive) | G5 Science + G5 Social Studies; GK phonics starvation | 07-09 |
| Analytics/snapshot residue | memory | snapshot `--all` + commit; metrics grade-join `--apply` | 07-08 |

**Absorbed:** tutor-test fix campaign (46/130 FAIL) → SP-27. Orphaned tutoring
configs (distribution-explorer, dot-plot) → SP-27 Phase 2/3.

## CLOSED (verified 2026-07-14; reopen deliberately, not by accident)
- **Grade-fidelity sweep close-out** (2026-07-15) — **committed** (`7cb5e5f`). 4/4 tasks closed
  via runtime probe: daily-session grade threading verified HONORED; 11/11 probe-sweep HONORED;
  `gradeToBand`+`buildGradeLine` extracted to `scopeContext.ts`; and a real 6-gen phonics dead
  lever fixed via `clampGradeToK2`. Report: `qa/topic-fidelity/grade-fidelity-closeout-2026-07-15.md`.
  Residual: none.
- **reader-fit 1e sorting-station @ PRE** (2026-07-15) — **committed** (`7cb5e5f`). READY @ PRE for
  `sort_one` + `odd_one_out`; other four modes floored to Grade 1+. jsdom 6/6 + live `--lesson` 3/3.
  Residual = pixel look (HUMAN-CHECKS #12). Report: `qa/reader-fit/sorting-station-PRE-2026-07-15.md`.
- **DropZone Batch-3 tail** (2026-07-15) — code **committed** (`7cb5e5f`). 10 migrated onto
  LuminaDropZone + 3 triaged decorative; `typecheck:lumina` clean. Residual = browser spot-checks
  (HUMAN-CHECKS #13/#14). Next kit move (Batch-4 triage / LuminaCompletionScreen) tracked under the
  PARKED Lumina-kit-roadmap row. Handoff: `qa/HANDOFF-dropzone-batch3-2026-07-15.md`.
- **DeepDive block scaffolding + curator-brief PRE scaffold** (2026-07-15) —
  **user-confirmed live**. BlockTutorHelp + tap-to-explore + the full K-eligible
  PRE read-aloud palette (prose/key-facts/MC/mini-sim/pull-quote/diagram) and
  curator-brief `[READ_SECTION]` auto-narrate all committed (tree clean) and
  behaving in a live lesson. Residual (minor, non-blocking): no jsdom tests yet
  for the new mini-sim/pull-quote/diagram preReader branches; the "toggle-as-core-
  control PREDICT block at PRE" ergonomics question stays a watch-item.
- **K-stage presentation mode (MVP)** (2026-07-15) — **user-confirmed in browser**:
  on-rails one-section rail, wordless arrow advance, `[SECTION_START]` narration
  work. The stream's browser gate is closed. NOTE: per-primitive internal chrome
  (counters/steppers inside components) is a SEPARATE ongoing backlog item — keep
  recording Audit-C chrome FAILs under the BACKLOG systemic entry; the stage only
  removes lesson-level chrome.
- **Gemini Live resumption** (2026-07-15) — **user-confirmed live**. The 1008
  session-duration abort is fixed via `context_window_compression` +
  `SessionResumptionConfig` + GoAway-driven transparent reconnect
  (`backend/app/api/endpoints/lumina_tutor.py`, `LuminaAIContext.tsx`). Memory's
  "NOT runtime-tested live yet / uncommitted" was the last stale caveat — the
  code is committed (tree clean) and the user verified the live behavior.
- **Opus generator-fix lane** (2026-07-15) — all three delegated tasks landed and
  are committed: shape-tracer SHT-1 (code-placed geometry, 4/4 runtime-verified),
  word-workout vowel-scope binding, phoneme-explorer initial-sound routing, plus
  word-flip routing. Residual = PRE band-audit for word-workout/word-flip, which
  lives in the reader-fit queue as **item 10** (not a delegated task). Optional
  2b-P2 chrome band-gate is tracked as reader-fit **item 2b**. Nothing lane-specific
  remains.
- **Pulse Agent v2** — Phases 1–3 + v2.1 + v2.2 SHIPPED, committed AND pushed
  (cb058b9/ecac549/5a5f7d3; main in sync with origin — "push pending" was stale).
  Phase 4 (close-out delta + generation-context) is **optional per PRD §D** —
  reopen only if that delta becomes needed. Residual worth keeping: the
  gate/selector disagreement on student 1004 COUNT001-01-D the harness surfaced.
- **Voice control (knowledge-check pilot)** — TF + MCQ wiring COMMITTED
  (edeadeb); ~~LetterSpotter has NO voice wiring **by ruling** (unbenched
  letter-name homophone class — that's a standing decision, not pending work;
  reopens only if a Voice Studio letter-name bench is built)~~ **⚠️ REOPENED AND
  RESOLVED 2026-08-13 — the ruling was OVERTURNED by the user, and it did not
  reopen the way this row predicted: no Voice Studio bench was built. The judge
  is handed ONE target, so the 26-way classification the block assumed never
  happens. `letter-spotter` `name-it` is SPOKEN, the tiles are deleted, and the
  homophone risk is handled per-ITEM (cluster table in `judgedScriptContract.ts`)
  plus a second accept channel (the letter's SOUND). Third live copy of this dead
  block found this run — see the `/pm` 2026-08-13 note.** Sole residual =
  2-min human mic smoke → HUMAN-CHECKS #11. Platform follow-up noted in memory:
  global single-mic lock before any MCQ voice sweep.

## Standing hygiene
- Human-only verification debt lives in `my-tutoring-app/qa/HUMAN-CHECKS.md` — burn
  down in one browser sitting, not per-stream archaeology. **ONE format, one list,
  newest first (2026-08-13): file new rows at the TOP as `### #N — …`. There is no
  second section to put them in, and there used to be, which is how a row came to
  exist twice and disagree with itself.**
- **Detail belongs in the owning queue; this index carries state + a pointer.** If a
  stream's block here grows past a screen, that is the signal to move it, not to
  keep scrolling.
- **A stale doctrine line costs more than a stale status line.** Status decays
  visibly; a rule ("class X is BLOCKED", "this stream is uncommitted") is copied
  forward by the next session and silently changes what gets built. When a user
  ruling overturns a rule, grep for its prose copies in queues, scripts and
  docblocks — `tsc` cannot see any of them.
- Uncommitted surface: keep it to ONE stream's worth; `/ship` slices as streams
  close work. Shared files (EVAL_TRACKER, BACKLOG, run_tutor_live.py) commit in
  their own slice to reduce cross-session collisions.
