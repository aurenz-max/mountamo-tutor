'use client';

import React, { useState } from 'react';
import FractionBar, { FractionBarData } from '../primitives/visual-primitives/math/FractionBar';
import PlaceValueChart, { PlaceValueChartData } from '../primitives/visual-primitives/math/PlaceValueChart';
import AreaModel, { AreaModelData } from '../primitives/visual-primitives/math/AreaModel';
import ArrayGrid, { ArrayGridData } from '../primitives/visual-primitives/math/ArrayGrid';
import FactorTree, { FactorTreeData } from '../primitives/visual-primitives/math/FactorTree';
import RatioTable, { RatioTableData } from '../primitives/visual-primitives/math/RatioTable';
import DoubleNumberLine, { DoubleNumberLineData } from '../primitives/visual-primitives/math/DoubleNumberLine';
import PercentBar, { PercentBarData } from '../primitives/visual-primitives/math/PercentBar';
import TapeDiagram, { TapeDiagramData } from '../primitives/visual-primitives/math/TapeDiagram';
import BalanceScale, { BalanceScaleData } from '../primitives/visual-primitives/math/BalanceScale';
import FunctionMachine, { FunctionMachineData } from '../primitives/visual-primitives/math/FunctionMachine';
import CoordinateGraph, { CoordinateGraphData } from '../primitives/visual-primitives/math/CoordinateGraph';
import SlopeTriangle, { SlopeTriangleData } from '../primitives/visual-primitives/math/SlopeTriangle';
import SystemsEquationsVisualizer, { SystemsEquationsVisualizerData } from '../primitives/visual-primitives/math/SystemsEquationsVisualizer';
import MatrixDisplay, { MatrixDisplayData } from '../primitives/visual-primitives/math/MatrixDisplay';
import DotPlot, { DotPlotData } from '../primitives/visual-primitives/math/DotPlot';
import Histogram, { HistogramData } from '../primitives/visual-primitives/math/Histogram';
import TwoWayTable, { TwoWayTableData } from '../primitives/visual-primitives/math/TwoWayTable';

interface MathPrimitivesTesterProps {
  onBack: () => void;
}

type PrimitiveType = 'fraction-bar' | 'place-value-chart' | 'area-model' | 'array-grid' | 'factor-tree' | 'ratio-table' | 'double-number-line' | 'percent-bar' | 'tape-diagram' | 'balance-scale' | 'function-machine' | 'coordinate-graph' | 'slope-triangle' | 'systems-equations-visualizer' | 'matrix-display' | 'dot-plot' | 'histogram' | 'two-way-table';
type GradeLevel = 'toddler' | 'preschool' | 'kindergarten' | 'elementary' | 'middle-school' | 'high-school' | 'undergraduate' | 'graduate' | 'phd';

export const MathPrimitivesTester: React.FC<MathPrimitivesTesterProps> = ({ onBack }) => {
  const [selectedPrimitive, setSelectedPrimitive] = useState<PrimitiveType>('fraction-bar');

  // AI Generation State
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('elementary');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fraction Bar State
  const [fractionBarData, setFractionBarData] = useState<FractionBarData>({
    title: 'Understanding Fractions',
    description: 'Click on partitions to shade or unshade parts of the fraction bar',
    partitions: 4,
    shaded: 1,
    barCount: 2,
    showLabels: true,
    allowPartitionEdit: true,
    showEquivalentLines: true,
  });

  // Place Value Chart State
  const [placeValueData, setPlaceValueData] = useState<PlaceValueChartData>({
    title: 'Place Value Chart',
    description: 'Enter digits to see their place values',
    minPlace: -2,
    maxPlace: 4,
    initialValue: 1234.56,
    showExpandedForm: true,
    showMultipliers: true,
    editableDigits: true,
  });

  // Area Model State
  const [areaModelData, setAreaModelData] = useState<AreaModelData>({
    title: 'Multiplying with Area Model',
    description: 'Visualize multiplication using the area model strategy',
    factor1Parts: [20, 3],
    factor2Parts: [10, 5],
    showPartialProducts: true,
    showDimensions: true,
    algebraicMode: false,
    highlightCell: null,
    showAnimation: false,
  });

  // Array Grid State
  const [arrayGridData, setArrayGridData] = useState<ArrayGridData>({
    title: 'Understanding Multiplication Arrays',
    description: 'Click on rows, columns, or cells to explore how arrays represent multiplication',
    rows: 3,
    columns: 4,
    iconType: 'dot',
    showRowLabels: true,
    showColumnLabels: true,
    partitionLines: [],
    highlightMode: 'cell',
    animateSkipCounting: true,
  });

  // Factor Tree State
  const [factorTreeData, setFactorTreeData] = useState<FactorTreeData>({
    title: 'Prime Factorization of 24',
    description: 'Split the number into factor pairs until all leaves are prime',
    rootValue: 24,
    highlightPrimes: true,
    showExponentForm: true,
    guidedMode: true,
    allowReset: true,
  });

  // Ratio Table State
  const [ratioTableData, setRatioTableData] = useState<RatioTableData>({
    title: 'Baking Cookies: Flour to Cookie Ratio',
    description: 'Explore how ratios stay equivalent by scaling quantities up or down. In this table, we see that for every 1 cup of flour, we can bake 12 cookies. By multiplying both numbers by the same amount, we maintain the proportional relationship.',
    rowLabels: ['Cups of Flour', 'Cookies Made'],
    baseRatio: [1, 12],
    maxMultiplier: 10,
    showUnitRate: true,
    showBarChart: true,
  });

  // Double Number Line State
  const [doubleNumberLineData, setDoubleNumberLineData] = useState<DoubleNumberLineData>({
    title: 'Converting Miles to Kilometers',
    description: 'Explore the proportional relationship between miles and kilometers. See how corresponding values align to maintain the same ratio.',
    topLabel: 'Miles',
    bottomLabel: 'Kilometers',
    topScale: { min: 0, max: 10, interval: 2 },
    bottomScale: { min: 0, max: 16, interval: 3.2 },
    linkedPoints: [
      { topValue: 0, bottomValue: 0, label: 'Origin' },
      { topValue: 1, bottomValue: 1.6, label: 'Unit Rate' },
      { topValue: 5, bottomValue: 8, label: 'Midpoint' },
      { topValue: 10, bottomValue: 16, label: 'Maximum' }
    ],
    showVerticalGuides: true,
  });

  // Percent Bar State
  const [percentBarData, setPercentBarData] = useState<PercentBarData>({
    title: 'Understanding 50%',
    description: 'Click or drag on the bar to adjust the percentage and see how it relates to the whole value',
    wholeValue: 100,
    shadedPercent: 50,
    showPercentLabels: true,
    showValueLabels: true,
    benchmarkLines: [25, 50, 75],
    doubleBar: false,
  });

  // Tape Diagram State
  const [tapeDiagramData, setTapeDiagramData] = useState<TapeDiagramData>({
    title: 'Part-Part-Whole: Finding the Total',
    description: 'Click on segments to see their values and how they combine to make the whole',
    bars: [
      {
        segments: [
          { value: 12, label: 'Red marbles' },
          { value: 8, label: 'Blue marbles' }
        ],
        totalLabel: 'Total marbles'
      }
    ],
    comparisonMode: false,
    showBrackets: true,
  });

  // Balance Scale State
  const [balanceScaleData, setBalanceScaleData] = useState<BalanceScaleData>({
    title: 'Solving x + 3 = 7',
    description: 'Use the balance scale to find the value of x by keeping both sides equal',
    leftSide: [
      { value: 1, label: 'x', isVariable: true },
      { value: 3, label: '3' }
    ],
    rightSide: [{ value: 7, label: '7' }],
    variableValue: 4,
    showTilt: true,
    allowOperations: ['subtract'],
    stepHistory: [
      'Start with x + 3 = 7',
      'Subtract 3 from both sides to isolate x',
      'x = 4'
    ],
  });

  // Function Machine State
  const [functionMachineData, setFunctionMachineData] = useState<FunctionMachineData>({
    title: 'Mystery Function',
    description: 'Can you discover the rule by testing different input values?',
    rule: '2*x + 1',
    showRule: false,
    inputQueue: [1, 2, 3, 4, 5],
    outputDisplay: 'animated',
    chainable: false,
    ruleComplexity: 'twoStep',
  });

  // Coordinate Graph State
  const [coordinateGraphData, setCoordinateGraphData] = useState<CoordinateGraphData>({
    title: 'Graphing Linear Equations',
    description: 'Explore linear equations by graphing them on the coordinate plane and observe how slope and y-intercept affect the line',
    xRange: [-10, 10],
    yRange: [-10, 10],
    gridSpacing: { x: 1, y: 1 },
    showAxes: true,
    showGrid: true,
    plotMode: 'equation',
    equations: [
      {
        expression: 'y = 2*x + 1',
        color: '#3b82f6',
        label: 'Line 1: y = 2x + 1 (Steep positive slope)',
        slope: 2,
        yIntercept: 1,
        conceptFocus: 'slope',
        realWorldContext: 'A taxi charges $1 base fee plus $2 per mile traveled',
        slopeInterpretation: 'For every 1 unit right, go up 2 units (steep climb)',
        interceptInterpretation: 'The line starts at y = 1 when x = 0',
        annotations: [
          { x: 0, y: 1, text: 'Y-intercept: (0, 1)', type: 'intercept' },
          { x: 2, y: 5, text: 'After 2 miles: $5', type: 'point-of-interest' },
        ]
      },
      {
        expression: 'y = -0.5*x + 3',
        color: '#10b981',
        label: 'Line 2: y = -0.5x + 3 (Gentle negative slope)',
        slope: -0.5,
        yIntercept: 3,
        conceptFocus: 'slope',
        realWorldContext: 'A candle starts at 3 inches tall and burns down 0.5 inches per hour',
        slopeInterpretation: 'For every 1 hour, the candle gets 0.5 inches shorter',
        interceptInterpretation: 'The candle starts at 3 inches tall',
        annotations: [
          { x: 0, y: 3, text: 'Y-intercept: (0, 3)', type: 'intercept' },
          { x: 6, y: 0, text: 'Candle burns out', type: 'intercept' },
        ]
      },
    ],
    points: [],
    traceEnabled: true,
    showIntercepts: true,
    allowZoom: true,
  });

  // Slope Triangle State
  const [slopeTriangleData, setSlopeTriangleData] = useState<SlopeTriangleData>({
    title: 'Understanding Slope with Rise and Run',
    description: 'Drag slope triangles along the line to see how rise and run create the same slope. Toggle between rise/run and Δy/Δx notation.',
    xRange: [-10, 10],
    yRange: [-10, 10],
    gridSpacing: { x: 1, y: 1 },
    showAxes: true,
    showGrid: true,
    attachedLine: {
      equation: 'y = 2*x + 1',
      color: '#3b82f6',
      label: 'y = 2x + 1',
    },
    triangles: [
      {
        position: { x: -4, y: 0 },
        size: 3,
        showMeasurements: true,
        showSlope: true,
        showAngle: false,
        notation: 'riseRun',
        color: '#10b981',
      },
      {
        position: { x: 2, y: 0 },
        size: 2,
        showMeasurements: true,
        showSlope: true,
        showAngle: true,
        notation: 'deltaNotation',
        color: '#f59e0b',
      },
    ],
    allowDrag: true,
    allowResize: true,
  });

  // Systems of Equations State
  const [systemsEquationsData, setSystemsEquationsData] = useState<SystemsEquationsVisualizerData>({
    title: 'Solving Systems of Equations',
    description: 'Explore different methods to solve systems: graphing, substitution, and elimination.',
    equations: [
      {
        expression: 'y = 2*x + 1',
        color: '#3b82f6',
        label: 'Equation 1: y = 2x + 1',
        slope: 2,
        yIntercept: 1,
      },
      {
        expression: 'y = -1*x + 4',
        color: '#10b981',
        label: 'Equation 2: y = -x + 4',
        slope: -1,
        yIntercept: 4,
      },
    ],
    xRange: [-10, 10],
    yRange: [-10, 10],
    gridSpacing: { x: 1, y: 1 },
    showGraph: true,
    showAlgebraic: true,
    solutionMethod: 'graphing',
    highlightIntersection: true,
    stepByStep: false,
    intersectionPoint: {
      x: 1,
      y: 3,
      label: 'Solution: (1, 3)',
    },
    algebraicSteps: [
      {
        method: 'substitution',
        stepNumber: 1,
        description: 'Set the two equations equal to each other',
        equation: '2*x + 1 = -x + 4',
      },
      {
        method: 'substitution',
        stepNumber: 2,
        description: 'Add x to both sides',
        equation: '3*x + 1 = 4',
      },
      {
        method: 'substitution',
        stepNumber: 3,
        description: 'Subtract 1 from both sides',
        equation: '3*x = 3',
      },
      {
        method: 'substitution',
        stepNumber: 4,
        description: 'Divide both sides by 3',
        equation: 'x = 1',
      },
      {
        method: 'substitution',
        stepNumber: 5,
        description: 'Substitute x = 1 into the first equation',
        equation: 'y = 2(1) + 1 = 3',
      },
      {
        method: 'substitution',
        stepNumber: 6,
        description: 'The solution is (1, 3)',
        equation: '(x, y) = (1, 3)',
      },
    ],
    systemType: 'one-solution',
  });

  // Matrix Display State
  const [matrixDisplayData, setMatrixDisplayData] = useState<MatrixDisplayData>({
    title: 'Matrix Operations',
    description: 'Explore matrix operations including determinant, inverse, and transpose.',
    rows: 2,
    columns: 2,
    values: [
      [2, 1],
      [3, 4]
    ],
    editable: false,
    showOperations: [
      { type: 'determinant', label: 'Calculate Determinant', description: 'Find the determinant of this matrix' },
      { type: 'transpose', label: 'Transpose Matrix', description: 'Swap rows and columns' },
    ],
    augmented: false,
    highlightCells: [],
    showSteps: false,
    operationSteps: [],
    determinantVisualization: {
      show: true,
    },
    educationalContext: 'Matrices are rectangular arrays of numbers that can represent data, transformations, and systems of equations. Understanding matrix operations is essential for advanced mathematics and many real-world applications.',
  });

  // Dot Plot State
  const [dotPlotData, setDotPlotData] = useState<DotPlotData>({
    title: 'Class Pet Survey',
    description: 'This dot plot shows how many pets each student in our class has at home. Each dot represents one student.',
    range: [0, 8],
    dataPoints: [0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 5, 6],
    showStatistics: true,
    editable: true,
    parallel: false,
    stackStyle: 'dots',
  });

  // Histogram State
  const [histogramData, setHistogramData] = useState<HistogramData>({
    title: 'Student Test Scores',
    description: 'This histogram shows the distribution of test scores in the class. Adjust the bin width to see how the shape of the distribution changes.',
    data: [45, 52, 58, 62, 65, 68, 70, 72, 73, 75, 75, 76, 78, 80, 82, 85, 88, 92, 95],
    binWidth: 10,
    binStart: 40,
    showFrequency: true,
    showCurve: false,
    editable: true,
    xAxisLabel: 'Test Score',
    yAxisLabel: 'Frequency',
  });

  // Two-Way Table State
  const [twoWayTableData, setTwoWayTableData] = useState<TwoWayTableData>({
    title: 'Pet Preferences by Gender',
    description: 'This two-way table shows the relationship between gender and pet preference. Click cells to see probability calculations.',
    rowCategories: ['Male', 'Female'],
    columnCategories: ['Dogs', 'Cats'],
    frequencies: [[25, 15], [18, 22]],
    showTotals: true,
    displayMode: 'both',
    showProbabilities: false,
    editable: true,
    questionPrompt: 'What is the probability that a randomly selected student prefers dogs given they are female?',
  });

  const primitiveOptions: Array<{ value: PrimitiveType; label: string; icon: string }> = [
    { value: 'fraction-bar', label: 'Fraction Bar', icon: '📊' },
    { value: 'place-value-chart', label: 'Place Value Chart', icon: '🔢' },
    { value: 'area-model', label: 'Area Model', icon: '📐' },
    { value: 'array-grid', label: 'Array / Grid', icon: '⊞' },
    { value: 'factor-tree', label: 'Factor Tree', icon: '🌳' },
    { value: 'ratio-table', label: 'Ratio Table', icon: '⚖️' },
    { value: 'double-number-line', label: 'Double Number Line', icon: '↔️' },
    { value: 'percent-bar', label: 'Percent Bar', icon: '📈' },
    { value: 'tape-diagram', label: 'Tape Diagram', icon: '📏' },
    { value: 'balance-scale', label: 'Balance / Scale Model', icon: '⚖️' },
    { value: 'function-machine', label: 'Function Machine', icon: '⚙️' },
    { value: 'coordinate-graph', label: 'Coordinate Graph', icon: '📍' },
    { value: 'slope-triangle', label: 'Slope Triangle', icon: '📐' },
    { value: 'systems-equations-visualizer', label: 'Systems of Equations', icon: '📊' },
    { value: 'matrix-display', label: 'Matrix Display', icon: '▦' },
    { value: 'dot-plot', label: 'Dot Plot', icon: '⚬' },
    { value: 'histogram', label: 'Histogram', icon: '📊' },
    { value: 'two-way-table', label: 'Two-Way Table', icon: '⊞' },
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Map UI primitive names to componentIds for the registry
      const componentIdMap: Record<PrimitiveType, string> = {
        'fraction-bar': 'fraction-bar',
        'place-value-chart': 'place-value-chart',
        'area-model': 'area-model',
        'array-grid': 'array-grid',
        'factor-tree': 'factor-tree',
        'ratio-table': 'ratio-table',
        'double-number-line': 'double-number-line',
        'percent-bar': 'percent-bar',
        'tape-diagram': 'tape-diagram',
        'balance-scale': 'balance-scale',
        'function-machine': 'function-machine',
        'coordinate-graph': 'coordinate-graph',
        'slope-triangle': 'slope-triangle',
        'systems-equations-visualizer': 'systems-equations-visualizer',
        'matrix-display': 'matrix',
        'dot-plot': 'dot-plot',
        'histogram': 'histogram',
        'two-way-table': 'two-way-table',
      };

      const componentId = componentIdMap[selectedPrimitive];

      // Let the service choose the topic and specification based on the primitive type
      const defaultTopic = selectedPrimitive === 'fraction-bar'
        ? 'Understanding fractions'
        : selectedPrimitive === 'place-value-chart'
        ? 'Place value and decimal numbers'
        : selectedPrimitive === 'area-model'
        ? 'Multi-digit multiplication'
        : selectedPrimitive === 'array-grid'
        ? 'Introduction to multiplication'
        : selectedPrimitive === 'factor-tree'
        ? 'Prime factorization'
        : selectedPrimitive === 'ratio-table'
        ? 'Equivalent ratios and proportions'
        : selectedPrimitive === 'double-number-line'
        ? 'Unit rates and proportional relationships'
        : selectedPrimitive === 'percent-bar'
        ? 'Percent concepts and calculations'
        : selectedPrimitive === 'tape-diagram'
        ? 'Part-part-whole word problems'
        : selectedPrimitive === 'balance-scale'
        ? 'Solving equations'
        : selectedPrimitive === 'function-machine'
        ? 'Input-output patterns and functions'
        : selectedPrimitive === 'coordinate-graph'
        ? 'Graphing linear equations'
        : selectedPrimitive === 'slope-triangle'
        ? 'Understanding slope with rise and run'
        : selectedPrimitive === 'systems-equations-visualizer'
        ? 'Solving systems of equations'
        : selectedPrimitive === 'matrix-display'
        ? 'Matrix operations and transformations'
        : selectedPrimitive === 'dot-plot'
        ? 'Mean, median, and mode with data sets'
        : selectedPrimitive === 'histogram'
        ? 'Distribution shapes and frequency analysis'
        : 'Categorical data and conditional probability';

      // Use universal generateComponentContent endpoint (registry pattern)
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'generateComponentContent',
          params: {
            componentId,
            topic: defaultTopic,
            gradeLevel,
            config: {}, // Let Gemini choose all specifications
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const result = await response.json();
      // The registry returns { type, instanceId, data } - extract the data
      const generatedData = result.data || result;

      if (selectedPrimitive === 'fraction-bar') {
        setFractionBarData(generatedData);
      } else if (selectedPrimitive === 'place-value-chart') {
        setPlaceValueData(generatedData);
      } else if (selectedPrimitive === 'area-model') {
        setAreaModelData(generatedData);
      } else if (selectedPrimitive === 'array-grid') {
        setArrayGridData(generatedData);
      } else if (selectedPrimitive === 'factor-tree') {
        setFactorTreeData(generatedData);
      } else if (selectedPrimitive === 'ratio-table') {
        setRatioTableData(generatedData);
      } else if (selectedPrimitive === 'double-number-line') {
        setDoubleNumberLineData(generatedData);
      } else if (selectedPrimitive === 'percent-bar') {
        setPercentBarData(generatedData);
      } else if (selectedPrimitive === 'tape-diagram') {
        setTapeDiagramData(generatedData);
      } else if (selectedPrimitive === 'balance-scale') {
        setBalanceScaleData(generatedData);
      } else if (selectedPrimitive === 'function-machine') {
        setFunctionMachineData(generatedData);
      } else if (selectedPrimitive === 'coordinate-graph') {
        setCoordinateGraphData(generatedData);
      } else if (selectedPrimitive === 'slope-triangle') {
        setSlopeTriangleData(generatedData);
      } else if (selectedPrimitive === 'systems-equations-visualizer') {
        setSystemsEquationsData(generatedData);
      } else if (selectedPrimitive === 'matrix-display') {
        setMatrixDisplayData(generatedData);
      } else if (selectedPrimitive === 'dot-plot') {
        setDotPlotData(generatedData);
      } else if (selectedPrimitive === 'histogram') {
        setHistogramData(generatedData);
      } else if (selectedPrimitive === 'two-way-table') {
        setTwoWayTableData(generatedData);
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate primitive');
    } finally {
      setIsGenerating(false);
    }
  };

  const resetToDefaults = () => {
    if (selectedPrimitive === 'fraction-bar') {
      setFractionBarData({
        title: 'Understanding Fractions',
        description: 'Click on partitions to shade or unshade parts of the fraction bar',
        partitions: 4,
        shaded: 1,
        barCount: 2,
        showLabels: true,
        allowPartitionEdit: true,
        showEquivalentLines: true,
      });
    } else if (selectedPrimitive === 'place-value-chart') {
      setPlaceValueData({
        title: 'Place Value Chart',
        description: 'Enter digits to see their place values',
        minPlace: -2,
        maxPlace: 4,
        initialValue: 1234.56,
        showExpandedForm: true,
        showMultipliers: true,
        editableDigits: true,
      });
    } else if (selectedPrimitive === 'area-model') {
      setAreaModelData({
        title: 'Multiplying with Area Model',
        description: 'Visualize multiplication using the area model strategy',
        factor1Parts: [20, 3],
        factor2Parts: [10, 5],
        showPartialProducts: true,
        showDimensions: true,
        algebraicMode: false,
        highlightCell: null,
        showAnimation: false,
      });
    } else if (selectedPrimitive === 'array-grid') {
      setArrayGridData({
        title: 'Understanding Multiplication Arrays',
        description: 'Click on rows, columns, or cells to explore how arrays represent multiplication',
        rows: 3,
        columns: 4,
        iconType: 'dot',
        showRowLabels: true,
        showColumnLabels: true,
        partitionLines: [],
        highlightMode: 'cell',
        animateSkipCounting: true,
      });
    } else if (selectedPrimitive === 'factor-tree') {
      setFactorTreeData({
        title: 'Prime Factorization of 24',
        description: 'Split the number into factor pairs until all leaves are prime',
        rootValue: 24,
        highlightPrimes: true,
        showExponentForm: true,
        guidedMode: true,
        allowReset: true,
      });
    } else if (selectedPrimitive === 'ratio-table') {
      setRatioTableData({
        title: 'Baking Cookies: Flour to Cookie Ratio',
        description: 'Explore how ratios stay equivalent by scaling quantities up or down. In this table, we see that for every 1 cup of flour, we can bake 12 cookies. By multiplying both numbers by the same amount, we maintain the proportional relationship.',
        rowLabels: ['Cups of Flour', 'Cookies Made'],
        baseRatio: [1, 12],
        maxMultiplier: 10,
        showUnitRate: true,
        showBarChart: true,
      });
    } else if (selectedPrimitive === 'double-number-line') {
      setDoubleNumberLineData({
        title: 'Converting Miles to Kilometers',
        description: 'Explore the proportional relationship between miles and kilometers. See how corresponding values align to maintain the same ratio.',
        topLabel: 'Miles',
        bottomLabel: 'Kilometers',
        topScale: { min: 0, max: 10, interval: 2 },
        bottomScale: { min: 0, max: 16, interval: 3.2 },
        linkedPoints: [
          { topValue: 0, bottomValue: 0, label: 'Origin' },
          { topValue: 1, bottomValue: 1.6, label: 'Unit Rate' },
          { topValue: 5, bottomValue: 8, label: 'Midpoint' },
          { topValue: 10, bottomValue: 16, label: 'Maximum' }
        ],
        showVerticalGuides: true,
      });
    } else if (selectedPrimitive === 'percent-bar') {
      setPercentBarData({
        title: 'Understanding 50%',
        description: 'Click or drag on the bar to adjust the percentage and see how it relates to the whole value',
        wholeValue: 100,
        shadedPercent: 50,
        showPercentLabels: true,
        showValueLabels: true,
        benchmarkLines: [25, 50, 75],
        doubleBar: false,
      });
    } else if (selectedPrimitive === 'tape-diagram') {
      setTapeDiagramData({
        title: 'Part-Part-Whole: Finding the Total',
        description: 'Click on segments to see their values and how they combine to make the whole',
        bars: [
          {
            segments: [
              { value: 12, label: 'Red marbles' },
              { value: 8, label: 'Blue marbles' }
            ],
            totalLabel: 'Total marbles'
          }
        ],
        comparisonMode: false,
        showBrackets: true,
      });
    } else if (selectedPrimitive === 'balance-scale') {
      setBalanceScaleData({
        title: 'Solving x + 3 = 7',
        description: 'Use the balance scale to find the value of x by keeping both sides equal',
        leftSide: [
          { value: 1, label: 'x', isVariable: true },
          { value: 3, label: '3' }
        ],
        rightSide: [{ value: 7, label: '7' }],
        variableValue: 4,
        showTilt: true,
        allowOperations: ['subtract'],
        stepHistory: [
          'Start with x + 3 = 7',
          'Subtract 3 from both sides to isolate x',
          'x = 4'
        ],
      });
    } else if (selectedPrimitive === 'function-machine') {
      setFunctionMachineData({
        title: 'Mystery Function',
        description: 'Can you discover the rule by testing different input values?',
        rule: '2*x + 1',
        showRule: false,
        inputQueue: [1, 2, 3, 4, 5],
        outputDisplay: 'animated',
        chainable: false,
        ruleComplexity: 'twoStep',
      });
    } else if (selectedPrimitive === 'dot-plot') {
      setDotPlotData({
        title: 'Class Pet Survey',
        description: 'This dot plot shows how many pets each student in our class has at home. Each dot represents one student.',
        range: [0, 8],
        dataPoints: [0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 5, 6],
        showStatistics: true,
        editable: true,
        parallel: false,
        stackStyle: 'dots',
      });
    } else if (selectedPrimitive === 'histogram') {
      setHistogramData({
        title: 'Student Test Scores',
        description: 'This histogram shows the distribution of test scores in the class. Adjust the bin width to see how the shape of the distribution changes.',
        data: [45, 52, 58, 62, 65, 68, 70, 72, 73, 75, 75, 76, 78, 80, 82, 85, 88, 92, 95],
        binWidth: 10,
        binStart: 40,
        showFrequency: true,
        showCurve: false,
        editable: true,
        xAxisLabel: 'Test Score',
        yAxisLabel: 'Frequency',
      });
    } else if (selectedPrimitive === 'two-way-table') {
      setTwoWayTableData({
        title: 'Pet Preferences by Gender',
        description: 'This two-way table shows the relationship between gender and pet preference. Click cells to see probability calculations.',
        rowCategories: ['Male', 'Female'],
        columnCategories: ['Dogs', 'Cats'],
        frequencies: [[25, 15], [18, 22]],
        showTotals: true,
        displayMode: 'both',
        showProbabilities: false,
        editable: true,
        questionPrompt: 'What is the probability that a randomly selected student prefers dogs given they are female?',
      });
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="mb-8 text-center">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Back to Home
        </button>
      </div>

      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-white mb-2">Math Primitives Tester</h2>
        <p className="text-slate-400">Test and configure visual math components</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
        {/* Left Column: Controls */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 h-fit">
          <h3 className="text-2xl font-bold text-white mb-6">Configuration</h3>

          {/* AI Generator Section */}
          <div className="mb-6 p-4 bg-gradient-to-br from-purple-900/20 to-indigo-900/20 rounded-xl border border-purple-500/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <span className="text-lg">✨</span>
              </div>
              <h4 className="text-lg font-bold text-white">AI Generator</h4>
            </div>

            <p className="text-sm text-slate-400 mb-3">
              Generate a {selectedPrimitive === 'fraction-bar' ? 'fraction bar' : selectedPrimitive === 'place-value-chart' ? 'place value chart' : 'area model'} with AI-chosen specifications appropriate for the selected grade level.
            </p>

            {/* Grade Level */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-300 mb-2">Grade Level</label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
                className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
              >
                <option value="toddler">Toddler</option>
                <option value="preschool">Preschool</option>
                <option value="kindergarten">Kindergarten</option>
                <option value="elementary">Elementary</option>
                <option value="middle-school">Middle School</option>
                <option value="high-school">High School</option>
                <option value="undergraduate">Undergraduate</option>
                <option value="graduate">Graduate</option>
                <option value="phd">PhD</option>
              </select>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-3 p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Generating...
                </>
              ) : (
                <>
                  <span>✨</span>
                  Generate with AI
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-slate-600"></div>
            <span className="text-xs text-slate-500 uppercase tracking-wider">Manual Controls</span>
            <div className="h-px flex-1 bg-slate-600"></div>
          </div>

          {/* Primitive Selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">Select Primitive</label>
            <div className="grid grid-cols-2 gap-3">
              {primitiveOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedPrimitive(option.value)}
                  className={`p-4 rounded-lg border transition-all text-left ${
                    selectedPrimitive === option.value
                      ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                      : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <div className="text-2xl mb-2">{option.icon}</div>
                  <div className="text-sm font-medium">{option.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fraction Bar Controls */}
          {selectedPrimitive === 'fraction-bar' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={fractionBarData.title}
                  onChange={(e) => setFractionBarData({ ...fractionBarData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={fractionBarData.description}
                  onChange={(e) => setFractionBarData({ ...fractionBarData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Partitions</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={fractionBarData.partitions}
                    onChange={(e) => setFractionBarData({ ...fractionBarData, partitions: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Shaded</label>
                  <input
                    type="number"
                    min="0"
                    max={fractionBarData.partitions}
                    value={fractionBarData.shaded}
                    onChange={(e) => setFractionBarData({ ...fractionBarData, shaded: Math.min(parseInt(e.target.value) || 0, fractionBarData.partitions) })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Bar Count</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={fractionBarData.barCount}
                    onChange={(e) => setFractionBarData({ ...fractionBarData, barCount: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fractionBarData.showLabels}
                    onChange={(e) => setFractionBarData({ ...fractionBarData, showLabels: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-300">Show Labels</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fractionBarData.allowPartitionEdit}
                    onChange={(e) => setFractionBarData({ ...fractionBarData, allowPartitionEdit: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-300">Allow Partition Edit</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fractionBarData.showEquivalentLines}
                    onChange={(e) => setFractionBarData({ ...fractionBarData, showEquivalentLines: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-300">Show Equivalent Lines</span>
                </label>
              </div>
            </div>
          )}

          {/* Area Model Controls */}
          {selectedPrimitive === 'area-model' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={areaModelData.title}
                  onChange={(e) => setAreaModelData({ ...areaModelData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={areaModelData.description}
                  onChange={(e) => setAreaModelData({ ...areaModelData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Factor 1 Parts (comma-separated)</label>
                <input
                  type="text"
                  value={areaModelData.factor1Parts.join(', ')}
                  onChange={(e) => {
                    const parts = e.target.value.split(',').map(s => parseInt(s.trim()) || 0).filter(n => n > 0);
                    if (parts.length > 0) setAreaModelData({ ...areaModelData, factor1Parts: parts });
                  }}
                  placeholder="e.g., 20, 3"
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Factor 2 Parts (comma-separated)</label>
                <input
                  type="text"
                  value={areaModelData.factor2Parts.join(', ')}
                  onChange={(e) => {
                    const parts = e.target.value.split(',').map(s => parseInt(s.trim()) || 0).filter(n => n > 0);
                    if (parts.length > 0) setAreaModelData({ ...areaModelData, factor2Parts: parts });
                  }}
                  placeholder="e.g., 10, 5"
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={areaModelData.showPartialProducts}
                    onChange={(e) => setAreaModelData({ ...areaModelData, showPartialProducts: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Show Partial Products</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={areaModelData.showDimensions}
                    onChange={(e) => setAreaModelData({ ...areaModelData, showDimensions: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Show Dimensions</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={areaModelData.algebraicMode || false}
                    onChange={(e) => setAreaModelData({ ...areaModelData, algebraicMode: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Algebraic Mode</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={areaModelData.showAnimation || false}
                    onChange={(e) => setAreaModelData({ ...areaModelData, showAnimation: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Show Animation</span>
                </label>
              </div>

              {areaModelData.algebraicMode && (
                <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
                  <p className="text-xs text-yellow-300 mb-2">Algebraic Mode Enabled</p>
                  <p className="text-xs text-slate-400">
                    In algebraic mode, you can add custom labels through the AI generator or manually configure labels in the component data.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Array Grid Controls */}
          {selectedPrimitive === 'array-grid' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={arrayGridData.title}
                  onChange={(e) => setArrayGridData({ ...arrayGridData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={arrayGridData.description}
                  onChange={(e) => setArrayGridData({ ...arrayGridData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Rows</label>
                  <input
                    type="number"
                    min="2"
                    max="10"
                    value={arrayGridData.rows}
                    onChange={(e) => setArrayGridData({ ...arrayGridData, rows: parseInt(e.target.value) || 2 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Columns</label>
                  <input
                    type="number"
                    min="2"
                    max="12"
                    value={arrayGridData.columns}
                    onChange={(e) => setArrayGridData({ ...arrayGridData, columns: parseInt(e.target.value) || 2 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Icon Type</label>
                <select
                  value={arrayGridData.iconType}
                  onChange={(e) => setArrayGridData({ ...arrayGridData, iconType: e.target.value as 'dot' | 'square' | 'star' | 'custom' })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none"
                >
                  <option value="dot">Dot</option>
                  <option value="square">Square</option>
                  <option value="star">Star</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Highlight Mode</label>
                <select
                  value={arrayGridData.highlightMode}
                  onChange={(e) => setArrayGridData({ ...arrayGridData, highlightMode: e.target.value as 'row' | 'column' | 'cell' | 'region' })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-green-500 focus:outline-none"
                >
                  <option value="cell">Cell</option>
                  <option value="row">Row</option>
                  <option value="column">Column</option>
                  <option value="region">Region</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={arrayGridData.showRowLabels}
                    onChange={(e) => setArrayGridData({ ...arrayGridData, showRowLabels: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm text-slate-300">Show Row Labels</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={arrayGridData.showColumnLabels}
                    onChange={(e) => setArrayGridData({ ...arrayGridData, showColumnLabels: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm text-slate-300">Show Column Labels</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={arrayGridData.animateSkipCounting}
                    onChange={(e) => setArrayGridData({ ...arrayGridData, animateSkipCounting: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-sm text-slate-300">Animate Skip Counting</span>
                </label>
              </div>
            </div>
          )}

          {/* Place Value Chart Controls */}
          {selectedPrimitive === 'place-value-chart' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={placeValueData.title}
                  onChange={(e) => setPlaceValueData({ ...placeValueData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={placeValueData.description}
                  onChange={(e) => setPlaceValueData({ ...placeValueData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Min Place</label>
                  <input
                    type="number"
                    min="-3"
                    max="0"
                    value={placeValueData.minPlace}
                    onChange={(e) => setPlaceValueData({ ...placeValueData, minPlace: parseInt(e.target.value) || -2 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Max Place</label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    value={placeValueData.maxPlace}
                    onChange={(e) => setPlaceValueData({ ...placeValueData, maxPlace: parseInt(e.target.value) || 3 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Initial Value</label>
                  <input
                    type="number"
                    value={placeValueData.initialValue}
                    onChange={(e) => setPlaceValueData({ ...placeValueData, initialValue: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={placeValueData.showExpandedForm}
                    onChange={(e) => setPlaceValueData({ ...placeValueData, showExpandedForm: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-300">Show Expanded Form</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={placeValueData.showMultipliers}
                    onChange={(e) => setPlaceValueData({ ...placeValueData, showMultipliers: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-300">Show Multipliers</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={placeValueData.editableDigits}
                    onChange={(e) => setPlaceValueData({ ...placeValueData, editableDigits: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-300">Editable Digits</span>
                </label>
              </div>
            </div>
          )}

          {/* Factor Tree Controls */}
          {selectedPrimitive === 'factor-tree' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={factorTreeData.title}
                  onChange={(e) => setFactorTreeData({ ...factorTreeData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={factorTreeData.description}
                  onChange={(e) => setFactorTreeData({ ...factorTreeData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Root Value (Composite Number)</label>
                <input
                  type="number"
                  min="4"
                  max="100"
                  value={factorTreeData.rootValue}
                  onChange={(e) => setFactorTreeData({ ...factorTreeData, rootValue: parseInt(e.target.value) || 4 })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={factorTreeData.highlightPrimes ?? true}
                    onChange={(e) => setFactorTreeData({ ...factorTreeData, highlightPrimes: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm text-slate-300">Highlight Prime Numbers</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={factorTreeData.showExponentForm ?? true}
                    onChange={(e) => setFactorTreeData({ ...factorTreeData, showExponentForm: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm text-slate-300">Show Exponent Form</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={factorTreeData.guidedMode ?? true}
                    onChange={(e) => setFactorTreeData({ ...factorTreeData, guidedMode: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm text-slate-300">Guided Mode (Show Suggestions)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={factorTreeData.allowReset ?? true}
                    onChange={(e) => setFactorTreeData({ ...factorTreeData, allowReset: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm text-slate-300">Allow Reset</span>
                </label>
              </div>
            </div>
          )}

          {/* Percent Bar Controls */}
          {selectedPrimitive === 'percent-bar' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={percentBarData.title}
                  onChange={(e) => setPercentBarData({ ...percentBarData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={percentBarData.description}
                  onChange={(e) => setPercentBarData({ ...percentBarData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Whole Value (100%)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={percentBarData.wholeValue}
                    onChange={(e) => setPercentBarData({ ...percentBarData, wholeValue: parseFloat(e.target.value) || 100 })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Shaded Percent</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={percentBarData.shadedPercent}
                    onChange={(e) => setPercentBarData({ ...percentBarData, shadedPercent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={percentBarData.showPercentLabels ?? true}
                    onChange={(e) => setPercentBarData({ ...percentBarData, showPercentLabels: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-300">Show Percent Labels</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={percentBarData.showValueLabels ?? true}
                    onChange={(e) => setPercentBarData({ ...percentBarData, showValueLabels: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-300">Show Value Labels</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={percentBarData.doubleBar ?? false}
                    onChange={(e) => setPercentBarData({ ...percentBarData, doubleBar: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-300">Show Double Bar (Value Bar)</span>
                </label>
              </div>
            </div>
          )}

          {/* Ratio Table Controls */}
          {selectedPrimitive === 'ratio-table' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
                <input
                  type="text"
                  value={ratioTableData.title}
                  onChange={(e) => setRatioTableData({ ...ratioTableData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={ratioTableData.description}
                  onChange={(e) => setRatioTableData({ ...ratioTableData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-teal-500 focus:outline-none resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Row 1 Label</label>
                  <input
                    type="text"
                    value={ratioTableData.rowLabels[0]}
                    onChange={(e) => setRatioTableData({ ...ratioTableData, rowLabels: [e.target.value, ratioTableData.rowLabels[1]] })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Row 2 Label</label>
                  <input
                    type="text"
                    value={ratioTableData.rowLabels[1]}
                    onChange={(e) => setRatioTableData({ ...ratioTableData, rowLabels: [ratioTableData.rowLabels[0], e.target.value] })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Base Value 1</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={ratioTableData.baseRatio[0]}
                    onChange={(e) => setRatioTableData({ ...ratioTableData, baseRatio: [parseFloat(e.target.value) || 1, ratioTableData.baseRatio[1]] })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Base Value 2</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={ratioTableData.baseRatio[1]}
                    onChange={(e) => setRatioTableData({ ...ratioTableData, baseRatio: [ratioTableData.baseRatio[0], parseFloat(e.target.value) || 1] })}
                    className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Max Multiplier</label>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={ratioTableData.maxMultiplier ?? 10}
                  onChange={(e) => setRatioTableData({ ...ratioTableData, maxMultiplier: parseInt(e.target.value) || 10 })}
                  className="w-full px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ratioTableData.showUnitRate ?? true}
                    onChange={(e) => setRatioTableData({ ...ratioTableData, showUnitRate: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-teal-500 focus:ring-teal-500"
                  />
                  <span className="text-sm text-slate-300">Show Unit Rate</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ratioTableData.showBarChart ?? true}
                    onChange={(e) => setRatioTableData({ ...ratioTableData, showBarChart: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-teal-500 focus:ring-teal-500"
                  />
                  <span className="text-sm text-slate-300">Show Bar Chart</span>
                </label>
              </div>
            </div>
          )}

          {/* Reset Button */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <button
              onClick={resetToDefaults}
              className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all"
            >
              Reset to Defaults
            </button>
          </div>

          {/* Quick Presets */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider">Quick Presets</p>
            {selectedPrimitive === 'fraction-bar' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFractionBarData({ ...fractionBarData, partitions: 2, shaded: 1 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  1/2
                </button>
                <button
                  onClick={() => setFractionBarData({ ...fractionBarData, partitions: 4, shaded: 3 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  3/4
                </button>
                <button
                  onClick={() => setFractionBarData({ ...fractionBarData, partitions: 8, shaded: 5 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  5/8
                </button>
                <button
                  onClick={() => setFractionBarData({ ...fractionBarData, partitions: 10, shaded: 7 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  7/10
                </button>
              </div>
            )}
            {selectedPrimitive === 'place-value-chart' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPlaceValueData({ ...placeValueData, initialValue: 123 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  123
                </button>
                <button
                  onClick={() => setPlaceValueData({ ...placeValueData, initialValue: 45.67 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  45.67
                </button>
                <button
                  onClick={() => setPlaceValueData({ ...placeValueData, initialValue: 9876.54 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  9876.54
                </button>
              </div>
            )}
            {selectedPrimitive === 'area-model' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAreaModelData({ ...areaModelData, factor1Parts: [3], factor2Parts: [4] })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  3 × 4
                </button>
                <button
                  onClick={() => setAreaModelData({ ...areaModelData, factor1Parts: [10, 2], factor2Parts: [10, 3] })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  12 × 13
                </button>
                <button
                  onClick={() => setAreaModelData({ ...areaModelData, factor1Parts: [20, 3], factor2Parts: [10, 5] })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  23 × 15
                </button>
                <button
                  onClick={() => setAreaModelData({ ...areaModelData, factor1Parts: [30, 4], factor2Parts: [20, 7] })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  34 × 27
                </button>
                <button
                  onClick={() => setAreaModelData({ ...areaModelData, factor1Parts: [100, 20, 5], factor2Parts: [10, 2] })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  125 × 12
                </button>
              </div>
            )}
            {selectedPrimitive === 'array-grid' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setArrayGridData({ ...arrayGridData, rows: 2, columns: 3 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  2 × 3
                </button>
                <button
                  onClick={() => setArrayGridData({ ...arrayGridData, rows: 3, columns: 4 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  3 × 4
                </button>
                <button
                  onClick={() => setArrayGridData({ ...arrayGridData, rows: 4, columns: 5 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  4 × 5
                </button>
                <button
                  onClick={() => setArrayGridData({ ...arrayGridData, rows: 5, columns: 6 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  5 × 6
                </button>
              </div>
            )}
            {selectedPrimitive === 'factor-tree' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFactorTreeData({ ...factorTreeData, rootValue: 12 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  12
                </button>
                <button
                  onClick={() => setFactorTreeData({ ...factorTreeData, rootValue: 24 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  24
                </button>
                <button
                  onClick={() => setFactorTreeData({ ...factorTreeData, rootValue: 36 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  36
                </button>
                <button
                  onClick={() => setFactorTreeData({ ...factorTreeData, rootValue: 48 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  48
                </button>
                <button
                  onClick={() => setFactorTreeData({ ...factorTreeData, rootValue: 60 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  60
                </button>
                <button
                  onClick={() => setFactorTreeData({ ...factorTreeData, rootValue: 72 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  72
                </button>
              </div>
            )}
            {selectedPrimitive === 'ratio-table' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setRatioTableData({ ...ratioTableData, rowLabels: ['Cups of Flour', 'Cookies Made'], baseRatio: [1, 12] })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  Recipe
                </button>
                <button
                  onClick={() => setRatioTableData({ ...ratioTableData, rowLabels: ['Hours', 'Miles'], baseRatio: [1, 60] })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  Speed
                </button>
                <button
                  onClick={() => setRatioTableData({ ...ratioTableData, rowLabels: ['Items', 'Cost ($)'], baseRatio: [1, 2.50] })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  Unit Price
                </button>
                <button
                  onClick={() => setRatioTableData({ ...ratioTableData, rowLabels: ['Red Paint', 'Blue Paint'], baseRatio: [2, 3] })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  Mixing
                </button>
              </div>
            )}
            {selectedPrimitive === 'matrix-display' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setMatrixDisplayData({
                    title: '2×2 Matrix Multiplication',
                    description: 'Multiply two 2×2 matrices to see the step-by-step calculation',
                    rows: 2,
                    columns: 2,
                    values: [[1, 2], [3, 4]],
                    secondMatrix: {
                      rows: 2,
                      columns: 2,
                      values: [[2, 0], [1, 3]],
                      label: 'Matrix B'
                    },
                    operationType: 'multiply',
                    editable: false,
                    showOperations: [],
                    augmented: false,
                    highlightCells: [],
                    multiplicationVisualization: {
                      show: true
                    },
                    educationalContext: 'Matrix multiplication combines rows from the first matrix with columns from the second matrix.'
                  })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  2×2 Multiply
                </button>
                <button
                  onClick={() => setMatrixDisplayData({
                    title: '2×3 × 3×2 Matrix Multiplication',
                    description: 'Multiply a 2×3 matrix by a 3×2 matrix',
                    rows: 2,
                    columns: 3,
                    values: [[1, 2, 3], [4, 5, 6]],
                    secondMatrix: {
                      rows: 3,
                      columns: 2,
                      values: [[7, 8], [9, 10], [11, 12]],
                      label: 'Matrix B'
                    },
                    operationType: 'multiply',
                    editable: false,
                    showOperations: [],
                    augmented: false,
                    highlightCells: [],
                    multiplicationVisualization: {
                      show: true
                    },
                    educationalContext: 'When multiplying matrices, the number of columns in the first matrix must equal the number of rows in the second matrix.'
                  })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  2×3 × 3×2
                </button>
                <button
                  onClick={() => setMatrixDisplayData({
                    title: '3×2 × 2×3 Matrix Multiplication',
                    description: 'Multiply a 3×2 matrix by a 2×3 matrix',
                    rows: 3,
                    columns: 2,
                    values: [[1, 2], [3, 4], [5, 6]],
                    secondMatrix: {
                      rows: 2,
                      columns: 3,
                      values: [[7, 8, 9], [10, 11, 12]],
                      label: 'Matrix B'
                    },
                    operationType: 'multiply',
                    editable: false,
                    showOperations: [],
                    augmented: false,
                    highlightCells: [],
                    multiplicationVisualization: {
                      show: true
                    },
                    educationalContext: 'The resulting matrix will have the same number of rows as the first matrix and the same number of columns as the second matrix.'
                  })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  3×2 × 2×3
                </button>
                <button
                  onClick={() => setMatrixDisplayData({
                    title: '2×2 Determinant',
                    description: 'Calculate the determinant of a 2×2 matrix',
                    rows: 2,
                    columns: 2,
                    values: [[2, 1], [3, 4]],
                    editable: false,
                    showOperations: [
                      { type: 'determinant', label: 'Calculate Determinant', description: 'Find the determinant of this matrix' }
                    ],
                    augmented: false,
                    highlightCells: [],
                    determinantVisualization: {
                      show: true
                    },
                    educationalContext: 'The determinant is a scalar value that can be computed from the elements of a square matrix.'
                  })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  2×2 Det
                </button>
                <button
                  onClick={() => setMatrixDisplayData({
                    title: '3×3 Determinant',
                    description: 'Calculate the determinant of a 3×3 matrix using the Rule of Sarrus',
                    rows: 3,
                    columns: 3,
                    values: [[1, 2, 3], [4, 5, 6], [7, 8, 10]],
                    editable: false,
                    showOperations: [
                      { type: 'determinant', label: 'Calculate Determinant', description: 'Find the determinant using cofactor expansion' }
                    ],
                    augmented: false,
                    highlightCells: [],
                    determinantVisualization: {
                      show: true
                    },
                    educationalContext: 'For 3×3 matrices, we use the Rule of Sarrus or cofactor expansion to calculate the determinant.'
                  })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  3×3 Det
                </button>
              </div>
            )}
            {selectedPrimitive === 'percent-bar' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPercentBarData({ ...percentBarData, wholeValue: 100, shadedPercent: 50 })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  50%
                </button>
                <button
                  onClick={() => setPercentBarData({ ...percentBarData, wholeValue: 50, shadedPercent: 8, doubleBar: true })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  8% Tax
                </button>
                <button
                  onClick={() => setPercentBarData({ ...percentBarData, wholeValue: 80, shadedPercent: 35, doubleBar: true })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  35% Off
                </button>
                <button
                  onClick={() => setPercentBarData({ ...percentBarData, wholeValue: 60, shadedPercent: 75, doubleBar: true })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  75% Score
                </button>
                <button
                  onClick={() => setPercentBarData({ ...percentBarData, wholeValue: 40, shadedPercent: 15, doubleBar: true })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  15% Tip
                </button>
              </div>
            )}
            {selectedPrimitive === 'tape-diagram' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTapeDiagramData({
                    title: 'Part-Part-Whole: Finding the Total',
                    description: 'Two parts combine to make a whole',
                    bars: [{ segments: [{ value: 12, label: 'Red' }, { value: 8, label: 'Blue' }], totalLabel: 'Total = 20' }],
                    comparisonMode: false,
                    showBrackets: true,
                  })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  Part-Whole
                </button>
                <button
                  onClick={() => setTapeDiagramData({
                    title: 'Comparison: More Than',
                    description: 'Compare two quantities',
                    bars: [
                      { segments: [{ value: 15, label: 'Maria' }], totalLabel: 'Maria' },
                      { segments: [{ value: 15, label: 'Same' }, { value: 7, label: 'More' }], totalLabel: 'John = 22' }
                    ],
                    comparisonMode: true,
                    showBrackets: true,
                  })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  Comparison
                </button>
                <button
                  onClick={() => setTapeDiagramData({
                    title: 'Unknown Part',
                    description: 'Find the missing value',
                    bars: [{ segments: [{ value: 8, label: 'Chocolate' }, { isUnknown: true, label: '?' }], totalLabel: 'Total = 20' }],
                    comparisonMode: false,
                    showBrackets: true,
                  })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  Unknown
                </button>
                <button
                  onClick={() => setTapeDiagramData({
                    title: 'Algebra: x + 7 = 15',
                    description: 'Solve for the variable',
                    bars: [{ segments: [{ isUnknown: true, label: 'x' }, { value: 7, label: '7' }], totalLabel: 'Total = 15' }],
                    comparisonMode: false,
                    showBrackets: true,
                  })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  Algebra
                </button>
              </div>
            )}
            {selectedPrimitive === 'function-machine' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFunctionMachineData({ ...functionMachineData, rule: 'x + 3', showRule: false, ruleComplexity: 'oneStep' })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  Add 3
                </button>
                <button
                  onClick={() => setFunctionMachineData({ ...functionMachineData, rule: '2*x', showRule: false, ruleComplexity: 'oneStep' })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  Double
                </button>
                <button
                  onClick={() => setFunctionMachineData({ ...functionMachineData, rule: '2*x + 1', showRule: false, inputQueue: [0, 1, 2, 3, 4], ruleComplexity: 'twoStep' })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  2x + 1
                </button>
                <button
                  onClick={() => setFunctionMachineData({ ...functionMachineData, rule: 'x^2', showRule: false, inputQueue: [0, 1, 2, 3, 4], ruleComplexity: 'expression' })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  Square
                </button>
                <button
                  onClick={() => setFunctionMachineData({ ...functionMachineData, rule: '3*x - 2', showRule: true, inputQueue: [-1, 0, 1, 2, 3], ruleComplexity: 'twoStep' })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  3x - 2 (Show)
                </button>
              </div>
            )}
            {selectedPrimitive === 'dot-plot' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setDotPlotData({
                    title: 'Pet Survey Results',
                    description: 'How many pets do students have at home?',
                    range: [0, 8],
                    dataPoints: [0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 5, 6],
                    showStatistics: true,
                    editable: true,
                    parallel: false,
                    stackStyle: 'dots',
                  })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  Pet Survey
                </button>
                <button
                  onClick={() => setDotPlotData({
                    title: 'Test Scores Comparison',
                    description: 'Compare test scores between Class A and Class B',
                    range: [60, 100],
                    dataPoints: [72, 75, 78, 78, 80, 82, 85, 85, 88, 90],
                    secondaryDataPoints: [65, 70, 75, 80, 80, 82, 85, 90, 92, 95],
                    primaryLabel: 'Class A',
                    secondaryLabel: 'Class B',
                    showStatistics: true,
                    editable: true,
                    parallel: true,
                    stackStyle: 'dots',
                  })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  Parallel Compare
                </button>
                <button
                  onClick={() => setDotPlotData({
                    title: 'Daily Temperatures',
                    description: 'High temperatures this week',
                    range: [60, 85],
                    dataPoints: [68, 70, 72, 72, 75, 78, 80],
                    showStatistics: true,
                    editable: true,
                    parallel: false,
                    stackStyle: 'x',
                  })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  X Marks Style
                </button>
                <button
                  onClick={() => setDotPlotData({
                    title: 'Apple Picking',
                    description: 'How many apples did each student pick?',
                    range: [1, 10],
                    dataPoints: [3, 4, 4, 5, 5, 5, 6, 6, 7, 8],
                    showStatistics: false,
                    editable: true,
                    parallel: false,
                    stackStyle: 'icons',
                    iconEmoji: '🍎',
                  })}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-full text-xs transition-colors"
                >
                  🍎 Icons Style
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-2xl font-bold text-white mb-6">Live Preview</h3>
          <div className="overflow-y-auto">
            {selectedPrimitive === 'fraction-bar' && <FractionBar data={fractionBarData} />}
            {selectedPrimitive === 'place-value-chart' && <PlaceValueChart data={placeValueData} />}
            {selectedPrimitive === 'area-model' && <AreaModel data={areaModelData} />}
            {selectedPrimitive === 'array-grid' && <ArrayGrid data={arrayGridData} />}
            {selectedPrimitive === 'factor-tree' && <FactorTree data={factorTreeData} />}
            {selectedPrimitive === 'ratio-table' && <RatioTable data={ratioTableData} />}
            {selectedPrimitive === 'double-number-line' && <DoubleNumberLine data={doubleNumberLineData} />}
            {selectedPrimitive === 'percent-bar' && <PercentBar data={percentBarData} />}
            {selectedPrimitive === 'tape-diagram' && <TapeDiagram data={tapeDiagramData} />}
            {selectedPrimitive === 'balance-scale' && <BalanceScale data={balanceScaleData} />}
            {selectedPrimitive === 'function-machine' && <FunctionMachine data={functionMachineData} />}
            {selectedPrimitive === 'coordinate-graph' && <CoordinateGraph data={coordinateGraphData} />}
            {selectedPrimitive === 'slope-triangle' && <SlopeTriangle data={slopeTriangleData} />}
            {selectedPrimitive === 'systems-equations-visualizer' && <SystemsEquationsVisualizer data={systemsEquationsData} />}
            {selectedPrimitive === 'matrix-display' && <MatrixDisplay data={matrixDisplayData} />}
            {selectedPrimitive === 'dot-plot' && <DotPlot data={dotPlotData} />}
            {selectedPrimitive === 'histogram' && <Histogram data={histogramData} />}
            {selectedPrimitive === 'two-way-table' && <TwoWayTable data={twoWayTableData} />}
          </div>
        </div>
      </div>

      {/* Info Panel with Instructions */}
      <div className="mt-8 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Usage Guide */}
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div className="flex-1">
              <h4 className="text-blue-300 font-semibold mb-3">How to Use This Tester</h4>
              <div className="text-slate-300 text-sm space-y-2">
                <div>
                  <p className="font-semibold text-white mb-1">AI Generation</p>
                  <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
                    <li>Select a primitive type (Fraction Bar or Place Value Chart)</li>
                    <li>Choose a grade level to ensure age-appropriate content</li>
                    <li>Click "Generate with AI" to create a primitive with AI-chosen specifications</li>
                    <li>The AI will automatically set all properties based on educational best practices</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-white mb-1">Manual Configuration</p>
                  <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
                    <li>Use the controls below the AI generator to manually adjust properties</li>
                    <li>Changes are reflected in real-time in the live preview</li>
                    <li>Use quick presets for common configurations</li>
                    <li>Reset to defaults to start fresh</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Developer Guide */}
        <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <div className="flex-1">
              <h4 className="text-green-300 font-semibold mb-3">How to Add New Math Primitives to This Tester</h4>
              <div className="text-slate-300 text-sm space-y-3">
                <div>
                  <p className="font-semibold text-white mb-1">Step 1: Create Your Primitive Component</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li>Create a new file in <code className="text-green-400 bg-slate-800 px-1 rounded">my-tutoring-app/src/components/lumina/primitives/visual-primitives/math/</code></li>
                    <li>Export an interface for the data (e.g., <code className="text-green-400 bg-slate-800 px-1 rounded">YourPrimitiveData</code>)</li>
                    <li>Export the component as default with props: <code className="text-green-400 bg-slate-800 px-1 rounded">{'{ data, className? }'}</code></li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-white mb-1">Step 2: Import into This Tester</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li>Import your component at the top: <code className="text-green-400 bg-slate-800 px-1 rounded">import YourPrimitive, {'{ YourPrimitiveData }'} from '../primitives/visual-primitives/math/YourPrimitive';</code></li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-white mb-1">Step 3: Add to Primitive Type Union</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li>Update: <code className="text-green-400 bg-slate-800 px-1 rounded">type PrimitiveType = 'fraction-bar' | 'place-value-chart' | 'your-primitive';</code></li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-white mb-1">Step 4: Add State Management</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li>Create state: <code className="text-green-400 bg-slate-800 px-1 rounded">const [yourPrimitiveData, setYourPrimitiveData] = useState&lt;YourPrimitiveData&gt;({'{...}'})</code></li>
                    <li>Add to <code className="text-green-400 bg-slate-800 px-1 rounded">primitiveOptions</code> array with value, label, and icon</li>
                    <li>Add reset case to <code className="text-green-400 bg-slate-800 px-1 rounded">resetToDefaults()</code> function</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-white mb-1">Step 5: Add Controls and Preview</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li>Add conditional controls section: <code className="text-green-400 bg-slate-800 px-1 rounded">{'{ selectedPrimitive === "your-primitive" && <div>...</div> }'}</code></li>
                    <li>Add preview case: <code className="text-green-400 bg-slate-800 px-1 rounded">{'{ selectedPrimitive === "your-primitive" && <YourPrimitive data={yourPrimitiveData} /> }'}</code></li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-white mb-1">Step 6: Add Quick Presets (Optional)</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li>Add preset buttons in the "Quick Presets" section with common configurations</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-white mb-1">Step 7: Create Gemini Service (for AI)</p>
                  <ul className="list-disc list-inside ml-4 space-y-1 text-xs">
                    <li>Create a service file in <code className="text-green-400 bg-slate-800 px-1 rounded">service/math/gemini-your-primitive.ts</code></li>
                    <li>Define the schema and generation function (see existing files for reference)</li>
                    <li>Import and call in <code className="text-green-400 bg-slate-800 px-1 rounded">handleGenerate()</code> function</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
