function Display({ params, lumina }) {
  const targetNum = params?.targetNumerator ?? 3;
  const targetDen = params?.targetDenominator ?? 4;
  const showTicks = params?.showTicks !== false;
  const wholes = params?.wholes ?? 1;

  const [parts, setParts] = useState(params?.startParts ?? 2);
  const [markerPos, setMarkerPos] = useState(0);

  const total = parts * wholes;

  const handlePartsChange = (newParts) => {
    setParts(newParts);
    setMarkerPos((m) => Math.min(m, newParts * wholes));
  };

  useEffect(() => {
    lumina.goal(parts === targetDen && markerPos === targetNum);
    lumina.scene({ wholesOnLine: wholes, equalPartsInEachWhole: parts, markerOnTick: markerPos });
  }, [parts, markerPos, targetNum, targetDen, wholes]);

  const lineStart = 80;
  const lineEnd = 600;
  const lineWidth = lineEnd - lineStart;
  const lineY = 160;

  const tickPositions = useMemo(() => {
    const pos = [];
    for (let i = 0; i <= total; i++) pos.push(lineStart + (lineWidth * i) / total);
    return pos;
  }, [total, lineStart, lineWidth]);

  const currentMarkerX = tickPositions[markerPos] ?? lineStart;

  const handleDrag = ({ x }) => {
    let closestIndex = 0;
    let minDiff = Infinity;
    tickPositions.forEach((tx, idx) => {
      const diff = Math.abs(x - tx);
      if (diff < minDiff) { minDiff = diff; closestIndex = idx; }
    });
    setMarkerPos(closestIndex);
  };

  return (
    <Panel title="Fractions on a Number Line" caption="Choose how many equal parts each whole has, then drag the marker.">
      <Stack gap={16}>
        <div>
          <div style={{ color: '#94a3b8', fontSize: 14, marginBottom: 8 }}>Equal parts in each whole:</div>
          <Row gap={8}>
            {[2, 3, 4, 5, 6, 8].map((n) => (
              <button
                key={n}
                id={`btn-parts-${n}`}
                onClick={() => handlePartsChange(n)}
                style={{
                  minWidth: 44, minHeight: 44, padding: '8px 16px', borderRadius: 8,
                  border: parts === n ? '2px solid #38bdf8' : '1px solid #334155',
                  background: parts === n ? '#0284c7' : '#1e293b',
                  color: '#ffffff', fontWeight: 'bold', fontSize: 16, cursor: 'pointer',
                }}
              >
                {n}
              </button>
            ))}
          </Row>
        </div>

        <div style={{ width: '100%', height: 280, background: '#1e293b', borderRadius: 12, overflow: 'hidden' }}>
          <svg viewBox="0 0 680 280" style={{ width: '100%', height: '100%', userSelect: 'none', touchAction: 'none' }}>
            {Array.from({ length: total }).map((_, i) => {
              const x1 = tickPositions[i];
              const x2 = tickPositions[i + 1];
              const isCovered = i < markerPos;
              return (
                <g key={i}>
                  <rect x={x1 + 3} y={lineY - 14} width={x2 - x1 - 6} height={28} rx={4} fill={isCovered ? '#0284c7' : '#334155'} opacity={0.5} />
                  {showTicks && (
                    <text x={(x1 + x2) / 2} y={lineY - 24} fill={isCovered ? '#38bdf8' : '#94a3b8'} fontSize="13" textAnchor="middle" fontWeight="600">
                      1/{parts}
                    </text>
                  )}
                </g>
              );
            })}

            <line x1={lineStart - 30} y1={lineY} x2={lineEnd + 30} y2={lineY} stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
            <polygon points={`${lineStart - 35},${lineY} ${lineStart - 25},${lineY - 6} ${lineStart - 25},${lineY + 6}`} fill="#64748b" />
            <polygon points={`${lineEnd + 35},${lineY} ${lineEnd + 25},${lineY - 6} ${lineEnd + 25},${lineY + 6}`} fill="#64748b" />

            {tickPositions.map((tx, idx) => {
              const isWhole = idx % parts === 0;
              return (
                <g key={idx}>
                  <circle id={`tick-${idx}`} cx={tx} cy={lineY} r="2" fill="transparent" pointerEvents="none" />
                  <line x1={tx} y1={lineY - (isWhole ? 16 : 10)} x2={tx} y2={lineY + (isWhole ? 16 : 10)} stroke="#cbd5e1" strokeWidth={isWhole ? '4' : '2'} />
                  {(isWhole || showTicks) && (
                    <text x={tx} y={lineY + 36} fill="#cbd5e1" fontSize={isWhole ? '16' : '14'} fontWeight={isWhole ? '700' : '400'} textAnchor="middle">
                      {isWhole ? idx / parts : `${idx}/${parts}`}
                    </text>
                  )}
                </g>
              );
            })}

            <Handle id="fraction-marker" x={currentMarkerX} y={lineY} r={24} color="cyan" onDrag={handleDrag} onDrop={handleDrag}>
              <g>
                <circle cx="0" cy="0" r="10" fill="#38bdf8" stroke="#ffffff" strokeWidth="2.5" />
                <line x1="0" y1="0" x2="0" y2="-44" stroke="#38bdf8" strokeWidth="3" />
                <path d="M 0 -44 L 28 -34 L 0 -24 Z" fill="#38bdf8" />
              </g>
            </Handle>
          </svg>
        </div>
      </Stack>
    </Panel>
  );
}
