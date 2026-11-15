function Display({ params, lumina }) {
  const targetArea = params.targetArea || 18;
  const showTiles = params.showTiles !== false;
  const canDeliver = params.canDeliver !== false;
  const lockRows = params.lockRows || null;

  const maxCols = 7;
  const maxRows = 6;
  const cellSize = 46;
  const gridStartX = 92;
  const gridStartY = 62;

  const [cols, setCols] = useState(params.startCols || 3);
  const [rows, setRows] = useState(lockRows || params.startRows || 3);
  const [tested, setTested] = useState(false);

  const currentArea = cols * rows;

  useEffect(() => {
    lumina.goal(currentArea === targetArea);
    lumina.scene({ orderPavers: targetArea, across: cols, down: rows, delivered: tested ? currentArea : null, ...(lockRows ? { rowsFixed: true } : {}) });
  }, [cols, rows, tested, targetArea, currentArea, lockRows]);

  const resize = ({ x, y }) => {
    setTested(false);
    setCols(Math.max(1, Math.min(maxCols, Math.round((x - gridStartX) / cellSize))));
    if (!lockRows) setRows(Math.max(1, Math.min(maxRows, Math.round((y - gridStartY) / cellSize))));
  };

  const tilesDrawn = showTiles || tested;
  const W = 680, H = 380;
  const CARD = { x: 450, y: 20, w: 212, h: 340 };

  return (
    <Panel title="Patio Paver Delivery" caption={canDeliver ? 'Drag the corner of the patio to change its shape. Tap Deliver to lay the pavers.' : 'Drag the corner of the patio to change its shape.'}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', touchAction: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />

        <rect x={gridStartX} y={gridStartY} width={maxCols * cellSize} height={maxRows * cellSize} fill="#1e293b" stroke="#475569" strokeWidth="2" rx="8" />
        {Array.from({ length: maxCols }).map((_, c) =>
          Array.from({ length: maxRows }).map((_, r) => (
            <rect key={`bg-${c}-${r}`} x={gridStartX + c * cellSize} y={gridStartY + r * cellSize} width={cellSize} height={cellSize} fill="none" stroke="#475569" strokeDasharray="6 5" />
          ))
        )}

        {Array.from({ length: maxCols }).map((_, c) =>
          Array.from({ length: maxRows }).map((_, r) => (
            <circle key={`pt-${c}-${r}`} id={`pt-${c + 1}-${r + 1}`} cx={gridStartX + (c + 1) * cellSize} cy={gridStartY + (r + 1) * cellSize} r="1" fill="transparent" pointerEvents="none" />
          ))
        )}

        <rect x={gridStartX} y={gridStartY} width={cols * cellSize} height={rows * cellSize} fill="rgba(34, 211, 238, 0.10)" stroke="#22d3ee" strokeWidth="2.5" rx="4" />

        <path d={`M ${gridStartX} ${gridStartY - 9} L ${gridStartX + cols * cellSize} ${gridStartY - 9}`} stroke="#22d3ee" strokeWidth="2" />
        <text x={gridStartX + (cols * cellSize) / 2} y={gridStartY - 16} fill="#22d3ee" fontSize="15" fontWeight="700" textAnchor="middle">{cols} across</text>

        <path d={`M ${gridStartX - 9} ${gridStartY} L ${gridStartX - 9} ${gridStartY + rows * cellSize}`} stroke="#34d399" strokeWidth="2" />
        <text x={gridStartX - 16} y={gridStartY + (rows * cellSize) / 2 + 5} fill="#34d399" fontSize="15" fontWeight="700" textAnchor="end">{rows} down</text>

        {tilesDrawn &&
          Array.from({ length: cols }).map((_, c) =>
            Array.from({ length: rows }).map((_, r) => (
              <g key={`tile-${c}-${r}`}>
                <rect x={gridStartX + c * cellSize + 3} y={gridStartY + r * cellSize + 3} width={cellSize - 6} height={cellSize - 6} rx="5" fill="#fde68a" stroke="#d97706" strokeWidth="1.5" />
                {tested && <text x={gridStartX + c * cellSize + cellSize / 2} y={gridStartY + r * cellSize + cellSize / 2 + 5} fill="#78350f" fontSize="14" fontWeight="700" textAnchor="middle">{r * cols + c + 1}</text>}
              </g>
            ))
          )}

        <Handle id="corner" x={gridStartX + cols * cellSize} y={gridStartY + rows * cellSize} r={13} color="amber" onDrag={resize} onDrop={resize} />

        <rect x={CARD.x} y={CARD.y} width={CARD.w} height={CARD.h} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text x={CARD.x + 20} y={CARD.y + 34} fontSize="14" fill="#cbd5e1">Order</text>
        <text x={CARD.x + 20} y={CARD.y + 68} fontSize="26" fontWeight="700" fill="#e2e8f0">{targetArea} pavers</text>

        {canDeliver && (
          <g>
            <line x1={CARD.x + 16} y1={CARD.y + 94} x2={CARD.x + CARD.w - 16} y2={CARD.y + 94} stroke="#475569" strokeWidth="1.5" />
            <g id="deliver" onClick={() => setTested(true)} style={{ cursor: 'pointer' }}>
              <rect x={CARD.x + 20} y={CARD.y + 112} width={CARD.w - 40} height="50" rx="12" fill="#334155" stroke="#64748b" strokeWidth="2" />
              <text x={CARD.x + CARD.w / 2} y={CARD.y + 143} textAnchor="middle" fontSize="17" fontWeight="700" fill="#e2e8f0">Deliver</text>
            </g>
            {tested && (
              <g>
                <text x={CARD.x + 20} y={CARD.y + 206} fontSize="17" fill="#e2e8f0">{rows} rows of {cols}</text>
                <text x={CARD.x + 20} y={CARD.y + 240} fontSize="22" fontWeight="700" fill="#e2e8f0">{rows} × {cols} = {currentArea}</text>
              </g>
            )}
          </g>
        )}
      </svg>
    </Panel>
  );
}
