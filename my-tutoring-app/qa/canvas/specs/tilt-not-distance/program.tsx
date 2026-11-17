// Tilt, not distance (5-ESS1-2). A view from straight above the planet's path: the Sun near the middle, the planet
// on a nearly round path (a real Earth path is only 3 percent off round, drawn true), and the planet drawn as a globe
// seen from above its north side, with the half that faces the Sun lit. Its axis is a stick through the globe: seen
// from above, a tilted axis shows as a stick leaning one way, with the north end (N cap) on top and the south end (S,
// dashed) underneath; the more the tilt, the longer the stick looks. With no tilt the stick points straight at you and
// only the N cap shows, in the middle of the globe. The axis keeps its direction in space as the planet moves.
// The north has summer when the north end leans toward the Sun (the N cap sits over the lit half): the north is then
// in sunlight all day. Nothing on the picture names a season.
//
// Angles are degrees clockwise from the top of the picture (12 o'clock = 0, 3 o'clock = 90).
// params.planet: 'earth' | 'zed' (another planet, drawn red) | 'oval' (another, drawn green); params.tilt: start tilt (0-60);
// params.lean: the start direction the north end leans; params.axis: 'fixed' (the child moves the planet only),
// 'free' (the child drags the N cap to tilt and turn the axis), 'turn' (the child turns the axis, its tilt stays);
// params.start: the planet's start angle on its path; params.ecc: how far the path is off round (0, 0.017, or up to
// 0.3 for a stretched path, drawn without closest/farthest marks); params.closest: the angle of the path's closest spot
// (with ecc > 0); params.goal: 'northSummer' | 'northWinter' | 'southSummer' | 'coldest' (the planet at its farthest
// spot); params.said: 'cause' (tilt or distance: distance only for a fixed no-tilt planet on a stretched path), or
// { place: 'north', at: 'closest' | 'southSummer' } (summer or winter in the north there).
function Display({ params, lumina }) {
  const planet = params?.planet === 'zed' || params?.planet === 'oval' ? params.planet : 'earth';
  const name = planet === 'earth' ? 'Earth' : 'the planet';
  const axisMode = params?.axis === 'free' || params?.axis === 'turn' ? params.axis : 'fixed';
  const tilt0 = Math.max(0, Math.min(60, Number(params?.tilt) || 0));
  const lean0 = Number(params?.lean) || 0;
  const start = Number(params?.start) || 0;
  const ecc = Math.max(0, Math.min(0.3, Number(params?.ecc) || 0));
  const stretched = ecc > 0.05;
  const closest = Number(params?.closest) || 0;
  const goalKind = ['northSummer', 'northWinter', 'southSummer', 'coldest'].includes(params?.goal) ? params.goal : 'northSummer';
  const said = params?.said || 'cause';

  const norm = (a) => ((a % 360) + 360) % 360;
  const apart = (a, b) => { const d = Math.abs(norm(a) - norm(b)); return d > 180 ? 360 - d : d; };
  const rad = (d) => (d * Math.PI) / 180;

  const A = 150; // the path's size: the same on every problem
  const R = 34; // the globe
  const L = 90; // the axis stick's length from the centre, before it is seen from above
  const MAXTILT = 60;
  const TOL = 20; // the north end leans within 20 degrees of the Sun (or of straight away from it)
  const capReach = axisMode === 'free' ? L * Math.sin(rad(MAXTILT)) : L * Math.sin(rad(tilt0));
  const margin = Math.max(R + 12, capReach + 24) + 10;
  const dir = (a) => ({ x: Math.sin(rad(a)), y: -Math.cos(rad(a)) });
  const dist = (a) => (A * (1 - ecc * ecc)) / (1 + ecc * Math.cos(rad(a - closest)));
  // The picture is sized to the path: a stretched path puts the Sun off centre.
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (let a = 0; a < 360; a += 3) {
    const d = dir(a), r = dist(a);
    minX = Math.min(minX, r * d.x); maxX = Math.max(maxX, r * d.x); minY = Math.min(minY, r * d.y); maxY = Math.max(maxY, r * d.y);
  }
  const W = 680, H = Math.round(maxY - minY + 2 * margin), SX = W / 2 - (minX + maxX) / 2, SY = margin - minY;
  const onPath = (a) => { const d = dir(a), r = dist(a); return { x: SX + r * d.x, y: SY + r * d.y }; };
  const clock = (a) => {
    const h = norm(a) / 30;
    const near = Math.round(h);
    const nm = (n) => String(((n + 11) % 12) + 1);
    if (Math.abs(h - near) * 30 <= 7.5) return nm(near) + " o'clock";
    return 'between ' + nm(Math.floor(h)) + ' and ' + nm(Math.floor(h) + 1) + " o'clock";
  };

  const [pos, setPos] = useState(norm(start));
  const [axis, setAxis] = useState({ tilt: tilt0, lean: norm(lean0) });
  const [held, setHeld] = useState(false);
  const svgRef = useRef(null);

  // Season in the north for an axis and a place on the path: the Sun is straight back along the path angle.
  const northSeason = (ax, at) => {
    if (ax.tilt < 1) return 'none';
    return apart(ax.lean, at + 180) < 90 ? 'summer' : 'winter';
  };

  // The said answer, from params only.
  useEffect(() => {
    if (said === 'cause') {
      // A planet with no tilt that the child cannot tilt, on a stretched path: only the distance changes over its year.
      if (tilt0 < 1 && axisMode === 'fixed' && stretched) {
        lumina.answer('distance', [{ says: 'tilt', because: 'thinks seasons always come from tilt, even on a planet with no tilt' }], ['tilt', 'distance']);
        return;
      }
      lumina.answer('tilt', [{ says: 'distance', because: 'thinks summer comes when the planet is closer to the Sun' }], ['tilt', 'distance']);
      return;
    }
    const startAxis = { tilt: tilt0, lean: norm(lean0) };
    // Where the question puts the planet: its closest spot, or where the south end leans toward the Sun.
    const at = said.at === 'southSummer' ? norm(startAxis.lean) : norm(closest);
    const key = northSeason(startAxis, at);
    // The misrule reads the season off the distance: near the closest spot it is summer, near the farthest winter.
    const byDistance = ecc > 0 ? (apart(at, closest) < 90 ? 'summer' : 'winter') : null;
    const misrules = byDistance
      ? [{
        says: byDistance,
        because: said.at === 'southSummer'
          ? 'thinks the planet is closest to the Sun there, so it is ' + byDistance + ' everywhere on it'
          : 'thinks summer comes when the planet is closest to the Sun',
      }]
      : [];
    lumina.answer(key, misrules.filter((m) => m.says !== key), ['summer', 'winter']);
  }, []);

  const earth = onPath(pos);
  const sunDir = norm(pos + 180);
  const leanOk = (want) => axis.tilt >= 10 && apart(axis.lean, want) <= TOL;
  // coldest: the planet sits within 12 degrees of its farthest spot (a tighter window, so one random drop rarely lands it).
  const met = goalKind === 'coldest' ? apart(pos, closest + 180) <= 12
    : goalKind === 'northSummer' ? leanOk(sunDir) : leanOk(pos); // northWinter and southSummer: north end leans away

  useEffect(() => {
    lumina.goal(met);
    const tiltWords = axis.tilt < 1 ? 'no tilt: the axis points straight up out of the path'
      : axis.tilt < 35 ? 'a small tilt' : 'a large tilt';
    const nearMark = ecc > 0
      ? (apart(pos, closest) <= 20 ? ', at the closest spot' : apart(pos, closest + 180) <= 20 ? ', at the farthest spot' : '')
      : '';
    lumina.scene({
      view: 'from straight above the path: the Sun ' + (stretched ? 'well off the middle' : 'near the middle') + ', ' + name + ' on its path around it; sizes not to scale',
      planet: planet === 'zed' ? 'a red planet, not Earth' : planet === 'oval' ? 'a green planet, not Earth' : 'Earth',
      path: stretched
        ? 'stretched: much nearer the Sun at ' + clock(closest) + ' and much farther at ' + clock(closest + 180) + '; no marks on it'
        : ecc > 0
          ? 'nearly round: a closest spot at ' + clock(closest) + ' and a farthest spot at ' + clock(closest + 180) + ', only a little nearer and farther'
          : 'round: the same distance from the Sun all the way round',
      planetOnPath: clock(pos) + nearMark,
      sunSeenFromPlanet: 'toward ' + clock(sunDir),
      litHalf: 'the half of the globe that faces the Sun',
      axis: axis.tilt < 1 ? tiltWords : tiltWords + '; the north end leans toward ' + clock(axis.lean) + ', the south end the other way',
      axisControl: axisMode === 'fixed' ? 'the axis is fixed; it keeps pointing the same way as the planet moves'
        : axisMode === 'turn' ? 'the child can turn the axis by its N end; the tilt stays the same'
          : 'the child can tilt and turn the axis by its N end',
    });
  }, [pos, axis.tilt, axis.lean]);

  const movePlanet = ({ x, y }) => setPos(norm((Math.atan2(x - SX, -(y - SY)) * 180) / Math.PI));

  const setFromPoint = (p) => {
    const dx = p.x - earth.x, dy = p.y - earth.y, d = Math.hypot(dx, dy);
    const lean = norm((Math.atan2(dx, -dy) * 180) / Math.PI);
    if (axisMode === 'turn') { if (d > 6) setAxis((a) => ({ ...a, lean })); return; }
    if (d < 8) { setAxis((a) => ({ ...a, tilt: 0 })); return; }
    const t = (Math.asin(Math.min(Math.sin(rad(MAXTILT)), d / L)) * 180) / Math.PI;
    setAxis({ tilt: t, lean });
  };
  const capDown = (e) => { if (axisMode === 'fixed') return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setHeld(true); };
  const capMove = (e) => { if (held && svgRef.current) setFromPoint(svgPoint(svgRef.current, e)); };
  const capUp = (e) => { if (held && svgRef.current) { setFromPoint(svgPoint(svgRef.current, e)); setHeld(false); } };

  // The axis seen from above: the north cap at L sin(tilt) along the lean, the south end the same distance back.
  const reach = L * Math.sin(rad(axis.tilt));
  const ld = dir(axis.lean);
  const nCap = { x: earth.x + reach * ld.x, y: earth.y + reach * ld.y };
  const sCap = { x: earth.x - reach * ld.x, y: earth.y - reach * ld.y };
  const poleOff = R * Math.sin(rad(axis.tilt));
  const pole = { x: earth.x + poleOff * ld.x, y: earth.y + poleOff * ld.y };

  // The path, drawn from the same distance formula the planet sits on.
  let pathD = '';
  for (let a = 0; a <= 360; a += 3) { const p = onPath(a); pathD += (a === 0 ? 'M ' : ' L ') + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }
  pathD += ' Z';

  const spots = [];
  for (let a = 0; a < 360; a += 15) spots.push({ a, ...onPath(a) });

  // Lit half: the right half of the globe, turned so that its right points at the Sun.
  const sunward = (Math.atan2(SY - earth.y, SX - earth.x) * 180) / Math.PI;
  const ocean = planet === 'zed' ? '#f87171' : planet === 'oval' ? '#4ade80' : '#60a5fa';

  const mark = (a, word) => {
    const p = onPath(a), d = dir(a), r = dist(a);
    // Beside the tick, a little outside the path and along it, clear of the globe and its axis caps there.
    const t = dir(a + 90);
    const lab = { x: p.x + 30 * d.x + 64 * t.x, y: p.y + 30 * d.y + 64 * t.y };
    return (
      <g key={word} pointerEvents="none">
        <line x1={p.x - 12 * d.x} y1={p.y - 12 * d.y} x2={p.x + 12 * d.x} y2={p.y + 12 * d.y} stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
        <text x={lab.x} y={lab.y + 5} fill="#cbd5e1" fontSize="15" textAnchor="middle">{word}</text>
      </g>
    );
  };

  const leanMark = (id, a, r) => {
    const d = dir(a);
    return <circle id={id} cx={earth.x + r * d.x} cy={earth.y + r * d.y} r="1" fill="transparent" pointerEvents="none" />;
  };

  const caption = axisMode === 'fixed' ? 'Drag ' + name + ' along its path.'
    : axisMode === 'turn' ? 'Drag ' + name + ' along its path. Drag the N end of its axis to turn it.'
      : 'Drag ' + name + ' along its path. Drag the N end of its axis to tilt it and turn it.';

  return (
    <Panel title="Tilted Planet" caption={caption}>
      <svg ref={svgRef} viewBox={'0 0 ' + W + ' ' + H} onPointerMove={capMove}
        style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', touchAction: 'none' }}>
        <rect width={W} height={H} fill="#0f172a" />
        <path d={pathD} fill="none" stroke="#475569" strokeWidth="2.5" strokeDasharray="6 8" />
        {ecc > 0 && !stretched && mark(closest, 'closest')}
        {ecc > 0 && !stretched && mark(closest + 180, 'farthest')}

        <g pointerEvents="none">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const d = dir(a);
            return <line key={a} x1={SX + 36 * d.x} y1={SY + 36 * d.y} x2={SX + 48 * d.x} y2={SY + 48 * d.y} stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" />;
          })}
          <circle cx={SX} cy={SY} r="28" fill="#fbbf24" stroke="#fde68a" strokeWidth="3" />
          <text x={SX} y={SY + 6} fill="#78350f" fontSize="16" fontWeight="700" textAnchor="middle">Sun</text>
        </g>
        <text x="16" y={H - 16} fill="#94a3b8" fontSize="14" pointerEvents="none">Not to scale</text>

        {spots.map((s) => <circle key={s.a} id={'spot-' + s.a} cx={s.x} cy={s.y} r="1" fill="transparent" pointerEvents="none" />)}

        <Handle id="earth" x={earth.x} y={earth.y} r={R} onDrag={movePlanet} onDrop={movePlanet}>
          <g transform={'rotate(' + sunward + ')'}>
            <circle cx="0" cy="0" r={R} fill="#111827" stroke="#94a3b8" strokeWidth="2" />
            <path d={'M 0 ' + -R + ' A ' + R + ' ' + R + ' 0 0 1 0 ' + R + ' Z'} fill={ocean} />
          </g>
          <circle cx="0" cy={R - 8} r="1" fill="transparent" pointerEvents="none" id="earth-grip" />
        </Handle>

        <g pointerEvents="none">
          {reach > 2 && <line x1={earth.x} y1={earth.y} x2={sCap.x} y2={sCap.y} stroke="#cbd5e1" strokeWidth="3" strokeDasharray="5 4" />}
          {reach > 2 && <line x1={earth.x} y1={earth.y} x2={nCap.x} y2={nCap.y} stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />}
          {reach > 2 && <circle cx={sCap.x} cy={sCap.y} r="12" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 3" />}
          {reach > 2 && <text x={sCap.x} y={sCap.y + 5} fill="#cbd5e1" fontSize="14" fontWeight="700" textAnchor="middle">S</text>}
          <circle cx={pole.x} cy={pole.y} r="4" fill="#f8fafc" />
        </g>

        <g id="axis-cap" onPointerDown={capDown} onPointerMove={capMove} onPointerUp={capUp} onPointerCancel={() => setHeld(false)}
          style={{ cursor: axisMode === 'fixed' ? 'default' : held ? 'grabbing' : 'grab', touchAction: 'none' }}
          pointerEvents={axisMode === 'fixed' ? 'none' : 'auto'}>
          {axisMode !== 'fixed' && <circle cx={nCap.x} cy={nCap.y} r="23" fill="transparent" />}
          <circle cx={nCap.x} cy={nCap.y} r="14" fill="#e2e8f0" stroke={axisMode === 'fixed' ? '#94a3b8' : '#64748b'} strokeWidth={held ? 3 : 2} />
          <text x={nCap.x} y={nCap.y + 5} fill="#0f172a" fontSize="15" fontWeight="700" textAnchor="middle" pointerEvents="none">N</text>
        </g>

        {leanMark('lean-sun', sunDir, 45)}
        {leanMark('lean-away', pos, 45)}
      </svg>
    </Panel>
  );
}
