# Reader Fit — Can a Student at THIS Reading Band Complete This?

Take a primitive (or a whole generated lesson) and verify a student at a given
**reading band** — pre-reader, emerging, developing — can actually complete it:
no load-bearing text they cannot decode, a tutoring scaffold that is complete and
sufficient to carry them through by voice alone, and cognitive load within the
band's limits. Then **apply fixes in a loop** (fix → visual check → re-audit →
ship) until the verdict is READY, or route the finding where it belongs
(rebuild queue / manifest routing).

Outcome: a primitive that a 5-year-old who cannot read can complete with eyes,
ears, and one finger — or an explicit, recorded verdict that it cannot and where
the fix lives.

**Position in the skill family:**
- `/eval-test` asks "does the generated content work with the component?" (L1)
- `/tutor-test` asks "does the scaffold *reach* the tutor intact?" (L2 plumbing)
- `/topic-fidelity` asks "does topic/intent/grade shape the *content*?"
- `/reader-fit` asks "can the *child in front of it* actually do it?" — text
  load, scaffold **sufficiency** (not just resolution), and cognitive load,
  judged against a developmental band. It is fix-capable, like `/topic-fidelity`.

**Arguments:**
- `/reader-fit <primitive-id> [band] [--fix]` — audit one primitive (band
  defaults from the primitive's lowest supported grade; `--fix` enters the loop)
- `/reader-fit --lesson "<topic>" <gradeLevel>` — generate a real lesson via the
  `/topic-trace` pipeline and audit every section in it at that grade's band
- Backlog lives at `my-tutoring-app/qa/reader-fit/BACKLOG.md` — with no
  arguments, work the top backlog item.

## Reading bands

Derive the band from the objective's canonical grade (`normalizeObjectiveGrade`
rules — K/'kindergarten'/'preschool' → PRE). When auditing a primitive that
spans grades, audit at its LOWEST claimed grade — the catalog description's
"ESSENTIAL for Kindergarten" is a promise.

| Band | Grade | What they can decode | What may gate progress |
|------|-------|----------------------|------------------------|
| **PRE** | K | Nothing reliable. Letters ≠ words. | Audio + pictures ONLY. Zero load-bearing text. |
| **EMERGING** | 1 | CVC words, ~50 sight words, slowly | Single familiar words, IF also spoken. Never sentences. |
| **DEVELOPING** | 2 | Short simple sentences, with effort | One short sentence at a time, IF a spoken twin exists. Never paragraphs or multi-step written instructions. |
| **FLUENT** | 3+ | Grade-level text | Text may gate. Reader-fit passes trivially — out of scope. |

Numbers, math symbols the band has been taught (+, −, = at K-1), emoji, and
pictures are NOT text. Phoneme slash-notation (/k/), dev slugs (`short-a`), and
UI chrome labels ARE text.

## The band contract (PRE — ratified from the 2026-07-12 cognitive-load audit)

This is the rubric Audit C judges against. For PRE, all of it; EMERGING relaxes
rule 3's captions to "short word options allowed if spoken on tap"; DEVELOPING
additionally allows one-sentence written instructions with spoken twins.

1. **Audio is the instruction channel.** On-screen text never gates progress.
2. **Tap = choose.** No two-tap protocols; no Check button where a selection is
   atomic (multi-part constructions may keep an explicit confirm).
3. **Pictures are the answer surface**; words are captions.
4. **One thing to do per screen**; ≤ ~5 interactive elements visible.
5. **Feedback lands on the touched object, instantly** — never
   transient-text-only, never quantitative error prose ("you missed 2").
6. **No typing.** No phoneme notation as the only representation.
7. **No adult chrome in the child's field:** badges, counters, steppers, score
   ledgers, stat panels, toggles, start-gate paragraphs, voice-consent essays.
8. **Assessment hides in the mechanics** where possible ("spin until you make
   *bat*", observe the landed face) — instrument over quiz.

Reference models to copy, not reinvent: **StoryTalk** (picture-primary options,
stimulus hidden while answering, audio replay), **SyllableClapper** (concrete
physical metaphor), **WordFlip** (self-evident counted-picture frame, voice-first).

## Verdicts

Per finding AND overall. Every finding names the layer the fix lives in.

| Verdict | Meaning | Fix lives in |
|---|---|---|
| **READY** | Completable at band; contract holds | — |
| **SCAFFOLD-GAP** | UI is band-fit but the tutoring scaffold is incomplete/insufficient — a non-reader stalls (story never read aloud, task never stated, feedback unreachable) | CATALOG tutoring block, COMPONENT `aiPrimitiveData` bag, or COMPONENT sendText moments |
| **PRIMITIVE-GAP** | UI itself demands reading or protocol above band (text-only options, two-tap, chrome, typing) but the interaction core is sound | COMPONENT (band-gate the chrome, picture-primary options, spoken twins, tap=choose) |
| **REBUILD** | Quiz-shaped where an instrument is needed; decluttering won't save it | Queue in BACKLOG as a reimagining — do NOT fix inline |
| **WRONG-BAND** | Primitive cannot pedagogically serve this band by design (e.g. `create-story` writing mode at K) | Manifest routing / catalog `description`+`constraints` must stop claiming the band, or the offending **eval mode** gets a band floor. A success outcome, not a failure. |

The WRONG-BAND analog of topic-fidelity's asymmetry: a primitive whose FLOOR is
above the band is a routing problem; a primitive that claims the band but gates
it behind text is a PRIMITIVE-GAP or SCAFFOLD-GAP bug.

## Workflow

### Phase 0 — Locate, probe, band

```
Component:  src/components/lumina/primitives/visual-primitives/<domain>/<Name>.tsx
Generator:  src/components/lumina/service/<domain>/gemini-<name>.ts
Catalog:    src/components/lumina/service/manifest/catalog/<domain>.ts
```

Dev server up (`cd my-tutoring-app && npm run dev`). Pull REAL artifacts — never
audit from source alone:

```bash
# real generated content at the band's grade
curl -s -m 90 "http://localhost:3000/api/lumina/eval-test?componentId=<id>&evalMode=<mode>&gradeLevel=kindergarten&grade=K&topic=..."
# the scaffold as the tutor will actually receive it
curl -s -m 120 "http://localhost:3000/api/lumina/tutor-test?componentId=<id>&probe=1&gradeLevel=kindergarten"
```

Probe EVERY eval mode the band can be routed to (each mode is its own task
identity; `act_out` may pass while `solve_story` fails). Note which modes are
band-claimed via the catalog description/constraints.

### Phase 1 — Audit A: text census (the low-literacy standpoint)

Inventory every student-facing string in (a) the generated content and (b) the
component's rendered JSX (instructions, buttons, options, feedback, chrome).
Classify each:

- **Load-bearing** — must be understood to succeed (the story text, the question,
  option labels, "tap X then Y" protocol instructions, feedback that carries the
  correction)
- **Supportive** — helps but success is possible without it
- **Decorative** — labels/chrome that carry no task information

For each load-bearing string above the band's decoding ceiling, find its
**spoken twin**: a component-triggered utterance (sendText moment, audio asset,
`speak` call) or a scaffold script line that ENACTS it. Verdict per string:
COVERED / UNCOVERED. Any UNCOVERED load-bearing string fails Audit A.

### Phase 2 — Audit B: scaffold sufficiency (the eyes-free walkthrough)

`/tutor-test` proves the scaffold *resolves*; this audit proves it *suffices*.
Walk the full challenge sequence as a non-reader — using ONLY the prompt preview
plus what the screen shows a non-reader (pictures, layout, animation). At every
step the scaffold must answer five questions. This is the **Sufficiency
Contract**:

1. **ORIENT** — does the tutor say what to do, in child terms, unprompted at
   challenge start (a sendText moment fires, and its script enacts the task)?
2. **STIMULUS** — is every load-bearing stimulus SPOKEN? A story-problem's text
   must be READ ALOUD by the tutor, not referenced. `{{storyText}}` sitting in
   `taskDescription`/contextKeys is tutor-reference only — nothing guarantees the
   student ever hears the story. The scaffold needs an explicit beat: an
   `aiDirective`/moment script like "Read the story aloud to the student first,
   word for word: {{storyText}}".
3. **DISAMBIGUATE** — when the task has a direction or target (more vs fewer,
   which group, which slot), does a script STATE it? `askFor`/`instruction` in
   contextKeys is not enough; a scaffolding level or moment must enact the
   question ("Which side has MORE?"). This is the comparison-builder failure
   class: the tutor never asked the clarifying question because no script told
   it to.
4. **FEEDBACK** — can the student know right/wrong without reading? (Object
   animation, sound, or a spoken struggle response — not a text card.)
5. **RECOVER** — do `commonStruggles`/scaffolding levels cover the band's
   likely stalls, and are they usable eyes-free (no "read the instructions
   again", no answer leaks into spoken lines)?

Judge sufficiency per eval mode. Then, for scaffolds that pass on paper but
"felt off" live, or for any new/materially-changed scaffold, confirm behavior
with the Tier-3 live harness (`backend/tests/tutor_live/run_tutor_live.py
--component <id> --runs 3`, findings CONFIRMED at ≥2/3 runs) — ORIENT and
DISAMBIGUATE failures are behavioral and only fully visible there.

**Confirm STIMULUS/ORIENT in LESSON mode, not just standalone (`--lesson`).**
Every Lumina primitive ships inside a lesson, and lesson mode is where these fail:
the `[PRIMITIVE SWITCH]` and lesson-greeting prompts both cap the tutor at "one
sentence / keep it brief" (`lumina_tutor.py`), so a read-aloud that lives only as a
soft clause in a component `sendText` gets **dropped** — while the SAME content
reads fine in standalone. addition-subtraction-scene read the story 6/6 in
standalone yet was the live K-lesson failure. So for any STIMULUS/ORIENT finding,
run `--component <id> --lesson --runs 3` (drives the real switch/greeting path) —
a standalone pass is NOT sufficient. The harness `must_include` oracle fires
`stimulus-not-read` HIGH when load-bearing story content isn't voiced.

### Phase 3 — Audit C: cognitive load vs the band contract

Check the component against the band contract checklist (all 8 rules). Count
simultaneous interactive elements from the RENDERED state (worst-case generated
content, e.g. max options), not from the source. Record per-rule PASS/FAIL with
the specific offender ("two-tap select explained in 10px text", "score ledger in
child's field").

### Phase 4 — Verdict + report

Aggregate: overall verdict = worst finding. Save the report (format below),
update `BACKLOG.md` (add REBUILD items; check off completed ones), and add
`RF-N` rows to `my-tutoring-app/qa/EVAL_TRACKER.md` for HIGH findings.
**Without `--fix`, stop here** — findings route through the loop when invoked.

### Phase 5 — The fix loop (`--fix`)

Work findings in severity order, one slice per iteration:

1. **Fix at the named layer** — the ladder, cheapest first:
   - **Tier 1 — scaffold copy + bag** (SCAFFOLD-GAP): add the read-the-stimulus
     beat, enact-the-question line, eyes-free struggle responses; add derived
     keys to `aiPrimitiveData` rather than rewording reviewed scaffold copy;
     never interpolate answer keys into spoken lines. **Put the STIMULUS/ORIENT
     beat in the CATALOG scaffold's `aiDirectives`, not (only) a component
     `sendText` clause.** aiDirectives render into the standalone system prompt
     AND the lesson `[PRIMITIVE SWITCH]`/greeting injection, so the read-aloud
     survives the "one sentence" cap — and the directive should say so explicitly
     ("reading the story IS your greeting; this overrides any one-sentence cap").
     A component `sendText` moment can still reinforce it, but it is droppable
     alone (that was the bug). Also: a `{{key}}` in `taskDescription`/`aiDirectives`
     only resolves if the COMPONENT forwards that key into `aiPrimitiveData` —
     a generator-only key renders as `(not set)` (the `{{instruction}}` bug); the
     `tutor-test --probe` var-resolution table shows `component` vs `generator-only`.
   - **Tier 2 — component band-gating** (PRIMITIVE-GAP): spoken twins for
     load-bearing text; picture-primary options (emoji/image primary, word
     caption); collapse two-tap to tap=choose; gate chrome on the band
     (`config.gradeBand === 'K-1'` hides counters/steppers/ledgers — many
     primitives already carry `gradeBand`/`supportTier` in config); kill typing
     paths at PRE/EMERGING.
   - **Tier 3 — generator constraints**: if the generated content itself is the
     text load (option labels as sentences, too many items), bound it per band
     in the generator prompt/schema — same pilot-then-sweep discipline as
     `/topic-fidelity`.
   - **REBUILD** items do not enter the loop — they go to the backlog with a
     one-paragraph instrument sketch (what mechanic replaces the quiz).
2. **Type check** — `cd "<abs>/my-tutoring-app" && ./node_modules/.bin/tsc
   --noEmit`, zero new errors vs baseline.
3. **Visual check (mandatory, before re-audit)** — drive the exact flow:
   MathPrimitivesTester (or the domain tester) → select primitive + mode →
   Generate → interact as the child would. Screenshot for the user when the
   change is visual. Scaffold changes: re-run the tutor-test probe and read the
   prompt preview; behavioral fixes additionally get a Tier-3 live run. A fix
   that was not exercised at runtime is not fixed (Verification Doctrine).
4. **Re-audit** — re-run the failed audit (A/B/C) for the touched modes. Loop to
   step 1 until READY.
5. **Ship** — `/ship` the slice; update report + backlog + memory.

### Lesson mode (`--lesson`)

1. Run the `/topic-trace` pipeline for the topic + grade to get a REAL manifest
   and per-section generator output (this is what the student actually gets —
   the screenshot-level view).
2. For each section (including knowledge checks and deep-dive blocks), run
   Phases 1–3 at the lesson's band. Reuse existing recent reports (< ~30 days)
   for primitives already audited at that band; re-audit if the component or
   scaffold changed since.
3. Add two lesson-level checks: **hand-off coherence** (does the tutor bridge
   between sections, or does each section cold-start with unread text?) and
   **routing** (did the manifest place a WRONG-BAND primitive/eval mode in a K
   lesson? That finding goes to the catalog description/constraints or eval-mode
   band floor, not the primitive).
4. Report one table: section | primitive | mode | A | B | C | verdict | fix layer.

## Report format

`my-tutoring-app/qa/reader-fit/<primitive-id>-<band>-<YYYY-MM-DD>.md`
(lesson mode: `lesson-<slug>-<YYYY-MM-DD>.md`):

```markdown
# Reader Fit: <id> @ <band> — <YYYY-MM-DD>

Modes audited: <list> | Probes: eval-test ✓ tutor-test --probe ✓ [live standalone ✓] [live --lesson ✓]

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin | Verdict |

## Audit B — sufficiency contract
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |

## Audit C — band contract
| Rule | PASS/FAIL | Offender |

**Overall: <verdict>** — <one line>
Findings → fix layer: ...
[--fix] Loop log: iteration | change | visual check | re-audit result
```

## Gotchas

- **contextKeys ≠ spoken.** Everything in `taskDescription`/`contextKeys` is
  tutor-reference. Only `scaffoldingLevels`, `commonStruggles.response`,
  `aiDirectives`, and component sendText scripts shape what is SAID. Audit B
  failures hide exactly in this gap.
- **`{{#if ...}}` handlebars in scaffolds render as literal text** — the
  backend's `interpolate_template` does key substitution only. Any conditional
  block in a catalog tutoring string is a bug (comparison-builder's
  `taskDescription` has them). Flag on sight.
- **Scaffold resolution ≠ sufficiency.** A scaffold can be 100% green on
  `/tutor-test` (every key resolves) and still strand a non-reader. Never skip
  Audit B because tutor-test passed.
- **Standalone can pass while lesson strands the child.** The lesson greeting and
  `[PRIMITIVE SWITCH]` cap the tutor at "one sentence / keep it brief", so a
  read-aloud carried by a soft component `sendText` clause survives standalone but
  gets dropped in a real lesson. Always confirm STIMULUS/ORIENT with
  `run_tutor_live.py --lesson` (§ Audit B), and fix by moving the beat into the
  catalog `aiDirectives` (§ Phase 5 Tier 1), not a component message alone.
- **Judge the worst-case render.** Element counts and option text vary with
  generated content — probe several draws; judge the distribution like
  topic-fidelity does.
- **Don't strip pedagogy while decluttering.** Removing a Check button from a
  multi-part construction destroys the task identity; tap=choose applies only
  where the selection is atomic. When unsure, the fix is band-gating, not
  deletion.
- **Answer-leak discipline carries over from `/tutor-test`:** answer keys in
  contextKeys are fine (tutor reference); the same key in any spoken line is a
  leak. A read-the-stimulus beat must read the STORY, not the equation solution.
- **Voice primitives:** an open mic doesn't exempt the primitive — the child
  still needs ORIENT and DISAMBIGUATE spoken. Mic UX rules live elsewhere
  ([[open-mic-over-turn-windows]], [[spoken-tutor-quiet-by-default]]); reader-fit
  only checks the tutor isn't the SOLE carrier of load-bearing text with no
  moment wired to fire it.
- **Quiet-tutor doctrine vs ORIENT:** frame-once-then-silent is the ruling; the
  ORIENT beat at challenge start IS the frame. Don't fix Audit B by making the
  tutor chatty per-tap.
- **The kit look is itself a load tax at PRE** (adult glass slate vs toy
  warmth). Single-primitive fixes should not fork the design system — the
  shared "K-stage" full-bleed presentation mode is the systemic fix; record
  chrome findings even when the primitive-local fix is only partial, so the
  stage-mode case keeps accumulating.

## Key files

| File | Purpose |
|------|---------|
| `src/app/api/lumina/eval-test/route.ts` | Real generated content at a band (`&grade=K&gradeLevel=kindergarten`) |
| `src/app/api/lumina/tutor-test/route.ts` | Scaffold prompt preview (`&probe=1`) |
| `backend/tests/tutor_live/run_tutor_live.py` | Tier-3 live behavioral confirmation. `--lesson` drives the lesson greeting/`[PRIMITIVE SWITCH]` path; `must_include` on a Beat → `stimulus-not-read` HIGH when load-bearing content isn't voiced. Add a bespoke journey per primitive (see the `addition-subtraction-scene` one) |
| `src/components/lumina/service/manifest/catalog/*.ts` | Tutoring blocks, band claims (description/constraints), eval modes |
| `src/components/lumina/primitives/visual-primitives/**` | Rendered text, chrome, protocols |
| `backend/app/api/endpoints/lumina_tutor.py` | `interpolate_template` — why conditionals/unknown keys fail |
| `my-tutoring-app/qa/literacy-cognitive-load-audit-2026-07-12.md` | Origin audit; recurring load patterns + reference models |
| `my-tutoring-app/qa/reader-fit/BACKLOG.md` | Working queue (seeded 2026-07-13) |
