'use client';

import React, { Suspense, lazy, ComponentType } from 'react';

// Lazy load all math primitives
const FractionBar = lazy(() => import('../../../primitives/visual-primitives/math/FractionBar'));
const FractionCircles = lazy(() => import('../../../primitives/visual-primitives/math/FractionCircles'));
const NumberLine = lazy(() => import('../../../primitives/visual-primitives/math/NumberLine'));
const BarModel = lazy(() => import('../../../primitives/visual-primitives/math/BarModel'));
const BaseTenBlocks = lazy(() => import('../../../primitives/visual-primitives/math/BaseTenBlocks'));
const PlaceValueChart = lazy(() => import('../../../primitives/visual-primitives/math/PlaceValueChart'));
const AreaModel = lazy(() => import('../../../primitives/visual-primitives/math/AreaModel'));
const ArrayGrid = lazy(() => import('../../../primitives/visual-primitives/math/ArrayGrid'));
const TapeDiagram = lazy(() => import('../../../primitives/visual-primitives/math/TapeDiagram'));
const FactorTree = lazy(() => import('../../../primitives/visual-primitives/math/FactorTree'));
const RatioTable = lazy(() => import('../../../primitives/visual-primitives/math/RatioTable'));
const DoubleNumberLine = lazy(() => import('../../../primitives/visual-primitives/math/DoubleNumberLine'));
const PercentBar = lazy(() => import('../../../primitives/visual-primitives/math/PercentBar'));
const BalanceScale = lazy(() => import('../../../primitives/visual-primitives/math/BalanceScale'));
const FunctionMachine = lazy(() => import('../../../primitives/visual-primitives/math/FunctionMachine'));
const CoordinateGraph = lazy(() => import('../../../primitives/visual-primitives/math/CoordinateGraph'));
const SlopeTriangle = lazy(() => import('../../../primitives/visual-primitives/math/SlopeTriangle'));
const SystemsEquationsVisualizer = lazy(() => import('../../../primitives/visual-primitives/math/SystemsEquationsVisualizer'));
const MatrixDisplay = lazy(() => import('../../../primitives/visual-primitives/math/MatrixDisplay'));
const DotPlot = lazy(() => import('../../../primitives/visual-primitives/math/DotPlot'));
const Histogram = lazy(() => import('../../../primitives/visual-primitives/math/Histogram'));
const TwoWayTable = lazy(() => import('../../../primitives/visual-primitives/math/TwoWayTable'));

// Map of component IDs to their lazy-loaded components
const PRIMITIVE_COMPONENTS: Record<string, ComponentType<{ data: unknown }>> = {
  'fraction-bar': FractionBar,
  'fraction-circles': FractionCircles,
  'number-line': NumberLine,
  'bar-model': BarModel,
  'base-ten-blocks': BaseTenBlocks,
  'place-value-chart': PlaceValueChart,
  'area-model': AreaModel,
  'array-grid': ArrayGrid,
  'tape-diagram': TapeDiagram,
  'factor-tree': FactorTree,
  'ratio-table': RatioTable,
  'double-number-line': DoubleNumberLine,
  'percent-bar': PercentBar,
  'balance-scale': BalanceScale,
  'function-machine': FunctionMachine,
  'coordinate-graph': CoordinateGraph,
  'slope-triangle': SlopeTriangle,
  'systems-equations-visualizer': SystemsEquationsVisualizer,
  'matrix-display': MatrixDisplay,
  'dot-plot': DotPlot,
  'histogram': Histogram,
  'two-way-table': TwoWayTable
};

interface PrimitiveRendererProps {
  componentId: string;
  data: unknown;
  className?: string;
}

const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-slate-400">
    <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-3" />
    <p className="text-sm">Loading visual...</p>
  </div>
);

const ErrorFallback = ({ componentId }: { componentId: string }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-slate-400 p-4">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 mb-3">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
    <p className="text-sm text-center">
      Unable to load the visual for <span className="text-white">{componentId}</span>
    </p>
    <p className="text-xs text-slate-500 mt-1">
      Please try again or dismiss this suggestion
    </p>
  </div>
);

class PrimitiveErrorBoundary extends React.Component<
  { children: React.ReactNode; componentId: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; componentId: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Primitive render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback componentId={this.props.componentId} />;
    }
    return this.props.children;
  }
}

export const PrimitiveRenderer: React.FC<PrimitiveRendererProps> = ({
  componentId,
  data,
  className = ''
}) => {
  const PrimitiveComponent = PRIMITIVE_COMPONENTS[componentId];

  if (!PrimitiveComponent) {
    return (
      <div className={`flex flex-col items-center justify-center h-full min-h-[200px] text-slate-400 p-4 ${className}`}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 mb-3">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <p className="text-sm text-center">
          Visual type <span className="text-white font-mono">{componentId}</span> is not yet supported
        </p>
      </div>
    );
  }

  return (
    <PrimitiveErrorBoundary componentId={componentId}>
      <Suspense fallback={<LoadingSpinner />}>
        <div className={`primitive-container ${className}`}>
          <PrimitiveComponent data={data} />
        </div>
      </Suspense>
    </PrimitiveErrorBoundary>
  );
};

export default PrimitiveRenderer;
