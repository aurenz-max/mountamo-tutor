# Curriculum-Fit: di-sentence-reading — 2026-07-25

**Domain → Subject:** di → LANGUAGE_ARTS (`subject_for_domain('di')`; no per-primitive override needed — unlike di-math-facts, this pack IS language arts)
**Query (embedded):** "Live-judged Direct Instruction SENTENCE READING (connected text): the tutor models a printed short sentence read fluentl…"

## Results

| Grade | Verdict | Best cosine | Coherence | Matched skill |
|-------|---------|-------------|-----------|---------------|
| K | ABSTAIN (diffuse) | 0.793 | 2/5 | — (vote-split across sibling CVC families; see below) |
| **1** | **MATCH** | **0.824** | 3/5 | **LA003-01 "Oral Reading Accuracy"** — *Self-correct reading miscues by re-reading* |
| **2** | **MATCH** | **0.807** | 4/5 | **LA001-05 "Reading Fluency"** — *Students read short, phonetically controlled…* |

**Both target grades have a clear curriculum home.** The pack was scoped G1-2 by the
BACKLOG fork ruling, and retrieval independently agrees at both.

### Grade 1 — the match is unusually on-the-nose
The top TWO hits are both `LA003-01 Oral Reading Accuracy`:
1. 0.824 — *"Self-correct reading miscues by re-reading sentences"*
2. 0.805 — *"Read grade-level decodable passages aloud"*

That first subskill is a near-verbatim statement of the pack's judging contract, which
explicitly affirms a read where *"the learner catches and fixes their own slip"*. The
bench sitting observed exactly this behaviour (both corrections self-repaired on the
first retry), so the primitive, the script, and the curriculum skill agree.
Runners-up `LA003-02 Reading Rate Improvement` (0.784) and `LA001-07 Sight Words`
(0.779) are both legitimate adjacent homes.

### Grade 2 — and a confirmation of the read-aloud-studio fork
Top-1 `LA001-05 Reading Fluency` @ 0.807, 4/5 coherent. Two of its sibling subskills
are worth naming, because they are the ones that motivated this pack existing at all:
- #3 (0.774) *"Students record themselves reading aloud…"*
- #4 (0.769) *"Students identify and correct their own word [errors]"*

That is precisely read-aloud-studio's self-assessment territory. Retrieval placing the
JUDGED pack on the same skill family is the evidence behind the fork ruling: the skill
is real and currently served by a primitive that grades nothing.

## Diagnosis & Recommendation

**No action required.** Both target grades MATCH.

- **Kindergarten — ABSTAIN (diffuse) is the CORRECT outcome, not a gap.** best=0.793 but
  only 2/5 coherent. The plateau is a vote-split between two sibling families:
  `Decoding CVC Words` (0.793 / 0.761 — word-level, which is **di-word-reading's** home,
  correctly) and `Application of CVC Word Knowledge` (0.781 / 0.745). The same shape
  di-word-reading reported at K.
- **Worth recording for a later widening decision:** the K curriculum *does* carry a
  sentence-reading skill — `Application of CVC Word Knowledge → "Read CVC Words in
  Decodable Phrases & Sentences"` @ 0.781, ranked #2. So a K home EXISTS if the pack is
  ever widened. It was deliberately not targeted here (the fork ruling scopes this pack
  G1-2, and the description names grades 1-2, which correctly biases retrieval away from
  K). Widening would be a scope decision plus a word-ceiling change — **not** a
  description tweak, and not this slice's call. The generator already narrows K to a
  6-word ceiling so a topic-driven K lesson that reaches the pack degrades safely.
