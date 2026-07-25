# Eval Report: di-sentence-reading — 2026-07-25

L0 birth QA. Real-Gemini `eval-test` through the live registry/generator path,
with the Required Fields Contract and the pack's hard scope rules asserted
**programmatically** rather than read by eye (harness:
`scratchpad/qa-sentence-reading2.mjs`, checks listed below).

## Results

| Run | Topic | Grade | Status | Issues |
|-----|-------|-------|--------|--------|
| generic ×3 | reading simple sentences | G1 | **PASS** | — |
| short a | reading short a sentences | G1 | **PASS** | — |
| short e | reading short e sentences | G1 | **PASS** | — |
| short i | reading short i sentences | G1 | **PASS** | — |
| short o | reading short o sentences | G1 | **PASS** | — |
| short u | reading short u sentences | G2 | **PASS** | — |
| sight words | sight word sentences | G1 | **PASS** | — |
| grade ceiling | reading simple sentences | **K** | **PASS** | — |
| "short" ask | reading short simple sentences | G1 | **PASS** | — |

**11 runs, 0 issues.** (One run in the first sweep failed with an HTML body — the
dev server recompiling immediately after a source edit. Re-run 3× clean; not a
generator defect.)

## Checks applied (all programmatic, all runs)

| Rule | Assertion |
|---|---|
| G1 required fields | every challenge has `id`, `challengeType='read_sentence'`, non-empty `text`, numeric `wordCount`, non-empty `asrAliases` |
| G1 unique ids | no duplicate `id` (they are React keys + the per-challenge reset dependency) |
| G2 reconstruction | n/a — Fork A, Gemini emits no per-challenge content |
| G3 mode differentiation | n/a at birth — one challengeType |
| **G4 answer derivability** | `wordCount` **recomputed from `text`** and compared; a mismatch fails the run |
| **G5 fallback / leak audit** | the wrapper (`title` + `description`) must not contain any 3-word run from any selected sentence |
| **Benched scope** | every sentence 3-8 words — the 8-word ceiling the sitting proved |
| **Sentinel safety** (gate 2) | no sentence opens with "Yes" or contains "my turn" |
| Terminal punctuation | every sentence ends `[.!?]` — every spoken line interpolates it and appends no period of its own |
| Variance | no duplicate sentence within a session |
| Teaching order | word counts ascending (short → long, the order the bench ran) |
| Grade ceiling | a K session serves nothing over 6 words |
| "short sentences" ask | narrows to ≤5 words |
| **Phonics purity** | for a "short <v>" objective, every sentence's vowel tags ⊆ {v} |

## One real issue found and fixed during QA

**Phonics scope was overlap, not purity (topic-fidelity gap).** The first sweep
passed every automated check, but reading the actual content showed the short-a
run serving *"Sam has a red cup."* (vowels a, e, u) and *"The red hen ran to the
pen."* (e, a) — sentences that merely **contain** /a/. di-word-reading's rule is
hard: a short-a objective binds every word to that vowel.

Fixed by making `idsForVowels` support a `pure` mode (every content-word vowel ⊆
the scoped set) and having the generator prefer the pure pool, widening to
overlap only if pure cannot fill the session. Connected text cannot always be
monovocalic — a sentence needs function words — so the fallback stays, but it is
now a fallback rather than the default. The menu carries ≥4 pure sentences for
all five short vowels, so in practice every vowel-scoped session is now pure:

| Scope | Served |
|---|---|
| short a | The rat ran. / Can the cat nap? / Sam has a hat. / The cat sat on a mat. |
| short e | Get the net. / My ball is red. / Ben has a red pen. / The hen is in the pen. |
| short i | The pin is big. / The pig can dig. / Did the pig dig a pit? / I can see the big pig. |
| short o | The dog is hot. / Mom got a pot. / The dog can hop. / The dog sat on a log. |
| short u | The sun is up. / The pup can run. / A bug is in the cup. / We go up and we go down. |

Also fixed: menu key `pin-lip` named a word its sentence does not contain
(*"The pin is big."*) → renamed `pin-big`, since the key appears in the challenge
`id` and therefore in stored outcome records.

## Observation carried to the birth certificate (not a defect)

**Session content is stable across repeat runs on the same objective** — three
generic G1 runs returned near-identical sets. This is structured-output
convergence (PRD §5 rule 2): the sentences are code-owned, but the *selection* is
the model's, and selection is convergent. Both sibling reading packs behave the
same way. For DI it is arguably correct (distributed review of the same decodable
text is real DISTAR practice), and within a lesson it is invisible. It becomes a
real question at `sentence_review` — queued as an `/add-eval-modes` input rather
than solved here, so the family does not diverge on one pack's say-so.

## Gates

- `npm run typecheck:lumina` — **0 errors** in `components/lumina/`
- full `tsc --noEmit` — 805 errors, **0 on the Lumina surface** (all pre-existing, in
  the legacy graveyard: tutoring/, lib/, practice/, gemini-tutor/)
- `npm test` — **936/936** passing, 88 files (includes the intent-contract ledger
  that asserts every generator is context-native — the new one registers via
  `registerContextGenerator`)
- backend row added to `problem_type_registry.py` (`read_sentence` β3.0), mirroring
  the catalog

## Curriculum home

**MATCH at both target grades** — G1 `LA003-01 Oral Reading Accuracy` (0.824),
G2 `LA001-05 Reading Fluency` (0.807). Report:
`qa/curriculum-fit/di-sentence-reading-2026-07-25.md`.
