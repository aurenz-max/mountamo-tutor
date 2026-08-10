# Real lesson-order audit — the objective layer was the bug — 2026-08-08

**The reported defect is fixed, at the layer that caused it.** A K "counting to 10"
lesson opened on a grid of written numerals. That was not a within-block ordering
problem and not an eval-mode problem — it was the OBJECTIVE order, produced by the
Bloom rule in the curator brief.

Instrument: `npm run audit:order -- <port> 3` — 12 topics × 3 lessons, absolute
teacher-judgment of real shipped lessons. No arms, no variants.

---

## The finding

Bloom ranks the **cognitive operation**. It says nothing about whether the child is
handling a thing or the symbol for the thing. `identify`(1) sorts ahead of `apply`(3),
so "recognize the numerals 1-10" was forced ahead of "count a group of objects" in
every counting lesson. The opener was just the first activity of that first objective.

The two axes agree in engineering — naming visible parts of a machine is Bloom-1 *and*
concrete — which is why those lessons already scored well. They conflict in K number
and early reading, and Bloom won because it was the only ordering rule in the prompt.

Making the Bloom rule *harder* earlier this session (83% → 100% monotone) removed the
model's remaining room to deviate. **100% Bloom-monotone was never the goal; it was a
proxy that pointed away from the goal.**

## The fix

`gemini-curator-brief.ts` — the objective ORDERING rule becomes three ranked rules:

1. **PREREQUISITE FIRST** — Y before X when X cannot be done without Y, whatever the
   verbs. (Letter-sounds before blending; cardinality before counting-to-find-how-many.)
2. **CONCRETE BEFORE THE SYMBOL FOR IT** — with no prerequisite between them, real or
   pictured things before the written notation for the same content, *even at a higher
   Bloom level*. Explicitly silent when the topic has no symbol/thing split.
3. **Otherwise NON-DECREASING BLOOM** — the old rule, now the tiebreak.

Plus the K-2 calibration line, which used to say "focus on identify/explain" — the
verbs that lean abstract — now says lead with the objective where the child DOES
something with real things.

**The priority order between 1 and 2 was itself measured.** Shipping concrete-first
above prerequisite-first put `[apply → identify]` on a CVC lesson, and the judge caught
it: *"Students should identify individual letters and their sounds before reading and
spelling full CVC words."* Blending requires letter-sounds. Swapping them fixed it and
improved every other number below.

---

## Numbers

Same 12 topics, same judge, same prompt for the judge. Only the curator-brief ordering
rule changed between columns.

| | baseline (HEAD) | concrete-first | **prereq-first (shipped)** |
|---|---|---|---|
| mean sequence score | 3.25/5 | 3.83/5 | **3.89/5** |
| wrong opening activity | 39% | 29% | **22%** |
| symbol before the concrete | 42% | 23% | **17%** |
| objective order judged wrong | 31% | 17% | 19% |
| **math** score | 2.67/5 | 3.86/5 | **3.93/5** |
| math — wrong opener | 53% | 29% | **13%** |
| math — symbol-first | 67% | 14% | **7%** |
| science | 3.67/5 | 4.67/5 | 4.00/5 |
| phonics | 3.22/5 | 3.00/5 | 3.22/5 |
| **engineering (CONTROL)** | 4.33/5 | 4.17/5 | **4.67/5, 0% bad opener** |

The origin lesson, before and after:

```
counting to 10  BEFORE:  [1/5] [1/5] [1/5]  opens hundreds-chart  objs [identify → apply]
counting to 10  AFTER:   [5/5] [5/5] [4/5]  opens counting-board  objs [apply → identify]
```

`hundreds-chart → counting-board`, which appeared 6× in the baseline swap table, is
gone. The engineering control still emits `[identify → explain → apply]` — rule 2 is
correctly silent where there is no symbol/thing split, and Bloom still governs.

---

## What is still open

**Phonics, 3.22/5 with a 56% wrong-opener rate — and it is NOT objective ordering.**
The objective order is fine there; the churn is over *which primitive opens*. The judge
contradicts itself across runs on the same topic:

```
1x  phoneme-explorer  →  di-letter-sounds
1x  di-letter-sounds  →  phoneme-explorer
```

Two defensible openers, so part of that 56% is judge ambiguity rather than defect. The
part that is real: `vocabulary-explorer` opening a sight-word lesson with definitions
and etymology for pre-readers (flagged in the baseline too, so it predates this work).
That is a **primitive-selection / reader-fit** question — executor `/reader-fit` or
`/topic-fidelity` — not an ordering one. Do not reopen ordering to chase it.

`dependency violations` sits at 58% and barely moved. Unexamined — it may be the judge
being maximalist about prerequisites within a block rather than a real defect. Needs a
look before anyone treats it as a target.

## Method notes

- **Absolute judgment, not A/B.** The first attempt at this question compared two
  variants of our own resolver prompt. Both arms shared the same wrong objective order,
  so neither could see it. When the question is "is what ships any good", an A/B of two
  candidate fixes cannot answer it.
- **Keep a control domain in the set.** Engineering is where the ordering already
  worked; a rule that improved math while breaking it would have been a bad trade, and
  the control is what makes that visible in one line.
- **A metric can point away from the goal.** `audit:bloom-order` reports Bloom
  monotonicity. The shipped fix deliberately *reduces* it. Read `audit:order` as the
  authority on ordering; bloom-order is now only a descriptor of one input.
