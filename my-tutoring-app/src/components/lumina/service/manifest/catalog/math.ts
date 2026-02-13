/**
 * Math Catalog - Component definitions for mathematics primitives
 *
 * Contains 23 math visualization components for teaching mathematical concepts
 * from elementary through advanced algebra.
 */

import { ComponentDefinition } from '../../../types';

export const MATH_CATALOG: ComponentDefinition[] = [
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
    constraints: 'Requires fraction values (numerator/denominator). Supports multiple bars for comparison.',
    tutoring: {
      taskDescription: 'Build and compare fractions. Target: {{targetFraction}}. Current: {{currentFraction}}.',
      contextKeys: ['targetFraction', 'currentFraction', 'denominator', 'numerator'],
      scaffoldingLevels: {
        level1: '"How many parts is the whole divided into?"',
        level2: '"You need {{denominator}} equal pieces. How many should be shaded?"',
        level3: '"Denominator = bottom number = total pieces. Numerator = top = shaded pieces."',
      },
      commonStruggles: [
        { pattern: 'Confusing numerator/denominator', response: 'Use "out of" language: 3 out of 4 pieces' },
        { pattern: 'Unequal parts', response: '"Are all the pieces the same size?"' },
        { pattern: 'Equivalence confusion', response: 'Show different ways to divide the same whole' },
      ],
    },
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
    description: 'INTERACTIVE PROBLEM-SOLVING PRIMITIVE: Students find missing values on two parallel number lines by calculating proportional relationships. Perfect for teaching ratios, unit rates, proportional relationships, measurement conversions, percent problems, and speed/distance relationships through active problem-solving. Students enter values in input fields and receive immediate feedback. Critical bridge from additive to multiplicative reasoning. ESSENTIAL for grades 5-8 ratios and proportions practice.',
    constraints: 'Requires two quantity labels and proportional relationship. Automatically generates 2-4 target points for students to solve. Can optionally provide 1-2 hint points (like origin or unit rate). Example config: { targetPoints: [...], givenPoints: [...], showUnitRate: true }'
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
    constraints: 'Requires an equation or equality relationship. Best for linear equations and simple algebraic expressions. Shows balanced or unbalanced states.',
    tutoring: {
      taskDescription: 'Balance equations using the scale model. Target equation: {{targetEquation}}.',
      contextKeys: ['targetEquation'],
      scaffoldingLevels: {
        level1: '"What do you notice about the two sides?"',
        level2: '"If we add/remove this from one side, what happens to the other?"',
        level3: '"We need the same weight on both sides. Let\'s solve step-by-step."',
      },
      commonStruggles: [
        { pattern: 'One-sided changes', response: 'Remember: what you do to one side, do to the other' },
        { pattern: 'Goal confusion', response: "We're trying to get X by itself" },
      ],
    },
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
];
