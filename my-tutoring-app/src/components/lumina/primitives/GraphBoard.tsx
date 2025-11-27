import React, { useRef, useState, useEffect } from 'react';

interface GraphBoardProps {
  points: Point[];
  onAddPoint: (point: Point) => void;
  onClear: () => void;
  className?: string;
}

const X_MIN = -10;
const X_MAX = 10;
const Y_MIN = -10;
const Y_MAX = 10;
const GRID_SIZE = 20; // Visual grid units

export interface Point {
  id: string;
  x: number;
  y: number;
}

export interface PolynomialResult {
  equation: string;
  degree: number;
  predict: (x: number) => number;
  coefficients: number[];
}


/**
 * rounds a number to a specific number of decimal places
 */
const round = (num: number, decimals: number = 2): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
};

/**
 * Converts a number to unicode superscript string
 */
const toSuperscript = (num: number): string => {
  const map: {[key: string]: string} = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '-': '⁻'
  };
  return num.toString().split('').map(char => map[char] || char).join('');
};

/**
 * Generates a PolynomialResult based on a set of points using Lagrange Interpolation.
 */
export const calculatePolynomial = (points: Point[]): PolynomialResult => {
  // Sort points by x to ensure proper processing
  const sortedPoints = [...points].sort((a, b) => a.x - b.x);
  const n = sortedPoints.length;

  // 0 Points: No function
  if (n === 0) {
    return {
      equation: '',
      degree: 0,
      predict: () => 0,
      coefficients: [],
    };
  }

  // 1 Point: Constant function y = c
  if (n === 1) {
    const y = sortedPoints[0].y;
    return {
      equation: `y = ${round(y)}`,
      degree: 0,
      predict: () => y,
      coefficients: [y],
    };
  }

  // Calculate Coefficients via Lagrange Expansion
  // P(x) = sum(y_j * L_j(x))
  // where L_j(x) = prod((x - x_i) / (x_j - x_i)) for i != j

  // Initialize coefficients array [x^0, x^1, ..., x^(n-1)]
  const coeffs = new Array(n).fill(0);

  for (let j = 0; j < n; j++) {
    const xj = sortedPoints[j].x;
    const yj = sortedPoints[j].y;

    // 1. Calculate denominator: prod(x_j - x_i)
    let denominator = 1;
    for (let i = 0; i < n; i++) {
      if (i !== j) {
        denominator *= (xj - sortedPoints[i].x);
      }
    }
    
    // 2. Calculate numerator polynomial: prod(x - x_i)
    // We expand the product of linear terms to get coefficients
    let termCoeffs = [1]; // Start with constant 1 (x^0)
    
    for (let i = 0; i < n; i++) {
      if (i !== j) {
        const xi = sortedPoints[i].x;
        // Multiply current poly 'termCoeffs' by (x - xi)
        // New poly will have degree + 1
        const nextCoeffs = new Array(termCoeffs.length + 1).fill(0);
        
        for (let k = 0; k < termCoeffs.length; k++) {
          // termCoeffs[k] is coeff of x^k
          
          // Contribution to x^(k+1) is 1 * termCoeffs[k]
          nextCoeffs[k+1] += termCoeffs[k];
          
          // Contribution to x^k is -xi * termCoeffs[k]
          nextCoeffs[k] -= xi * termCoeffs[k];
        }
        termCoeffs = nextCoeffs;
      }
    }

    // 3. Add weighted terms to final coefficients
    const weight = yj / denominator;
    for (let k = 0; k < termCoeffs.length; k++) {
      coeffs[k] += termCoeffs[k] * weight;
    }
  }

  // Format Equation String
  let equationParts: string[] = [];
  
  // Iterate from highest power down to 0
  for (let power = n - 1; power >= 0; power--) {
    const c = coeffs[power];
    
    // Skip terms close to zero (unless it's the constant term and we have nothing else yet, or it's the only term)
    if (Math.abs(c) < 0.0001) continue;

    const absC = Math.abs(c);
    const roundedC = round(absC);
    
    // Determine Sign prefix
    let prefix = "";
    if (equationParts.length === 0) {
      if (c < 0) prefix = "-";
    } else {
      prefix = c < 0 ? " - " : " + ";
    }

    // Determine Value string
    let valStr = roundedC.toString();
    // Hide coefficient '1' if there is a variable part (e.g. 1x -> x)
    if (Math.abs(roundedC - 1) < 0.0001 && power > 0) {
      valStr = "";
    }

    // Determine Variable part
    let varStr = "";
    if (power === 1) varStr = "x";
    else if (power > 1) varStr = `x${toSuperscript(power)}`;

    // Special case handling for " - x" where valStr is empty but we need space if implied 1
    // Actually, prefix handles spaces. " - " + "" + "x" -> " - x"
    // Initial term: "-" + "" + "x" -> "-x"
    
    equationParts.push(`${prefix}${valStr}${varStr}`);
  }

  if (equationParts.length === 0) {
    equationParts.push("0");
  }

  const equationStr = `y = ${equationParts.join("")}`;

  // Use direct Lagrange for prediction to maintain stability in graph plotting
  // (Expanding coefficients can introduce floating point drift for rendering)
  const predict = (x: number): number => {
    let result = 0;
    for (let j = 0; j < n; j++) {
      let term = sortedPoints[j].y;
      for (let i = 0; i < n; i++) {
        if (i !== j) {
          const denominator = sortedPoints[j].x - sortedPoints[i].x;
          if (denominator !== 0) {
            term = term * (x - sortedPoints[i].x) / denominator;
          }
        }
      }
      result += term;
    }
    return result;
  };

  return {
    equation: equationStr,
    degree: n - 1,
    predict,
    coefficients: coeffs,
  };
};

/**
 * Generate SVG path data for the curve
 */
export const generateCurvePath = (
  predict: (x: number) => number,
  width: number,
  height: number,
  xDomain: [number, number],
  yDomain: [number, number],
  step: number = 0.1
): string => {
  const [xMin, xMax] = xDomain;
  const [yMin, yMax] = yDomain;

  const xScale = (val: number) => ((val - xMin) / (xMax - xMin)) * width;
  // SVG y coordinates are inverted (0 at top)
  const yScale = (val: number) => height - ((val - yMin) / (yMax - yMin)) * height;

  let d = "";
  let isFirst = true;

  // Render slightly outside the domain to ensure edge-to-edge
  for (let x = xMin; x <= xMax; x += step) {
    const y = predict(x);
    
    // Clamp y for rendering sanity, though SVG handles off-canvas okay
    // We just don't want massive coordinates breaking the render engine
    if (Math.abs(y) > Math.max(Math.abs(yMin), Math.abs(yMax)) * 10) continue;

    const canvasX = xScale(x);
    const canvasY = yScale(y);

    if (isFirst) {
      d += `M ${canvasX} ${canvasY}`;
      isFirst = false;
    } else {
      d += ` L ${canvasX} ${canvasY}`;
    }
  }

  return d;
};

const GraphBoard: React.FC<GraphBoardProps> = ({ points, onAddPoint, onClear, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoverPos, setHoverPos] = useState<Point | null>(null);

  // Polynomial Logic
  const polyResult = calculatePolynomial(points);
  
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    window.addEventListener('resize', updateSize);
    updateSize();
    
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert pixel to cartesian
    const xRange = X_MAX - X_MIN;
    const yRange = Y_MAX - Y_MIN;

    const rawX = X_MIN + (clickX / dimensions.width) * xRange;
    const rawY = Y_MAX - (clickY / dimensions.height) * yRange; // Inverted Y for math

    // Snap to nearest integer for cleaner UX
    const snapX = Math.round(rawX);
    const snapY = Math.round(rawY);

    onAddPoint({ id: Date.now().toString(), x: snapX, y: snapY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xRange = X_MAX - X_MIN;
    const yRange = Y_MAX - Y_MIN;

    const rawX = X_MIN + (clickX / dimensions.width) * xRange;
    const rawY = Y_MAX - (clickY / dimensions.height) * yRange;

    setHoverPos({ id: 'hover', x: Math.round(rawX), y: Math.round(rawY) });
  };

  // Convert cartesian to pixel
  const toPixels = (x: number, y: number) => {
    const xRange = X_MAX - X_MIN;
    const yRange = Y_MAX - Y_MIN;
    const px = ((x - X_MIN) / xRange) * dimensions.width;
    const py = dimensions.height - ((y - Y_MIN) / yRange) * dimensions.height;
    return { x: px, y: py };
  };

  const curvePath = polyResult.degree >= 0 && points.length > 0
    ? generateCurvePath(polyResult.predict, dimensions.width, dimensions.height, [X_MIN, X_MAX], [Y_MIN, Y_MAX])
    : '';

  return (
    <div 
      ref={containerRef} 
      className={`relative bg-[#0F172A] rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50 cursor-crosshair group ${className}`}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverPos(null)}
    >
      {/* Background Grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
        <pattern id="grid" width={dimensions.width / (X_MAX - X_MIN)} height={dimensions.height / (Y_MAX - Y_MIN)} patternUnits="userSpaceOnUse">
          <path d={`M ${dimensions.width / (X_MAX - X_MIN)} 0 L 0 0 0 ${dimensions.height / (Y_MAX - Y_MIN)}`} fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-500" />
        </pattern>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Axes */}
        {dimensions.width > 0 && (
          <>
            <line 
              x1={dimensions.width / 2} y1={0} 
              x2={dimensions.width / 2} y2={dimensions.height} 
              stroke="currentColor" strokeWidth="2" className="text-slate-400" 
            />
            <line 
              x1={0} y1={dimensions.height / 2} 
              x2={dimensions.width} y2={dimensions.height / 2} 
              stroke="currentColor" strokeWidth="2" className="text-slate-400" 
            />
          </>
        )}
      </svg>

      {/* Main Graph Content */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        
        {/* The Polynomial Curve */}
        {curvePath && (
            <path 
                d={curvePath} 
                fill="none" 
                stroke="url(#gradient-line)" 
                strokeWidth="4" 
                strokeLinecap="round"
                className="drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]"
            />
        )}
        
        <defs>
            <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="50%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
        </defs>

        {/* Existing Points */}
        {points.map((p, idx) => {
          const { x, y } = toPixels(p.x, p.y);
          return (
            <g key={p.id}>
                {/* Glow effect */}
                <circle cx={x} cy={y} r={12} fill="currentColor" className="text-blue-500 opacity-20 animate-pulse" />
                {/* Point */}
                <circle cx={x} cy={y} r={5} fill="#38BDF8" stroke="#0F172A" strokeWidth="2" />
                {/* Label */}
                <text x={x} y={y - 15} textAnchor="middle" fill="#94A3B8" fontSize="10" className="font-mono">
                    ({p.x}, {p.y})
                </text>
            </g>
          );
        })}

        {/* Hover Guide */}
        {hoverPos && (
            <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <circle 
                    cx={toPixels(hoverPos.x, hoverPos.y).x} 
                    cy={toPixels(hoverPos.x, hoverPos.y).y} 
                    r={4} 
                    fill="none" 
                    stroke="rgba(255,255,255,0.3)" 
                    strokeDasharray="4 2"
                />
                <text 
                    x={toPixels(hoverPos.x, hoverPos.y).x + 10} 
                    y={toPixels(hoverPos.x, hoverPos.y).y - 10} 
                    fill="white" 
                    fontSize="10" 
                    className="font-mono bg-black"
                >
                    {hoverPos.x}, {hoverPos.y}
                </text>
            </g>
        )}
      </svg>
      
      {/* Title Overlay */}
      <div className="absolute top-6 left-8 pointer-events-none max-w-[80%]">
         <div className="inline-block px-3 py-1 mb-2 text-[10px] font-bold tracking-widest text-blue-300 uppercase bg-blue-900/30 rounded-full border border-blue-800">
            Interactive Graph
         </div>
         <h2 className="text-2xl md:text-3xl font-bold text-white drop-shadow-md break-words leading-tight">
            {polyResult.degree <= 0 && points.length === 0 ? "Plot a Point" : polyResult.equation || "Calculating..."}
         </h2>
         <p className="text-slate-400 text-sm mt-1 max-w-md">
            Click anywhere on the grid to add a data point. The system will automatically fit a polynomial curve.
         </p>
      </div>

       {/* Clear Button */}
       {points.length > 0 && (
        <button 
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="absolute bottom-6 right-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 transition-colors text-sm font-medium z-10 pointer-events-auto"
        >
            Reset Graph
        </button>
       )}
    </div>
  );
};

export default GraphBoard;
