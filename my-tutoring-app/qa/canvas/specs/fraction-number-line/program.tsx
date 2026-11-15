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
    // Any partition into a multiple of the denominator is a fair partition: 6/8 marks 3/4 too.
    lumina.goal(parts % targetDen === 0 && markerPos * targetDen === targetNum * parts);
    lumina.scene({ wholesOnLine: wholes, equalPartsInEachWhole: parts, markerOnTick: markerPos });
  }, [parts, markerPos, targetNum, targetDen, wholes]);

  const lineStart = 80;
  const lineEnd = 600;
  const lineWidth = lineEnd - lineStart;
  const lineY = 104;

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
          <div style={{ color: '#cbd5e1', fontSize: 14, marginBottom: 8 }}>Equal parts in each whole:</div>
          <Row gap={8}>
            {[2, 3, 4, 5, 6, 8].map((n) => (
              <button
                key={n}
                id={`btn-parts-${n}`}
                onClick={() => handlePartsChange(n)}
                style={{
                  minWidth: 44, minHeight: 44, padding: '8px 16px', borderRadius: 8,
                  border: parts === n ? '2px solid #22d3ee' : '2px solid #475569',
                  background: parts === n ? '#334155' : '#1e293b',
                  color: '#e2e8f0', fontWeight: 'bold', fontSize: 16, cursor: 'pointer',
                }}
              >
                {n}
              </button>
            ))}
          </Row>
        </div>

        <div>
          <svg viewBox="0 0 680 180" style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', touchAction: 'none' }}>
            <rect width="680" height="180" fill="#0f172a" />
            <rect x="10" y="10" width="660" height="160" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            {Array.from({ length: total }).map((_, i) => {
              const x1 = tickPositions[i];
              const x2 = tickPositions[i + 1];
              const isCovered = i < markerPos;
              return (
                <g key={i}>
                  <rect x={x1 + 3} y={lineY - 14} width={x2 - x1 - 6} height={28} rx={4} fill={isCovered ? '#22d3ee' : '#334155'} opacity={isCovered ? 0.35 : 0.6} />
                  {showTicks && (
                    <text x={(x1 + x2) / 2} y={lineY - 24} fill={isCovered ? '#22d3ee' : '#cbd5e1'} fontSize="14" textAnchor="middle" fontWeight="600">
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
                <circle cx="0" cy="0" r="10" fill="#22d3ee" stroke="#f8fafc" strokeWidth="2.5" />
                <line x1="0" y1="0" x2="0" y2="-44" stroke="#22d3ee" strokeWidth="3" />
                <path d="M 0 -44 L 28 -34 L 0 -24 Z" fill="#22d3ee" />
              </g>
            </Handle>
          </svg>
        </div>
      </Stack>
    </Panel>
  );
}
