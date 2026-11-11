function Display({ params, lumina }) {
  // A backhoe drawn large in side view with six parts the child can drop a card on: the front loader bucket, the cab,
  // the wheels, the stabilizer legs, the boom and the rear digging bucket. Job cards wait in a tray. The child drags
  // each card onto the part that does that job. A card rests on whatever part it is dropped on; nothing on the machine
  // is labelled and nothing changes when a card lands on the right part.
  // params.cards: card keys, 1-5 of them (always fewer than the six parts, so no card is forced).
  //   job cards:    dig, carry, still, drive, reach, see
  //   result cards: hole, truck, tracks, pads (what the job leaves behind, no machine and no words)
  const CARDS = {
    dig: { part: 'digger', word: 'Dig', says: 'dig a deep hole' },
    carry: { part: 'loader', word: 'Carry', says: 'carry a pile of dirt' },
    still: { part: 'legs', word: 'Hold still', says: 'stand still on legs' },
    drive: { part: 'wheels', word: 'Drive', says: 'drive along a road' },
    reach: { part: 'boom', word: 'Reach', says: 'reach far across a ditch' },
    see: { part: 'cab', word: 'See', says: 'see out' },
    hole: { part: 'digger', word: '', says: 'a deep hole in the ground' },
    truck: { part: 'loader', word: '', says: 'a truck full of dirt' },
    tracks: { part: 'wheels', word: '', says: 'tyre tracks in the mud' },
    pads: { part: 'legs', word: '', says: 'two round pad marks in the mud' },
  };
  const cards = (Array.isArray(params.cards) ? params.cards : ['dig', 'carry'])
    .filter((k, i, a) => CARDS[k] && a.indexOf(k) === i).slice(0, 5);

  // Each part: where it catches a card (a box on the drawing) and the name the tutor reads.
  const PARTS = {
    loader: { x: 48, y: 300, w: 147, h: 128, name: 'front loader bucket' },
    cab: { x: 285, y: 140, w: 130, h: 150, name: 'cab' },
    wheels: { x: 195, y: 335, w: 275, h: 93, name: 'wheels' },
    legs: { x: 470, y: 335, w: 112, h: 93, name: 'stabilizer legs' },
    boom: { x: 470, y: 100, w: 170, h: 200, name: 'long arm (boom)' },
    digger: { x: 590, y: 300, w: 125, h: 128, name: 'rear digging bucket' },
  };
  const PART_KEYS = Object.keys(PARTS);
  const centerOf = p => ({ x: PARTS[p].x + PARTS[p].w / 2, y: PARTS[p].y + PARTS[p].h / 2 });
  const partAt = pt => PART_KEYS.find(p => {
    const r = PARTS[p];
    return pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
  }) || null;

  const [onPart, setOnPart] = useState(() => cards.map(() => null)); // part key per card, or null in the tray
  const [drag, setDrag] = useState(null); // { key, x, y }
  const svgRef = useRef(null);

  const goalMet = cards.length > 0 && cards.every((k, i) => onPart[i] === CARDS[k].part);

  useEffect(() => {
    lumina.goal(goalMet);
    lumina.scene({
      machine: 'a backhoe in side view; its parts carry no labels',
      cards: cards.map((k, i) => ({
        card: CARDS[k].says,
        on: onPart[i] ? PARTS[onPart[i]].name : 'still in the tray',
      })),
      partsWithNoCard: PART_KEYS.filter(p => !onPart.includes(p)).map(p => PARTS[p].name),
    });
  }, [goalMet, onPart]);

  // ---------- layout ----------
  const W = 720, GROUND = 428, TRAY_Y = 446, TRAY_H = 150, H = TRAY_Y + TRAY_H + 4;
  const slot = i => ({ x: (W / (cards.length + 1)) * (i + 1), y: TRAY_Y + TRAY_H / 2 });
  const where = i => {
    const k = cards[i];
    if (drag && drag.key === k && drag.x !== undefined) return { x: drag.x, y: drag.y, s: 1 };
    if (onPart[i]) return { ...centerOf(onPart[i]), s: 0.78 };
    return { ...slot(i), s: 1 };
  };

  const onDown = (key, e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ key });
  };
  const onMove = e => {
    if (!drag || !svgRef.current) return;
    const pt = svgPoint(svgRef.current, e);
    setDrag(d => (d ? { ...d, x: pt.x, y: pt.y } : null));
  };
  const onUp = e => {
    if (!drag || !svgRef.current) return;
    const pt = svgPoint(svgRef.current, e);
    const target = partAt(pt);
    const idx = cards.indexOf(drag.key);
    setOnPart(prev => {
      // One card per part: a card dropped on a taken part sends the card that was there back to the tray.
      const next = prev.map((p, i) => (i !== idx && target && p === target ? null : p));
      next[idx] = target;
      return next;
    });
    setDrag(null);
  };

  // ---------- the backhoe ----------
  const Y = '#facc15', YD = '#ca8a04', STEEL = '#94a3b8', STEEL_D = '#475569', TYRE = '#111827';
  const backhoe = (
    <g>
      {/* body and hood (not a drop target) */}
      <rect x="190" y="298" width="112" height="52" rx="8" fill={Y} stroke={YD} strokeWidth="3" />
      <rect x="296" y="286" width="182" height="64" rx="8" fill={Y} stroke={YD} strokeWidth="3" />
      <rect x="214" y="288" width="12" height="14" rx="2" fill="#374151" />

      <g id="part-loader">
        <rect x={PARTS.loader.x} y={PARTS.loader.y} width={PARTS.loader.w} height={PARTS.loader.h} fill="transparent" />
        <line x1="205" y1="318" x2="150" y2="352" stroke={Y} strokeWidth="16" strokeLinecap="round" />
        <line x1="198" y1="336" x2="160" y2="372" stroke={STEEL_D} strokeWidth="6" strokeLinecap="round" />
        <path d="M 162 330 Q 182 376 164 416 L 62 416 L 56 404 L 92 398 Q 104 354 128 334 Z" fill={STEEL} stroke={STEEL_D} strokeWidth="3" strokeLinejoin="round" />
        <path d="M 146 344 Q 160 378 148 402 L 100 402" fill="none" stroke={STEEL_D} strokeWidth="3" strokeLinecap="round" />
      </g>

      <g id="part-cab">
        <rect x={PARTS.cab.x} y={PARTS.cab.y} width={PARTS.cab.w} height={PARTS.cab.h} fill="transparent" />
        <rect x="292" y="146" width="122" height="12" rx="4" fill={Y} stroke={YD} strokeWidth="3" />
        <rect x="298" y="156" width="110" height="132" rx="4" fill="#1e293b" stroke={YD} strokeWidth="4" />
        <rect x="306" y="166" width="44" height="80" rx="3" fill="#bae6fd" />
        <rect x="356" y="166" width="44" height="80" rx="3" fill="#bae6fd" />
        <line x1="312" y1="176" x2="326" y2="164" stroke="#ffffff" strokeWidth="3" opacity="0.8" />
      </g>

      <g id="part-wheels">
        <rect x={PARTS.wheels.x} y={PARTS.wheels.y} width={PARTS.wheels.w} height={PARTS.wheels.h} fill="transparent" />
        {[{ x: 250, r: 44 }, { x: 412, r: 54 }].map(w => (
          <g key={w.x}>
            <circle cx={w.x} cy={GROUND - w.r} r={w.r} fill={TYRE} stroke="#374151" strokeWidth="4" />
            <circle cx={w.x} cy={GROUND - w.r} r={w.r * 0.48} fill="#d1d5db" stroke="#6b7280" strokeWidth="3" />
            <circle cx={w.x} cy={GROUND - w.r} r={w.r * 0.14} fill="#4b5563" />
          </g>
        ))}
      </g>

      <g id="part-legs">
        <rect x={PARTS.legs.x} y={PARTS.legs.y} width={PARTS.legs.w} height={PARTS.legs.h} fill="transparent" />
        <line x1="484" y1="334" x2="548" y2="414" stroke={YD} strokeWidth="14" strokeLinecap="round" />
        <line x1="476" y1="330" x2="532" y2="414" stroke={Y} strokeWidth="16" strokeLinecap="round" />
        <rect x="508" y="414" width="52" height="12" rx="4" fill={STEEL_D} />
      </g>

      <g id="part-boom">
        <rect x={PARTS.boom.x} y={PARTS.boom.y} width={PARTS.boom.w} height={PARTS.boom.h} fill="transparent" />
        <path d="M 484 300 Q 512 168 588 130" fill="none" stroke={YD} strokeWidth="26" strokeLinecap="round" />
        <path d="M 484 300 Q 512 168 588 130" fill="none" stroke={Y} strokeWidth="20" strokeLinecap="round" />
        <line x1="588" y1="130" x2="640" y2="312" stroke={YD} strokeWidth="18" strokeLinecap="round" />
        <line x1="588" y1="130" x2="640" y2="312" stroke={Y} strokeWidth="12" strokeLinecap="round" />
        <circle cx="588" cy="130" r="9" fill={STEEL_D} />
        <circle cx="484" cy="300" r="9" fill={STEEL_D} />
      </g>

      <g id="part-digger">
        <rect x={PARTS.digger.x} y={PARTS.digger.y} width={PARTS.digger.w} height={PARTS.digger.h} fill="transparent" />
        <path d="M 628 316 L 690 324 Q 700 372 670 398 L 622 404 L 634 386 L 640 340 Z" fill={STEEL} stroke={STEEL_D} strokeWidth="3" strokeLinejoin="round" />
        {[0, 1, 2].map(t => <path key={t} d={`M ${626 + t * 12} ${402 - t * 1} l 4 12 l 5 -13`} fill={STEEL_D} />)}
        <circle cx="640" cy="318" r="7" fill={STEEL_D} />
      </g>
    </g>
  );

  // ---------- card pictures (drawn on a light card, centred at 0,0; picture area y -42..20) ----------
  const DIRT = '#92400e', DIRT_L = '#b45309', SKY = '#e0f2fe';
  const picture = k => {
    if (k === 'dig') return (
      <g>
        <rect x="-42" y="-8" width="84" height="30" fill={DIRT_L} />
        <path d="M -12 -8 L 12 -8 L 7 22 L -7 22 Z" fill="#1c1917" />
        {[[-20, -24], [-28, -14], [18, -28], [26, -16], [8, -36]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill={DIRT} />)}
        <path d="M 0 -40 L 0 -16 M -6 -22 L 0 -15 L 6 -22" fill="none" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
      </g>
    );
    if (k === 'hole') return (
      <g>
        <rect x="-42" y="-6" width="84" height="28" fill={DIRT_L} />
        <path d="M -16 -6 L 16 -6 L 10 22 L -10 22 Z" fill="#1c1917" />
        <path d="M 18 -6 Q 30 -26 42 -6 Z" fill={DIRT} />
      </g>
    );
    if (k === 'carry') return (
      <g>
        <rect x="-42" y="12" width="84" height="10" fill={DIRT_L} />
        <path d="M -14 0 Q 2 -34 18 0 Z" fill={DIRT} />
        {[-24, -14].map(y => <line key={y} x1="-38" y1={y + 12} x2="-22" y2={y + 12} stroke="#475569" strokeWidth="3" strokeLinecap="round" />)}
        <path d="M 22 -30 L 38 -30 M 32 -36 L 39 -30 L 32 -24" fill="none" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
      </g>
    );
    if (k === 'truck') return (
      <g>
        <rect x="-42" y="14" width="84" height="8" fill="#64748b" />
        <path d="M -38 -12 Q -14 -36 12 -12 Z" fill={DIRT} />
        <rect x="-38" y="-12" width="50" height="18" fill="#2563eb" stroke="#1e3a8a" strokeWidth="2" />
        <rect x="14" y="-18" width="22" height="24" rx="3" fill="#2563eb" stroke="#1e3a8a" strokeWidth="2" />
        <rect x="20" y="-14" width="11" height="9" fill={SKY} />
        {[-26, 0, 26].map(x => <circle key={x} cx={x} cy="9" r="6" fill={TYRE} />)}
      </g>
    );
    if (k === 'still') return (
      <g>
        <rect x="-42" y="14" width="84" height="8" fill={DIRT_L} />
        <rect x="-20" y="-24" width="40" height="22" rx="3" fill="#64748b" stroke="#334155" strokeWidth="2" />
        <path d="M -14 -2 L -28 13 M 14 -2 L 28 13" stroke="#334155" strokeWidth="5" strokeLinecap="round" />
        <rect x="-36" y="10" width="16" height="5" rx="2" fill="#334155" />
        <rect x="20" y="10" width="16" height="5" rx="2" fill="#334155" />
      </g>
    );
    if (k === 'pads') return (
      <g>
        <rect x="-42" y="-30" width="84" height="52" rx="4" fill="#78350f" />
        {[-20, 20].map(x => (
          <g key={x}>
            <ellipse cx={x} cy="-4" rx="15" ry="11" fill="#451a03" />
            <ellipse cx={x} cy="-4" rx="15" ry="11" fill="none" stroke={DIRT_L} strokeWidth="2" />
          </g>
        ))}
      </g>
    );
    if (k === 'drive') return (
      <g>
        <rect x="-42" y="-40" width="84" height="62" fill="#86efac" />
        <path d="M -10 -40 L 10 -40 L 40 22 L -40 22 Z" fill="#475569" />
        {[-34, -18, 0].map((y, i) => <rect key={y} x={-1.5 - i} y={y} width={3 + i * 2} height={8 + i * 3} fill="#fde047" />)}
      </g>
    );
    if (k === 'tracks') return (
      <g>
        <rect x="-42" y="-40" width="84" height="62" rx="4" fill="#78350f" />
        {[-18, 18].map(x => (
          <g key={x}>
            <rect x={x - 10} y="-40" width="20" height="62" fill="#5b2a0a" />
            {[-36, -26, -16, -6, 4, 14].map(y => <rect key={y} x={x - 10} y={y} width="20" height="4" fill="#2a1204" />)}
          </g>
        ))}
      </g>
    );
    if (k === 'reach') return (
      <g>
        <rect x="-42" y="0" width="28" height="22" fill={DIRT_L} />
        <rect x="14" y="0" width="28" height="22" fill={DIRT_L} />
        <rect x="-14" y="10" width="28" height="12" fill="#38bdf8" />
        <path d="M -30 -4 Q 0 -44 30 -6" fill="none" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
        <path d="M 22 -12 L 31 -5 L 33 -16" fill="none" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
      </g>
    );
    // see: an eye
    return (
      <g>
        <path d="M -34 -10 Q 0 -40 34 -10 Q 0 20 -34 -10 Z" fill="#ffffff" stroke="#1e293b" strokeWidth="3" />
        <circle cx="0" cy="-10" r="11" fill="#2563eb" />
        <circle cx="0" cy="-10" r="5" fill="#0f172a" />
      </g>
    );
  };

  const card = (k, i) => {
    const at = where(i);
    const word = CARDS[k].word;
    return (
      <g key={k} id={`card-${k}`} transform={`translate(${at.x}, ${at.y}) scale(${at.s})`}
        style={{ cursor: 'grab', touchAction: 'none' }}
        onPointerDown={e => onDown(k, e)} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
        <rect x="-50" y="-50" width="100" height="100" rx="10" fill="#f8fafc" stroke="#fbbf24" strokeWidth="3" />
        <g transform={word ? 'translate(0, 0)' : 'translate(0, 10)'}>
          <clipPath id={`clip-${k}`}><rect x="-44" y="-44" width="88" height="68" rx="6" /></clipPath>
          <rect x="-44" y="-44" width="88" height="68" rx="6" fill={SKY} />
          <g clipPath={`url(#clip-${k})`}>{picture(k)}</g>
        </g>
        {word && <text x="0" y="42" textAnchor="middle" fill="#0f172a" fontSize={word.length > 6 ? 15 : 18} fontWeight="700">{word}</text>}
      </g>
    );
  };

  const order = cards.map((_, i) => i).sort((a, b) => (drag && cards[a] === drag.key ? 1 : 0) - (drag && cards[b] === drag.key ? 1 : 0));

  return (
    <Panel>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}>
        <rect x="0" y="0" width={W} height={GROUND} rx="12" fill="#0b1224" />
        <rect x="0" y={GROUND} width={W} height="10" fill="#78350f" />
        {backhoe}
        <rect x="0" y={TRAY_Y} width={W} height={TRAY_H} rx="12" fill="rgba(30,41,59,0.6)" stroke="#334155" strokeDasharray="5 5" />
        {cards.map((k, i) => (
          <rect key={`slot-${k}`} x={slot(i).x - 50} y={slot(i).y - 50} width="100" height="100" rx="10"
            fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="6 4" />
        ))}
        {order.map(i => card(cards[i], i))}
      </svg>
    </Panel>
  );
}
