function Display({ params, lumina }) {
  // Sound cards the child taps to hear and drags into boxes. Every card looks the same; only the tone differs.
  // params.axes: 'loud' (Loud / Soft boxes), 'pitch' (High / Low boxes) or 'both' (four boxes).
  // params.sounds: [{ id, hz, vol }] (vol 0..1). params.splitHz and params.splitVol divide high from low and loud from soft.
  const axes = params.axes || 'loud';
  const sounds = Array.isArray(params.sounds) ? params.sounds : [{ id: 1, hz: 440, vol: 0.7 }, { id: 2, hz: 440, vol: 0.06 }];
  const splitHz = params.splitHz || 500;
  const splitVol = params.splitVol || 0.3;

  const PITCH = { high: { word: 'High', icon: '🐦' }, low: { word: 'Low', icon: '🐻' } };
  const VOL = { loud: { word: 'Loud', icon: '🔊' }, soft: { word: 'Soft', icon: '🔈' } };
  const box = (key, x, y, w, h, parts) => ({ key, x, y, w, h, parts });
  const bins = axes === 'both'
    ? [
      box('high-loud', 20, 16, 315, 112, [PITCH.high, VOL.loud]),
      box('high-soft', 345, 16, 315, 112, [PITCH.high, VOL.soft]),
      box('low-loud', 20, 138, 315, 112, [PITCH.low, VOL.loud]),
      box('low-soft', 345, 138, 315, 112, [PITCH.low, VOL.soft]),
    ]
    : axes === 'pitch'
      ? [box('high', 20, 16, 315, 234, [PITCH.high]), box('low', 345, 16, 315, 234, [PITCH.low])]
      : [box('loud', 20, 16, 315, 234, [VOL.loud]), box('soft', 345, 16, 315, 234, [VOL.soft])];

  const pitchOf = s => (s.hz >= splitHz ? 'high' : 'low');
  const volOf = s => (s.vol >= splitVol ? 'loud' : 'soft');
  const home = s => (axes === 'both' ? `${pitchOf(s)}-${volOf(s)}` : axes === 'pitch' ? pitchOf(s) : volOf(s));

  const [where, setWhere] = useState({}); // sound id -> box key (absent: still on the tray)
  const [drag, setDrag] = useState(null); // { id, x, y, moved }
  const [ringing, setRinging] = useState(null);
  const audio = useRef(null);

  const play = s => {
    setRinging(s.id);
    setTimeout(() => setRinging(r => (r === s.id ? null : r)), 600);
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!audio.current) audio.current = new Ctx();
      const ctx = audio.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime;
      osc.type = 'triangle';
      osc.frequency.value = s.hz;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, s.vol), t + 0.03);
      gain.gain.setValueAtTime(Math.max(0.001, s.vol), t + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.62);
    } catch (e) { /* no sound device: the card still rings on screen */ }
  };

  const allRight = sounds.every(s => where[s.id] === home(s));

  useEffect(() => {
    const name = key => bins.find(b => b.key === key).parts.map(p => p.word).join(' and ');
    lumina.goal(allRight);
    lumina.scene({
      boxes: bins.map(b => b.parts.map(p => p.word).join(' and ')),
      sounds: sounds.map((s, i) => `Sound ${i + 1}: ${where[s.id] ? 'in the ' + name(where[s.id]) + ' box' : 'on the tray'}`),
    });
  }, [allRight, where]);

  // Where a card rests: on the tray, or in a row along the bottom of its box.
  const rest = s => {
    const key = where[s.id];
    if (!key) {
      const i = sounds.indexOf(s);
      const gap = 600 / sounds.length;
      return { x: 40 + gap * (i + 0.5), y: 310 };
    }
    const b = bins.find(v => v.key === key);
    const mates = sounds.filter(v => where[v.id] === key);
    return { x: b.x + 44 + mates.indexOf(s) * 62, y: b.y + b.h - 48 };
  };

  const drop = (s, pt) => {
    const moved = drag && drag.id === s.id && drag.moved;
    setDrag(null);
    if (!moved) { play(s); return; }
    const b = bins.find(v => pt.x >= v.x && pt.x <= v.x + v.w && pt.y >= v.y && pt.y <= v.y + v.h);
    setWhere(prev => {
      const next = { ...prev };
      if (b) next[s.id] = b.key; else delete next[s.id];
      return next;
    });
  };

  return (
    <Panel title="Sound Sort" caption="Tap a sound to hear it. Drag it into a box.">
      <svg
        viewBox="0 0 680 370"
        style={{ width: '100%', height: 'auto', background: '#0b1220', borderRadius: 12, border: '1px solid #1e293b', touchAction: 'none', userSelect: 'none' }}
      >
        {bins.map(b => (
          <g key={b.key}>
            <rect id={`bin-${b.key}`} x={b.x} y={b.y} width={b.w} height={b.h} rx="12" fill="#172033" stroke="#475569" strokeWidth="2" />
            <text x={b.x + b.w / 2} y={b.y + 28} textAnchor="middle" fill="#f1f5f9" fontSize="20" fontWeight="700" style={{ pointerEvents: 'none' }}>
              {b.parts.map(p => `${p.icon} ${p.word}`).join('   ')}
            </text>
          </g>
        ))}

        <rect x="20" y="272" width="640" height="88" rx="12" fill="rgba(30,41,59,0.5)" stroke="#334155" strokeDasharray="5 5" />

        {sounds.map((s, i) => {
          const at = drag && drag.id === s.id ? drag : rest(s);
          return (
            <Handle
              key={s.id}
              id={`sound-${s.id}`}
              x={at.x}
              y={at.y}
              r={22}
              onDrag={pt => setDrag(prev => {
                const start = prev && prev.id === s.id ? prev.start : rest(s);
                const moved = (prev && prev.id === s.id && prev.moved) || Math.hypot(pt.x - start.x, pt.y - start.y) > 8;
                return { id: s.id, x: moved ? pt.x : start.x, y: moved ? pt.y : start.y, start, moved };
              })}
              onDrop={pt => drop(s, pt)}
            >
              {ringing === s.id && <circle r="33" fill="none" stroke="#f8fafc" strokeWidth="3" opacity="0.7" />}
              <circle r="26" fill="#6366f1" stroke="#e0e7ff" strokeWidth="3" />
              <path d="M -11 -5 L -5 -5 L 3 -12 L 3 12 L -5 5 L -11 5 Z" fill="#ffffff" />
              <path d="M 8 -6 Q 13 0 8 6" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
              <text y="42" textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="700">{i + 1}</text>
            </Handle>
          );
        })}
      </svg>
    </Panel>
  );
}
