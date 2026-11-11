function Display({ params, lumina }) {
  // A room with the big light still on. The child marks (an eye) every toy that will still be seen once the big light
  // is off and only the flashlight is on. A toy is seen when the flashlight's light reaches it (inside the beam and
  // not behind the box) or when it makes its own light.
  // params.light {x, y, angle (degrees, 0 = right, 90 = down), spread (half-angle)}; params.toys [{id, kind, x, y}];
  // params.box {x, y, w, h} or null; params.showBeam draws the whole beam (false: only a short stub at the lens).
  const light = params.light || { x: 70, y: 110, angle: 25, spread: 13 };
  const toys = Array.isArray(params.toys) ? params.toys : [
    { id: 'bear', kind: 'bear', x: 330, y: 231 },
    { id: 'ball', kind: 'ball', x: 200, y: 320 },
  ];
  const box = params.box || null;
  const showBeam = params.showBeam !== false;

  const KINDS = {
    bear: { name: 'bear', emoji: '🧸' },
    ball: { name: 'ball', emoji: '⚽' },
    car: { name: 'car', emoji: '🚗' },
    duck: { name: 'duck', emoji: '🦆' },
    white: { name: 'white ball' },
    glow: { name: 'glow lamp', emits: true },
  };

  const [marked, setMarked] = useState({});

  const inBox = (x, y) => box && x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
  const reached = toy => {
    const dx = toy.x - light.x;
    const dy = toy.y - light.y;
    const toward = (Math.atan2(dy, dx) * 180) / Math.PI;
    const off = Math.abs(((toward - light.angle + 540) % 360) - 180);
    if (off > light.spread) return false;
    for (let i = 1; i < 60; i++) if (inBox(light.x + (dx * i) / 60, light.y + (dy * i) / 60)) return false;
    return true;
  };
  const seen = toy => !!(KINDS[toy.kind] || {}).emits || reached(toy);
  const allRight = toys.every(t => !!marked[t.id] === seen(t));

  useEffect(() => {
    lumina.goal(allRight);
    lumina.scene({
      bigLight: 'on now, about to go off',
      flashlight: 'on',
      beamDrawn: showBeam ? 'the whole beam' : 'only a short start at the lens',
      box: box ? 'a box stands in the room' : 'no box',
      toys: toys.map(t => `${(KINDS[t.kind] || {}).name || t.kind}: ${marked[t.id] ? 'has an eye' : 'no eye'}`),
    });
  }, [allRight, marked]);

  const rad = (light.angle * Math.PI) / 180;
  const beamLen = showBeam ? 900 : 58;
  const edge = sign => {
    const a = rad + (sign * light.spread * Math.PI) / 180;
    return `${light.x + Math.cos(a) * beamLen},${light.y + Math.sin(a) * beamLen}`;
  };

  const picture = toy => {
    const kind = KINDS[toy.kind] || {};
    if (toy.kind === 'white') {
      return <circle cx={toy.x} cy={toy.y} r="19" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />;
    }
    if (toy.kind === 'glow') {
      return (
        <g>
          <circle cx={toy.x} cy={toy.y} r="34" fill="#fde047" opacity="0.28" />
          <rect x={toy.x - 11} y={toy.y - 16} width="22" height="30" rx="8" fill="#fde047" stroke="#facc15" strokeWidth="2" />
          <rect x={toy.x - 8} y={toy.y + 13} width="16" height="6" rx="2" fill="#94a3b8" />
        </g>
      );
    }
    return <text x={toy.x} y={toy.y + 14} textAnchor="middle" fontSize="40">{kind.emoji}</text>;
  };

  return (
    <Panel title="Lights Out" caption="Tap a toy to put an eye on it. Tap it again to take the eye off.">
      <svg
        viewBox="0 0 680 380"
        style={{ width: '100%', height: 'auto', background: '#3b4a63', borderRadius: 12, border: '1px solid #1e293b', userSelect: 'none' }}
      >
        {/* Floor and the big light on the ceiling */}
        <rect x="0" y="352" width="680" height="28" fill="#2a3547" />
        <rect x="318" y="0" width="44" height="10" fill="#94a3b8" />
        <path d="M 312 10 L 368 10 L 380 34 L 300 34 Z" fill="#fef9c3" stroke="#fde68a" strokeWidth="2" />
        <text x="340" y="54" textAnchor="middle" fill="#e2e8f0" fontSize="13" fontWeight="700">big light</text>

        {/* The flashlight's light */}
        <polygon points={`${light.x},${light.y} ${edge(-1)} ${edge(1)}`} fill="#fde047" opacity={showBeam ? 0.26 : 0.6} />

        {box && (
          <g>
            <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="#92400e" stroke="#78350f" strokeWidth="3" />
            <line x1={box.x} y1={box.y + box.h / 2} x2={box.x + box.w} y2={box.y + box.h / 2} stroke="#78350f" strokeWidth="3" />
            <text x={box.x + box.w / 2} y={box.y + 24} textAnchor="middle" fill="#fde68a" fontSize="14" fontWeight="700">box</text>
          </g>
        )}

        {/* The flashlight */}
        <g transform={`translate(${light.x}, ${light.y}) rotate(${light.angle})`}>
          <rect x="-52" y="-9" width="40" height="18" rx="4" fill="#0f172a" stroke="#e2e8f0" strokeWidth="2" />
          <path d="M -12 -9 L 2 -16 L 2 16 L -12 9 Z" fill="#475569" stroke="#e2e8f0" strokeWidth="2" />
          <rect x="2" y="-16" width="5" height="32" fill="#fde047" />
        </g>

        {toys.map(toy => (
          <g key={toy.id}>
            {picture(toy)}
            <text x={toy.x} y={toy.y + 40} textAnchor="middle" fill="#f1f5f9" fontSize="14" fontWeight="700">
              {(KINDS[toy.kind] || {}).name || toy.kind}
            </text>
            {marked[toy.id] && (
              <g transform={`translate(${toy.x}, ${toy.y - 40})`}>
                <circle r="17" fill="#0f172a" stroke="#22d3ee" strokeWidth="3" />
                <ellipse rx="11" ry="7" fill="#f8fafc" />
                <circle r="4.5" fill="#0f172a" />
              </g>
            )}
            <rect
              id={`toy-${toy.id}`}
              x={toy.x - 34}
              y={toy.y - 34}
              width="68"
              height="82"
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => setMarked(prev => ({ ...prev, [toy.id]: !prev[toy.id] }))}
            />
          </g>
        ))}
      </svg>
    </Panel>
  );
}
