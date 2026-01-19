import { Type, Schema, ThinkingLevel } from "@google/genai";

import {
  ExhibitManifest,
  ComponentDefinition,
  ManifestItem,
} from "../../types";

import { ai } from "../geminiClient";

/**
 * Convert objective-centric manifest to flat layout array for backward compatibility
 * This allows the existing rendering pipeline to work with the new manifest format
 */
export const flattenManifestToLayout = (manifest: ExhibitManifest): ManifestItem[] => {
  const layout: ManifestItem[] = [];

  // 1. Add curator brief first
  if (manifest.curatorBrief) {
    layout.push({
      componentId: 'curator-brief',
      instanceId: manifest.curatorBrief.instanceId,
      title: manifest.curatorBrief.title,
      intent: manifest.curatorBrief.intent,
      objectiveIds: manifest.objectiveBlocks?.map(b => b.objectiveId) || []
    });
  }

  // 2. Add all components from each objective block
  if (manifest.objectiveBlocks) {
    for (const block of manifest.objectiveBlocks) {
      for (const component of block.components) {
        layout.push({
          componentId: component.componentId,
          instanceId: component.instanceId,
          title: component.title,
          intent: component.intent,
          config: {
            ...component.config,
            // Inject objective context into config for content generators
            objectiveId: block.objectiveId,
            objectiveText: block.objectiveText,
            objectiveVerb: block.objectiveVerb,
          },
          objectiveIds: [block.objectiveId]
        });
      }
    }
  }

  // 3. Add final assessment last
  if (manifest.finalAssessment) {
    layout.push({
      componentId: manifest.finalAssessment.componentId,
      instanceId: manifest.finalAssessment.instanceId,
      title: manifest.finalAssessment.title,
      intent: manifest.finalAssessment.intent,
      config: manifest.finalAssessment.config,
      objectiveIds: manifest.objectiveBlocks?.map(b => b.objectiveId) || []
    });
  }

  return layout;
};

/**
 * Enrich manifest with flattened layout for backward compatibility
 */
export const enrichManifestWithLayout = (manifest: ExhibitManifest): ExhibitManifest => {
  return {
    ...manifest,
    layout: flattenManifestToLayout(manifest)
  };
};

/**
 * Convert grade level to descriptive educational context for prompts
 */
const getGradeLevelContext = (gradeLevel: string): string => {
  const contexts: Record<string, string> = {
    'toddler': 'toddlers (ages 1-3) - Use very simple language, basic concepts, concrete examples, and playful engagement. Focus on sensory experiences and foundational learning.',
    'preschool': 'preschool children (ages 3-5) - Use simple sentences, colorful examples, storytelling, and hands-on concepts. Build curiosity and wonder.',
    'kindergarten': 'kindergarten students (ages 5-6) - Use clear language, relatable examples, foundational skills, and engaging visuals. Encourage exploration and basic problem-solving.',
    'elementary': 'elementary students (grades 1-5) - Use age-appropriate vocabulary, concrete examples, structured learning objectives, and interactive elements. Build fundamental understanding.',
    'middle-school': 'middle school students (grades 6-8) - Use more complex vocabulary, abstract concepts, real-world applications, and critical thinking opportunities. Encourage deeper analysis.',
    'high-school': 'high school students (grades 9-12) - Use advanced vocabulary, sophisticated concepts, academic rigor, and college-prep content. Foster analytical and creative thinking.',
    'undergraduate': 'undergraduate college students - Use academic language, theoretical frameworks, research-based content, and interdisciplinary connections. Promote scholarly engagement.',
    'graduate': 'graduate students (Master\'s level) - Use specialized terminology, advanced theoretical concepts, research methodologies, and professional applications. Encourage critical scholarship.',
    'phd': 'doctoral students and researchers - Use expert-level terminology, cutting-edge research, theoretical depth, and scholarly discourse. Foster original thinking and research contributions.'
  };

  return contexts[gradeLevel] || contexts['elementary'];
};


// ============================================================================
// MANIFEST-FIRST ARCHITECTURE
// ============================================================================

/**
 * Universal Catalog - All available components for manifest generation
 */
export const UNIVERSAL_CATALOG: ComponentDefinition[] = [
  {
    id: 'curator-brief',
    description: 'Introduction, learning objectives, and hook. REQUIRED: Always include this first.',
    constraints: 'Must be first component'
  },
  {
    id: 'concept-card-grid',
    description: 'A set of 3-4 distinct key terms or concepts defined with visuals. Use for vocabulary or core principles.'
  },
  {
    id: 'bar-model',
    description: 'Comparative bar visualization showing relative values. Perfect for comparing quantities, showing differences, or teaching basic arithmetic comparisons. ESSENTIAL for elementary math.',
    constraints: 'Requires numeric values to compare'
  },
  {
    id: 'number-line',
    description: 'Interactive number line with highlighted points. Perfect for teaching addition, subtraction, counting, number sequencing, and basic operations. ESSENTIAL for toddlers/kindergarten/elementary math.',
    constraints: 'Requires numeric range and values to highlight'
  },
  {
    id: 'base-ten-blocks',
    description: 'Place value visualization using hundreds, tens, and ones blocks. Perfect for teaching place value, decomposing numbers, and understanding multi-digit numbers. ESSENTIAL for elementary math.',
    constraints: 'Requires a whole number to decompose (best for numbers 1-999)'
  },
  {
    id: 'fraction-circles',
    description: 'Visual pie charts showing fractional parts. Perfect for teaching fractions, parts of a whole, equivalent fractions, and basic fraction comparison. ESSENTIAL for elementary math.',
    constraints: 'Requires fraction values (numerator/denominator)'
  },
  {
    id: 'fraction-bar',
    description: 'Interactive rectangular bar models showing fractional parts with adjustable partitions. Perfect for teaching fractions, equivalent fractions, comparing fractions, and fraction operations. Students can click to shade/unshade parts. ESSENTIAL for elementary math.',
    constraints: 'Requires fraction values (numerator/denominator). Supports multiple bars for comparison.'
  },
  {
    id: 'place-value-chart',
    description: 'Interactive place value chart showing digit positions from millions to thousandths. Perfect for teaching place value, decimal notation, expanded form, and number decomposition. Students can edit digits to explore different numbers. ESSENTIAL for elementary math.',
    constraints: 'Best for numbers with clear place value structure (whole numbers and decimals)'
  },
  {
    id: 'area-model',
    description: 'Visual area model for multiplication using rectangles divided by factor decomposition. Perfect for teaching multi-digit multiplication, distributive property, partial products, binomial multiplication (FOIL), and polynomial expansion. Shows how (a+b)×(c+d) breaks into partial products. ESSENTIAL for grades 3-8 math and algebra.',
    constraints: 'Requires two factors that can be decomposed (e.g., 23×15 or (x+3)(x+5)). Supports both numeric and algebraic modes.'
  },
  {
    id: 'array-grid',
    description: 'Rectangular array of discrete objects (dots, squares, stars) arranged in rows and columns. Perfect for teaching multiplication introduction, repeated addition, skip counting, commutative property, area concepts, and combinatorics. Interactive highlighting by row, column, or cell. ESSENTIAL for elementary multiplication (grades 2-5).',
    constraints: 'Best for multiplication facts and concrete counting. Keep arrays reasonable size (2-10 rows, 2-12 columns).'
  },
  {
    id: 'double-number-line',
    description: 'Two parallel horizontal number lines with independent scales showing proportional relationships between quantities. Points on one line correspond to points on the other, visualized with vertical alignment guides. Perfect for teaching ratios, unit rates, proportional relationships, measurement conversions, percent problems, and speed/distance relationships. Critical bridge from additive to multiplicative reasoning. ESSENTIAL for grades 5-8 ratios and proportions.',
    constraints: 'Requires two quantity labels and proportional relationship. Best with 3-5 linked corresponding points. Ideal for unit rate exploration.'
  },
  {
    id: 'tape-diagram',
    description: 'Rectangular bars divided into labeled segments representing part-part-whole and comparison relationships. The single most versatile visual for word problems from elementary through algebra. Perfect for addition/subtraction word problems, comparison problems (more than, less than), multi-step word problems, ratio and proportion, and algebraic equation setup. Students click segments to explore values. Supports unknown segments marked with "?" for algebra. ESSENTIAL for word problem solving (grades 1-algebra).',
    constraints: 'Requires clear part-whole or comparison relationship. Use 1 bar for part-whole problems, 2+ bars for comparison. Can include unknown segments for algebra (marked with isUnknown: true).'
  },
  {
    id: 'factor-tree',
    description: 'Visual tree diagram showing prime factorization of a number. Perfect for teaching prime numbers, composite numbers, factor decomposition, greatest common factor (GCF), least common multiple (LCM), and divisibility rules. Interactive branches show the breakdown process from composite numbers to prime factors. ESSENTIAL for grades 4-6 number theory.',
    constraints: 'Requires a composite number (not prime). Best for numbers with interesting factorizations (e.g., 24, 36, 48, 60, 72).'
  },
  {
    id: 'ratio-table',
    description: 'Structured table showing equivalent ratios in rows with columns for each quantity in the ratio relationship. Perfect for teaching equivalent ratios, unit rates, proportional reasoning, scaling relationships, and ratio problem-solving. Shows multiplicative relationships between rows. ESSENTIAL for grades 5-7 ratios and proportions.',
    constraints: 'Requires a ratio relationship between 2-3 quantities. Best with 3-5 rows showing equivalent ratios.'
  },
  {
    id: 'percent-bar',
    description: 'Horizontal bar model with percentage markings showing the relationship between a part and whole. Perfect for teaching percentages, percent of a quantity, discounts, tax, tips, percent increase/decrease, and part-to-whole relationships. Visual representation with 0% to 100% scale. ESSENTIAL for grades 6-8 percent concepts.',
    constraints: 'Requires a percent value and context (total amount). Best for concrete percent problems with real-world applications.'
  },
  {
    id: 'balance-scale',
    description: 'Interactive balance scale showing equality and equation solving. Perfect for teaching algebraic thinking, equation solving, equality concepts, conservation of equality, inverse operations, and maintaining balance. Visual representation of "what you do to one side, do to the other." ESSENTIAL for pre-algebra and algebra (grades 5-8).',
    constraints: 'Requires an equation or equality relationship. Best for linear equations and simple algebraic expressions. Shows balanced or unbalanced states.'
  },
  {
    id: 'function-machine',
    description: 'Visual "machine" with input hopper, rule display, and output chute. Numbers enter, get transformed by the rule, and exit. Perfect for teaching input/output patterns, function concepts, function notation f(x), linear functions, composition of functions, and inverse functions. Students can drop values in, watch transformations, and guess the rule from input-output pairs. ESSENTIAL for grades 3-4 patterns, grades 5-8 function introduction, and Algebra 1-2 function concepts.',
    constraints: 'Requires a transformation rule using variable x (e.g., "x+3", "2*x", "x^2"). Best for discovery mode (hide rule) or learning mode (show rule). Supports one-step, two-step, and expression rules.'
  },
  {
    id: 'coordinate-graph',
    description: 'Full-featured 2D Cartesian coordinate plane for plotting points, graphing lines, curves, and functions. Perfect for teaching ordered pairs, linear equations, slope, intercepts, systems of equations, quadratic functions, and function families. Students can click to plot points, view graphed equations, trace curves to read coordinates, and identify key features like intercepts. ESSENTIAL for grades 5-6 (ordered pairs), grades 7-8 (linear equations), Algebra 1-2 (function graphing), and Precalculus (function transformations).',
    constraints: 'Requires axis ranges (xRange, yRange). Supports plotMode: "points" for plotting practice or "equation" for graphing functions. Equations must use y= format with * for multiplication and ** for exponents (e.g., "y = 2*x + 1", "y = x**2 - 4*x + 3").'
  },
  {
    id: 'slope-triangle',
    description: 'Interactive right triangle overlay on a linear graph showing rise and run for slope visualization. Perfect for teaching slope concept, rise over run, Δy/Δx notation, rate of change, angle of inclination, and connecting slope to trigonometry. Students can drag triangles along the line, resize them to see different rise/run pairs, toggle between rise/run and delta notation, and view angle measurements. Shows that different-sized triangles on the same line always yield the same slope. ESSENTIAL for grades 7-8 (slope introduction), Algebra 1 (slope calculation, linear equations), Geometry (parallel/perpendicular lines, angles), and Precalculus (connecting slope to tangent).',
    constraints: 'Requires a linear equation to attach triangles to. Equations must use y= format with * for multiplication (e.g., "y = 2*x + 1"). Best for linear functions with clear, visible slopes. Can show 1-3 triangles at different positions or sizes.'
  },
  {
    id: 'systems-equations-visualizer',
    description: 'Comprehensive systems of linear equations visualizer combining graphical and algebraic solution methods. Perfect for teaching solving systems by graphing, substitution, and elimination methods. Displays 2-3 equations graphed simultaneously with intersection points highlighted. Side-by-side panels show graphical solution and step-by-step algebraic work. Students can toggle between solution methods, view animated step-by-step solutions, and understand system classification (one solution, no solution, infinite solutions). ESSENTIAL for grade 8 (systems introduction), Algebra 1 (solving systems, graphing method), and Algebra 2 (complex systems, choosing efficient methods).',
    constraints: 'Requires 2-3 linear equations in y = mx + b format. Equations must use * for multiplication (e.g., "y = 2*x + 1"). Include intersection point for systems with one solution. Provide step-by-step algebraic solution based on chosen method (graphing, substitution, or elimination). Best for integer or simple decimal solutions at grades 8-Algebra 1.'
  },
  {
    id: 'matrix-display',
    description: 'Interactive m×n matrix display and editor with comprehensive step-by-step operations including determinant calculation, matrix inverse, transpose, multiplication, addition, row operations, and augmented matrix solving. Perfect for teaching matrix concepts, organizing data in rows and columns, matrix arithmetic, determinants, inverse matrices, geometric transformations, and solving systems of linear equations using matrices. Features detailed animated explanations for each operation step, highlighting cells involved in calculations, displaying intermediate results, and providing educational context. Shows formulas, calculations, and WHY each step is performed. Supports 2×2 to 4×4 matrices with optional cell editing, operation buttons, and augmented matrix display for system solving. ESSENTIAL for grade 7-8 (data organization in matrices), Algebra 2 (matrix operations, determinants, solving systems with matrices), Precalculus (matrix transformations, inverses), and Linear Algebra (all matrix operations, eigenvalues).',
    constraints: 'Matrix dimensions typically 2×2 to 4×4 (or 2×3 to 3×4 for augmented). Use simple integers for elementary/middle school, include fractions/decimals for advanced topics. For determinant visualization, show step-by-step calculation with cell highlighting. For inverse, show method (adjugate for 2×2, Gaussian elimination for 3×3+). For row operations, label each operation clearly (e.g., "R₂ - 2R₁ → R₂"). Include educational explanations that can be toggled. Ensure all step-by-step operations show intermediate matrices with proper highlighting.'
  },
  {
    id: 'dot-plot',
    description: 'Interactive dot plot (also called line plot) with stacked dots representing data values on a number line. Perfect for teaching data representation, frequency concepts, mean, median, mode, data distribution shape, and comparing datasets. Students click to add/remove data points, view frequency at each value, and calculate statistical measures. Supports parallel dot plots for comparing two datasets (e.g., morning vs afternoon temperatures). Stack styles include dots, X marks, or custom icons. ESSENTIAL for grades 2-3 (counting and data representation), grades 3-4 (frequency concepts), grades 5-6 (mean, median, mode), and grades 6-7 (data distribution, comparing datasets).',
    constraints: 'Requires number line range [min, max] and data points array. Data values should be within the range. For younger grades (2-3), use small whole numbers (0-10) and disable statistics. For grades 5+, enable showStatistics for mean/median/mode. For comparison activities, enable parallel mode with labeled datasets. Keep data size manageable: 8-20 values per dataset.'
  },
  {
    id: 'histogram',
    description: 'Interactive histogram (bar chart showing frequency distribution) with adjustable bin widths. Perfect for teaching grouped data, distribution shapes (normal, skewed, bimodal), data analysis, and statistics. Students can adjust bin width to see how distribution shape changes, add/remove data points, and optionally overlay a normal curve. Shows frequency labels on bars and calculates statistics (mean, standard deviation, min, max, skewness). ESSENTIAL for grades 6-7 (grouped data, distribution shape), grades 7-Statistics (comparing distributions), and Statistics courses (normal distribution, data analysis).',
    constraints: 'Requires data array with 15-50 numeric values. binWidth and binStart define the histogram bins. For younger grades (6-7), use showFrequency: true and showCurve: false. For statistics lessons about normal distribution, enable showCurve: true. Set editable: true to allow students to explore bin width adjustments.'
  },
  {
    id: 'two-way-table',
    description: 'Interactive two-way table (contingency table) for categorical data with convertible Venn diagram view. Perfect for teaching categorical data organization, joint and marginal frequencies, conditional probability, set relationships (union, intersection), and independence testing. Students can click cells to see joint, marginal, and conditional probabilities. Supports table view, Venn diagram view, or both. Venn diagram circles dynamically size based on set proportions and intersection. Toggle between frequencies and relative frequencies (probabilities). ESSENTIAL for grade 7 (categorical data, set relationships), grade 7-Statistics (joint probability, conditional probability), and Statistics courses (independence testing, contingency tables).',
    constraints: 'Requires rowCategories and columnCategories arrays (2-4 categories each), and 2D frequencies array matching dimensions. For Venn diagram view, use 2x2 tables. For grade 7, use displayMode: "both" to show table and Venn. For Statistics, use showProbabilities toggle. Set editable: true for exploration, false for assessment. Include questionPrompt for guided probability questions.'
  },
  {
    id: 'geometric-shape',
    description: 'Interactive geometric shape with labeled properties. Perfect for teaching shape properties, perimeter, area, angles, vertices, and spatial reasoning. ESSENTIAL for elementary geometry.',
    constraints: 'Requires a shape name and measurable properties'
  },
  {
    id: 'graph-board',
    description: 'Interactive polynomial graphing board where users plot points and visualize fitted polynomial curves. Use for algebra, functions, data analysis, or polynomial interpolation concepts.',
    constraints: 'Best for middle-school and above. Requires mathematical/data analysis context.'
  },
  {
    id: 'comparison-panel',
    description: 'Side-by-side comparison of two entities. Use when distinct "A vs B" analysis aids understanding.'
  },
  {
    id: 'generative-table',
    description: 'Structured rows/columns. Use for datasets, timelines, or categorical attributes.'
  },
  {
    id: 'custom-visual',
    description: 'A bespoke HTML/JS simulation or SVG diagram. Use for complex systems (biology, physics, counting games) that standard math visuals cannot handle. TIP: Provide config with subject, keyTerms, and conceptsCovered for richer content.'
  },
  {
    id: 'formula-card',
    description: 'Mathematical formula display with LaTeX. Use for equations, theorems, or scientific formulas.',
    constraints: 'Requires mathematical formulas'
  },
  {
    id: 'sentence-analyzer',
    description: 'Linguistic breakdown of sentence structure. Use for grammar, syntax, or language learning.',
    constraints: 'Requires language/grammar content'
  },
  {
    id: 'feature-exhibit',
    description: 'Deep-dive editorial section with multiple subsections. Use for comprehensive exploration of a topic.'
  },
  {
    id: 'knowledge-check',
    description: 'Multiple choice quiz question. RECOMMENDED: Include at the end to assess understanding.',
    constraints: 'Typically one per exhibit, at the end'
  },
  {
    id: 'scale-spectrum',
    description: 'Interactive spectrum for placing items along a continuum. Use for teaching nuanced judgments, degrees of intensity, moral/ethical reasoning, or comparative analysis.',
    constraints: 'Best for middle-school and above. Requires items that can be meaningfully positioned on a spectrum.'
  },
  {
    id: 'annotated-example',
    description: 'Step-by-step worked example with multi-layer annotations (procedural steps, strategic thinking, common errors, conceptual connections). Use for demonstrating problem-solving processes in math, science, or any domain requiring systematic reasoning.',
    constraints: 'Best for elementary and above. Requires a well-defined problem with clear solution steps.'
  },
  {
    id: 'nested-hierarchy',
    description: 'Interactive tree structure for exploring hierarchical systems (organizational charts, taxonomies, system architectures, anatomical structures). Users navigate through expandable nodes to see relationships and detailed information about each component.',
    constraints: 'Best for topics with clear hierarchical organization (2-4 levels deep). Use for biology (body systems), government (branches), classification systems, or any nested organizational structure.'
  },
  {
    id: 'image-panel',
    description: 'AI-generated images for visual context (maps, diagrams, illustrations, historical scenes, scientific visualizations). Subject-agnostic - works for geography, history, science, literature, art, or any topic requiring visual representation.',
    constraints: 'Best for topics that benefit from visual representation. Automatically categorizes and styles based on subject matter.'
  },
  {
    id: 'take-home-activity',
    description: 'Hands-on activity using common household materials. Screen-free learning experience with step-by-step instructions, safety notes, reflection prompts, and optional extensions. Perfect for reinforcing concepts through kinesthetic learning and real-world application.',
    constraints: 'Best for science experiments, math manipulatives, art projects, or any topic that benefits from hands-on exploration. Automatically adapts complexity and safety guidance to grade level.'
  },
  {
    id: 'word-builder',
    description: 'Interactive morphology lab where students construct complex words from roots, prefixes, and suffixes to understand their meaning. Drag-and-drop construction with visual breakdown showing how word parts combine. Perfect for vocabulary development, etymology, and morphological analysis in language arts.',
    constraints: 'Best for grades 3-8. Requires words that can be meaningfully broken into morphological components (prefixes, roots, suffixes).'
  },
  {
    id: 'molecule-viewer',
    description: 'Interactive 3D molecular structure visualization with CPK-colored atoms and chemical bonds. Perfect for chemistry lessons on molecular structure, bonding, organic compounds, crystal lattices, proteins, and biochemistry. Features interactive atom selection, bond analysis, and auto-rotating 3D view. HIGHLY RECOMMENDED for any chemistry topic involving molecular structure.',
    constraints: 'Best for middle-school and above. Use for chemistry, biochemistry, organic chemistry, crystal structures, or any topic involving molecules, atoms, and chemical bonds.'
  },
  {
    id: 'periodic-table',
    description: 'Interactive periodic table of all 118 elements with detailed element information, electron shell visualization, stability charts, and category filtering. Perfect for teaching element properties, electron configuration, periodic trends, atomic structure, chemical categories, and the organization of the periodic table. Features clickable elements with modal views showing atomic number, mass, electron shells, valence electrons, phase, and band of stability.',
    constraints: 'Best for middle-school and above. Use for chemistry lessons on periodic trends, element properties, atomic structure, electron configuration, or chemical families. Ideal for introducing the periodic table or exploring specific element groups.'
  },
  {
    id: 'media-player',
    description: 'Audio-visual lesson player with synchronized narration and images. Multi-segment interactive presentation where each segment has AI-generated voiceover narration and accompanying visuals. Perfect for step-by-step explanations, processes, stories, or any content that benefits from multimedia presentation. Features play/pause controls, progress tracking, and segment navigation.',
    constraints: 'Best for topics that benefit from sequential, narrative-driven explanation (processes, stories, step-by-step concepts). Each lesson typically has 3-5 segments. Works for all grade levels - narration and visuals adapt to audience.'
  },
  {
    id: 'flashcard-deck',
    description: 'Interactive flashcard deck for rapid-fire memorization and active recall practice. Students flip cards to reveal answers, mark whether they know each concept, and track their progress. Perfect for vocabulary, key terms, formulas, definitions, facts, language learning, or any content requiring rote memorization. Features 3D flip animations, keyboard shortcuts, audio feedback, shuffle mode, and performance statistics.',
    constraints: 'Best for content with discrete facts or term-definition pairs. Typically generates 12-20 cards per deck. Ideal for review, test prep, or building fluency. Works for all grade levels - vocabulary and definitions adapt to audience. Use when students need active recall practice rather than passive reading.'
  },
  {
    id: 'image-comparison',
    description: 'Interactive before/after image slider for visualizing transformations, processes, or changes. Students drag a slider to reveal differences between two AI-generated images showing a progression (e.g., caterpillar to butterfly, light refraction, cell division, historical changes). Perfect for science processes, biological transformations, physical phenomena, historical evolution, cause-and-effect relationships, or any concept involving visual change over time. Includes educational explanations and key takeaways.',
    constraints: 'Best for topics with clear visual transformations or progressive states. Works for all subjects - science (metamorphosis, phase changes, reactions), history (before/after events), geography (erosion, urban development), biology (life cycles, cellular processes), physics (states of matter, optical phenomena). The AI automatically determines the most educational before/after progression for the topic.'
  },
  // Engineering Primitives (K-5 STEM)
  {
    id: 'lever-lab',
    description: 'Interactive lever/fulcrum simulation for teaching simple machines. Students explore balance, mechanical advantage, and force trade-offs by manipulating loads, fulcrum position, and effort force. Features multiple themes (seesaw, excavator, crowbar) to connect abstract physics to real-world tools. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for elementary engineering and physics.',
    constraints: 'Best for grades K-5. Use for simple machines, balance concepts, mechanical advantage, force multiplication. Themes adapt complexity: seesaw for K-2 (basic balance), excavator/crowbar for 3-5 (mechanical advantage). Supports both exploration (movable fulcrum) and problem-solving (fixed challenges).'
  },
  {
    id: 'pulley-system-builder',
    description: 'Interactive pulley system simulation for teaching mechanical advantage and simple machines. Students build and explore pulley configurations by adding fixed and movable pulleys, threading rope, and lifting loads. Shows how cranes, flagpoles, wells, and construction hoists work. Features multiple themes (crane, flagpole, well, construction) to connect physics to real-world applications. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching pulleys and mechanical advantage.',
    constraints: 'Best for grades K-5. Use for pulleys, mechanical advantage, force reduction, rope systems. Themes adapt complexity: flagpole for K-1 (direction change), well for 1-2 (fixed vs movable), crane/construction for 3-5 (mechanical advantage calculations). Supports exploration (add pulleys) and guided challenges (fixed configurations).'
  },
  {
    id: 'ramp-lab',
    description: 'Interactive inclined plane (ramp) simulation for teaching simple machines. Students explore how ramps reduce the force needed to lift objects by trading distance for effort. Adjust angle, friction, and push force to see how steeper ramps require more force. Shows real-world connections: loading docks, wheelchair ramps (ADA), dump trucks, skateboard ramps. Features multiple themes (loading_dock, dump_truck, skateboard, generic) and load types (box, barrel, wheel). Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching inclined planes and force trade-offs.',
    constraints: 'Best for grades K-5. Use for inclined planes, ramps, force reduction, friction effects. K-1: rolling vs sliding exploration (wheel vs box). 1-2: steeper = harder to push. 2-3: height vs length trade-off. 4-5: mechanical advantage calculations, force decomposition. Themes adapt context: skateboard for fun exploration, loading_dock/dump_truck for real-world applications.'
  },
  {
    id: 'wheel-axle-explorer',
    description: 'Interactive wheel and axle simulation for teaching simple machines and force multiplication. Students rotate wheels of different sizes connected to axles to discover how steering wheels, doorknobs, winches, and well cranks multiply force. Adjust wheel and axle diameters to see how larger wheels make turning easier. Attach loads to axle to simulate lifting with a winch. Shows real-world connections: steering wheel, doorknob, well crank, winch, screwdriver. Features multiple themes (steering_wheel, winch, doorknob, well_crank) to connect physics to everyday objects. Perfect for K-5 engineering and NGSS simple machines standards. ESSENTIAL for teaching wheel and axle machines and gear ratios.',
    constraints: 'Best for grades K-5. Use for wheel and axle, force multiplication, gear ratios. K-1: doorknobs are easier than handles (doorknob theme). 1-2: well cranks and turning (well_crank theme). 2-3: bigger wheel = easier turn (winch theme). 4-5: mechanical advantage calculations, gear ratio introduction (steering_wheel theme). Supports exploration (adjustable sizes) and challenges (fixed configurations with loads to lift).'
  },
  {
    id: 'foundation-explorer',
    description: 'Objective-driven concept exploration with clear diagrams, definitions, and self-checks. Shows a central diagram with multiple labeled concepts that students explore one at a time. Self-check questions match the learning objective verb (IDENTIFY, EXPLAIN, APPLY). BEST for IDENTIFY objectives where students need to learn foundational vocabulary and recognize key parts/components of a system. Use when introducing 2-4 core concepts that students must master before deeper learning.',
    constraints: 'Best for IDENTIFY and EXPLAIN objectives. Requires 2-4 foundational concepts with clear visual representations. Works across all subjects: science (parts of a cell), engineering (parts of a lever), language arts (parts of a sentence), math (components of an equation). Always connects to a specific learning objective from the curator brief.'
  }
];

/**
 * Schema for a single component within an objective
 */
const objectiveComponentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    componentId: {
      type: Type.STRING,
      enum: UNIVERSAL_CATALOG.map(c => c.id),
      description: "Component type from the universal catalog"
    },
    instanceId: {
      type: Type.STRING,
      description: "Unique identifier for this instance (e.g., 'obj1-number-line-1', 'obj2-concept-cards')"
    },
    title: {
      type: Type.STRING,
      description: "Display title/heading for this section"
    },
    intent: {
      type: Type.STRING,
      description: "Detailed instructions for what content to generate. MUST directly address the parent objective."
    },
    config: {
      type: Type.OBJECT,
      description: "Optional configuration hints and educational context",
      properties: {
        visualType: { type: Type.STRING, description: "Type of visualization (e.g., 'bar-model', 'number-line')" },
        itemCount: { type: Type.NUMBER, description: "Number of items to generate" },
        difficulty: { type: Type.STRING, description: "Difficulty level" },
        subject: { type: Type.STRING, description: "Subject area (e.g., 'Mathematics', 'Science', 'Language Arts')" },
        unitTitle: { type: Type.STRING, description: "Broader unit context" },
        problemType: {
          type: Type.STRING,
          enum: ["multiple_choice", "true_false", "fill_in_blanks", "matching_activity", "sequencing_activity", "categorization_activity", "scenario_question", "short_answer"],
          description: "For knowledge-check components: Type of problem to generate"
        },
        count: { type: Type.NUMBER, description: "For knowledge-check components: Number of problems to generate" },
        gradeLevel: { type: Type.STRING, description: "For knowledge-check components: Override grade level for this specific check" },
        keyTerms: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Key vocabulary terms to emphasize in the visualization"
        },
        conceptsCovered: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Core concepts to illustrate"
        }
      }
    }
  },
  required: ["componentId", "instanceId", "title", "intent"]
};

/**
 * Manifest Schema for structured output - OBJECTIVE-CENTRIC design
 * Each objective gets its own dedicated set of components (1-to-many)
 */
const manifestSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topic: { type: Type.STRING },
    gradeLevel: { type: Type.STRING },
    themeColor: {
      type: Type.STRING,
      description: "Hex color code for the exhibit theme (e.g., #3b82f6)"
    },
    // Curator brief is standalone - introduces all objectives
    curatorBrief: {
      type: Type.OBJECT,
      description: "The introductory curator-brief component (always first)",
      properties: {
        instanceId: { type: Type.STRING },
        title: { type: Type.STRING },
        intent: { type: Type.STRING }
      },
      required: ["instanceId", "title", "intent"]
    },
    // Each objective gets its own dedicated components
    objectiveBlocks: {
      type: Type.ARRAY,
      description: "Array of objective blocks. Each objective has its own dedicated components that teach ONLY that objective.",
      items: {
        type: Type.OBJECT,
        properties: {
          objectiveId: {
            type: Type.STRING,
            description: "The objective ID (e.g., 'obj1', 'obj2')"
          },
          objectiveText: {
            type: Type.STRING,
            description: "The full learning objective text"
          },
          objectiveVerb: {
            type: Type.STRING,
            description: "The Bloom's taxonomy verb (identify, explain, apply, etc.)"
          },
          components: {
            type: Type.ARRAY,
            description: "2-4 components dedicated to teaching THIS specific objective. Order matters: start with introduction/explanation, then practice/application.",
            items: objectiveComponentSchema
          }
        },
        required: ["objectiveId", "objectiveText", "objectiveVerb", "components"]
      }
    },
    // Final assessment covers all objectives
    finalAssessment: {
      type: Type.OBJECT,
      description: "Optional final knowledge-check or flashcard-deck that assesses ALL objectives together",
      properties: {
        componentId: {
          type: Type.STRING,
          enum: ["knowledge-check", "flashcard-deck"],
          description: "Either knowledge-check or flashcard-deck"
        },
        instanceId: { type: Type.STRING },
        title: { type: Type.STRING },
        intent: {
          type: Type.STRING,
          description: "Should assess understanding across ALL learning objectives"
        },
        config: {
          type: Type.OBJECT,
          properties: {
            problemType: { type: Type.STRING },
            count: { type: Type.NUMBER },
            difficulty: { type: Type.STRING }
          }
        }
      },
      required: ["componentId", "instanceId", "title", "intent"]
    }
  },
  required: ["topic", "gradeLevel", "themeColor", "curatorBrief", "objectiveBlocks"]
};

/**
 * Progress callback for manifest generation
 */
export interface ManifestProgressCallback {
  onThinking?: (thought: string) => void;
  onProgress?: (message: string) => void;
  onPartialManifest?: (partial: Partial<ExhibitManifest>) => void;
}

/**
 * Generate Exhibit Manifest with Streaming (Phase 1 - The Blueprint)
 * This creates a plan for what components to use WITHOUT generating content
 * Supports real-time progress updates and thinking visibility
 */
export const generateExhibitManifestStreaming = async (
  topic: string,
  gradeLevel: string = 'elementary',
  objectives?: Array<{ id: string; text: string; verb: string; icon: string }>,
  callbacks?: ManifestProgressCallback
): Promise<ExhibitManifest> => {
  try {
    const gradeLevelContext = getGradeLevelContext(gradeLevel);
    const catalogContext = UNIVERSAL_CATALOG.map(c =>
      `- ${c.id}: ${c.description}${c.constraints ? ` [${c.constraints}]` : ''}`
    ).join('\n');

    // Format objectives if provided
    const objectivesContext = objectives
      ? `\n\nLEARNING OBJECTIVES (Use these to guide component selection):
${objectives.map((obj, i) => `${i + 1}. ${obj.text} [${obj.verb}]`).join('\n')}`
      : '';

    const prompt = `You are the Lead Curator designing an educational exhibit using an OBJECTIVE-CENTRIC approach.

ASSIGNMENT: Create a manifest (blueprint) for: "${topic}"
TARGET AUDIENCE: ${gradeLevelContext}${objectivesContext}

AVAILABLE COMPONENT TOOLS:
${catalogContext}

## CRITICAL: OBJECTIVE-CENTRIC DESIGN

This manifest is structured around LEARNING OBJECTIVES, not a flat list of components.
Each objective gets its own dedicated set of 2-4 components (1-to-many relationship).

STRUCTURE:
1. curatorBrief: Introduces the topic and ALL objectives (always first)
2. objectiveBlocks: Array where EACH objective has its own dedicated components
3. finalAssessment: Optional quiz/flashcards covering ALL objectives (at the end)

## COMPONENT SELECTION BY SUBJECT:
- Elementary Math (Counting, Addition, Subtraction) → 'number-line', 'bar-model', 'tape-diagram'
- Elementary Math (Place Value) → 'base-ten-blocks', 'place-value-chart'
- Elementary Math (Fractions) → 'fraction-circles', 'fraction-bar'
- Elementary Math (Multiplication) → 'array-grid', 'area-model', 'bar-model'
- Elementary Math (Geometry) → 'geometric-shape'
- Elementary Math (Patterns, Input-Output) → 'function-machine'
- Elementary Math (Data, Counting Frequency) → 'dot-plot'
- Elementary/Middle School Math (Prime Factorization, GCF, LCM) → 'factor-tree'
- Middle School Math (Ratios, Proportions, Unit Rates) → 'double-number-line', 'ratio-table'
- Middle School Math (Percent, Conversions) → 'double-number-line', 'percent-bar'
- Middle School Math (Statistics, Mean, Median, Mode, Data Distribution) → 'dot-plot'
- Middle School Math (Comparing Data Sets) → 'dot-plot' (parallel mode)
- Middle School Math (Multi-digit Multiplication, Distributive Property) → 'area-model'
- Middle School Math (Functions, Function Notation) → 'function-machine', 'graph-board'
- Middle School Math (Ordered Pairs, Coordinate Plane) → 'coordinate-graph'
- Middle School Math (Slope, Rise Over Run) → 'slope-triangle', 'coordinate-graph'
- Pre-Algebra/Algebra (Equations, Equality, Solving) → 'balance-scale', 'tape-diagram'
- Algebra (Linear Equations, Slope, Intercepts, Systems of Equations) → 'slope-triangle', 'coordinate-graph', 'systems-equations-visualizer', 'graph-board'
- Algebra (Systems of Equations, Substitution, Elimination) → 'systems-equations-visualizer', 'coordinate-graph'
- Algebra (Linear Functions, Function Concepts) → 'function-machine', 'graph-board', 'coordinate-graph'
- Geometry (Parallel/Perpendicular Lines, Angle of Inclination) → 'slope-triangle', 'coordinate-graph'
- Algebra (Binomial/Polynomial Multiplication) → 'area-model' (algebraic mode)
- Algebra 2 (Quadratic Functions, Parabolas, Vertex Form) → 'coordinate-graph'
- Algebra 2 (Function Composition, Inverse Functions) → 'function-machine'
- Algebra 2 (Matrices, Determinants, Matrix Operations, Solving Systems with Matrices) → 'matrix-display', 'systems-equations-visualizer'
- Precalculus (Matrix Transformations, Inverse Matrices) → 'matrix-display'
- Precalculus (Function Families, Transformations) → 'coordinate-graph'
- Math Problem-Solving → 'annotated-example' for worked solutions, 'tape-diagram' for word problems
- Science/Chemistry → 'molecule-viewer', 'periodic-table', 'formula-card', 'custom-visual'
- Engineering/Simple Machines (K-5) → 'lever-lab' for levers, balance, mechanical advantage; 'pulley-system-builder' for pulleys, lifting, rope systems; 'ramp-lab' for inclined planes, ramps, friction, force trade-offs; 'wheel-axle-explorer' for wheel and axle, doorknobs, winches, steering wheels, gear ratios
- Foundational Concepts (IDENTIFY objectives) → 'foundation-explorer' for introducing key vocabulary, parts, and components across all subjects
- History/Social Studies → 'comparison-panel', 'generative-table', 'feature-exhibit'
- Language Arts → 'sentence-analyzer', 'word-builder', 'concept-card-grid'
- Any topic with visuals → 'image-panel', 'image-comparison', 'media-player'
- Vocabulary/Memorization → 'flashcard-deck', 'concept-card-grid'

## RULES FOR EACH OBJECTIVE BLOCK:
1. Include 2-4 components per objective (not too few, not too many)
2. Components should PROGRESS within each objective through these PHASES:
   - Phase 1 (Introduce): Explain core vocabulary/concepts
   - Phase 2 (Visualize): Demonstrate with an interactive or visual tool
   - Phase 3 (Apply): Practice or worked examples
   
3. **CRITICAL: For each phase, consult the COMPONENT SELECTION BY SUBJECT section above 
   to choose the MOST SPECIFIC component for the topic.** 
   - If teaching fractions → use 'fraction-circles' or 'fraction-bar', NOT 'custom-visual'
   - If teaching systems of equations → use 'systems-equations-visualizer', NOT 'coordinate-graph'
   - If teaching slope → use 'slope-triangle', NOT 'annotated-example'
   
4. Each component's intent MUST directly address its parent objective
5. Use instanceIds that reference the objective (e.g., 'obj1-number-line')
## EXAMPLE MANIFEST (Addition for Kindergarten with 3 objectives):

{
  "topic": "Addition for Kindergarten",
  "gradeLevel": "kindergarten",
  "themeColor": "#3b82f6",
  "curatorBrief": {
    "instanceId": "curator-brief-1",
    "title": "Welcome to Addition!",
    "intent": "Create a warm, engaging introduction about adding numbers together. Preview all three learning objectives in kid-friendly language."
  },
  "objectiveBlocks": [
    {
      "objectiveId": "obj1",
      "objectiveText": "Understand what addition means",
      "objectiveVerb": "identify",
      "components": [
        {
          "componentId": "concept-card-grid",
          "instanceId": "obj1-concepts",
          "title": "What is Addition?",
          "intent": "Define addition in simple terms. Key concepts: 'putting together', 'more', 'total'. Use relatable examples like toys or snacks."
        },
        {
          "componentId": "custom-visual",
          "instanceId": "obj1-visual",
          "title": "See Addition in Action",
          "intent": "Create a simple animation showing two groups of objects coming together. Reinforce that addition means combining.",
          "config": {"subject": "Mathematics", "keyTerms": ["addition", "combine", "together"]}
        }
      ]
    },
    {
      "objectiveId": "obj2",
      "objectiveText": "Count objects to add them",
      "objectiveVerb": "apply",
      "components": [
        {
          "componentId": "bar-model",
          "instanceId": "obj2-bar-model",
          "title": "Counting Objects",
          "intent": "Show 3 apples + 2 apples = 5 apples using a bar model visualization. Emphasize counting each group then counting the total."
        },
        {
          "componentId": "number-line",
          "instanceId": "obj2-number-line",
          "title": "Hop Along the Number Line",
          "intent": "Demonstrate 3 + 2 = 5 by starting at 3 and hopping 2 spaces to land on 5. Range 0-10."
        },
        {
          "componentId": "knowledge-check",
          "instanceId": "obj2-practice",
          "title": "Try Counting!",
          "intent": "Simple counting-based addition: Show 2 balls and 3 balls, ask how many total?",
          "config": {"problemType": "multiple_choice", "difficulty": "easy"}
        }
      ]
    },
    {
      "objectiveId": "obj3",
      "objectiveText": "Recognize the plus sign (+) and equals sign (=)",
      "objectiveVerb": "identify",
      "components": [
        {
          "componentId": "concept-card-grid",
          "instanceId": "obj3-symbols",
          "title": "Meet the Math Symbols",
          "intent": "Introduce + and = signs. Explain + means 'add' or 'and', = means 'equals' or 'is the same as'. Use visual examples."
        },
        {
          "componentId": "annotated-example",
          "instanceId": "obj3-example",
          "title": "Reading a Math Sentence",
          "intent": "Walk through reading '2 + 3 = 5' step by step. Annotate each symbol's meaning."
        }
      ]
    }
  ],
  "finalAssessment": {
    "componentId": "knowledge-check",
    "instanceId": "final-quiz",
    "title": "Show What You Learned!",
    "intent": "Create 2-3 questions that cover ALL objectives: one about what addition means, one counting problem, one symbol recognition.",
    "config": {"problemType": "multiple_choice", "count": 3, "difficulty": "easy"}
  }
}

Now generate the manifest for: "${topic}" (${gradeLevel})
Return ONLY valid JSON matching the schema.`;

    callbacks?.onProgress?.('🧠 Starting manifest generation with AI thinking...');

    // Use streaming API
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        responseMimeType: "application/json",
        responseSchema: manifestSchema,
      },
    });

    let accumulatedText = '';
    let chunkCount = 0;
    let lastProgressUpdate = Date.now();

    callbacks?.onProgress?.('📡 Receiving AI response stream...');

    // Stream and accumulate chunks
    for await (const chunk of responseStream) {
      chunkCount++;

      if (chunk.text) {
        accumulatedText += chunk.text;

        // Throttle progress updates to every 500ms
        const now = Date.now();
        if (now - lastProgressUpdate > 500) {
          callbacks?.onProgress?.(`📝 Processing chunk ${chunkCount}... (${accumulatedText.length} chars)`);
          lastProgressUpdate = now;

          // Try to parse partial JSON to show progress
          try {
            const partial = JSON.parse(accumulatedText);
            if (partial.topic || partial.objectiveBlocks) {
              callbacks?.onPartialManifest?.(partial);
              if (partial.objectiveBlocks?.length) {
                const totalComponents = partial.objectiveBlocks.reduce(
                  (sum: number, block: any) => sum + (block.components?.length || 0), 0
                );
                callbacks?.onProgress?.(`🎯 Discovered ${partial.objectiveBlocks.length} objectives with ${totalComponents} components...`);
              }
            }
          } catch {
            // Not yet valid JSON, continue accumulating
          }
        }
      }

    }

    callbacks?.onProgress?.('✅ Stream complete, parsing final manifest...');

    if (!accumulatedText) throw new Error("No manifest returned");

    let jsonStr = accumulatedText.trim();
    const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) jsonStr = match[1].trim();

    // Cleanup potential trailing characters
    const firstOpen = jsonStr.indexOf('{');
    const lastClose = jsonStr.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
      jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
    }

    const rawManifest = JSON.parse(jsonStr) as ExhibitManifest;

    // Enrich with flattened layout for backward compatibility
    const manifest = enrichManifestWithLayout(rawManifest);

    const totalComponents = manifest.objectiveBlocks?.reduce(
      (sum, block) => sum + (block.components?.length || 0), 0
    ) || 0;
    const objectiveCount = manifest.objectiveBlocks?.length || 0;

    callbacks?.onProgress?.(`🎉 Manifest complete: ${objectiveCount} objectives, ${totalComponents} components!`);
    console.log('📋 Manifest Generated (objective-centric):', manifest);
    console.log(`   📊 Objectives: ${objectiveCount}`);
    manifest.objectiveBlocks?.forEach(block => {
      console.log(`      - ${block.objectiveId}: "${block.objectiveText}" → ${block.components.length} components`);
    });

    return manifest;
  } catch (error) {
    console.error("Manifest generation error:", error);
    throw error;
  }
};

/**
 * Generate Exhibit Manifest (Phase 1 - The Blueprint)
 * This creates a plan for what components to use WITHOUT generating content
 *
 * @deprecated Use generateExhibitManifestStreaming for better progress visibility
 */
export const generateExhibitManifest = async (
  topic: string,
  gradeLevel: string = 'elementary',
  objectives?: Array<{ id: string; text: string; verb: string; icon: string }>
): Promise<ExhibitManifest> => {
  // Fallback to streaming version without callbacks for backward compatibility
  return generateExhibitManifestStreaming(topic, gradeLevel, objectives);
};