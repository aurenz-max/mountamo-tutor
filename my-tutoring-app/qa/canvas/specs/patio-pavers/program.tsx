function Display({ params, lumina }) {
  const targetArea = params.targetArea || 18;
  const showTiles = params.showTiles !== false;
  const canDeliver = params.canDeliver !== false;
  const lockRows = params.lockRows || null;

  const maxCols = 7;
  const maxRows = 6;
  const cellSize = 42;
  const gridStartX = 65;
  const gridStartY = 45;

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

  return (
    <Panel title="Patio Paver Delivery" caption="Drag the corner of the patio to change its shape.">
      <Stack gap={12}>
        <Row gap={14}>
          <Readout label="Order" value={targetArea} unit="pavers" color="amber" />
          {canDeliver && <Readout label="Delivered" value={tested ? currentArea : '?'} unit="pavers" color="slate" />}
        </Row>

        <div style={{ display: 'flex', justifyContent: 'center', background: '#0f172a', borderRadius: 8, border: '1px solid #1e293b', padding: 8 }}>
          <svg viewBox="0 0 440 320" style={{ width: '100%', maxWidth: 440, userSelect: 'none', touchAction: 'none' }}>
            <rect x={gridStartX} y={gridStartY} width={maxCols * cellSize} height={maxRows * cellSize} fill="#18181b" stroke="#3f3f46" strokeWidth="2" rx="6" />

            {Array.from({ length: maxCols }).map((_, c) =>
              Array.from({ length: maxRows }).map((_, r) => (
                <rect key={`bg-${c}-${r}`} x={gridStartX + c * cellSize} y={gridStartY + r * cellSize} width={cellSize} height={cellSize} fill="none" stroke="#3f3f46" strokeDasharray="2,3" />
              ))
            )}

            {Array.from({ length: maxCols }).map((_, c) =>
              Array.from({ length: maxRows }).map((_, r) => (
                <circle key={`pt-${c}-${r}`} id={`pt-${c + 1}-${r + 1}`} cx={gridStartX + (c + 1) * cellSize} cy={gridStartY + (r + 1) * cellSize} r="1" fill="transparent" pointerEvents="none" />
              ))
            )}

            <rect x={gridStartX} y={gridStartY} width={cols * cellSize} height={rows * cellSize} fill="rgba(56, 189, 248, 0.1)" stroke="#38bdf8" strokeWidth="2.5" rx="4" />

            <path d={`M ${gridStartX} ${gridStartY - 8} L ${gridStartX + cols * cellSize} ${gridStartY - 8}`} stroke="#38bdf8" strokeWidth="2" />
            <text x={gridStartX + (cols * cellSize) / 2} y={gridStartY - 14} fill="#38bdf8" fontSize="13" fontWeight="bold" textAnchor="middle">{cols} across</text>

            <path d={`M ${gridStartX - 8} ${gridStartY} L ${gridStartX - 8} ${gridStartY + rows * cellSize}`} stroke="#34d399" strokeWidth="2" />
            <text x={gridStartX - 14} y={gridStartY + (rows * cellSize) / 2 + 4} fill="#34d399" fontSize="13" fontWeight="bold" textAnchor="end">{rows} down</text>

            {tilesDrawn &&
              Array.from({ length: cols }).map((_, c) =>
                Array.from({ length: rows }).map((_, r) => (
                  <g key={`tile-${c}-${r}`}>
                    <rect x={gridStartX + c * cellSize + 2} y={gridStartY + r * cellSize + 2} width={cellSize - 4} height={cellSize - 4} rx="4" fill="#fde68a" stroke="#d97706" strokeWidth="1.5" />
                    {tested && <text x={gridStartX + c * cellSize + cellSize / 2} y={gridStartY + r * cellSize + cellSize / 2 + 4} fill="#78350f" fontSize="12" fontWeight="bold" textAnchor="middle">{r * cols + c + 1}</text>}
                  </g>
                ))
              )}

            <Handle id="corner" x={gridStartX + cols * cellSize} y={gridStartY + rows * cellSize} r={13} color="amber" onDrag={resize} onDrop={resize} />
          </svg>
        </div>

        {canDeliver && (
          <Row gap={12}>
            <div id="deliver"><Button label="Deliver Pavers" onClick={() => setTested(true)} /></div>
            {tested && <Formula tex={`${rows} \\text{ rows of } ${cols} = ${rows} \\times ${cols} = ${currentArea}`} />}
          </Row>
        )}
      </Stack>
    </Panel>
  );
}
