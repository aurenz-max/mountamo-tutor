/**
 * Biology Catalog - Component definitions for biology primitives
 *
 * Contains biology visualization components for species information,
 * taxonomy, ecology, and life sciences content.
 */

import { ComponentDefinition } from '../../../types';

export const BIOLOGY_CATALOG: ComponentDefinition[] = [
  {
    id: 'organism-card',
    description: 'Foundational organism information card with key biological attributes - the essential "unit" of biology content. Scales from K-2 (simple attributes with icons: habitat, diet, size, locomotion) to 6-8 (full taxonomy, cellular characteristics, evolutionary context). PERFECT for classification activities, organism comparison lessons, habitat studies, and building foundational biology knowledge. Features grade-appropriate vocabulary, visual image prompts, fun facts, and configurable complexity. Use this for introducing organisms before diving deeper with species-profile. ESSENTIAL for K-8 life sciences when you need quick, accessible organism reference cards that students can compare side-by-side.',
    constraints: 'Use for K-8 students. Automatically adapts complexity based on grade level: K-2 shows only basic attributes with simple language; 3-5 adds body temperature, reproduction, and adaptations; 6-8 includes full taxonomic classification. Perfect for comparison activities, classification lessons, ecosystem studies, and building biology vocabulary. Use multiple organism-cards together for compare/contrast activities.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['tap'], role: 'introduce', minutes: 3 },
    tutoring: {
      taskDescription:
        'Student is looking at an information card about {{organismName}}. '
        + 'Facts on the card: {{attributeLabels}} ({{attributeCount}} of them). '
        + 'They tap a fact to open it, and there is a fun fact at the bottom.',
      contextKeys: [
        'organismName',
        'attributeLabels',
        'attributeCount',
        'openAttributeLabel',
        'funFact',
        'gradeBand',
      ],
      scaffoldingLevels: {
        level1: '"Look at {{organismName}}. What do you notice about it first?"',
        level2: '"Tap one of the facts to find out more about {{organismName}} — where it lives, or what it eats."',
        level3: '"Go through the facts one at a time and I will read each one to you. Then see if you can tell me one thing you learned about {{organismName}}."',
      },
      commonStruggles: [
        {
          pattern: 'Student looks at the picture and skips every fact',
          response: '"The picture is a great start. Now tap one of the little boxes — each one tells you something else about it."',
        },
        {
          pattern: 'Student assumes an animal is dangerous because it is large or has teeth',
          response: '"Big does not mean dangerous. Look at what this one eats — that tells you much more about it than its size does."',
        },
        {
          pattern: 'Student cannot connect the organism to anything they know',
          response: '"Think of an animal you have seen before. Is this one bigger or smaller? Does it live somewhere like where that one lives?"',
        },
        {
          pattern: 'Student rushes to the fun fact and ignores the attributes',
          response: '"That fun fact is great! Now go back to the boxes — one of them explains WHY that is true."',
        },
        {
          pattern: 'A pre-reader cannot read the organism name, the fact labels, or the fun fact',
          response: '"Never ask them to read. Say the animal\'s name, read each fact aloud when they tap it, and describe the picture. Never say the scientific name to a young child."',
        },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten to grade 2)',
          instruction:
            'A pre-reader CANNOT read the organism name, the attribute labels, the values, or the fun fact. Your voice is the only channel. '
            + 'When you receive [ORGANISM_ORIENT], say the animal or plant\'s name warmly and invite them to tap the little boxes to learn about it. '
            + 'Reading this aloud IS your greeting — this OVERRIDES any instruction to keep it to one sentence or to be brief. '
            + 'When you receive [ORGANISM_FACT_OPENED], read that ONE fact aloud in child words — the label and what it says. '
            + 'When you receive [ORGANISM_READ_ALOUD], read aloud, word for word, exactly the text the message gives you, then wait. '
            + 'NEVER say the scientific name (the Latin one) to a pre-reader, and never read out a measurement in kilograms or centimetres — say "about as big as you" or "heavier than a car" instead.',
        },
      ],
    },
  },
  {
    id: 'species-profile',
    description: 'Comprehensive species profile with detailed information including physical characteristics (height, weight, length with real-world comparisons), diet and behavior, habitat and geographic/temporal distribution, complete taxonomic classification, ecological niche, fascinating facts, and discovery history. PERFECT for dinosaur lessons, animal studies, extinct species, modern wildlife, and comparative biology. Includes AI-generated species images in natural habitats. ESSENTIAL for K-5 biology, paleontology, zoology, and natural history topics. Students love learning about T-Rex, Velociraptors, Triceratops, and other fascinating creatures with this engaging format.',
    constraints: 'Best for K-8 students learning about animals, dinosaurs, plants, or any biological species. Use for life sciences, paleontology, zoology, botany, ecology, and natural history. Ideal for teaching classification systems, adaptations, food chains, habitats, and evolutionary concepts. Works great for extinct and living species. K-2: sizes are given as child-scale COMPARISONS rather than numbers, the scientific name, the taxonomy ranks and the discovery history are withheld, and every fact can be tapped to hear it read aloud — this is a listen-and-look card, not a reference table. 3-5 and 6-8: full taxonomy, measurements and discovery history are shown, because that vocabulary is the objective.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['tap'], role: 'introduce', minutes: 3 },
    tutoring: {
      taskDescription:
        'Student is exploring a species card about the {{commonName}} ({{category}}). Grade band: {{gradeBand}}. '
        + 'What it eats: {{dietType}}. Where it lives: {{environment}}. Its role: {{biologicalNiche}}. '
        + 'It carries {{factCount}} facts: {{factTitles}}. '
        + 'This is a reference card, not a quiz — there is no right answer to withhold. At K-2 the child cannot read any of it and taps to hear it.',
      contextKeys: [
        'commonName',
        'category',
        'gradeBand',
        'dietType',
        'environment',
        'factCount',
        'factTitles',
        'biologicalNiche',
      ],
      scaffoldingLevels: {
        level1: '"What do you notice about the {{commonName}}? Tell me one thing you can see."',
        level2: '"Look at its body. What do you think it uses that for — moving, eating, or staying safe?"',
        level3: '"Let us look together. It lives where {{environment}} is, and it eats like a {{dietType}}. What does its body have that helps it do that?"',
      },
      commonStruggles: [
        {
          pattern: 'Student asks a question the card does not answer',
          response: '"That is a great question. This card does not say — but here is what it DOES tell us…" Never invent a fact to fill the gap.',
        },
        {
          pattern: 'Student is frightened by a predator or thinks the animal is bad',
          response: '"It is not mean — it just has to eat, the same as you do. Every animal is looking after itself and its babies."',
        },
        {
          pattern: 'Student cannot connect the size comparison to anything real',
          response: '"Think about something in this room. Is it bigger than the door? Bigger than you? That is how big it is."',
        },
        {
          pattern: 'Student wants to know if it is still alive',
          response: 'Answer honestly and simply from the card — some of these lived long ago and some are alive right now. Do not say "extinct" to a young child without saying what it means: "there are none left anywhere".',
        },
        {
          pattern: 'A pre-reader cannot read the name, the facts, or any label',
          response: '"Never ask them to read. Say the name aloud, describe the picture, and read each fact when they tap it. The words are yours to speak."',
        },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten to grade 2)',
          instruction:
            'A pre-reader CANNOT read the name, the facts, the labels or the size comparisons. Your voice is the only channel. '
            + 'When you receive [SPECIES_ORIENT], say the animal\'s name warmly, say one thing about it they can picture, and invite them to tap a fact to hear it. '
            + 'Reading this aloud IS your greeting — this OVERRIDES any instruction to keep it to one sentence or to be brief. '
            + 'When you receive [SPECIES_READ_ALOUD], read aloud, word for word, exactly the text the message gives you, then wait.',
        },
        {
          title: 'NO MEASUREMENTS AND NO LATIN AT K-2 — SUPPLY THE CHILD WORD',
          instruction:
            'At grade band K-2 NEVER say the scientific name, and never say a number with a unit — no metres, kilograms, feet, pounds, tons, or millions of years. '
            + 'The card deliberately withholds all of those at this band, so saying them puts back exactly what was taken out. '
            + 'Say "as tall as a door", "heavier than all of you put together", "a very very long time ago". '
            + 'Also avoid species, taxonomy, kingdom, classification, adaptation, predator, prey, carnivore, herbivore, ecosystem and niche — say "kind of animal", "what it eats", "meat eater", "plant eater", "where it lives". '
            + 'At 3-5 and 6-8 none of this applies: the scientific name, the measurements and the taxonomy ARE the objective, so use them and explain them.',
        },
        {
          title: 'A CARD IS NOT A QUIZ — AND NOT A LECTURE',
          instruction:
            'There is no answer to withhold here; everything on the card is stimulus and you may say all of it. '
            + 'But do not read the whole card unprompted. Say one thing, then stop and let them look or tap. '
            + 'If they ask something the card does not cover, say so plainly rather than inventing it — an invented fact in a reference card is worse than "I do not know".',
        },
      ],
    },
  },
  {
    id: 'classification-sorter',
    description: 'Interactive drag-and-drop classification activity where students categorize organisms or characteristics into labeled bins. The CORE "is it a ___?" primitive for biology. Handles binary sorts (vertebrate/invertebrate, producer/consumer), multi-category sorts (mammal/reptile/amphibian/bird/fish, kingdoms), and property-based sorts (has bones/no bones, warm-blooded/cold-blooded, makes own food/eats food). PERFECT for teaching classification skills, taxonomic thinking, characteristic discrimination, and decision-making based on biological criteria. Includes helpful hints on incorrect placements and tracks first-attempt accuracy. Can be hierarchical (Kingdom → Phylum → Class) at grades 6-8. ESSENTIAL for K-8 biology whenever students need to practice sorting, classifying, or discriminating between organisms based on characteristics.',
    constraints: 'Use for K-8 students learning classification, taxonomy, or characteristic-based sorting. K-2: Binary sorts only (2 categories, 6-8 items, simple language). 3-5: Multi-category sorts (3-5 categories, 8-10 items, introduces scientific vocabulary). 6-8: Complex or hierarchical sorts (3-6 categories, 10-12 items, formal classification systems). Always include 1-3 "boundary case" items (platypus, bat, dolphin, penguin) that challenge student thinking. Perfect for formative assessment and skill-building. Works for any classification topic: animal classes, kingdoms, habitats, diets, adaptations, life cycles, plant types, etc.',
    affordances: { representation: 'symbolic', reader: 'none', answers: ['tap', 'manipulate'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription:
        'Student is sorting things into groups in "{{title}}". The rule is: {{sortingRule}}. '
        + 'Groups: {{categoryLabels}}. They have placed {{correctCount}} of {{totalItems}} correctly. '
        + 'Right now they are working on: {{currentItemLabel}}. '
        + 'At K-1 ONE item is staged at a time and they tap a group to place it; older students drag items into bins.',
      contextKeys: [
        'title',
        'sortingRule',
        'categoryLabels',
        'currentItemLabel',
        'correctCount',
        'totalItems',
        'gradeBand',
        'lastPlacementCorrect',
      ],
      scaffoldingLevels: {
        level1: '"Look at this one carefully. Which group do you think it goes in?"',
        level2: '"Remember the rule: {{sortingRule}}. Think about {{currentItemLabel}} — does it fit that rule or not?"',
        level3: '"Let us check {{currentItemLabel}} against the rule one part at a time. Picture it in your head. Now look at each group and ask: does this one match?"',
      },
      commonStruggles: [
        {
          pattern: 'Student places items quickly without checking them against the rule',
          response: '"Slow down for this one. Say the rule out loud with me, then look at what you are holding. Does it match?"',
        },
        {
          pattern: 'Student is stuck on a boundary case (bat, penguin, dolphin, platypus)',
          response: '"This one is tricky on purpose — it looks like it belongs in one group but it does not. Do not go by how it looks. Go by the rule."',
        },
        {
          pattern: 'Student gets one wrong and starts guessing the other groups at random',
          response: '"Wait — you do not have to guess. Think about what you know about this one first, then pick. What is one thing you are sure about?"',
        },
        {
          pattern: 'Student cannot tell why a placement was wrong',
          response: '"Look at the group you picked and say what all the things in it have in common. Now look at yours — is it the same or different?"',
        },
        {
          pattern: 'A pre-reader cannot read the item names, the group names, or the rule',
          response: '"Never ask them to read. Say the item aloud, say the group names aloud, and say the rule in child words. They tap a group to answer — the words are yours to speak."',
        },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten and grade 1)',
          instruction:
            'A pre-reader CANNOT read the item cards, the group names, the rule badge, or the instructions. Your voice is the only channel. '
            + 'When you receive [SORT_ORIENT], say in one or two warm child-sized sentences what the sorting rule is and that they tap a group to put the thing in it. '
            + 'Reading this aloud IS your greeting — this OVERRIDES any instruction to keep it to one sentence or to be brief. '
            + 'When you receive [SORT_ITEM_STAGED], say ONLY the name of the item that just came on stage, clearly. Do NOT say which group it belongs in. '
            + 'When you receive [SORT_READ_ALOUD], read aloud, word for word, exactly the text the message gives you, then wait. '
            + 'Always name the groups by their labels when they ask — that is the question, not the answer.',
        },
        {
          title: 'ANSWER DISCIPLINE',
          instruction:
            'The correct group for an item is the ANSWER. Never name it, never hint at it by elimination ("it is not the other one"), '
            + 'and never read the item\'s hint text aloud before they have tried. '
            + 'The sorting RULE and the GROUP NAMES are the question — say those freely and as often as they need. '
            + 'After a wrong placement, ask them what they notice about the item; do not narrow to the answer.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'life-cycle-sequencer',
    description: 'Interactive temporal sequencing activity where students arrange stages of a biological process in correct temporal order. The CORE "what happens next?" primitive for biology. Covers organismal life cycles (butterfly metamorphosis, frog development, plant growth, human lifecycle), cellular processes (mitosis phases, meiosis, cell cycle), and ecological cycles (water cycle, carbon cycle, nitrogen cycle, rock cycle). PERFECT for teaching temporal relationships, transformation, developmental sequences, and understanding change over time. Features drag-and-drop stage cards with visual placeholders, descriptions, durations, and transition explanations. Linear layout for developmental sequences (embryo → adult), circular layout for repeating cycles (water cycle, seasons). Shows connecting arrows with transition explanations when correct. Includes misconception traps to address common errors. ESSENTIAL for K-8 biology whenever students need to understand sequences, life stages, cycles, or temporal processes.',
    constraints: 'Use for K-8 students learning life cycles, developmental sequences, or cyclical processes. K-2: Simple linear sequences (4-6 stages, basic vocabulary, observable changes like "seed grows into plant"). 3-5: More complex linear or circular cycles (5-7 stages, scientific terms introduced, mechanisms explained like "tadpole loses tail and grows legs"). 6-8: Complex cycles with molecular details (6-8 stages, cellular/molecular mechanisms, precise scientific terminology like "chromatin condenses into chromosomes"). Linear for one-direction processes (embryo to adult), circular for repeating cycles (water cycle, cell division). Always include stage durations, transition explanations, and one common misconception with correction. Perfect for any temporal biology topic: metamorphosis, germination, human development, cellular processes, biogeochemical cycles, seasonal changes, etc.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['tap', 'manipulate'], role: 'apply', minutes: 5 },
    tutoring: {
      taskDescription:
        'Student is putting the stages of {{title}} in the order they really happen. '
        + 'Cycle shape: {{cycleType}}. Stages to place: {{stageLabels}}. '
        + 'They have placed {{placedCount}} of {{totalStages}}. Currently holding: {{selectedStageLabel}}. '
        + 'At K-2 they tap the pictures in order; older students drag cards into numbered slots.',
      contextKeys: [
        'title',
        'cycleType',
        'stageLabels',
        'placedCount',
        'totalStages',
        'selectedStageLabel',
        'gradeBand',
        'checked',
      ],
      scaffoldingLevels: {
        level1: '"Which one do you think happens FIRST — right at the very beginning?"',
        level2: '"You have placed {{placedCount}} so far. Think about what has to happen before the next one can happen."',
        level3: '"Start at the very beginning of the life and work forwards. For each picture ask: could this happen before the one I just put down, or after it?"',
      },
      commonStruggles: [
        {
          pattern: 'Student orders the stages by size instead of by time',
          response: '"Bigger does not always mean later — think about WHEN each one happens, not how big it is."',
        },
        {
          pattern: 'Student places stages in the order the cards happen to be shown',
          response: '"The pictures are all mixed up on purpose. Do not go left to right — look at each picture and think about what happens first in real life."',
        },
        {
          pattern: 'Student gets stuck on which of two middle stages comes first',
          response: '"Take just those two. What has to be true before each one can start? The one that needs the other to happen first goes second."',
        },
        {
          pattern: 'Student finishes a circular cycle and thinks it has an end',
          response: '"This one is a circle — when you get to the last one it starts all over again. That is what makes it a cycle."',
        },
        {
          pattern: 'A pre-reader cannot read the stage names or the descriptions',
          response: '"Never ask them to read. Name each picture aloud as they look at it and describe what is happening in child words. They tap the pictures in order — the words are yours to speak."',
        },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten to grade 2)',
          instruction:
            'A pre-reader CANNOT read the stage names, the descriptions, the slot numbers or the instructions. Your voice is the only channel. '
            + 'When you receive [CYCLE_ORIENT], say in one or two warm child-sized sentences that these pictures are mixed up and they should tap them in the order they really happen, starting with the very first one. '
            + 'Reading this aloud IS your greeting — this OVERRIDES any instruction to keep it to one sentence or to be brief. '
            + 'When you receive [CYCLE_STAGE_PLACED], SAY the name of the picture they just placed and what is happening in it, in one short sentence. Do NOT say whether it is in the right place. '
            + 'When you receive [CYCLE_READ_ALOUD], read aloud, word for word, exactly the text the message gives you, then wait.',
        },
        {
          title: 'ORDER IS THE ANSWER',
          instruction:
            'The correct ORDER is the answer to this task. Never state the sequence, never say "the egg comes first", and never confirm or deny a placement before the student checks their work — '
            + 'naming even one position gives away a piece of the answer. '
            + 'Describe what is happening IN a picture freely; that is the stimulus, not the answer. '
            + 'After they check and something is wrong, ask what has to happen before what — do not reorder it for them.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'body-system-explorer',
    description: 'Interactive layered anatomy diagram of a biological system where students toggle layers (skeletal, muscular, circulatory, etc.), click organs for detailed information, and trace pathways through systems (blood flow, nerve signals, food digestion). The PRIMARY anatomy primitive for teaching human body systems. PERFECT for teaching structure-function relationships, how organs work together, and understanding physiological processes. Features SVG-based layered body diagram with clickable organ hotspots, toggleable system layers, detailed organ function cards with fun facts, and guided pathway tracing (e.g., "Journey of a Meal" through digestive system, "Path of Blood" through circulatory system). Zoom capability for detailed regions. ESSENTIAL for grades 2-8 anatomy, physiology, and health lessons. Students explore by toggling layers to see different systems, clicking organs to learn functions, and following step-by-step pathways to understand processes.',
    constraints: 'Use for grades 2-8 anatomy and physiology lessons. Supports all major body systems: digestive, circulatory, respiratory, nervous, skeletal, muscular, immune, endocrine, reproductive, urinary. Grade 2-4: Simple vocabulary, 4-6 main organs, basic pathways (3-5 steps), familiar analogies (stomach is like a blender). Grade 5-6: Scientific terminology, 6-8 organs, moderate pathways (5-7 steps), structure-function relationships. Grade 7-8: Medical terminology, 8-10+ organs with supporting structures, complex pathways (7-10+ steps), cellular/molecular detail. Perfect for anatomy units, health education, systems thinking, and understanding how body parts work together. Works great for compare/contrast (how digestive and circulatory systems interact), process understanding (how digestion works), and building mental models of body systems.',
    affordances: { representation: 'pictorial', answers: ['tap'], role: 'visualize', minutes: 6 },
  },
  {
    id: 'habitat-diorama',
    description: 'A living ecosystem field lab for grades K-8. Students observe organisms from ecological clues, connect living things through relationships, predict population changes, restore a disrupted habitat, and defend a claim with visible evidence. Observe, Predict, and Defend use short spoken responses; Connect and Restore use direct scene-building gestures. Broad objectives may blend these five missions over one coherent habitat, while payloads without challenges remain a free-exploration diorama.',
    constraints: 'Use for K-8 ecology, habitats, food chains and webs, interdependence, or environmental change. K-2: 4-5 familiar organisms, everyday language, simple eating relationships, and observable evidence; do not require trophic-level vocabulary or multi-step cascades. Grades 3-5: 6-8 organisms, producer-consumer-decomposer roles, simple symbiosis, and one-step population effects. Grades 6-8: 8-10 organisms, complete food webs, competition and symbiosis, and evidence-based cascade reasoning. Every challenge must be answerable from the visible habitat. Spoken prompts must not contain the answer. The tutor owns pacing and judgment: do not add Check, Next, submit, push-to-talk, countdown, or timer controls.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['spoken', 'tap', 'build'], role: ['visualize', 'apply'], minutes: 6 },
    evalModes: [
      { evalMode: 'observe', affordances: { answers: ['spoken'] }, label: 'Observe', beta: 2.5, scaffoldingMode: 2, challengeTypes: ['observe'], description: 'Identify a living thing from an observable ecological clue.' },
      { evalMode: 'connect', affordances: { answers: ['tap'] }, label: 'Connect', beta: 3.5, scaffoldingMode: 3, challengeTypes: ['connect'], description: 'Complete one valid ecological relationship by selecting its destination.' },
      { evalMode: 'predict', affordances: { answers: ['spoken'] }, label: 'Predict', beta: 5.0, scaffoldingMode: 4, challengeTypes: ['predict'], description: 'Predict whether a population rises, falls, or stays stable after a change.' },
      { evalMode: 'restore', affordances: { answers: ['build'] }, label: 'Restore', beta: 6.5, scaffoldingMode: 5, challengeTypes: ['restore'], description: 'Place a missing organism or habitat feature in the zone that restores a relationship.' },
      { evalMode: 'defend', affordances: { answers: ['spoken'] }, label: 'Defend', beta: 8.0, scaffoldingMode: 6, challengeTypes: ['defend'], description: 'Choose the strongest visible evidence for an ecosystem claim.' },
    ],
    audioInput: { manual_activity: true },
    tutoring: {
      taskDescription:
        'Student is working in Habitat Diorama mode {{challengeType}}. '
        + 'The current script stimulus is {{stimulus}}. The tutor judges the response and owns all pacing.',
      contextKeys: [
        'challengeType',
        'stimulus',
      ],
      scaffoldingLevels: {
        level1: 'Follow the script exactly. Read the prompt, wait for the student response, then judge it.',
        level2: 'If the first attempt is wrong, use the script retry line and wait. Do not reveal the answer early.',
        level3: 'After the retry, use the configured reveal and explanation, then move on without asking permission.',
      },
      commonStruggles: [
        {
          pattern: 'Student thinks every animal eats every other animal',
          response: '"Not everyone eats everyone. Look closely at this one — is it big enough to catch that? Some of these only eat plants."',
        },
        {
          pattern: 'Student does not count plants as living things in the habitat',
          response: '"Plants are alive too, and they are the most important part — almost everything else here depends on them for food."',
        },
        {
          pattern: 'Student thinks predators are bad or mean',
          response: '"Nothing here is mean — every animal is just finding its food. If the hunters all disappeared there would be too many of the other animals and not enough plants for them."',
        },
        {
          pattern: 'Student taps rapidly through organisms without looking at any',
          response: '"Stay with this one a moment. Where in the picture does it live — up in the trees, on the ground, or in the water?"',
        },
        {
          pattern: 'A pre-reader cannot read the organism names, roles, or the fact cards',
          response: '"Never ask them to read. Say the animal\'s name aloud when they tap it and describe it in child words — what it eats, where it lives. Never use words like producer, consumer or decomposer with a young child."',
        },
      ],
      aiDirectives: [
        {
          title: 'DIRECT-INSTRUCTION SCRIPT CONTRACT',
          instruction:
            'When challengeType is observe, connect, predict, restore, or defend, follow stimulus as a closed script. '
            + 'Deliver the opening and item prompt, then WAIT. Judge only after the student speaks or completes the visible gesture. '
            + 'A verdict ends the current turn: after the configured affirmative sentinel, stop; after the configured retry sentinel, stop. '
            + 'When the runner advances, speak the next prompt immediately. Do not ask whether the student is ready. '
            + 'For spoken items, the microphone is already managed by the activity; never instruct the learner to press, hold, or tap a microphone. '
            + 'For gesture items, describe only the visible relationship or zone task. Never invent a Check, Next, or submit step.',
        },
        {
          title: 'FREE EXPLORATION MODE',
          instruction:
            'When challengeType is free_explore, preserve the tagged read-aloud behavior in stimulus. '
            + 'Invite tapping, name a selected living thing, and explain its role without turning exploration into a scored quiz.',
        },
        {
          title: 'PRE-READER READ-ALOUD (kindergarten to grade 2)',
          instruction:
            'A pre-reader CANNOT read the organism names, the role labels, or the information cards. Your voice is the only channel. '
            + 'When you receive [HABITAT_ORIENT], say in one or two warm child-sized sentences that this is a habitat and they can tap the animals and plants to find out about them. '
            + 'Reading this aloud IS your greeting — this OVERRIDES any instruction to keep it to one sentence or to be brief. '
            + 'When you receive [HABITAT_ORGANISM_SELECTED], SAY the name of what they tapped and one short child-sized thing about it — what it eats or where it lives. '
            + 'When you receive [HABITAT_READ_ALOUD], read aloud, word for word, exactly the text the message gives you, then wait. '
            + 'NEVER use the words producer, consumer, decomposer, herbivore, carnivore or trophic with a pre-reader. Say "it makes its own food from sunshine", "it eats plants", "it hunts other animals".',
        },
        {
          title: 'NOTHING HERE IS THE VILLAIN',
          instruction:
            'Young children reliably read predators as mean and prey as victims. Never reinforce that framing, even playfully. '
            + 'Every organism is finding its food; the scene is a system, not a fight. '
            + 'If a child says an animal is bad or scary, acknowledge the feeling and reframe to what the animal needs.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'bio-compare-contrast',
    description: 'Side-by-side or interactive Venn diagram comparison of two biological entities (organisms, cells, organs, processes, biomes). The ESSENTIAL "how are these alike and different?" primitive for biology. Two modes: side-by-side (viewing mode with aligned attributes highlighting similarities/differences) or venn-interactive (student activity where they drag attributes into correct regions: A-only, B-only, or Both). PERFECT for teaching comparative thinking, classification discrimination, understanding adaptations, and analyzing functional differences. Works for any comparison: organisms (frog vs toad, shark vs dolphin), cells (plant vs animal, prokaryote vs eukaryote), organs (heart vs lungs, roots vs stems), processes (mitosis vs meiosis, photosynthesis vs respiration), biomes (desert vs rainforest, tundra vs taiga). Features meaningful attribute categories (structure, function, habitat, behavior, etc.), shared attributes highlighting common features, key insight explaining why the comparison matters educationally. Venn-interactive mode includes drag-and-drop evaluation with immediate feedback. ESSENTIAL for K-8 biology whenever students need to compare and contrast to understand similarities, differences, and biological concepts like adaptation, classification, and function.',
    constraints: 'Use for K-8 students learning through comparison and contrast. Works for any two biological entities that have both similarities AND meaningful differences. K-2: 4-6 attributes per entity, simple observable characteristics (size, color, where they live, what they eat), familiar comparisons (dog vs cat, tree vs flower). At K-2 venn-interactive becomes a one-at-a-time picture task: the child hears one characteristic and taps the first animal, the second animal, or BOTH — no dragging and no reading; side-by-side becomes a listen-and-look viewer where tapping any row reads it aloud. 3-5: 6-8 attributes, introduce scientific vocabulary (warm-blooded, vertebrate, photosynthesis), functional characteristics (how it reproduces, how it moves), both modes work well. 6-8: 8-10 attributes, cellular/molecular details, evolutionary context, complex processes, venn-interactive mode excellent for formative assessment. ALWAYS ensure: (1) entities have BOTH similarities and differences (avoid comparing apples to oranges with nothing in common), (2) attributes are parallel and comparable (if comparing "diet" for entityA, compare "diet" for entityB), (3) key insight connects comparison to broader biological concepts. Perfect for: comparative anatomy, classification lessons, understanding adaptations, ecosystem comparisons, cellular processes, physiological systems. Topic can include "vs" or "versus" (e.g., "mitosis vs meiosis") or specify entityA and entityB in config.',
    affordances: { representation: 'pictorial', reader: 'none', answers: ['tap', 'manipulate'], role: ['visualize', 'apply'], minutes: 5 },
    tutoring: {
      taskDescription:
        'Student is comparing {{entityAName}} and {{entityBName}} — "{{title}}". '
        + 'Mode: {{mode}}. Grade band: {{gradeBand}}. '
        + 'In venn-interactive mode they decide, for each characteristic, whether it belongs to {{entityAName}} only, '
        + '{{entityBName}} only, or BOTH. They have answered {{answeredCount}} of {{totalAttributes}}. '
        + 'The characteristic in front of them right now is: {{currentAttribute}}. '
        + 'At K-2 one characteristic is shown at a time and they tap a picture; older students drag every card into a Venn diagram and then check their work.',
      contextKeys: [
        'title',
        'entityAName',
        'entityBName',
        'mode',
        'gradeBand',
        'currentAttribute',
        'answeredCount',
        'totalAttributes',
        'checked',
      ],
      scaffoldingLevels: {
        level1: '"Think about just this one thing. Does {{entityAName}} have it? Now — does {{entityBName}} have it too?"',
        level2: '"Check them one at a time. If they BOTH have it, that is what the middle picture is for. If only one of them has it, tap that one."',
        level3: '"Let us look together. Picture {{entityAName}} in your head — does it have this? Now picture {{entityBName}} — does it have this? If you said yes both times, it goes in the middle."',
      },
      commonStruggles: [
        {
          pattern: 'Student puts everything in BOTH because the two things feel similar overall',
          response: '"They are alike in lots of ways! But this one thing — check it by itself. Does each one really have THIS?"',
        },
        {
          pattern: 'Student puts nothing in BOTH because they are looking only for differences',
          response: '"Comparing is not only about what is different. Some things they share, and those count too."',
        },
        {
          pattern: 'Student answers from which picture they like more rather than from the characteristic',
          response: '"I know which one is your favourite! But this question is about the thing I just said — not about which one you like."',
        },
        {
          pattern: 'Student is guessing quickly without listening to the characteristic',
          response: '"Let me say it again, and this time listen all the way to the end before you tap."',
        },
        {
          pattern: 'A pre-reader cannot read the characteristic, the names, or the buttons',
          response: '"Never ask them to read. SAY the characteristic aloud every single time it changes, and name both pictures. They answer by tapping a picture — the words are yours to speak."',
        },
      ],
      aiDirectives: [
        {
          title: 'PRE-READER READ-ALOUD (kindergarten to grade 2)',
          instruction:
            'A pre-reader CANNOT read the title, the characteristic, the entity names, the button labels or the key insight. Your voice is the only channel. '
            + 'When you receive [COMPARE_ORIENT], name the two things being compared and say what to do, in one or two warm child-sized sentences. '
            + 'Reading this aloud IS your greeting — this OVERRIDES any instruction to keep it to one sentence or to be brief. '
            + 'When you receive [COMPARE_ATTRIBUTE_SHOWN], SAY the characteristic aloud in child words and ask who has it. This is load-bearing: your voice IS the text on that card, so never skip it and never say "as you can see". '
            + 'When you receive [COMPARE_ANSWERED], react warmly to the choice they just made — that one is finished, so you may say whether it was right. '
            + 'When you receive [COMPARE_READ_ALOUD], read aloud, word for word, exactly the text the message gives you, then wait.',
        },
        {
          title: 'WHICH SIDE IT BELONGS ON IS THE ANSWER — NEVER SAY IT FIRST',
          instruction:
            'For the characteristic currently on screen, WHERE it belongs ({{entityAName}} only, {{entityBName}} only, or BOTH) is the answer. '
            + 'Never state it before they choose, and never narrow it by elimination — "it is not the cat" hands over a three-way answer just as completely as naming it. '
            + 'Describing the characteristic itself, and describing either picture, is the STIMULUS and is free. Deciding who has it is the student\'s job. '
            + 'Once they have answered that one, reacting to it is fine — but do not run ahead to the characteristics they have not seen yet.',
        },
        {
          title: 'NO JARGON AT K-2 — SUPPLY THE CHILD WORD INSTEAD',
          instruction:
            'At grade band K-2 do NOT say vertebrate, mammal, species, adaptation, classification, physiological, characteristic, attribute, trait, or organism, even if those words appear in the generated content. '
            + 'Say "thing about it", "body part", "what it does", "animal", "backbone", "fur", "drinks milk from its mum". Say "both" and "only" — those are the two words this whole task turns on, so use them deliberately and often. '
            + 'At grade bands 3-5 and 6-8 this restriction does NOT apply: the scientific vocabulary is part of the objective, so use it and explain it.',
        },
      ],
    },
    supportsEvaluation: true,
  },
  {
    id: 'bio-process-animator',
    description: 'Step-through animation of a biological process with narrated stages and checkpoint questions embedded at key moments. Students control playback (play, pause, step forward/back) and demonstrate comprehension by answering questions. The CORE "how does this process work?" primitive for biology. PERFECT for teaching photosynthesis, cellular respiration, digestion, blood circulation, breathing, pollination, germination, protein synthesis, DNA replication, nutrient absorption, transpiration, and any multi-step biological process. Features sequential stages with narration, visual descriptions, key molecules involved, energy transformations, duration indicators, and comprehension checkpoints that pause the animation. Includes process overview with inputs/outputs and optional chemical equations. Progress tracking with visual stage indicators. Students advance through stages at their own pace and must answer checkpoint questions correctly to demonstrate understanding before continuing. ESSENTIAL for grades 2-8 biology whenever students need to understand sequential processes, mechanisms, and cause-and-effect relationships in living systems.',
    constraints: 'Use for grades 2-8 students learning multi-step biological processes. Grade 2-4: Simple vocabulary, 3-5 stages, basic comprehension checkpoints ("What happens next?", "What is produced?"), minimal molecular details, focus on observable changes. Grade 5-6: Scientific terminology introduced with explanations, 4-6 stages, causal understanding checkpoints ("Why does this happen?", "What is the purpose of X?"), introduce molecular concepts (ATP, glucose, oxygen), include energy transformations. Grade 7-8: Advanced scientific terminology, 5-8 stages, application and synthesis checkpoints ("What would happen if X was removed?", "How does this relate to Y?"), full molecular/cellular details, chemical equations, precise mechanisms. ALWAYS include: (1) clear stage-by-stage narration, (2) 1-3 checkpoint questions at strategic moments, (3) inputs and outputs of the process, (4) visual descriptions for each stage. Scale options: molecular (biochemical reactions), cellular (processes within cells), organ (organ system processes), organism (whole organism processes), ecosystem (environmental processes). Perfect for: photosynthesis, cellular respiration, digestion, circulation, transpiration, germination, protein synthesis, DNA replication, mitosis, meiosis, any sequential biological process. Works well paired with life-cycle-sequencer for developmental sequences or with body-system-explorer for organ-level processes.',
    affordances: { representation: 'pictorial', answers: ['tap'], role: ['visualize', 'apply'], minutes: 6 },
    supportsEvaluation: true,
  },
  {
    id: 'microscope-viewer',
    description: 'Simulated microscope experience with zoom levels, structure labeling tasks, and guided observation prompts. Students examine specimens at increasing magnification (40x, 100x, 400x) through a circular lens viewport, identify and label structures at each level, and respond to observation questions. The PRIMARY "what do you see under the microscope?" primitive for biology. PERFECT for teaching cell biology (plant cells, animal cells, bacteria), tissue types (muscle, epithelial), microorganisms (paramecium, amoeba, euglena), and mineral structures. Bridges the gap between macro observation and micro understanding. Features per-zoom structure hotspots, drag-to-label interaction, guided observation prompts, AI-generated microscope images, and evaluation tracking for labeling accuracy and observation quality. ESSENTIAL for grades 3-8 whenever students need to develop microscopy skills, learn cell structure, practice scientific observation, or understand biological organization at different scales.',
    constraints: 'Use for grades 3-8 students learning cell biology, microscopy, tissue types, or microorganisms. Grade 3-5: Simple vocabulary, 2-3 zoom levels, 2-4 structures per level, focus on observable features and shapes. Grade 6-8: Scientific terminology, 3-4 zoom levels, 3-6 structures per level including organelles, precise descriptions, structure-function connections. Works for any microscope-observable specimen: onion cells, cheek cells, blood cells, elodea, paramecium, amoeba, bacteria, muscle tissue, leaf cross-sections, mineral crystals. Perfect for teaching: cell structure, plant vs animal cells, microscope technique, scientific observation and recording, structure-function relationships.',
    affordances: { representation: 'pictorial', answers: ['tap', 'type'], role: ['visualize', 'apply'], minutes: 6 },
    supportsEvaluation: true,
  },
  {
    id: 'food-web-builder',
    description: 'Interactive food web construction where students draw energy-flow connections between organisms by clicking to create directional arrows. The CORE "who eats whom?" primitive for ecology. Students build complete food webs showing producer → consumer → predator relationships. PERFECT for teaching trophic levels (producer, primary/secondary/tertiary consumer, decomposer), energy transfer through ecosystems, food chains vs food webs, and understanding how organisms are interconnected. Features node-graph interface with positioned organisms, color coding by trophic level, connection tracking with immediate feedback, and optional disruption mode to explore ecosystem cascade effects (keystone species removal, trophic cascades). ESSENTIAL for grades 3-8 ecology whenever students need to visualize feeding relationships, understand energy flow, or explore how removing one species affects an entire ecosystem. Scales from simple linear food chains (3-5) to complex interconnected food webs (6-8).',
    constraints: 'Use for grades 3-8 students learning food chains, food webs, trophic levels, or ecosystem dynamics. Grade 3-5: Simple food chains with 6-8 organisms, clear linear relationships (grass → rabbit → fox), focus on basic producer/consumer/predator progression, optional simple disruption scenario showing predictable effects. Grade 6-8: Complex food webs with 8-10 organisms showing interconnected relationships, organisms with multiple prey and predators, REQUIRED disruption scenarios demonstrating trophic cascades and keystone species effects, emphasis on systems thinking and indirect effects. Perfect for teaching: producers/consumers/decomposers, energy flow, food chains vs food webs, trophic levels, predator-prey relationships, ecosystem balance, keystone species, trophic cascades, population dynamics. Works for any ecosystem: grassland, forest, ocean, coral reef, desert, tundra, pond, wetland. Students click organisms to draw connections showing energy flow direction (arrow from prey → predator). Evaluation tracks connection accuracy, identifies missing/extra connections, and can include disruption prediction assessment for 6-8.',
    affordances: { representation: 'pictorial', answers: ['build'], role: 'apply', minutes: 7 },
    supportsEvaluation: true,
  },
  {
    id: 'adaptation-investigator',
    description: 'Interactive adaptation reasoning primitive that presents an organism\'s trait and guides students to connect structure to function to environment. The "Why does the giraffe have a long neck?" primitive, but rigorous. Three-panel layout: "The Trait" (what it is), "The Environment" (what pressures exist), "The Connection" (how trait addresses the pressure). Higher grades include "What If?" mode where students predict consequences of environmental changes. PERFECT for teaching causal reasoning about adaptations, structure-function relationships, natural selection concepts, and evidence-based explanation. Includes common misconception correction. ESSENTIAL for grades 2-8 whenever students need to understand WHY organisms have specific traits—structural (body parts), behavioral (actions), or physiological (body processes).',
    constraints: 'Use for grades 2-8 students learning about adaptations, natural selection, structure-function relationships, or evolution. Grade 2-4: Simple observable traits (camouflage, thick fur, sharp claws), everyday vocabulary, 2 simple What If? scenarios, focus on "What do you notice?" and "How does this help?". Grade 5-6: Scientific vocabulary introduced (adaptation, selective pressure, fitness), functional descriptions, 2-3 What If? scenarios with moderate reasoning. Grade 7-8: Evolutionary context (natural selection, gene pool, selective advantage), all three adaptation types (structural, behavioral, physiological), 3 nuanced What If? scenarios requiring sophisticated causal reasoning. Perfect for: animal adaptations (camouflage, migration, hibernation), plant adaptations (thorns, deep roots, waxy leaves), physiological adaptations (antifreeze proteins, venom, echolocation). Works well paired with organism-card for reference, classification-sorter for grouping adaptations, or bio-compare-contrast for comparing adapted vs non-adapted organisms.',
    affordances: { representation: 'pictorial', answers: ['tap'], role: ['visualize', 'apply'], minutes: 5 },
    supportsEvaluation: true,
  },
  {
    id: 'cell-builder',
    description: 'Interactive cell-engineering missions for grades 4-8. The adaptive engine can route students to stock a target cell by accepting or rejecting structures, assemble a simplified relationship model with discrete cell regions, connect organelles to their jobs, or tune organelle abundance for a specialized cell mission. Broad objectives can blend missions over one coherent model. Handles animal, plant, prokaryotic, and fungal cells plus muscle, nerve, leaf, root, and other specialized contexts. The placement activity explicitly treats regions as best-fit relationships rather than pretending mobile 3D organelles occupy exact pixel coordinates. PERFECT for cell-type discrimination, structure-function mapping, model construction, and causal reasoning about specialization.',
    constraints: 'Use for grades 4-8 students learning cell structure and organelle functions. Grade 4-5: simpler vocabulary, 5-7 major organelles plus 2-3 distractors, everyday analogies, and simple relative-abundance reasoning. Grade 6-8: scientific terminology, 7-10 organelles plus 3-4 plausible distractors including ER, Golgi apparatus, lysosomes, and ribosomes. Every valid organelle must have one best-fit model region, a distinct function description, a relative abundance, and causal specialization reasoning. The model must never imply that organelles are stationary or that a 2D region is an exact biological coordinate. Use prokaryotic contexts mainly in grades 7-8.',
    affordances: { representation: 'pictorial', answers: ['tap', 'build', 'manipulate'], role: 'apply', minutes: 8 },
    evalModes: [
      {
        evalMode: 'cell_inventory',
        affordances: { answers: ['tap'] },
        label: 'Stock the Cell',
        beta: 2.5,
        scaffoldingMode: 2,
        challengeTypes: ['cell_inventory'],
        description: 'Discriminate structures that belong in a target cell from plausible cell-type distractors.',
      },
      {
        evalMode: 'organelle_placement',
        affordances: { answers: ['build'] },
        label: 'Build the Model',
        beta: 3.5,
        scaffoldingMode: 3,
        challengeTypes: ['organelle_placement'],
        description: 'Place organelles in distinct best-fit relationship regions of a simplified cell model.',
      },
      {
        evalMode: 'structure_function',
        affordances: { answers: ['tap'] },
        label: 'Wire the Jobs',
        beta: 5.0,
        scaffoldingMode: 4,
        challengeTypes: ['structure_function'],
        description: 'Map scientific function descriptions to the organelles that perform them.',
      },
      {
        evalMode: 'cell_specialization',
        affordances: { answers: ['manipulate'] },
        label: 'Tune the Cell',
        beta: 6.5,
        scaffoldingMode: 5,
        challengeTypes: ['cell_specialization'],
        description: 'Reason from a specialized cell mission to relative organelle abundance and biological tradeoffs.',
      },
    ],
    supportsEvaluation: true,
  },
  {
    id: 'inheritance-lab',
    description: 'Interactive Punnett square and trait prediction tool for genetics inheritance education. Students fill in gamete combinations in a Punnett square grid, predict offspring genotypic and phenotypic ratios, and run population simulations to compare predicted vs. observed outcomes. The CORE "what offspring will these parents produce?" primitive for genetics. Handles monohybrid crosses (2x2 grid, grade 6-7), dihybrid crosses (4x4 grid, grade 8), and X-linked inheritance. Supports complete dominance, incomplete dominance, and codominance inheritance patterns. Features parent genotype/phenotype display, interactive fillable Punnett square, automatic answer checking with corrections, population simulation with bar charts comparing expected vs. actual ratios, and real-world trait examples. PERFECT for teaching Mendelian genetics, probability in biology, genotype-phenotype relationships, dominant/recessive alleles, and heredity patterns. ESSENTIAL for grades 6-8 genetics units.',
    constraints: 'Use for grades 6-8 students learning genetics, heredity, and Mendelian inheritance. Grade 6-7: Monohybrid crosses ONLY (2x2 Punnett square), complete dominance only, simple vocabulary ("dominant means shows up when present"), familiar traits (flower color, seed shape, fur color). Grade 8: Can include monohybrid or dihybrid crosses (4x4 Punnett square with 16 cells), incomplete dominance (heterozygote shows intermediate phenotype), codominance (heterozygote shows both phenotypes), X-linked inheritance, scientific vocabulary (heterozygous, homozygous, genotypic ratio). Perfect for: Mendelian genetics, heredity, dominant/recessive traits, genotype prediction, phenotype ratios, probability in biology, trait inheritance, genetic crosses, population genetics simulation.',
    affordances: { representation: 'symbolic', answers: ['type'], role: 'apply', minutes: 8 },
    supportsEvaluation: true,
  },
  {
    id: 'dna-explorer',
    description: 'Interactive DNA structure explorer with double helix visualization, base pairing challenges, zoom levels from chromosome to molecular scale, and nucleotide reference. The CORE "what is DNA made of?" primitive for molecular genetics. Students explore an SVG double helix by clicking bases to learn about nucleotides (A, T, C, G), practice complementary strand construction through build challenges, and navigate zoom levels from chromosome down to individual base pairs. PERFECT for teaching DNA structure, base pairing rules (A-T with 2 hydrogen bonds, C-G with 3 hydrogen bonds), sugar-phosphate backbone, antiparallel orientation, purine vs pyrimidine classification, and the central dogma (DNA → RNA → Protein). Features tabbed interface with Explore (helix + sequence view), Structure (backbone and groove details), Build (complementary strand challenges with feedback), and Zoom Levels (progressive scale exploration). Evaluation tracks build challenge accuracy and zoom level exploration. ESSENTIAL for grades 5-8 genetics and molecular biology whenever students need to understand DNA at the molecular level.',
    constraints: 'Use for grades 5-8 students learning DNA structure, genetics, or molecular biology. Grade 5-6: Base pairing rules only (A-T, C-G), short sequences (6-8 bases), simple vocabulary, structure and base-pairing modes only, 2-3 build challenges, 3 zoom levels. Grade 7-8: Hydrogen bond specifics, longer sequences (8-12 bases), scientific terminology (nucleotide, phosphodiester), all modes including transcription and replication, 3-4 build challenges including error identification, 4-5 zoom levels with molecular detail. Perfect for: DNA structure lessons, complementary base pairing practice, molecular genetics introduction, central dogma overview, nucleotide composition, chromosome structure.',
    affordances: { representation: 'symbolic', answers: ['tap', 'type'], role: ['visualize', 'apply'], minutes: 6 },
    supportsEvaluation: true,
  },
  {
    id: 'protein-folder',
    description: 'Interactive protein folding simulator where students visualize how a linear amino acid chain folds into a 3D structure based on chemical properties. Two-panel layout: left panel shows the amino acid sequence color-coded by property (hydrophobic, hydrophilic, charged, polar), right panel shows a simplified folding visualization. Students classify each residue as interior (hydrophobic core) or surface-facing (hydrophilic shell), then explore "Mutation Mode" where swapping one amino acid changes the fold and disrupts function. Connects mutations to real-world diseases (sickle cell anemia, cystic fibrosis). The CORE "sequence determines shape determines function" primitive for molecular biology. Three learning phases: Explore (learn properties), Fold (classify residue placement), Mutate (predict mutation consequences). PERFECT for teaching protein structure, structure-function relationships, amino acid chemistry, molecular disease mechanisms, and the central dogma of biology. ESSENTIAL for grades 7-8 molecular biology and biochemistry units.',
    constraints: 'Use ONLY for grades 7-8 students learning protein structure, molecular biology, or biochemistry. This is an advanced molecular biology concept NOT appropriate for younger grades. Simplified to 8-14 amino acid residues (not full proteins). Best for: protein structure lessons, structure-function relationships, amino acid chemistry, mutation and disease, sickle cell anemia, cystic fibrosis, protein misfolding diseases, central dogma. Works well paired with dna-explorer (DNA → RNA → Protein pipeline) or bio-process-animator for protein synthesis visualization.',
    affordances: { representation: ['pictorial', 'symbolic'], answers: ['tap', 'type'], role: ['visualize', 'apply'], minutes: 7 },
    supportsEvaluation: true,
  },
  {
    id: 'energy-cycle-engine',
    description: 'Interactive dual-panel model showing the coupled relationship between photosynthesis and cellular respiration. Students manipulate input levels (light intensity, CO₂, glucose, O₂) via sliders and observe how outputs change. Coupling visualization shows shared molecules flowing between chloroplast (photosynthesis) and mitochondrion (respiration). "What If?" experiments let students break one process and observe cascade effects on the other. The CORE "how are photosynthesis and respiration connected?" primitive. PERFECT for teaching systems thinking, energy transformation, input-output reasoning, and the continuous energy cycle in living organisms. Features adjustable sliders, animated molecule flow, process stages with subcellular locations, and experiment prediction with feedback. ESSENTIAL for grades 5-8 whenever students need to understand that photosynthesis and cellular respiration are NOT isolated processes but form a continuous, interdependent energy cycle.',
    constraints: 'Use ONLY for grades 5-8 students learning about photosynthesis, cellular respiration, or energy flow in living systems. Grade 5-6: Simplified vocabulary, 2-3 stages per process, 3-4 experiments with basic cause-and-effect reasoning. Grade 7-8: Full scientific terminology, 3-4 stages with subcellular locations (thylakoid, matrix, cristae), 4-5 experiments requiring systems thinking and cascade reasoning. Perfect for: photosynthesis and respiration lessons, energy transformation, carbon cycle, plant biology, cellular energy, ATP production, comparing photosynthesis to respiration. Works well paired with bio-process-animator for individual process detail, or bio-compare-contrast for photosynthesis vs respiration comparison.',
    affordances: { representation: 'pictorial', answers: ['manipulate', 'tap'], role: ['visualize', 'apply'], minutes: 7 },
    supportsEvaluation: true,
  },
  {
    id: 'evolution-timeline',
    description: 'Interactive deep-time timeline showing evolutionary events, branching points, and the emergence of major groups across geological time. Students navigate billions of years of history, explore mass extinctions, and trace evolutionary lineages. The CORE "when did this happen in the history of life?" primitive for evolution education. Features horizontal scrollable/zoomable timeline with color-coded era bands (Precambrian, Paleozoic, Mesozoic, Cenozoic), clickable event markers that expand to detail cards, "Lineage Trace" mode highlighting single evolutionary paths (fish → amphibians → reptiles → mammals), scale anchors that make deep time tangible ("If Earth\'s history were 24 hours, humans appear at 11:58 PM"), and mass extinction explorer with cause, impact, and aftermath analysis. Handles the fundamental scale problem — 4.5 billion years is hard to grasp — through zoom, era navigation, and multiple scale analogies. PERFECT for teaching evolution, geological time, mass extinctions, adaptive radiation, common ancestry, and the history of life on Earth. ESSENTIAL for grades 4-8 whenever students need to understand WHEN evolutionary events happened, how they relate to each other in time, and what major forces (extinctions, adaptations, environmental changes) shaped the diversity of life.',
    constraints: 'Use for grades 4-8 students learning about evolution, geological time, history of life, mass extinctions, or evolutionary relationships. Grade 4-5: 8-12 events with simple engaging vocabulary, focus on events students recognize (dinosaurs, first animals, first plants), 2-3 lineages with clear linear paths, 2 scale anchors with familiar references (24-hour clock, football field), 2-3 most dramatic mass extinctions, avoid technical geological terms. Grade 6-8: 12-18 events covering molecular evolution through modern humans, scientific vocabulary with explanations, 3-5 lineages showing major transitions (fish to tetrapods, dinosaurs to birds), 2-3 scale anchors with both familiar and scientific references, all 5 major mass extinctions with scientific causes, can include geological terms, plate tectonics, atmospheric changes. Perfect for: history of life on Earth, evolution of specific groups (mammals, birds, flowering plants), mass extinction events, geological time periods, common ancestry and divergence, adaptive radiation. Works well paired with species-profile for individual organisms, life-cycle-sequencer for developmental processes, or bio-compare-contrast for comparing organisms across evolutionary time.',
    affordances: { representation: 'pictorial', answers: ['tap'], role: 'visualize', minutes: 6 },
    supportsEvaluation: true,
  },
];
