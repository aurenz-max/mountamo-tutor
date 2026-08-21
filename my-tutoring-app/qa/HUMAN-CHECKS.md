# Human Checks — browser/pixel verification queue

Things only a human at a browser can close. Each was verified headlessly
(jsdom/tsc/live-harness) — only the pixel look or a real click remains.
Burn down in ONE sitting: `cd my-tutoring-app && npm run dev`, then walk the list.
When a row is verified, strike it here AND note it in the owning report.
Maintained by `/pm` (Claude) or `$pm` (Codex); each run re-greps reports for new
"browser glance" debt.

## Open — ONE list, newest first (as of 2026-08-17, `/pm`)

> **Newest five:** #117 states-of-matter (third science port, all-spoken) · #116
> habitat-diorama (living ecosystem field lab) · #115 periodic-table (first
> chemistry port) · #114 solar-system-explorer (first science port) · #113
> place-value-chart (the #63 material itself). Next free ID is **#118**.
> Re-grep before filing; concurrent sessions in this lane are normal.

### #117 — **`states-of-matter` (third science port): can a five-year-old's "solid / liquid / gas" survive real ASR, and does the affirmation-run experiment read as the payoff?** · OPEN

Machine gates are green (di-script 37/37, Lumina typecheck 0, census 0+0+0, 480
randomized draws with 0 drops and clean pack gates, headless `--di` green on all
three modes plain AND signature, cap drill PASS). What no machine touched: the
acoustics of the three state words from a child, the two-name compare menus, and
every pixel of the judged stage.

`cd my-tutoring-app && npm run dev`, open a states-of-matter lesson with an eval
mode pinned, and say these OUT LOUD:

1. **observe** — say the SUBSTANCE'S NAME ("water") where the state was asked. It
   must draw the correction, not an affirmation; the contract names this as the
   signature miss. Then say the state. Watch that the beaker shows NO state badge,
   NO particle caption and NO numeric temperature until she affirms.
2. **observe, the honest synonym** — on a water item that is solid, say **"ice"**
   (or "steam" on a gas item). It MUST be accepted; a refusal here fails a child
   who has done the skill.
3. **predict** — say the state it is in RIGHT NOW instead of the one it will reach
   (e.g. "solid" when the wax is being heated past 60°). Refusal expected. Then
   answer correctly and **watch the reveal**: the beaker should ramp to the
   temperature she said she was taking it to, while she says so, and stop when the
   next question starts. That ramp is the whole payoff — check it does not fire on
   the WRONG item (the next one) or flash past.
4. **predict_change (Grade 3-5)** — answer with the resulting STATE ("liquid")
   where the CHANGE word ("melting") was asked. Refusal expected.
5. **compare** — say the wrong one of the two names, then the right one. Listen to
   whether the two substance names are separable to your own ear at speaking speed;
   the code blocks water/butter, water/wax and nitrogen/oxygen, and this sitting is
   where any pair it MISSED shows up.
6. **The stage, in pixels** — two beakers side by side on a compare item; no
   slider, no MP/BP markers, no switcher anywhere; the mic orb never claims to be
   listening for something you cannot say.

Headless drives that are already green and do NOT need repeating:
`cd backend/tests/tutor_live && python run_tutor_live.py --component states-of-matter
--di --eval-mode <observe|predict|compare> [--di-wrong signature]` and `--di-cap`.
Reports: `qa/tutor-reports/states-of-matter-live-di-*-2026-08-20.md`.
Slice: `qa/di/BACKLOG.md` item 25.

### #116 — **`habitat-diorama`: does the spoken/build ecology split feel like field work under a real mic?** · OPEN

Machine gates are green (30 focused assertions, Lumina typecheck 0, census 0,
10 real-generator probes at K and grade 7 yielding 42 contract-clean items), but
the headless semantic drive stalled without producing a report. First rerun
`python run_tutor_live.py --component habitat-diorama --di --eval-mode <mode>
--di-wrong signature` for all five modes on a healthy stack; that still does not
replace this mic/pixel sitting.

1. **Observe:** give the name of a tempting wrong organism, then the clue-matching
   organism. The wrong answer must draw the model-lead-test correction; the right
   one must affirm and advance without a Next control.
2. **Connect:** tap a wrong destination, then the right destination. The tutor is
   silent before the commit and never names where to tap; the source highlight and
   affirmed relationship should clear together on the next ask.
3. **Predict:** after a disruption, name a directly affected but wrong population,
   then trace the food web and name the keyed one. Watch especially plural names
   and multi-word species under ASR.
4. **Restore:** place the candidate in a plausible wrong zone, then its viable
   zone. No Check button or timer may appear; the placement itself is the answer.
5. **Defend:** say the short distinguishing phrase from a wrong evidence card,
   then the strongest card. Confirm the judge accepts a natural short form and
   does not require the whole printed sentence.
6. **Reveal + exploration:** earned explanation appears only with affirmation and
   clears for the next item. Separately open a no-challenge K payload: organism
   taps and read-aloud still work, role jargon stays hidden, and free exploration
   does not turn into a scored quiz.

Report target: `qa/di/BACKLOG.md` item 25. Filed 2026-08-20.

### #115 — **`periodic-table` (second science port, FIRST chemistry): element names under real ASR — long Latinate words, a dialect fork, and a table the child reads while talking** · OPEN

**Why a row.** Every machine gate is green (23 di-script pins, typecheck 0 in-slice, census
0, 270-draw probe with zero drops, headless `--di` drives green on all three modes with
signature wrongs refused 18/18 twice over + the cap drill) — but the drives answer in TEXT,
so the acoustics of element names from a real voice, the mic transport, and the
reveal/axis pixels remain human questions. jsdom is also blind to the judged grid's reveal
ring and wrong-tap flash.

Drive a lesson (or the chemistry tester) with the mic, and say per mode:

1. **The letters-back miss.** On a name-by-symbol item ("the element whose symbol is B, r")
   answer "B, r" first — the contract refuses it (the letters are the question) — then say
   "bromine". Machine-refused 3/3 as text; the mic run tests it as sound.
2. **The dialect fork.** Get an aluminium item (or say it anyway on a nearby name item):
   the contract accepts a close try at the name — US "aluminum" must be AFFIRMED against
   the dataset's British "Aluminium".
3. **The group-label trap.** On a valence item for chlorine say "seventeen" (the number
   printed on the very axis you are reading) — must be refused with the tall-column
   correction — then "seven".
4. **The short form.** On "which atom is bigger — sodium, or potassium?" answer "the lower
   one" — the contract accepts a clear point at the winner; confirm the judge does.
5. **The silent hold.** On find items, tap a NEIGHBOR box: the correction must arrive
   without the tutor ever saying where the right box is — and between your taps the tutor
   must be truly silent (the drive's hands-hold beats were 0 audio bytes; confirm with ears).
6. **The reveal clock.** The element card + emerald ring must appear only WITH her
   affirmation, hold while she speaks it, and clear when her next ask starts. No modal may
   open mid-run; search and category chips must be gone.

Headless first (closes the semantics half — DONE 2026-08-19, all three modes + cap):
`cd backend/tests/tutor_live && python run_tutor_live.py --component periodic-table
--di --eval-mode <mode> --di-wrong signature` (+ `--di-cap --eval-mode identify`). Report
target: `qa/di/BACKLOG.md` item 25. Filed 2026-08-19.

### #114 — **`solar-system-explorer` (FIRST science port, user-pulled reimagining): can a child's planet names survive ASR under a moving sky, and does the spotlight arrive after her ask?** · OPEN

**Why a row.** Every machine gate is green (33 di-script pins + 12 stage pins, typecheck 0
in-slice, census 0, live 10-probe pipeline with zero drops, headless `--di` drives green on
ALL FIVE modes + the cap drill; defect-class-6 [CURRENT STATE] leak found on drive 1 and
fixed with a measured 5-of-6 → 0-of-6) — but the drives answer in TEXT, so the acoustics of
planet names from a real child, the mic transport, and the spotlight/reveal pixels remain
human questions. jsdom is also blind to whether the moving SVG bodies are hittable
([[feedback_svg-g-unclickable-jsdom-blind]]).

Drive a lesson (or the astronomy tester) with the mic, and say per mode:

1. **The onset pair.** On identify items answer "Mars" where "Mercury" is right and back —
   the two share /m/; listen for which the ASR hears from a real voice, and check the
   correction names the planet plus its colour clause ("Mercury — the small grey one").
2. **The Sun trap.** On "which planet is the biggest?" answer "the Sun" confidently — the
   contract refuses it and the correction draws the star/planet line. This is the port's
   best teaching moment; confirm it lands as teaching, not as a rebuff.
3. **The hottest trap.** Answer "Mercury" to "which planet is the hottest?" — must be
   corrected toward Venus, and the AFFIRM (after you then say Venus) must name the trap
   ("even though it is not the closest").
4. **The spotlight clock.** On identify items, watch: the pulsing halo must appear only
   AFTER her ask finishes (runner stimulus gate) and the planet's LABEL must stay hidden
   until her affirmation reveals it in emerald. On a wrong answer, the re-flash waits for
   her correction to finish.
5. **Looking stays free.** Mid-question, zoom, pan, and tap planets open (on a compare item
   the research card shows) — the tutor must stay silent through all of it and judge only
   what you SAY.
6. **A description is not a name.** Answer "the red one" — the contract calls it wrong and
   the correction asks for the name. Confirm this feels like DI, not pedantry, at K.

Headless first (closes the semantics half — DONE 2026-08-19, all five modes):
`cd backend/tests/tutor_live && python run_tutor_live.py --component solar-system-explorer
--di --eval-mode <mode> --di-wrong signature` (+ `--di-cap`). Report target:
`qa/di/BACKLOG.md` item 25. Filed 2026-08-19.

### #113 — **`place-value-chart` (math port 8, the FIRST past the ≤20 bench): the mic row IS the #63 acceptance material — fold the two into one sitting** · OPEN

**Why a row.** Machine gates green (40 di-script pins, typecheck 0 in-slice, census 0, live
6-probe build clean with zero drops) and the headless drives are green (compare plain +
signature, identify signature, build signature, cap drill 0 HIGH after the ones-place leak
fix) — but this pack is the first production caller of `place_value_word`
(accepted-build-ahead, 2026-08-19), so its spoken answers run PAST twenty ("forty", "three
hundred", "ninety thousand") — exactly the multi-word-numeral material sitting #63 owes.
**One mic sitting can close this row AND accept #63**, which unblocks coin-counter,
area-model, array-grid, skip-counting-runner and the whole >20 tier. Price it as
lane-unblocking, not as one row.

Drive a lesson place-value-chart (or the tester) with the mic, and say per kind:

1. **The -ty/-teen ear — the sitting's sharpest question.** Where "forty" is right, say
   "fourteen" confidently; it must be corrected, never leniently matched. Then take an
   `identify` dictation of a TEEN number (thirteen) and a decade (thirty) and listen for
   which the ASR hears from a real voice.
2. **The subset pair.** On a ten-thousands item answer a bare "thousands" — the contract
   calls it the wrong column and corrects; listen that the two-word right answer
   ("ten thousands") survives ASR as two words.
3. **Two-token values.** Say "three hundred" and "ninety thousand" as answers — the
   `place_value_word` class's whole case; then say the signature bare digit ("three") and
   check the refusal, which is the #63 discriminating-judge criterion.
4. **The unit form.** Answer "four tens" where "forty" is right — the accept clause counts
   it, and the affirmation must echo "forty".
5. **The writing turn.** On a dictation, think out loud while typing ("four hundred…
   six…") — the tutor must stay silent (bracket hold); stop typing and check the ~4s
   stillness commit; tap-to-hear must re-dictate the whole number (it is never printed).
6. **The advance is her voice** — no dead air after affirmations; on a wrong answer the
   re-ask must not race her correction.

Headless first (closes the semantics half): `cd backend/tests/tutor_live && python
run_tutor_live.py --component place-value-chart --di --di-wrong signature` (+ `--di-cap`).
Report target: `qa/di/BACKLOG.md` item 18. Filed 2026-08-18.

### #111 — knowledge-check (DI port 23, the FIRST cross-cutting port): the closing assessment goes spoken, and one session mixes five answer materials the mic has never carried back-to-back · OPEN

**Why a row.** Machine gates green (28 di-script pins, typecheck 0, census 0, live 3-probe
build clean) and the headless drive is one command away — but only a mic run proves the loop
a child is in, and this pack is the first whose SESSION switches response class between
consecutive items (yes_no → closed_set_choice → short_spoken_word in one run). Every earlier
port held one or two classes per session.

Drive a lesson knowledge-check (or the tester) with the mic, and say per kind:

1. **true_false — the natural verdicts.** Answer "yes" and "nope" instead of "true"/"false";
   both must be affirmed. Then answer a fragment of the STATEMENT back ("eight legs…") —
   the contract says that judges nothing; a verdict on it is a finding.
2. **choice (spoken menu) — the short form.** Answer with the distinguishing word alone
   ("cow"), then on another item with the position ("the second one"); both are full
   answers. Say a wrong option's short form and check it is corrected, not matched leniently.
3. **sort — the fluent non-placement.** When asked "which group does shark go in", answer
   "shark". The contract treats it as no answer (stay-silent), never as wrong — listen for
   which happens.
4. **blank — the bank distractor.** Say the on-screen word-bank word that does NOT fit; it
   must be corrected. Then say the answer inside the whole sentence — must be affirmed.
5. **choice_tap — the silence bracket.** On a KaTeX/number MCQ, talk while deciding
   ("hmm, maybe this one…") and check the tutor stays silent until you TAP; the orb label
   must read the touch form, never "I'm listening".
6. **The advance is her voice** — after each affirmation the next ask arrives with no dead
   air and no double-flash; on a wrong answer the re-ask must not race her correction.

Headless first (closes the semantics half): `cd backend/tests/tutor_live && python
run_tutor_live.py --component knowledge-check --di --runs 3` (+ `--di-cap`).
Report target: `qa/di/BACKLOG.md` item 23 slice 2. Filed 2026-08-18.

### #110 — **`ordinal-line` (math port 6): the pack REFUSES a word that differs from the right answer by ONE WORD-FINAL FRICATIVE, and that is the hardest sound a five-year-old makes** · OPEN

**Why a row, and why this is the sharpest mic question the lane has had.** Every earlier
port's ear question was "can the judge hear the child at all". This one is narrower and it
cuts both ways, because the pack's own contract makes /θ/ the difference between a correct
answer and the misconception it exists to undo:

- *four* → *fourth*, *six* → *sixth*, *five* → *fifth* differ by a **word-final /θ/**, and
  `sixth` puts it after /ks/ — the hardest cluster in English for a K-1 mouth.
- The contract says the bare counting number is **WRONG however close it sounds** (that is
  the whole point of the `match` and Grade 1 `identify` modes), so:
  - **(a) a child who says "fourth" but drops the /θ/ gets REFUSED while being right** —
    the worst failure this family can produce, a correct child corrected; and
  - **(b) a child who says "four" gets AFFIRMED while holding the misconception** — the
    lesson teaching the exact confusion it was built to remove.
- `--di` sends clean TEXT, so it can see NEITHER. The headless drives refused "four" for
  "fourth" 12/12 and affirmed "fourth" 12/12 — that proves the judge's SEMANTICS and says
  nothing at all about the acoustics, which is the whole of this row.

**Say these, on purpose, and watch which way it goes.**

| Mode | Grade | Say this | It should be |
|---|---|---|---|
| `match` | K | *"four"* over the `4th` card | REFUSED — cardinal for ordinal |
| `match` | K | *"fourth"* said naturally | affirmed |
| `match` | K | *"fourf"* / *"fort"* (the real K articulation) | **affirmed** — this is the row |
| `match` | 1 | *"six"* then *"sixth"* over the `6th` card | refused, then affirmed |
| `match` | 1 | *"seventh"* over the `6th` card | REFUSED — the near-pair |
| `identify` | 1 | *"three"* for a third-place ask | REFUSED — cardinal for ordinal |
| `identify` | 1 | the wrong-END place (say *"eighth"* on a 10-line where the answer is *"third"*) | REFUSED — the #1 recorded misconception |
| `identify` | K | *"the bear"* where the character is **Polar Bear** | affirmed (accept clause) |
| `identify` | K | *"that one"* | REFUSED — a pointing word is not a name |
| `relative_position` | K | the ANCHOR's name (the one the question points at) | REFUSED |
| `sequence_story` | K | a place from the wrong character | REFUSED |
| `build_sequence` | 1 | put them in the wrong order and STOP TOUCHING | commits on stillness, then corrected |

**Four more things only a mic can close.**

1. **Two-word animal names, read aloud and said back.** The live probe drew *Polar Bear*,
   *Sea Turtle*, *Snow Owl*, *Marching Penguin*, *Red Fox*. The accept clause invites the
   short form (*"the bear"*), and ASR on a compound animal name is unmeasured — #107 asked
   a version of this for two-word OBJECT names and it is still open.
2. **`sequence_story` speaks 40-60 words of GENERATED NARRATIVE into an open mic, and the
   narrative NAMES THE ANSWER by construction** (it has to — that is the listening task, and
   it is the pack's only `leakExemptSpan`). #100 asked whether the judge ever credits its own
   voice to the child over a much shorter read; this is the longest version of that question
   the family has shipped.
3. **The stillness window on `build_sequence` (4000ms mid-line / 1500ms full) is hand-tuned
   by ear**, carried over from compare-objects. A K child who pauses to think mid-line and
   gets committed early has spent one of two corrections for free.
4. **The ordinal labels are held behind `runner.revealHeld`** — pixel-check that they paint
   ONLY while the tutor is affirming, on an item that is NOT the last one (18b's defect
   painted the reveal on the final item and nowhere else, in four ports, for a month).

**Everything a machine could hold is green:** 77 tests / 2 suites (8 revert-bites), full tsc
803 = baseline with 0 in any touched file, census greps 0, live probe 10/10 cases across all
five eval modes × both bands with 0 gate issues and 0 leaks, and the headless drives below.
Report: `qa/tutor-reports/ordinal-line-live-di-*-2026-08-18.md`.

### #109 — knowledge-check categorization MICROSTEP (item 23 slice 1): a drag surface became a tap surface, and only a real browser can prove the tap loop · OPEN

**Why a row.** The rewrite is jsdom-green (5 pins) and typecheck-clean, but it replaced
HTML5 drag — which never fires on touch — with tap-to-place, and the whole justification is
tablets. jsdom proves the logic, not the pixels or the touch path.

Drive a lesson whose knowledge-check plans a `categorization_activity` (any G1 `analyze` or
`mixed` topic that routes one), in real Chrome AND once with DevTools touch emulation:

1. **One item at a time:** a single large item card + the group panels; no item list, no
   "Check Answer" button anywhere in the categorization step.
2. **Tap = commit:** tap the right group → chime + green pop, chip lands ✓, next item after
   ~1s. Tap a wrong group → buzz + shake, the chip lands in the **correct** group marked ✗
   (the board must end TRUE), next item after ~2s.
3. **No dead taps:** during the verdict beat, extra taps do nothing (no double sounds).
4. **Container handoff:** after the last item, the rationale card + Try Again render; a
   not-all-correct sort shows the KC container's Next → button and does NOT auto-advance;
   an all-correct sort auto-advances after the dwell.
5. **Touch emulation:** repeat one full sort with DevTools device toolbar on — every tap
   must register (this is the regression the rewrite exists to fix).

Report target: `qa/di/BACKLOG.md` item 23 slice 1. Filed 2026-08-18.

### #108 — `shape-sorter` (DI port 22, 5th MATH port): `shape_name` gets its first PRODUCTION caller, and two of its answers differ by ONE SYLLABLE at the front of a shared word · OPEN

**Why a row.** The standing rule is machine gates + a live probe when a port adds no new
response class and no new answer material. This port clears the first half —
`shape_name`, `number_word_to_20` and `short_spoken_word` are all benched — and fails the
second in a way that is specific and testable, so the row is narrow rather than a full
re-run of the judging contract (proven on five surfaces now).

**The ear question the `--di` drive cannot reach, because it sends TEXT.** The drive proved
the JUDGE separates these; it says nothing about whether ASR delivers them separated.

1. **`pentagon` vs `hexagon` share their last two syllables** (/-əɡɒn/), and `octagon` is in
   the same family if the shape set ever grows. They differ ONLY in the first syllable, spoken
   by a five- or six-year-old. The signature drive refused "pentagon" for a hexagon 6/6 as
   text — but if ASR hears a child's "hexagon" as "pentagon", a CORRECT child is corrected,
   which is worse than a wrong one being affirmed. **Say each one over the other's drawing and
   check the verdict, twice.**
2. **`rectangle` vs `rhombus`** both open on /r/ and are the two longest names in the set.
   Same test.
3. **`diamond` / `rhombus` must BOTH be affirmed over the one drawing** — they are a single
   branch of `renderShapeSVG`, so the pack accepts either by contract. Say the less obvious
   one ("rhombus" at K) and check it is not corrected.
4. **The sort answer is a NUMERAL inside a phrase** — "3 sides" vs "4 sides", accepted as the
   bare number by contract. Say just "three" and check it is affirmed for the "3 sides" group.
5. **`shape_name`'s own bench is a PROBE SET, not a shipped pack** — di-shapes' pack L0 gate
   (#72) has never been driven. This is the class's first production caller in the runner era,
   so a clean sitting here is worth more than one row.

**Not covered by any drive, and cheap to check while you are here:** the `hard` tier for a
READER stops SPEAKING the groups (`namesChoices: false`) and leaves them printed. The harness
has no difficulty flag, so that path is gate-covered and probe-covered only. Run a Grade-1
`sort` at `hard` and confirm the mats are still labelled and the ask says "Which group does
this shape belong with?" with no menu.

**Everything else is machine-green:** 58 di-script tests, 6-case live probe (44 items, 0 gate
issues, 0 leaks), four `--di` drives (26/26 wrong refused, 26/26 right affirmed, including
the near-name 6/6, the off-by-one 4/4 and the shape-name-for-group 12/12), and a cap drill
whose only findings are the known open 18c pair. Report: `qa/di/BACKLOG.md` item 18.

### #107 — compare-objects (DI port 21, 4th MATH port): can a five-year-old SAY an attribute phrase, and does ASR hear a two-word object name? · OPEN

**Why a row at all, when P2/P3 filed none.** The standing rule is machine gates + a live
generation probe when a port introduces no new response class and no new answer material. This
port clears the first half — `short_spoken_word`, `number_word_to_20` and `manipulation` are all
benched — but not the second: it puts two new SHAPES inside `short_spoken_word` that no sitting
has heard.

**What a machine already proved (do not re-check these):** `compare_two` 21/21 wrong refused +
21/21 right affirmed over 3 runs · `non_standard` **signature** drive 21/21 — the off-by-one
(n+1) refused every time · `identify_attribute` 12/12 + 12/12 · `order_three` gesture 7/7 with the
hands-hold beats genuinely silent (0 audio bytes) · cap drill 3/3 `My turn:`, **no
`di-no-verdict`**. Reports: `qa/tutor-reports/compare-objects-live-di-{plain,signature}-2026-08-17.md`.

**What only a mic can close — say these OUT LOUD:**
1. **The attribute phrase.** On `identify_attribute` the tutor asks *"Is the picture showing us
   how long they are, how heavy they are, or how much they hold?"* Answer it three ways and check
   all three are accepted: the full phrase (*"how heavy they are"*), the bare key word
   (*"heavy"*), and the grown-up noun (*"weight"*). A five-year-old will do the middle one.
2. **Two-word object names through ASR.** On `compare_two`, say names like *"cotton ball"*,
   *"jump rope"*, *"frozen popsicle"*. Then say a WRONG one on purpose and confirm the correction
   fires; then say *"that one"* and confirm it is treated as wrong (the contract says so — a
   pointing word is not a name).
3. **The off-by-one out loud.** On `non_standard`, count aloud and deliberately land one too many.
   Machine-proven in text; unproven as speech, and counting-aloud-then-answering is exactly the
   acoustic shape the accept clause has to survive.

**Also needs a browser glance (not the mic — pixels):**
4. **The unit numbering must NOT be visible while the child counts.** `non_standard` numbers the
   measuring boxes 1..n, and the last box equals the spoken answer. It is gated on
   `runner.revealHeld`, so it must appear ONLY while the tutor is affirming. *Should work — not
   driven in a browser.*
5. **The `order_three` close.** Touch two of three and stop: it should commit after ~4s and be
   corrected as incomplete. Touch all three and stop: ~1.5s. Neither is correctness-gated — a
   reversed order must commit just as readily as the right one. Windows are hand-tuned by ear.

> **📐 FORMAT UNIFIED 2026-08-13 (user ruling).** This file used to keep TWO "Open"
> sections in two formats — a `###` section list for the judged-loop era and a 5-column
> table for everything older. **That is what produced the duplicate #97 and the
> "#96 has no row" error the same day**: a new row filed in the table landed 700 lines
> below the row it contradicted. All 68 table rows are now `###` sections carrying the
> same text (what to check / how to reach it / source report), and every open row —
> **78 of them, #98 down to #3** — is in this one list, highest ID first. The two rows that
> existed twice (#95, #97) are now ONE row each: a status block plus a `#### … FULL CRITERIA`
> continuation, both under the same heading. **Nothing was deleted; 1,070 → ~1,360 lines is
> the table rows unfolding into sections.**
> **File new rows AT THE TOP, in this format. There is no second place to put them.**
>
> 🛑 **THE JUDGED-LOOP MIC SITTING IS CLOSED — USER RULING 2026-08-14: *"feels like we're doing an
> excessive amount of testing to close this out, lets just trust the tutor works ive done a lot
> here."*** It is the standing *"QA is a gate, not a census"* ruling applied to this queue, and the
> evidence backs it: **the spoken judge has now refused deliberate errors on THREE independent
> surfaces** — `picture-vocabulary` (#91), `phoneme-explorer` (#92), `letter-sound-link` (#93), plus
> `read-aloud-studio`'s word swap and, on 2026-08-14, **`ten-frame` at 6/6 refusals and 6/6 affirms
> with zero errors either way**, which carried it into math. **Every remaining row was a re-run of
> that one contract on another surface.** Struck as a block: **#82 · #83 · #84 · #85 · #86 · #87 ·
> #89 · #94 · #95 · #96 · #97 · #98.**
>
> **What we are knowingly carrying, so nobody has to re-derive it later:**
> - **The counting-vs-total split is UNVERIFIED.** `subitize` is supposed to refuse *"one… two…
>   three… four"* while `counting-board` accepts the identical utterance. Every wrong answer ever
>   driven was a bare wrong number. If subitize ever reads as too lenient, this is the first thing
>   to look at — it is a *pedagogy* risk, not a broken loop.
> - **`make_ten`, `operate`, and the stillness commit on `build` have been walked but never
>   answered wrong.** The machinery is confirmed; the refusals are inferred from the shared judge.
> - **Three real defects are OPEN and unfixed** (`qa/di/BACKLOG.md` item 18c): a sub-second noise
>   restarts a correction from the top; a capped item asks a question then withdraws it; the
>   correction never varies. These are development work now, not verification debt.
>
> **The rule going forward: a judged port ships on its machine gates + a live generation probe.**
> A mic row is filed only when a port does something the contract has NOT already proven — a new
> response class, a new answer material, a new stimulus mechanism — not once per surface.
>
> ⚠️ **STILL OPEN: #90** (`multiplication-explorer` — does each challenge draw its own fact, and
> does the picture agree with the equation?). **It survives this ruling because it is not about the
> tutor at all** — it is a ten-second screen glance at a correctness fix that reached production,
> and no judge drive covers it. **Plus the ~64 older pixel-debt rows (#3–#81)**, a backlog rather
> than a sitting. Rank first, count second.
>
> *(#93 was struck between the merge and this line — the count in the merge banner above says
> 78 and is already one stale. Which is the third demonstration in two days of why this file
> should rank rather than count.)*

### #106 — **`sentence-analyzer` (DI port 20): the first pack whose answer set is ABSTRACT METALANGUAGE, and the first with a genuine SUBSET pair in its vocabulary** · OPEN

**Filed under the standing rule.** The machine half is closed: four eval modes driven headlessly,
30 judged items, 30/30 refused on purpose and 30/30 affirmed, reports in
`qa/tutor-reports/sentence-analyzer-live-di-*-2026-08-17.md`. Three things only a room can answer.

**(a) THE ANSWER IS A WORD THE CHILD HAS NO PICTURE FOR.** Every earlier literacy port's answer was
a thing — a word, a sound, a genre, a mat, a yes/no. "Adjective", "Predicate" and "Declarative" are
metalanguage: four-syllable Latinate terms a child says haltingly, half-remembered, often with the
stress in the wrong place (*ad-JEC-tive*, *DEC-la-ra-tive*). The text drive types them perfectly.
Ask: does a hesitant, mis-stressed *"ad-jec... adjective?"* get affirmed, or does the judge want it
fluent? A child who KNOWS the answer and struggles to pronounce it is the exact case this pack must
not refuse.

**(b) "NOUN" IS INSIDE "PRONOUN", AND THE PACK DELIBERATELY REFUSES THE PARTIAL.** The family's usual
move for a subset pair is `pruneForEar` — drop one option. That is impossible here: both are core
curriculum vocabulary and telling them apart IS the mode, so the contract instead says in as many
words that *part of a label is not the label*. The text drive confirms the judge refuses "Noun" for
a pronoun. **In a room, the two words are also acoustically nested** — a child saying "pronoun" with
a swallowed first syllable produces something very close to "noun". Ask:
- Does a clearly-said "pronoun" ever get scored as "noun"?
- Does the strictness clause make the tutor refuse a child who was right but quiet?
- Same question one band up for `Direct Object` / `Indirect Object`, where the whole difference is
  an unstressed prefix.

**(c) `label_all` IS THE LONGEST SINGLE-ACTION STRETCH THE FAMILY RUNS.** Up to four `name-pos` asks
back to back over ONE sentence, then four more over the next. The protocol is spoken once
(`introducesAction`) and the asks differ only by the word named. Ask: does that read as a brisk drill
— which is what DISTAR intends — or as a machine asking the same question eight times? This is the
first pack where the recitation risk is in the RHYTHM rather than in a repeated line, and no gate
measures rhythm.

**Drive it at grade 4+** (`identify_role` and `parse_structure` do not exist below grade 3 — the role
vocabulary is not in scope, and the pack builds nothing rather than degrade). `parse_structure` is
the one to watch: it carries the answer-key fix, and its asks are the two-word "subject or predicate"
binary.

### #112 — **`sorting-station` (DI port 20, math port 7): the first pack whose SESSION is one mode repeated a dozen times, and the first to ask a child to NAME A PICTURE with no menu at all** · OPEN

Ported 2026-08-18 on the user's own reading of the primitive — *"there's a lot of mental complexity
for young learners, maybe use as an opportunity to simplify and make sequential with voice DI
control."* All seven eval modes speak; the drag-to-bin, three Check buttons, the attribute buttons,
the number steppers and the odd-one-out tap are gone. Machine gates are green and unusually broad
(7/7 modes live-probed, 27/27 challenges kept, 0 drops; plain + signature drives PASS on four modes;
cap drill 0 HIGH). What no text drive reached:

- **`odd_one_out` asks the child to NAME A PICTURE, and the ask deliberately lists nothing.** Every
  other closed-set ask in the family names its options aloud; this one cannot, because saying the six
  cards would say the answer. So the child must produce the word for a picture from their own
  vocabulary — and the accept clause leans on *"a close everyday word for the same picture"*. Say
  **"the truck"** for a card labelled *Fire Truck*, **"doggy"** for *Dog*, **"the round one"** for
  *Ball*. The first two should be accepted; the third should not (it is a description, not a name).
  This is the mode most likely to fail a child who is RIGHT.
- **A dozen consecutive asks of one template.** One challenge is now one judged turn per object, so a
  `sort_one` session is *"Your turn. Listen: X. Need, or Want?"* ten to twelve times. The repeat-ask
  gate passes it because the content varies — but only an ear can say whether it is a DRILL (which is
  the method) or a DRONE. Listen for whether you would want to be the child on ask nine.
- **The count kinds say a number into a room where the answer is also a pile of pictures.** On
  `count_group` the child may count aloud on the way — *"one, two, three… three!"* — and the contract
  says only the number they LAND on is the answer. Drive it: count aloud slowly and land right; then
  count aloud and land wrong. The first must be affirmed, the second refused.
- **`two_attributes` is the contract's G2 unlock, and it is a `yes_no` answer at volume.** Rides
  #94's owed acceptance. Say *"yeah"*, *"nope"*, *"it is"*, *"only one"* — all named in the accept
  clause, none of them the bare word.

⚠️ **Not a mic question but ask it while you are there:** the K band floor is UNMOVED by this port
(contract R3 — unflooring needs a reader-fit re-audit, not a catalog edit). At Kindergarten a child
still gets only `sort_one` and `odd_one_out`. Whether the other five should now be unfloored is the
decision this port was built to make possible.

### #105 — **`genre-explorer` (DI port 19): `yes_no` gets its first high-volume caller, and the tutor now speaks 20-70 words of GENERATED NARRATIVE into an open mic before every band-floor ask** · OPEN

**Filed under the standing rule — and the genre NAMES are not the new part.** word-sorter proved
the multi-syllable label from a printed set (`short_spoken_word`, #102), so "Fable" / "Historical
Fiction" inherit it. Two things are genuinely new:

**(a) `yes_no` IS TWO THIRDS OF EVERY SESSION NOW.** The class has been `accepted-build-ahead` since
the 2026-08-12 rhyme-studio ruling with its acceptance drive owed on **#94**, and every caller since
has used it for a handful of items. Here it is the evidence step of all three eval modes — four to
six judged yes/no answers per sitting. Three ear questions no text drive can reach:
- **"no" is VC-length**, the length `short_spoken_word` records as unbenched. Does a five-year-old's
  clipped *"no"* survive the amplitude bracket, or does it fall under the open-mic floor?
- The contract accepts *"yeah" / "nope" / "it does" / "it does not"*. Do those actually get affirmed,
  or does the judge want the bare word?
- **The tutor's own affirmation opens with the word "Yes" even when it affirms a NO.** On screen and
  in the transcript that is correct and gate-proven. **In a room, does a child hear "Yes, that is
  right — this one does not have animals that talk" as agreement with their "no"?** That is a
  pedagogy question a machine cannot answer.

**(b) THE LONGEST TUTOR SELF-AUDIO WINDOW THE FAMILY HAS SHIPPED.** At grades K-2 the tutor reads
each text aloud before asking — 20-70 words of generated narrative, sometimes with dialogue — into
a mic that is open the whole time (open-mic doctrine; no tutor-busy gate, by ruling). Every earlier
port's tutor spoke a sentence. Ask:
- Does the loop ever credit the tutor's own voice to the child across a window that long? (story-talk
  #100 asks the same question over a much shorter read.)
- Does the child interrupt mid-read, and if so does the turn machine recover?

**How to reach it:** `cd my-tutoring-app && npm run dev`, Lumina tester → Genre Explorer.
- `identify_basic` **at grade 1 or K** for the read-aloud + yes/no path (the one that matters most).
- `classify_genre` at grade 3-4 for the multi-way genre name.
- `compare_genres` at grade 5-6 for *"Does the first one … , or does the second one?"* → say
  **"the first one"**, and separately try just **"first"** (the contract accepts the short form).

**Wrong answers to say on purpose:** the FEATURE said straight back (*"animals that talk"* — the
signature wrong the contract names; refused 27/27 headlessly, but that was TEXT); the opposite
verdict; **"both of them"** on a contrast; and a SIBLING genre — *"Folktale"* where the answer is
*"Fable"*, *"Autobiography"* where it is *"Biography"*.

**Source report:** `qa/di/BACKLOG.md` item 22, port 2 close block. Machine evidence: 6 headless
drives (`qa/tutor-reports/genre-explorer-live-di-*-2026-08-17.md`), 0 HIGH on the cap drill,
67 di-script tests, 6-case live probe. **None of it is acoustics.**

### #104 — **`text-structure-analyzer` (DI port 18): the family's first MULTI-WORD CONNECTIVE answers, said by a child who is READING them off a page** · OPEN

**Filed under the standing rule — this is NEW ANSWER MATERIAL, and `closed_set_choice` is not the new part.**
word-sorter proved the closed set at scale and decodable-reader proved the proposition menu, so
`name-structure` ("Cause and Effect" from a printed list of three) inherits both. What neither covers is
**`find-signal`**, whose answers on three of the four eval modes are not words at all but PHRASES:
**"As a result", "In contrast", "The problem is", "One solution", "on the other hand"** — three and four
function words with no stress and no content. `short_spoken_word` is benched for *one short word from a
closed per-item set*, and a four-word run of unstressed function words is a different acoustic object.

⭐ **What makes it a real question, and why `--di` cannot reach it.** Over a text channel these judged
perfectly — 16/16 refused, 16/16 affirmed, four modes, zero HIGHs. Over a mic, three things change and
none of them are visible in a transcript:
  (a) **function-word phrases are the worst case for an amplitude bracket.** "As a result" is three
      unstressed syllables a child reads haltingly off a page — *"as… a… result"* — and our turn closes
      on silence. If it splits, the judge is handed "as" and refuses a correct answer. This is
      di-sentence-reading's `silenceCloseMs` finding aimed at the shortest possible connected text, and
      this pack does NOT raise the window.
  (b) **the accept clause invites a fragment by design.** It accepts the phrase "alone or inside a little
      phrase" — so *"it is because"* and *"the word as a result"* are correct, which means a truncated
      transcript of a right answer and a genuine miss can be the same string.
  (c) **ASR swallows short function words.** "In contrast" against "contrast", "One solution" against
      "solution" — whether the transcript arrives whole is unmeasured, and the judge is handed the whole
      phrase as its target.

**What to check (~6 min, one session):**
1. `npm run dev` → a text-structure-analyzer lesson at Grade 4, eval mode `problem_solution`. Tap the mic
   once. The tutor should say *"Read sentence two. Which word links the ideas?"* and then STOP.
2. Say a multi-word connective **fluently** — "the problem is". It must affirm with
   `"Yes, The problem is is the word that links them."`
3. Say the same phrase **haltingly, with real pauses** — *"the… problem… is"*. This is a CORRECT answer.
   If it is refused, read the transcript: a fragment means the silence window closed early and the fix is
   `silenceCloseMs`, not the contract.
4. Say a **content word from the same sentence** ("stormwater", "flooding"). It must be REFUSED — this is
   the pack's named signature error and the one a lenient judge affirms.
5. Switch to `chronological_description` and confirm the tutor says **"Read sentence one"**, never "the
   first sentence" — the ordinal form leaked the answer and was fixed on 2026-08-17 (see below).
6. On the structure step, say just **"cause"** for "Cause and Effect". The short form is a full answer by
   contract; confirm it is affirmed and not refused for diction.
7. ⚠️ Confirm the tutor NEVER reads the passage aloud, at any beat, including a re-ask.

**Machine evidence already in hand** (so this row is only the acoustic half): 5 live drives across all
four eval modes — **16/16 wrong REFUSED, 16/16 right AFFIRMED** on the first mode and PASS with zero
findings on the other three; `packGateIssues: []` on live content in every mode; every session ALL-VOICE
(0 gesture items); exactly ONE `name-structure` item per run, which is the payload shape resolving the
scope's headline §4d worry structurally. The `problem_solution` drive refused **"Cause and Effect"** —
the nearest-sibling discrimination axis 2 deliberately manufactures — 2/2.
⭐ **The drive EARNED its keep on this port:** the first `chronological_description` run caught a
CONFIRMED HIGH `di-answer-leak-in-ask` 2/2 — the ask named the sentence by ORDINAL ("Read the **first**
sentence") and a chronological passage's signal words ARE ordinals, so the archetypal item said its own
answer aloud before asking for it. Worst possible landing (Tier-1 mode, grade-2 band floor). Fixed to
cardinals + a general `askIsAnswerFree` build gate that DROPS any item whose ask contains its own answer;
re-driven PASS.
**Source reports:** `qa/tutor-reports/text-structure-analyzer-live-di-{signature,plain}-2026-08-17.md` ·
**queue:** `qa/di/BACKLOG.md` item 22.

### #103 — **`word-builder` (DI port 19): the longest spoken answers the family has judged, from the oldest students it has had. Does a four-syllable academic word survive the path?** · OPEN

**Filed under the standing rule — this is NEW ANSWER MATERIAL, and it is new in two directions at once.**
The response class is `short_spoken_word` (benched nine ports over) but every previous member of it is one
or two syllables: "cat", "sun", "push", "Animals". This port's answers are **"unhelpful", "telescope",
"interaction", "metamorphic", "displacement"** — three and four syllables, several of them Greek/Latin
academic vocabulary a Grade 6 student is meeting for the first time. And it is the **first judged port
above the K-2 band**, so it is also the first time the mic has been asked to carry a Grade 3-8 voice.

⭐ **What makes it a real question, and why `--di` cannot reach it.** The judge is handed one target and
asked whether the child said it, which is safe arithmetic on a short word. Over four syllables three
things change and none of them are visible over a text channel:
  (a) **the accept clause invites a fragmented utterance by design** — "built out loud part by part so
      long as the whole word arrives at the end" — so the child's audio is legitimately *"un… help…
      ful… unhelpful"*, and our amplitude bracket may close the turn on one of those internal pauses and
      hand the judge a fragment. This is di-sentence-reading's `silenceCloseMs` finding in miniature, and
      this port does NOT raise the window (a word is not connected text). If it splits, raising it is the
      fix and the row is what will say so.
  (b) **the named signature wrong is a PREFIX of the right answer.** The contract refuses the root said
      back ("help" for unhelpful, "scope" for telescope, "thermo" for thermometer) — but a truncated
      transcript of a correct answer looks exactly like that miss, so a transport failure and a genuine
      error are the same string. Refused 7/7 over text; over a mic it is the case to watch.
  (c) **ASR normalisation on an unfamiliar academic word.** A Grade 6 saying "metamorphic" for the first
      time will approximate it; whether the transcript comes back as the target, as a near-miss the judge
      refuses, or silently corrected to something else is unmeasured.

**What to check (~5 min, one session):**
1. `npm run dev` → a word-builder lesson at Grade 4, eval mode `compound_affix`. Tap the mic once and say
   the whole word **fluently**. It must affirm with `"Yes, <word> — <part>, <part>, <part>."`
2. Say a word **part by part with real pauses** — *"un… help… ful… unhelpful"*. This is a CORRECT answer
   by contract. If it is refused, check the transcript: a fragment means the silence window closed early.
3. Say **only the root** ("help"). It must be REFUSED with `"My turn: take the meaning apart…"`.
4. Say the parts **in the wrong order** ("fulhelpun"). It must be refused.
5. Switch to `greek_latin` at Grade 6 and say a four-syllable target ("metamorphic", "atmosphere"). This
   is the acoustic edge of the class.
6. Get one item wrong twice to reach the cap and confirm the close line names the word AND its parts —
   that is the only beat where the link is made for a capped item.

**Machine evidence already in hand** (so this row is only the acoustic half): 7 live drives across all
four eval modes — 27/27 wrong REFUSED, 24/24 right AFFIRMED, the signature wrong (the root said straight
back) refused **7/7**, **24/24 affirmations were the bare scripted line with zero embellishment**, and the
cap drill produced no `di-no-verdict` (18d held, authored in from birth) — only the known-open 18c(c)
verbatim-repeat WARN this pack's contract deliberately commands.
**Source reports:** `qa/tutor-reports/word-builder-live-di-*-2026-08-16.md` ·
**queue:** `qa/di/BACKLOG.md` item 16.

### #102 — **`word-sorter` (DI port 18 of the sweep): the answer is a multi-syllable CATEGORY LABEL, accepted with its ending changed. Does the ear separate two labels a word-level gate calls distinct?** · OPEN

> ⚠️ **FILED LATE by `/pm` 2026-08-17.** The word-sorter ship block (`3bd7eeca`, `qa/di/BACKLOG.md`
> item 16) states *"Mic row #102 filed"* — **it was not**; the commit never touched this file, and
> the ID sat vacant between #101 and #103 for a day. Reconstructed from that block, which carries the
> full ear question. *The claim-and-no-row failure mode is cheap to repeat: a port's own ship block is
> not evidence its row exists — grep this file for the ID.*

**Filed under the standing rule — NEW ANSWER MATERIAL.** `short_spoken_word` is benched on short
CVC-shaped words. This port's answer is a **multi-syllable category label from a per-item closed set**
("Animals", "Liquids", "Past"), and the contract **accepts it with its ending changed** — a child's
"animal" is correct for "Animals". Neither half is covered by an existing bench.

⭐ **Two ear questions `--di` cannot reach, because it sends text:**
  (a) **the ear-separability gate is WORD-level, not phonetic.** It passes "Critters"/"Creatures" and
      "Ice"/"Eyes" as distinct labels, which they are on paper. Over a mic on a binary sort, two labels
      that collide acoustically make the item unanswerable — and the child will be scored wrong for it.
  (b) **does a K child's "animal" actually get affirmed for "Animals"?** The singular/plural accept is a
      contract clause, judged in-band; no drive has heard it spoken by a child-shaped voice.

**What to check (~5 min, one session):**
1. `npm run dev` → a word-sorter lesson at **Grade K**, eval mode `binary_sort`. Tap the mic once. The
   tutor should say *"Your turn. Listen: cat. Which group does it belong with?"* — the mats stay printed,
   nothing is tappable.
2. Say the label **in the singular** ("animal" for "Animals"). It must be AFFIRMED. A refusal here is the
   accept clause failing over audio, not a diction problem.
3. Say the **stimulus word straight back** ("cat"). It must be REFUSED — the pack's signature error,
   12/12 refused headlessly.
4. Drive a session whose labels are near-homophones if one draws (**"Critters"/"Creatures"**). If both
   route to the same verdict, the fix is a PHONETIC separability gate, not the contract.
5. Switch to `difficulty: hard` at a reading band and confirm the ask **names no groups** — the mats are
   printed and the tier withholds the criterion. At **K** the floor must beat the tier: the ask names them
   anyway (a pre-reader cannot read a mat). ⚠️ **This is the one path no drive covered** — the headless
   runs are all at the harness default Grade 3.
6. On `match_pairs`, confirm the bank does **not** shrink as pairs are made: the last pair must still show
   all N options. The click era consumed them, which made the final pair answerable without reading.

**Machine evidence already in hand** (so this row is only the acoustic half + the K floor): live probe
17 challenges / 0 dropped / packs clean across 3 eval modes × 3 grades × 3 tiers; headless drives
**binary_sort 12/12 refused + 12/12 affirmed ×2 runs; ternary_sort 12/12 + 12/12 ×2; match_pairs
signature 12/12 + 12/12 ×2** over opposites and rhymes; cap drill 14/14 refusals + 11/11 affirms after
the two fixes (`VERDICT_ENDS_THE_TURN` — 11 of 12 affirmations had run on into a FABRICATED next ask,
0/12 on the re-drive — and the deleted move-on close line).
**Source:** `qa/di/BACKLOG.md` item 16, port 18 block · commit `3bd7eeca`.

### #101 — **`word-workout` (DI port 16): the child's answer set now contains a NONWORD. Can the in-band judge hear "zat" as not-"cat"?** · OPEN

**Filed under the standing rule, not by habit — this is NEW ANSWER MATERIAL.** Every spoken answer the
family has driven so far is a real word, a sound, a count or a whole read line. `real_vs_nonsense` puts a
PSEUDOWORD in the answer set: the child reads "cat" and "zat" and says the real one, and the miss to catch
is them saying the pseudoword. No new response class (`short_spoken_word`, benched six ports over) and no
new stimulus mechanism.

⭐ **What makes it a real question:** the pair is ear-separable BY BUILD GATE — same length, different
onset (`pairEarSeparable`), because a pair differing only in its final stop ("cat"/"cak") has no honest
verdict from audio. That gate is reasoning, not evidence. What nobody has heard is whether a five-year-old
saying a nonword survives the path at all: ASR has no lexical entry for "zat", and the failure mode is
silent — it normalises to the nearest real word, which here is the *right answer*, so a wrong answer would
be AFFIRMED. A machine drive cannot touch this: `--di` sends the student's turn as TEXT, where "zat" is
just a string the judge refuses correctly (8/8, ×2 runs).

**What to check (~4 min, one session):**
1. `npm run dev` → a word-workout lesson at Grade 1, eval mode `real_vs_nonsense`. Tap the mic, then say
   the **nonsense word** out loud, clearly. It must be REFUSED with
   `"My turn: <real> is a real word. <Nonsense> is just silly sounds. Your turn. Which one is a real word?"`
2. Say the **real word**. It must affirm — and confirm the tutor never said either word before you did
   (the cold read is the whole mode).
3. Say the nonsense word **mumbled / half-decoded**, the way a child sounding out actually does. This is
   the case where a normalising transcript is most likely to hand back the real word.
4. On a `word_chains` item, read the PREVIOUS word of the chain instead of the lit one (the signature
   miss). It must refuse; the correction names what changed unless the support tier withdrew that cue.
5. On `sentence_reading`, read the sentence with ONE small word swapped ("a" for "the"). The contrast
   branch must name the words you actually said, not re-read the whole line.

**Machine evidence already in hand** (so this row is only the acoustic half): plain drive 3/3 refused +
3/3 affirmed; signature drive (the pseudoword) 8/8 refused + 8/8 affirmed ×2 runs; word_chains signature
(the previous chain word) 8/8 + 8/8; sentence_reading 6/6 + 6/6 across read and comprehension items;
picture_match gesture holds silent 5/5 at 0 audio bytes; cap drill clean after two fixes it found.
**Source reports:** `qa/tutor-reports/word-workout-live-di-{plain,signature}-2026-08-14.md` ·
**queue:** `qa/di/BACKLOG.md` item 16.

### #100 — **`story-talk` (DI port 15): the tutor now READS THE ANSWER ALOUD, on purpose, into an open mic. Does the judge ever credit its own voice to the child?** · OPEN

**Filed under the standing rule, not by habit — this is a NEW STIMULUS MECHANISM.** Every judged
port so far referred to a stimulus the child could see; story-talk is the first whose stimulus is a
**multi-sentence read-aloud that contains the target word**, because the task is recalling a detail
from a story ("Who hid the acorn?" — the answer is in the story or the question is unanswerable).
No new response class (`short_spoken_word`, benched five ports over) and no new answer material.

⭐ **What makes it a real question and not a formality: the port DELETED the click era's mic gate,
and that gate existed for exactly this.** `StoryTalk.tsx` used to run its microphone only while the
tutor was fully silent (`!isAIResponding && !isAudioPlaying`), with a docblock calling itself *"a
deliberate, narrow exception"* to the standing open-mic rule — because a separate Azure capture
could hear the TUTOR say the answer word through the speakers and credit it to the child. The port
removes the reason rather than the rule: the judge IS the tutor, judging its own session's audio
in-band, so it cannot mistake its read-aloud for the learner. **That reasoning is sound and it is
un-driven.** A machine drive cannot touch it — `--di` sends the student's turn as TEXT, so the
tutor's audio never competes with a learner utterance at all.

**What to check (~4 min, one session):**
1. `npm run dev` → a story-talk lesson at K. Tap the mic once, then **say nothing at all** through
   a whole story. The tutor must read, ask, and then WAIT — it must not affirm, and the answer word
   it just spoke must not come back as a verdict.
2. Answer **wrong on purpose** with another thing from the same story (the signature error). It must
   refuse with `"My turn: <answer>. Your turn. <question>"` and hand it back.
3. Answer **right**, and confirm the story text + answer emoji appear only THEN (reveal-on-affirm).
4. On a `feeling_check` story, answer with a **synonym** ("unhappy" for sad). The contract accepts
   fair variants and echoes the canonical word — confirm it affirms rather than correcting.
5. Tap 🔁 mid-story: the whole story re-reads and the question comes again, with no extra emphasis
   on the answer word.

**Machine evidence already in hand** (so this row is only the acoustic half): judge 15/15 wrong
refused + 15/15 right affirmed ×3 runs on `who_what_where`, both inference modes driven, signature
drive 5/5 (another *feeling* refused every time), cap drill clean, live probe 15/15 challenges kept.
**Source report:** `qa/tutor-reports/story-talk-live-di-{plain,signature}-2026-08-14.md` ·
**queue:** `qa/di/BACKLOG.md` item 16.

> ### `/pm` 2026-08-14 refresh — **NO new rows filed, and that is the point**
>
> **One current-era row remains open: #90.** Two 08-14 slices landed (port 13
> `addition-subtraction-scene`, and `/tutor-test --di`) and **neither filed a mic row** — the
> first application of the new standing rule. Correct in both cases: port 13 introduced no new
> response class, answer material, or stimulus mechanism, and `--di` is a headless harness with
> no pixels. Re-greped every `qa/` report newer than the previous as-of date for
> `browser glance` / `NOT browser-verified` / `needs a browser check`: **zero hits.**
>
> ⚠️ **TWO OLD ROWS WERE RE-BASED, NOT STRUCK — #4 and #31, and both had gone quietly WRONG.**
> The two DI math ports deleted the exact UI those rows told you to look at (`NumberTileRow` at
> K; the Grade 1–2 make-ten stepper), and **#31's *"final empty-cell tap auto-completes"* was
> describing the SP-31 defect as if it were the spec.** ⭐ **The general trap: a pixel row ages
> against a primitive that keeps moving, and a stale check is worse than a missing one** — it
> spends a human's scarcest attention hunting a component that no longer renders, and it reads
> as coverage. **Whoever ports a primitive owns re-basing its open pixel rows in the same
> slice.** Both rows now carry the SP-31 probe (answer it WRONG on purpose and confirm the
> primitive lets you), which is the cheapest thing a human can do that no machine gate does.


> **THIRTEEN CURRENT-ERA ROWS OPEN — #82 · #83 · #84 · #85 · #86 · #87 · #89 · #90 · #94 ·
> #95 · #96 · #97 · #98. Next free ID = 99.** Twelve are the one mic sitting; #90 is a screen
> glance. **STRUCK so far: #88, #91, #92, #93** *(#93 struck 2026-08-13 on the user's
> letter-sound-link drive — the held-SOUND judge refused the letter name)*. ⚠️ **This count covers the judged-loop era only —
> the ~64 older pixel-debt rows (#3–#81) continue below in the same list.** ~~Two Open sections
> in two formats remains the underlying defect (flagged 2026-08-12, still not restructured — it
> now needs a user call, not another flag).~~ **✅ RESTRUCTURED 2026-08-13 on the user's ruling —
> there is one list now, and this paragraph's own "second table" wording was left behind by that
> merge.**
>
> ⚠️ **`/pm` 2026-08-13 — THREE CORRECTIONS, and two of them were the register contradicting
> itself:**
> - **#96 DOES have a row** (`decodable-reader`, port 10) — it is in the second table, filed by
>   the porting session. The note below saying it "has no row here yet" was wrong when written,
>   and the count above omitted it. **Fourteen, not thirteen.** *(Same failure as 08-12's
>   in-run miscount: a count is written from a read that is already old.)*
> - **#97 EXISTS TWICE, and the two records disagree.** The section below still describes a
>   TAP-ONLY pack that was NEVER DRIVEN; the table row (filed later, by the drive session) has
>   `name-it` **converted to a SPOKEN answer** on a 2026-08-13 user ruling and the row
>   **PARTIALLY DRIVEN**. The section has been corrected; the table row keeps the full criteria.
> - **`letter_name` IS NO LONGER A BLOCKED RESPONSE CLASS.** The user overturned it on the
>   letter-spotter drive (`6ada8c0a1bcf`): *"they should be able to translate the sentence and
>   missing letter verbally. they dont need to click a button."* `judgedScriptContract.ts` has
>   it as `accepted-build-ahead`. Two live registers still said BLOCKED three hours later —
>   `qa/di/BACKLOG.md` standing gate 1 and `cvcSpellerScript.ts` — both fixed this run.
>
> **#98 (`ten-frame`, FIRST MATH PORT) is PARTIALLY DRIVEN, not never-driven — FOUR user drives
> on 2026-08-13.** Drives 1–3 each found a BLOCKING defect (a dead frame from a stage gate the
> runner never returns to; a flash killed by `micLevel` re-render churn — mic-open only; the
> flash firing before the tutor's line instead of after), all fixed; **drive 4 walked all four
> modes end to end — *"tested all the modes, worked great."*** ⚠️ **The row stays open for a
> narrow reason: every drive answered CORRECTLY, and nothing about the JUDGE has been heard.**
> Its headline criterion is unique in the family — subitize must REFUSE counting-to-the-answer
> while `counting-board` ACCEPTS the identical utterance — so drive it **with #86**, which
> shares its engine and its number-word handling. It also carries the first check of the
> STILLNESS commit (the mechanism that closes a hands-only turn), whose 3s window was tuned by
> ear and is the likeliest thing in the port to be wrong.
>
> **#97 (`letter-spotter`, port 11) is PARTIALLY DRIVEN — and the port changed shape underneath
> it.** It shipped tap-only; the user's drive ruled `name-it` spoken, and the four option tiles
> are gone (a menu floors a guess at 25% and turns production into recognition). The mic run
> `de8a6a78d9db` confirmed spoken name-it (*"much better"*) and a clean bracket hold — zero
> stray tutor turns across six tap items. **Still owed: the wrong-answer half** (say the WORD
> back and hear it refused; the SOUND channel affirmed) **and the match-it repetition re-drive.**
>
> **#95 is HALF-DRIVEN as of 2026-08-13 — `accuracy` cold read + a deliberate word swap both
> held, correction refused and withheld the advance; `expression` / `dialogue` untouched.**
>
> 🚨 **2026-08-12 — THIS QUEUE CHANGED CHARACTER TODAY. `main` was fast-forwarded to `6161a0f`
> and pushed on a user ruling, so EIGHT of these rows describe surfaces that are LIVE IN
> PRODUCTION *as soon as Vercel builds `6161a0f`* — the push is confirmed, the deploy is not
> (see the PROD row: `vercel.json` has no branch config, so auto-deploy could not be verified
> from the repo).** #82–#87, #89 and #93 are no longer pre-ship gates — they are production
> checks, and the pilot family's account is on the live site. The user took that trade
> knowingly (both #91 and #92 passed first drive with deliberate errors), but the arithmetic
> of this queue inverted: **an unswept row used to delay a ship; it now describes something a
> child can reach.** Not in the ff, and still pre-ship: **#94** (`rhyme-studio`, port 8) and
> `/add-di-loop`, both uncommitted. #90 (`multiplication-explorer`) IS live — `927b754` was
> the correctness fix in that push.
>
> ⚠️ **#94 (`rhyme-studio`, port 8) is filed in the SECOND "Open" section's table at ~line 745,
> not up here with #93.** It was written minutes after this block, by the session that shipped
> the port. Nothing is wrong with the row — it is the most detailed one on the queue — but a
> brand-new row living 700 lines down among 2026-08-05 rows is how a sitting misses it. **Two
> "Open" sections in two formats is the underlying defect; flagged, not restructured.**
>
> **⭐ 2026-08-12 — DRIVE #93 AND #89 FIRST, AND DRIVE THEM SEPARATELY. They are the only two
> rows on this queue that are not "the same contract on another surface."** With #91 and #92
> both passing on the user's first drive with deliberate errors, the spoken judge's refusal
> behaviour has two independent user strikes — so #82–#87 are re-runs of a contract that has
> held twice. These two are not:
> - **#93** is the family's first judged target that is a held **SOUND** rather than a word,
>   and its signature error (the letter NAME where the sound was asked for) is a class no
>   strike covers. ~90 seconds.
> - **#89** is the shared **engine cut-in** (`useJudgedSpeechLoop`, `ead9ae1`). It sits under
>   *every* judged-loop consumer — **including the two surfaces the user already blessed** —
>   and has never fired in front of a person. If it misbehaves it degrades #91 and #92
>   retroactively. That is the one row on this board whose failure reaches backwards.
>
> ➕ **2026-08-13 — ONE EXTRA EAR-CHECK RIDES EVERY ROW BELOW; NO NEW ROW WAS FILED.**
> The 19a testkit sweep turned the performed-stage-direction gate ON for all thirteen judged
> packs, and it failed nine of them: every pack opened its judging contract with the imperative
> `"Then WAIT silently — …"`, the exact wording a ten-frame drive caught the model VOICING to a
> child as `[WAIT silently]` (and letter-spotter fabricating as `[LSP_TAP]`). All nine now state
> the wait as a FACT about the turn — *"The quoted line is the ONLY thing you say on this turn;
> you then stay silent while the learner thinks…"*. **The fix is machine-gated but UN-HEARD.** So
> whoever drives #82–#87, #89, #93–#98, add one line to that row's notes: *did the tutor speak any
> stage direction, bracket tag, or announcement that it was waiting/listening?* It costs no extra
> session time — it is a thing to NOT hear during the drive already scheduled. Packs touched:
> decodable-reader (×3 sites), read-aloud-studio, letter-spotter (×2), letter-sound-link (×2),
> picture-vocabulary (×2), phoneme-explorer, rhyme-studio, counting-board (×2), push-pull-arena,
> plus the four pre-runner ports' `"Then wait for the learner to speak."` opener.
>
> ➕ **2026-08-13 (19d) — A SECOND THING TO GLANCE AT ON THE SAME DRIVES; STILL NO NEW ROW.**
> All fifteen judged surfaces now render the shared `JudgedMicPanel`, and the orb's label is
> read from `answerKind` instead of being hardcoded. On a HANDS item it no longer says *"I’m
> listening"* — it says what the turn actually is (*"Your turn — tap the letter / tap the
> picture / tap the hand / fill the boxes"*, *"Show me on the frame"*). **Four ports were
> claiming to listen for an answer they could not receive**: cvc-speller (`spell-word`),
> letter-sound-link (hear-see), picture-vocabulary (the tap modes), counting-board
> (`subitize_perceptual`). So on #82–#87, #89, #93–#98: *while a hands item is on screen, does
> the orb name the hands turn — and does the status line under it still match?* One glance,
> no extra session time. **This is a RENDER change verified only by machine gates** (tsc,
> 3049 vitest) — it has not been seen in a browser.
>
> ✅ **HEARD ON `ten-frame` AND `letter-sound-link`, 2026-08-13 (user drives):** every 19d
> check above passed on both — ten-frame is the surface whose interaction gate the slice
> rewrote most (four-clause hand-composed guard → `runner.canAttempt`), and letter-sound-link
> is the one that took all three changes at once, driven across all three modes (16 items,
> including six consecutive tapped items and one mid-run correction that recovered).
> **The panel and the gate migration are confirmed on TWO surfaces.** The per-port
> `answerKind` wiring on the other thirteen still rides the rows below.
>
> ➕ **AND THE SECOND DRIVE FOUND THE SAME LIE ONE SCREEN LATER — the COMPLETION copy.** A
> six-item tapped run congratulated the child for working *"with your own voice"*. Four ports
> asserted a modality a legitimate run need not have (letter-sound-link, picture-vocabulary,
> ten-frame, counting-board — **the same four whose orb was lying**); all four now derive it
> from the run (`judgedAnswerMix`). **The new lines are un-seen:** on any drive of those four,
> read the celebration line on the completion panel and check it matches what the child
> actually did.
>
> *(Header below is the 2026-08-11 record; its "EIGHT rows / #91 open" counts are superseded
> by the lines above — #91 and #92 have since been struck.)*

> **2026-08-10 — the judged-loop family. SIX rows open (#82–#87): four literacy ports plus
> the two judged-script-runner ports (`counting-board` #86, `push-pull-arena` #87) that
> landed after the driving card was written. Every one of them is undriven or half-driven
> on the same half: the SPOKEN judge refusing a wrong answer. Plus #88 (pilot signup
> deep-link — gates invite #1). Next free ID = 95.**
>
> **2026-08-12 — #94 filed for port 8 (`rhyme-studio`), and it is the first row here that
> asks a PRODUCT question rather than only a verification one.** The port narrowed the
> spoken accept set to exactly the words on screen, because a live probe caught the model
> offering "nake" as an acceptable rhyme for "cake" — an invented word the judge would have
> been told to affirm. The cost is that a child who says a REAL rhyme that is not on a card
> gets corrected. Criterion (c) is the drive that decides whether that trade is acceptable;
> if it is not, the answer is the `open_set_word` bench sitting, not a looser judge.
>
> **2026-08-11 (late) — #93 filed for port 7 (`letter-sound-link`). It is not just another
> row on the pile: it is the first judged surface whose target is a held SOUND rather than a
> word, and its signature error — saying the letter NAME where the sound was asked for — is
> the one wrong answer this whole primitive exists to correct. #91's evidence does not
> transfer to it.**
>
> **✅ 2026-08-11 (late) — #91 STRUCK: the user drove picture-vocabulary through every mode
> the same day it shipped, wrong answers included, and it held.** This is the lane's first
> user-driven evidence of the SPOKEN judge refusing deliberate errors — the exact debt
> #82/#83/#84 hold open on their own surfaces (those rows stay open; the evidence is
> per-surface). #92 filed for port 6 (`phoneme-explorer`), which shipped on the strength of
> that drive.
>
> **✅ 2026-08-11 — #88 IS STRUCK, the first row closed here in over three days.** The pilot
> family's front door is open: prod frontend, prod backend on Cloud Run, a real account minted
> through the live site, and the invited grade confirmed on the profile in Settings.
> **EIGHT rows remain and all but one are a mic sitting** (#82–#87, #89, plus #91
> `picture-vocabulary` filed by a concurrent session) — the lone exception is #90, a screen
> glance. **The entire human queue is now the judged loop.** One ~25-minute pass clears it.
>
> **⚠️ 2026-08-11 — TWO rows added, and note what they have in common with #82–#87: both are
> surfaces that a human DID drive, whose FIXES nobody has heard or seen since.** #89 is
> `di-spoken-practice` after three live drives (the third found the off-script hostage and
> fixed it in the shared engine — **that cut-in has never fired in front of a person, and it
> now sits under all 8 judged-loop consumers**). #90 is `multiplication-explorer` after the
> per-challenge rework. **A drive that finds a defect does not close the row it opened** —
> the fix inherits the row. That is the same shape as "a drive that answers everything
> correctly does not advance these rows," one layer later.
>
> **📄 DRIVING CARD: `qa/HANDOFF-di-mic-sitting-2026-08-10.md`** — covers **#82–#85** with
> the exact wrong answers to say and the shared first-10-seconds check. **#86/#87 are the
> same sitting, same rules** (scripted opener first — DI-GREET-1 — and answer wrong on
> purpose); their full criteria are in the rows below.
>
> **⚠️ THE CORRECTION BRANCH HAS NOW FIRED — ONCE, AND ON THE BUILD JUDGE ONLY.** The #85
> sitting-B drive (2026-08-10) saw `dog` corrected once and `bug` corrected twice then
> capped and moved on — so the loop's correction mechanics, wording, and move-on cap are
> observed working, and the build judge is discriminating. **The SPOKEN judge — the
> contract #82/#83/#84, #85 sitting A, #86 and #87 all run on — has still never heard a
> deliberately wrong answer.** #83 ran 9/9 first try; #84 ran 5/5 first try; every spoken
> affirmation so far is compatible with a permissive judge — the exact trap #63 fell into.
> **A drive that answers everything correctly does not advance these rows.** The single
> instruction that matters: **answer deliberately WRONG at least twice per sitting.**
> ~90 seconds each.
>
> **What the 2026-08-10 word-flip drive DID close:** the tutor-owned clock, the answer-leak
> gates, and DI-1 twice more (`'trunks'`→*"Yes, trucks."*, `'Herz'`→*"Yes, hats."* — judged
> from audio, right where the transcript was wrong).
>
> **What it OPENED — DI-GREET-1, now fixed and needing a re-drive.** The backend was
> queuing *"Greet the student warmly…"* with `end_of_turn=True` on every fresh connect, so
> the tutor took a 15s improvised turn **before any DI cue existed**, ended it with its own
> question, and the child's answer to THAT barged in over the real scripted ask. This is the
> true root of residual SWAP-1, which had been attributed to a catalog directive; that
> directive was one job on the turn, and the backend was the turn. Fixed via `owns_opening`
> across all eight scripted-opener packs. **Criterion #84 (f) is the check for it, and it is
> the same first-10-seconds check on #82 and #83.**

### #99 — **MIC-LEVEL CONTEXT CHURN (DI BACKLOG 19b): the mic level stopped being a React value and became a subscription. Does the mic still HEAR?** · **✅ CLOSED 2026-08-14 — BOTH PATHS DRIVEN: standalone (drive 1) + LESSON (drive 2, session `046ad3a42906`)**

**✅ DRIVE 1 (2026-08-14, user, `ten-frame` / `subitize`) — *"worked correctly for subitize."*** The frame-driven turn machine is confirmed on a real microphone: a spoken number opened a turn, the turn closed, and the tutor judged it. **(a), (b) and (d) are struck for the STANDALONE path**, and with them the whole deaf-mic risk that made this row worth filing — the subscription reaches the machine. `subitize` also carries the stimulus flash, so the timer-under-churn paths landed in the right order too.

~~**⏳ WHAT DRIVE 1 CANNOT CLOSE — the LESSON path, which is different code, not the same check twice.** A standalone surface runs its own `useLiveVoiceTurns`; a lesson consumes the PROVIDER's single shared instance, and the per-frame resubscribe this slice removed lived on that side. Pip's halo and the mic button's ring (criterion (e)) exist only there and were rewired in the same slice. **One lesson launch closes the row.**~~

**✅ DRIVE 2 (2026-08-14 19:56, user, a live K counting LESSON — session `046ad3a42906`, log
`backend/logs/lumina-sessions/2026-08-14-195650-lumina-tutor-046ad3a42906.jsonl`) — THE LESSON
PATH IS DRIVEN AND CLEAR; the row is CLOSED.** The lesson ran curator-brief → `counting-board`
(7 spoken answers, 7 affirms on the scripted form — *"Yes, N fish. … Your turn. How many
fish?"*, run completed) → `ten-frame` `subitize` (2 spoken answers after the flash cue — *"Eyes
ready — watch the frame!"* — both affirmed) → hundreds-chart → number-sequencer → number-tracer
→ fast-fact → knowledge-check. **11 voice turns opened through the PROVIDER's shared instance
and closed; floor gate: superseded 0, wedged 0.** Doctrine bonus, live-proven in one run: ASR
transcribed spoken six/five/nine/ten as **"sechs" / "fünf" / "Nein." / "잔"** and the judge
affirmed the correct number every time — **it judges the audio; the transcript is a spectator.**
This drive also live-verifies **19i** (both judged ports STARTED and ran in a lesson) and gives
`cuedItemId` its in-lesson `subitize` closes. Report:
`qa/tutor-reports/lesson-live-2026-08-14-k-counting-di.md`.

**Why this is a mic row when the sitting is closed.** The standing rule retires *per-surface
re-runs of the judging contract*. This is not that: it rewired **how a captured audio frame
reaches the turn machine**, which is the seam every judged surface in the app opens a turn
through. Before, the level was a field on the LuminaAIContext value and `useLiveVoiceTurns`
stepped its machine in a `useEffect` keyed on it — so one float travelled through provider
state and a full re-render of the whole tree, 30-100 times a second, before a turn could
open. It is now published straight to subscribers and the machine steps in that callback.
**If that subscription is wrong, no turn ever opens and every DI surface goes silently deaf
— a strictly worse failure than the churn it replaced, and jsdom cannot tell you.**

**Machine gates already passed (so this row is about the microphone, nothing else):**
typecheck:lumina 0 · full vitest 3130 passed (+5 new) · a new `useLiveVoiceTurns.frames`
suite proves frames alone open AND close a turn with zero renders, and revert-bites ·
the lesson-mode resubscribe gate in `useJudgedSpeechLoop.shared-turns` revert-bites.

**How to reach it: any judged surface with a real mic. One run is enough — `ten-frame`
(`subitize` or `build`) or `letter-sound-link` are the two most recently driven.**

- ~~**(a) ⭐ THE ONE THAT MATTERS — a spoken answer is still HEARD.** Say the answer out loud.
  The tutor must respond to *your voice*, not time out. **If nothing you say ever registers,
  stop: the subscription is broken and everything below is moot.**~~ ✅ **STRUCK — drive 1.**
- ~~**(b) A turn still CLOSES.** After you answer, she replies within a beat or two. A turn
  that opens and never closes looks like the tutor ignoring you — the `activityEnd` bracket
  is what hands Gemini the turn.~~ ✅ **STRUCK — drive 1.**
- ~~**(c) The bar has not moved.** Two things to feel, in both directions:
  - **Not deaf** — a quiet, normal-volume answer still opens a turn (don't shout to test it).
  - **Not trigger-happy** — a cough, a chair scrape, or the tutor's own voice through the
    speakers does NOT open a turn. *(The calibration now sees each frame exactly once; it
    used to occasionally see one twice, which shifted the measured noise floor.)*~~ ✅ **STRUCK
  — drive 2.** Not-deaf: 9/9 single-word answers opened turns in a lesson. Not-trigger-happy:
  every turn that reached the judge carried a real answer, 0 supersessions; the feel half was
  the driver's to notice and nothing was reported.
- ~~**(d) The orb's spike ring still moves with your voice** — that ring is now driven by its
  own subscription instead of a prop, and a flat ring on a working mic is this slice's
  signature cosmetic failure.~~ ✅ **STRUCK — drive 1 (a flat ring on a working mic is the one thing a clean subitize run could not have hidden).**
- ~~**(e) IN A LESSON (not the tester): Pip's halo and the mic button's ring still pulse when
  you speak.** Same subscription change, different leaf; `CuratorCompanion` is the only
  surface where both were rewired at once.~~ ✅ **STRUCK — drive 2 was a full lesson at the
  mic and the user watched it.** The log cannot see pixels: **if the halo or mic ring looked
  flat during that drive, REFILE as a pixel row** — the mic-transport half this row existed
  for is proven either way.
- **(f) 🎁 THE PAYOFF, if you notice it.** Everything under the provider used to re-render
  30-100×/sec with the mic open. It should simply feel *smoother* — animations less janky,
  fewer stalls. Not a pass/fail criterion; if the run feels WORSE, that is a finding.

**Also true and worth one line: this closes the amplifier behind a whole bug family.** The
`verdictTimeoutMs`-is-dead bug (2026-08-10, cvc-speller) and ten-frame's never-flashing
subitize frame (drive 2, 2026-08-13) were both "a timer effect torn down faster than it
could fire, and only with the mic open". The per-frame render was the amplifier in both.
The dep-list rules that fixed them stay — but the thing that made them fatal is gone.

### ~~#98 — ten-frame, DI modality (FIRST MATH PORT): does a spoken NUMBER get judged, and does a hands turn close on stillness? · OPEN, PARTIALLY DRIVEN 2026-08-13 — **one blocking defect found and fixed; nothing about the JUDGE has been heard yet** ~~ · ✅ **STRUCK 2026-08-14 by the user ruling above (judging contract proven on three surfaces + math; per-surface re-runs retired).**
- **⚠️ DRIVE 1 (2026-08-13, user, Math Primitives Tester, `build` @Elementary) — DID NOT REACH THE
  JUDGE.** Item 1 accepted counters; **item 2's frame was completely dead.** Cause: the component
  gated taps on `runner.stage === 'asking'`, but the runner sets `affirmed` and opens the next item
  in one dispatch and never returns the stage to `asking` on the happy path. **The failure healed
  itself on a wrong answer** (a correction resets the stage), which is why it survived 40 machine
  tests. Fixed by keying interaction and reveal on `runner.solvedIds`; regression test added.
  **Re-drive from the top — criteria (a)–(j) below are all still unheard.**
- **⚠️ DRIVE 2 (2026-08-13, user, `subitize` @Elementary, instance `ten-frame-1786638165908`) — ALSO
  DID NOT REACH THE JUDGE. Two more defects, both fixed:**
  - **The frame never flashed.** Screen stuck on *"Get ready to look…"* while the tutor asked *"How
    many counters did you see?"* against an empty frame. The flash callback closed over the
    `runner` object, which is new every render, and `micLevel` ticks once per audio frame — so the
    prep timer was torn down and re-armed faster than it could fire. **Only happens with the mic
    open**, which is the only way this primitive runs. Now keyed to `currentItem`; regression test
    re-renders throughout the wait and revert-bites.
  - **The tutor said `[WAIT silently]` out loud** (in the log, right after the ask). It invented a
    bracket tag out of the contract's own "Then WAIT silently" opener and performed it. The wait is
    now phrased as a fact about the turn, not an order, and the cue names the failure.
- **⚠️ DRIVE 3 (2026-08-13, user, `subitize`) — the flash worked, but in the WRONG ORDER.** *"the ten
  frame needs to flash after her first intro, right now it flashes then she instructs, this would be
  confusing for the child."* The flash ran on a beat measured from item-open while her line takes
  ~4s, so the counters came and went while she was still saying "watch the frame". **Fixed by keying
  the stimulus to her voice** (falling edge on the new `runner.tutorSpeaking`), on every item and on
  every correction re-flash. This also retired criterion (b) — see (b′).
- **✅ DRIVE 4 (2026-08-13, user) — ALL FOUR MODES DRIVEN END TO END: *"tested all the modes, worked
  great."*** The surfaces are confirmed: every mode reaches the tutor, the ordering holds (she
  instructs, then the frame flashes), hand items commit, spoken items are heard, and no board goes
  dead. **The three blocking defects found in drives 1-3 are closed by observation, not just by
  test.**
- **⚠️ DRIVE 5 (2026-08-14, user, `subitize`) — A FOURTH BLOCKING DEFECT, and it is drive 3's bug
  arriving through a different door.** *"when i get it wrong, the very next one flashes way too fast
  before she finishes her statement — it should always happen after she finishes the line about
  'how many do you see?'"* **The falling edge was right; its SUBJECT was wrong.** On an affirm the
  runner QUEUES the next item's cue and opens the item in the same dispatch, but a queued cue only
  sends once the floor clears — so the new item sits on screen for the entire tail of the PREVIOUS
  item's affirmation. The "she spoke, then stopped" latch filled on that tail, her affirm drained,
  and the flash fired in the silence **before this item's ask had been sent**. It bites hardest
  right after a wrong answer because the corrected item's affirm is its own longer turn.
  **Fixed in the SHARED RUNNER, not in ten-frame:** `useJudgedScriptRunner` now exposes
  **`cuedItemId`** — the id of the item the tutor's most recently *sent* cue is about — and a
  stimulus gate must match it as well as watching `tutorSpeaking`. No tuned milliseconds; a
  correction needs no special case (no new cue is sent, so the id still names the current item).
  **This is item 19c's first half, pulled forward by a live drive** — every judged surface that
  keys a stimulus to the tutor's voice inherits the same hole. Gates: `typecheck:lumina` **0** ·
  full tsc **803 = exact baseline, 0 in touched files** · full vitest **3053 pass** · new
  regression test **revert-bitten** (it fails with the gate removed). **⚠️ UNHEARD — needs the
  re-drive below.**
- **✅ DRIVE 6 (2026-08-14, user, `subitize`, session `e8093c77308e`, 8 items / 183s to the closing
  line) — THE HEADLINE CRITERION IS MET: THE SPOKEN JUDGE REFUSES ON MATH.** *"tested several
  incorrect."* **Six deliberate wrong numbers, six REFUSALS; six correct answers, six AFFIRMS;
  zero false affirms and zero false refusals.** Item 4 → "three" ✗, "five" ✗, "four" ✓. Item 5
  (answer 5) → "four" ✗ ×3 → capped → move-on. Item 7 (answer 7) → "eight" ✗ → "seven" ✓. This is
  the first time the judge has been heard refusing anything on a math surface, and it closes the
  question the four correct-only drives could not touch. **Still owed on this row:** criterion (a)
  proper — *count aloud up to the right answer* ("one… two… three… four") must be REFUSED while
  `counting-board` accepts the identical utterance. Every wrong answer in this run was a bare
  wrong number, so the counting-vs-total split is still untested. Also unheard: `make_ten`,
  `operate`, and the stillness commit on `build`.
- **⚠️ THREE DEFECTS THE SAME RUN EXPOSED — filed to `qa/di/BACKLOG.md` item 18c, none fixed yet:**
  **(1) a 600 ms noise restarts a correction from the top** (t=135.2: `activity_start` → barge-in →
  turn 15 killed mid-sentence with no transcript at all → turn 16 re-spoke the whole correction, so
  the child heard half a line and then the entire line again, 8.4 s for one correction);
  **(2) the capped item asks a question and then withdraws it** — after the third wrong answer the
  tutor's correction still ended *"Your turn. How many counters did you see?"* and 0.9 s later the
  runner's move-on cue said *"Good try! Here comes the next one."*, so the child was asked and then
  told to move on before answering; **(3) the correction is byte-identical every time** —
  *"My turn: it was five. Look at the whole group at once instead of counting them."* three times
  in a row, so a child who missed it once gets nothing new on the third pass.
- **⚠️ THE ROW STAYS OPEN, and the reason is narrow: a drive that answers correctly does not test a
  JUDGE.** Criteria (a) and (c)-(g) are all *"say the wrong thing on purpose"* — they ask whether
  the tutor REFUSES a fluent, confident, wrong answer. Nothing above establishes that.
  **What is left is one short sitting:** answer wrong once per mode, per (a), (c), (d), plus the
  subitize accept-side check (say the total first, then count — that must be AFFIRMED).
- **Add on the re-drive:**
  - **(k) walk ALL the way to the end of a session** (5+ items) in both `build` and `subitize`, and
    confirm every item works — not just items 1 and 2.
  - **(l) LISTEN FOR STAGE DIRECTIONS.** Any "[WAIT…]", "listening", "silently", or bracket-shaped
    utterance is a failure. **Listen for the same thing on #85 and #86** — `cvc-speller`,
    `counting-board` and `picture-vocabulary` all still open their contracts with the imperative
    that produced this, and it was deliberately NOT swept without a drive behind it.
- **The first math primitive on the judged loop that a child can actually reach** (`counting-board`
  got there first but is still undriven — #86, which shares this port's engine and its number-word
  handling; **drive #86 in the same sitting, it is the cheaper half of the same question**).
- **This is the pilot the rest of item 18's math sweep is gated on.** Nothing else in math moves
  until this row has been driven.
- **Drive `subitize` @K standalone first** (it is the mode the modality swap was called for), then
  `build` @K, then `make_ten` @1-2, then `operate` @1-2.
- **Answer WRONG on purpose — a drive that answers everything correctly does not close this row.**
  - **(a) THE SIGNATURE ERROR ON SUBITIZE — the headline, and the one thing no other pack tests.**
    After the flash, **count aloud one at a time and land on the right number** ("one… two… three…
    four"). The tutor must REFUSE it and re-flash, because reaching the total by counting is the
    exact skill the mode exists to defeat. ⚠️ **Then check the accept side in the next item: say
    the total FIRST and then count to check ("Four. One, two, three, four."). That must be
    AFFIRMED.** Getting one of these right and the other wrong is the likely failure, and it is
    the only place in the family where counting-to-the-answer is refused — `counting-board` accepts
    the identical utterance. If the judge cannot hold both, say so; the split may be too fine.
  - **(b) ~~does the flash survive the correction (3s window)?~~ RETIRED by drive 3 — there is no
    window any more.** The flash now waits for the tutor's audio to STOP (falling edge on
    `tutorSpeaking`), on the first ask, on every subsequent challenge, and on a correction's
    re-flash. **Replaced by (b′): confirm the ORDER, every time.** She should finish saying "watch
    the frame… how many counters did you see?" and THEN the counters flash. If counters ever appear
    while she is still talking — on any item, including after a correction — that is a failure.
  - **(c) make_ten @1-2 — say the TOTAL instead of the complement.** Six on the frame, say "ten".
    Fluent, confident, wrong. Expect *"My turn: six and four make ten. Four more. Your turn…"*.
    Then check the accept side: answer *"four more"* and *"four counters"* — both must be affirmed.
  - **(d) operate — say an OPERAND back.** On "Three plus two", answer "three". Must be refused.
    Then check that counting the frame aloud and ENDING on five is affirmed.
  - **(e) THE STILLNESS COMMIT — the new mechanism in this port, and there is no precedent for it.**
    On `build`, place counters and then **stop with the wrong number on the frame**; after ~3
    seconds the tutor should judge what is there and correct it. Then place the right number and
    stop. **The thing to watch for is a PREMATURE commit: pause mid-placement for a few seconds as
    a five-year-old would, and see whether it judges an unfinished frame.** If it does, the window
    is too short — that is a number, not a redesign.
  - **(f) hand items are SILENT.** While placing counters (`build`, and `make_ten` @K), talk: count
    aloud, say "is this right?". The tutor must say nothing at all until the placement commits.
  - **(g) make_ten @K must still be the manipulation it was** (contract R6 — a standing user
    ruling). Seeded counters must not be removable; filling the frame commits immediately with no
    stepper and no Check button anywhere.
  - **(h) NOTHING PRINTS THE ANSWER.** On add/subtract confirm there is no "Counters: N" readout —
    it would equal the number you are about to say. On make-ten confirm there is no empty-space
    count. The number may appear on screen only AFTER the tutor affirms.
  - **(i) tap-to-hear / "Show again"** re-asks the QUESTION and never narrates the count.
  - **(j) the first ten seconds** (the standing `owns_opening` check, same as #82/#83/#84): one
    greeting, inside the pack's own opening line, with no improvised warm-up before it.
- **Machine-verified already:** pack validator clean, 40 pure + stage tests, `typecheck:lumina` 0,
  census greps 0, full vitest 3023 passed / 0 failed, and a live 6-run pipeline probe across both
  bands and both frame sizes (38/38 items askable, zero drops). None of that touches the mic —
  **only a mic run closes this row.**

### ~~#97 — letter-spotter, DI modality (port 11): is the SPOKEN name-it judged, and do the tap items stay silent? · OPEN, PARTIALLY DRIVEN 2026-08-13 ~~ · ✅ **STRUCK 2026-08-14 by the user ruling above (judging contract proven on three surfaces + math; per-surface re-runs retired).**
- ⚠️ **THIS ROW'S PREMISE CHANGED AFTER IT WAS FILED, and the section below said otherwise for
  three hours.** The port shipped **tap-only** ("the first pack in the family where NO mode is
  spoken", `letter_name` BLOCKED). **The user's drive `6ada8c0a1bcf` overturned that same day:**
  *"in real life if i have a sentence with a missing letter, and i ask the student to use context
  clues and the word to say the missing letter, they should be able to translate the sentence and
  missing letter verbally. they dont need to click a button."* **`name-it` is now SPOKEN
  (`letter_name`, `accepted-build-ahead`) and the four option tiles are DELETED** — a menu turns
  production into recognition and floors a guess at 25%. `find-it` and `match-it` stay gestures
  because their answers are a LOCATION and a FORM, neither of which is sayable.
- **✅ ALREADY HEARD (mic run `de8a6a78d9db`):** spoken name-it works (*"much better"*), and the
  **bracket hold on tap items held** — zero stray tutor turns and no fabricated tags across six
  tap items. That drive also found and fixed a defect: match-it repeated a byte-identical 26-word
  ask on all six items, so the DISTAR lead-in now speaks only when a direction is introduced.
- ⚠️ **STILL OWED — the wrong-answer half, which is the whole point of the row:**
  - **(a) THE SIGNATURE ERROR — say the WORD back.** Asked what "sun" starts with, answer
    **"sun"**, fluent and confident. It must be **REFUSED**. If it is affirmed the mode measures
    nothing. Then a wrong LETTER: refused, and the correction re-models the route
    (*"My turn: listen to the start of the word. Sss … sun."*) and **never names the letter** —
    with the tiles gone, a correction that says it is the only place the answer can leak.
  - **(b) THE SECOND CHANNEL.** On the next item answer with the **SOUND** (a held *sss*) instead
    of the name — that must **ALSO** be affirmed. It is what makes the homophone clusters
    survivable, and it is the clause most likely to be missing.
  - **(c) THE SILENCE CONTRACT on the tap items** (heard once, worth re-hearing after the
    conversion). On find-it/match-it, talk at the tutor: it must stay completely quiet — no reply,
    no re-reading, and **no bracket-tag text spoken aloud**.
  - **(d) THE REPETITION FIX — re-drive.** Stay in match-it for 4+ items: item 1 frames the game,
    items 2+ are only *"Your turn. Tap the little letter that is the same."*
  - **(e) NO SHAPE DESCRIPTION, anywhere.** The click-era tutor volunteered one per item
    ("a curvy snake", "a triangle with a line across the middle"). Listen for any description
    of curves, lines, dots or sticks — at any tier, in any mode. One is a failure.
  - **(f) the item is spoken ONCE.** The defect this port exists for: count the readings of a
    sentence. It should be exactly one per item, plus one more only if YOU tap the sentence
    to hear it again. A re-read on a correct answer is the old behaviour returning.
  - **(g) tap-to-hear.** Tap the sentence (name-it) / the speaker (find-it) / the big letter
    (match-it) mid-item. Expect the question back verbatim and no extra help, then silence.
  - **(h) find-it is ONE target now.** Confirm exactly one instance of the named letter is in
    the grid, and that tapping it advances — there is no Check button to press.
  - **(i) the first ten seconds** (the standing `owns_opening` check, same as #82/#83/#84):
    one greeting, inside the pack's own opening line, with no improvised warm-up before it.
- **📍 FULL CRITERIA — the table row #97 near the bottom of this file**, filed by the drive
  session, carries the long form including the mic-orb copy check and the direction-boundary
  case. Same row, two locations; **this section is the STATUS of record.**
- **Machine-verified already:** pack validator clean, di-script 43/43, `typecheck:lumina` 0,
  hooks+literacy suites green, census greps 0, and a live 3-mode generation probe (19/19 items
  askable). ⚠️ **No live generator probe has run SINCE the spoken conversion** — the drawn words
  are unverified against the new ask. None of that touches the mic — **only a mic run closes
  this row.**

#### #97 · FULL CRITERIA— **`letter-spotter` — `name-it` converted to a SPOKEN answer, and the first bracket-hold on tap items (2026-08-13 user ruling, from drive `6ada8c0a1bcf`)** *(📍 **STATUS of record is the `### #97` section at the TOP of this file** — `/pm` 2026-08-13 found the two records disagreeing and reconciled them; the criteria below are the full form and stay here.)* · OPEN
*(Same row as the #97 status block directly above — the long form as filed by the session that drove the port. The 2026-08-13 format merge turned two competing records into ONE row with two parts.)*

- **What to check:** *(Machine-proven: `typecheck:lumina` 0, di-script 43/43, hooks+literacy 731 green, census greps 0. **PARTIALLY DRIVEN 2026-08-13** — user mic run `de8a6a78d9db`: spoken name-it confirmed working ("much better"); the bracket hold confirmed by the log, which has **zero** stray tutor turns and no fabricated tags across six tap items. That drive also FOUND a defect, now fixed: match-it repeated a byte-identical 26-word ask on all six items, so the DISTAR lead-in is now spoken only when the action is introduced and match-it's repeat ask is short (9 words). **Still owed: a re-drive of (e) below, and no live generator probe has run** — the drawn words are unverified.)* **(e) THE REPETITION FIX — re-drive this first.** Run a session that stays in **Match It** for 4+ items. Item 1 should frame the game once ("You will see one big letter, and some little letters underneath… A big letter and a little letter can look different…"); items 2+ should be **only** *"Your turn. Tap the little letter that is the same."* If the long frame comes back every item, the lead-in is leaking past the introduction. Then check the boundary: when the run **crosses from one direction to another**, the new direction must re-introduce itself once. And confirm the opening says its instruction **once** — the old how-to-play ended "Tap the little one that is the same letter!" and the ask repeated it a sentence later. **(a) ⭐ THE SENTENCE DIRECTION IS SPOKEN, AND THERE MUST BE NO TILES.** If four letter buttons are under the sentence, the conversion did not route — that is the whole defect and it is a stop-the-check. The screen should be the sentence with a star over one word's first letter, and nothing else. Answer **out loud**: say the letter → affirmed. Then on the next item say the **SOUND** instead (a held *sss* for "sun") → **must ALSO be affirmed**; that second channel is what makes the homophone clusters survivable and it is the clause most likely to be missing. **(b) THE SIGNATURE ERROR — say the WORD back.** Asked what "sun" starts with, answer **"sun"** — confident, fluent, and it must be **REFUSED**. If it is affirmed the mode is measuring nothing. Then a **wrong letter**: refused, and the correction must re-model the ROUTE (*"My turn: listen to the start of the word. Sss … sun."*) and **never name the letter** — with the tiles gone, a correction that says it is the only place the answer can leak. Miss twice and the move-on should finally name it (*"The word sun starts with S"*). **(c) ⭐ THE TAP ITEMS MUST BE GENUINELY SILENT — this is the regression that opened the slice.** On a **Find It** or **Match It** item, **talk at the tutor** ("is it this one?", say a letter, ramble). It must stay completely quiet: no reply, no "I can't hear you, tap the screen", no re-reading the question, and above all **no bracket-tag text spoken aloud** (the failing drive had it say *"[LSP_TAP] Say exactly: … Then WAIT in complete silence…"* out loud, and invent *"[SESSION RESUMED]"*). Any speech at all during a tap item means the bracket hold is not holding. **(d) THE MIC ORB MUST NOT LIE.** On the sentence direction it reads *"I'm listening"*; on Find It / Match It it reads *"Your turn — tap it"*. The orb stays live and the level meter still moves on tap items — the mic is held, never muted. **(e) The tap directions still work**: one tap commits, wrong is corrected without naming the position (find-it) and by naming both cases (match-it), and nothing reveals before the tutor affirms.
- **How to reach it:** Lumina dev → LanguageArtsPrimitivesTester → **Letter Spotter** at grade K; one run reaching all three directions; mic run, **answering wrong on purpose**
- **Source report:** this session; `qa/di/BACKLOG.md` item 16

### ~~#96 — **`decodable-reader` after the DI port (port 10) — the primitive whose READING PHASE MEASURED NOTHING, and the first judged surface that forks its answer material INSIDE a single run** · OPEN, PARTIALLY DRIVEN 2026-08-13 — **the drive STRUCK (a)/(b)/(d) in substance and FOUND TWO DEFECTS, both now fixed** ~~ · ✅ **STRUCK 2026-08-14 by the user ruling above (judging contract proven on three surfaces + math; per-surface re-runs retired).**
- **⚠️ DRIVE 2026-08-13 (user, two runs: `read_along` @ K and a decode mode).** Verdict on the judged loop itself: ***"DI worked great"*** — the first mode passed. Two things failed and neither was a wording nit:
  - **THE SUMMARY LIED.** Both runs ended *"N of N done all by yourself"* with a ✅ per row while the user had **answered one question wrong and been corrected**. The completion block was bespoke and counted `solvedCount` — *an item closed* — as *done alone*. **FIXED:** the primitive now renders the family `PhaseSummaryPanel` (per-item score, attempt count, first-try star, honest overall ring), and the celebration line counts `firstTryCount`, not solves.
  - **THE PROPOSITION QUESTION COULD NOT BE ANSWERED ALOUD.** *"mode sequence/cause effect doesnt let me answer for the 2nd part verbally, i need to click on the button even though im speaking, this is the same issue with inference mode."* **FIXED:** `answer_tap` is gone; `sequence` / `inference` / `main_idea` now answer through the new `closed_set_choice` response class (accepted-build-ahead on this ruling — **this row is its acceptance drive**). The cards stay on screen as the closed set; they are no longer buttons.
- **What to check:** *(Filed 2026-08-12 with the port; criteria (c) and (g) rewritten 2026-08-13 for the spoken-choice conversion. Machine-proven at that revision: `typecheck:lumina` 0, di-script 48/48, literacy+hooks 731 green, lumina service 1482 green, 4 fresh live probes — `sequence`/`inference`/`main_idea`/`literal` — with ZERO questions dropped by the new ear-separability gate and choices drawn at 4-7 words. No mic has heard the spoken-choice fork.)* **First, what must be ABSENT everywhere:** no "Done Reading" / "I read it!" button, no Check button, no per-word tap-to-hear, no words-tapped counter. If any of those are on screen the old surface is still routing. **(a) DECODE — the cold read (grade 1, `literal`).** LISTEN first: the tutor must say *"Your turn. Read it."* and **not one word of the printed sentence** — decoding print unaided is the measurement and an echo route erases it. Then **swap one small word** ("a" for "the", "and" for "then"): it must be refused and the correction must **name what you said** (*"My turn: not the hat — …"*), not just re-read at you. Then **skip a word** out of an otherwise smooth read (nothing wrong is said, something merely isn't — the hardest miss class). Then miss the same line **twice** so the move-on resolves it and the story continues. **(b) ⭐ THE SPOKEN COMPREHENSION ANSWER, AND ITS SIGNATURE ERROR — the criterion this port turns on.** After the reading, the tutor asks a question whose answer is one word from the story (probe draws: *"What did the fat cat have?"* → **hat**, *"What did the cat ride home?"* → **bike**). **Answer with a DIFFERENT word FROM THE STORY** — say "hat" when it asked what he rode. It arrives fluent and confident *because it came from the text*, it is exactly what a judge left to its own kindness waves through, and **it MUST be REFUSED.** If it is affirmed, comprehension is not being measured at all and that is a bug, not a wording nit — report it. Then the accept side: **say the answer inside a phrase** ("on the mat", "he rode his bike") → **must be AFFIRMED**, with the bare word echoed back. Then miss twice and listen to the correction: it should **re-read the story sentence the answer came from** (*"My turn: He did ride his bike home. Bike. Your turn. What did the cat ride home?"*) — the looking-back move, not just a handed-over word. **(c) ⭐ THE SPOKEN CHOICE QUESTION (grade 2, `sequence` / `inference` / `main_idea`) — the acceptance drive for `closed_set_choice`, and the criterion this revision turns on.** **THE CARDS MUST NOT BE BUTTONS** — if tapping one commits an answer, the conversion did not route and that is a stop-the-check. The tutor reads the question and **every** choice aloud, then waits. **Answer OUT LOUD, and use the SHORT FORM first** — say only the part that tells your choice apart (*"the frog"*, *"to get cool"*): it **must be AFFIRMED**, and the affirmation says the whole choice back to you. Then on the next item try the other two accepted forms — **the whole sentence**, and **the position** (*"the second one"*). All three are full answers; a refusal of the short form is the failure mode this class was written around (it would fail a five-year-old for recall and call it comprehension). Then **name a WRONG choice**: the correction must re-ask with all the choices and **must NOT say which one is right** (the retry has to stay a real retry). Miss it **twice**: only then does it name the answer (*"The answer was …"*) and move on. Then **mumble or trail off**: it should ask you to say it again (*"Tell me that one again."*) rather than guess a verdict — and if it scores a mumble as wrong, report that. **⚠️ AND LISTEN FOR THE NEW LEAK CHANNEL, which this conversion created:** the tap verdict used to be code-computed, so the tutor was never told the answer until after the child committed; a spoken judge has to know it AT ASK TIME, so the correct choice now sits in the item cue's instruction while the child is still thinking. The quoted ask must NOT mark it — no "listen carefully to this one", no stress on one choice, no re-ordering, nothing after the question but the choices and *"Tell me which one."* If the tutor tips the answer before you speak, that is the trade this change made and it needs to come back as a contract fix. **(d) READ-ALONG @ K — the tutor's first turn is the whole story.** It must read all 2-3 sentences aloud, warmly and unabridged (no summary, no "let's read a story about a dog"), then ask question 1 in the same turn. Answer **wrong on purpose**, then right. Then tap **"Say that again"**: it must re-ask the QUESTION and **never re-read the story** — for a literal question the story contains the answer verbatim, so re-reading it would answer the ask. Confirm the story stays on screen while it reads (a pre-reader following print is the shared-reading task). **(e) THE CONNECTED-TEXT PAUSE (1100ms, second pack to use it).** Mid-sentence, stop for about a second, then finish. One reading, one verdict — if it judges the fragment, the voice-turn floor is not holding. **(f) THE ACTION CHANGE.** When the run crosses from the last read line to the first question, the tutor should re-speak the how-to-play once (*"Now I ask you about the story…"*) and not before. **(g) ⭐ THE SUMMARY MUST NOT FLATTER (the defect the first drive found).** Get **exactly one** item wrong, take the correction, then get it right — and finish the run. The end screen must show that item at **67%** with **2 attempts** and **no first-try star**, the overall ring **below 100%**, and the celebration line must count only the items you got on the first try. If it says "N of N done all by yourself" with a tick on every row, the honest-summary fix has regressed.
- **How to reach it:** Lumina dev → LanguageArtsPrimitivesTester → **Decodable Reader**, once at grade K (`read_along`), once at grade 1 (`literal`), once at grade 2 (`sequence`/`inference`/`main_idea` — the spoken-choice fork); mic run, **answering wrong on purpose exactly once** so (g) is testable
- **Source report:** `qa/di/BACKLOG.md` item 16, 2026-08-12 port-10 block; 2026-08-13 spoken-choice + honest-summary revision

### ~~#95 — read-aloud-studio, DI modality (port 9): does a passage-length read get judged line by line? · OPEN, HALF-DRIVEN — **(a) COLD READ + WORD SWAP BOTH HELD** ~~ · ✅ **STRUCK 2026-08-14 by the user ruling above (judging contract proven on three surfaces + math; per-surface re-runs retired).**
- **⚠️ DRIVEN 2026-08-13 (session `dc60915090e5`, `backend/logs/lumina-sessions/2026-08-13-033708-…jsonl`)
  AND NOT STRUCK — but this is the first drive in the lane where the SPOKEN judge heard a
  connected-text miss and refused it.** 9 turns, 5 reads, 4 items, 73s, user verdict *"works
  great… i did an intentional miss and it nailed it."* Ended on a client disconnect (a file
  save during the run), mid-correction on the second deliberate miss.
- **What HELD, all of it in the `accuracy` mode:**
  - **(a) the cold read.** Every ask was *"Your turn. Read it."* and **nothing else** — turns
    3, 5, 8, byte-identical, not one word of the printed line spoken before the child read it.
    The echo route the mode's whole measurement depends on staying shut, stayed shut.
  - **(a) the word swap, and the contrastive correction named what was said.** Line
    `The cat sits on his lap.` read as *"The cat **sat** on his lap."* → *"My turn: not sat —
    The cat sits on his lap. Your turn. Read it again."* Refused, re-modeled, re-elicited,
    **and no `context-update` was emitted** — the item did not advance on the miss. The
    re-read then drew *"Yes, that says The cat sits on his lap"* and the advance followed it.
    That is the loop closing on the one branch three prior DI drives never reached.
  - **(e) the clock is the tutor's.** Every advance sits behind an affirmation; no advance
    timer, no button, mic opened once (`manual_activity: true`, one activity pair per read).
  - **The floor never fought:** `owns_opening: true` and the opener said verbatim;
    `cut_in: false`, `wedged: false`, `superseded: 0` on all four `[RA_ITEM]` cues;
    `floor-gate-summary` zero across the board. `state_attached` climbed 1→2→3, so
    PrimitiveState rode out on the next cue as designed. Judge latency ~0.7s.
- **⚠️ ONE THING TO WATCH ON THE RE-DRIVE — the contrastive fill may have inverted on the
  second miss.** Turn 9: student transcript `Sam read the fast words.`, tutor *"My turn: not
  **reads** —"* (cut off there by the disconnect). At turn 6 the same slot correctly held the
  child's error (*"not sat"*); here it holds what is most likely the TARGET word. **Not
  resolvable from this log** — `context-update` records key NAMES only and the `text-to-gemini`
  preview truncates at 160 chars, exactly before the stimulus. Repeat the same miss class (drop
  or add a single inflection) and listen for whether the correction names YOUR word or the
  line's. If it names the line's, the child hears *"not reads"* about a word they didn't say.
- **STILL OWED, unchanged:** (a) the skipped-word miss and the twice-missed move-on ·
  **(b) `expression` and (c) `dialogue` in full — including the two refusals that must NOT
  happen** (a flat correct read, an in-character-free correct read) · (d) the 1100ms
  `silenceCloseMs` pause mid-line · (e) "Say that again" on an accuracy line, and the passage
  staying hidden until the end. **The port's central risk — a prosody refusal wearing a
  benched judgment's clothes — is untouched by this drive; it lives in modes nobody has run.**

#### #95 · FULL CRITERIA— **`read-aloud-studio` after the DI port (port 9) — the primitive that used to SCORE children off four button presses, and the first judged surface where two of three modes deliberately DON'T judge the thing they teach** · OPEN
*(Same row as the #95 status block directly above — the long form as filed by the session that shipped port 9. One row, two parts, after the 2026-08-13 format merge.)*

- **What to check:** *(Filed 2026-08-12 with the port. Machine-proven: `typecheck:lumina` 0, full suite 2901 green, 3 live real-pipeline probes across every eval mode with zero drops. No mic has heard it.)* **(a) accuracy — THE COLD READ, then break it on purpose.** First just LISTEN: the tutor must say *"Your turn. Read it."* and **not one word of the printed line**. If you hear it read the line to you, stop — decoding print unaided is the entire measurement of this mode and an echo route erases it. Then read the line but **swap one small word** ("a" for "the", "and" for "then", "her" for "his"): it must be refused, and the correction must **name what you actually said** (*"My turn: not the pond — …"*), not just re-read the line at you. Then **skip a word entirely** out of an otherwise smooth, confident read — nothing wrong is said, something merely isn't, and that is the hardest miss class there is. Then miss the same line **twice** so the move-on finally resolves it. **(b) expression — THE OPEN QUESTION, and it is a refusal you must NOT hear.** The tutor models the line (*"Listen: Dark clouds gathered quickly overhead."*) as one smooth phrase and leans on a stress word; you then read it back **completely FLAT and monotone, with every word correct — and it MUST be AFFIRMED.** There is no prosody response class and nothing has benched "did that sound expressive?", so the contract explicitly forbids the judge refusing a flat reading. **If the tutor corrects you for sounding boring, that is the port's central risk arriving — an unbenched judgment wearing a benched one's clothes — and it is a bug, not a wording nit. Report it immediately.** Then drop a word out of a *beautifully* delivered phrase: that one must be refused. **(c) dialogue — same shape, sharper.** Read Maya's line in your own ordinary voice with every word right → **must be AFFIRMED** (the character voice is taught by the model, never graded). Then **retell the idea in different words** ("I don't want to go in there" for "I will not go in there") — that must be REFUSED; saying the idea is not reading the line. **(d) the connected-text voice turn — new plumbing, never heard.** This pack is the first to raise `silenceCloseMs` (to 1100ms) *through the runner*, because a reader pauses between words. **Deliberately stop for about a second in the middle of a line, then finish it.** The whole line must be judged as ONE reading. If the tutor judges the first half on its own, the floor did not take. **(e) the clock and the second leak channel.** No Record/Next/Finish/Check button anywhere, no advance timer, mic opens once at the start, and the whole passage must NOT be visible while you are reading a single line (it appears only at the end). Mid-item, tap **"Say that again"** on an accuracy line: it must repeat the *instruction* and still refuse to read the line — that affordance is an answer-on-demand button if it leaks. Also listen for any bracket tag (`RA_ITEM`, `RA_HEAR`) spoken aloud, and for the tutor reading a line further down the passage than the one on screen; both are forbidden by name and neither has been heard.
- **How to reach it:** Dev tools → **language-arts**-primitives-tester → **Read Aloud Studio** → Generate (try eval modes `accuracy` @ 2, `expression` @ 4, `dialogue` @ 5) → tap the mic once → answer WRONG on purpose per (a)-(d)
- **Source report:** `qa/di/BACKLOG.md` item 16, port-9 block

### ~~#94 — **`rhyme-studio` after the DI port (port 8) — the first judged surface whose SPOKEN answer set was deliberately NARROWED, and one criterion below is a real open question, not a formality** · OPEN ~~ · ✅ **STRUCK 2026-08-14 by the user ruling above (judging contract proven on three surfaces + math; per-surface re-runs retired).**
- **What to check:** *(Filed 2026-08-12 with the port. Machine-proven: `typecheck:lumina` 0, full suite 2854 green, 5 live real-pipeline probes across every eval mode. No mic has heard it.)* **(a) recognition — SAY the wrong answer on purpose** ("no" when they do rhyme). *(This mode was a 👍/👎 tap for one day; the user's first drive removed it and the log showed the tap had also wedged the run — see the port-8 revision block. The whole mode is new since then and NOTHING here has been heard.)* Three things: the tutor must **accept the natural variants** — try "yeah", "uh huh", "nope", "they don't", not just the bare word (that latitude is the `yes_no` class's one real residual: "no" is VC-length); the correction must re-direct to the ends of the words (*"My turn: listen again to the end of each word. Here they are: cat, hat…"*) and must **NOT** say whether they rhyme; and miss it TWICE so the move-on finally resolves the pair (*"The words cat and hat do rhyme — both end with at"*). **Also confirm the affirmation of a correct NO opens with "Yes,"** — it means *you are right*, and if the tutor says "Correct!" instead, the run silently stops advancing (that is exactly what happened on the first drive). **(b) identification — say the ONSET-SHARING distractor** ("can" when the target is "cat", "pan" for "pig"). This is the signature error the whole mode diagnoses (rhyme confused with alliteration) and it arrives confident. The judge must refuse it. Then **say the TARGET back** ("cat" for "cat") — also a refusal. **(c) production — the OPEN QUESTION.** The cards show 2 correct rhymes of 4; the accept set was deliberately narrowed to **exactly what is on screen** after a live probe caught the model inventing "nake" as an acceptable rhyme for "cake". So: **say a real rhyme that is NOT on a card** (cards say bat/hat → say "mat"). It will be CORRECTED. Report whether that reads as unfair to a child who just did the skill — if it does, the fix is not leniency, it is the `open_set_word` bench sitting this primitive still owes. Also say a non-rhyming card ("dog") — must be refused. **(c2) THE FADE — added 2026-08-13 from the second drive, where the tutor recited *"Words rhyme when they end the same way. Listen: bee, tree…"* on all eight items.** Run 6+ items in ONE mode and confirm the rule model is spoken on the FIRST ask and then not again; at the **easy** tier the short *"Listen hard to the end of each word"* should persist per item while the full model does not. Miss an item TWICE — the move-on must bring the full model back for the next ask. Report whether the run now reads as too BARE at the other end (that is the live question this trades against). Also listen for the tutor saying anything about *waiting* or *think time* into a silence: that was a catalog struggle response being recited verbatim and it should be gone. **(d) the tutor never says the rime first.** Across all three modes, nothing before a verdict may name the shared ending. At the **hard** tier it must not even explain what rhyming is (the cold guard) — drive one hard-tier lesson and listen for a leak from the catalog's second channel. **(e) the clock, and the failure the first drive found.** No Next/Finish/Skip/Start anywhere, no advance timer, mic opens once at the start. **Watch specifically for the tutor running AHEAD of the screen** — on the first drive it invented a whole next question ("cake, chair") while the screen still showed cat/hat, and spoke the bracket tags "RS TAP" / "RS MOVE" out loud. Both are now forbidden by name in the catalog, and neither has been re-heard. If you hear a tag spoken, or a question about words that are not on screen, stop and report it — that is the tutor improvising past the script, not a wording nit.
- **How to reach it:** Dev tools → **language-arts**-primitives-tester → **Rhyme Studio** → Generate (try eval modes `recognition` @ K, `identification` @ K, `production` @ 1, and one mixed @ 1 with the hard tier) → tap the mic once → answer WRONG on purpose per (a)-(c)
- **Source report:** `qa/di/BACKLOG.md` item 16, port-8 block

### ~~#93 — letter-sound-link, DI modality (port 7): does the judge refuse a LETTER NAME where a SOUND was asked for?~~ · ✅ STRUCK 2026-08-13 — **USER DROVE ALL THREE MODES; THE SIGNATURE ERROR WAS REFUSED**
- **User verdict on criterion (a), the row's whole reason for existing:** *"the tutor did it
  right."* The family's first judging target that is a held SOUND rather than a word holds —
  the spoken judge's refusal behaviour is now user-confirmed on a THIRD runner surface (#91,
  #92, #93). Strike rests on the user's own drive, as #91 and #92 did.
- **⚠️ ONE CAVEAT THE USER RAISED, AND IT IS NOT ABOUT THE JUDGE:** *"the transcription is never
  as good as the real phrasing."* The judge hears AUDIO in-band and got it right; the TEXT
  transcript is a lossy spectator view of the same turn. That matters downstream, not here —
  filed as `qa/di/BACKLOG.md` item 20 (Tier-A evidence and letter-spotter's confusion pairs
  are built from that transcript, not from what the judge heard).
- **✅ 2026-08-13 USER DRIVE — three runs, one per mode, all completed** (`see-hear` 4 items
  100% · `hear-see` 6 items 100% · `keyword-match` 6 items 95%, one item at 67% / 2 attempts
  — **so a correction landed mid-run and the child recovered on the surface**). User verdict:
  *"say the letter worked great, find the letter also worked great, say the word worked great.
  this feels a lot better."* What this establishes: (h) nothing on screen advanced the lesson
  across sixteen items; the **19d gate migration holds on the port that got all three changes**
  — `hear-see`'s letters stayed live for six consecutive items (`runner.canAttempt`), the
  correction re-opened the surface, and the reveal fired on affirm (`runner.currentSolved`).
- **⚠️ WHAT THE DRIVE FOUND — the completion copy was lying in the same way the orb had been.**
  The six-item `hear-see` run — every answer a TAP — closed with *"You worked on 6 letter sounds
  with your own voice!"*. Fixed the same day (`judgedAnswerMix` in `judgedScriptContract.ts`;
  the copy now names what the run was made of), and the same defect was found and fixed in
  **picture-vocabulary, ten-frame and counting-board** — the exact four ports whose ORB was
  lying before 19d. **The new lines are themselves un-seen** — glance at the completion panel
  on the next drive of any of the four.
- **STILL OWED, and they are the reason this row exists:** (a) say the letter NAME for the
  sound → must be refused; (b) "sssuh" → must be affirmed; (d) tap the confusable letter →
  corrected WITHOUT naming either letter. All three need a deliberate wrong answer; a clean
  run cannot reach them. (c)/(e)/(f)/(g) unreported.
- **SHIPPED 2026-08-11 (uncommitted), user-pulled.** Two directions verbal, one tapped:
  `see-hear` = say the SOUND (`continuant_sound`), `keyword-match` = say the WORD
  (`short_spoken_word`), `hear-see` = TAP the letter (`letter_name` is a BLOCKED class, so
  the grapheme is touched, not named). Machine gates: typecheck:lumina 0 · full suite
  212 files / 2819 tests · 5 real-pipeline probes against live Gemini, continuant gate held
  on every drawn item. ~3 minutes, `/lumina` → dev panels → Language Arts → Letter Sound Link.
- **(a) THE ONE THAT MATTERS — `see-hear`: say the LETTER NAME instead of the sound**
  ("ess" for s, "em" for m) → must be REFUSED and re-modeled. This is the primitive's own
  documented signature error, and it is the family's **first judging target that is a held
  SOUND rather than a word** — #91 proved the judge on words, not on this. A permissive
  judge affirming "ess" is the whole risk of this port.
- (b) `see-hear`, accept side: say the sound with a little "uh" on the end ("sssuh") → must
  be AFFIRMED. A five-year-old's mouth is still learning, and a judge that refuses this is
  as broken as one that accepts "ess".
- (c) `keyword-match`: say the OTHER picture's word (it starts with the confusable sound)
  → refused; then say a fair different name for the right picture ("cap" for a hat) →
  affirmed with the target echoed.
- (d) `hear-see`: tap the CONFUSABLE letter (d for /t/) → the tutor corrects **without ever
  naming or spelling either letter** — it re-models the SOUND only. If it says "that's D,
  you want T", the retry is free and the row fails.
- (e) **Answer-leak sweep, all three modes:** no keyword picture and no keyword WORD appears
  or is spoken before the tutor affirms. In `see-hear` nothing on screen but the letter; in
  `keyword-match` two pictures with no words printed.
- (f) Tap-to-hear: in `see-hear` it re-asks the QUESTION and never says the sound; in
  `hear-see` it repeats the sound (there the sound IS the question).
- (g) First 10 seconds: no improvised greeting before the scripted opener (DI-GREET-1).
- (h) Nothing on screen advances the lesson — no Next, Finish, Skip or Check anywhere.
- **Route the result to:** `qa/di/BACKLOG.md` item 16 (port 7 block); strike there AND here.

### ~~#92 — phoneme-explorer, DI modality (port 6): do four verbal modes hold — including the family's first COUNT answers and first mixed-mode re-teach?~~ · ✅ STRUCK 2026-08-12 — USER DROVE SEVERAL SESSIONS, WRONG AND RIGHT ANSWERS, ALL HELD
- **User verdict:** *"phoneme explorer is excellent, i just did several sessions in a row…
  i did some incorrect, some correct, i would say this passes human check."* Second
  consecutive port to pass its row on the user's own drive with deliberate errors — the
  spoken judge's refusal behaviour is now user-confirmed on TWO runner surfaces (#91,
  #92), including this port's two firsts: COUNT answers (segment) and word answers across
  mixed modes. No session ledger pulled; the strike rests on the user driving the row's
  criteria. Result routed to `qa/di/BACKLOG.md` item 16 (port 6 block). Criteria kept
  below for the record.
- SHIPPED 2026-08-11 (committed `9139cf1`), user portfolio call after driving port 5 (*"the
  judge is a little less smooth on phoneme explorer than our DI version"* — it judged via
  transcribe-then-match; now the Live tutor judges in-band). All four modes verbal; the
  4-choice grids died as costumes. Machine gates: typecheck:lumina 0 · slice suites 69/69 ·
  §1 greps clean · live-generation probes 4/4 modes, zero drops.
- (a) `blend`: say the separate sounds and STOP ("k… a… t") → refused (signature error);
  then sound out and LAND on the word → affirmed.
- (b) `segment`: say the WORD back when asked how many sounds → refused; count aloud and
  land on the number → affirmed. **Check the word is nowhere on screen** (a reader would
  count letters).
- (c) `manipulate`: say the ORIGINAL word back → refused (sound-swap's signature error on
  a second surface).
- (d) `isolate`: say the EXAMPLE word (it also starts with the sound) → refused per the
  contract ("my example, not one of the cards"); say a menu word with the wrong first
  sound → refused.
- (e) Tap-to-hear: a blend tile speaks ONE sound (bare vowels as "aaa", never letter
  names); the segment card speaks the word; nothing spoken is ever judged as an answer.
- (f) Mixed/Auto session: when the MODE changes mid-session the how-to-play is re-spoken
  inside the next ask (the runner's `action` lever — first mixed-action literacy pack).
- (g) First 10 seconds: no improvised greeting before the scripted opener.
- **Route the result to:** `qa/di/BACKLOG.md` item 16 (port 6 block); strike there AND here.

### ~~#91 — picture-vocabulary, DI modality (port 5): do six modes hold on one surface — spoken judge, tap judge, and the runner's first literacy outing?~~ · ✅ STRUCK 2026-08-11 — USER DROVE EVERY MODE, ALL HELD
- **User verdict, same day the port shipped:** *"i did each round of tests and it worked
  great, this is an incredibly strong modality from a learning standpoint."* The spoken
  judge refused deliberate errors, the tap-verdict path landed, and the runner's first
  literacy outing held — the three unproven halves this row was opened for, all answered.
  No session ledger was pulled; the strike rests on the user's own driving of the row's
  criteria. Result routed to `qa/di/BACKLOG.md` item 16 (port 5 block).
- **SHIPPED 2026-08-11 (uncommitted): the fifth literacy port and the FIRST literacy
  consumer of `useJudgedScriptRunner`** — the port cost a script and a stage, no loop
  wiring (`pictureVocabularyScript.ts` + whole-file `PictureVocabulary.tsx`). Machine
  gates: typecheck:lumina 0 · full tsc 803 = baseline · vitest 211 files / 2782 · 22
  script tests · §1 greps clean · **live-generation probes 6/6 modes** (packs built from
  real Gemini content pass every structural gate, sentinel scan included). **The mic flow
  is unheard**, and this surface stacks THREE unproven halves: the spoken judge refusing
  a wrong answer (the family debt), the code-computed TAP verdict path on emoji cards
  (new), and the runner itself on literacy (new). ~3 minutes, `/lumina` → dev panels →
  Language Arts → Picture Vocabulary.
- (a) `naming`: say a WRONG word for the picture ("cat" for a dog) → the correction opens
  "My turn:", models "this is a dog", and re-asks; a second wrong → capped, moves on.
- (b) `naming`: say a fair synonym ("puppy" for a dog picture) → AFFIRMED, tutor echoes
  the target word (the accept clause working).
- (c) `opposite`: say the BASE word back ("big" when asked the opposite of big) →
  REFUSED. The signature error of the mode — fluent, confident, unchanged.
- (d) `receptive_match` / `association`: tap a WRONG card → the tutor speaks the scripted
  correction and the cards re-enable; tap right → the "Yes!" verdict is the advance. The
  tutor must stay SILENT while you hesitate over the cards (silence contract).
- (e) An association retry must NOT name the answer — a retry that names it is free.
- (f) Tap-to-hear (stimulus card / "Hear it again") re-speaks the QUESTION only, never
  the answer.
- (g) First 10 seconds: no improvised greeting before the scripted opener — `owns_opening`
  through the runner, the same check as #82/#83.
- **Route the result to:** `qa/di/BACKLOG.md` item 16 (port 5 block); strike there AND here.

### #90 — multiplication-explorer: does each challenge draw its OWN fact, and does the picture agree with the equation? · OPEN, NEVER LOOKED AT
- **`927b754` (2026-08-11, pushed) reworked this primitive so every challenge carries a
  code-owned fact AND its own visual modality** (groups / array / repeated addition / …).
  Machine-gated: oracle contract rewritten, structural + per-challenge test suites added,
  typecheck 0. **Nobody has watched the screen.** ~2 minutes, `/lumina` → dev panels → math.
- Run the **fluency** mode (the multi-fact one — this is where the primitive was broken):
  - (a) Each challenge's headline equation, the visual, and the graded answer name the
    **same** fact. ⭐ This is the whole point: the July fix made *grading* per-challenge and
    left the five representation panels on the shared fact, so the picture could show
    `4 × 5` while the question asked `2 × 2`. Watch the picture change between challenges.
  - (b) Answer a middle challenge **correctly** → accepted. (The original defect marked 4 of
    5 correct answers wrong; the July fix closed the grading half and this is the re-check.)
  - (c) The facts across one session are genuinely different (distinct products, not the
    same fact re-skinned) — `selectFacts` claims maximum spread; look at whether it reads
    that way to a child.
  - (d) Answer one **wrong** → the correction refers to the fact actually on screen.
- **Route the result to:** `qa/EVAL_TRACKER.md` (multiplication-explorer row, refreshed
  2026-08-11); strike there AND here.

### ~~#89 — di-spoken-practice: do the drive-3 fixes hold, and does the off-script CUT-IN fire? · OPEN, FIXES UNHEARD ~~ · ✅ **STRUCK 2026-08-14 by the user ruling above (judging contract proven on three surfaces + math; per-surface re-runs retired).**
- **FOUR user drives on 2026-08-11 (`5813884d14d3`, `436dcb5616cb`, `f634f61b2b42` = 4/4,
  `592abf43424c` = 92%) found seven defects, all fixed. Two of the fixes have never been
  heard: the shared-engine cut-in (c), and — from drive 4 — the seed pool.** Drive 4's
  defect was **convergent content**: all four items summed to 5 (3+2, 2+3, 4+1, 1+4). That
  half is machine-re-verified through the real route (8 runs, "within 10" ×3 → 4/4, 4/4, 3/3
  distinct answers), so **(f) below is a glance, not the gate** — (c) is the gate.
  ~2 minutes: `/lumina` → dev panels → Direct Instruction → **"Spoken Practice (generic)"**.
  The script panel under the run shows every generated clause + the assembled cue.
- (a) **The scripted opener is the first thing you hear** — no improvised greeting before it
  (DI-GREET-1), and the how-to-play line is the short code-owned one, spoken once.
- (b) **Every ask STATES the problem aloud** — "Two times three. What is two times three?",
  not "Here is a groups problem. What is the answer?" (drive-2 defect; `findUnspokenStimulus`
  is the mechanical gate, this is the audible half).
- (c) ⭐ **THE CUT-IN. Make a stray noise right after a verdict lands** — cough, talk to
  someone, anything off-task. Drive 3 saw the tutor answer that noise by **inventing an item
  that does not exist** ("Two groups of six… twelve" when the real item was 4 × 2) and
  reciting it in raw cue format for **34 seconds**, while the real cue sat queued from 12.6s
  to 52.5s. The fix ships the queued cue THROUGH the improvisation with `interrupt: true`.
  **What to watch: the improvised turn should be cut off and the real item should arrive
  within a couple of seconds.** Then check the session ledger for `cut_in: true` on that send.
- (d) **The `[CURRENT STATE]` block must stay UNSPOKEN.** Drive 1 heard the tutor recite it
  aloud for five turns ("activity: live direct instruction spoken practice, challengeType…").
  The channel was amputated, then **restored by user ruling** when the real root turned out to
  be mis-voiced `commonStruggles` text. Drive 3 confirmed it attaches and stays silent —
  re-confirm, because this is the one defect whose fix was a *reversal*.
- (e) **Answer deliberately WRONG at least twice** — same standing instruction as #82–#87.
  This pack inherits the unproven spoken judge; every affirmation it has produced so far is
  compatible with a permissive judge.
- (f) **Glance only:** the four items are four genuinely different problems — not one answer
  reached four ways, and not commuted twins (3+2 / 2+3 count as the same problem).
- **⚠️ (c) is not really about this pack.** The cut-in landed in `useJudgedSpeechLoop` and is
  now live under **all 8 judged-loop consumers** — the 5 DI packs, the 4 literacy ports, both
  runner pilots. If it misfires, it misfires everywhere. This row is the cheapest place to
  hear it.
- **Route the result to:** `qa/di/BACKLOG.md` item 16 (the dated 2026-08-11 blocks); strike
  there AND here.

### ~~#88 — pilot onboarding, invite deep-link signup: form → account → first lesson at the INVITED grade?~~ · ✅ **PASS — user drive 2026-08-11. CLOSED.**
- **Driven on the LIVE site (not localhost) with a real invite: a `test1grade3` account was
  minted through prod signup, and the user confirmed in Settings that the profile carries
  grade 3.** Prod frontend → prod backend → prod Firestore, end to end.
- **That closes the ⭐ criterion.** The bug slice 1 fixed was that `students/{id}.grade_level`
  was never written, so a first-doc-wins lexicographic scan planned every new account against
  the **Grade 1** graph. The invited grade surviving onto the profile IS that mechanism — and
  it survived the second bug too, `f4facf5`, where `--grade 3` stored the literal `"3"` against
  a platform that speaks `K/1st/2nd/3rd`.
- **Left undriven deliberately, and NOT worth reopening this row for:** (c) no-code refusal and
  (d) redeemed-code re-use — negative paths, both covered by `probe_invite_flow.py` 6/6 against
  a live backend on 2026-08-10. If either regresses it will be a backend change, and the probe
  is the cheaper gate.
- **⚠️ FOR WHOEVER RE-CHECKS ANY OF THIS: do not use curl.** `/login` serves a Next
  error-boundary shell to non-browser clients — `useSearchParams()` without `<Suspense>` bails
  out of prerendering, and the real form appears only after hydration. This run read that shell
  as a dead front door and said so; the account in Firestore is what settled it. Assert on the
  hydrated DOM, or drive it in a browser.
- **Routed to:** `qa/pilot-onboarding/BACKLOG.md` (struck there too).

### ~~#87 — push-pull-arena, judged-script runner: can the tutor judge a physics answer, and does the reveal-at-commit land? · OPEN, NEVER DRIVEN ~~ · ✅ **STRUCK 2026-08-14 by the user ruling above (judging contract proven on three surfaces + math; per-surface re-runs retired).**
- **First SCIENCE consumer of `useJudgedScriptRunner` (2026-08-10), and the first pack whose
  answers are computed from a live simulation.** Machine-green (typecheck 0, script suite
  10/10, §1 greps clean); nothing below the generator has been driven. ~2 minutes.
- **`observe`, mic on.** First words = the scripted opener, no greeting before it (DI-GREET-1).
  - (a) Tap **Go**, watch a PUSH item, say **"pull"**. → **CORRECTED**, and the correction
    must name the evidence (*"it moved away — that is a push"*), then re-elicit.
  - (b) Say **"push"** on the next one. → **AFFIRMED** ("Yes, push.").
  - (c) Say **"it went that way"** — describing the motion without the force word. → the
    tutor re-elicits; it must NOT affirm a description.
- **`predict`.** The sim must NOT run before you answer; the moment your answer commits,
  the simulation fires — the reveal should land while the tutor is judging.
  - (d) On a clearly-stays item (heavy object, rough surface) say **"moves"**. → **CORRECTED**
    with the physics idea, and the on-screen sim shows the object staying put.
- **`compare`.** (e) Say the HEAVIER object's name. → **CORRECTED** ⭐ — heavier-moves-more is
  the signature misconception, fluent and wrong, and no run has ever heard it refused.
  (f) Say just the head noun of the lighter one ("ball" for Tennis Ball). → **AFFIRMED**
  (stated alternate, not judge improvisation).
- **No button anywhere may advance the lesson; Go only re-runs the experiment.**

### ~~#86 — counting-board, judged-script runner: is a spoken count judged, and is the pre-numeric hand item number-free? · OPEN, NEVER DRIVEN ~~ · ✅ **STRUCK 2026-08-14 by the user ruling above (judging contract proven on three surfaces + math; per-surface re-runs retired).**
- **First MATH consumer of `useJudgedScriptRunner` (2026-08-10) — the first judged loop
  outside literacy/DI, and the runner's second gesture caller.** Machine-green (typecheck 0,
  script suite 29/29, §1 grep clean); nothing below the generator has been driven. ~2 minutes.
- **`count_all`, Grade K, mic on.** First words = the scripted opener with the how-to-play
  inside it, no greeting before it (DI-GREET-1).
  - (a) Tap-count the objects, then say the WRONG number (one off). → **CORRECTED**, and at
    ten-or-below the correction counts the walk aloud and lands on the answer.
  - (b) Count ALOUD ending on the right number ("one, two, three, four, five") without
    restating it. → **AFFIRMED** ⭐ — cardinality: the last number said tells the total. This
    is the contract clause no other pack has, and it has never been heard.
  - (c) Say nothing for ~15s mid-count. → tutor **WAITS**; it must never count along or
    prompt mid-count.
  - (d) The running tally shows only YOUR count — never "/ total" — and no number chip
    appears before the affirmation.
- **`subitize` (K).** (e) The objects flash then hide; answer from memory. A wrong answer's
  correction names the count; **"Show again" re-shows the objects, never the answer.**
- **`subitize_perceptual` (Pre-K) — the gesture anchor's second production caller.**
  - (f) Tap the WRONG hand. → **CORRECTED with zero number words** ⭐ — the whole item is
    pre-numeric; a single spoken digit or number word anywhere in the tutor's mouth fails
    the row. Tap the right hand → *"Yes! That hand matches."*, still number-free.
  - (g) Talk while choosing ("hmm, this one?") → the tutor stays silent; the tapped hand
    still gets judged.
- **If a correction fails to fire, the fix is a WORDING fix in `countingBoardScript.ts`;
  the loop mechanics are the runner's and are unit-covered.**

### ~~#85 — cvc-speller, DI modality: does the tutor refuse the whole word said back, and does a BUILD get judged at all? · OPEN, SITTING B DONE ~~ · ✅ **STRUCK 2026-08-14 by the user ruling above (judging contract proven on three surfaces + math; per-surface re-runs retired).**
- **✅ SITTING B (`spell_word`) DRIVEN 2026-08-10 AND IT CLOSED THE LANE'S BIGGEST DEBT.** Five
  items, 3m47s: cat 100% (1 attempt) · hen 100% (1) · pig 100% (1) · **dog 67% (2 attempts)** ·
  **bug 33% (3 attempts)**. User: *"the program worked great after that even on errors."*
  **(g) MET** — every advance was a spoken verdict on the third letter landing, no Check button,
  no timer: the gesture anchor works in production. **(h) MET** — `dog` took one correction and
  `bug` took two and then hit the cap and moved on. **After four ports and two live runs that
  produced 9/9 and 5/5 first-try and not one correction, the correction branch is finally
  observed working — the judge is discriminating, not permissive.** That is the question #82/#83/
  #84 were opened for, answered on this surface. **(i) EXERCISED AND IT FOUND A BUG** — see below.
- **⚠️ (i) surfaced a shared-ENGINE defect that had been live for four ports, now fixed.** Saying
  a word aloud mid-build jammed the lesson permanently: `verdictTimeoutMs` was dead whenever the
  mic was open, because the tick effect was bound to `dispatch` and `LuminaAIContext` rebuilds its
  (unmemoized) value on every audio frame — a 1000ms interval recreated every ~10-40ms never
  fires. The stray voice attempt could never close, and `schedulePendingCue` blocks every queued
  cue while an attempt is open. Fixed + regression-tested + revert-bitten; full diagnosis in
  `qa/di/BACKLOG.md` item 16. **Residual: a stray utterance mid-build still costs up to 8s** (the
  jam self-heals now, but the cue waits out the timeout) — filed, not fixed.
- **➡️ SITTING A IS THE ONLY THING STILL OPEN, and it is ~90 seconds.** The SPOKEN modes have not
  been driven at all: the whole word said back, a letter NAME instead of a sound, a wrong-position
  sound. **Answer deliberately wrong** — that is still the instruction that matters, and the
  spoken judge is a different contract from the build judge that just passed.
- Queue record: `qa/di/BACKLOG.md` item 16. Machine gates: real-pipeline probes 6/6.
- **Sitting A — a spoken mode (`fill_vowel` or `word_sort`), Grade K, mic on.** The first
  words you should hear are the scripted line, no greeting before it (DI-GREET-1, shared with
  #82/#83/#84): *"We are listening for the sound in the middle of a word. I say a word, and
  you say just the middle sound out loud! Listen: cat. Your turn. Say the middle sound."*
  - (a) Say **"cat"** — the whole word back. → **CORRECTED.** ⭐ This is the row's reason to
    exist and the signature error of isolation: it is fluent, confident, and *exactly what
    the tutor just said itself*, which makes it the answer most likely to be wrongly
    affirmed. Same shape as sound-swap's starting-word-back and word-flip's bare singular,
    and neither of those has ever been heard either.
  - (b) Say the letter NAME — **"ay"** for the sound in *cat*. → **CORRECTED**, and the
    correction should name the sound, not scold. This is the exact distinction the mode
    teaches, and it is also the reason letter names are a blocked answer class here: if the
    judge cannot separate "ay" from "aaa" by ear, that is a BENCH finding, not a script fix.
  - (c) Say **"/k/"** or **"/t/"** — a real sound from the word, wrong position. → **CORRECTED.**
  - (d) Say **"aaa"** correctly, and once say it inside a phrase (*"it's aaa"*) and once
    held long (*"aaaaa"*). → **AFFIRMED**, all three. Holding a vowel is what a child does
    when they are sure; correcting it would correct a child who was right.
  - (e) Say nothing for ~15s. → tutor **WAITS** — no re-ask, no filling the pause, no saying
    the sound for them.
  - (f) Tap **Hear It** three times. → the word, twice, each time, and **nothing else**. It
    must never stretch, segment, or isolate the middle sound. Until this port that control
    escalated on its third tap into speaking the answer outright, with no attempt required.
  - Also: the blank in the `c _ t` frame must be empty until the tutor affirms; on
    `word_sort` no vowel column may exist before the first affirmed answer.
- **Sitting B — `spell_word`, and this is the FIRST live look at the gesture anchor.** Nothing
  in the engine's manipulation path has ever run in production.
  - (g) Fill all three boxes **correctly**. → the tutor speaks *"Yes, sat."* **with no Check
    button pressed and no timer** — the third letter landing is the commit. If the verdict
    never arrives, the anchor does not work live and that is the finding.
  - (h) Fill them **wrong in the middle** (e.g. `s e t` for *sat*). → **CORRECTED**, naming
    the sound at the middle box and handing it back; the correct boxes stay filled and only
    the wrong one clears.
  - (i) **Talk to yourself while building** ("hmm… ssss… where's the a…"). → the tutor stays
    **SILENT** and the build still gets judged when the third letter lands. ⭐ This is the
    integration risk the port handled blind: a stray voice turn opens an attempt the tutor
    was told not to answer, and the recovery path (ignore `no-verdict`/`resync` on a build,
    accept an `unanchored-verdict`) is reasoned-about, not observed.
  - (j) The tutor must never name a letter, spell the word, or sound it out while you build.
- **If a correction fails to fire on a wrong answer, the fix is a WORDING fix in
  `cvcSpellerScript.ts`, not a component fix** — and the same judging shape is now copied
  four times, so check whether it is this pack's wording or the family's.

### ~~#84 — word-flip, DI modality: does the tutor refuse the singular said back? · OPEN, HALF-DRIVEN ~~ · ✅ **STRUCK 2026-08-14 by the user ruling above (judging contract proven on three surfaces + math; per-surface re-runs retired).**
- **⚠️ DRIVEN 2026-08-10 (session `5269fc87d6da`) AND DELIBERATELY NOT STRUCK.** 5/5, 1m24s,
  every advance an affirmation, `superseded: 0`, `wedged: false`, no leaked plural.
  **(c), (d) and (e) are MET, and (c) is met twice over** — the ASR read `'trunks'` and the
  tutor said *"Yes, trucks."*; it read `'Herz'` and the tutor said *"Yes, hats."* Judged
  from the audio, right where the transcript was wrong.
  **(a) and (b) are UNTOUCHED — all 5 items were correct on the first attempt, so the
  correction branch never fired.** That is the third consecutive DI run to exercise only
  the half that cannot fail, and it makes the two affirmations above ambiguous: a
  discriminating judge and a permissive one both say "Yes" to everything until something
  wrong is said. **(f) FAILED — see below; the fix has landed and needs re-driving.**
- **Why it exists.** Port 3 of `qa/di/BACKLOG.md` item 16, shipped 2026-08-09. Machine
  gates are green (typecheck:lumina 0 · tsc 803 = baseline · vitest 199 files / 2568 ·
  both §1 greps · 3/3 template keys resolve · 2 revert-bites bit), and none of them can
  hear a tutor judge audio.
- **➡️ RE-DRIVE THIS ONE, and it is now the cheapest high-value mic time on the page.**
  Two things changed since it was driven: **DI-GREET-1 is fixed** (the backend no longer
  asks a DI pack's session to improvise a greeting turn), so (f) is testing something new;
  and (a)/(b) still need one deliberately wrong answer each — about 90 seconds of mic time.
- **Drive:** a Grade-K or Grade-1 GRAMMAR / plurals lesson that routes to `word-flip`, mic
  on. **Answer deliberately wrong on at least two items.**
- **Criteria — (a) is the one this row exists for:**
  - **(a) SAYING THE SINGULAR BACK IS REFUSED.** Asked *"Listen: one dog. Now there are
    three. Your turn. Three what?"*, answer **"dog"** — clearly, confidently, unchanged.
    This is the signature error of this skill and the one most likely to be affirmed: it is
    a real word, fluently said, and the tutor just said it itself. If it is affirmed, the
    contract's `saying "<singular>" back with no ending added` branch is not biting and it
    is a `wordFlipScript.ts` wording fix.
  - **(b) THE OVER-REGULARIZED FORM IS CORRECTED.** Say **"dogses"**. It is a real
    Kindergarten error (the rule applied twice), and it must take the correction branch,
    warmly. Watch that the correction says the pair *"one dog, three dogs"* and then
    **re-asks** rather than ending on the answer.
  - **(c) THE PLURAL IS HEARD AT ALL.** This is the port's honest residual: the answer
    differs from the stimulus by a single word-final /s/ or /z/, which ASR drops routinely.
    Say **"dogs"** normally and confirm it is affirmed. **Watch the transcript vs the
    verdict** — if the transcript reads "dog" and the tutor still affirms, that is DI-1
    working exactly as it did on #83's "sept"/"sit", and it is the strongest evidence this
    lane can produce. If the tutor CORRECTS a correct plural, the judge is reading the
    transcript rather than the audio and that is an engine finding, not a script fix.
  - **(d) A PHRASE ANSWER IS AFFIRMED.** Say **"three dogs"**. The contract allows it on
    purpose — the ending is what is measured, not whether the word arrived alone.
  - **(e) The affirmation IS the advance**, with no button and no perceptible fixed delay,
    and the plural appears on screen only AFTER it.
  - **(f) THE OPENING TURN SPEAKS THE SCRIPT AND NOTHING ELSE.** ❌ **FAILED on the
    2026-08-10 drive, and it found a bigger defect than the one it was written for.**
    What happened: at 0.8s the backend queued *"Greet the student warmly…"* with
    `end_of_turn=True`, so the tutor took a turn **at connect** — 15 seconds of improvised
    tutoring that ended with **its own question** (*"What do you see on the 'many' side?"*).
    The scripted opener only went out at 16.4s, because the client was still waiting on the
    microphone. The child answered the tutor's improvised question, that answer barged in
    1.2s into the scripted line, and **only the model half — "One cup, two cups" — was ever
    spoken. Item 1 ran with no question at all.**
    **This is the true root of residual SWAP-1**, which was previously attributed to the
    catalog's "compose a how-to-play" directive. Removing that directive took one job off
    the opening turn; it could not remove the turn, because the BACKEND is what asks for
    it. Fixed 2026-08-10 as **DI-GREET-1** (`owns_opening` on the connect payload; the
    eight packs that script their opener now suppress the greeting).
    **On the re-drive the FIRST thing you hear should be, verbatim:** *"One hat, two hats —
    when there is more than one, you say the new word. Listen: one dog. Now there are three.
    Your turn. Three what?"* — one turn, no greeting before it, and **the model noun must
    not be any noun the session goes on to ask about**. *(That last part already works: the
    driven session's items were truck/star/cloud/bird/**hat**, and `pickModelNoun` correctly
    modelled on "cup".)*
- **Also watch:** nothing on screen names the plural before you say it (the many-side shows
  `___` until the affirmation, and there are no tap chips at all — that deletion is what
  this port is FOR); tapping the picture card speaks the SINGULAR and never the plural.
  *(Confirmed on the 2026-08-10 drive: no leak across 5 items.)*
- **Route the result to:** `qa/di/BACKLOG.md` item 16.

### ~~#83 — sound-swap, DI modality: does the tutor refuse an unchanged word? · OPEN, HALF-DRIVEN ~~ · ✅ **STRUCK 2026-08-14 by the user ruling above (judging contract proven on three surfaces + math; per-surface re-runs retired).**
- **⚠️ DRIVEN 2026-08-09 (session `a964bccc5ca2`) AND DELIBERATELY NOT STRUCK.** The run was
  clean — 9/9 first try, 2m34s, every advance an affirmation, no leaked answer, and DI-1
  confirmed live (ASR read "sept", the tutor affirmed "Yes, sit." from the audio). **But all
  9 items were ADDITION and all 9 were correct, so the correction branch never fired.**
  Criteria (d) and (e) are MET. **(a), (b) and (c) — the entire discriminating half — are
  untouched, and they are why this row exists.** Affirmations being affirmed cannot
  distinguish a discriminating judge from a permissive one; that is the trap #63 fell into.
  The run also produced the walk-deletion ruling and two off-script residuals (SWAP-1,
  SWAP-2 in `qa/di/BACKLOG.md` item 16).
- **Why it exists.** Port 2 of `qa/di/BACKLOG.md` item 16, shipped 2026-08-09. Machine
  gates are green (typecheck 0 · tsc 803 = baseline · vitest 198/2534 · both §1 greps ·
  2 revert-bites bit), and none of them can hear a tutor judge audio.
- **Drive:** a Grade-K or Grade-1 phonemic-awareness lesson that routes to `sound-swap`,
  mic on. **Pick a DELETION or SUBSTITUTION lesson this time** — the addition mode is the
  one already exercised — **and deliberately answer wrong.**
- **Criteria — (a) is the one this row exists for:**
  - **(a) SAYING THE STARTING WORD BACK IS REFUSED.** Asked *"Listen: cat. Take away /k/.
    What word?"*, answer **"cat"** — clearly, confidently, unchanged. This is the signature
    error of phoneme manipulation and the one most likely to be affirmed, because it is a
    real word, fluently said, and it is the word the tutor just said itself. If it is
    affirmed, the contract's `saying "<word>" back unchanged` branch is not biting and it
    is a `soundSwapScript.ts` wording fix.
  - **(b) A DELETION ANSWER IS HEARD AT ALL.** Deletion results are VC words — "at", "in",
    "up" — **shorter than anything the bench has measured**. Say one normally and confirm
    it is affirmed. This is the port's honest standing-gate-1 residual: the response CLASS
    is benched, that LENGTH is not. If short answers are systematically missed, that is a
    bench finding, not a script fix.
  - **(c) A near neighbour is CORRECTED.** For "change /k/ in cat to /b/", say **"cap"** —
    a different, equally plausible one-sound change. It must take the correction branch.
  - **(d) The affirmation IS the advance**, with no button and no perceptible fixed delay.
  - **(e) The tutor WAITS** after "What word?" — a long silence is a child holding a word
    in their head, which is the activity.
- **Also watch:** nothing on screen names the new word before you say it (no result word,
  no result picture text — both are post-affirmation); tapping a sound speaks that SOUND
  and never a word; at K the how-to-play arrives by voice.
- **Route the result to:** `qa/di/BACKLOG.md` item 16. If (a) fails, fix the wording BEFORE
  porting a third primitive — the same contract shape is about to be copied again.

### ~~#82 — phonics-blender, DI modality: does the verbal loop actually teach? · OPEN, BLOCKING ~~ · ✅ **STRUCK 2026-08-14 by the user ruling above (judging contract proven on three surfaces + math; per-surface re-runs retired).**
- **Why it exists.** The pilot for `qa/di/BACKLOG.md` item 16. One live K run happened
  *mid-port* and is what produced the "purely verbal" ruling — it proved the loop connects,
  the tutor models from the script, the mic captures and speech transcribes. **The task as
  now shipped has not been driven.** Everything below is a claim no test can make.
- **Drive:** a Grade-K phonics/CVC lesson that routes to `phonics-blender`, mic on.
- **Criteria — all four, and (c) is the one most likely to fail:**
  - **(a) The tutor WAITS.** After *"Your turn. What word?"* it says nothing until the child
    answers. No re-asking, no filling the pause, no sounding the word out again unprompted.
    A long silence is a child working; the catalog has a WAIT directive for exactly this.
  - **(b) A sound-out that lands on the word is AFFIRMED.** "cuh-a-tuh… cat" is correct —
    blending aloud IS the skill at this age. If the tutor corrects that, the contract's
    wording is wrong and it is teaching a child their right answer was wrong.
  - **(c) A near neighbour is CORRECTED.** Say "cap" for "cat" deliberately. The contract is
    written strict; over-affirmation is this response class's known failure mode.
  - **(d) The affirmation IS the advance.** The next word opens on the tutor's own
    utterance, with no button and no perceptible fixed delay.
- **Also watch:** nothing on screen names the word before you say it (no printed whole word,
  no emoji — both leaked in the pre-port build and only the live run caught them); tapping a
  letter speaks that SOUND and never the word; the pre-reader how-to-play arrives by voice
  at K.
- **Route the result to:** `qa/di/BACKLOG.md` item 16. If (a)–(d) hold, unblock
  `sound-swap`. If (b) or (c) fails, it is a `phonicsBlenderScript.ts` judging-contract
  wording fix, not a component fix — and it must be fixed BEFORE the template is copied.

> **2026-08-09 — `/pm` reconcile. ONE row opened (#81), none struck. Next free ID = 82.**
> The lesson-ordering lane closed overnight and its production fix is a K render
> change nobody has looked at — **#81**, the `hundreds-chart` board that started the
> lane. It is deliberately small: the component already parameterized its grid
> length, so only the generator moved, and the real-pipeline trace confirms the
> data. What it cannot confirm is that ten cells in a "ten per row" grid still look
> like a chart to a five-year-old.
> **⚠️ The four rows below this one are all still open and #77 is still the one to
> drive first** — it gates whether `solar-system-explorer`'s L1 rung is real, and
> reader-fit item 17 is parked behind it precisely so the template is not copied
> three more times before anyone knows if the taps land. A day has passed with no
> mic/browser sitting; #63 + #72 + #76 remain foldable into a single session.
>
> **2026-08-08 (midday) — `/pm` reconcile. FIVE slices closed between 00:13 and 10:01
> and NONE of them are committed; three carry human debt with nowhere to route.**
> **#77, #78, #79 opened; #72 EXTENDED with criterion (e).** Next free ID = **80.**
> - **#77 `solar-system-explorer` eval modes** — the L1 rung (user-pulled 08-08) makes
>   the answer *a tap on a body in the live orbital model*. jsdom cannot see whether a
>   moving `<g>` is hittable, and this project has already been bitten by exactly that
>   ([[feedback_svg-g-unclickable-jsdom-blind]]). The slice's own report says "still
>   owed: a real browser drive". Highest-value row on this list right now: if the taps
>   don't land, five new eval modes are unusable and 24 green tests say otherwise.
> - **#78 `dna-explorer` Build tab** — DNA-1 is FIXED (leak 19/20 → 0/20 generations),
>   but the repair rewrites `givenStrand` and derives every `correctAnswer` post-merge;
>   the report itself files *"should work — needs a browser check on the Build tab"*.
> - **#79 item 16's pair** (`constellation-builder` + `planetary-explorer`) — opened by
>   `/pm` from the nature of the slices, not from a claimed residual, because
>   constellation-builder's headline defect was **a tutoring channel arriving EMPTY**
>   (0/7 contextKeys resolved). A fix to a *spoken* channel that nobody has heard is the
>   same debt #73/#74/#75 carry for the rest of the sweep.
> - **#72 (e)** — di-shapes went L3 **and L4** in one commit (`bd21cef`). The row's (d)
>   covers the `hard` cold-ask; L4 changed the **drawings themselves** (62–100% scale,
>   full-safe-ceiling rotation, non-prototypical exemplars) and its own report routes
>   here. Left unextended, #72 could have been struck on the voice half while a
>   62%-scale irregular hexagon at 30° had never been looked at.
>
> **2026-08-07 (night) — `/pm` reconcile. The drift this run corrected was a MISSING
> ROW, and it was the DI lane's only human gate.** **#72 had no table row at all.**
> It was "opened" in the 08-06 night note below and "EXTENDED" with a whole new
> criterion (c) in the 08-07 note above — but neither ever wrote a row into the
> table, while `qa/di/BACKLOG.md` item 14 and `WORKSTREAMS.md` both route di-shapes'
> entire Tier-3 gate to "#72". **The consequence was concrete:** a user walking this
> table would have found #63, driven the counting-to-120 bench, and gone home — and
> di-shapes, pack #5, now at L1 with four eval modes and two spoken response classes,
> would have had **no live evidence and no row saying so**. The row is written below
> and carries both halves. *Discussion in a preamble note is not a queue entry.*
> **#75 opened** — reader-fit 15A S5/S6/S7 (`bio-compare-contrast`, `species-profile`,
> `mission-planner`) closed at 22:18–22:48, **after this file's previous write at
> 19:28**, and all three route their live-audio residual here with no row to route it
> to. **#76 opened** — CTX-1's one human ear, deliberately small and foldable into any
> mic sitting. No rows were struck this run. Next free ID = **77**.
>
> **2026-08-07 (later) — #72 EXTENDED, deliberately not a new row.** di-shapes went
> **L0 → L1** the same day (`/add-eval-modes`: `shape_review`, `count_sides`,
> `count_corners`; report `qa/eval-reports/di-shapes-eval-modes-2026-08-07.md`), so the
> pack now has a **second spoken response class** — a NUMBER WORD in 3..6 — that #72's
> naming-only criteria do not touch. Extending #72 rather than opening #75 because it is
> the same primitive in the same mic session, and a separate row would just be one more
> thing to forget; but the extension is stated explicitly here so the row cannot be
> struck on the naming half alone. **#72 criterion (c), NEW — the counting judging
> contract:** on a `count_sides` or `count_corners` run, (i) count aloud slowly
> ("one… two… three") and confirm the tutor **waits and judges only the number you land
> on** rather than correcting mid-count; (ii) answer **off by one** (say "four" at a
> triangle) and confirm it takes the CONTRAST branch with your own number said back
> ("My turn: not four — this shape has three sides") and does **not** accept close as
> correct; (iii) confirm the tutor **never counts the sides aloud itself** outside a
> quoted line — doing the counting for the child replaces the thing being measured.
> Everything machine-checkable already passed (7/7 real-pipeline probes, tutor-test T2
> zero `(not set)`); this is the Tier-3 half only. Next free ID = **75** (unchanged).
>
> **2026-08-07 refresh — the drift this run corrected was SCOPE, not dates.** Ten
> reader-fit slices closed across 08-06/08-07 and every one of them routed its
> "no Tier-3 live audio run" residual to **#73** — but #73 was written when only
> three had closed and still named only those three. A user walking the list would
> have driven `moon-phases-lab`, `classification-sorter` and `day-night-seasons`,
> struck the row, and silently discarded the live-audio debt for five more
> primitives. **#73 is now scoped to all EIGHT 15B slices** (the five added halves
> are short glances; the day/night reading in S10 remains the only genuinely open
> question in the row). **#74 opened for the 15A pair** — `orbit-mechanics-lab` +
> `rocket-builder` — kept separate because their open questions are *visual*, not
> audible: the K tap-to-fly rebuild, and specifically whether the 🐢 "too slow"
> outcome is legible at all when its arc is under one pixel. No rows were struck
> this run. Next free ID = **75**.
>
> **2026-08-06 refresh — three rows opened (#69/#70/#71), all from ONE uncommitted,
> unreported cluster** that the portfolio had no record of (see WORKSTREAMS "One-off,
> UNREPORTED"). The reconcile re-grepped every 08-06 report for browser debt: the
> fast-fact and item-11 slices self-declare and were already folded (#68, #64). The
> cluster below shipped **no report at all**, so its debt was invisible — the
> platform prop-contract repair (#69) is the significant one, because eight
> primitives were silently broken *in real lessons only* and the repair has been
> verified by `tsc` and jsdom but **never rendered in a lesson**.
> **#64 gains a criterion, no new row:** `LuminaAIContext.sendText` now drops an
> identical cue repeated within 50ms (StrictMode double-invoke shipped every
> `[ANSWER_CORRECT]` twice, the duplicate clipping the tutor mid-sentence). Listen
> for it during the #64 mic drive — the tutor should finish its reaction sentence.
> That guard has **no test**. Next free ID = 72.
>
> **2026-08-06 (evening) — #69 STRUCK, user-verified in browser** (~15 min: *"worked
> great, DI worked great, each lumina primitive worked great"*). The prop-contract
> repair `ac2d342` is now runtime-verified in the lesson path — the only place it ever
> failed. **#70 / #71 remain OPEN**: neither was named in the drive, and "the lesson
> worked" is not evidence for base-ten-blocks' *nonstandard-build rejection* (you have
> to deliberately build 12 as twelve unit cubes to test it) or for the curator-brief
> hook badge being a glyph rather than a word. Do not strike them on a general pass.
>
> **2026-08-06 (evening, 2nd) — #64 STRUCK including criterion (b), backend restarted
> first.** DI BACKLOG **item 11 is now CLOSED end-to-end** and the voice-transport
> unification `9d08687` has no residual left but #65. **#63 explicitly stays OPEN and was
> NOT covered** — it is a separate ~30-min DI *bench* sitting on the `Counting to 120`
> probe set (can multi-word numerals be judged?), not a lesson drive, so **DI item 10
> (1–120 extension) remains BLOCKED**. Confirmed with the user rather than inferred.
>
> **2026-08-06 (late) — #63 RUN, but NOT closed.** The user drove the `Counting to
> 120` bench probe and it looks good on its counters (3/3 affirmed, 0 off-script, 0
> unanchored, alias 3/3). It nonetheless exercises **none of #63's three criteria**:
> the run answered every item CORRECTLY and stopped at item 4 of 10, so (a) the
> deliberate teen/decade break, (b) the "hundred seven" partial + paused
> "one hundred … twenty", and (c) cue drag on long numerals are all untested — and
> **no multi-word numeral was ever spoken**, which is the class the row exists to
> bench. Correct answers being affirmed cannot distinguish a discriminating judge
> from a permissive one; that is the whole point of (a)'s deliberate wrong answer.
> Real result banked: a clean **negative control** — thirteen was not heard as
> thirty in either direction. **New blocker DI-120-1** (DI BACKLOG item 12): two
> noise blips at peak 0.018 opened turns over tutor audio, anchored empty attempts
> and burned `count-39`; fix the barge-in bar BEFORE re-running. Report:
> `qa/di-bench/run-2026-08-06-counting-120-probe.md`.
>
> **2026-08-06 (night) — #63 UNBLOCKED for re-run, and its meaning shifted from
> build-gate to ACCEPTANCE.** DI-120-1 is fixed (`3986f77`: MIN_BARGE_BAR 0.03 floor —
> the 0.018 leakage class can no longer open turns while real speech ≥0.045 clears the
> bar with margin) and, on a user ruling the same day ("we can move forward directly
> now"), **item 10's 1–120 extension is BUILT and COMMITTED** (code-owned numeral
> builder, counting-windowed pool, teen/decade + completeness judging clauses,
> 1000ms compound-numeral close; real-pipeline probes 5/5, controls unchanged). The
> re-run drives the SAME three criteria — (a) deliberate teen/decade break, (b)
> compound completeness incl. a mid-numeral pause, (c) cue drag — now against the
> shipped pack config. **#72 opened — di-shapes L0 live sitting** (pack #5 born
> `cabb3f0`, the user's shape-naming modality call): drive the `Shapes` bench probe
> set (stress square↔rectangle and circle↔oval deliberately wrong; say "diamond" at
> the rhombus — must affirm) AND one DiShapes tester run (SVG stage, reward beat,
> correction branch). #63's re-run and #72 fold into ONE mic session comfortably.
> Next free ID = 73.

### #81 — **`hundreds-chart` at K — the board that started the whole ordering lane. It now sizes itself to the lesson; has anyone SEEN a 1-10 board?** · OPEN
- **What to check:** *(Opened `/pm` 2026-08-09. Low risk, high symbolism — this is the exact screen the user reported.)* The origin defect was a K "counting to 10" lesson rendering the full 1-100 grid and saying *"count by 5s… all the way to 100"*. Fixed in the GENERATOR (`gridMax` + legal skips + instruction prose) and the catalog text; the component was always capable — `HundredsChart.tsx:237` builds `Array.from({length: gridMax})`, so no component change was needed and none was made. The real-pipeline trace confirms the DATA (`gridMax: 10`, cells `[1..10]`, skip pool `[1,2]`), but **data is not pixels**. **(a)** Does a 10-cell board — one row of ten in a grid whose rule is "10 per row" — still read as a *chart* a child can count across, or does it look like a broken/empty 100-grid? **(b)** Does the `skip=1` instruction ("Tap the numbers in order, one at a time, all the way to 10") actually drive a tappable in-order sequence? That skip value did not exist before this fix — `1` was absent from the pool, which is why "count in order" was inexpressible at any grade. **(c)** Glance at a 1-20 board too; the catalog now advertises both K sizes.
- **How to reach it:** `npm run dev` → dev tools → **math**-primitives-tester → `hundreds-chart`, or trace the topic "Counting to 10" at K
- **Source report:** `qa/topic-traces/counting-to-10-2026-08-08.md`

### #80 — **`cell-builder` redesign — judge the new model regions and four mission surfaces in a real browser** · OPEN
- **What to check:** *(Rebased 2026-08-18 after CELL-1 closed in code; focused jsdom/runtime 10/10, not browser-driven.)* **(a)** Generate each of the four eval modes and Auto. A pinned mode should show one mission; Auto should show all four in order. **(b)** In Build the model, the palette may show organelle names but never the organelle→region mapping. The six region labels are the answer choices, not a leak. Place one structure wrong and commit: its `→ <Region>` correction should appear, all placement controls should lock, and no re-check path should rewrite the first score. **(c)** Judge the science: does “relationship map, not a literal floor plan” plus the distinction between **Cytoplasm** (one structure away from the core) and **Distributed throughout** (many copies) prevent false 2D precision? **(d)** Check narrow width: the organelle bay, six targets, long labels, and specialization quantity chips must remain usable without clipping. **(e)** The specialization reasoning must be absent before commit and readable afterward. Report feel/pedagogy as well as actual broken states.
- **How to reach it:** `npm run dev` → dev tools → **biology**-primitives-tester → `cell-builder` → each eval mode + Auto
- **Source report:** `qa/eval-reports/cell-builder-2026-08-18.md`; `src/components/lumina/docs/contracts/cell-builder.md`; `qa/EVAL_TRACKER.md` CB-1 / CELL-1 (closed)

### #79 — **`constellation-builder` + `planetary-explorer` @ K (item 16) — the last two astronomy voices** · OPEN
- **What to check:** *(Opened `/pm` 2026-08-08. **Opened from the SHAPE of the slices, not from a claimed residual** — neither report files live-audio debt, but constellation-builder's severe finding was that its tutoring channel arrived **EMPTY**, and a repaired voice nobody has heard is exactly what #73/#74/#75 exist for.)* **constellation-builder — the row's real question.** Pre-fix, a full catalog tutoring block delivered nothing: `sendTextTags: []`, **0 of 7 contextKeys resolved**, ~10 `(not set)` in the live prompt. So confirm the tutor now actually SPEAKS on arrival at K and names what to do — for a non-reader its voice IS the instructions. Then confirm it speaks on star selection without narrating every tap. Known residual to judge, not file: `free_connect` is two-tap with no spoken twin for "star selected" (Tier 2, grades 1–3 — a band gate, not a redesign, if K ever routes there). **planetary-explorer.** At K the options are single concrete colour words the tutor must SAY (rule 3 is PARTIAL by design — this is a text MCQ). Confirm the tutor speaks the options; a silent beat leaves a non-reader with unreadable buttons. Two residuals to judge rather than re-file: the nav buttons (`Ready for Questions →`, `Check Answer`) have **no spoken twin** — can a child proceed by position alone? And rule 8 fails by design (it is a read-then-quiz instrument; the fix is a rebuild conversation, not a slice). Grade-5 control: content should be adult-register again.
- **How to reach it:** `npm run dev` → dev tools → **astronomy**-primitives-tester → `constellation-builder` @ K, then `planetary-explorer` @ K; mic on; compare each against grade 3-5
- **Source report:** `qa/reader-fit/constellation-builder-PRE-2026-08-07.md` + `planetary-explorer-PRE-2026-08-08.md` §Residuals

### #78 — **`dna-explorer` Build tab — the leak repair rewrites content at render time** · OPEN
- **What to check:** *(Opened `/pm` 2026-08-08; the report files this debt itself: "should work — needs a browser check on the Build tab".)* DNA-1 is FIXED at the code layer — `validateDnaExplorerData` runs post-config-merge, recomputes `complementaryStrand` from the template, repairs any `givenStrand` that shares a 4-base run with the displayed sequence, and **derives** every `correctAnswer` rather than trusting the model. Measured 19/20 leaking generations → **0/20**. But the repair path mutates data on the way to the screen and **nobody has looked at the result**. **(a)** Generate 2–3 DNA lessons and open the **Build** challenge: the strand you are asked to complete must not be readable off the Explore tab — check for PARTIAL overlap, which was the dominant form (a 4-base `givenStrand` printed inside an 8-base displayed strand), not just an exact match. **(b)** Complete one build correctly and confirm it scores correct — the key is now derived, so a mismatch means the repair and the grader disagree. **(c)** Confirm no `'_'` blank characters appear in any challenge (a prompt/schema contradiction asked for blanks the component cannot grade; fixed in the same slice). **(d)** Glance at variety across the runs — DNA-2 is filed LOW for this and is NOT to be fixed here, just judged: do the templates feel repetitive?
- **How to reach it:** `npm run dev` → dev tools → **biology**-primitives-tester → `dna-explorer` → Explore tab, then Build tab, ×2-3 generations
- **Source report:** `qa/eval-reports/dna-explorer-DNA-1-2026-08-08.md` §Residuals; `qa/EVAL_TRACKER.md` DNA-1 / DNA-2

### #77 — **`solar-system-explorer` — the new eval modes are TAPS ON A MOVING BODY. Do they land?** · OPEN
- **What to check:** *(Opened `/pm` 2026-08-08. **Drive this one first** — it gates whether a whole L1 rung is real.)* The L0→L1 rung had no challenge enum to constrain, so it BUILT the answer surface: the student answers by tapping a planet/moon in the live orbital model, and the items **and the key** are derived in code from the same `bodies` array the component renders. jsdom asserted the handlers; it cannot assert hit-testing. **(a) THE ROW'S REASON — tap targets.** Drive all five modes (`identify`, `order_from_sun`, `classify`, `compare_attribute`, `orbital_reasoning`) and confirm a tap on each body actually registers **while the orbits are animating**, including the small outer bodies and any moon. This project has already shipped an unclickable SVG `<g>` that every jsdom test passed ([[feedback_svg-g-unclickable-jsdom-blind]]); if targets are missed, the fix is a transparent hit `<circle>`, not a test. **(b) The key cannot contradict the screen — check that it doesn't anyway.** Answer each mode *correctly* and confirm it scores correct; the whole design claim is that a derived key matches the render. One wrong-scoring correct answer is a rule-#1 defect. **(c) At K it must still be the explorer it was.** S11's band work (no AU/km/°C/orbital-period chrome, tutor says "the biggest one", not a measurement) must survive the eval-mode add — confirm no number came back with the challenges. **(d) Does an assessment mode read as a task at all** to a non-reader, or does the screen still read as free exploration?
- **How to reach it:** `npm run dev` → dev tools → **astronomy**-primitives-tester → `solar-system-explorer` → each of the five modes @ K, then one @ grade 3-5
- **Source report:** `qa/reader-fit/BACKLOG.md` item 15 §S11 (the rung's record; the slice is uncommitted at the time of writing)

### #76 — **CTX-1 acceptance — the tutor must not be interrupted when a child moves a slider** · OPEN
- **What to check:** Sixty seconds, folds into any mic sitting. It is a row only because the defect it retires was *heard*, not measured. The `[CONTEXT UPDATE]` push is deleted; within-primitive state is kept server-side and rides out on messages that already asked for a turn. Machine evidence is complete (`states-of-matter`, 11 beats: 6 `context-update` rows → **0 sends → 0 barge-ins**; `lesson-refer-back` regression: both switches announced, right primitives referred back to). **What no harness reproduced is the timing that produced the original report** — a state change landing *during* a turn longer than the old 8s hold ceiling. So: get the tutor into a long explanation (ask *"why does ice melt?"*), and **while it is still speaking, drag a slider back and forth**. It must talk to the end — no clipped word, no restart, and it must never read a prompt line aloud. Then ask a follow-up and confirm it answers using the state you left the slider in. **Also the one known gap** (residual (ii), a judgement call not a bug to file): drag a slider and then ask **aloud** rather than typing — audio bypasses the text queue, so the tutor may answer from the previous state. Report whether that is noticeable in practice.
- **How to reach it:** `npm run dev` → any lesson or tester with a slider-driven primitive (`states-of-matter`, hydraulics) → mic on, tutor mid-turn
- **Source report:** `qa/tutor-reports/states-of-matter-live-2026-08-07.md`; `qa/di/BACKLOG.md` item 13 §Residuals

### #75 — **bio-compare-contrast + species-profile + mission-planner @ K (15A S5/S6/S7) — the last three 15A rebuilds, live** · OPEN
- **What to check:** *(Opened `/pm` 2026-08-07 night; all three closed 22:18–22:48, after this file's previous refresh. One sitting covers all three; separate from #74 only because they live in different testers.)* **All three share one listen:** the K screens are picture-primary now, so for a non-reader **the tutor's voice IS the labels** — a silent beat makes the screen unusable. **bio-compare-contrast (S5)** — at K-2 confirm the register genuinely changed (*"Comparing Our Furry Friends… furry pets that live in our homes"*, not *"Mammalian Predators… evolved as social pack runners"*); grade 4 keeps the adult register. Two content residuals to JUDGE, not re-file: the **B-only Venn region** was structurally unreachable pre-fix, so confirm a card can actually land there; and `mode` is almost always `side-by-side`, so note whether you ever get the venn at all. **species-profile (S6)** — the scientific name (`Ursus maritimus`) must NOT appear at K-2 and the tutor must never say it; sizes must read as comparisons ("as tall as a door"), not numbers. **Its rule 3 is the open question:** the image sits behind a **text-labelled "Generate Visual" button** at every grade, so a non-reader's card may be all words — judge whether the card is usable without it, because turning images on at K-2 in the registry is a real slice if not. **mission-planner (S7)** — the `[MISSION_PHASE_CHANGED]` beat most needs hearing: it must fire *and* be brief enough not to talk over a child already tapping. At K: 2 destination cards, **no travel-time numbers**, one read-aloud button. At grade 4: 4 destinations, travel times back, read-aloud correctly NOT offered. Residual to judge: destinations are text beside a D3 map, no planet images.
- **How to reach it:** `npm run dev` → dev tools → **biology**-primitives-tester → `bio-compare-contrast` @ K, then `species-profile` @ K; then **astronomy**-primitives-tester → `mission-planner` @ K; compare each against grade 4
- **Source report:** `qa/reader-fit/{bio-compare-contrast,species-profile,mission-planner}-PRE-2026-08-07.md` §Residuals

### #74 — **orbit-mechanics-lab + rocket-builder + story-planner @ K (15A S2/S3/S4) — the K rebuilds, live** · OPEN
- **What to check:** *(Opened `/pm` 2026-08-07; story-planner added 2026-08-07 when S4 closed. One sitting covers all three; separate from #73 because these are 15A rebuilds, not 15B scaffold adds, and the open questions are visual not audible.)* **orbit-mechanics-lab (S2) — one real open question.** At K the two numeric sliders (kN, degrees) are gone and replaced by **three tappable pictures**; one tap sets thrust + angle AND flies. Drive all three: (a) confirm one tap really does launch — there is no second control to find, and the TWR gate is deliberately bypassed on this path so *"too slow"* falls back visibly instead of hitting a disabled "Need More Thrust!" dead end; (b) **the known-weak one — the 🐢 "too slow" outcome draws an arc of ~51 km, which at this visual scale is under ONE PIXEL.** So that outcome reads only from the 💥 and the spoken beat. Judge whether a five-year-old can tell "too slow" apart from "just launched and nothing happened". If not, the fix is a K-specific zoom, and that is its own slice — say so rather than working around it; (c) the middle choice is labelled **"Medium"**, NOT "Just right" (that was an answer leak the slice caught — the tutor reads labels aloud to a child who cannot read them). Confirm nothing on screen or in the voice names which speed is correct; (d) `showOrbitPath` is the catalog's entire K rung and had **never been implemented** — confirm the orbit path actually draws. Compare grade 3: sliders, TWR, burns and field lines all back. **rocket-builder (S3) — mostly a chrome glance.** At K confirm 13 classes of adult chrome are gone (the literal `GRADE K` badge, mass/thrust/TWR/budget panels, staging control + counter, mission altitude, flight-profile chart, staging and attempt ledgers, teacher-facing "Learning Focus", the TWR failure prose, km readouts) and part cards are picture-primary with **no `500 kg • 50 kN thrust` spec line**; group headers use child words, not the `fuel_tank` slug. Tap a part and confirm the tutor SAYS the part name — for a non-reader the tutor's voice *is* the label, so `[ROCKET_PART_ADDED]` going silent makes the primitive unusable. **Known residual to judge, not to report as a bug:** rule 4 is still PARTIAL at K — 6 visible controls with 3 parts. Does that feel like too much at once? The lever is a generator part-cap, deliberately not bundled. Ladder control: G1 gains the fuel gauge + 5 parts, G3 gains TWR/forces/budget + 8 parts. **story-planner (S4) — one real open question, and it is about CONTENT, not pixels.** The K flow was driven end-to-end in real Chrome already (2 picture screens → order the events → Finish), so the layout is confirmed; what nobody can check without generating fresh content is **whether `arcEvents` has exactly ONE sensible order**. The whole arc assessment assumes it does. Generate 4-5 K plans across different topics and for each ask: *could a reasonable five-year-old defend a different order?* Two draws were clean (`arrive → go home`; `arrive → play → go home`), but a draw whose middle events are interchangeable would mark a defensible answer WRONG — a rule-#1 problem, and the fix is an `/oracle-test` content contract, not a component change. Also judge: (a) is one tap to pick *and* advance too fast — can a child tell their pick registered before the screen changes? (b) element screen 2 has **6 tap targets** (the ⬅️ back arrow pushes it over the ~5 guidance) — does it feel busy? (c) two cyan read-aloud pills sit on the plan screen ("Tell me the story idea again" in the header, "Hear the question" in the body) — is that one too many? (d) confirm the tutor SAYS the three option captions: for a non-reader its voice *is* the labels, so a silent `[STORY_ELEMENT_ASKED]` makes the screen unusable. G3 control: five textareas, `Grade 3` badge, phase ribbon, "Writing Prompt:" panel — all unchanged.
- **How to reach it:** `npm run dev` → dev tools → astronomy-primitives-tester → `orbit-mechanics-lab` @ K, then engineering-primitives-tester → `rocket-builder` @ K, then language-arts-tester → `story-planner` @ K; compare each against grade 3
- **Source report:** `qa/reader-fit/orbit-mechanics-lab-PRE-2026-08-07.md` + `rocket-builder-PRE-2026-08-07.md` + `story-planner-PRE-2026-08-07.md` §Residuals

### #73 — **ALL EIGHT 15B primitives @ K — does the new voice actually SPEAK, and does it stay quiet?** *(moon-phases-lab · classification-sorter · day-night-seasons · solar-system-explorer · scale-comparator · life-cycle-sequencer · habitat-diorama · organism-card)* · OPEN
- **What to check:** *(One sitting covers all EIGHT 15B slices. Row scope widened by `/pm` 2026-08-07 — S11–S15 closed AFTER this row was written and all five route their live-audio residual here.)* **The five added halves, each a ≤1-minute glance at K (the first three halves below are the original, longer checks):** **solar-system-explorer (S11)** — six categories of adult chrome must be GONE at K (AU/km/day/°C/moon numbers, orbital-period readouts), and the tutor must never say a measurement; it should say "the biggest one" / "really really hot". Grade 3-5 keeps all the numbers. Note that this primitive has **no evaluation hook at all** — it is an explorer, so there is nothing to score; just confirm the panel reads as picture-and-voice. **scale-comparator (S12)** — the "3.7× larger" ratio panel must NOT appear at K (it was double-gated, generator AND component, because the generator had been shipping prose into `gradeLevel`), and the tutor's comparison register must be non-numeric ("much bigger", "tiny next to it"). Compare grade 4: ratios back on. **life-cycle-sequencer (S13)** — at K the ordering is one tap per stage, not a drag; confirm no `imagePrompt` sentence ("a red-breasted robin on a branch") is ever printed as student copy. **habitat-diorama (S14)** — this one had five correct band gates that had *never run*, so the whole point is that the gates are now live: at K confirm the jargon is gone and the scene reads without reading. **Also glance the emoji fidelity** — organisms are matched by string-searching `imagePrompt` (`includes('bird')` → 🦅, else 🐰), so a scene of, say, fish and insects may render **rabbits for everything**. That is a known content-fidelity residual, not a band bug — just report whether it looks absurd. **organism-card (S15)** — per-fact read-aloud: tapping each fact should speak that fact. The on-demand image button is still text-labelled at K-2 (known residual). **day-night-seasons half — ONE of these is a real open question, not a formality:** tap a place that is clearly on the DARK side of the Earth and confirm the tutor says "night", then one on the lit side and confirm it says "daytime". The lit/unlit test is derived from the same math that draws the shadow, so it cannot disagree with the *shape* — but nobody has confirmed the angle convention matches what a human reads as day. **If it is inverted, say so and the fix is a single `!` in `isDaytimeAtMarker`.** Also glance: at K there is NO text box anywhere (the old "Type your answer..." input is gone), places are big emoji buttons rather than a dropdown, and no degree or hours readouts appear; then check grade 4 still has the dropdown, the readouts and the typed answers. **classification-sorter half:** at K-2 exactly ONE item card is staged and you place it by TAPPING a group (no dragging) — confirm that reads as obvious without instructions, that the tutor says the item's name when it comes on stage, and that asking for help re-states the RULE and the group names but never says which group is right (not even by ruling one out). Tap a wrong group on purpose: you should get a "what do you notice about it?" nudge, never a narrowing hint. **moon-phases-lab half:** The one thing S8 could not verify: no Tier-3 live audio run. Everything else is machine-proven (Tier 1 pass, Tier 2 all-resolved, jsdom 15/15, runtime K/G3 A/B). Two halves, one mic sitting. **(a) It speaks, in a LESSON.** Standalone is not sufficient — the lesson greeting and `[PRIMITIVE SWITCH]` cap the tutor at "one sentence", which is exactly what kills a read-aloud. The ORIENT + read-aloud beats live in catalog `aiDirectives` (which render into the switch injection) and say *"this OVERRIDES any instruction to keep it to one sentence"* — confirm that survives contact: on arriving at the primitive the tutor should tell a non-reader what to do unprompted, and tapping any 🔊 should read the words on screen **verbatim, not summarized**. **(b) It shuts up.** This is the risk the design took: `[MOON_PHASE_SETTLED]` is debounced 900ms and suppressed while the animation plays. Drag the Moon fast across several phases and confirm the tutor does NOT narrate each one in turn; stop on one and confirm you get exactly ONE short sentence naming it, then silence. Press Play and confirm it never narrates the moving Moon. **(c) Answer discipline, if a challenge is set:** the tutor may SAY the target phase (it is the question) but must never say a position, a degree, or which button — it should describe how the Moon should *look*.
- **How to reach it:** `npm run dev` → dev tools → **astronomy**-primitives-tester for moon-phases-lab / day-night-seasons / solar-system-explorer / scale-comparator, **biology**-primitives-tester for classification-sorter / life-cycle-sequencer / habitat-diorama / organism-card — each @ K; then moon-phases-lab inside a real generated K lesson for (a)
- **Source report:** `qa/reader-fit/{moon-phases-lab,classification-sorter,day-night-seasons,solar-system-explorer,scale-comparator,life-cycle-sequencer,habitat-diorama,organism-card}-PRE-2026-08-06.md` §Residuals

### #72 — **di-shapes (DI pack #5) — the L0 naming loop AND the L1 counting contract, live** · OPEN
- **What to check:** *(Row WRITTEN by `/pm` 2026-08-07 night — opened 08-06, extended 08-07, never actually tabulated until now. Folds into the same mic session as #63.)* **(a) BENCH — naming discrimination.** Run the `Shapes` probe set and answer deliberately wrong on the adjacent pairs: say **"square"** at a rectangle, **"circle"** at an oval. Both MUST correct — geometry IS this pack's rule-#1 guard (rectangles are drawn ≥1.6:1, ovals clearly non-circular, so exactly one name is defensible per drawing), and an affirm here means Live cannot hear the distinction the pack is built to measure. Then say **"diamond"** at the rhombus: that one MUST affirm — it is a stated judged alternate, not a miss. **(b) TESTER — the loop.** One DiShapes run: the SVG stage draws each shape at a generator-stamped rotation (K.G.2, "regardless of orientation"), so confirm a rotated square still reads as a square and that the tutor never explains the rotation away; confirm the reward beat fires and the contrastive correction re-models the name. **(c) NEW — the L1 counting contract, the half nobody has heard.** Pick `count_sides` or `count_corners` and: (i) **count aloud slowly** ("one… two… three") — the tutor must WAIT and judge only the number you land on, not correct you mid-count; (ii) answer **off by one** (say "four" at a triangle) — you must get the CONTRAST branch with your own number said back (*"My turn: not four — this shape has three sides"*), and close must NOT be accepted; (iii) the tutor must **never count the sides aloud itself** outside a quoted model line — doing the counting for the child replaces the exact thing being measured. Also confirm the shape's NAME is withheld under a counting mode (it hands the count to any child who knows it: triangle → three). **(d) NEW 2026-08-07 — the L3 `hard` tier, a cold ask nobody has heard.** In the direct-instruction tester set **Tier: hard** and generate. The tutor must open with the ASK ALONE — *"Your turn. What shape is this?"* with **no** "Listen:" and no "Together:" before it. Then the tier's whole point: before you answer it must **not name the shape, not describe the drawing** and, on a counting item, **not say the count and not name the shape either** (the name hands over the count). A `hard` item that gets modelled anyway is the tier leaking through the tutor's own channel rather than the script. Confirm too that a MISS still re-models — remediation is never withdrawn by a tier (standing gate 3). Everything machine-checkable already passed (real-pipeline probes 3/3 at L0, 7/7 at L1, 6/6 at L3; the L3 context bag verified by executing the component); this row is the Tier-3 half only and **cannot be struck on the naming half alone**. **(e) NEW 2026-08-08 (`/pm`) — the L4 DRAWINGS, which are pixels and not voice.** L4 shipped in the same commit as L3 (`bd21cef`) because L3 alone left easy/medium/hard drawing **byte-identical** pictures. The lever is exemplar typicality, and it changes what is on screen: at `hard` you now get a **scalene obtuse triangle, an irregular hexagon or pentagon, a portrait rectangle, a right trapezoid**, drawn at **62–100% scale** and rotated to the full safe ceiling (`SAFE_ROTATION_DEG` — triangle and trapezoid go to 180°, so a triangle can be point-down). The geometry is asserted (point counts, aspect ratios, in-bounds) and the render path is asserted in jsdom (the exact `points` string reaches the SVG, `scale(0.7)` reaches the transform) — **but nobody has seen one.** Generate an `easy` and a `hard` item of the same shape and judge: does the 62%-scale irregular hexagon at 30° still *read* as a hexagon to a five-year-old, or has typicality been traded for legibility? Also confirm confusable neighbours placed side by side (adjacent counts under a counting mode) don't make the pair harder to tell apart than intended. **This row now covers a voice half AND a pixel half; striking one does not strike the other.**
- **How to reach it:** `npm run dev` → di-bench home card 🎯 → probe set **"Shapes"**, mic on, run-log panel open; then dev tools → direct-instruction-tester → **Shapes** → one naming mode and one counting mode, then **Tier: hard** for (d) and an `easy`/`hard` A/B of one shape for (e)
- **Source report:** `qa/eval-reports/di-shapes-birth.md`; `qa/eval-reports/di-shapes-eval-modes-2026-08-07.md`; `qa/eval-reports/di-shapes-support-tiers-2026-08-07.md` §"L4 residual"; `qa/di/BACKLOG.md` item 14

### #71 — **curator-brief — the hook badge is a glyph, not a word** · OPEN
- **What to check:** Ten-second glance, lowest stakes on this list. `hook.visual` renders into a `text-5xl` slot, and flash-lite was returning a WORD ("marbles") for it — 48px body copy beside the hook paragraph. The model now picks a THEME from a schema enum and CODE attaches the emoji (`utils/hookVisual.ts`), with `resolveHookVisual` degrading anything word-shaped to a hook-type fallback at render. Confirm: (a) the badge is a single emoji at a sane size, not a word and not a tofu box; (b) it is thematically not-absurd for the lesson (the menu is broad — an off-theme-but-valid glyph is fine, a word is not); (c) generate 2-3 briefs across subjects, since the failure was intermittent. **No test covers this** — the mapper is pure and untested, and nothing pins the generator to the enum.
- **How to reach it:** `npm run dev` → generate any lesson (the brief is the first block)
- **Source report:** *(no report — code comment `utils/hookVisual.ts:1-12`; see WORKSTREAMS "One-off, UNREPORTED" 2026-08-06)*

### #70 — **base-ten-blocks — the keypad is gone from `build_number` and `regroup`** · OPEN
- **What to check:** Real clicks, not a look. The blocks are now the answer channel wherever the target value is already stated on screen: `build_number` and `regroup` lose the number keypad entirely and are judged from the built columns ("Check My Blocks" / "Check My Trade"). Typing 12 for "Build the number 12" was transcription, not place value. Judge: (a) place blocks and check — does a STANDARD-form build score correct? (b) build 12 as **twelve unit cubes** — it must NOT score correct; it should send you to the trade, since never showing the ten defeats the manipulative (verdict `nonstandard`); (c) `regroup` — make the trade, check, and confirm the value is conserved and the feedback names the trade; (d) confirm `read_blocks` and the operate modes **still have** the keypad (there the number genuinely isn't on screen); (e) ask the tutor for help in each mode — it must coach block placement in build/regroup and never mention typing (new `[CHANNEL]` clause). Machine coverage exists (`BaseTenBlocks.answer-channel.test.tsx`) but nobody has clicked it.
- **How to reach it:** `npm run dev` → math primitives tester → `base-ten-blocks` → `build_number`, `regroup`, then `read_blocks`
- **Source report:** *(no report — see WORKSTREAMS "One-off, UNREPORTED" 2026-08-06)*

### #68 — **fast-fact — does a 19-emoji counting visual actually fit the box?** · OPEN
- **What to check:** Pixel check on the one thing the oracle cannot see. Counting drills now draw the quantity as repeated emoji instead of showing the numeral (that was the CRITICAL leak: `text-large "7"` over *"Which number is shown here?"*), and CODE repeats the glyph from a model-supplied count — so a "Counting to 20" drill can legitimately render **19 or 20 emoji** into `VisualRenderer`'s `text-5xl` box (`FastFact.tsx:103-107`). The data is verified (glyph count = key, 5/5 live) but **nobody has looked at the render**. Judge: (a) at 19-20 glyphs does it wrap into a countable block, or overflow / squash into an unreadable smear? A K child has to *count* these. (b) Is the wrap stable enough to count without losing your place — if not, the visual needs a grid/size rule, and the generator's hard cap of 25 (`buildEmojiVisual`) may need lowering to whatever actually fits. (c) Glance a Science and a Sight-words drill in the same sitting: Science should show a symbol and ask for the NAME (never both), and sight words are now sentence-cloze with **no** visual — confirm the empty visual box collapses rather than leaving a gap.
- **How to reach it:** `npm run dev` → core primitives tester → `fast-fact` → topic "Counting to 20" @ K, then "Element symbols" @ 7 and "Sight words" @ K
- **Source report:** `qa/eval-reports/fast-fact-2026-08-06.md` §"Honest residuals" (2)

### #67 — **spatial-scene — does "in the box" LOOK like inside the box?** · OPEN
- **What to check:** Pixel/feel check on the one thing jsdom cannot judge. The new `place_in` mode draws the placed object **nested inside** the container's cell — container emoji at full size, the contained object smaller and overlapping at the bottom of the same square, with a drop shadow. The DOM is verified (8/8 component drive: the container cell is tappable, checking it is correct, both emoji end up in that cell) but **nobody has looked at it**. Judge: (a) does the result read as *one object inside another*, or as two objects crammed into a square? At 64px a 3×3 cell is small; if it reads as "two things", the nesting needs a size/inset change, not a copy change. (b) The label under the cell becomes "ball in box" — does that crowd? (c) Rule-#1 glance: in this mode ALL nine cells take the hover affordance (`allowOccupiedTaps` turns it on for occupied cells too, not just the container) — so nothing should visually single out the container before the answer. Confirm that by eye: if the container's cell looks different from the tree's or the cat's cell in any way, the answer is being telegraphed. Also glance `place_between`: the placed object now appears in the answer cell on success (legacy `place` deliberately still only highlights).
- **How to reach it:** `npm run dev` → math primitives tester → `spatial-scene` → eval mode **Put In — Containment**, then **Between — Two References**
- **Source report:** `qa/la-k2-grammar/spatial-scene-containment-2026-08-05.md` §"Honest residuals" (1)

### #66 — **spatial-scene — `identify`/`describe` option buttons after the answer moved off slot 0** · OPEN
- **What to check:** Two-minute click check, not a feel pass. The R12 slice found `correctPosition` sitting at `options[0]` in **18 of 18** generated challenges while `SpatialScene.tsx:663-664` renders `options` in array order — so the answer is now placed at a seeded, varying index. Nothing in the component keys off index, and the checker reads `correctPosition`, so this *should* be inert — but it has never been clicked. Confirm on an `identify` and a `describe` challenge: (a) selecting a NON-first option highlights that button (emerald) and no other; (b) submitting the correct answer at index 1/2/3 scores CORRECT; (c) submitting a wrong one scores wrong and the hint appears. Also note whether any challenge now shows **3** options rather than 4 — that is expected and legal (R12 drops an also-true synonym and a narrow K window may have nothing false left to backfill), but confirm the 3-button layout does not look broken in the 2-col grid.
- **How to reach it:** `npm run dev` → math primitives tester → `spatial-scene` → `identify`, then `describe`
- **Source report:** `qa/la-k2-grammar/spatial-scene-c3-exclusivity-2026-08-05.md` §"Honest residuals"

### #65 — **Voice transport — calibration hardware spread** · OPEN
- **What to check:** The calibration beat (8-frame ambient/echo floors, device-relative open bars) was tuned on one dev machine; the charter requires it to hold on arbitrary student hardware. Run a short voice exchange on each of: quiet laptop speakers, LOUD laptop speakers, a headset, with a fan/HVAC running, and a second microphone if available. For each, record the ambient/echo floors and derived open bars from the console and note any phantom turns (echo opening a turn) or missed real speech. One config failing = a calibration-policy bug report, not a hand-tuned threshold patch.
- **How to reach it:** Same as #64, once per hardware config; floors print in the console
- **Source report:** `qa/voice-transport/IMPLEMENTATION-2026-08-05.md` §"Runtime gates still required" (2)

### #63 — **DI BENCH SITTING — multi-word numerals (standing gate 1). NOT pixel debt: this one BLOCKS code.** · OPEN
- **What to check:** ~30 min at the mic. It decides whether `di-math-facts counting_next` may ever reach 1–120, or must keep saturating at twenty. Run the 10 items and answer honestly, then deliberately break three of them. **(a) TEEN/DECADE — make-or-break.** Thirteen/thirty, fourteen/forty, sixteen/sixty, seventeen/seventy sit next to each other in exactly the range a 1–120 objective drills. On item 1 (`12 →`, answer "thirteen") say **"thirty"** on purpose. It MUST correct. An affirm here means Live cannot hear the distinction from audio, the pack cannot measure counting accuracy past twelve, and **the honest outcome is to kill Option B** and take the catalog-steering interim instead. Do the mirror on item 2 (`29 →`, answer "thirty" — say "thirteen"). **(b) COMPLETENESS + mic timing.** On item 9 (`106 →`, "one hundred seven") answer **"hundred seven"** — a partial compound must correct, not be waved through. Then on item 10 (`119 →`) answer normally but **pause a beat between "one hundred" and "twenty"**: watch the run-log panel for `attempt superseded`. Any supersession means the family's 500ms `silenceCloseMs` splits one numeral into two turns — the same break di-sentence-reading hit at length, and the fix is a PACK-scoped raise (it used 1100ms), never the family default. **(c) CUE DRAG.** Every line now carries two long numerals ("Listen: the number after one hundred nineteen is one hundred twenty."). Does the model+guide pair still read at pace to a six-year-old, or does it need shortening before the pack speaks it? Also note whether the tutor ever says digits instead of words. Copy the run JSON either way — a FAIL is as useful as a pass here and decides the fork.
- **How to reach it:** `npm run dev` → di-bench home card 🎯 → probe set **"Counting to 120"** (10 items) → Start run, mic on, browser console + run-log panel open
- **Source report:** `qa/tutor-reports/di-math-facts-14g-2026-08-05.md`; `qa/di/BACKLOG.md` item 10

### #62 — **support-tiers batch 3 — hard-tier feel pass (10 primitives)** · OPEN
- **What to check:** One sitting across spelling-pattern-explorer, story-map, opinion-builder, paragraph-architect, poetry-lab, revision-workshop, sound-wave-explorer, constellation-builder, planetary-explorer, and construction-sequence-planner. Compare **easy vs hard** and confirm hard withdraws optional scaffolds without removing the affordance that explains the job; easy help must support self-checking without revealing the answer. Pay special attention to dense literacy layouts, diagram-label readability in science/astronomy, and whether construction ordering remains operable after supports withdraw. This is human-only feel/pixel debt; the queue separately requires machine/runtime probe closure.
- **How to reach it:** Relevant primitive testers → each primitive → toggle difficulty easy vs hard
- **Source report:** `qa/HANDOFF-support-tiers-batch3-2026-08-04.md`; batch report pending

### #61 — **how-it-works HW-1 — `explain` challenge click no-op (long-standing CRITICAL, never re-verified)** · OPEN
- **What to check:** The oldest open CRITICAL in the tracker and a 30-second check. `handleMCAnswer` early-returned for `'explain'` type while the render block still drew option buttons — clicking any option did NOTHING (no selection, no feedback, no advance); user-reported live as "stuck on Challenge 3 of 3". The 2026-03-22 entry says it was converted to MC format, but the 2026-08-02 nine-run sweep explicitly did **not** re-verify it. Drive any how-it-works exhibit to an **explain** challenge and click an option: it must select, give feedback, and advance. If it works, strike HW-1 from EVAL_TRACKER; if it still no-ops, it is a CRITICAL that has been shipping since March.
- **How to reach it:** any lesson/tester routing how-it-works → reach an `explain` challenge
- **Source report:** `qa/eval-reports/how-it-works-2026-08-02.md` §"Prior issues" (line 149)

### #60 — **support-tiers batch 2 — hard-tier feel pass (8 literacy/calendar primitives)** · OPEN
- **What to check:** One sitting, all 8: phoneme-explorer, phonics-blender, syllable-clapper, rhyme-studio, word-sorter, word-workout, letter-sound-link, calendar-explorer. At **difficulty: hard**, confirm the withdrawn scaffolds leave a task that is still DOABLE, not merely harder — the batch withdrew worked examples, blend previews, clap counters, rime highlights, bucket emoji, and keyword anchors, all machine-verified as present/absent but never seen. Watch specifically for: (a) a hard tier that removed the last affordance telling the child what the job IS (vs. what the answer is); (b) rhyme-studio recognition — the rime highlight is now post-resolution only (it used to BE the answer, a rule-#1 leak fixed en route); confirm the pre-answer screen genuinely gives nothing away; (c) letter-sound-link `keyword_match` single-tap commit — one tap now commits, so a mis-tap is a wrong answer; does that feel fair at the target band? Compare each against **easy** (full help) to confirm the ladder reads as a ladder.
- **How to reach it:** LiteracyPrimitivesTester (+ calendar-explorer) → each primitive → toggle difficulty easy vs hard
- **Source report:** `qa/eval-reports/support-tiers-batch2-2026-08-02.md`

### #59 — **knowledge-check @ Grade 1 — bounded visual evidence (reader-fit 14f)** · OPEN
- **What to check:** Pixel/feel only; generation and renderer contracts are machine/live-proven. Check a map-symbol item and an invention item: (a) the 3-symbol `ObjectCollection` reads as the evidence/key, not decorative emoji; (b) the two-panel Before/After comparison is immediately legible; (c) question + four short options fit without crowding at a Grade-1 viewport; (d) a mixed set still feels varied when an individual visual matching plan becomes MCQ; (e) compare K — it must keep the existing emoji option grid/read-aloud surface, not gain the G1 panel.
- **How to reach it:** Any Grade-1 lesson ending in knowledge-check on map symbols or inventions; compare a K knowledge-check
- **Source report:** `qa/reader-fit/knowledge-check-14f-2026-08-02.md`

### #58 — **coin-counter G1 enacted tag-then-type (reader-fit 14b)** · OPEN
- **What to check:** Feel of the new G1 `count-like` flow: tap each coin → ✓ (medium/hard) or running-value badge + climbing readout (easy) → input+Check appear after the last tag → type total. Check: (a) 44×44 coin targets — at the accepted minimum, same note as #52; (b) badges slightly overlap the NEIGHBORING coin when the row is tightly packed (probe screenshot shows value badges grazing the next dime) — does it read as "this coin is counted" or as clutter?; (c) easy tier: the readout ends up showing the total directly above the input the child then types into — deliberate self-check scaffold, confirm it FEELS like self-checking rather than pointless copying; (d) the reveal moment (input+Check sliding in after the last tag) — is it obvious the job changed from tapping to typing?; (e) G1 chrome (Grade-1 badge, 1/2 counter, 🔢 Count badge) is EMERGING-tolerable but note the feel for the stage-mode case
- **How to reach it:** MathPrimitivesTester → coin-counter → count-like → Grade 1; toggle difficulty easy vs medium
- **Source report:** `qa/reader-fit/coin-counter-14b-2026-08-01.md`

### #57 — **di-letter-sounds — L3×L4 `hard` cold confusable set (opened 2026-08-01; L4 folded in 2026-08-03)** · OPEN
- **What to check:** In the tester pick **Letter Sound (Isolated)**, set **Tier: hard (cold)**, and confirm the generated four-item set is `m/n/f/v` (both L4 confusable pairs) and the tutor says ONLY "Your turn. What sound?" on each — no "Listen:", no "Together:", and no target SOUND before production. Then answer WRONG on purpose: correction MUST still re-model the sound ("My turn: mmm, as in moon…" — standing gate 3; the PLAIN correction remains frozen on #55). **Per-mode glances:** (a) **First Sound in a Word** @ hard must keep the same continuant contrast set and still SAY the stimulus word ("Your turn. What is the first sound in moon?") without volunteering its onset; (b) `medium` isolated must contain at least one short vowel and no complete contrast pair, with one model line/no "Together:"—the vowel ask still says the keyword ("Your turn. Say apple."). Onset `medium` legitimately stays continuant-only (L4 honest saturation). Default `easy` must be unique continuants with no complete pair and preserve the full proven lead-in.
- **How to reach it:** Dev tools → direct-instruction-tester → **Letter Sounds** → mode + Tier selectors → Generate → mic run
- **Source report:** `qa/eval-reports/di-letter-sounds-support-tiers-2026-08-01.md` + `qa/eval-reports/di-letter-sounds-structural-difficulty-2026-08-03.md`

### #56 — **DI ~90s SILENCE micro-run** — di-math-facts, answer NOTHING on item 1 (opened `/pm` 2026-07-27; carries DI BACKLOG item 1 residual (ii) + #55(e). **Updated 2026-07-31, item-5 slice: the DIAGNOSABILITY half is machine-covered** — `LUMINA_FAULT_MUTE_S` + the shipped ladder induce and record the stall without ears (rides item 9 Tier 2); **what remains human here is the EARS**: does the level-2 reconnect beat read as a hiccup or a break to a K child, and #55(e)'s literal-silence route) · OPEN
- **What to check:** Stay silent through the first item for ~90s (mic armed, say nothing) and watch three things: **(a) no-verdict → resync, live** — after the 8s no-verdict timeout ×2 the engine must emit `resync` and the pack must re-cue the SAME item; unit-covered since the engine gate, likely fired uninstrumented in the child stress run, never deliberately observed. The run log panel's `resyncs` counter is the readout. **(b) #55(e) — the nothing-to-contrast fallback:** when you finally miss (or stay silent through a test prompt), a miss with no localisable content must get the plain bench-proven re-model ("My turn: …"), NEVER a contrast line with an empty `⟨ ⟩` slot. **(c) ~~DI BACKLOG item 8's ACCEPTANCE GATE~~ — machine-covered as of 2026-07-31** (fault-injected drive reconstructs the episode from ledger + auto-flushed run file, incl. the new `flushDiRunLog('stall')`); if this sitting happens FIRST, still do the reconstruction — it's free evidence. **(d) NEW — recovery FEEL:** if the session ever goes dead (or you arm the fault flag SHELL-SCOPED for one run — `$env:LUMINA_FAULT_MUTE_S='25'; uvicorn app.main:app` — never in .env, which the backend now refuses), the reconnect must read as a hiccup ("One moment—getting your tutor back…" → the SAME fact re-cued), and the 🔄 card (level 3) must be obvious to a non-reader.
- **How to reach it:** direct-instruction-tester → **Math Facts** → Generate → tap mic → stay silent ~90s; then finish the run normally
- **Source report:** `qa/di/BACKLOG.md` items 1, 5, 8; `qa/di-bench/run-2026-07-26-math-facts-sustained-miss.md`; `qa/di-bench/slice-2026-07-31-item5-stall-fix.md`

### #55 — **Contrastive correction — di-sentence-reading + di-math-facts (user ruling 2026-07-25)** · OPEN
- **What to check:** **Rides the SAME sitting as #54 / #50(a) — one mic run closes all three.** The correction branch no longer just re-models; it NAMES what the learner said and contrasts it: reading → `My turn: not ⟨what they said⟩ — Mom got a pot. Your turn. Read it again.`; math → `My turn: not ⟨what they said⟩ — two plus one is three. Your turn. What is two plus one?`. The `⟨…⟩` is a slot the tutor fills from the audio it just judged. **Drive: (a)** repeat the exact live failure — read "Mom got THE pot" for "Mom got a pot" — and confirm the tutor now says *"not the pot"* rather than re-reading the sentence at you, and that hearing WHICH word was wrong actually lets you fix it (that is the whole point of the change); **(b)** the same wrong read TWICE — the second correction must contrast again, not drift to a third wording or fall back to the plain re-model; ~~**(c)** math: answer "2 + 1" with **"one"** (the echo misconception) → expect *"My turn: not one — two plus one is three…"*~~ **(c) CLOSED 2026-07-26** — user drove the echo misconception (1+3 → "three", the last number heard) and got the exact expected form, "My turn: not three — one plus three is four. Your turn. What is one plus three?", twice, **byte-identical on the repeat miss** (no drift to a third wording — that also banks the (b)-shape for math); **(d) the fidelity risk this rewording buys** — **MATH HALF CLEAN 2026-07-26, now AT SCALE**: the EOD sustained-miss run captured **14 complete judge lines, every one byte-exact to the template**, slot filled correctly every time (incl. "not zero" against ASR garbage "SeaWorld"/"cero" — judge filled from audio, not transcript), no drift across five capped items; plus the earlier real-child reinforcement ("not three" for an ASR "Please", user-confirmed correct); the READING half + rambling-by-ear still need the sentence sitting; **(e)** the nothing-to-contrast fallback — stay SILENT through a test prompt and confirm it uses the plain bench-proven re-model, not a contrast with an empty slot — **(e) HALF-CLOSED 2026-07-27 (the fallback-SELECTION half):** the child-paced `answer_fact` K run (runId `42279e964031`, auto-persisted log) drove three no-number misses ("One plus one is…" trailed off, "I need help on this one…", "Can Can you help me?") and every one drew the plain bench-proven re-model, **byte-identical on the repeat miss**, never a contrast with an empty slot; what remains of (e) is only the literal SILENCE route (no voice turn at all → no-verdict timeout → resync), which rides the 90s-silence micro-run (`qa/di-bench/run-2026-07-27-math-facts-answer-fact.md`). *(A same-day "FAILED live" claim here was WITHDRAWN 2026-07-26: the child's audio behind an ASR "Please" really was "three" — user-confirmed — so the contrast was CORRECT and (e) remains simply undriven. See the corrected `qa/di-bench/run-2026-07-26-math-facts-stress-sitting.md`.)*; Sentinel safety is unit-proven (filled + unfilled lines both classify as `corrected`, 15/15); only the tutor's spoken fidelity needs ears. **Per the family rule ("do not re-word without a new sitting") this wording is UNBENCHED until this row closes.**
- **How to reach it:** Dev tools → direct-instruction-tester → Sentence Reading **and** Math Facts → mic run, answering WRONG on purpose
- **Source report:** `qa/di/BACKLOG.md` (contrastive-correction entry)

### #54 — **di-sentence-reading — L0 RESIDUAL** (~~the pack's birth gate~~ **CLOSED 2026-07-25**, user mic run 4/4 affirmed, "it worked fantastically!" — the judged loop, the sentence-length reward beat, and the recap are all verified; see the live report). **Two quantitative residuals only.** · OPEN
- **What to check:** **(a) The `silenceCloseMs: 1100` proof — cheapest, may still be on screen.** The run did not visibly break, but the fix's evidence is 3 numbers not readable from the UI: **0 "attempt superseded"**, **`responseMs` non-null on every attempt**, `aliasMatch` true on correct reads (the bench saw 3 splits at 500ms). Read the tester's `[DI eval]` console payload → `outcomes[].responseMs`. If splits persist raise toward 1400ms — never lower the family default. **(b) SHORT end + correction branch (carries #53, and would close family-wide #50):** read a 3-4 word sentence with **one word deliberately dropped**. Both proven catches were 6-7 words; a short sentence gives the judge less context and may be HARDER. This also exercises the untested `corrected` → retry-in-place branch and the 2-correction `[DI_MOVE_ON]` cap — **never fired in any pack**, though the sentence correction WORDING is bench-proven. **(d) L3 `hard` cold read (added 2026-07-25; updated 2026-08-03 — L4 now makes `hard` also select a 7-8-word sentence, so this same check hears the pack's LONGEST cold read; no new row, per the L4 report's fold-in).** Pick `Read a Sentence`, set difficulty `hard`, and confirm the tutor says ONLY "Your turn. Read it." — no "Listen:", no "Together:", and no preview of the sentence anywhere before you read. It is the only tier that changes what the tutor says at the moment that matters, and it is what closes the birth audit's echo-route caveat. Then miss a word on purpose: the correction MUST still re-model the whole sentence (standing gate 3 — remediation is not scaffolding), which also closes residual (b). ~~**(c) L1 ladder**~~ **CLOSED 2026-07-25** — user ran `Sight-Word Sentence` live, 4/4 affirmed ("these are so good!"): pool selection correct at runtime, the bench-proven lines carried an unread vocabulary (see/go/you/my/and), and the post-affirmation reward emoji rendered. That was the ladder's highest rung and the last plausible place for L1 to have disturbed proven speech.
- **How to reach it:** `npm run dev` → direct-instruction-tester → **Sentence Reading** → pick a mode → Generate → tap mic (browser console open)
- **Source report:** `qa/eval-reports/di-sentence-reading-live-2026-07-25.md` + `-evalmodes-2026-07-25.md`

### #53 — DI sentence reading — stress the SHORT end of the ladder (residual of the passed #51, 2026-07-25) · OPEN
- **What to check:** The probe passed on one-word-omission detection, but **both deliberate errors were driven on the 6- and 7-word items**; the short end was never stressed. It also produced the run's one ambiguity: item 1 ("The cat sat.") transcribed as **"the car"** and was AFFIRMED. Live judges audio, not the transcript, so that is either an ASR artifact of a correct read (likely — 0.85s is a fast clean read, and the judge went 2/2 on real errors) or a false affirm. **First: do you remember what you actually said on item 1?** If it was correct, this is closed as ASR noise. Either way, drive a deliberate one-word error through the 3-4 word items ("The cat sat." → say "The cat sits."; "I see a pig." → say "I see a big.") — a short sentence gives the judge less context to notice a swap, so it is plausibly HARDER than the long items, not easier. If short items over-affirm, the pack's minimum sentence length is a real constraint.
- **How to reach it:** Home → 🎯 Direct Instruction Bench → probe set **Sentence reading** → Start run, wrong on purpose on items 1-2
- **Source report:** `qa/di-bench/run-2026-07-25-sentence-reading-probe.md`

### #52 — coin-counter `count-like` @ K — enacted count (Task 3, 2026-07-25) · OPEN
- **What to check:** The click path is ALREADY proven in real Chrome (playwright + real mouse: tap → 5¢ → 10¢ → double-tap holds at 10¢ → 15¢, badges 5/10/15, "You counted 15¢!", 0 inputs / 0 Check, 44×44px targets, no page errors) — so this row is **pixel/feel only, not a click check**. Glance: (a) do the running-total badges crowd the coin face? each counted coin stamps a 22px emerald badge over its top-right corner, partially covering the "5¢ / Nickel" label — legible in the screenshot but a K child's eye is the judge; (b) does the big running total (starts "0¢", climbs 5→10→15) read as the thing being built, or as a distraction above the coins; (c) is a 44px coin big enough to tap reliably at K, especially with 5 pennies in a row; (d) confirm the Grade-1 control still shows "Total: [ ]¢ cents" + Check with inert coins. **Also carries the two findings the pixel check surfaced (filed as contract gaps G3, NOT fixed): the K screen still shows a "Kindergarten" grade badge, a "1/2" counter, and a "🔢 Count" phase badge — the same adult chrome comparison-builder band-gated away at K in #2b — and the instruction is English prose with no 🔊 read-aloud, so a pre-reader can't read the task.** Judge whether G3 should jump the queue.
- **How to reach it:** MathPrimitivesTester → coin-counter, `count-like`, grade K (or Ctrl+Alt+K); compare against grade 1
- **Source report:** `qa/reader-fit/coin-counter-task3-2026-07-25.md`

### #50 — di-math-facts — the stresses an all-correct run can't reach (residual of #48, 2026-07-25) · OPEN
- **What to check:** **Three consecutive all-correct sittings** (#46 bench 3/3, 07-24 run 5/5, 07-25 run 5/5) have left the same gaps. Each needs a DELIBERATELY WRONG answer: **(a) CLOSED 2026-07-26** (user mic run, `qa/di-bench/run-2026-07-26-math-facts-turn-gate-verify.md`): the correction branch fired live for the first time — 1+3 answered "three" 3× (the echo misconception) → two contrastive corrections captured complete and byte-identical ("My turn: not three — one plus three is four. Your turn. What is one plus three?") → 2-cap → **first-ever live `[DI_MOVE_ON]`**, coherent to recap. Both ear halves **user-confirmed 2026-07-26** (from their sittings): "Good try. We will practice more later." WAS heard after the cap, and "My turn" reads acceptably as an *arithmetic* correction opener — the sentinel decision's live half is settled for math; (b) **homophone / over-affirmation** — say "won" for one, "too" for two, "for" for four, "ate" for eight (must AFFIRM — they are the target's sound), then a WRONG number that rhymes with the answer (must CORRECT). This is the only test of the L2 scaffold's new NUMBER WORDS clause, and the risk it carries is that widening for target homophones softened wrong-number strictness; (c) **MATHEMATICS attribution — HALF-CLOSED 2026-07-26** (backend log, stress-sitting report): the submit fired the FULL data loop against **MATHEMATICS** via retrieval (cosine 0.800) — competency → calibration (β=2.46, θ=3.60, gate 3/4) → mastery ACTIVATED → +28 XP — so the `subject_for_primitive` override is runtime-verified; **but it landed `OPS002-04-c @ grade=2`, not the OPS001 family**, for a K session → the residual is now DI BACKLOG item 6 (free-form grade/skill scoping), not a sitting. Resync: LIKELY first live firing in the same stress run (uninstrumented — see BACKLOG watch-items); no-verdict-timeout still unobserved. **(d) NEW 2026-08-01 — L3 `hard` cold answer (mirror of #54(d)):** in the tester pick any mode, set **Tier: hard (cold)**, and confirm the tutor says ONLY "Your turn. What is …?" — no "Listen:", no "Together:", and the ANSWER is never spoken or shown before you say it (unlike the sentence pack, the answer exists NOWHERE pre-attempt, so this is the first pure retrieval probe in DI math). Then answer WRONG on purpose: the correction MUST still re-model the whole fact (standing gate 3 — remediation is not scaffolding). Also glance `medium` (one "Listen:", no "Together:"). The tier selector is new in the tester (2026-08-01) — default "(easy)" must behave exactly as every prior run.
- **How to reach it:** Dev tools → direct-instruction-tester → Math Facts picker → mic run, **answering wrong on purpose**
- **Source report:** `qa/eval-reports/di-math-facts-live-2026-07-25.md` + `-support-tiers-2026-08-01.md`

### #49 — di-math-facts L1 — the THREE NEW modes' cue wording, live (2026-07-24; **(b) Take-Away Fact CONFIRMED live 2026-07-25**, (a)+(c) remain) · OPEN
- **What to check:** Mirror of di-letter-sounds' #42. The L1 ladder added three identities whose spoken lines have never been HEARD, only generated. **Run the same sitting as #48 — one mic session closes both.** In the tester's Math Facts mode selector, drive each new mode once and listen for the scripted line reading naturally at K pace: (a) **The Number After** — "Listen: the number after five is six. Together: … Your turn. What is the number after five?" (the phrase has to sound like a question a 5-year-old answers, not a riddle); (b) **Take-Away Fact** — "three minus one is two"; confirm the tutor says "minus" (never "take away" or "subtract" — the script says minus) and that a WRONG answer gets "My turn: three minus one is two…"; ~~(c) **Fact Review (mixed set)** — reads identically to Answer a Fact, so just confirm the drawn facts look like a spread rather than one cluster~~ **(c) CLOSED 2026-07-26** — user mic run on `fact_review` "addition facts within 5": drawn facts 2+2 / 0+5 / 2+1 / 1+1 / 1+3, a genuine spread (sums 2–5, zero fact included, no cluster), scripted cue lines intact live (`qa/di-bench/run-2026-07-26-math-facts-turn-gate-verify.md`). Also glance the reward equation per mode: counting shows "5 → 6" (NOT "5 → ? = 6"). **(b) CLOSED 2026-07-25** — a full Take-Away Fact sitting ("subtraction within 5") ran 5/5 with the scripted lines reading naturally, and the recap showed correctly-shaped subtraction forms (`4 - 3 = 1`); only its WRONG-answer half survives, and that now lives in #50(a). **(a) The Number After and (c) Fact Review are still unheard.** Generation + math are eval-test-verified 8/8 (40 items recomputed); only the audio remains.
- **How to reach it:** Dev tools → direct-instruction-tester → Math Facts picker → mode selector → mic run
- **Source report:** `qa/eval-reports/di-math-facts-evalmodes-2026-07-24.md`

### #47 — vehicle-comparison-lab @ K/K-2 (young-learner read-aloud) · OPEN
- **What to check:** three cyan 🔊 buttons render and the tutor VOICE actually reads on tap: header instructions 🔊 (beside the instruction line), challenge scenario 🔊 (reads the scenario + states "carry N friends, travel N km" but never names the answer vehicle), and the post-answer explanation 🔊 (inside the feedback card, reads the explanation verbatim). Glyphs ripple while the tutor speaks (`isAudioPlaying`). Wiring is jsdom-verified 3/3; only hearing the live audio remains.
- **How to reach it:** EngineeringPrimitivesTester → vehicle-comparison-lab, grade K; drive Select → Challenge, tap each 🔊 with a live tutor session
- **Source report:** `qa/reader-fit/vehicle-comparison-lab-PRE-2026-07-21.md`

### #45 — di-letter-sounds in a REAL K LESSON (L2 lesson-mode wiring, 2026-07-23) · OPEN
- **What to check:** First-ever DI-in-a-lesson run. A K lesson routing di-letter-sounds must: open the SHARED session with manual voice activity (backend log: "Client requested manual voice-activity signaling; automatic VAD disabled") + the catalog DI tutoring block; the judged loop runs through the shared session (tap mic → model/guide/test → held-sound judged from audio, affirm advances / "My turn" corrects); on submit the data loop maps to the LESSON OBJECTIVE's subskill (Letter-Sound Correspondence home), NOT a Gemini re-map to CVC-decode — this is the 07-21 watch-item closing. ALSO probe the named trade-off: in a MIXED lesson (DI + a chat primitive), the non-DI primitive's open-mic conversation will NOT open turns (manual VAD session-wide) — confirm it and report HOW BAD the interim feels. This is no longer a product fork: the fix direction is settled (voice-transport unification, `qa/voice-transport/CHARTER.md` — session-wide client turn authority makes conversation work everywhere); the sitting measures how urgently that parked stream needs pulling.
- **How to reach it:** K lesson with a letter-sounds objective routing di-letter-sounds (+ one mixed lesson)
- **Source report:** `qa/tutor-reports/di-letter-sounds-2026-07-23.md`

### #44 — knowledge-check voice viewport gate (TF + MCQ) · OPEN
- **What to check:** mic no longer listens while the question is off-screen: open a lesson whose knowledge-check sits below the fold, stay at the TOP and talk to the tutor — the question must NOT self-answer (this exact failure was observed 2026-07-23: "Keep Practicing" 0/1 at 15s with the KC never viewed); scroll the question into view → orb arms and saying an option/true-false still credits; scroll away mid-question → mic releases; scroll back → it re-arms (autoStart fresh-activation). Fix is tsc/jsdom-verified only — the scroll loop needs a real browser + mic.
- **How to reach it:** any lesson with a knowledge-check below the fold + live tutor talking
- **Source report:** this session — useVoiceViewportGate 2026-07-23 (MCQ + TF problem primitives)

### #41 — DI bench `Word reading` probe (OPTIONAL — not verification debt, `/pm` 2026-07-24) · OPEN
- **What to check:** **Superseded twice over:** the pre-build gate was WAIVED by user ruling 2026-07-22, and the near-neighbour stress it carried was folded into **#43, which PASSED live 2026-07-23**. Nothing is blocked on this row; keep it only as an optional measurement sitting (clean run JSON / floors readout / alias reporting for the word response class). Original scope: **Pre-build gate WAIVED by user ruling 2026-07-22** (modality validated via letter-sounds; di-word-reading was built — see #43). The sitting stays worthwhile as the modality's measurement harness (clean run JSON, floors readout, alias reporting) but the near-neighbour over-affirmation stress now lives in #43's live loop. If run: di-bench → **Word reading** probe (10 items: sam·mat·pig·dog·sun·red·cup + the·see·go), read at K pace, stress the near-neighbours (matt/son/read/sea), Copy run JSON → save under `qa/di-bench/`.
- **How to reach it:** Lumina dev → di-bench home card 🎯 → **Word reading** toggle → Prepare → Start run
- **Source report:** `my-tutoring-app/qa/di/BACKLOG.md` item 2

### #40 — engineering read-aloud family (10 primitives) live audio · OPEN
- **What to check:** for each, in EngineeringPrimitivesTester with a live tutor session: tapping a cyan 🔊 makes the tutor VOICE read the on-screen load-bearing text verbatim, glyph ripples while speaking, and question/mission 🔊s (ReadMeButton) never speak the answer. Wiring is jsdom-verified per primitive; only hearing the audio + the canvas-physics-gated 🔊s remain. Primitives + their canvas-gated placements: **engine-explorer** (all 4 driveable); **transport-challenge** (all 4); **propulsion-lab** (all 4); **construction-sequence-planner** (all 4); **vehicle-design-studio** (all 4; gradeBand 2-5); **paper-airplane-designer** (all 3); **flight-forces-explorer** (stall 🔊 canvas-gated); **airfoil-lab** (all 6); **hydraulics-lab** (solve/zone/debrief 🔊 canvas-gated; gradeBand 3-8); **excavator-arm-simulator** (strike/fuel/solve/debrief 🔊 canvas-gated).
- **How to reach it:** EngineeringPrimitivesTester → each primitive, grade K where claimed; walk to each phase and tap every 🔊
- **Source report:** `qa/reader-fit/{engine-explorer,transport-challenge,propulsion-lab,construction-sequence-planner,vehicle-design-studio,paper-airplane-designer,flight-forces-explorer,airfoil-lab,hydraulics-lab,excavator-arm-simulator}-PRE-2026-07-21.md`

### #39 — propulsion-timeline @ K/K-2 (young-learner read-aloud) · OPEN
- **What to check:** cyan 🔊 buttons voice load-bearing narration on tap in each phase: explore — tap a milestone, its detail shows a 🔊 that reads name + description + "why it mattered"; sequence — the ordering-task 🔊 reads "put these in order… tap one at a time, look at the year" (never the answer order) and, after Check, a clue 🔊 reads the hint; connect + speed — an intro 🔊 reads the phase orientation. Glyphs ripple while the tutor speaks (`isAudioPlaying`). Wiring is jsdom-verified 4/4; only hearing the live audio remains.
- **How to reach it:** EngineeringPrimitivesTester → propulsion-timeline, grade K; walk Explore → Sequence → Connect → Speed, tap each 🔊 with a live tutor session
- **Source report:** `qa/reader-fit/propulsion-timeline-PRE-2026-07-21.md`

### #38 — how-it-works @ K (PRE picture-order mode) · OPEN
- **What to check:** K lesson routing how-it-works to a process topic (tow truck, trash truck, excavator) renders the picture-order task — big emoji cards in a tray, tap to fill order slots, NO magazine/steps/quiz, NO counters/badges; tutor reads the question + every step aloud on load ([ACTIVITY_START_PRE], survives the lesson one-sentence cap) and from 🔊; correct order → 🎉 + advances; wrong order → shake + spoken "what happens first" hint (no answer leak); tap a placed card to undo. Confirm a real K lesson (not forced) produces the `preReader` payload.
- **How to reach it:** K lesson with a "how X works" engineering/process objective, or Ctrl+Alt+K
- **Source report:** `qa/reader-fit/how-it-works-PRE-2026-07-21.md`

### #37 — how-it-works sequence challenge (any grade) · OPEN
- **What to check:** a correct arrangement now marks green and lets you advance (was: all-red / stuck). Drive: reach a `sequence` challenge, order the items correctly → "Correct!" + Next; then a WRONG order → arrows stay usable so you can rearrange and re-check (they used to vanish). Confirms the empty-`correctOrder` safety-net + arrow fix.
- **How to reach it:** any lesson/tester routing how-it-works `sequence` eval mode
- **Source report:** `qa/reader-fit/how-it-works-PRE-2026-07-21.md`

### #35 — comparison-builder @ K (2b tail — rule-5 + per-mode picture passes) · OPEN
- **What to check:** **compare_numbers**: two big numeral boxes + a middle `=` are the only tappable surface (NO `<`/`>`/`=` symbol buttons, NO alligator, NO Check); tapping the bigger numeral completes, a wrong numeral box shakes (no text card). **order**: NO "Least→Greatest" text badge — instead three graduated bars (short→tall = ascending, tall→short = descending); Check + tiles remain. **one_more_less**: each row shows only ~5 number cells around the target (not the full 0–20 line); row headers are wordless ⬆ (emerald) / ⬇ (blue) arrows, no "One more than N?" text, no "Target" word; tapping a cell commits with no Check; a wrong cell shakes. All modes: NO text feedback card at K (SFX + spoken hint only). Grade-1 control still shows symbol buttons / text badge / full number line / feedback card.
- **How to reach it:** MathPrimitivesTester → comparison-builder, grade K each eval mode (or Ctrl+Alt+K); compare each against grade 1
- **Source report:** `qa/reader-fit/comparison-builder-PRE-2b-tail-2026-07-20.md`

### #34 — counting-board `subitize` @ K flash-then-hide · OPEN
- **What to check:** on entering a K subitize challenge: brief "👀 Get ready to look…" then the objects APPEAR for ~1.5s ("Look quick!"), then HIDE before the number stepper appears; while hidden the objects are gone (nothing to tap-count) and Check is disabled until they hide; a "Show again" re-flashes; a correct answer advances. Also glance the controls: `count_all` @ K still shows objects the whole time + tap-to-count works; Grade-1 subitize still shows objects with the stepper live immediately (no flash). Watch the flash duration feels right for a 2–5 object board.
- **How to reach it:** MathPrimitivesTester → counting-board, subitize, grade K (or Ctrl+Alt+K); compare against count_all @ K and subitize @ grade 1
- **Source report:** `qa/reader-fit/counting-board-item13-2026-07-20.md`

### #31 — ten-frame `make_ten` @ K direct manipulation · OPEN
- ⚠️ **RE-BASED `/pm` 2026-08-14 — two criteria below describe behavior the DI port (port 12, 2026-08-13) deliberately DELETED.** *"Final empty-cell tap auto-completes"* **was the defect**, not the spec: it made `make_ten` @ K unable to emit a wrong answer at all (EVAL_TRACKER **SP-31**). It now commits on **stillness**. And the **steppers are gone** — *"Grade 1–2 make-ten still shows the stepper"* is no longer checkable.
- **What to check:** seed counters cannot be removed; every empty cell accepts one tap and visibly fills; added-counter color makes the number bond legible. ⭐ **The SP-31 recheck: stop building EARLY — leave the frame short of ten and hold still. It must commit and be REFUSED.** (Before the port, stopping early simply did nothing, so the mode only ever recorded successes.) Critical recheck from the first browser run: advancing from a full make-ten frame into operate/add must show an EMPTY frame before the child builds the sum. Also glance that subitize still flashes/hides.
- **How to reach it:** MathPrimitivesTester → ten-frame mixed session, grade K; complete make-ten then advance into add; repeat make-ten at Grade 1
- **Source report:** `qa/reader-fit/ten-frame-item12-2026-07-16.md`

### #29 — flashcard-deck @ K (emoji face + read-aloud + new tutor block) · OPEN
- **What to check:** deck auto-starts (no text ready screen); card face is a big emoji + term + 👆; tutor voices the term on show and reads term→meaning on flip; 🔊 replays without closing; self-rate stays as wordless X/✓ (no "Study Again"/"Got It"/arrow sublabels); NO "Click to Reveal", NO N/M counter, NO progress dots; ≤6 cards at K; finish = wordless 🎉 (no % accuracy); live `--lesson` — the NEW tutor block reads cards aloud, survives the cap
- **How to reach it:** K lesson routing flashcard-deck, or Ctrl+Alt+K
- **Source report:** `qa/reader-fit/flashcard-deck-PRE-2026-07-16.md`

### #28 — concept-card-grid @ K (emoji face + flip read-aloud) · OPEN
- **What to check:** card FACE is a big emoji + title + a 👆 tap cue (no AI image, no "Exhibit 0N", no "Flip to Analyze"); tapping flips and the tutor reads name→definition→curiosity note aloud; a 🔊 on the back replays WITHOUT closing the card; no "Overview"/"Component Breakdown"/el.type/"Return to Artifact" chrome; live `--lesson` — read-aloud survives the cap
- **How to reach it:** K lesson routing concept-card-grid, or Ctrl+Alt+K
- **Source report:** `qa/reader-fit/concept-card-grid-PRE-2026-07-16.md`

### #27 — comparison-panel @ K (picture T/F gate) · OPEN
- **What to check:** after tapping both picture cards a 👍/👎 gate appears; the tutor reads the T/F statement aloud on view + from the 🔊; ONE tap commits (no Submit); a wrong tap dims that tile + gives a spoken hint (no answer reveal); NO "Option A/B", NO "VS", NO "Comprehension Check N of M", NO prose synthesis wall; finish = a big 🎉; live `--lesson` — statement read aloud survives the one-sentence cap
- **How to reach it:** K lesson routing comparison-panel, or Ctrl+Alt+K
- **Source report:** `qa/reader-fit/comparison-panel-PRE-2026-07-16.md`

### #26 — comparison-builder @ K (chrome band-gate + 🔊 Read-me) · OPEN
- **What to check:** at K: NO "Left: N / Right: N" count badges, NO "Challenge 1 of N" counter, NO mode tabs, NO "Kindergarten"/type badges; the two group pictures + middle "=" remain the only tappable surface; the 🔊 Read-me button sits beside the instruction in the SAME spot across compare_groups / compare_numbers / order / one_more_less and re-voices the question on tap (≥44px target, cyan glyph); grade-1 control still shows all chrome
- **How to reach it:** MathPrimitivesTester → comparison-builder, grade K each eval mode (or Ctrl+Alt+K)
- **Source report:** `qa/reader-fit/comparison-builder-PRE-2b-2026-07-16.md`

### #24 — foundation-explorer @ K in a REAL daily session (grade propagation) · OPEN
- **What to check:** foundation-explorer renders the picture-primary K render (emoji self-check, one-concept auto-advance) when reached through an actual K daily session — NOT forced via Ctrl+Alt+K. This exercises the flatten grade-fallback fix; before it, the daily session showed the STANDARD two-column layout because grade dropped at the manifest join. Needs a plan doc with `grade_level='K'` + a K student.
- **How to reach it:** Daily session for a K student that routes an IDENTIFY concept objective to foundation-explorer
- **Source report:** `qa/topic-fidelity/foundation-explorer-grade-2026-07-15.md`

### #23 — excavator-arm-simulator L2 tutor (Tier-3 live) · OPEN
- **What to check:** AI foreman speaks at each moment WITHOUT revealing the solution: greets on connect ([ACTIVITY_START]); on solving a job explains WHY it worked ([JOB_SOLVED]); on a pipe strike reassures + coaches shallow spread scoops ([PIPE_STRIKE]); on running out of fuel coaches full scoops ([OUT_OF_FUEL]); "Get a hint" nudges the right joint ([HINT_REQUESTED]); Next Job intro ([NEXT_JOB]); final debrief recaps kinematic chain ([ALL_COMPLETE]). Silent triggers must NOT appear in the chat UI.
- **How to reach it:** EngineeringPrimitivesTester → excavator-arm-simulator + Lumina Tutor Tester
- **Source report:** this session — L2 scaffold added 2026-07-15 (tutor-test Tier 1+2 pass, 0 findings)

### #22 — knowledge-check one-at-a-time · OPEN
- **What to check:** correct answer auto-advances after ~2s (slide-up fade → whoosh → next reveals); wrong answer stays with Try Again + Next →; last problem stays put, completion card reveals below; header counter dots track progress (adult); @ PRE: tutor reads ONLY the active question (scroll can no longer trigger the next problem's read-aloud), celebration finishes before next read-aloud (~3s dwell), stars/hearts row at end; tutor hints target the on-screen question after advancing
- **How to reach it:** any multi-problem knowledge-check; PRE via K lesson closing quiz or Ctrl+Alt+K
- **Source report:** this session — KnowledgeCheck.tsx sequential rewrite 2026-07-15

### #20 — fact-file @ K · OPEN
- **What to check:** text tab-exploration bypassed entirely; only the emoji-primary self-check grid shows; tap=choose advances through checks → LuminaScoreRing results; title/category/tabs/counter/difficulty-badge chrome gone; emoji sizing/layout at 3-4 options
- **How to reach it:** (no standalone tester) K lesson routing fact-file, or Ctrl+Alt+K
- **Source report:** `qa/reader-fit/explainer-tail-PRE-2026-07-15.md`

### #19 — foundation-explorer @ K · OPEN
- **What to check:** emoji-primary self-check 2-col grid (big emoji + word caption); one concept at a time, tap=choose auto-advances on correct; diagram picture kept, spotlight caption + verb badge + progress ledger + concept tabs + "Self-Check"/position chrome hidden; "🔊 Read to me" + question 🔊 read as wordless
- **How to reach it:** (no standalone tester) K lesson with an IDENTIFY concept objective, or Ctrl+Alt+K
- **Source report:** `qa/reader-fit/explainer-tail-PRE-2026-07-15.md`

### #18 — word-flip @ K (plural_s) · OPEN
- **What to check:** start screen hides the "Word Flip" badge + voice-consent essay (two start buttons remain); in-game counter + "N correct/spoken" tally + progress bar + mode badge + text feedback card hidden; counted-picture frame (emoji + singular caption) + tap chips remain; tap chip selects on click; spoken match auto-advances
- **How to reach it:** LiteracyPrimitivesTester → word-flip, grade K (or Ctrl+Alt+K)
- **Source report:** `qa/reader-fit/word-workout-word-flip-PRE-2026-07-15.md`

### #17 — word-workout @ K (word_chains / real_vs_nonsense / picture_match) · OPEN
- **What to check:** header chrome + "Vowels: a" label + "1 / N" counter + progress bar hidden; per-mode instruction sentence gone; wrong tap shows NO text card (SFX + choice ring/shake only); picture_match options are emoji-primary and tap=choose selects on click; word_chains rows readable
- **How to reach it:** LiteracyPrimitivesTester → word-workout, grade K (or Ctrl+Alt+K)
- **Source report:** `qa/reader-fit/word-workout-word-flip-PRE-2026-07-15.md`

### #16 — rhyme-studio @ K (recognition + identification) · OPEN
- **What to check:** emoji-primary word cards (big emoji + small word caption); recognition answers are big 👍/👎; identification option tiles emoji-primary + tap=choose selects on click; question sentence + text feedback card + chrome (title/badges/counter/"N correct"/progress bar) all hidden; ▶ Start / ▶/🎉 advance read as wordless
- **How to reach it:** LiteracyPrimitivesTester → rhyme-studio, recognition & identification, grade K (or Ctrl+Alt+K)
- **Source report:** `qa/reader-fit/rhyme-studio-PRE-2026-07-15.md`

### #15 — phonics-blender @ K (cvc) · OPEN
- **What to check:** letter-primary tiles (big letter, no `/k/`); phase stepper + word counter + badges hidden; build phase has NO Clear button (tap a placed tile to remove) but KEEPS Check; tapping a placed tile removes it; word emoji sizing/layout
- **How to reach it:** LiteracyPrimitivesTester → phonics-blender, cvc, grade K (or Ctrl+Alt+K)
- **Source report:** `qa/reader-fit/phonics-blender-PRE-2026-07-15.md`

### #14 — drop-zone Batch-3 misc (3 gens) · OPEN
- **What to check:** same zone-state language on timeline/sequence slots; TimelineBuilder per-slot correct/incorrect after Check
- **How to reach it:** calendar TimelineBuilder; engineering PropulsionTimeline (sequence phase); DeepDive TimelineBlock (order mode)
- **Source report:** same as #13

### #13 — drop-zone Batch-3 math (7 gens) · OPEN
- **What to check:** each answer slot: idle dashed invite → filled hold → correct pop (emerald) / incorrect shake (rose); no leftover hand-typed colored borders. Drive one correct + one incorrect drop per gen.
- **How to reach it:** MathPrimitivesTester → NumberSequencer, PatternBuilder, EquationBuilder, ComparisonBuilder (order), OrdinalLine (build), TapeDiagram, LengthLab (order)
- **Source report:** `qa/HANDOFF-dropzone-batch3-2026-07-15.md` + `DROPZONE_MIGRATION_PRD.md` §3

### #12 — sorting-station @ K · OPEN
- **What to check:** picture-primary bins (big emoji + word caption, or color circle when no `bucketEmoji`) read as tappable groups; emoji sizing/layout at 2-3 bins; odd_one_out taps auto-submit with no Check button
- **How to reach it:** MathPrimitivesTester → sorting-station, sort_one / odd_one_out, grade K (or Ctrl+Alt+K)
- **Source report:** `qa/reader-fit/sorting-station-PRE-2026-07-15.md`

### #11 — knowledge-check voice (TF + MCQ) · OPEN
- **What to check:** say "true"/an option label → credits+advances; gibberish → no penalty; Ctrl+M kills; katex/non-sayable MCQ shows NO orb
- **How to reach it:** any knowledge-check with TF/MCQ
- **Source report:** memory `project_voice-control-knowledge-check` — user believes done; confirm + strike

### #10 — multiplication-explorer fluency · OPEN
- **What to check:** answer "2 × 2" → "Correct!" (30s)
- **How to reach it:** fluency card
- **Source report:** `qa/eval-reports/multiplication-explorer-2026-07-07.md`

### #9 — Misconception loop phase 1 · OPEN
- **What to check:** items under "NOT verified (needs a browser check)"
- **How to reach it:** see report
- **Source report:** `qa/misconception-phase1-2026-07-10.md`

### #7 — decodable-reader read_along @ K · OPEN
- **What to check:** tap=choose picture options actually select on click
- **How to reach it:** K CVC lesson, read_along mode
- **Source report:** `qa/reader-fit/decodable-reader-PRE-2026-07-14.md` (BACKLOG Done)

### #5 — letter-sound-link @ K · OPEN
- **What to check:** wordless ear→check glyphs read as "listen then keep"
- **How to reach it:** K letter-sound lesson
- **Source report:** `qa/reader-fit/letter-sound-link-PRE-2026-07-14.md`

### #4 — addition-subtraction-scene @ K · OPEN — ⚠️ **RE-BASED `/pm` 2026-08-14: BOTH original criteria are now checks on deleted UI.**
- **Why it changed:** the DI port (port 13, 2026-08-14) made this primitive judged. **K's
  `NumberTileRow` is GONE** — the typed numeral is exactly what the port deletes — and **G1
  `create_story` was rebuilt on K's construction** after it was found accepting any input
  (`const correct = true`; EVAL_TRACKER **SP-31**). Checking the old row would have sent you
  looking for a component that no longer renders.
- **What to check now:** (a) at K, `solve_story` asks for the answer **aloud** and there is no
  numeral tile row to type into; (b) `act_out` @ K stays **enacted** (contract R3) and commits
  on **stillness**, not on the count matching — ⭐ **deliberately place the WRONG count and
  stop; it must commit and then be refused**, which is the whole of SP-31; (c) the equation
  tray on `build_equation` does not commit on the keystroke that completes `N op N = N`
  (type `3 + 2 = 1`, pause briefly, correct it to `10` — the 1.2s window should let you).
- **How to reach it:** K add/sub lesson; then the same at Grade 1 for `create_story`.
- **Source report:** `qa/di/BACKLOG.md` item 18 P2 (supersedes
  `qa/reader-fit/addition-subtraction-scene-PRE-1b-2026-07-14.md` for the K flow).

### #3 — comparison-builder @ K · OPEN
- **What to check:** tappable SVG group boxes + middle `=` pixel look
- **How to reach it:** K comparison lesson, compare_groups
- **Source report:** `qa/reader-fit/comparison-builder-PRE-2026-07-14.md`

## Filing history — older `/pm` refresh notes

*(Moved down here 2026-08-13 when the two Open sections merged. These are the
per-run "what was filed and why" notes that used to head the second table; they are
history, not status.)*


> **2026-08-05 refresh:** no new human-only row from the 08-04 EVENING closures —
> each report self-declares and the claim was re-grepped: reader-fit **14j** is
> generator-only (no UI file changed); **14k** ran its real-browser exact-click
> pass in-slice (report + screenshot recorded, so the pixel debt was paid, not
> deferred); DI **item 2** changes item selection only, no browser/audio behavior
> and no spoken copy. Next free ID = 63.

> **2026-08-05 (late):** **#66 opened** by the spatial-scene R12 slice — the answer moved
> off `options[0]` in `identify`/`describe`, and no one has clicked an option button since.
> Machine coverage is complete (0/36 ambiguous, suite 34/34, revert-bite); only the real
> click remains. Next free ID = 67.

> **2026-08-04 refresh:** no new human-only row. The two new DI reports either
> fold their hardest legal selection into existing #50(d) or change no spoken
> response class; the remediation-lever handoff is design-only. Reader-fit 14h
> changes generator scope and mode fidelity only and reports complete machine and
> live-runtime coverage. Support-tier batch-3 code was discovered in `effc7a6`;
> its consolidated hard-tier feel pass is now #62. Next free ID = 63.

> **The 07-25 decoherence arc is CLOSED (2026-07-26; preamble refreshed `/pm` 2026-07-27).** Root
> cause was the voice turn GATE, not any of the four hypotheses: `minVoiceMs: 120` silently meant
> "three 85ms capture frames", so a two-frame one-word answer was rejected as a blip while Gemini had
> already judged it → unanchored verdict dropped → desync. The engine fix was verified live the same
> day, then the sustained-miss recipe re-ran under the exact conditions that decohered 07-25 and was
> **COHERENT**: 5/5 items capped, 5× `[DI_MOVE_ON]`, 14 byte-template contrastive corrections, and
> **S1 fired the misconception loop's FIRST LIVE CAPTURE** (`stored for di-math-facts: "identifies
> the answer to a subtraction fact as the second number in the expression"` — bounded, generative,
> Tier-A over garbage ASR). Struck from that day: **#50(a), #49(c), #55(c)/(d-math)**. Telemetry (DI
> BACKLOG item 8) also landed and smoke-passed: every run now auto-persists a server session ledger +
> client run file joined by `client_run_id` — Copy-run-JSON is a convenience, no longer the only
> evidence path. Reports: `qa/di-bench/run-2026-07-26-math-facts-{turn-gate,turn-gate-verify,
> stress-sitting,sustained-miss}.md`.
>
> **What remains needs TWO short mic runs, not one big sitting:**
> **(1) #56 — the ~90s SILENCE micro-run (cheapest, run first).** Answer NOTHING on item 1. Closes
> three things at once: no-verdict→resync observed live, #55(e)'s nothing-to-contrast fallback, and
> item 8's induced-stall acceptance gate (the silence must be diagnosable from persisted artifacts
> alone). Details in row #56.
> **(2) The SENTENCE half of the deliberately-wrong recipe.** The math half is done at scale (14
> byte-exact contrast lines); the READING half has never been driven. One **Sentence Reading** run
> answering wrong on purpose closes #54(a)/(b)/(d) + #55(a)/(b) + the #55(d) reading half; a few
> extra **Math Facts** items in the same sitting close #50(b) homophones + #49(a) The Number After.
> The distiller guidance still applies: the SAME wrong rule on MOST items (session mean < 60) makes
> the diagnosis generative; scattered random misses are a legitimate abstain, not a failure.
> **#45** (DI in a real K lesson) remains the next-best DI sitting after these two, and is the
> evidence that would justify un-parking voice-transport.
>
> **Standing note (`/pm` 2026-08-01, user ruling):** these rows are OPPORTUNISTIC — the development
> runway must never wait on a sitting. Fault-injection hygiene: `LUMINA_FAULT_MUTE_S=25` was removed
> from `backend/.env` and the backend now REFUSES .env-persisted fault flags (loud ERROR at boot-able
> sites; arm shell-scoped for one run only). The level-3 🔄 card drive (`EPISODES=2`) and an
> end-coherent full run stay folded into DI BACKLOG item 9 Tier 2's stall journey.

> **Numbering note (`/pm` 2026-07-24, updated 2026-08-05):** IDs are identifiers, not order — the
> table is not sorted. Next free ID = **66** (**#64 + #65 opened `/pm` 2026-08-05** — the
> voice-transport implementation review's two named runtime gates: the mixed-lesson mic acceptance
> drive and the calibration hardware spread) (**#63 opened 2026-08-05** — the DI multi-word-numeral
> BENCH SITTING. Unlike every other row here it is not pixel/feel debt: standing gate 1 blocks the
> `counting_next` 1–120 build slice until it runs, and a FAIL is a real outcome that kills the
> extension in favour of catalog steering) (**#62 opened `/pm` 2026-08-04** — support-tiers
> batch-3 hard-tier feel pass) (**#60 + #61 opened `/pm` 2026-08-03** from the report
> re-grep: #60 = the support-tiers batch-2 hard-tier feel pass, the human residual its own report
> names; #61 = how-it-works **HW-1**, a CRITICAL that has never been re-verified since 2026-03-22 —
> the 08-02 nine-run sweep says so explicitly. Note #61 is NOT new debt from a new fix; it is
> long-standing debt that had no row, which is why it stayed invisible)
> (**#59 opened 2026-08-02** for knowledge-check G1
> visual evidence; **#58 opened 2026-08-01** for the coin-counter G1
> enacted tag-then-type feel — reader-fit 14b; **#57 opened 2026-08-01** for the di-letter-sounds L3
> `hard` ear-check — no open letter-sounds sitting row existed to fold it into) (#50/#51/#52/#53 all opened 2026-07-25; #51 opened and
> CLOSED the same day — its residual is #53, which #54 now carries; #54 opened 2026-07-25 with the
> di-sentence-reading birth; **#55 opened 2026-07-25** for the contrastive-correction rewording,
> and it rides the SAME sitting as #54; **#56 opened `/pm` 2026-07-27** for the silence micro-run —
> it carries DI BACKLOG item 1 residual (ii), item 8's induced-stall acceptance gate, and #55(e)).
> Two historical collisions resolved: the second `#38`
> (vehicle-comparison-lab) was renumbered **#47** (`#38` is pinned to how-it-works by
> `how-it-works-PRE-2026-07-21.md`); and the Done row "addition-subtraction-scene (were
> #25/#26)" used a same-day duplicate of **#26** — the OPEN `#26` (comparison-builder chrome
> band-gate + 🔊) is a DIFFERENT check and is still open. Don't strike it from that Done row.


## Done
- **Voice transport — mixed-lesson mic acceptance, incl. criterion (b) (was #64) — user drive 2026-08-06: PASS, backend restarted first.** The session-wide open mic's one human gate, closed in the same sitting that struck #69. **(b) is the headline and it was the shipped FAILURE on 08-05**: a curiosity question during a NON-DI section now gets a real spoken answer instead of the primitive's level1 scaffold line recited back. The user confirmed the dev backend was restarted onto the item-11 code before driving — which matters, because the slice report flagged that their :8000 server ran PRE-fix code throughout the build, and a drive against that would have proven nothing. DI over the shared mic (c) held, and every Lumina primitive rendered (the #69 half). **This closes DI BACKLOG item 11 end-to-end — machine half `d895bfb` + human acceptance — and with it the last residual of the voice-transport unification `9d08687`.** #65 (calibration hardware spread) is a separate row and stays open. **STALENESS NOTE (added post-pass): the carve-out text this drive accepted has since been edited three times** — `a55c674`, `b87dd8b`, and the maxim deletions after them — each removing a pronouncement-shaped line the model was reciting aloud to the student. The operative rules are unchanged, but this PASS no longer covers the shipped wording verbatim. Re-run `run_tutor_live.py --component lesson-curiosity --runs 3` against an **isolated** backend (not :8000) before citing #64 as a live gate on item 11.
- **PLATFORM — the 8 props-are-data primitives in a real lesson (was #69) — user browser drive 2026-08-06: PASS.** ~15 minutes at `npm run dev`: *"worked great, DI worked great, each lumina primitive worked great."* This closes the highest-value row on the list, because it is the ONE check that could confirm the repair — the failure was lesson-path only, invisible to both `tsc` (which verifies the type, not the mount) and the standalone testers (which spread fields across props and so rendered fine even while broken). The DI family reaching its judged loop in-lesson is the strongest half of the pass: those packs have to mount, receive content, AND drive the mic loop, so a silently-undefined `data` could not have survived it. `ac2d342` moves from "machine-verified, needs a browser check" to **runtime-verified**. Lesson recorded as [[tester-green-lesson-broken]].
- DI bench sentence-reading probe — **standing gate 1 for the 4th pack (was #51)** — user mic run 2026-07-25: **PASS** ("this worked so well!"). 10/10 items, 13 verdicts (10 affirmed / 3 corrected), **0 off-script, 0 unanchored**. **The make-or-break answered YES 2/2:** two deliberate one-word OMISSIONS inside 6- and 7-word sentences ("big" and "red" dropped) were both CAUGHT and corrected, and both retries affirmed — omission is the hardest error class to hear, and a judge that rubber-stamped it would have killed the pack. Whole-sentence correction settled too: the learner self-repaired on the first retry both times, so word-targeted correction (and its off-script risk) is NOT needed. No length ceiling in 3-8 words. **One ship-blocking finding for the pack, cheap:** a read sentence splits into TWO voice turns (3 supersessions) because `silenceCloseMs: 500` is tuned for one-word answers — a mid-sentence pause is part of the response; the pack passes ~1100ms via `useJudgedSpeechLoop({ voice: { config } })`. Both alias disagreements trace to that split, not judge error. **One ambiguity + an unstressed short end → #53.** Report: `qa/di-bench/run-2026-07-25-sentence-reading-probe.md` (+ trimmed run JSON).
- di-math-facts live-judged loop — THIRD DI PRIMITIVE, the real L0 gate (was #48) — user mic run 2026-07-25: **PASS** ("worked great!"). `subtraction_fact` / "subtraction within 5": **5/5 affirmed** + recap (`4 - 3 = 1`, `5 - 0 = 5`, `5 - 1 = 4`, `4 - 1 = 3`, `4 - 2 = 2`) → "Great work today!". One sitting closed three things: the L0 live gate (cue → model/guide/test → open mic → in-band audio judgment → affirm → advance → recap, no desync or stall), the **reworked reward beat** (the same-day overload fix — one fact on screen at a time, equation completing in place; the audio-edge pacing was not flagged as dragging or clipping), and the **L2 tutoring scaffold's first live run** (catalog-resolved block; the tutor held the scripted lines for 5 items, so the 4 new commonStruggles did NOT loosen it into chattiness — the named risk of adding them). Also confirmed `subtraction_fact` cue wording + code-built `solvedDisplay` live (#49b). **Carried to #50 (third consecutive all-correct run):** correction branch, homophone stress, MATHEMATICS attribution — all need a deliberately wrong answer. Report: `qa/eval-reports/di-math-facts-live-2026-07-25.md`.
- DI bench `Math facts` probe (was #46) — user mic run 2026-07-24: **PASS** ("worked great!"). Number words judged reliably from audio: 3/3 affirmed (two/three/four), aliasAgree 3/3 (ASR wrote WORDS, digits never needed), 0 unanchored / 0 phantom / 0 echo-opened; commit lag ~933ms constant → silent response-time viable as the fluency signal. Standing gate 1 for di-math-facts PASSED. **Carried to the primitive's L0 live loop (not blocking):** run ended at 3/10 items all-correct, so the fact CORRECTION branch ("My turn: …") + homophone/over-affirmation stress (one/won, two/too, four/for, eight/ate) were never driven — mirror of #41→#43. Sentinel call: engine defaults kept. Report: `qa/di-bench/run-2026-07-24-math-facts-probe.md` (+ run JSON).
- di-word-reading live-judged loop — SECOND DI PRIMITIVE (was #43) — user mic run 2026-07-23: **PASS, resounding.** Drove `direct-instruction-tester → Word Reading` on "reading short a words" → sam·mat·cat·hat all read + affirmed (printed-word-only stage, reward emoji post-read: cat 🐱 hat 🎩), recap "Great reading today!". The real L0 gate for primitive #2 is closed. User verdict: "a true awesome Lumina-native modality."
- di-letter-sounds L1 onset + mixed live wording (was #42, both dup rows) — user mic run 2026-07-23: **PASS.** All letter-sounds modes driven incl. `first_sound_in_word` (new DISTAR onset cues spoken) and `mixed` (SP-21 3-type interleave, m·s·f·s all ✅ "Great work today!"). New L1 cue wording confirmed live.
- di-letter-sounds live-judged loop — first DI PRIMITIVE (was #36) — user run 2026-07-21: **PASS end-to-end**. Generated m/s/a/f, live loop ran through the primitive, and the FULL data loop fired on submit: curriculum resolved (LANGUAGE_ARTS/LA001-01/LA001-01-a, 0.95 via Gemini) → score 9.2/correct → competency + calibration (item_beta=2.96, θ=4.71, P=0.92) + mastery lifecycle + activity log (+38 XP). di-letter-sounds L0 now fully runtime-verified; its lifecycle ladder is unblocked. **Watch-item (not a defect):** the standalone-tester submission mapped to LA001-01-a "Decode short vowel CVC words" (runtime Gemini re-mapper), NOT the birth-cert curriculum-fit home "Letter-Sound Correspondence" — expected under the known L0 lesson-mode gap (no objective-carried subskill); confirms priority of the `/add-tutoring-scaffold` lesson-mode wiring (carry the objective's subskill through instead of re-deriving from content).
- DI bench judged-loop engine runtime gate (was #33) — user run 2026-07-21: 4/4 items, 0 unanchored; the probe run's transcript-loss failure RECURRED live and the voice-anchored attempt absorbed it (judged + advanced, no desync); off-script-at-quiet exercised. Resync/timeout paths unit-covered, not yet observed live (watch-items, not blockers). Engine committed. Report: `qa/di-bench/run-2026-07-21-engine-gate.md`.
- DI bench voice-turn extraction runtime gate (was #32) — user run 2026-07-20 (run JSON): 4/4 items, 0 unanchored verdicts, 0 echo-opened turns (all 4 over-tutor turns real speech ≥0.062; floors 0.0008/0.0082 vs 0.05 barge-in bar), barge-ins interrupted + judged, response times improved. Extraction slice committed `4af21b6`. Report: `qa/di-bench/run-2026-07-20-hook-parity.md`.
- DI Bench open-mic + barge-in + echo probe (was #30) — two user runs 2026-07-19. Run 1: clean 4/4, exact script, 0 phantoms, judge affirmed /s/ from audio over a "Shh." transcript. Run 2 (probe): barge-in verified end-to-end; echo leakage = 1 blip just above threshold; surfaced DI-1 (verdict-without-attempt desync — engine design input), DI-2 (dual barge-in threshold — capture-hook input), DI-3 (pre-run stray attempt). Reports: `qa/di-bench/run-2026-07-19-open-mic.md` + `run-2026-07-19-open-mic-probe.md`.
- addition-subtraction-scene @ K `act_out` direct manipulation + `solve_story` count aid (were #25/#26) — user browser check 2026-07-16. Frogs tappable (hit-target fix), tap-to-send-away + ➕-to-add, tap-to-count 1,2,3… on solve_story; full session 100% (Act Out + Solve Story). Report: `qa/reader-fit/addition-subtraction-scene-item11-2026-07-16.md`.
- knowledge-check @ PRE emoji-grid MCQ (was #2) — user Pulse check 2026-07-16. tap=choose + auto-read + chrome hidden confirmed.
- deep-dive @ PRE quiz grid + "Read to me" (was #6) — user Pulse check 2026-07-16.
- Daily Pulse @ K stage advance (was #21) — user browser check 2026-07-15. KC `::pN` eval ids + KindergartenStage count-aware gate.
- word-sorter @ K staged-word presentation — user browser check 2026-07-14 (RF-3).
- K-stage presentation mode MVP (was #1) — user browser check 2026-07-15.
- LuminaReadAloud pilot renders/plays (was #8) — user browser check 2026-07-15.
