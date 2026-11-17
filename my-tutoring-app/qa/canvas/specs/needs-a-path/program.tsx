// Needs a path (1-PS4-1, 4-PS4-1). Rule: sound needs something to travel through.
// Tank scene: a bell keeps ringing inside a closed glass tank; your ear is pressed to the far wall. The child changes
// what fills the tank: pump strokes take air out (drag the pump handle down), the jug pours water in (drag it onto
// the tank, one pour each), wooden blocks are dragged into a row from the bell to the wall. Phone scene (transfer): a
// friend whispers into a cup far away; the child steps back (drag yourself left, one step each) to pull the string
// tight. Nothing draws sound or how loud it is: the bell swings the same whatever fills the tank.
// params.scene: 'tank' | 'phone'
// params.start: tank { air: 0-10, water: 0-5, blocks: 0-4 }; phone { step: 0-5 } (5 = string tight)
// params.tools: tank tools shown, any of 'pump', 'jug', 'blocks'
// params.target: the goal. Tank { air?: [lo, hi], water?: [lo, hi], blocks?: [lo, hi] }; phone { step: [lo, hi] }
// params.said: { from, to } two states (same shape as start); the said answer compares the ring at the ear in `to`
// against `from`: 'louder', 'quieter', or 'silent' when nothing reaches the ear in `to`.
function Display({ params, lumina }) {
  const scene = params.scene === 'phone' ? 'phone' : 'tank';
  const start = params.start || {};
  const tools = Array.isArray(params.tools) ? params.tools : ['pump'];
  const target = params.target || {};
  const said = params.said || { from: { air: 10 }, to: { air: 0 } };
  const clampN = (v, lo, hi, d) => Math.max(lo, Math.min(hi, Number.isFinite(Number(v)) ? Number(v) : d));

  const AIR_MAX = 10, WATER_MAX = 5, SLOTS = 4, STEP_MAX = 5;
  const norm = s => ({
    air: clampN(s && s.air, 0, AIR_MAX, AIR_MAX),
    water: clampN(s && s.water, 0, WATER_MAX, 0),
    blocks: clampN(s && s.blocks, 0, SLOTS, 0),
    step: clampN(s && s.step, 0, STEP_MAX, 0),
  });

  // ---------- the model ----------
  // How much of the ring reaches the ear. A full row of blocks is a solid path, a full tank of water a water path;
  // otherwise the ring goes through whatever air is left, and with none left nothing reaches the ear.
  // mode 'emptySpace': the misrule that sound crosses empty space (no air is only a little fainter).
  // mode 'onlyAir': the misrule that only air carries sound (water, wood and string carry nothing).
  const loud = (s, mode) => {
    const t = norm(s);
    if (scene === 'phone') return t.step >= STEP_MAX && mode !== 'onlyAir' ? 1 : 0;
    if (t.blocks >= SLOTS) return mode === 'onlyAir' ? 0 : 3;
    if (t.water >= WATER_MAX) return mode === 'onlyAir' ? 0 : 2;
    if (t.air === 0) return mode === 'emptySpace' ? 0.05 : 0;
    return t.air / AIR_MAX;
  };
  const verdict = mode => {
    const a = loud(said.from, mode), b = loud(said.to, mode);
    if (b === 0) return 'silent';
    if (b > a + 1e-9) return 'louder';
    if (b < a - 1e-9) return 'quieter';
    return null;
  };
  useEffect(() => {
    const key = verdict('right');
    const misrules = [
      { says: verdict('emptySpace'), because: 'thinks sound crosses empty space, only a little fainter when the air is gone' },
      { says: verdict('onlyAir'), because: scene === 'phone'
        ? 'thinks only air carries sound, so a string carries nothing and the far whisper stays silent'
        : 'thinks only air carries sound, so water or wood between the bell and the ear stop it' },
    ].filter((m, i, all) => m.says && m.says !== key && all.findIndex(x => x.says === m.says) === i);
    lumina.answer(key, misrules, ['louder', 'quieter', 'silent']);
  }, []);

  // ---------- state ----------
  const s0 = norm(start);
  const [air, setAir] = useState(s0.air);
  const [water, setWater] = useState(s0.water);
  const [slots, setSlots] = useState(() => Array.from({ length: SLOTS }, (_, i) => (i < s0.blocks ? i : null)));
  const [step, setStep] = useState(s0.step);
  const [drag, setDrag] = useState(null); // { what, id?, x0, y0, x, y }
  const svgRef = useRef(null);
  const blocks = slots.filter(v => v !== null).length;

  const inRange = (v, r) => !Array.isArray(r) || (v >= Number(r[0]) && v <= Number(r[1]));
  const goalMet = scene === 'phone'
    ? inRange(step, target.step || [STEP_MAX, STEP_MAX])
    : inRange(air, target.air) && inRange(water, target.water) && inRange(blocks, target.blocks);

  const airWords = a => (a === AIR_MAX ? 'the tank is full of air' : a >= 7 ? 'most of the air is still in the tank'
    : a >= 4 ? 'about half of the air is left' : a >= 1 ? 'only a little air is left' : 'no air at all: the pump has taken it all out');
  useEffect(() => {
    lumina.goal(goalMet);
    if (scene === 'phone') {
      lumina.scene({
        friend: 'far away across the yard, whispering into a paper cup',
        you: 'holding a paper cup to your ear; a string runs from your cup to your friend\'s cup',
        string: step >= STEP_MAX ? 'pulled tight and straight' : step === 0 ? 'hanging very loose, sagging toward the ground' : 'still loose, sagging a little',
      });
      return;
    }
    lumina.scene({
      bell: 'a bell keeps ringing inside a closed glass tank, hanging from the lid on a thread',
      ear: 'your ear is pressed to the outside of the tank wall, on the far side from the bell',
      air: airWords(air),
      water: water === 0 ? 'no water' : water >= WATER_MAX ? 'water fills the tank to the top' : 'water partway up the tank',
      blocks: tools.includes('blocks') || blocks
        ? (blocks === SLOTS ? 'wooden blocks fill the whole row from the bell to the wall' : blocks === 0 ? 'no blocks in the tank' : 'some wooden blocks in the row, with gaps between the bell and the wall')
        : 'none',
      tools: tools.map(t => (t === 'pump' ? 'a pump that takes air out' : t === 'jug' ? 'a jug of water' : 'four wooden blocks')),
    });
  }, [goalMet, air, water, blocks, step]);

  // ---------- layout ----------
  const W = 680;
  const shelf = scene === 'tank' && (tools.includes('jug') || tools.includes('blocks'));
  const H = scene === 'phone' ? 232 : shelf ? 420 : 316;
  const TOP = scene === 'phone' ? 88 : !tools.includes('pump') ? 46 : 0; // no pump handle above the tank: crop the empty band
  const T = { x1: 150, x2: 530, y1: 74, y2: 290 };
  const BY = 182; // bell and ear height
  const BELL_X = 196;
  const slotX = i => 220 + i * 77;
  const SHELF_Y = 312;
  const binXY = i => ({ x: 300 + i * 82, y: SHELF_Y + 22 });
  const JUG = { x: 60, y: SHELF_Y + 12 };
  const HANDLE_Y = 46, PUMP_X = 82;
  const waterTop = T.y2 - (water / WATER_MAX) * (T.y2 - T.y1);

  // Air: 40 fixed spots in the tank; `air` tenths of them are drawn, only above the water.
  const AIR_SPOTS = useMemo(() => {
    let s = 17;
    const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    return Array.from({ length: 40 }, () => ({ x: T.x1 + 14 + r() * (T.x2 - T.x1 - 28), y: T.y1 + 12 + r() * (T.y2 - T.y1 - 24) }));
  }, []);

  // ---------- dragging ----------
  const grab = (what, id, e) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = svgPoint(svgRef.current, e);
    setDrag({ what, id, x0: p.x, y0: p.y, x: p.x, y: p.y });
  };
  const move = e => {
    if (!drag || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e);
    setDrag(d => (d ? { ...d, x: p.x, y: p.y } : null));
  };
  const inTank = p => p.x > T.x1 && p.x < T.x2 && p.y > T.y1 - 20 && p.y < T.y2;
  const drop = e => {
    if (!drag || !svgRef.current) return;
    const p = svgPoint(svgRef.current, e);
    const d = drag;
    setDrag(null);
    const dx = p.x - d.x0, dy = p.y - d.y0;
    if (d.what === 'pump') { if (dy >= 24) setAir(a => Math.max(0, a - 1)); return; }
    if (d.what === 'jug') { if (inTank(p)) setWater(w => Math.min(WATER_MAX, w + 1)); return; }
    if (d.what === 'you') {
      if (dx <= -20) setStep(s => Math.min(STEP_MAX, s + 1));
      else if (dx >= 20) setStep(s => Math.max(0, s - 1));
      return;
    }
    if (d.what === 'block') {
      setSlots(prev => {
        const next = prev.map(v => (v === d.id ? null : v));
        if (inTank(p)) { const free = next.indexOf(null); if (free >= 0) next[free] = d.id; }
        return next;
      });
    }
  };

  // ---------- pictures ----------
  const bell = () => (
    <g pointerEvents="none">
      <line x1={BELL_X} y1={T.y1} x2={BELL_X} y2={BY - 24} stroke="#cbd5e1" strokeWidth="2" />
      <g>
        <animateTransform attributeName="transform" type="rotate" values={`-14 ${BELL_X} ${BY - 24};14 ${BELL_X} ${BY - 24};-14 ${BELL_X} ${BY - 24}`} dur="0.6s" repeatCount="indefinite" />
        <text x={BELL_X} y={BY + 16} textAnchor="middle" fontSize="44">🔔</text>
      </g>
    </g>
  );
  const block = (id, x, y, w) => (
    <g key={`block-${id}`} id={`block-${id + 1}`} onPointerDown={e => grab('block', id, e)} onPointerUp={drop}
      onPointerCancel={() => setDrag(null)} style={{ cursor: 'grab', touchAction: 'none' }}>
      <rect x={x} y={y} width={w} height="52" rx="4" fill="#b45309" stroke="#78350f" strokeWidth="2" />
      <path d={`M ${x + 8} ${y + 16} H ${x + w - 8} M ${x + 12} ${y + 34} H ${x + w - 14}`} stroke="#92400e" strokeWidth="2" />
    </g>
  );
  const blockAt = id => {
    if (drag && drag.what === 'block' && drag.id === id) return block(id, drag.x - 38, drag.y - 26, 76);
    const k = slots.indexOf(id);
    if (k >= 0) return block(id, slotX(k), BY - 26, 76);
    const b = binXY(id);
    return block(id, b.x, b.y, 76);
  };

  const tank = () => {
    const handleY = drag && drag.what === 'pump' ? Math.max(HANDLE_Y, Math.min(HANDLE_Y + 50, HANDLE_Y + (drag.y - drag.y0))) : HANDLE_Y;
    const jugAt = drag && drag.what === 'jug' ? { x: drag.x - 34, y: drag.y - 34 } : JUG;
    return (
      <g>
        {/* air legend */}
        <circle cx={T.x2 + 30} cy={T.y1 + 6} r="4" fill="#cbd5e1" opacity="0.8" />
        <text x={T.x2 + 42} y={T.y1 + 11} fontSize="15" fill="#cbd5e1">air</text>
        {/* the tank */}
        <rect x={T.x1} y={T.y1} width={T.x2 - T.x1} height={T.y2 - T.y1} rx="6" fill="#1e293b" opacity="0.55" />
        {water > 0 && <rect x={T.x1} y={waterTop} width={T.x2 - T.x1} height={T.y2 - waterTop} fill="#2563eb" opacity="0.55" pointerEvents="none" />}
        {AIR_SPOTS.slice(0, air * 4).filter(p => p.y < waterTop - 4).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#cbd5e1" opacity="0.7" pointerEvents="none" />
        ))}
        {/* dashed row the blocks can fill */}
        {tools.includes('blocks') && slots.map((v, k) => v === null && (
          <rect key={`slot-${k}`} id={`slot-${k + 1}`} x={slotX(k)} y={BY - 26} width="76" height="52" rx="4"
            fill="none" stroke="#64748b" strokeWidth="2" strokeDasharray="6 5" />
        ))}
        {bell()}
        <rect id="tank" x={T.x1} y={T.y1} width={T.x2 - T.x1} height={T.y2 - T.y1} rx="6" fill="none" stroke="#bae6fd" strokeWidth="4" opacity="0.85" pointerEvents="none" />
        <rect x={T.x1 - 8} y={T.y1 - 12} width={T.x2 - T.x1 + 16} height="14" rx="4" fill="#475569" stroke="#64748b" strokeWidth="2" />
        <rect x={T.x1 - 12} y={T.y2} width={T.x2 - T.x1 + 24} height="10" rx="3" fill="#475569" />
        {/* your ear on the far wall */}
        <text x={T.x2 + 30} y={BY + 14} textAnchor="middle" fontSize="40" pointerEvents="none">👂</text>
        <text x={T.x2 + 30} y={BY + 50} textAnchor="middle" fontSize="15" fill="#cbd5e1" pointerEvents="none">your ear</text>
        {/* the pump */}
        {tools.includes('pump') && (
          <g>
            <path d={`M ${PUMP_X + 22} ${200} H ${T.x1}`} stroke="#94a3b8" strokeWidth="8" fill="none" />
            <rect x={PUMP_X - 22} y={110} width="44" height="170" rx="6" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
            <rect x={PUMP_X - 30} y={280} width="60" height="10" rx="3" fill="#475569" />
            <line x1={PUMP_X} y1={handleY} x2={PUMP_X} y2={112} stroke="#cbd5e1" strokeWidth="6" />
            <g id="pump" onPointerDown={e => grab('pump', null, e)} onPointerUp={drop} onPointerCancel={() => setDrag(null)}
              style={{ cursor: 'grab', touchAction: 'none' }}>
              <rect x={PUMP_X - 50} y={handleY - 30} width="100" height="56" fill="transparent" />
              <rect x={PUMP_X - 40} y={handleY - 9} width="80" height="18" rx="9" fill="#f59e0b" stroke="#b45309" strokeWidth="2" />
              <path d={`M ${PUMP_X + 50} ${handleY - 6} v 26 m -7 -8 l 7 9 l 7 -9`} stroke="#94a3b8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </g>
            <text x={PUMP_X} y={306} textAnchor="middle" fontSize="15" fill="#cbd5e1" pointerEvents="none">pump</text>
          </g>
        )}
        {/* the shelf */}
        {shelf && <rect x="12" y={SHELF_Y} width={W - 24} height={H - SHELF_Y - 8} rx="12" fill="#1e293b" stroke="#475569" strokeWidth="2" />}
        {tools.includes('blocks') && Array.from({ length: SLOTS }, (_, i) => slots.indexOf(i) >= 0 && (
          <rect key={`bin-${i}`} x={binXY(i).x} y={binXY(i).y} width="76" height="52" rx="4" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 5" />
        ))}
        {tools.includes('blocks') && <text x={binXY(0).x - 16} y={SHELF_Y + 54} textAnchor="end" fontSize="15" fill="#cbd5e1">wooden blocks</text>}
        {tools.includes('blocks') && Array.from({ length: SLOTS }, (_, i) => blockAt(i))}
        {tools.includes('jug') && (
          <g id="jug" transform={`translate(${jugAt.x}, ${jugAt.y})`} onPointerDown={e => grab('jug', null, e)} onPointerUp={drop}
            onPointerCancel={() => setDrag(null)} style={{ cursor: 'grab', touchAction: 'none' }}>
            <rect x="-4" y="-4" width="84" height="80" fill="transparent" />
            <path d="M 8 8 L 60 8 L 64 70 L 4 70 Z" fill="#e2e8f0" opacity="0.25" stroke="#e2e8f0" strokeWidth="2.5" />
            <path d="M 7 26 L 61 26 L 64 70 L 4 70 Z" fill="#3b82f6" opacity="0.8" />
            <path d="M 8 8 L -2 0" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
            <path d="M 60 16 q 18 4 14 22 q -2 10 -12 12" stroke="#e2e8f0" strokeWidth="4" fill="none" />
          </g>
        )}
        {tools.includes('jug') && !(drag && drag.what === 'jug') && <text x={JUG.x + 92} y={SHELF_Y + 58} textAnchor="start" fontSize="15" fill="#cbd5e1">water</text>}
      </g>
    );
  };

  const phone = () => {
    const GROUND = 170, CUP_Y = 136;
    const youX = (drag && drag.what === 'you') ? Math.max(70, Math.min(350, 330 - step * 45 + (drag.x - drag.x0) * 0.4)) : 330 - step * 45;
    const myCup = youX + 40, theirCup = 584;
    const slack = Math.max(0, (theirCup - 145) - (theirCup - myCup));
    const sag = (30 * slack) / 225; // 30 at the start (step 0), 0 when tight
    const mid = (myCup + theirCup) / 2;
    return (
      <g>
        <rect x="0" y={GROUND} width={W} height={H - GROUND} fill="#14532d" opacity="0.6" />
        <path d={`M ${myCup} ${CUP_Y} Q ${mid} ${CUP_Y + 2 * sag} ${theirCup} ${CUP_Y}`} stroke="#f8fafc" strokeWidth="2.5" fill="none" pointerEvents="none" />
        {/* your friend */}
        <text x={628} y={GROUND - 6} textAnchor="middle" fontSize="64" pointerEvents="none">🧒</text>
        <path d={`M ${theirCup - 6} ${CUP_Y - 14} L ${theirCup + 18} ${CUP_Y - 18} L ${theirCup + 18} ${CUP_Y + 18} L ${theirCup - 6} ${CUP_Y + 14} Z`} fill="#fde68a" stroke="#a16207" strokeWidth="2" pointerEvents="none" />
        <text x={628} y={GROUND + 26} textAnchor="middle" fontSize="15" fill="#cbd5e1" pointerEvents="none">friend</text>
        {/* you */}
        <g id="you" onPointerDown={e => grab('you', null, e)} onPointerUp={drop} onPointerCancel={() => setDrag(null)}
          style={{ cursor: 'grab', touchAction: 'none' }}>
          <rect x={youX - 44} y={GROUND - 120} width="96" height="124" fill="transparent" />
          <text x={youX} y={GROUND - 6} textAnchor="middle" fontSize="64">🧒</text>
          <path d={`M ${myCup + 6} ${CUP_Y - 14} L ${myCup - 18} ${CUP_Y - 18} L ${myCup - 18} ${CUP_Y + 18} L ${myCup + 6} ${CUP_Y + 14} Z`} fill="#fde68a" stroke="#a16207" strokeWidth="2" />
          <path d={`M ${youX - 30} ${GROUND + 14} l -8 6 l 8 6 M ${youX + 30} ${GROUND + 14} l 8 6 l -8 6`} fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        <text x={youX} y={GROUND + 44} textAnchor="middle" fontSize="15" fill="#cbd5e1" pointerEvents="none">you</text>
      </g>
    );
  };

  const caption = scene === 'phone'
    ? 'Drag yourself left to step back, or right to step closer.'
    : [tools.includes('pump') && 'Drag the pump handle down for one stroke.', tools.includes('jug') && 'Drag the jug onto the tank to pour.',
      tools.includes('blocks') && 'Drag a block into the tank or back to the shelf.'].filter(Boolean).join(' ');

  return (
    <Panel title={scene === 'phone' ? 'String Phone' : 'Bell Tank'} caption={caption}>
      <svg ref={svgRef} viewBox={`0 ${TOP} ${W} ${H - TOP}`} onPointerMove={move}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect y={TOP} width={W} height={H - TOP} fill="#0f172a" />
        {scene === 'phone' ? phone() : tank()}
      </svg>
    </Panel>
  );
}
