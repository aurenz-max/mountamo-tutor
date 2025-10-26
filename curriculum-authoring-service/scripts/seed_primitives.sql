-- ============================================================================
-- Visual Primitives Library - BigQuery Seed Script
-- ============================================================================
-- Run this script directly in the BigQuery console to populate the
-- curriculum_primitives table with all 26 visual primitives.
--
-- INSTRUCTIONS:
-- 1. Open BigQuery Console: https://console.cloud.google.com/bigquery
-- 2. Paste this entire script and run it
-- ============================================================================

INSERT INTO `mountamo-tutor-h7wnta.analytics.curriculum_primitives`
(primitive_id, primitive_name, category, best_for, avoid_for, example, created_at)
VALUES

-- ============================================================================
-- FOUNDATIONAL VISUALS (K-1) - Use these FIRST for early learners
-- ============================================================================

('object-collection',
 'Object Collection',
 'foundational',
 'Counting discrete objects, showing groups of items, simple identification tasks, how many questions',
 'Abstract numerical data, complex data relationships, multi-step comparisons',
 'Show 5 purple balls, display 3 apples and 2 bananas, count the stars',
 CURRENT_TIMESTAMP()),

('comparison-panel',
 'Comparison Panel',
 'foundational',
 'Side-by-side comparison of two object groups, who has more/less questions, direct visual comparison of countable items',
 'Abstract totals without visual objects, single group displays, more than 2 groups',
 'Maya has 3 cookies vs Tom has 5 cookies (show actual cookies in each panel)',
 CURRENT_TIMESTAMP()),

-- ============================================================================
-- MATH VISUALS
-- ============================================================================

('bar-model',
 'Bar Model',
 'math',
 'Comparing ABSTRACT quantities/totals, part-whole relationships with large numbers, data visualization',
 'Counting discrete physical objects (use object-collection instead), problems where actual objects are more intuitive',
 'Team A scored 15 points vs Team B scored 12 points (abstract totals, not physical items)',
 CURRENT_TIMESTAMP()),

('number-line',
 'Number Line',
 'math',
 'Ordering numbers, skip counting, number sequences, showing intervals or ranges',
 'Discrete comparisons without sequence, problems not involving order',
 'Finding numbers between 5 and 10, counting by 2s',
 CURRENT_TIMESTAMP()),

('base-ten-blocks',
 'Base Ten Blocks',
 'math',
 'Place value understanding, regrouping, representing multi-digit numbers visually',
 'Simple single-digit problems, non-base-10 concepts',
 'Showing 23 as 2 tens and 3 ones',
 CURRENT_TIMESTAMP()),

('fraction-circles',
 'Fraction Circles',
 'math',
 'Part-whole fractions, comparing fraction sizes, visual fraction equivalence',
 'Whole number problems, complex fraction operations beyond kindergarten level',
 'Showing 1/4 of a circle shaded',
 CURRENT_TIMESTAMP()),

('geometric-shape',
 'Geometric Shape',
 'math',
 'Shape identification, area/perimeter concepts, spatial reasoning',
 'Problems not involving shapes or spatial properties',
 'Identifying a rectangle with labeled dimensions',
 CURRENT_TIMESTAMP()),

-- ============================================================================
-- SCIENCE VISUALS
-- ============================================================================

('labeled-diagram',
 'Labeled Diagram',
 'science',
 'Showing parts of complex objects, anatomy, multi-component systems, scientific structures',
 'Simple quantity comparisons, basic counting, problems without structural components',
 'Parts of a plant (roots, stem, leaves), parts of an insect',
 CURRENT_TIMESTAMP()),

('cycle-diagram',
 'Cycle Diagram',
 'science',
 'Repeating processes, life cycles, circular sequences that return to start',
 'Linear sequences, one-time events, simple before/after scenarios',
 'Water cycle, butterfly life cycle',
 CURRENT_TIMESTAMP()),

('tree-diagram',
 'Tree Diagram',
 'science',
 'Hierarchical relationships, classification systems, branching decisions',
 'Non-hierarchical groupings, simple lists, sequential processes',
 'Animal classification (mammals to dogs/cats), family trees',
 CURRENT_TIMESTAMP()),

('line-graph',
 'Line Graph',
 'science',
 'Showing change over time, trends, continuous data relationships',
 'Static comparisons, categorical data, problems without continuous variables',
 'Temperature throughout the day, plant growth over weeks',
 CURRENT_TIMESTAMP()),

('thermometer',
 'Thermometer',
 'science',
 'Temperature-specific problems, reading scales, comparing hot/cold',
 'Non-temperature measurements, abstract concepts',
 'Reading temperature on a thermometer, comparing winter vs summer temps',
 CURRENT_TIMESTAMP()),

-- ============================================================================
-- LANGUAGE ARTS VISUALS
-- ============================================================================

('sentence-diagram',
 'Sentence Diagram',
 'language-arts',
 'Parts of speech identification, sentence structure analysis',
 'Vocabulary without grammar context, simple word recognition',
 'Breaking down The cat ran into noun, article, verb',
 CURRENT_TIMESTAMP()),

('story-sequence',
 'Story Sequence',
 'language-arts',
 'Narrative structure (beginning/middle/end), event ordering in stories',
 'Non-narrative texts, single-event descriptions',
 'Sequencing events in a story about a trip to the park',
 CURRENT_TIMESTAMP()),

('word-web',
 'Word Web',
 'language-arts',
 'Vocabulary expansion, word associations, brainstorming related concepts',
 'Grammar exercises, problems requiring specific definitions',
 'Words related to ocean (waves, fish, sand, shells)',
 CURRENT_TIMESTAMP()),

('character-web',
 'Character Web',
 'language-arts',
 'Character analysis, trait identification with evidence',
 'Plot summaries, settings, non-character-focused questions',
 'Describing a character bravery with story evidence',
 CURRENT_TIMESTAMP()),

('venn-diagram',
 'Venn Diagram',
 'language-arts',
 'Comparing/contrasting two items, showing similarities and differences',
 'Single-item descriptions, more than 2-way comparisons (too complex for K)',
 'Comparing cats and dogs (both pets, cats meow, dogs bark)',
 CURRENT_TIMESTAMP()),

-- ============================================================================
-- ABCs/EARLY LITERACY VISUALS
-- ============================================================================

('letter-tracing',
 'Letter Tracing',
 'abcs',
 'Letter formation practice, handwriting instruction, stroke order',
 'Letter recognition without writing, phonics without letter formation',
 'Tracing uppercase A with directional arrows',
 CURRENT_TIMESTAMP()),

('letter-picture',
 'Letter Picture',
 'abcs',
 'Letter-sound correspondence, initial sound identification, phonics',
 'Letter formation, problems not involving initial sounds',
 'Pictures of Apple, Ant, Alligator for letter A',
 CURRENT_TIMESTAMP()),

('alphabet-sequence',
 'Alphabet Sequence',
 'abcs',
 'Alphabetical order, missing letter identification, sequence completion',
 'Single letter recognition, phonics without order context',
 'A, B, _, D (finding missing C)',
 CURRENT_TIMESTAMP()),

('rhyming-pairs',
 'Rhyming Pairs',
 'abcs',
 'Rhyme identification, phonological awareness, word families',
 'Non-rhyming word problems, letter recognition',
 'Matching cat with hat, showing pictures',
 CURRENT_TIMESTAMP()),

('sight-word-card',
 'Sight Word Card',
 'abcs',
 'High-frequency word recognition, sight word practice in context',
 'Decodable words, complex sentences beyond sight word focus',
 'Showing the in large text with sentence The cat runs',
 CURRENT_TIMESTAMP()),

('sound-sort',
 'Sound Sort',
 'abcs',
 'Phoneme categorization, sorting by initial/final sounds, vowel sounds',
 'Letter naming, problems not involving sound discrimination',
 'Sorting words by short a vs short e sounds',
 CURRENT_TIMESTAMP());

-- ============================================================================
-- Verification Query - Run this after the INSERT to confirm
-- ============================================================================
-- SELECT
--   category,
--   COUNT(*) as count,
--   STRING_AGG(primitive_name, ', ' ORDER BY primitive_name) as primitives
-- FROM `mountamo-tutor-h7wnta.analytics.curriculum_primitives`
-- GROUP BY category
-- ORDER BY category;
