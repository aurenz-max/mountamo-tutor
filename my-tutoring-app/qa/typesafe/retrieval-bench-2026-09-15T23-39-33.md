# Objective → subskill retrieval: embeddings vs TypeSafe — 74 objectives, 24 subskills

source bench-2026-09-16T03-00-59.json · rerank K=20 · embedding model gemini-embedding-2-preview · TypeSafe jev-latest · TypeSafe errors 0

| arm | n | subskill@1 | skill@1 | unit@1 | notes |
|---|---|---|---|---|---|
| E1 | 74 | 72% | 88% | 91% | cosine argmax, no gate · truth mean rank 1.8 |
| EP | 74 | 50% | 65% | 76% | production gate · abstains 20% · when it matches: subskill 63%, skill 81% |
| TF | 74 | 72% | 82% | 92% | one Choice over all subskills in the grade (~90 options) |
| TR | 74 | 68% | 80% | 88% | Choice over embedding top-20 + none_of_these · abstains 5% · truth in top-20 100% |
| TH | 74 | 57% | 68% | 82% | skill Choice (~26 options) then subskill Choice — the hierarchical-classification claim |

Latency per objective (ms): embed 193 · production probe 197 · TypeSafe shared request (TF+TR+TH1) 492 · TH step 2 369. TypeSafe input tokens per shared request: 8019.

EP counts an abstain as wrong at every level; its when-matched columns show precision. TR's none_of_these counts as wrong. Ground truth = the subskill the objective was written from; a sibling subskill of the same skill is a plausible home, so read skill@1 as the fair comparison.

## Per objective

| subskill (truth) | objective | E1 | EP | TF (p, conf) | TR | TH |
|---|---|---|---|---|---|---|
| OPS002-01-a | Model two-digit numbers using tens rods and ones units on the workbench | ✓ OPS002-01-a | abstain (diffuse) | ✗ NBT002-01-a (0.63, 0.62) | none_of_these | ✗ NBT002-02-b |
| OPS002-01-a | Combine tens with tens and ones with ones to find the total sum | ✓ OPS002-01-a | ✓ OPS002-01-a | ✓ OPS002-01-a (1.0, 1.0) | ✓ OPS002-01-a | ✓ OPS002-01-a |
| OPS002-01-a | Explain how separating tens and ones makes addition easier | ✗ NBT002-02-c | ✗ NBT002-05-a | ✓ OPS002-01-a (0.99, 0.98) | ✓ OPS002-01-a | ✓ OPS002-01-a |
| LA004-01-a | Identify real-world objects and pictures as people, places, or things. | ✓ LA004-01-a | abstain (diffuse) | ✓ LA004-01-a (0.78, 0.77) | ✓ LA004-01-a | ✗ LA005-04-a |
| LA004-01-a | Categorize highlighted words in simple sentences into person, place, or thing. | ✓ LA004-01-a | ✓ LA004-01-a | ✓ LA004-01-a (1.0, 1.0) | ✓ LA004-01-a | ✗ LA005-04-a |
| LA004-01-a | Explain why a selected word belongs to a specific noun category. | ✓ LA004-01-a | abstain (diffuse) | ✗ LA005-07-a (0.67, 0.66) | ✗ LA005-07-a | ✗ LA005-04-a |
| MEAS001-08-B | Demonstrate the difference between filled and empty spaces using two identical c | ~ MEAS001-08-A | ~ MEAS001-08-A | ~ MEAS001-08-A (0.8, 0.78) | ~ MEAS001-08-A | ~ MEAS001-08-A |
| MEAS001-08-B | Compare two identical containers with different amounts using the words 'more' a | ✓ MEAS001-08-B | ✓ MEAS001-08-B | ✓ MEAS001-08-B (1.0, 1.0) | ✓ MEAS001-08-B | ✓ MEAS001-08-B |
| MEAS001-08-B | Explain which container has more and which has less to a friend. | ✓ MEAS001-08-B | ✓ MEAS001-08-B | ✓ MEAS001-08-B (0.87, 0.86) | ✓ MEAS001-08-B | ✓ MEAS001-08-B |
| SS004-04-C | Sort picture cards of everyday items into groups for 'past' and 'present' | ✓ SS004-04-C | ✓ SS004-04-C | ✓ SS004-04-C (0.91, 0.91) | ✓ SS004-04-C | ✓ SS004-04-C |
| SS004-04-C | Identify clues in pictures that show if an object is old or new | ~ SS004-04-A | ~ SS004-04-A | ~ SS004-04-A (0.88, 0.87) | ~ SS004-04-A | ~ SS004-04-A |
| SS004-04-C | Explain why certain objects belong in the past or present | ~ SS004-04-A | ~ SS004-04-A | ✗ SS004-02-A (0.47, 0.46) | ~ SS004-04-D | ~ SS004-04-D |
| SCI004-02-a | Identify different geometric shapes and structures like squares, triangles, and  | ✓ SCI004-02-a | ✗ SCI004-01-a | ✓ SCI004-02-a (0.79, 0.77) | none_of_these | ✗ SCI004-01-a |
| SCI004-02-a | Apply virtual weight to various geometric structures to discover which ones hold | ✓ SCI004-02-a | ✓ SCI004-02-a | ✓ SCI004-02-a (1.0, 1.0) | ✓ SCI004-02-a | ✓ SCI004-02-a |
| SCI004-02-a | Explain how triangle bracing and arches improve structural strength and prevent  | ✓ SCI004-02-a | ✓ SCI004-02-a | ✓ SCI004-02-a (0.99, 0.99) | ✓ SCI004-02-a | ✗ SCI004-01-c |
| SCI001-06-d | Observe how moving a light source changes the position of a shadow on a grid. | ✓ SCI001-06-d | ✓ SCI001-06-d | ✓ SCI001-06-d (1.0, 0.99) | ✓ SCI001-06-d | ✓ SCI001-06-d |
| SCI001-06-d | Predict the direction a shadow will point when the light is placed at the top, s | ✓ SCI001-06-d | ✓ SCI001-06-d | ✓ SCI001-06-d (1.0, 1.0) | ✓ SCI001-06-d | ✓ SCI001-06-d |
| SCI001-06-d | Explain the rule that shadows always point away from the light source. | ✓ SCI001-06-d | ✓ SCI001-06-d | ✓ SCI001-06-d (1.0, 1.0) | ✓ SCI001-06-d | ✓ SCI001-06-d |
| GEOM004-03-a | Explore different physical triangles by rotating them and examining their corner | ✓ GEOM004-03-a | ✓ GEOM004-03-a | ✓ GEOM004-03-a (0.5, 0.49) | ✗ GEOM004-01-b | ✗ MEAS004-06-e |
| GEOM004-03-a | Identify right, acute, and obtuse triangles based on their internal angle measur | ✓ GEOM004-03-a | ✓ GEOM004-03-a | ✓ GEOM004-03-a (0.99, 0.99) | ✓ GEOM004-03-a | ✓ GEOM004-03-a |
| GEOM004-03-a | Sort various triangles into the correct bins according to their angle types | ✓ GEOM004-03-a | ✓ GEOM004-03-a | ✓ GEOM004-03-a (1.0, 1.0) | ✓ GEOM004-03-a | ✓ GEOM004-03-a |
| LA006-02-c | Identify the base root word inside everyday word families | ✓ LA006-02-c | ✓ LA006-02-c | ✓ LA006-02-c (1.0, 1.0) | ✓ LA006-02-c | ✓ LA006-02-c |
| LA006-02-c | Explain how adding different word parts changes a word's meaning while keeping t | ~ LA006-02-b | ~ LA006-02-b | ✓ LA006-02-c (0.64, 0.62) | ✓ LA006-02-c | ✓ LA006-02-c |
| LA006-02-c | Connect related words built from the same root to show their shared meaning | ✓ LA006-02-c | ✓ LA006-02-c | ✓ LA006-02-c (1.0, 1.0) | ✓ LA006-02-c | ✓ LA006-02-c |
| SS001-04-a | Compare everyday situations to determine where specific rules apply versus where | ✓ SS001-04-a | ✓ SS001-04-a | ✓ SS001-04-a (1.0, 1.0) | ✓ SS001-04-a | ✓ SS001-04-a |
| SS001-04-a | Identify the authority figures and purposes behind different rules and laws | ~ SS001-04-b | ~ SS001-04-b | ✓ SS001-04-a (0.53, 0.51) | ✓ SS001-04-a | ✓ SS001-04-a |
| SS001-04-a | Apply sorting criteria to categorize various guidelines into classroom rules or  | ✓ SS001-04-a | ✓ SS001-04-a | ✓ SS001-04-a (1.0, 1.0) | ✓ SS001-04-a | ✓ SS001-04-a |
| LA004-02-G | Identify action words and naming words in a simple sentence | ~ LA004-02-A | ✗ LA004-06-I | ✗ LA004-01-A (0.59, 0.58) | ✗ LA004-01-A | ✗ LA004-01-A |
| LA004-02-G | Apply descriptive words to expand a basic sentence | ✓ LA004-02-G | ✓ LA004-02-G | ✓ LA004-02-G (0.99, 0.99) | ✓ LA004-02-G | ✓ LA004-02-G |
| MEAS001-05-b | Count the objects in each of three pre-sorted groups of items to find the total  | ✓ MEAS001-05-b | ✓ MEAS001-05-b | ✓ MEAS001-05-b (0.98, 0.98) | ✓ MEAS001-05-b | ✓ MEAS001-05-b |
| MEAS001-05-b | Compare the counts of the three categories to see which group has the most or le | ✓ MEAS001-05-b | ✗ MEAS001-06-b | ✗ MEAS001-06-c (0.59, 0.58) | ✗ MEAS001-06-c | ✗ MEAS001-06-b |
| MEAS001-05-b | Explain what each category count tells us about the sorted collection | ✓ MEAS001-05-b | ✓ MEAS001-05-b | ✗ MEAS001-06-a (0.73, 0.71) | ✗ MEAS001-06-a | ✗ MEAS001-06-a |
| SCI002-02-A | Sort real objects and pictures into groups of living and non-living things | ✗ SCI001-02-A | abstain (diffuse) | ✓ SCI002-02-A (1.0, 0.99) | ✓ SCI002-02-A | ✗ SCI002-01-G |
| SCI002-02-A | Identify what living things need to grow and stay healthy | ✗ SCI002-01-B | ✗ SCI002-01-B | ✗ SCI002-01-B (0.72, 0.71) | ✗ SCI002-01-B | ✗ SCI002-01-B |
| SCI002-02-A | Explain why certain items in our classroom are non-living | ✓ SCI002-02-A | ✗ SCI002-01-B | ✓ SCI002-02-A (1.0, 1.0) | ✓ SCI002-02-A | ✗ SCI002-01-B |
| LA006-02-a | Identify the base word within complex words that have prefixes and suffixes [ide | ✓ LA006-02-a | ✓ LA006-02-a | ✓ LA006-02-a (1.0, 1.0) | ✓ LA006-02-a | ✓ LA006-02-a |
| LA006-02-a | Explain how prefixes change the meaning of a base word [explain] | ✓ LA006-02-a | ✓ LA006-02-a | ✓ LA006-02-a (1.0, 1.0) | ✓ LA006-02-a | ✓ LA006-02-a |
| LA006-02-a | Explain how suffixes change the meaning or function of a base word [explain] | ✓ LA006-02-a | ✓ LA006-02-a | ✓ LA006-02-a (1.0, 1.0) | ✓ LA006-02-a | ✓ LA006-02-a |
| LA006-02-a | Construct new words by combining base words with high-grade prefixes and suffixe | ✓ LA006-02-a | ✓ LA006-02-a | ✓ LA006-02-a (0.99, 0.99) | ✓ LA006-02-a | ✓ LA006-02-a |
| LA002-03-a | Identify the characters and setting in a simple story scenario | ✓ LA002-03-a | abstain (diffuse) | ✓ LA002-03-a (0.77, 0.75) | ✓ LA002-03-a | ✗ LA006-04-a |
| LA002-03-a | Explain the key events of a story in chronological order | ✗ LA006-01-a | abstain (diffuse) | ✗ LA006-01-a (0.81, 0.8) | ✗ LA006-01-a | ✗ LA006-01-a |
| LA002-03-a | Create an interactive storyboard to outline a new story | ✓ LA002-03-a | abstain (diffuse) | ✓ LA002-03-a (0.98, 0.98) | ✓ LA002-03-a | ✓ LA002-03-a |
| NBT003-02-d | Compare base-ten blocks or place value charts to see which quantity is larger be | ✓ NBT003-02-d | abstain (diffuse) | ✓ NBT003-02-d (0.83, 0.82) | none_of_these | ✓ NBT003-02-d |
| NBT003-02-d | Identify the hundreds, tens, and ones digits in two different three-digit number | ~ NBT003-02-a | ~ NBT003-02-a | ~ NBT003-02-a (1.0, 1.0) | ~ NBT003-02-a | ~ NBT003-02-a |
| NBT003-02-d | Explain why a number with a larger hundreds digit is always greater than one wit | ✓ NBT003-02-d | ✓ NBT003-02-d | ✓ NBT003-02-d (0.74, 0.72) | ✓ NBT003-02-d | ✓ NBT003-02-d |
| NBT003-02-d | Apply the greater than (>), less than (<), and equal to (=) symbols correctly be | ✓ NBT003-02-d | ✓ NBT003-02-d | ✓ NBT003-02-d (1.0, 1.0) | ✓ NBT003-02-d | ✓ NBT003-02-d |
| NBT005-06-d | Model division word problems using groups of objects or drawings to understand f | ✗ NF003-03-b | ✗ NF003-03-b | ✗ NF003-03-a (0.48, 0.46) | ✗ NF003-03-a | ✓ NBT005-06-d |
| NBT005-06-d | Explain the steps needed to solve multi-step division word problems. | ✓ NBT005-06-d | abstain (diffuse) | ✓ NBT005-06-d (0.98, 0.97) | ✓ NBT005-06-d | ✓ NBT005-06-d |
| NBT005-06-d | Solve multi-step division word problems accurately. | ✓ NBT005-06-d | ✓ NBT005-06-d | ✓ NBT005-06-d (1.0, 0.99) | ✓ NBT005-06-d | ✓ NBT005-06-d |
| NBT005-06-d | Verify division results by multiplying the quotient and the divisor. | ✗ NF003-07-d | abstain (diffuse) | ✓ NBT005-06-d (0.74, 0.72) | ✓ NBT005-06-d | ✓ NBT005-06-d |
| SCI002-05-b | Identify different environmental changes like drought, cold weather, and habitat | ✓ SCI002-05-b | abstain (diffuse) | ✗ SCI003-03-b (0.59, 0.57) | ✗ SCI003-03-b | ✗ SCI003-03-b |
| SCI002-05-b | Explain how specific environmental shifts affect the daily lives and needs of pl | ✓ SCI002-05-b | abstain (diffuse) | ✓ SCI002-05-b (0.48, 0.46) | ✓ SCI002-05-b | ✗ SCI003-03-a |
| SCI002-05-b | Predict the most likely biological result or trait adaptation for an organism fa | ✓ SCI002-05-b | abstain (diffuse) | ✓ SCI002-05-b (1.0, 1.0) | ✓ SCI002-05-b | ✗ SCI003-04-c |
| SS001-03-a | Identify everyday community services like fire stations, public schools, and tra | ✓ SS001-03-a | ✓ SS001-03-a | ✓ SS001-03-a (0.58, 0.55) | ✓ SS001-03-a | ✓ SS001-03-a |
| SS001-03-a | Categorize different public services into the community needs of Safety, Learnin | ✓ SS001-03-a | ✓ SS001-03-a | ✓ SS001-03-a (1.0, 1.0) | ✓ SS001-03-a | ✓ SS001-03-a |
| SS001-03-a | Explain how a specific public service helps keep our neighborhood safe, healthy, | ✓ SS001-03-a | ✓ SS001-03-a | ✓ SS001-03-a (0.56, 0.53) | ✓ SS001-03-a | ✓ SS001-03-a |
| SS003-03-e | Identify different types of local climate conditions like hot, cold, rainy, and  | ~ SS003-03-a | ~ SS003-03-a | ~ SS003-03-a (0.63, 0.61) | ~ SS003-03-a | ~ SS003-03-b |
| SS003-03-e | Explain how weather and climate shape daily human choices such as clothing and b | ✓ SS003-03-e | ✓ SS003-03-e | ✓ SS003-03-e (0.99, 0.99) | ✓ SS003-03-e | ✓ SS003-03-e |
| SS003-03-e | Apply problem-solving skills to match different climate regions with the right e | ✓ SS003-03-e | ✓ SS003-03-e | ✓ SS003-03-e (0.71, 0.7) | ✓ SS003-03-e | ✓ SS003-03-e |
| SS004-05-b | Distinguish between historical tools and modern technologies by sorting them int | ✓ SS004-05-b | ✗ SS004-01-b | ✓ SS004-05-b (0.92, 0.92) | ✓ SS004-05-b | ✗ SS004-01-b |
| SS004-05-b | Identify specific examples of older and newer inventions such as candles versus  | ✓ SS004-05-b | ✗ SS004-01-a | ✓ SS004-05-b (0.96, 0.96) | ✓ SS004-05-b | ✓ SS004-05-b |
| SS004-05-b | Explain how everyday tasks like sending messages or traveling were done long ago | ✗ SS004-01-a | ✗ SS004-01-a | ✗ SS004-01-a (0.79, 0.78) | ✗ SS004-01-a | ✗ SS004-01-a |
| SCI002-03-a | Observe how objects block a light beam to form a shadow on a surface | ✓ SCI002-03-a | ✓ SCI002-03-a | ✓ SCI002-03-a (1.0, 1.0) | ✓ SCI002-03-a | ✓ SCI002-03-a |
| SCI002-03-a | Describe how light travels in straight paths rather than bending around corners | ✓ SCI002-03-a | ✓ SCI002-03-a | ✓ SCI002-03-a (1.0, 1.0) | ✓ SCI002-03-a | ✓ SCI002-03-a |
| SCI002-03-a | Create shadows of different sizes by moving an object closer to or further from  | ✓ SCI002-03-a | abstain (diffuse) | ✓ SCI002-03-a (1.0, 1.0) | ✓ SCI002-03-a | ✓ SCI002-03-a |
| LA002-05-b | Identify the main claim or point an author is trying to make in a text. | ~ LA002-05-a | ~ LA002-05-a | ✗ LA002-01-a (0.5, 0.48) | none_of_these | ✗ LA002-01-a |
| LA002-05-b | Match specific pieces of evidence, such as study findings or expert quotes, to t | ✓ LA002-05-b | ✓ LA002-05-b | ✓ LA002-05-b (0.91, 0.9) | ✓ LA002-05-b | ✓ LA002-05-b |
| LA002-05-b | Explain how a specific piece of evidence proves or strengthens an author's argum | ~ LA002-05-a | ~ LA002-05-a | ~ LA002-05-a (0.99, 0.99) | ~ LA002-05-a | ~ LA002-05-a |
| GEOM002-01-b | Identify the number of sides and corners on physical or pictured polygon shapes | ~ GEOM002-01-a | ~ GEOM002-01-a | ~ GEOM002-01-a (1.0, 1.0) | ~ GEOM002-01-a | ~ GEOM002-01-a |
| GEOM002-01-b | Explain the rules that make a shape a closed polygon with straight lines | ~ GEOM002-01-a | ~ GEOM002-01-a | ~ GEOM002-01-a (0.99, 0.99) | ~ GEOM002-01-a | ~ GEOM002-01-a |
| GEOM002-01-b | Apply shape prompts to draw accurate closed polygons on a digital canvas using s | ✓ GEOM002-01-b | ✓ GEOM002-01-b | ✓ GEOM002-01-b (1.0, 1.0) | ✓ GEOM002-01-b | ✓ GEOM002-01-b |
| LA002-05-b | Sequence three pictures to show the order of a personal story | ✗ LA003-05-a | abstain (diffuse) | ~ LA002-05-a (0.53, 0.51) | ~ LA002-05-a | ✗ LA003-05-a |
| LA002-05-b | Explain what is happening in each part of a story picture | ✗ LA003-05-a | ✗ LA003-05-a | ✗ LA007-03-a (0.55, 0.54) | ✗ LA007-03-a | ✗ LA003-05-a |
| LA002-05-b | Create one sentence per picture to tell a complete narrative | ✓ LA002-05-b | ✓ LA002-05-b | ✓ LA002-05-b (0.99, 0.99) | ✓ LA002-05-b | ✗ LA006-06-a |

✓ exact subskill · ~ same skill, sibling subskill · ✗ different skill
## Reading (judged 2026-09-15)

**As a ranker, TypeSafe does not beat the embedding model.** Flat Choice over ~90 subskills ties
cosine argmax at subskill level (72% vs 72%) and trails it at skill level (82% vs 88%). Reranking
the embedding top-20 adds nothing (68% / 80%). The hierarchical arm — the documented strength — is
the weakest (57% / 68%): a wrong skill pick at step 1 cannot be recovered at step 2, and with ~26
skill options the descriptions overlap more than subskill descriptions do. TypeSafe also costs
0.5 s and ~8k input tokens per objective against 0.2 s for an embedding.

**As a GATE, TypeSafe's confidence is much better than cosine.** Keep the top X% of objectives by
score; skill-level precision among the kept:

| gate score | keep 50% | keep 70% | keep 80% | keep 90% | keep 100% |
|---|---|---|---|---|---|
| embedding cosine | 89% | 90% | 90% | 91% | 88% |
| TypeSafe confidence (flat Choice) | 100% | 96% | 90% | 85% | 82% |
| production gate (unit/skill coherence) | — | — | 81% at its own 80% coverage | — | — |

Cosine magnitude does not separate right from wrong picks at all (flat 88–91%). TypeSafe's
confidence does: at half coverage it is perfect at skill level and 89% at subskill level (cosine:
68%). A third gate needs no threshold: when embedding argmax and TypeSafe agree (58 of 74, 78%),
skill precision is 95% and subskill 83%; when they disagree (16), embeddings are right 10 times,
TypeSafe 6, neither 2.

**The production gate is the weak link, not the embedding.** It abstained "diffuse" on 11
objectives whose cosine argmax was the right skill, and on 6 more it returned a MATCH attributed to
a different skill than argmax (the dominant-skill vote), where argmax was right. Its operating
point — 80% coverage, 81% skill precision — is below raw argmax with no gate at all (88%).

**Caveats.** n = 74, one grade per subskill, and an easy regime: objectives are curator-brief
paraphrases of the subskill description, the regime the personalization path sees, not challenge
text. Ground truth is the source subskill; a sibling subskill is often a defensible home, which is
why skill@1 is the number to read.

**Candidate (not built):** replace or supplement the coherence gate on the objective → subskill path
with a TypeSafe verifier — either confidence-gated (one Choice over the grade's subskills, ~0.5 s,
abstain below a threshold picked on this data) or agreement-gated (abstain when embedding argmax and
TypeSafe disagree). Both must be re-measured on challenge text before touching production, and both
inherit the failsafe shape in specialistSuggestions.ts (timeout, breaker, fall back to the current
gate).
