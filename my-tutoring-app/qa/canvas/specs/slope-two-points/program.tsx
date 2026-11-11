function Display({ params, lumina }) {
  const targetRise = params?.targetRise ?? 3;
  const targetRun = params?.targetRun ?? 4;
  const targetSlope = targetRise / targetRun;
  // Later problems hide the computed slope, so the child reasons from the rise and the run.
  const showSlope = params?.showSlope ?? true;

  // Coordinate grid bounds: x from -1 to 8, y from -1 to 7
  const xMin = -1;
  const xMax = 8;
  const yMin = -1;
  const yMax = 7;

  // Grid dimensions in SVG
  const width = 640;
  const height = 400;
  const padLeft = 44;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 40;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const toSvgX = (gx) => padLeft + ((gx - xMin) / (xMax - xMin)) * plotW;
  const toSvgY = (gy) => padTop + ((yMax - gy) / (yMax - yMin)) * plotH;
  const toGridX = (sx) => Math.round(xMin + ((sx - padLeft) / plotW) * (xMax - xMin));
  const toGridY = (sy) => Math.round(yMax - ((sy - padTop) / plotH) * (yMax - yMin));

  // Initial distinct points: A at (1, 1), B at (5, 2) -> slope = 1/4
  const [ptA, setPtA] = useState({ x: 1, y: 1 });
  const [ptB, setPtB] = useState({ x: 5, y: 2 });

  const leftPt = ptA.x <= ptB.x ? ptA : ptB;
  const rightPt = ptA.x <= ptB.x ? ptB : ptA;

  const dx = rightPt.x - leftPt.x;
  const dy = rightPt.y - leftPt.y;

  const isIdentical = ptA.x === ptB.x && ptA.y === ptB.y;
  const isVertical = dx === 0 && !isIdentical;
  const currentSlope = dx !== 0 ? dy / dx : null;

  const isGoalMet = !isIdentical && !isVertical && Math.abs(currentSlope - targetSlope) < 0.001;

  useEffect(() => {
    lumina.goal(isGoalMet);
    lumina.scene({
      ptA,
      ptB,
      dx,
      dy,
      // The tutor sees the computed slope only when the child does.
      ...(showSlope ? { currentSlope: dx !== 0 ? dy / dx : 'undefined' } : {}),
      targetSlope: `${targetRise}/${targetRun}`,
    });
  }, [ptA, ptB, isGoalMet, dx, dy, targetRise, targetRun]);

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

  // Pointer drag handling directly using svgPoint
  const svgRef = useRef(null);
  const draggingPin = useRef(null);

  const onPointerDown = (pinKey) => (e) => {
    draggingPin.current = pinKey;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!draggingPin.current || !svgRef.current) return;
    const pt = svgPoint(svgRef.current, e);
    const gx = clamp(toGridX(pt.x), xMin, xMax);
    const gy = clamp(toGridY(pt.y), yMin, yMax);
    if (draggingPin.current === 'A') {
      setPtA({ x: gx, y: gy });
    } else if (draggingPin.current === 'B') {
      setPtB({ x: gx, y: gy });
    }
  };

  const onPointerUp = () => {
    draggingPin.current = null;
  };

  // Grid lines
  const gridLinesX = [];
  for (let x = xMin; x <= xMax; x++) gridLinesX.push(x);
  const gridLinesY = [];
  for (let y = yMin; y <= yMax; y++) gridLinesY.push(y);

  // Extended Line through points
  let extendedLine = null;
  if (!isIdentical) {
    if (dx === 0) {
      extendedLine = {
        x1: toSvgX(ptA.x),
        y1: toSvgY(yMin),
        x2: toSvgX(ptA.x),
        y2: toSvgY(yMax),
      };
    } else {
      const m = (ptB.y - ptA.y) / (ptB.x - ptA.x);
      const b = ptA.y - m * ptA.x;
      extendedLine = {
        x1: toSvgX(xMin),
        y1: toSvgY(m * xMin + b),
        x2: toSvgX(xMax),
        y2: toSvgY(m * xMax + b),
      };
    }
  }

  return (
    <Panel title="Slope Explorer">
      <Stack gap={12}>
        <Row gap={16}>
          <div
            style={{
              flex: 1,
              padding: '10px 14px',
              backgroundColor: '#1e293b',
              borderRadius: 8,
              border: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ color: '#94a3b8', fontSize: 13, marginRight: 8 }}>Target Slope:</span>
              <span style={{ color: '#38bdf8', fontWeight: 600, fontSize: 16 }}>
                <Formula tex={targetRun === 1 ? `m = ${targetRise}` : `m = \\frac{${targetRise}}{${targetRun}}`} />
              </span>
            </div>
            {showSlope && <div>
              <span style={{ color: '#94a3b8', fontSize: 13, marginRight: 8 }}>Current Slope:</span>
              <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 16 }}>
                {isIdentical ? (
                  'Same point'
                ) : isVertical ? (
                  'Undefined (run = 0)'
                ) : (
                  <Formula
                    tex={`m = \\frac{\\text{rise}}{\\text{run}} = \\frac{${dy}}{${dx}} ${
                      dx !== 0 && dy % dx === 0 ? '= ' + dy / dx : ''
                    }`}
                  />
                )}
              </span>
            </div>}
          </div>
        </Row>

        <div
          style={{
            position: 'relative',
            width: '100%',
            background: '#0f172a',
            borderRadius: 10,
            border: '1px solid #1e293b',
            overflow: 'hidden',
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', touchAction: 'none' }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <defs>
              <clipPath id="plotClip">
                <rect x={padLeft} y={padTop} width={plotW} height={plotH} />
              </clipPath>
            </defs>

            {/* Grid lines */}
            {gridLinesX.map((x) => (
              <line
                key={`gx-${x}`}
                x1={toSvgX(x)}
                y1={padTop}
                x2={toSvgX(x)}
                y2={height - padBottom}
                stroke={x === 0 ? '#64748b' : '#1e293b'}
                strokeWidth={x === 0 ? 2 : 1}
              />
            ))}
            {gridLinesY.map((y) => (
              <line
                key={`gy-${y}`}
                x1={padLeft}
                y1={toSvgY(y)}
                x2={width - padRight}
                y2={toSvgY(y)}
                stroke={y === 0 ? '#64748b' : '#1e293b'}
                strokeWidth={y === 0 ? 2 : 1}
              />
            ))}

            {/* Grid Numbers */}
            {gridLinesX.map((x) => (
              <text
                key={`lx-${x}`}
                x={toSvgX(x)}
                y={height - padBottom + 16}
                fill="#64748b"
                fontSize="11"
                textAnchor="middle"
              >
                {x}
              </text>
            ))}
            {gridLinesY.map((y) => (
              <text
                key={`ly-${y}`}
                x={padLeft - 10}
                y={toSvgY(y) + 4}
                fill="#64748b"
                fontSize="11"
                textAnchor="end"
              >
                {y}
              </text>
            ))}

            {/* Extended Line through points */}
            {extendedLine && (
              <line
                x1={extendedLine.x1}
                y1={extendedLine.y1}
                x2={extendedLine.x2}
                y2={extendedLine.y2}
                stroke="#60a5fa"
                strokeWidth={3}
                clipPath="url(#plotClip)"
              />
            )}

            {/* Slope Triangle: Run (horizontal) and Rise (vertical) */}
            {!isIdentical && dx > 0 && (
              <g>
                {/* Horizontal run leg */}
                <line
                  x1={toSvgX(leftPt.x)}
                  y1={toSvgY(leftPt.y)}
                  x2={toSvgX(rightPt.x)}
                  y2={toSvgY(leftPt.y)}
                  stroke="#38bdf8"
                  strokeWidth="3"
                />
                {/* Vertical rise leg */}
                <line
                  x1={toSvgX(rightPt.x)}
                  y1={toSvgY(leftPt.y)}
                  x2={toSvgX(rightPt.x)}
                  y2={toSvgY(rightPt.y)}
                  stroke="#fbbf24"
                  strokeWidth="3"
                />

                {/* Triangle fill */}
                <polygon
                  points={`
                    ${toSvgX(leftPt.x)},${toSvgY(leftPt.y)}
                    ${toSvgX(rightPt.x)},${toSvgY(leftPt.y)}
                    ${toSvgX(rightPt.x)},${toSvgY(rightPt.y)}
                  `}
                  fill="rgba(56, 189, 248, 0.08)"
                />

                {/* Run Label */}
                <text
                  x={(toSvgX(leftPt.x) + toSvgX(rightPt.x)) / 2}
                  y={toSvgY(leftPt.y) + (dy >= 0 ? 16 : -8)}
                  fill="#38bdf8"
                  fontSize="12"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  run = +{dx}
                </text>

                {/* Rise Label */}
                <text
                  x={toSvgX(rightPt.x) + 8}
                  y={(toSvgY(leftPt.y) + toSvgY(rightPt.y)) / 2 + 4}
                  fill="#fbbf24"
                  fontSize="12"
                  fontWeight="600"
                  textAnchor="start"
                >
                  rise = {dy >= 0 ? `+${dy}` : dy}
                </text>
              </g>
            )}

            {/* Draggable Point A */}
            <g
              id="pin-a"
              style={{ cursor: 'grab' }}
              onPointerDown={onPointerDown('A')}
            >
              <circle cx={toSvgX(ptA.x)} cy={toSvgY(ptA.y)} r="22" fill="#3b82f6" opacity="0.25" />
              <circle cx={toSvgX(ptA.x)} cy={toSvgY(ptA.y)} r="8" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />
              <text
                x={toSvgX(ptA.x)}
                y={toSvgY(ptA.y) - 14}
                fill="#93c5fd"
                fontSize="12"
                fontWeight="bold"
                textAnchor="middle"
              >
                A ({ptA.x}, {ptA.y})
              </text>
            </g>

            {/* Draggable Point B */}
            <g
              id="pin-b"
              style={{ cursor: 'grab' }}
              onPointerDown={onPointerDown('B')}
            >
              <circle cx={toSvgX(ptB.x)} cy={toSvgY(ptB.y)} r="22" fill="#ec4899" opacity="0.25" />
              <circle cx={toSvgX(ptB.x)} cy={toSvgY(ptB.y)} r="8" fill="#ec4899" stroke="#ffffff" strokeWidth="2" />
              <text
                x={toSvgX(ptB.x)}
                y={toSvgY(ptB.y) - 14}
                fill="#f472b6"
                fontSize="12"
                fontWeight="bold"
                textAnchor="middle"
              >
                B ({ptB.x}, {ptB.y})
              </text>
            </g>
          </svg>
        </div>

        <Row gap={12}>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>Run</span> is horizontal distance (left to right).{' '}
            <span style={{ color: '#fbbf24', fontWeight: 600 }}>Rise</span> is vertical distance (up or down). Drag the pins to adjust.
          </div>
        </Row>
      </Stack>
    </Panel>
  );
}