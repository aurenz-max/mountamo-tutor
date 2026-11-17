// One more (K.CC.B.4c). A tower of blocks stands on a plate; loose blocks sit in a tray beside it. The child drags a
// loose block onto the tower (it lands on top) or drags the top block off (it goes back to the tray). The rule: one
// more is the next counting number, and one less is the number before. No count is printed: the child counts the
// tower. The loose blocks are another colour, so the block the child added stays visible as the "one more".
// Modes: `more` (put one on, say how many now), `less` (take one off, say how many now), `make` (build to a number the
// tutor names, say how many were put on: the converse, where Check carries the rule because adding the named number
// fails). Goal: the tower holds exactly start + 1 (or start - 1); adding several blocks fails.
function Display({ params, lumina }) {
  const n = Math.max(1, Number(params.start) || 3);
  const mode = params.mode === 'less' ? 'less' : params.mode === 'make' ? 'make' : 'more';
  const loose = Math.max(2, Number(params.loose) || 5);
  const side = params.side === 'right' ? 'right' : 'left';
  const COLOURS = { blue: '#38bdf8', green: '#4ade80', purple: '#a78bfa', red: '#f87171', teal: '#2dd4bf', orange: '#fb923c' };
  const colourName = COLOURS[params.color] ? params.color : 'blue';
  const towerFill = COLOURS[colourName];
  const LOOSE_FILL = '#fbbf24';
  const target = mode === 'less' ? n - 1 : n + 1;

  const [tower, setTower] = useState(() => Array.from({ length: n }, (_, i) => 't' + i));
  const [pile, setPile] = useState(() => Array.from({ length: loose }, (_, i) => 'p' + i));
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    const key = mode === 'make' ? 1 : target;
    const raw = mode === 'more'
      ? [
          { says: n, because: 'kept the old number and did not count on to the next one' },
          { says: n + 2, because: 'started again from one and lost count, counting a block twice' },
        ]
      : mode === 'less'
        ? [
            { says: n, because: 'kept the old number' },
            { says: n + 1, because: 'said the next number up: one more, not one less' },
          ]
        : [{ says: target, because: 'put on as many blocks as the number asked for, not counting on from the blocks already there' }];
    lumina.answer(key, raw.filter((m, i, all) => m.says > 0 && m.says !== key && all.findIndex(x => x.says === m.says) === i));
  }, []);

  useEffect(() => {
    const putOn = tower.filter(k => k[0] === 'p').length;
    const takenOff = n - tower.filter(k => k[0] === 't').length;
    lumina.goal(tower.length === target);
    lumina.scene({
      towerBlocksAtStart: n,
      towerColour: colourName,
      looseBlocks: 'yellow, in a tray on the ' + (side === 'left' ? 'right' : 'left'),
      yellowBlocksPutOnTheTower: putOn,
      towerBlocksTakenOff: takenOff,
    });
  }, [tower, pile]);

  // Layout: the stage is sized for the starting tower and two blocks of headroom; a taller tower squeezes its blocks
  // to fit (the same for every overbuild, so it says nothing about the goal).
  const S0 = Math.min(46, Math.floor(440 / (n + 2)));
  const GROUND = Math.max(230, 40 + (n + 2) * S0 + 10);
  const S = Math.min(S0, Math.floor((GROUND - 24) / Math.max(1, tower.length)));
  const BW = 66, CUBE = 50;
  const VW = 680, VH = GROUND + 46;
  const TX = side === 'left' ? 210 : 470;
  const PX = side === 'left' ? 470 : 210;
  const TRAY = { x: PX - 105, y: GROUND - 146, w: 210, h: 146 };
  const pileAt = i => ({ x: PX - 62 + (i % 3) * 62, y: GROUND - 42 - Math.floor(i / 3) * 62 });

  const fillOf = k => (k[0] === 'p' ? LOOSE_FILL : towerFill);
  // A block goes on when it is let go on top of the tower, and off when it is put in the tray. Let go anywhere else,
  // it goes back where it came from.
  const topY = GROUND - tower.length * S;
  const onTop = p => Math.abs(p.x - TX) < 75 && p.y > topY - 90 && p.y < topY + 2 * S;
  const inTray = p => p.x > TRAY.x - 20 && p.x < TRAY.x + TRAY.w + 20 && p.y > TRAY.y - 40 && p.y < GROUND + 30;

  const grab = (key, from, e) => {
    if (svgRef.current) svgRef.current.setPointerCapture(e.pointerId);
    const p = svgPoint(svgRef.current, e);
    setDrag({ key, from, x: p.x, y: p.y });
  };
  const move = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e);
    setDrag({ ...drag, x: p.x, y: p.y });
  };
  const drop = e => {
    if (!drag) return;
    const p = svgPoint(svgRef.current, e), d = drag;
    setDrag(null);
    if (d.from === 'pile' && onTop(p)) {
      setPile(ps => ps.filter(k => k !== d.key));
      setTower(t => (t.includes(d.key) ? t : [...t, d.key]));
    } else if (d.from === 'tower' && inTray(p)) {
      setTower(t => t.filter(k => k !== d.key));
      setPile(ps => (ps.includes(d.key) ? ps : [...ps, d.key]));
    }
  };

  const shown = tower.filter(k => !(drag && drag.key === k));
  const topKey = tower.length ? tower[tower.length - 1] : null;

  const towerBlock = (k, i) => {
    const y = GROUND - (i + 1) * S, isTop = k === topKey;
    const block = <rect x={TX - BW / 2} y={y} width={BW} height={S} rx="5" fill={fillOf(k)} stroke="#0f172a" strokeWidth="2.5" />;
    if (!isTop) return <g key={k}>{block}</g>;
    return (
      <g key={k} id="tower-top" onPointerDown={e => grab(k, 'tower', e)} style={{ cursor: 'grab', touchAction: 'none' }}>
        <rect x={TX - 50} y={y - Math.max(0, 48 - S)} width="100" height={Math.max(48, S)} fill="transparent" />
        {block}
      </g>
    );
  };

  const pileBlock = (k, i) => {
    const c = pileAt(i);
    return (
      <g key={k} id={'cube-' + k} onPointerDown={e => grab(k, 'pile', e)} style={{ cursor: 'grab', touchAction: 'none' }}>
        <rect x={c.x - CUBE / 2} y={c.y - CUBE / 2} width={CUBE} height={CUBE} rx="7" fill={fillOf(k)} stroke="#0f172a" strokeWidth="2.5" />
      </g>
    );
  };

  return (
    <Panel title="Block Tower" caption="Drag a block onto the tower, or drag the top block off.">
      <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} onPointerMove={move} onPointerUp={drop} onPointerCancel={drop}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect width={VW} height={VH} fill="#0f172a" />
        <rect id="pile" x={TRAY.x} y={TRAY.y} width={TRAY.w} height={TRAY.h} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <line x1="20" y1={GROUND + 14} x2={VW - 20} y2={GROUND + 14} stroke="#334155" strokeWidth="3" />
        <rect x={TX - 62} y={GROUND} width="124" height="14" rx="5" fill="#64748b" />
        {shown.map((k, i) => towerBlock(k, i))}
        {pile.map((k, i) => (drag && drag.key === k ? null : pileBlock(k, i)))}
        {drag && drag.x !== undefined && (
          <rect x={drag.x - BW / 2} y={drag.y - Math.max(S, 40) / 2} width={drag.from === 'tower' ? BW : CUBE} height={drag.from === 'tower' ? S : CUBE}
            rx="6" fill={fillOf(drag.key)} stroke="#e2e8f0" strokeWidth="2" pointerEvents="none" />
        )}
      </svg>
    </Panel>
  );
}
