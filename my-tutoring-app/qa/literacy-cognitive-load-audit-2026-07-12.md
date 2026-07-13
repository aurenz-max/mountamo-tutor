# Literacy Primitive Cognitive-Load Audit — 2026-07-12

Audit of 12 K-2 literacy primitives (11 agent-swept + PhonicsBlender read directly) for
cognitive load and design intuitiveness for ages 4–8 (many pre-readers). Triggered by
comparison against an external artifact with a notably simpler design language.

Dimensions: (1) written text a pre-reader must read to succeed, (2) simultaneous
interactive elements, (3) steps per item, (4) interaction metaphor directness,
(5) feedback locality, (6) visual/chrome complexity, plus whether each on-screen
instruction has a spoken twin via the Gemini Live tutor.

---

## Recurring load patterns (cross-primitive)

1. **Text-gated progress.** Load-bearing instructions ("Ready to Build!", "Check
   Spelling", "Tap a word, then tap the bucket it belongs in:") rendered as English
   text a pre-reader cannot decode. Some have no spoken twin at all (WordSorter's
   per-challenge `instruction`; DecodableReader's MC options).
2. **Select-then-confirm protocols.** Explicit Check buttons (PhonicsBlender build,
   CvcSpeller spell-word, LetterSpotter find-it, DecodableReader) and worse, the
   two-tap "tap to hear, tap again to choose" model (LetterSoundLink, instruction at
   unreadable `text-[10px]`). Violates a young child's tap=choose expectation.
3. **Adult chrome.** Grade/pattern badges, word counters, phase steppers, "N wrong"
   counters (WordSorter), score-breakdown ledgers + stat tiles (DecodableReader),
   Show/Hide Colors toggles, start-gate paragraphs, voice-consent screens.
4. **Dense simultaneous elements.** CvcSpeller spell-word ≈12+ interactive elements;
   WordSorter match-pairs two 8–10 item text columns; LetterSpotter find-it 9–16
   near-identical letter tiles; DecodableReader 12–30+ word-buttons + legend + toggles.
5. **Abstract symbol surfaces.** Slash-phoneme notation (/k/) as tappable chips
   (SoundSwap, PhonemeExplorer segment mode's pure-notation options that differ only
   in grouping); raw dev slugs leaking to the child (`short-a` in CvcSpeller).
6. **Text-primary answer options.** RhymeStudio and WordFlip tap-mode options are
   written words; WordSorter buckets are text-only categories.
7. **Fragile feedback.** Transient text that auto-clears in 2s (WordSorter);
   quantitative error text ("you missed 2 and picked 1 wrong", LetterSpotter);
   positional-vocabulary errors ("Check the middle and end sounds", CvcSpeller).
8. **Typing.** DecodableReader short-answer mode uses a free-text LuminaInput — the
   only keyboard path in the set; inappropriate K-2.

## Ranked: highest load relative to age

1. **DecodableReader** — connected-text decoding + MC-text/typing answers, weakest
   audio scaffolding (passage never auto-read, options never spoken), most adult
   chrome (stepper, legend, toggles, +70/+30 score ledger). Reads as an LMS worksheet.
2. **WordSorter** — most simultaneous elements, 2 taps × many words, text-only
   categories, "N wrong" counter, 2s transient feedback, correct actions silent by
   design → non-reader largely unscaffolded.
3. **CvcSpeller (spell-word)** — 12+ elements, 4+ ordered actions via abstract
   active-slot cursor, Hear It/Stretch It adult control bar, dev-slug leak.
4. **LetterSoundLink** — two-tap select protocol explained in 10px text; mode
   switches + added spoken beat compound it.
   (Runner-up: LetterSpotter find-it mode.)
5. **PhonicsBlender** (direct read) — 3-phase stepper (Listen→Build→Blend), 4+
   labeled-button taps per word, header w/ 3 badges + counter row; strong tutor
   speech mitigates, but visual protocol is heavy for K.

## Cleanest — internal models to copy

1. **StoryTalk** — picture-PRIMARY options (emoji text-5xl, word caption subtle),
   story text HIDDEN while answering (audio-only stimulus, answer-leak gate),
   one-tap-or-one-spoken-word, "Hear it again" replay. Explicitly pre-reader-shaped.
2. **SyllableClapper** — concrete physical "Clap!" metaphor, spoken stimulus, ~5
   regions, feedback = word splits into tappable colored syllable tiles.
3. **WordFlip** (honorable) — self-evident counted-picture frame (🐕 → 🐕🐕🐕),
   voice-first, auto-advance; minor adult chrome in voice-consent start screen.

## Distilled pre-reader design contract (draft — not yet ratified)

- Audio is the instruction channel; on-screen text never gates progress.
- Tap = choose. No two-tap protocols; no Check button where a selection is atomic.
- Pictures are the answer surface; words are captions.
- One thing to do per screen; ≤ ~5 interactive elements visible.
- Feedback lands on the touched object instantly; never transient-text-only.
- No typing K-2. No phoneme slash-notation as the only representation.
- Chrome: no badges/counters/steppers/stat panels in the child's field; no
  start-gate paragraphs.

---

## External comparison artifact — "Word Family Spinner" (code + screenshot provided 2026-07-12)

Three wooden blocks on a brass rod; rime "-AT" static, onset block is a CSS-3D cube
the child taps to spin (C→B→M→H). Word spoken (SpeechSynthesis) on every landing;
wood-click SFX (Tone.js MembraneSynth). One hint line that permanently disappears
after first touch. Content split: hand-crafted vessel + `CONTENT = {rime, onsets}`
explicitly the per-lesson generated part — compatible with our Gemini generator
pattern as-is.

### Themes extracted (deltas vs our primitives)

1. **One object, one action, zero chrome.** Exactly 1 interactive element; no header,
   badges, counter, stepper, Check, or feedback card. Set dressing (lantern, gears)
   is non-interactive place-making.
2. **Instruction dies after first touch** (`!touched` gate) — affordance carries the
   load after; ours keep persistent instruction panels all session.
3. **Pedagogy in the physics**: static rime + spinning onset embodies "word family"
   with no explanation. Direct-manipulation-first applied to literacy.
4. **Feedback in the object + voice, never text.** No wrong answers — every spin
   makes a real word; instrument, not quiz.
5. **Warm diegetic toy aesthetic** (wood/brass/lantern) vs our adult glass slate-900.
   The kit look itself is an intuitiveness tax for ages 4-8.
6. **Lacks measurement** — resolved by hiding assessment in the mechanics: tutor asks
   "spin until you make *bat*", code observes the landed face; production mode via
   spoken judge. Zero added UI (consistent with silent-response-time doctrine).

### Sharpened improvement thesis

1. Ratify pre-reader contract + artifact additions (single-object stage,
   vanishing instruction, feedback-in-object, assessment-in-mechanics, toy warmth).
2. K-2 "stage" presentation mode: full-bleed scene replacing LuminaCard chrome;
   progress/session data outside the child's field. One shared fix for the
   adult-chrome tax across all 12 primitives.
3. Rebuild worst offenders as instruments-with-hidden-assessment rather than
   decluttering their quiz UIs (spinner mechanics > trimmed SoundSwap for onset
   substitution).

Status: audit + artifact analysis complete — no fixes applied; contract unratified.
