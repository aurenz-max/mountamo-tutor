# Discovery A/B

One run per arm/topic; exploratory, not a statistical quality result. Expected candidates measure consideration, not required selection. Volcanoes only has a general-purpose expectation and cannot demonstrate specialist recall improvement. Last three topics are held-out probes. Identical downstream prompts/settings, different candidate pools. Index construction is offline; online latency includes uncached query embedding.

| Topic | Discovery | Recall | Pool | Online ms | Status | Selected |
|---|---|---|---|---|---|---|
| excavators | lexical | 4/4 | 28 | 10721 | generated | curator-brief, comparison-panel, fast-fact/recognize, how-it-works/guided, dump-truck-loader/load, knowledge-check/recall |
| excavators | semantic | 3/4 | 31 | 12048 | generated | curator-brief, comparison-panel, excavator-arm-simulator, dump-truck-loader/load, how-it-works/sequence, knowledge-check/recall |
| sea-otters | lexical | 0/3 | 23 | 9721 | generated | curator-brief, foundation-explorer, custom-visual, fast-fact/recognize, knowledge-check/recall |
| sea-otters | semantic | 3/3 | 29 | 13845 | invalid | curator-brief, species-profile, habitat-diorama/observe, fast-fact/recognize, habitat-diorama/connect, knowledge-check/recall |
| volcanoes | lexical | 1/1 | 21 | 10935 | invalid | curator-brief, foundation-explorer, comparison-panel, fast-fact/recognize, knowledge-check/recall |
| volcanoes | semantic | 1/1 | 30 | 11696 | generated | curator-brief, foundation-explorer, custom-visual, fast-fact/recognize, comparison-panel, knowledge-check/recall |
| solar-system | lexical | 2/2 | 30 | 10047 | generated | curator-brief, foundation-explorer, solar-system-explorer/identify, fast-fact/apply, knowledge-check/recall |
| solar-system | semantic | 2/2 | 32 | 12460 | generated | curator-brief, foundation-explorer, solar-system-explorer/identify, orbit-mechanics-lab, knowledge-check/recall |
| phonics-sitpin | lexical | 2/2 | 37 | 12392 | generated | curator-brief, foundation-explorer, letter-sound-link/hear_see, phoneme-explorer/blend, cvc-speller/spell_word, letter-sound-link/see_hear |
| phonics-sitpin | semantic | 2/2 | 33 | 11746 | generated | curator-brief, di-letter-sounds/letter_sound, phonics-blender/cvc, cvc-speller/spell_word, word-workout/picture_match |
| counting | lexical | 1/1 | 33 | 12508 | generated | curator-brief, counting-board/count, counting-board/count, di-spoken-practice/count_and_say, di-math-facts/name_numeral, knowledge-check/recall |
| counting | semantic | 1/1 | 31 | 13526 | generated | curator-brief, counting-board/count, counting-board/count, ten-frame/build, ten-frame/build, knowledge-check/recall |
| butterflies | lexical | 0/2 | 32 | 11556 | generated | curator-brief, foundation-explorer, custom-visual, how-it-works/guided, fast-fact/apply, knowledge-check/recall |
| butterflies | semantic | 2/2 | 29 | 9826 | generated | curator-brief, foundation-explorer, image-comparison, life-cycle-sequencer, knowledge-check/recall |
| bicycles | lexical | 1/1 | 30 | 10564 | generated | curator-brief, foundation-explorer, how-it-works/guided, fast-fact/apply, knowledge-check/recall |
| bicycles | semantic | 1/1 | 29 | 10028 | generated | curator-brief, machine-profile, foundation-explorer, how-it-works/sequence, gear-train-builder, knowledge-check/recall |
| penguins | lexical | 0/2 | 22 | 11594 | generated | curator-brief, foundation-explorer, custom-visual, classification-sorter, comparison-panel, knowledge-check/recall |
| penguins | semantic | 1/2 | 27 | 10597 | generated | curator-brief, species-profile, foundation-explorer, life-cycle-sequencer, knowledge-check/recall |
