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
    constraints: 'Use for K-8 students. Automatically adapts complexity based on grade level: K-2 shows only basic attributes with simple language; 3-5 adds body temperature, reproduction, and adaptations; 6-8 includes full taxonomic classification. Perfect for comparison activities, classification lessons, ecosystem studies, and building biology vocabulary. Use multiple organism-cards together for compare/contrast activities.'
  },
  {
    id: 'species-profile',
    description: 'Comprehensive species profile with detailed information including physical characteristics (height, weight, length with real-world comparisons), diet and behavior, habitat and geographic/temporal distribution, complete taxonomic classification, ecological niche, fascinating facts, and discovery history. PERFECT for dinosaur lessons, animal studies, extinct species, modern wildlife, and comparative biology. Includes AI-generated species images in natural habitats. ESSENTIAL for K-5 biology, paleontology, zoology, and natural history topics. Students love learning about T-Rex, Velociraptors, Triceratops, and other fascinating creatures with this engaging format.',
    constraints: 'Best for K-8 students learning about animals, dinosaurs, plants, or any biological species. Use for life sciences, paleontology, zoology, botany, ecology, and natural history. Ideal for teaching classification systems, adaptations, food chains, habitats, and evolutionary concepts. Works great for extinct and living species.'
  },
  {
    id: 'classification-sorter',
    description: 'Interactive drag-and-drop classification activity where students categorize organisms or characteristics into labeled bins. The CORE "is it a ___?" primitive for biology. Handles binary sorts (vertebrate/invertebrate, producer/consumer), multi-category sorts (mammal/reptile/amphibian/bird/fish, kingdoms), and property-based sorts (has bones/no bones, warm-blooded/cold-blooded, makes own food/eats food). PERFECT for teaching classification skills, taxonomic thinking, characteristic discrimination, and decision-making based on biological criteria. Includes helpful hints on incorrect placements and tracks first-attempt accuracy. Can be hierarchical (Kingdom → Phylum → Class) at grades 6-8. ESSENTIAL for K-8 biology whenever students need to practice sorting, classifying, or discriminating between organisms based on characteristics.',
    constraints: 'Use for K-8 students learning classification, taxonomy, or characteristic-based sorting. K-2: Binary sorts only (2 categories, 6-8 items, simple language). 3-5: Multi-category sorts (3-5 categories, 8-10 items, introduces scientific vocabulary). 6-8: Complex or hierarchical sorts (3-6 categories, 10-12 items, formal classification systems). Always include 1-3 "boundary case" items (platypus, bat, dolphin, penguin) that challenge student thinking. Perfect for formative assessment and skill-building. Works for any classification topic: animal classes, kingdoms, habitats, diets, adaptations, life cycles, plant types, etc.'
  },
  {
    id: 'life-cycle-sequencer',
    description: 'Interactive temporal sequencing activity where students arrange stages of a biological process in correct temporal order. The CORE "what happens next?" primitive for biology. Covers organismal life cycles (butterfly metamorphosis, frog development, plant growth, human lifecycle), cellular processes (mitosis phases, meiosis, cell cycle), and ecological cycles (water cycle, carbon cycle, nitrogen cycle, rock cycle). PERFECT for teaching temporal relationships, transformation, developmental sequences, and understanding change over time. Features drag-and-drop stage cards with visual placeholders, descriptions, durations, and transition explanations. Linear layout for developmental sequences (embryo → adult), circular layout for repeating cycles (water cycle, seasons). Shows connecting arrows with transition explanations when correct. Includes misconception traps to address common errors. ESSENTIAL for K-8 biology whenever students need to understand sequences, life stages, cycles, or temporal processes.',
    constraints: 'Use for K-8 students learning life cycles, developmental sequences, or cyclical processes. K-2: Simple linear sequences (4-6 stages, basic vocabulary, observable changes like "seed grows into plant"). 3-5: More complex linear or circular cycles (5-7 stages, scientific terms introduced, mechanisms explained like "tadpole loses tail and grows legs"). 6-8: Complex cycles with molecular details (6-8 stages, cellular/molecular mechanisms, precise scientific terminology like "chromatin condenses into chromosomes"). Linear for one-direction processes (embryo to adult), circular for repeating cycles (water cycle, cell division). Always include stage durations, transition explanations, and one common misconception with correction. Perfect for any temporal biology topic: metamorphosis, germination, human development, cellular processes, biogeochemical cycles, seasonal changes, etc.'
  },
];
