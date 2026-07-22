# Reader Fit: how-it-works @ PRE — 2026-07-21

Modes audited: guided (identify), sequence, predict/explain | Probes: screenshot (real K render, tow-truck) ✓ · source (component + generator + catalog) ✓ · eval-test/tutor-test live ✗ (not needed — verdict is structural)

Band: PRE (catalog claims "ESSENTIAL for K-8" → lowest claimed grade K → PRE). Trigger: live K lesson, "How a Tow Truck Works", sequence challenge = order 5 full sentences.

## Audit A — text census
| String (abridged) | Where | Class | Spoken twin | Verdict |
|---|---|---|---|---|
| "Helping cars when they cannot move on their own" (subtitle) | header | Load-bearing | none | UNCOVERED |
| "When a car breaks down, it needs a special helper… lift or pull the car to a repair shop." (overview, 2 sentences) | header | Load-bearing | `[ACTIVITY_START]` sendText, `{silent:true}` — not read | UNCOVERED |
| Step titles + 2–3 sentence descriptions + whatsHappening + keyTerm defs + funFacts | timeline | Load-bearing (dense prose) | none (scaffold says "read the description") | UNCOVERED |
| "Can you put the steps of using a tow truck in the right order?" (question) | challenge | Load-bearing | none | UNCOVERED |
| 5 sequence items, each a full sentence ("The driver attaches the chain." …) | challenge answer surface | **Load-bearing — this IS the task** | none | UNCOVERED |
| "sequence" badge, "Challenge 1 of 3", "4 Steps", category badge, "Check Order", ▲▼ | chrome/protocol | Decorative→Protocol | none | UNCOVERED |

Every load-bearing string is above the PRE decode ceiling and none has a spoken twin. **Audit A fails.** The answer surface itself (5 sentences to reorder) is unreadable and un-voiced.

## Audit B — sufficiency contract
| Mode | ORIENT | STIMULUS | DISAMBIGUATE | FEEDBACK | RECOVER |
|---|---|---|---|---|---|
| guided/sequence/predict | ✗ `[ACTIVITY_START]` is `{silent:true}`; `handleStartChallenges` sends nothing → task never stated aloud | ✗ overview + step prose + the 5 ordering sentences never read | ✗ ordering direction never spoken | ~ sound fires, but correction is a text card + explanation prose | ✗ commonStruggles say "go back and **read** the description" — unusable eyes-free |

Scaffold `taskDescription`/`contextKeys`/`scaffoldingLevels` are all tutor-reference and instruct the child to READ. **Audit B fails** — a non-reader stalls immediately.

## Audit C — band contract
| Rule | PASS/FAIL | Offender |
|---|---|---|
| 1 Audio is the instruction channel | FAIL | text gates every screen |
| 2 Tap = choose | FAIL | sequence = reorder-via-▲▼ then explicit "Check Order" (multi-step protocol) |
| 3 Pictures are the answer surface | FAIL | challenge options are text-only sentences; per-step images are gated behind a "Generate Visual" button and live on the *exploration* screen, never on the answer surface |
| 4 One thing per screen, ≤5 elements | FAIL | exploration = two-column magazine (timeline + quick-facts + glossary + progress); challenge = 5 items × 2 arrows + Check = 11 targets |
| 5 Feedback on touched object, instant | FAIL | transient text card ("Not quite…") + explanation prose |
| 6 No typing | PASS | — |
| 7 No adult chrome | FAIL | step counter, challenge counter, category/steps badges, progress bar, glossary |
| 8 Assessment hides in mechanics | FAIL | explicit quiz shell |

7 of 8 fail. This is a reader's magazine-explainer + text quiz.

**Overall: WRONG-BAND @ PRE (K)** — how-it-works cannot pedagogically serve a non-reader by design; the answer surface is text-only sentences with no picture path, and the load sits across two dense screens. This is not a decluttering fix (would be REBUILD if we tried to force it), so the correct route is a catalog band floor.

Findings → fix layer:
- **WRONG-BAND (primary)** → catalog `description` + `constraints`: stop claiming K. "ESSENTIAL for K-8" → "grades 2–8"; add a floor to constraints. Optionally add an eval-mode band floor (new field; eval modes today carry only `beta`/`scaffoldingMode`/`challengeTypes` — no floor exists yet).
- **Underlying SCAFFOLD-GAP** (ORIENT/STIMULUS un-voiced) and **PRIMITIVE-GAP** (text-only answer surface, two-tap protocol, chrome) are real but do NOT need fixing *if* we route K away — they are the evidence that scaffolding alone can't reach the band.
- **Routing destination for K procedural/ordering:** `time-sequencer` (already K-2, picture-primary, "K: 3-event sequences … only") and `life-cycle-sequencer`. The manifest should resolve K sequencing there, not here.

No `--fix` this run on the band verdict — decision routes to catalog/manifest (see recommendation to user).

---

## Second issue — sequence challenge is unwinnable (lesson-breaker, ALL bands)

Surfaced live: a logically-correct arrangement marks **all 5 items red / "Not quite"**, and the lesson can't advance. Root cause found via real generation (`eval-test`, sequence @ K):

```
sequenceItems: s0..s4 (5 real steps)
correctOrder:  []          ← EMPTY answer key
```

`handleSequenceCheck` compares `JSON.stringify(sequenceOrder) === JSON.stringify(correctOrder)` — a 5-item arrangement can never equal `[]`, so **every** order is wrong. flash-lite dropped `correctOrderCsv`; the generator's validation had no answer-key integrity guard and shipped the unwinnable challenge, so the lesson gate never clears. Not band-specific — this bricks the primitive at every grade.

Compounding UX bug: after the first "Check Order", the ▲▼ reorder arrows were gated on `!sequenceChecked`, so they **vanished** — the student couldn't rearrange to retry; the only remaining control (Check Order) re-failed.

### Fixes applied
| # | Layer | Change | Verified |
|---|---|---|---|
| B1 | Generator `validateHowItWorksData` (sequence branch) | Answer-key integrity guard: if `correctOrder` isn't a clean permutation of the item IDs, fall back to authored item order (items are authored in-order; board is shuffled for display). Never ships an empty/partial key. | ✓ runtime — re-generated, key now valid permutation (5/5) |
| B2 | Generator prompt (sequence rules) | State the convention explicitly: author items in correct chronological order; `correctOrderCsv` must list every ID once; **no trap/distractor items** ("not part of the process") in a reorder task. | ✓ (prompt) |
| B3 | Component `HowItWorks.tsx` | `sequenceKey` memo — runtime safety-net that repairs already-cached broken content (empty key → item-order key), so existing lessons become winnable. Used in both the check and the position coloring. | tsc ✓ · needs browser click-through |
| B4 | Component `HowItWorks.tsx` | Arrows gated on `!showChallengeFeedback` (not `!sequenceChecked`) so the student can rearrange after a failed check. | tsc ✓ · needs browser click-through |

Overall this issue: **FIXED at the data layer (runtime-verified); component safety-net + arrow fix type-checked, pending a browser click-through** (HUMAN-CHECKS #37). Distinct from the band verdict above — this fix restores the lesson for grades where how-it-works is correctly routed.

---

## Resolution of the band verdict — PRE mode built INSTEAD of routing away

Decision (user): rather than floor how-it-works's K claim and route K elsewhere, **treat the pre-reader experience as a reduced-complexity subset of the same primitive** — band-gate within how-it-works (the reader-fit-preferred pattern, as comparison-builder / foundation-explorer already do). No catalog floor was applied; the K claim now stands honestly because the K render is genuinely pre-reader.

### PRE mode contract (shipped)
| Layer | Change |
|---|---|
| Type | `HowItWorksData.preReader?: { question, steps: {id,emoji,label,spoken}[] }`. Its presence IS the band signal. |
| Generator | New `PRE_READER_BANDS` branch (Toddler/Preschool/Kindergarten) → tiny `preReaderSchema` (3-4 emoji steps authored in order, short label, spoken line). Drops the whole magazine (quickFacts, glossary, whatsHappening, key terms) and all text MCQs. |
| Component | `data.preReader` early-returns a picture-primary render: shuffled emoji **tray → tap-to-order slots** (tap=choose, no ▲▼, no Check button), auto-checks when full, feedback on the card (green/shake + SFX), 🎉 on finish, **zero adult chrome**. Tap a placed card to undo. The three magazine effects (intro, all-explored, auto-submit) are gated off for PRE so it doesn't self-complete. |
| Scaffold | Catalog `aiDirectives` "PRE-READER PICTURE ORDER (K)" beat + component `[ACTIVITY_START_PRE]` (non-silent) → tutor reads the question and every step aloud on connect; directive says the read-aloud overrides the one-sentence cap; 🔊 replays; no answer-order leak. |

### Re-audit at PRE (post-fix)
- **Audit A** — the only on-screen words are the question (spoken + 🔊) and 1-3 word emoji captions. Every load-bearing string has a spoken twin (ORIENT + replay). PASS.
- **Audit B** — ORIENT + STIMULUS fire unprompted and read every step; DISAMBIGUATE (the ordering ask) is spoken; FEEDBACK is card animation + SFX + spoken hint; RECOVER via undo + first-step hint (no leak). PASS.
- **Audit C** — audio is the instruction channel; tap=choose; pictures are the answer surface; ≤4 cards + tray; feedback on the card; no typing; no chrome; assessment is the ordering mechanic itself. 8/8 PASS.

**Overall @ PRE now: READY** (was WRONG-BAND). Verified: real K generation emits the compact `preReader` payload (🚗→⛓️→🚚, 0 magazine); component behavior covered by `HowItWorks.reader-fit.test.tsx` (4/4 — cards render, no chrome, ORIENT reads all steps, correct order auto-submits + 🎉, wrong order no-submit + undo). Pixel/live-lesson glance → HUMAN-CHECKS #38.
