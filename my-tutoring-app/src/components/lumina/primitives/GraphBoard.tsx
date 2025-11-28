import React, { useRef, useState, useEffect } from 'react';

interface GraphBoardProps {
  className?: string;
  data?: any;
  index?: number;
}

interface Point {
  id: string;
  x: number;
  y: number;
}

const GraphBoard: React.FC<GraphBoardProps> = ({ className }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // Constants
  const PADDING = 40;
  const X_MIN = -10;
  const X_MAX = 10;
  const Y_MIN = -10;
  const Y_MAX = 10;

  useEffect(() => {
    const updateSize = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Convert cartesian coordinates to SVG coordinates
  const toSVG = (x: number, y: number) => {
    const svgX = PADDING + ((x - X_MIN) / (X_MAX - X_MIN)) * (dimensions.width - 2 * PADDING);
    const svgY = dimensions.height - PADDING - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * (dimensions.height - 2 * PADDING);
    return { x: svgX, y: svgY };
  };

  // Convert SVG coordinates to cartesian
  const toCartesian = (svgX: number, svgY: number) => {
    const x = X_MIN + ((svgX - PADDING) / (dimensions.width - 2 * PADDING)) * (X_MAX - X_MIN);
    const y = Y_MIN + ((dimensions.height - PADDING - svgY) / (dimensions.height - 2 * PADDING)) * (Y_MAX - Y_MIN);
    return { x: Math.round(x), y: Math.round(y) };
  };

  // Lagrange interpolation
  const interpolate = (x: number): number => {
    if (points.length === 0) return 0;
    if (points.length === 1) return points[0].y;

    let result = 0;
    for (let i = 0; i < points.length; i++) {
      let term = points[i].y;
      for (let j = 0; j < points.length; j++) {
        if (i !== j) {
          term *= (x - points[j].x) / (points[i].x - points[j].x);
        }
      }
      result += term;
    }
    return result;
  };

  // Calculate polynomial coefficients using Lagrange expansion
  const calculateCoefficients = (): number[] => {
    const n = points.length;
    if (n === 0) return [];
    if (n === 1) return [points[0].y];

    const coeffs = new Array(n).fill(0);

    for (let j = 0; j < n; j++) {
      const xj = points[j].x;
      const yj = points[j].y;

      // Calculate denominator
      let denominator = 1;
      for (let i = 0; i < n; i++) {
        if (i !== j) {
          denominator *= (xj - points[i].x);
        }
      }

      // Calculate numerator polynomial coefficients
      let termCoeffs = [1];
      for (let i = 0; i < n; i++) {
        if (i !== j) {
          const xi = points[i].x;
          const nextCoeffs = new Array(termCoeffs.length + 1).fill(0);

          for (let k = 0; k < termCoeffs.length; k++) {
            nextCoeffs[k + 1] += termCoeffs[k];
            nextCoeffs[k] -= xi * termCoeffs[k];
          }
          termCoeffs = nextCoeffs;
        }
      }

      // Add weighted terms to final coefficients
      const weight = yj / denominator;
      for (let k = 0; k < termCoeffs.length; k++) {
        coeffs[k] += termCoeffs[k] * weight;
      }
    }

    return coeffs;
  };

  // Format coefficient to clean string
  const formatCoeff = (val: number): string => {
    const rounded = Math.round(val * 100) / 100;
    return rounded === Math.round(rounded) ? Math.round(rounded).toString() : rounded.toString();
  };

  // Generate polynomial equation string
  const getEquation = (): string => {
    if (points.length === 0) return 'Plot a Point';
    if (points.length === 1) return `y = ${points[0].y}`;

    const coeffs = calculateCoefficients();
    const terms: string[] = [];

    // Build equation from highest to lowest degree
    for (let power = coeffs.length - 1; power >= 0; power--) {
      const c = coeffs[power];

      if (Math.abs(c) < 0.01) continue;

      const absC = Math.abs(c);
      const sign = c < 0 ? '-' : '+';
      const showSign = terms.length > 0 ? ` ${sign} ` : (c < 0 ? '-' : '');

      let term = '';

      if (power === 0) {
        term = formatCoeff(absC);
      } else if (power === 1) {
        term = absC === 1 ? 'x' : `${formatCoeff(absC)}x`;
      } else {
        const sup = power.toString().split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[parseInt(d)]).join('');
        term = absC === 1 ? `x${sup}` : `${formatCoeff(absC)}x${sup}`;
      }

      terms.push(showSign + term);
    }

    return terms.length > 0 ? `y = ${terms.join('')}` : 'y = 0';
  };

  // Generate curve path
  const getCurvePath = (): string => {
    if (points.length < 2) return '';

    const pathPoints: string[] = [];
    const step = (X_MAX - X_MIN) / 200;

    for (let x = X_MIN; x <= X_MAX; x += step) {
      const y = interpolate(x);
      const svg = toSVG(x, y);

      // Clamp to reasonable values
      if (Math.abs(y) > 100) continue;

      if (pathPoints.length === 0) {
        pathPoints.push(`M ${svg.x} ${svg.y}`);
      } else {
        pathPoints.push(`L ${svg.x} ${svg.y}`);
      }
    }

    return pathPoints.join(' ');
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const svgX = e.clientX - rect.left;
    const svgY = e.clientY - rect.top;

    const { x, y } = toCartesian(svgX, svgY);

    // Check if within bounds
    if (x < X_MIN || x > X_MAX || y < Y_MIN || y > Y_MAX) return;

    setPoints(prev => [...prev, { id: Date.now().toString(), x, y }]);
  };

  // Draw grid lines
  const renderGrid = () => {
    const lines = [];

    // Vertical lines
    for (let x = X_MIN; x <= X_MAX; x++) {
      const svg = toSVG(x, 0);
      const isAxis = x === 0;
      lines.push(
        <line
          key={`v-${x}`}
          x1={svg.x}
          y1={PADDING}
          x2={svg.x}
          y2={dimensions.height - PADDING}
          stroke={isAxis ? '#94a3b8' : '#1e293b'}
          strokeWidth={isAxis ? 2 : 1}
        />
      );
    }

    // Horizontal lines
    for (let y = Y_MIN; y <= Y_MAX; y++) {
      const svg = toSVG(0, y);
      const isAxis = y === 0;
      lines.push(
        <line
          key={`h-${y}`}
          x1={PADDING}
          y1={svg.y}
          x2={dimensions.width - PADDING}
          y2={svg.y}
          stroke={isAxis ? '#94a3b8' : '#1e293b'}
          strokeWidth={isAxis ? 2 : 1}
        />
      );
    }

    return lines;
  };

  return (
    <div className={`relative bg-[#0F172A] rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50 ${className}`}>
      {/* Title Overlay */}
      <div className="absolute top-6 left-8 pointer-events-none z-10 max-w-[70%]">
        <div className="inline-block px-3 py-1 mb-2 text-[10px] font-bold tracking-widest text-blue-300 uppercase bg-blue-900/30 rounded-full border border-blue-800">
          Interactive Graph
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-md">
          {getEquation()}
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Click anywhere on the grid to add points. The curve fits automatically.
        </p>
      </div>

      {/* Reset Button */}
      {points.length > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setPoints([]); }}
          className="absolute top-6 right-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 transition-colors text-sm font-medium z-10"
        >
          Reset
        </button>
      )}

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full cursor-crosshair"
        style={{ height: '500px' }}
        onClick={handleClick}
      >
        {/* Grid */}
        <g opacity="0.3">
          {renderGrid()}
        </g>

        {/* Curve */}
        {points.length >= 2 && (
          <path
            d={getCurvePath()}
            fill="none"
            stroke="url(#curve-gradient)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}

        {/* Gradient Definition */}
        <defs>
          <linearGradient id="curve-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        {/* Points */}
        {points.map(point => {
          const svg = toSVG(point.x, point.y);
          return (
            <g key={point.id}>
              {/* Glow */}
              <circle cx={svg.x} cy={svg.y} r={10} fill="#3b82f6" opacity="0.2" />
              {/* Point */}
              <circle cx={svg.x} cy={svg.y} r={5} fill="#38bdf8" stroke="#0f172a" strokeWidth="2" />
              {/* Label */}
              <text
                x={svg.x}
                y={svg.y - 12}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="11"
                fontFamily="monospace"
              >
                ({point.x}, {point.y})
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default GraphBoard;
