// Area and fence (3.MD.D.8). The child drags the corner of a garden on a tile grid. On most problems a tray holds a
// fixed number of tiles; the child shapes a garden that uses every tile and is as deep as the ask says, then says how
// many units of fence go around it. On the fence problem the tray holds fence rails instead, and the child says how
// many tiles fit inside. A shed may take a corner of the grid, which turns the garden into an L.
// The rule: shapes with the same area can have different perimeters. The last garden is drawn small beside the new
// one, with no numbers, so the minimal pair (same tiles, new shape) is in view. The misrules are computed: the last
// garden's fence (same tiles, same fence), the tiles instead of the fence, the tiles along the edge instead of the
// sides of the fence, and on the fence problem the other garden's tiles (same fence, same tiles).
function Display({ params, lumina }) {
  const fixed = params.fixed === 'fence' ? 'fence' : 'tiles';
  const amount = Number(params.amount) || 12; // tiles in the tray, or fence rails in the tray
  const depth = Number(params.depth) || 3; // rows the garden must have
  const posts = params.posts === true; // fence drawn as separate rails with posts (first problem only)
  const shed = params.shed ? { cols: Number(params.shed.cols) || 0, rows: Number(params.shed.rows) || 0 } : null;
  const last = params.last ? { cols: Number(params.last.cols) || 1, rows: Number(params.last.rows) || 1, asked: params.last.asked === 'tiles' ? 'tiles' : 'fence' } : null;
  const lastLabel = params.lastLabel || 'Last garden';

  const MAXC = 12, MAXR = 5, CELL = 36, GX = 40, GY = 48;
  const [cols, setCols] = useState(Number(params.startCols) || 2);
  const [rows, setRows] = useState(Number(params.startRows) || 2);

  // The cells of a garden cols x rows with the shed's corner taken out.
  const cellsOf = (c, r) => {
    const out = [];
    for (let j = 0; j < r; j++) for (let i = 0; i < c; i++) if (!(shed && i < shed.cols && j < shed.rows)) out.push([i, j]);
    return out;
  };
  // Unit edges with a garden cell on one side only: the fence.
  const edgesOf = cells => {
    const has = new Set(cells.map(([i, j]) => i + ',' + j));
    const out = [];
    cells.forEach(([i, j]) => {
      if (!has.has(i + ',' + (j - 1))) out.push([i, j, i + 1, j]);
      if (!has.has(i + ',' + (j + 1))) out.push([i, j + 1, i + 1, j + 1]);
      if (!has.has((i - 1) + ',' + j)) out.push([i, j, i, j + 1]);
      if (!has.has((i + 1) + ',' + j)) out.push([i + 1, j, i + 1, j + 1]);
    });
    return out;
  };
  const edgeTiles = cells => {
    const has = new Set(cells.map(([i, j]) => i + ',' + j));
    return cells.filter(([i, j]) => !(has.has(i + ',' + (j - 1)) && has.has(i + ',' + (j + 1)) && has.has((i - 1) + ',' + j) && has.has((i + 1) + ',' + j))).length;
  };

  const cells = cellsOf(cols, rows);
  const fence = edgesOf(cells);
  const met = rows === depth && (fixed === 'tiles' ? cells.length === amount : fence.length === amount);

  // The one garden the ask allows: the right depth, every tile (or rail) used.
  useEffect(() => {
    let goalCells = null;
    for (let c = 1; c <= MAXC && !goalCells; c++) {
      const cs = cellsOf(c, depth);
      if (fixed === 'tiles' ? cs.length === amount : edgesOf(cs).length === amount) goalCells = cs;
    }
    if (!goalCells) return;
    const key = fixed === 'tiles' ? edgesOf(goalCells).length : goalCells.length;
    const lastTiles = last ? last.cols * last.rows : null;
    const lastFence = last ? 2 * (last.cols + last.rows) : null;
    // The last garden's own answer: its fence, or its tiles when the last problem asked for tiles.
    const lastKey = last ? (last.asked === 'tiles' ? lastTiles : lastFence) : null;
    const misrules = (fixed === 'tiles'
      ? [
          last ? { says: lastKey, because: lastTiles === amount ? 'same tiles, so the same fence as the last garden' : 'said the last garden\'s answer again' } : null,
          { says: goalCells.length, because: 'counted the tiles inside, not the fence around' },
          { says: edgeTiles(goalCells), because: 'counted the tiles along the edge, not the sides of the fence' },
        ]
      : [
          last ? { says: lastTiles, because: 'same fence, so the same tiles as the other garden' } : null,
          { says: amount, because: 'gave the length of the fence, not the tiles inside' },
        ]
    ).filter((m, i, all) => m && m.says > 0 && m.says !== key && all.findIndex(x => x && x.says === m.says) === i).slice(0, 3);
    lumina.answer(key, misrules);
  }, []);

  useEffect(() => {
    lumina.goal(met);
    lumina.scene({
      gardenAcross: cols, gardenDown: rows, shedInCorner: !!shed,
      ...(fixed === 'tiles' ? { tilesInTray: Math.max(0, amount - cells.length), tilesShort: Math.max(0, cells.length - amount) } : { railsInTray: Math.max(0, amount - fence.length), railsShort: Math.max(0, fence.length - amount) }),
      ...(last ? { [lastLabel === 'Last garden' ? 'lastGarden' : 'otherGarden']: last.cols + ' across by ' + last.rows + ' down' } : {}),
    });
  }, [cols, rows]);

  const resize = ({ x, y }) => {
    setCols(Math.max(1, Math.min(MAXC, Math.round((x - GX) / CELL))));
    setRows(Math.max(1, Math.min(MAXR, Math.round((y - GY) / CELL))));
  };

  const W = 680, H = 360;
  const TRAY = { x: 500, y: 48, w: 164, h: 180 };
  const px = i => GX + i * CELL, py = j => GY + j * CELL;
  const used = fixed === 'tiles' ? Math.min(cells.length, amount) : Math.min(fence.length, amount);
  const left = amount - used;

  const tile = (x, y, s, key) => <rect key={key} x={x + 2} y={y + 2} width={s - 4} height={s - 4} rx="4" fill="#fde68a" stroke="#d97706" strokeWidth="1.5" />;

  // The small last garden: tiles and fence, no numbers.
  const S = 15, LX = 40, LY = 286;
  const lastPic = last && (
    <g>
      <text x={LX} y={LY - 12} fontSize="15" fill="#cbd5e1">{lastLabel}</text>
      {Array.from({ length: last.rows }).map((_, j) => Array.from({ length: last.cols }).map((_, i) => tile(LX + i * S, LY + j * S, S, 'l' + i + '-' + j)))}
      <rect x={LX} y={LY} width={last.cols * S} height={last.rows * S} fill="none" stroke="#a16207" strokeWidth="3" />
    </g>
  );

  return (
    <Panel title="Garden Fence" caption="Drag the round corner to change the garden.">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', touchAction: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />

        <rect x={GX} y={GY} width={MAXC * CELL} height={MAXR * CELL} fill="#1e293b" stroke="#475569" strokeWidth="2" rx="6" />
        {Array.from({ length: MAXC }).map((_, i) => Array.from({ length: MAXR }).map((_, j) => (
          <rect key={'bg' + i + '-' + j} x={px(i)} y={py(j)} width={CELL} height={CELL} fill="none" stroke="#334155" strokeWidth="1" />
        )))}
        {Array.from({ length: MAXC }).map((_, i) => Array.from({ length: MAXR }).map((_, j) => (
          <circle key={'pt' + i + '-' + j} id={'pt-' + (i + 1) + '-' + (j + 1)} cx={px(i + 1)} cy={py(j + 1)} r="1" fill="transparent" pointerEvents="none" />
        )))}

        {shed && (
          <g>
            <rect x={px(0)} y={py(0)} width={shed.cols * CELL} height={shed.rows * CELL} fill="#57534e" stroke="#a8a29e" strokeWidth="2" />
            <text x={px(0) + (shed.cols * CELL) / 2} y={py(0) + (shed.rows * CELL) / 2 + 2} textAnchor="middle" dominantBaseline="middle" fontSize="34">🛖</text>
          </g>
        )}

        {cells.map(([i, j], k) =>
          fixed === 'tiles'
            ? (k < amount ? tile(px(i), py(j), CELL, 'c' + i + '-' + j)
              : <rect key={'c' + i + '-' + j} x={px(i) + 3} y={py(j) + 3} width={CELL - 6} height={CELL - 6} rx="4" fill="none" stroke="#64748b" strokeDasharray="6 5" />)
            : <rect key={'c' + i + '-' + j} x={px(i) + 2} y={py(j) + 2} width={CELL - 4} height={CELL - 4} rx="3" fill="#5b3a1e" stroke="#7c4a1e" strokeWidth="1" />
        )}

        {fence.map(([a, b, c, d], k) => {
          const short = fixed === 'fence' && k >= amount;
          return <line key={'f' + k} x1={px(a)} y1={py(b)} x2={px(c)} y2={py(d)} stroke={short ? '#64748b' : '#a16207'} strokeWidth={short ? 3 : 5} strokeDasharray={short ? '6 5' : undefined} strokeLinecap="round" />;
        })}
        {(posts || fixed === 'fence') && fence.map(([a, b, c, d], k) => (
          <g key={'p' + k}>
            <circle cx={px(a)} cy={py(b)} r="4" fill="#fef3c7" />
            <circle cx={px(c)} cy={py(d)} r="4" fill="#fef3c7" />
          </g>
        ))}

        <Handle id="corner" x={px(cols)} y={py(rows)} r={14} color="cyan" onDrag={resize} onDrop={resize} />

        <rect x={TRAY.x} y={TRAY.y} width={TRAY.w} height={TRAY.h} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text x={TRAY.x + 16} y={TRAY.y + 28} fontSize="16" fill="#e2e8f0">{fixed === 'tiles' ? 'Tile tray' : 'Fence rails'}</text>
        {Array.from({ length: left }).map((_, k) => {
          const col = k % 4, row = Math.floor(k / 4);
          return fixed === 'tiles'
            ? tile(TRAY.x + 14 + col * 34, TRAY.y + 42 + row * 34, 32, 'tr' + k)
            : <rect key={'tr' + k} x={TRAY.x + 18 + col * 34} y={TRAY.y + 50 + row * 30} width="26" height="7" rx="3" fill="#a16207" />;
        })}

        {lastPic}
      </svg>
    </Panel>
  );
}
