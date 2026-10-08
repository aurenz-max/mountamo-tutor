# Grade 2 affix building in word-builder

Curriculum IDs: LA001-03-c (LANGUAGE_ARTS, grade 2). Source: design review la-g2-2026-10-07.

## Learning goal and gap

Grade 2 readers (LANGUAGE_ARTS, unit LA001 Reading Foundations, skill LA001-03 Multi-Syllable Words) learn that a prefix or suffix changes a base word in a predictable way.

- **LA001-03-c:** "Students analyze words with affixes by identifying and attaching common prefixes and suffixes to base words. Focus: Decoding words using knowledge of prefixes (un-, re-, pre-) and suffixes (-ed, -ing, -ly). Examples: unhappy, rewrite, preview, jumped, playing, quickly, redo... Constraints: Highlight the base word and affix in different colors."

word-builder `simple_affix` already shows color-coded prefix, root and suffix cards with meanings, and the grade 2 probe drew exactly the curriculum's words (jumped, rewrite, quickly, preview). Two things stop it from serving this objective:
- **Grade floor:** the generator raises simple_affix to grade 3 (gemini-word-builder.ts:197-199), and the hints used grade 3 vocabulary.
- **No building:** the child only SAYS the finished word. The objective asks them to attach the parts.

word-workout `read_inflected` covers -ing and -ed only, from a fixed list of 12 CVC words.

**Recommendation:** extend word-builder rather than build a new primitive.
- Allow a grade 2 band for simple_affix (un, re, pre, ed, ing, ly on familiar bases with no spelling change).
- Add a build response: the child taps or drags parts to make the word for a meaning, and code checks the parts. This matches the open-build roadmap (qa/open-build/ROADMAP.md, OB-3 lists word-builder).

## Essential behavior

- **Build:** the child sees a meaning ("to do it again") and a board of parts, and makes the word (re + do).
- **Many correct builds where honest:** for "something you can do again", redo, replay and rewrite all count.
- **Read back:** after building, the child reads the word and the tutor names what the affix changed.

## Worked example

- **Target:** "not happy".
  - Success: un + happy.
  - Misconception: happy + ly. A real affix, but the wrong meaning.
- **Target:** "jumped in the past".
  - Success: jump + ed.
  - Misconception: jump + ing. Wrong time.

## Evidence of success

- **Independent evidence:** builds the right parts for fresh meanings without the finished word shown, across both prefixes and suffixes.
- **Should not earn credit:** a word built by trying every part (watch the attempt count), or a nonsense combination.
- **Uncertain cases:** decide whether attaching parts that change the spelling (hop + ing) belongs in grade 2.

## Constraints and open questions

- The current grade 3 floor exists for a reason (the parts board is printed text). Check the reader-fit record before lowering it, and keep grade 3+ behavior unchanged (contract-first: fork by band).
- Base words must be decodable at grade 2.

## Handoff

Read the current guidance (/add-eval-modes build-mode reference, the word-builder contract, reader-fit notes) and choose the band mechanism, response form and scoring. Build and verify with your own process.
