function Display({ params, lumina }) {
  const heights = params?.heights ?? [2, 4];
  const answer = params?.answer ?? 'record';
  const nibbleDay = params?.nibbleDay ?? -1;
  const starWord = params?.starWord ?? 'Tallest';

  const days = heights.length;
  const CUBE = 30;
  const SLOTS = 8;
  const SCENE_W = 310;
  const SCENE_H = 310;
  const SOIL = 270;
  const STEM = 112;
  const COL_X = STEM + 26;
  const CH = 28;

  const [day, setDay] = useState(0);
  const [cubes, setCubes] = useState([]);
  const [recorded, setRecorded] = useState([]);
  const [drag, setDrag] = useState(null);
  const [star, setStar] = useState(null);
  const [starDrag, setStarDrag] = useState(null);
  const [marked, setMarked] = useState([]);
  const sceneRef = useRef(null);
  const worldRef = useRef(null);
  const barRefs = useRef({});

  const allMeasured = recorded.length === days;
  const shownDay = allMeasured ? days - 1 : day;
  const h = heights[shownDay];

  const sorted = cubes.slice().sort((a, b) => a - b);
  const facts = JSON.stringify({ day, cubes: sorted, recorded, star, marked });

  useEffect(() => {
    const tower = (list, n) => list.length === n && list.every((k, i) => k === i);
    const measuredRight = allMeasured && recorded.every((list, d) => tower(list, heights[d]));
    let met = measuredRight;
    if (answer === 'tallest') {
      let best = 0;
      heights.forEach((v, d) => { if (v > heights[best]) best = d; });
      met = measuredRight && star === best;
    } else if (answer === 'nogrowth') {
      met = measuredRight && star != null && star > 0 && heights[star] === heights[star - 1];
    } else if (answer === 'grew') {
      const grew = heights[days - 1] - heights[0];
      met = measuredRight && marked.length === grew && marked.every((m) => m.startsWith((days - 1) + '-'));
    }
    lumina.goal(met);
    const scene = {
      plant: 'one bean plant in a planter, measured with cubes',
      dayShown: allMeasured ? 'all days measured' : 'day ' + (day + 1) + ' of ' + days,
      cubesStackedBesidePlant: allMeasured ? null : cubes.length,
      lowestCubeSitsOnTheSoil: cubes.length ? sorted[0] === 0 : null,
      gapInTheCubeStack: cubes.length ? sorted.some((k, i) => k !== sorted[0] + i) : null,
      chartCubesPerDay: recorded.map((list) => list.length),
      question: { record: 'record each day on the chart', tallest: 'which day was the plant tallest', nogrowth: 'which day the plant did not grow', grew: 'how many cubes the plant grew from the first day to the last' }[answer],
    };
    if (nibbleDay >= 0) scene.note = 'a rabbit nibbled the top of the bean on one night';
    if (answer === 'tallest' || answer === 'nogrowth') scene.starOn = star == null ? null : 'day ' + (star + 1);
    if (answer === 'grew') scene.cubesMarkedOnChart = marked.length;
    lumina.scene(scene);
  }, [facts]);

  // Cubes: drag one from the bin; it lands in the spot beside the stem under the pointer. Tap a cube to take it off.
  const local = (e, ref) => {
    const b = ref.current.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const slotAt = (p) => {
    if (p.x < COL_X - 30 || p.x > COL_X + CUBE + 30) return -1;
    const k = Math.floor((SOIL - p.y) / CUBE);
    return k >= 0 && k < SLOTS ? k : -1;
  };
  const onBinDown = (e) => { if (allMeasured) return; e.currentTarget.setPointerCapture(e.pointerId); setDrag(local(e, sceneRef)); };
  const onBinMove = (e) => { if (drag) setDrag(local(e, sceneRef)); };
  const onBinUp = (e) => {
    if (!drag) return;
    setDrag(null);
    const k = slotAt(local(e, sceneRef));
    if (k >= 0 && !cubes.includes(k)) setCubes((c) => c.concat([k]));
  };
  const takeOff = (k) => setCubes((c) => c.filter((x) => x !== k));

  const record = () => {
    if (!cubes.length || allMeasured) return;
    setRecorded((r) => r.concat([sorted]));
    setCubes([]);
    setDay((d) => Math.min(days - 1, d + 1));
  };

  // The star: drag it onto a day on the chart.
  const onStarDown = (e) => { e.currentTarget.setPointerCapture(e.pointerId); setStarDrag(local(e, worldRef)); };
  const onStarMove = (e) => { if (starDrag) setStarDrag(local(e, worldRef)); };
  const onStarUp = (e) => {
    if (!starDrag) return;
    setStarDrag(null);
    let hit = null;
    Object.keys(barRefs.current).forEach((d) => {
      const el = barRefs.current[d];
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) hit = Number(d);
    });
    setStar(hit);
  };
  const toggleMark = (key) => {
    if (answer !== 'grew' || !allMeasured) return;
    setMarked((m) => (m.includes(key) ? m.filter((x) => x !== key) : m.concat([key])));
  };

  const plant = () => {
    const top = SOIL - h * CUBE;
    const nibbled = shownDay === nibbleDay;
    const leaves = [];
    for (let k = 1; k < h; k += 1) {
      const y = SOIL - k * CUBE + 8;
      const rx = k % 2 === 1 ? 16 : 12;
      leaves.push(<ellipse key={k} cx={STEM - rx - 1} cy={y} rx={rx} ry="7" fill="#4ade80" transform={'rotate(25 ' + (STEM - rx - 1) + ' ' + y + ')'} />);
    }
    return (
      <g>
        <line x1={STEM} y1={SOIL} x2={STEM} y2={top} stroke="#22c55e" strokeWidth="6" strokeLinecap="butt" />
        {leaves}
        {nibbled ? (
          <g>
            <rect x={STEM - 5} y={top - 1} width="10" height="4" fill="#a16207" />
            <circle cx={STEM - 12} cy={top + 10} r="2" fill="#4ade80" />
            <circle cx={STEM + 10} cy={top + 16} r="2" fill="#4ade80" />
          </g>
        ) : (
          <g>
            <path d={'M' + STEM + ' ' + top + ' Q ' + (STEM - 14) + ' ' + (top + 4) + ' ' + (STEM - 18) + ' ' + (top + 14) + ' Q ' + (STEM - 6) + ' ' + (top + 14) + ' ' + STEM + ' ' + top} fill="#86efac" />
            <path d={'M' + STEM + ' ' + top + ' Q ' + (STEM + 14) + ' ' + (top + 4) + ' ' + (STEM + 18) + ' ' + (top + 14) + ' Q ' + (STEM + 6) + ' ' + (top + 14) + ' ' + STEM + ' ' + top} fill="#86efac" />
          </g>
        )}
      </g>
    );
  };

  const cubeStyle = (extra) => ({ position: 'absolute', width: CUBE - 2, height: CUBE - 2, borderRadius: 4, background: '#60a5fa', border: '1px solid #1e3a8a', boxSizing: 'border-box', ...extra });

  const sceneBox = (
    <div ref={sceneRef} style={{ position: 'relative', width: SCENE_W, height: SCENE_H, flex: '0 0 auto', opacity: allMeasured ? 0.35 : 1, touchAction: 'none', userSelect: 'none' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>{allMeasured ? 'All days measured' : 'Day ' + (day + 1)}</div>
      <svg width={SCENE_W} height={SCENE_H} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
        <rect x="20" y={SOIL} width="200" height={SCENE_H - SOIL} rx="6" fill="#92400e" />
        <rect x="20" y={SOIL} width="200" height="8" fill="#451a03" />
        {plant()}
      </svg>
      {Array.from({ length: SLOTS }, (_, k) => (
        <div key={'s' + k} id={'slot-' + k} style={{ position: 'absolute', left: COL_X, top: SOIL - (k + 1) * CUBE, width: CUBE, height: CUBE, pointerEvents: 'none' }} />
      ))}
      {cubes.map((k) => (
        <div key={'c' + k} id={'cube-' + k} onClick={() => takeOff(k)} style={cubeStyle({ left: COL_X + 1, top: SOIL - (k + 1) * CUBE + 1, cursor: 'pointer' })} />
      ))}
      {!allMeasured ? (
        <div id="bin" onPointerDown={onBinDown} onPointerMove={onBinMove} onPointerUp={onBinUp}
          style={{ position: 'absolute', left: 236, top: SOIL - 70, width: 70, height: 66, borderRadius: 10, border: '2px solid #475569', background: '#1e293b', cursor: 'grab', display: 'flex', flexWrap: 'wrap', gap: 3, padding: 6, boxSizing: 'border-box', alignContent: 'flex-start' }}>
          {Array.from({ length: 6 }, (_, k) => <div key={k} style={{ width: 16, height: 16, borderRadius: 3, background: '#60a5fa' }} />)}
          <div style={{ width: '100%', textAlign: 'center', color: '#cbd5e1', fontSize: 12, marginTop: 2 }}>cubes</div>
        </div>
      ) : null}
      {drag ? <div style={cubeStyle({ left: drag.x - CUBE / 2, top: drag.y - CUBE / 2, opacity: 0.8, pointerEvents: 'none' })} /> : null}
    </div>
  );

  const BAR_W = 58;
  const chart = (
    <div style={{ flex: '0 0 auto' }}>
      <div style={{ color: '#cbd5e1', fontSize: 15, marginBottom: 6, textAlign: 'center' }}>Bean chart: cubes tall</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', padding: '8px 10px 0', borderBottom: '2px solid #64748b', minHeight: SLOTS * CH + 20 }}>
        {heights.map((_, d) => {
          const list = recorded[d] || [];
          return (
            <div key={d} id={'bar-' + d} ref={(el) => { barRefs.current[d] = el; }}
              style={{ width: BAR_W, height: SLOTS * CH + 20, display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 1, position: 'relative' }}>
              {list.map((_, k) => {
                const key = d + '-' + k;
                const on = marked.includes(key);
                return <div key={key} id={'chart-' + key} onClick={() => toggleMark(key)} style={{ width: 44, height: CH - 1, borderRadius: 4, background: on ? '#f472b6' : '#60a5fa', border: '1px solid #1e3a8a', boxSizing: 'border-box', cursor: answer === 'grew' && allMeasured ? 'pointer' : 'default' }} />;
              })}
              {star === d ? starChip(false, true) : null}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, padding: '4px 10px 0' }}>
        {heights.map((_, d) => (
          <div key={d} style={{ width: BAR_W, textAlign: 'center', fontSize: 15, fontWeight: d === day && !allMeasured ? 800 : 500, color: d === day && !allMeasured ? '#fbbf24' : '#cbd5e1' }}>Day {d + 1}</div>
        ))}
      </div>
    </div>
  );

  function starChip(ghost, placed) {
    if (placed) {
      return <div id="star" onPointerDown={onStarDown} onPointerMove={onStarMove} onPointerUp={onStarUp} style={{ fontSize: 30, lineHeight: '36px', cursor: 'grab', touchAction: 'none', userSelect: 'none', opacity: starDrag ? 0.25 : 1 }}>⭐</div>;
    }
    return (
      <div id={ghost ? undefined : 'star'} onPointerDown={ghost ? undefined : onStarDown} onPointerMove={ghost ? undefined : onStarMove} onPointerUp={ghost ? undefined : onStarUp}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', minHeight: 40, borderRadius: 20, background: '#fbbf24', color: '#1e293b', fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', cursor: 'grab', touchAction: 'none', userSelect: 'none', opacity: starDrag && !ghost ? 0.25 : 1, boxShadow: '0 2px 8px rgba(0,0,0,.4)' }}>
        <span style={{ fontSize: 18 }}>⭐</span>{starWord}
      </div>
    );
  }

  const usesStar = answer === 'tallest' || answer === 'nogrowth';
  const btn = (active) => ({ minHeight: 48, padding: '0 22px', borderRadius: 12, border: '2px solid ' + (active ? '#fbbf24' : '#475569'), background: '#1e293b', color: '#f1f5f9', fontSize: 18, fontWeight: 800, cursor: active ? 'pointer' : 'default', opacity: active ? 1 : 0.35 });

  return (
    <Panel title="Growing Bean" caption={allMeasured ? (answer === 'grew' ? 'Tap cubes on the chart to mark them. Tap again to unmark.' : usesStar ? 'Drag the star onto a day on the chart.' : 'Every day is on the chart.') : 'Drag cubes from the box to stand beside the bean. Tap a cube to take it off. Put the day on the chart when you are done.'}>
      <div ref={worldRef} style={{ position: 'relative', display: 'flex', gap: 28, alignItems: 'flex-start', justifyContent: 'center' }}>
        <Stack gap={10}>
          {sceneBox}
          {!allMeasured ? (
            <button id="record" type="button" style={btn(cubes.length > 0)} onClick={record}>Put Day {day + 1} on the chart</button>
          ) : null}
        </Stack>
        <Stack gap={14}>
          {chart}
          {usesStar && allMeasured && star == null ? <div style={{ display: 'flex', justifyContent: 'center' }}>{starChip(false)}</div> : null}
        </Stack>
        {starDrag ? <div style={{ position: 'absolute', left: starDrag.x - 50, top: starDrag.y - 20, pointerEvents: 'none', zIndex: 5 }}>{starChip(true)}</div> : null}
      </div>
    </Panel>
  );
}
