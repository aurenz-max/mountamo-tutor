// Any number (6.EE.A.2). A growing tile pattern: figure n is built by one rule (n + 2, 2n, 2n + 1, 3n - 1, 3n + 1).
// A stepper shows figures 1 to `shown` only (never as far as 5, never figure 10), so the figure the child is asked
// about can only come from the rule. The child builds figure `build` by hand, tapping cells to lay or lift tiles.
// The rule: a letter stands for any number, and the rule holds for all of them.
// Say and show: the said answer is the tiles in figure 10 (or, with `askTiles`, the figure that has that many
// tiles: the ask on every problem whose rule is printed, so the printed rule never answers it by substitution); Check judges that the built figure has the pattern's shape for figure `build` (anywhere on the board).
// No tile count is printed anywhere.
function Display({ params, lumina }) {
  const pattern = String(params.pattern || 'cup');
  const shown = Math.max(1, Math.min(4, Number(params.shown) || 4));
  const build = Number(params.build) || 5;
  const showRule = params.showRule === true || params.showRule === 'true';
  const askTiles = Number(params.askTiles) || 0;

  // Cells of figure n as [col, row], row 0 at the bottom.
  const cellsOf = (n) => {
    const out = [];
    if (pattern === 'pairs') { for (let c = 0; c < n; c++) out.push([c, 0], [c, 1]); }
    else if (pattern === 'pairs-plus') { out.push([0, 0]); for (let c = 1; c <= n; c++) out.push([c, 0], [c, 1]); }
    else if (pattern === 'castle') { for (let c = 0; c < 2 * n; c++) out.push([c, 0]); for (let c = 1; c < 2 * n - 1; c += 2) out.push([c, 1]); }
    else if (pattern === 'fence') { out.push([0, 0]); for (let c = 1; c <= n; c++) out.push([c, 0], [c, 1], [c, 2]); }
    else { out.push([0, 1]); for (let c = 1; c <= n; c++) out.push([c, 0]); out.push([n + 1, 1]); } // cup
    return out;
  };
  const RULES = { cup: 'n + 2', pairs: '2n', 'pairs-plus': '2n + 1', castle: '3n − 1', fence: '3n + 1' };
  const LOOKS = {
    cup: 'a flat row with one raised tile at each end',
    pairs: 'two rows the same length, one on top of the other',
    'pairs-plus': 'two rows the same length with one extra tile at the left of the bottom row',
    castle: 'a long bottom row with single tiles standing on it, a gap between each',
    fence: 'one tile at the left, then posts three tiles tall',
  };
  const count = (n) => cellsOf(n).length;
  const norm = (cells) => {
    if (!cells.length) return '';
    const mc = Math.min(...cells.map(c => c[0])), mr = Math.min(...cells.map(c => c[1]));
    return cells.map(c => (c[0] - mc) + ',' + (c[1] - mr)).sort().join(' ');
  };
  const target = norm(cellsOf(build));

  const [fig, setFig] = useState(1);
  const [placed, setPlaced] = useState([]);

  useEffect(() => {
    const step = count(2) - count(1);
    let key, misrules;
    if (askTiles) {
      let n = 1; while (count(n) < askTiles && n < 200) n++;
      key = n;
      misrules = [
        { says: count(askTiles), because: 'put the number of tiles in for n, as if n were the tiles and not the figure number' },
        { says: (askTiles - count(1)) / step, because: 'counted the steps on from figure 1 and not the figures' },
      ];
    } else {
      key = count(10);
      misrules = [
        { says: 2 * count(5), because: 'took figure 10 as twice figure 5, doubling the extra tiles too' },
        { says: count(1) + 10 * step, because: 'counted on from figure 1 by the step ten times, one step too many' },
        { says: count(shown), because: 'treated n as one fixed number, the last figure shown' },
      ];
    }
    misrules = misrules.filter((m, i, all) => Number.isInteger(m.says) && m.says > 0 && m.says !== key && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(key, misrules);
  }, []);

  useEffect(() => {
    const cells = placed.map(k => k.split('-').map(Number));
    lumina.goal(norm(cells) === target);
    lumina.scene({
      patternLooks: LOOKS[pattern] || LOOKS.cup,
      rulePrinted: showRule ? 'figure n has ' + RULES[pattern] + ' tiles' : 'no rule printed',
      figureShowing: fig, figuresTheStepperShows: '1 to ' + shown,
      buildingFigure: build, tilesYouLaid: placed.length,
    });
  }, [fig, placed]);

  const W = 680, BC = 11, BR = 3, BS = 46;
  const VS = 30, VTOP = 84, VROWS = 3;
  const BTOP = VTOP + VROWS * VS + 66;
  const BX = (W - BC * BS) / 2;
  const H = BTOP + BR * BS + 18;

  const viewCells = cellsOf(fig);
  const vw = Math.max(...viewCells.map(c => c[0])) + 1;
  const VX = (W - vw * VS) / 2;

  const tile = (x, y, s, key) => (
    <rect key={key} x={x + 2} y={y + 2} width={s - 4} height={s - 4} rx="5" fill="#f59e0b" stroke="#b45309" strokeWidth="2" pointerEvents="none" />
  );
  const step = (id, x, y, sign, act, can) => (
    <g id={id} onPointerDown={can ? act : undefined} style={{ cursor: can ? 'pointer' : 'default' }} opacity={can ? 1 : 0.35}>
      <circle cx={x} cy={y} r="24" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
      <text x={x} y={y + 9} textAnchor="middle" fontSize="28" fill="#e2e8f0">{sign}</text>
    </g>
  );
  const toggle = (k) => setPlaced(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]));

  return (
    <Panel title="Tile Patterns" caption="Tap minus or plus to see another figure. Tap a square on the board to lay a tile or lift it.">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />

        <rect x="20" y="10" width="236" height="60" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {step('fig-minus', 50, 40, '−', () => setFig(f => Math.max(1, f - 1)), fig > 1)}
        <text x="138" y="47" textAnchor="middle" fontSize="20" fill="#e2e8f0">Figure {fig}</text>
        {step('fig-plus', 226, 40, '+', () => setFig(f => Math.min(shown, f + 1)), fig < shown)}
        {showRule && (
          <g>
            <rect x="296" y="10" width="364" height="60" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
            <text x="478" y="47" textAnchor="middle" fontSize="21" fill="#e2e8f0">Figure n has {RULES[pattern]} tiles</text>
          </g>
        )}

        <rect x="20" y={VTOP - 6} width={W - 40} height={VROWS * VS + 12} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {viewCells.map(([c, r]) => tile(VX + c * VS, VTOP + (VROWS - 1 - r) * VS, VS, 'v' + c + '-' + r))}

        <text x={BX} y={BTOP - 16} fontSize="18" fill="#cbd5e1">Your board: figure {build}</text>
        <rect x={BX - 8} y={BTOP - 8} width={BC * BS + 16} height={BR * BS + 16} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        {Array.from({ length: BR }, (_, ri) => Array.from({ length: BC }, (_, c) => {
          const r = BR - 1 - ri, k = c + '-' + r, on = placed.includes(k);
          const x = BX + c * BS, y = BTOP + ri * BS;
          return (
            <g key={k} id={'cell-' + k} onPointerDown={() => toggle(k)} style={{ cursor: 'pointer' }}>
              <rect x={x} y={y} width={BS} height={BS} fill="#0f172a" fillOpacity="0.01" />
              <rect x={x + 2} y={y + 2} width={BS - 4} height={BS - 4} rx="6" fill="#0f172a" stroke="#475569" strokeWidth="1.5" strokeDasharray="6 5" />
              {on && tile(x, y, BS, 't' + k)}
            </g>
          );
        }))}
      </svg>
    </Panel>
  );
}
