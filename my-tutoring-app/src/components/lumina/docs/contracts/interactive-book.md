# Contract: interactive-book

- **Derived:** 2026-09-28 · evidence window: birth + eval-modes 2026-07-14 + curriculum-fit 2026-07-14 + DI port live 2026-08-14/16 + Pip batch la-1-3 2026-09-14 + workspace rollout C3 live 2026-09-25 + named misses A5 + authored map (live backend, 2026-09-28) + git to f216cc3d
- **Component:** `primitives/visual-primitives/literacy/InteractiveBook.tsx` (+ `interactiveBookDomain.ts`, `interactiveBookLevers.ts`) · **Generator:** `service/literacy/gemini-interactive-book.ts` · **Catalog:** `service/manifest/catalog/literacy.ts` (`...bossEntry(interactiveBookCard)`) · **Live wiring:** boss `interactiveBook.card.ts` + `interactiveBook.boss.ts` (`bossAdapter`, `bossJourney`; 2026-10-20)
- **Status:** ACTIVE (no open conflicts)

Derived as step 1 of handoff 22 L1 (`qa/live-runtime-handoffs/22-literacy-levers.md`), before
in-item levers are added to `find-feature`. Channel [4] (calibration) not read (auth, as for
cvc-speller 2026-09-27). No census trace names this primitive; channel [1] is empty, not zero.

## Consumers (blast radius)

| Consumer (skill/band/topic family) | Channel | Evidence | Last seen |
|---|---|---|---|
| K text features (LA006-06 family: title/author, headings, captions) | curriculum-fit retrieval | `qa/curriculum-fit/interactive-book-2026-07-14.md` (K MATCH 0.787, 5/5) | 2026-07-14 |
| G2 text-feature navigation (LA007-02-a captions/bold/index) | curriculum-fit retrieval | same report (G2 MATCH 0.795); G1 ABSTAIN | 2026-07-14 |
| Authored map | [3] | `GET /api/curriculum/primitive-mappings/language_arts` → 0 of 65 mappings (live 2026-09-28) | live |
| Eval modes `find-feature` / `read-focus-word` (IRT) | eval [2] | `qa/eval-reports/interactive-book-evalmodes-2026-07-14.md`; EVAL_TRACKER row 37 | 2026-07-14 |
| DI port 14 (oral cloze + tap split, build gates) | live [2] + git | `5eb91aaf`; `qa/tutor-reports/interactive-book-live-di-plain-2026-08-1{4,6}*.md` | 2026-08-16 |
| Shared teaching workspace (tutor/JEV, rollout C3) + live journey harness | live [2] + code | `2e6c6ce5`; `qa/tutor-reports/workspace-rollout-C3-2026-09-25.md:14,28,44-45`; `liveJourneySpec.ts:1375-1391` | 2026-09-25 |
| Named misses for the trigger ladder (A5) | code [5] | `1a0cd42a`; catalog `teachingWorkspace.misses` (`literacy.ts:1474`) | 2026-09 |
| Pip shared surface | code [5] | `c6f608e9`; `pip/interactiveBookPipPose.ts` | 2026-09-15 |

## Requirements

### R1 — The book is generated; every scored contract is derived from it · OBSERVED
- **Property:** the manifest supplies no book text, answers, pages, image prompts or challenges. Gemini authors one nonfiction book (title, author, cover, pages with heading, caption, two paragraphs, two focus words); code derives every challenge from what is printed. Headings/captions are distinct and short. A malformed book is retried 3× then replaced by the validated fallback. Word difficulty comes from `raw.wordDifficulty` or grade (K easy, G2 hard, else medium); there is no `config.difficulty` tier ladder today.
- **Demanded by:** every consumer (answer-leak architecture); eval modes.
- **Evidence:** `gemini-interactive-book.ts:146-160,491-560`; catalog `constraints`; evalmodes report "Generator hardening".
- **Probe:** `GET /api/lumina/eval-test?componentId=interactive-book&evalMode=find-feature&grade=K` → one book, ≥3 pages, challenges only derived from printed parts.

### R2 — find-feature item set and option shape · OBSERVED
- **Property:** a `find-feature` session is exactly the five derived items, each on its own view: title and author on the cover (parts = title, author), heading on page 1, caption on page 2, page number on page 3 (parts = heading, caption, `Page <n>`). `optionTexts` equals the view's printed parts, the target occurs exactly once, all distinct. Build gates (`itemFromChallenge`, shared by generator and component) drop any item whose feature text is > 40 chars, > 4 words, holds `"` `_` `.` `!` `?`, opens with a sentinel, or has fewer than 2 options. The mixed path alternates feature/read items, capped at 6.
- **Demanded by:** eval mode `find-feature` (5/5 runtime pass); DI port build gates.
- **Evidence:** `deriveFeatureChallenges`, `pageOptions`, `validateDerivedChallenges` (`gemini-interactive-book.ts:278-322,445-470`); `interactiveBookScript.ts:206-257`.
- **Probe:** eval-test `evalMode=find-feature` → 5 items, targets title/author/heading/caption/page-number, each target once in its options.

### R3 — Mode identity and answer modality · OBSERVED
- **Property:** `find-feature` is a gesture: the tap on a printed part IS the commit (`commitGesture`), checked in code by `tapMatches` (text compare), never by the tutor. `read-focus-word` is spoken: the glowing word is read aloud and judged (`short_spoken_word`); nothing in a paragraph is a button. No Next / Check / Skip button, no advance timer, no free page navigation: the screen shows the current item's view only. Hotspot buttons are disabled outside `find-feature` and when `canAttempt` is false.
- **Demanded by:** DI port 14 (costume test killed tap-the-glowing-word); workspace C3.
- **Evidence:** `InteractiveBook.tsx` header + `handleHotspotTap`, `renderHotspot`, `renderParagraph`; card modes `TAP_ONE` / `SPOKEN` (`interactiveBook.card.ts`).
- **Probe:** `npm test -- InteractiveBook interactiveBookWorkspace` (48 tests green 2026-09-28).

### R4 — Nothing names the tap target before credit · OBSERVED
- **Property:** every hotspot has the same aria-label ("A printed part of the book") and the same idle style; the target turns `correct` only after credit, and a wrong tap alone turns `incorrect`, cleared on Try again. The find-feature assignment publishes no `expectedAnswer`; the packet never contains the target text; scene facts name the kind asked for (`lookingFor`) and the set of parts shown, never which printed words they are. The scene's `constraints` forbid reading any printed words aloud, naming which words are the part, or saying where it sits before the tap; after a tap the tutor may say what the kind of part is for (re-based 2026-10-20: the scripted affirm and job-correction lines are gone; the tutor speaks in its own words). The ask (`askFor`) names the part, never its text. Prompt and hint strings never contain the target text.
- **Demanded by:** every consumer (Pedagogy rule #1); workspace C3.
- **Evidence:** `interactiveBookDomain.ts` (`askFor`, `interactiveBookScene`; find-feature key null, so `bossAssignment` is a gesture); `InteractiveBook.workspace.test.tsx` "a tap key is not" published (`not.toMatch(/Nest Above/)`); `validateDerivedChallenges` prompt/hint checks.
- **Probe:** `npm test -- InteractiveBook.workspace`; C3 journey `interactive-book-w1-find-feature-text-2026-09-25.json` (PASS).

### R5 — Named miss for a wrong tap · OBSERVED
- **Property:** a wrong tap commits with `interactiveBookMiss` = the tapped part's kind: `tapped_title`, `tapped_author` (cover), `tapped_heading`, `tapped_caption`, `tapped_page_number` (page); undefined on a right tap or on read-focus-word. The list is the card's `INTERACTIVE_BOOK_MISSES['find-feature']`. The miss names what was tapped, not what was asked. Try again clears the tap and Pip.
- **Demanded by:** trigger ladder / named misses (A5, handoff 20); workspace C3.
- **Evidence:** `interactiveBookDomain.ts` (`interactiveBookMiss`); `interactiveBookDomain.test.ts`; `InteractiveBook.workspace.test.tsx:58-75`.
- **Probe:** `npm test -- interactiveBookDomain InteractiveBook.workspace`.

### R6 — Hear the question, never the answer · OBSERVED
- **Property:** one 🔊 button, never withdrawn by band or tier; each tap sends a silent host message (`runner.requestHear`) asking the tutor to say only the ask (`hearQuestionRequest`), which carries the part name (find) or the lead-in (read), never the target text.
- **Demanded by:** K pre-readers (the ask is the only way to know what to find); workspace guidance.
- **Evidence:** `InteractiveBook.workspace.test.tsx:77`.
- **Probe:** same test file.

### R7 — Oral cloze contract (read-focus-word) · OBSERVED
- **Property:** each focus word is one sayable token (≤12 letters, not yes/no), occurs exactly once in its page's paragraphs, has a lead of ≥2 words and ≤90 chars that does not contain it, glows in place (amber, emerald on credit). The ask reads the lead and stops ("Listen: <lead> — hmm. Read the glowing word."); the key (`interactiveBookKey`, written by `spokenKeyText`) is the word, with the phrase form and sounding-out accepted and the lead said back or a context guess as the signature error (re-based 2026-10-20 from the scripted judging contract).
- **Demanded by:** eval mode `read-focus-word`; DI port; C3 live (`--audio` PASS, "The tall red..." then stopped).
- **Evidence:** `interactiveBookDomain.ts` (`itemFromChallenge`, `askFor`, `interactiveBookKey`); C3 report :45; `askLeaks` over the saved payload (`boss.test.ts`).
- **Probe:** eval-test `evalMode=read-focus-word`; `npm test -- InteractiveBook.workspace` spoken-key test.

### R8 — Workspace-only path and evaluation · OBSERVED
- **Property:** the component runs only when bound (`withWorkspaceOnly`; unbound → "needs the tutor" card); the tutor's instruction is the boss guidance built from the card (`bossEntry`; re-based 2026-10-20 from hand-written `teachingWorkspace.guidance`). One evaluation per session with `InteractiveBookMetrics` in its pre-port shape (hints/exploration fields stated as 0), plus diagnosis evidence. An item the build gates cannot ask makes the boss's `validate` refuse the book.
- **Demanded by:** workspace C3 (LA-14 ruling 09-23); IRT/mastery.
- **Evidence:** `2e6c6ce5`; `InteractiveBook.workspace.test.tsx:96`.
- **Probe:** `npm test -- InteractiveBook.workspace`; `run_live_runtime.py --primitive interactive-book --mode find-feature`.

### R9 — Pip and harness targets · OBSERVED
- **Property:** printed parts carry `data-pip-object="part-<hotspotId>"` (`cover-title`, `cover-author`, `<pageId>-heading|caption|number`), the view carries `page`, the glowing word `glow`; the journey harness and tests touch these ids. Pip is published by the runner (`<PipDock />` above the book, `<PipWorkspace>` around the model and the view) and points at the workspace as a whole, never at a part (re-based 2026-10-20: the hand-wired pose and per-part Pip targets are gone; the `data-pip-object` ids stay as harness tap keys).
- **Demanded by:** Pip surface; live journey (`liveJourneySpec.ts:1381-1391`, `interactiveBookJourneyAnswers`).
- **Evidence:** `InteractiveBook.tsx` `renderHotspot`; `pip/WorkspacePip.surface.test.tsx`.
- **Probe:** `npm test -- InteractiveBook.workspace WorkspacePip.surface` (touch `part-p2-caption`).

### R10 — Pictures carry no print · OBSERVED
- **Property:** every generated picture prompt appends "no printed words, no letters, no labels"; a failed picture shows its alt text and a retry button. Printed parts exist only as the hotspot buttons.
- **Demanded by:** R4 (a printed word in the art would be an untappable competing part).
- **Evidence:** `InteractiveBook.tsx` `ensureImage`.
- **Probe:** code read + visual check on a generated book.

### R11 — In-item levers on find-feature · OBSERVED
- **Property:** `interactiveBookLevers.ts`, one lever set (`INTERACTIVE_BOOK_LEVERS`). `model_page` (type `model`: a different book, solved; when it comes is the set's `support` by the lesson's `supportTier`, default medium) shows a code-owned model cover or page beside the book with the asked kind of part outlined; no model text is the book's (it falls back to a second model), its parts carry no `part-`/`page` Pip ids and are not tappable, and the book's own parts are never marked (R4, R9). `two_part_page` (type `easier`, inner pages only) opens an ungraded practice page, not the book's, with the asked part and the far one (the caption against the top row), tap keys `part-practice-<feature>`, and its own scene `shown` line. A pull is a synchronous commit; the next attempt records the lever.
- **Demanded by:** handoff 22 L1; trigger ladder (handoff 21 S2).
- **Evidence:** `qa/eval-reports/levers-literacy-L1-2026-09-28.md`.
- **Probe:** `npm test -- InteractiveBook.levers.workspace`.

### R12 — In-item levers on read-focus-word · OBSERVED
- **Property:** `sound_dots` (type `marks`) puts one dot per grapheme under the glowing word only, through the shared kit overlay; nothing is voiced and the word's letters are unchanged (R7: never say the glowing word before a try). `cvc_focus` (type `easier`, only when the glowing word is not CVC) opens an ungraded practice sentence from the code pool (`decodablePracticeLines.ts`) whose CVC word glows after a lead of two words or more; no word of it is printed anywhere in the book (R3 of handoff 22), and its scene `shown` line says it is not the book. Both answer `context_guess`; `said_lead_in` is the card's one `unanswered` miss.
- **Demanded by:** handoff 22 L3.
- **Evidence:** `qa/eval-reports/levers-literacy-L3-2026-09-28.md`.
- **Probe:** `npm test -- InteractiveBook.levers.workspace`.

## Conflicts

None open.

## Catalog projection

- **description / constraints:** corrected 2026-10-20: the DI-clock sentence is gone (the tutor teaches in its own words; the page checks the tap) and "requires a microphone" is said of Read Together only.
- **evalModes:** faithful.
- **tutoring / teachingWorkspace prose / audioInput:** deleted 2026-10-20; `...bossEntry(interactiveBookCard)` is the wiring.

## Changelog

- 2026-10-20 — boss migration (`/add-live-tutor-tools`, wave 2): script + workspace module merged into `interactiveBookDomain.ts` (cue builders, judging and tap contracts deleted); R3-R9, R11, R12 re-based onto the boss (key via `spokenKeyText`, never-say rules as scene `constraints`, Pip from the runner, levers as a lever set; `model_page` now type `model` with tier support, the generator stamps `supportTier` and changes no content). DI_PORTS row and live adapter deleted. No requirement dropped.

- 2026-09-28 — R12 added (handoff 22 L3); R11's "read-focus-word declares none" is superseded.

- 2026-09-28 — R11 added (find-feature levers, handoff 22 L1). The draft's `outline_parts` was dropped: it outlined the item page's own parts.

- 2026-09-28 — derived (initial), step 1 of handoff 22 L1. 10 requirements (all OBSERVED), 0 conflicts. Authored map 0/65; calibration not read (auth). Lever notes for the `find-feature` slice: help `model_page` keeps R4 if it is a separate small page (not the item's view) whose outlined parts are labelled by picture/icon, uses none of the book's printed texts, never outlines or recolours the item view's hotspots, and its parts are not buttons that reach `handleHotspotTap` and do not reuse `part-<id>`/`page` Pip ids (R9). A model cover (title, author) is needed for cover items. Simplify `two_part_page` keeps R2-R5 if it is an ungraded practice view out of metrics (R8), its two parts are the target kind plus one far kind, and the scene's `shown` line (currently hard-coded "heading, picture caption and page number") says only the two parts shown. Cover items already have exactly two parts, so `two_part_page` changes nothing there. On a page, heading and page number share the top row, so "far" is the caption for a heading or page-number target and the heading or page number for a caption target. A practice view with its own texts needs its own tap key; `interactiveBookMiss` then names the other kind as usual.
