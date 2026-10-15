# interactive-book read-focus-word: measured, left on the model (2026-10-14)

**Verdict: not a fit for a word space (user ruling 2026-10-14).** The glowing word is one word inside a book
the model writes about a topic. It has to fit the book, and in the oral cloze the sentence around it already
sets how hard it is to read. Fixing the words in code and asking the model to build a book around them was
built and probed: 18 of 18 scoped runs kept the assigned words. The user ruled the modality a poor fit:
the generator trusts Gemini's words, and the code was reverted.

Raw output kept for reference: `before.txt`, `after.txt` (the reverted build), `run-probe.sh`.

## What the probe showed (model path, still true)

- The tier changes nothing: word difficulty comes from grade only (contract R1).
- A short-a lesson glowed hot, rats and vat. A digraph lesson glowed hand, snack, crab, engine, shore and
  thorns. cat came first in every short-a run.

If those leaks matter later, the lighter fix is a code check on the model's focus words against the
lesson's letter scope (`decodableWords`), with a retry. Code would not pick the words.
