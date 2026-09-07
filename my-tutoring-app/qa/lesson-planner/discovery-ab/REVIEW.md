# Semantic discovery pilot review

Semantic discovery repaired the sea-otter profile miss and generalized to other topics, but it is not ready to replace lexical discovery by itself. Eighteen live plans compared nine paired topics with the same 201-entry catalog, fixture hashes, generation model (`gemini-3.8-flash`), settings and downstream prompt templates. These are single samples per arm, not a statistical estimate of lesson quality.

| Measure | Lexical | Semantic |
|---|---:|---:|
| Expected candidates available | 11/18 | 16/18 |
| Structurally valid plans | 8/9 | 8/9 |
| Median planning latency | 10,935 ms | 11,469 ms |
| Median online latency including topic embedding/ranking | 10,935 ms | 11,746 ms |
| Median topic embedding latency | 0 ms | 268 ms |

The 18 expectations are small, human-authored recall labels, frozen before this run and excluded from planner inputs. They are not exhaustive relevance judgments or required final selections. Volcanoes contributes an automatically retained general-purpose tool, so that expectation is uninformative about specialist retrieval. Candidate recall excluding volcanoes is 10/17 versus 15/17. Broader candidate pools and sampling variation can affect planning time; the 811 ms median difference is not solely embedding overhead. First index construction took 1,730 ms; subsequent runs reused it. Online timing excludes process setup, cache loading and initial artifact serialization.

## Concrete changes

- **Sea otters:** lexical found none of species-profile, organism-card, habitat-diorama. Semantic found all three, ranked species-profile first, and selected species-profile plus habitat-diorama observe/connect, fast-fact recognize, and knowledge-check recall. The plan ran to 17 minutes and invented `time_budget_headroom` as a requirement ID, so it failed validation. Discovery succeeded; final composition still needs work.
- **Excavators:** lexical found all four expected candidates; semantic found three. It selected the excavator simulator, dump-truck loader, comparison panel, how-it-works sequence and knowledge check. Machine-profile was available but not selected. Hydraulics ranked 13th and was excluded by the shortlist. This is a retrieval regression, not evidence that hydraulics is unsuitable.
- **Volcanoes:** no demonstrated specialist recall gain. Semantic selected a custom visual and comparison panel among general tools. Richer-looking output alone does not establish a better lesson.
- **Solar system:** both found the two expected specialists. Semantic added orbit-mechanics-lab to solar-system-explorer. The catalog permits K use, but its Earth-centered rocket activity needs an explicit bridge to the arc's planets-around-the-Sun objective; the rendered lesson was not checked.
- **Phonics:** both found letter-sound-link and phoneme-explorer. Semantic instead selected di-letter-sounds, phonics-blender, cvc-speller and word-workout. Its declared gap acknowledges that di-letter-sounds excludes stop consonants; catalog availability alone does not establish coverage of every requested letter or independent decoding. The plan's broader claim about inability to produce stop consonants should not be treated as a verified pedagogical fact.
- **Counting:** both found counting-board. Semantic selected counting-board twice and ten-frame twice, plus brief and knowledge check. Repeated primitives may serve different purposes, but distinct learning value and fresh evidence still require lesson review.
- **New probe—Butterflies:** recall rose from 0/2 to 2/2; the semantic lesson selected life-cycle-sequencer instead of depending on generic visuals for the growth sequence.
- **New probe—Bicycles:** machine-profile was available in both arms but selected only in semantic, alongside gear-train-builder. The semantic plan ran to 18 minutes; the existing validator treats duration overruns as warnings, so “generated” does not mean it met the budget.
- **New probe—Emperor penguins:** species-profile ranked first and was selected. Habitat-diorama ranked 24th and remained absent. Recall improved from 0/2 to 1/2.

## What the implementation establishes

The new path builds source-derived discovery cards from catalog descriptions and roles, keeps evaluation modes separate, caches document embeddings by content/model/dimensions, embeds the raw topic once, and ranks locally. Both arms retain the same top-ten-plus-role-matches selection algorithm and general teaching/assessment pool. There are no per-topic primitive overrides, generated entity tags, semantic expansion calls, or production changes. Detailed mode metadata still reaches binding/composition unchanged.

This first ablation intentionally tests embeddings of existing descriptions before investing in richer authored metadata. It does not implement the entire proposed capability schema or verify component behavior. The descriptor embedding can still be pulled toward incidental examples, and generic tools currently consume ranking positions despite also being retained automatically.

Saved-ranking sensitivity checks at top 5/10/15/20 recovered hydraulics at 15; penguin habitat remained missing through 20. These checks required no additional API calls and did not generate plans for the larger pools. Increasing the cutoff alone is therefore not an established general fix.

## Next change supported by these findings

Retain semantic retrieval as a candidate source and test a bounded hybrid pool that preserves useful lexical matches. Rank specialists separately from the general pool, and represent distinct teaching capabilities in discovery records so entity identity, habitat, mechanism and process do not compete through one long marketing description. Compare that change against these saved recall cases plus fresh topics before changing production. Resolve budget enforcement and unsupported evidence claims in the composition layer separately, then hydrate lessons for actual coverage QA.

Validation: all 16 focused Node tests pass. All nine A/B pairs passed fixture/catalog/model identity checks. Full results and latency metrics are in [RESULTS.md](RESULTS.md), [summary.json](summary.json), and [metrics.json](metrics.json); each result points to exact immutable prompts, candidate rankings, intermediate arcs, plans and validation findings.
