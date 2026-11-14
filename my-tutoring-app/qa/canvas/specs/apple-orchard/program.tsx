function Display({ params, lumina }) {
  const count = Math.max(1, Math.min(120, Math.round(Number(params.count) || 104)));
  const expectedTens = Math.floor(count / 10);

  // Deterministic organic positions on a 12-column grid (non-10 rows so child must count/group)
  const apples = useMemo(() => {
    const list = [];
    const cols = 12;
    const cellW = 30;
    const cellH = 30;
    const startX = 48;
    const startY = 72;
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      // Deterministic pseudo-random jitter
      const s1 = Math.sin(i * 12.9898 + count * 78.233) * 43758.5453;
      const s2 = Math.sin(i * 93.9898 + count * 17.133) * 24634.6345;
      const r1 = s1 - Math.floor(s1);
      const r2 = s2 - Math.floor(s2);
      const jx = (r1 - 0.5) * 7;
      const jy = (r2 - 0.5) * 7;
      list.push({
        id: i,
        x: startX + col * cellW + jx,
        y: startY + row * cellH + jy,
      });
    }
    return list;
  }, [count]);

  const [packedCrates, setPackedCrates] = useState([]); // array of arrays of 10 apple ids
  const [workingTray, setWorkingTray] = useState([]); // array of apple ids in the 10-crate
  const [numeralStr, setNumeralStr] = useState('');
  const [scoop, setScoop] = useState(null); // { startX, startY, curX, curY, hitAppleId }
  const [crateDrag, setCrateDrag] = useState(null); // { x, y } when dragging full crate to shelf
  const [warnTooMany, setWarnTooMany] = useState(false);

  const svgRef = useRef(null);

  const packedSet = useMemo(() => {
    const s = new Set();
    for (const c of packedCrates) for (const id of c) s.add(id);
    return s;
  }, [packedCrates]);

  const traySet = useMemo(() => new Set(workingTray), [workingTray]);

  const onMatApples = useMemo(
    () => apples.filter(a => !packedSet.has(a.id) && !traySet.has(a.id)),
    [apples, packedSet, traySet]
  );

  // Sync lumina goal and scene
  useEffect(() => {
    const met =
      packedCrates.length === expectedTens &&
      workingTray.length <= 9 &&
      numeralStr === String(count);
    lumina.goal(met);
    lumina.scene({
      packedCrates: packedCrates.length,
      objectsInPackedCrates: packedCrates.length * 10,
      objectsInWorkingCrate: workingTray.length,
      objectsOnMat: onMatApples.length,
      writtenNumeral: numeralStr || null,
    });
  }, [packedCrates, workingTray, onMatApples.length, numeralStr, expectedTens, count, lumina]);

  // Clear temporary warning
  useEffect(() => {
    if (!warnTooMany) return;
    const t = setTimeout(() => setWarnTooMany(false), 700);
    return () => clearTimeout(t);
  }, [warnTooMany]);

  // Keyboard support for numeral writing
  useEffect(() => {
    const onKey = e => {
      if (e.key >= '0' && e.key <= '9') {
        setNumeralStr(s => (s.length < 4 ? s + e.key : s));
      } else if (e.key === 'Backspace') {
        setNumeralStr(s => s.slice(0, -1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const MAT = { x: 18, y: 18, w: 396, h: 350 };
  const CRATE = { x: 18, y: 380, w: 396, h: 162 };
  const SHELF = { x: 428, y: 18, w: 234, h: 228 };

  const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  const findMatAppleNear = (p, radius = 16) => {
    let best = null;
    let bestD = radius;
    for (const a of onMatApples) {
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  };

  const getScoopSelection = sc => {
    if (!sc) return [];
    const dist = Math.hypot(sc.curX - sc.startX, sc.curY - sc.startY);
    if (dist <= 10 || sc.curY > MAT.y + MAT.h) return [];
    const minX = Math.min(sc.startX, sc.curX) - 10;
    const maxX = Math.max(sc.startX, sc.curX) + 10;
    const minY = Math.min(sc.startY, sc.curY) - 10;
    const maxY = Math.max(sc.startY, sc.curY) + 10;
    return onMatApples.filter(a => a.x >= minX && a.x <= maxX && a.y >= minY && a.y <= maxY);
  };

  const selectedInScoop = useMemo(() => getScoopSelection(scoop), [scoop, onMatApples]);
  const scoopOverflow = scoop && workingTray.length + selectedInScoop.length > 14;

  const packFullCrate = () => {
    if (workingTray.length !== 10 || packedCrates.length >= 12) return;
    setPackedCrates(prev => [...prev, workingTray]);
    setWorkingTray([]);
    setCrateDrag(null);
  };

  const unpackCrate = idx => {
    setPackedCrates(prev => prev.filter((_, i) => i !== idx));
  };

  const removeFromTray = id => {
    setWorkingTray(prev => prev.filter(x => x !== id));
  };

  const addDigit = d => {
    setNumeralStr(s => (s.length < 4 ? s + String(d) : s));
  };

  const backspaceDigit = () => {
    setNumeralStr(s => s.slice(0, -1));
  };

  const handlePointerDown = e => {
    const p = svgPoint(svgRef.current, e);
    if (inRect(p, MAT)) {
      const hit = findMatAppleNear(p, 17);
      setScoop({ startX: p.x, startY: p.y, curX: p.x, curY: p.y, hitAppleId: hit ? hit.id : null });
    }
  };

  const handlePointerMove = e => {
    const p = svgPoint(svgRef.current, e);
    if (scoop) {
      setScoop(prev => (prev ? { ...prev, curX: p.x, curY: p.y } : null));
    }
    if (crateDrag) {
      setCrateDrag({ x: p.x, y: p.y });
    }
  };

  const handlePointerUp = e => {
    const p = svgPoint(svgRef.current, e);
    if (crateDrag) {
      if (inRect(p, SHELF) && workingTray.length === 10) {
        packFullCrate();
      } else {
        setCrateDrag(null);
      }
    }
    if (scoop) {
      const dist = Math.hypot(p.x - scoop.startX, p.y - scoop.startY);
      // Case 1: Single tap on an apple
      if (dist <= 10) {
        if (scoop.hitAppleId !== null) {
          if (workingTray.length < 14) {
            setWorkingTray(prev => (prev.includes(scoop.hitAppleId) ? prev : [...prev, scoop.hitAppleId]));
          } else {
            setWarnTooMany(true);
          }
        }
      } else if (p.y > MAT.y + MAT.h && scoop.hitAppleId !== null) {
        // Case 2: Dragged a single apple down into the working crate
        if (inRect(p, CRATE)) {
          if (workingTray.length < 14) {
            setWorkingTray(prev => (prev.includes(scoop.hitAppleId) ? prev : [...prev, scoop.hitAppleId]));
          } else {
            setWarnTooMany(true);
          }
        }
      } else {
        // Case 3: Scoop box across apples on the mat
        const sel = getScoopSelection({ ...scoop, curX: p.x, curY: p.y });
        if (sel.length > 0) {
          if (workingTray.length + sel.length <= 14) {
            const addIds = sel.map(a => a.id);
            setWorkingTray(prev => [...prev, ...addIds.filter(id => !prev.includes(id))]);
          } else {
            setWarnTooMany(true);
          }
        }
      }
      setScoop(null);
    }
  };

  const drawApple = (x, y, r = 10.5, highlight = false) => (
    <g>
      {highlight && <circle cx={x} cy={y} r={r + 4.5} fill="none" stroke="#22d3ee" strokeWidth="2.5" />}
      <circle cx={x} cy={y + 0.5} r={r} fill="#dc2626" />
      <circle cx={x - 0.8} cy={y - 0.8} r={r * 0.85} fill="#ef4444" />
      <path d={`M ${x} ${y - r + 2} Q ${x + 1} ${y - r - 3} ${x + 3} ${y - r - 4}`} stroke="#78350f" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx={x + 4} cy={y - r + 1} rx={r * 0.34} ry={r * 0.18} transform={`rotate(-25 ${x + 4} ${y - r + 1})`} fill="#22c55e" />
      <circle cx={x - r * 0.34} cy={y - r * 0.3} r={r * 0.2} fill="#fecaca" opacity="0.8" />
    </g>
  );

  // Slot positions inside the 10-crate (5 cols x 2 rows)
  const slotPos = idx => {
    if (idx < 10) {
      const c = idx % 5;
      const r = Math.floor(idx / 5);
      return { x: 55 + c * 48, y: 443 + r * 48 };
    }
    const extraIdx = idx - 10;
    const c = extraIdx % 2;
    const r = Math.floor(extraIdx / 2);
    return { x: 316 + c * 44, y: 443 + r * 48 };
  };

  // Shelf positions for 12 mini 10-crates (3 cols x 4 rows)
  const shelfSlotPos = idx => {
    const c = idx % 3;
    const r = Math.floor(idx / 3);
    return { x: 442 + c * 70, y: 54 + r * 46, w: 64, h: 40 };
  };

  const keypadRows = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];

  const isScoopDragging = scoop && Math.hypot(scoop.curX - scoop.startX, scoop.curY - scoop.startY) > 10 && scoop.curY <= MAT.y + MAT.h;
  const scoopSelectedSet = useMemo(() => new Set(selectedInScoop.map(a => a.id)), [selectedInScoop]);

  return (
    <Panel
      title="Apple Orchard"
      caption="Drag across apples or tap them to fill a crate. Drag or tap a full crate to stack it, and use the keys to write a number."
    >
      <svg
        ref={svgRef}
        viewBox="0 0 680 560"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', userSelect: 'none' }}
      >
        <rect width="680" height="560" fill="#0f172a" />

        {/* Orchard Mat */}
        <rect id="orchard-mat" x={MAT.x} y={MAT.y} width={MAT.w} height={MAT.h} rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text x="34" y="40" fontSize="14" fontWeight="600" fill="#94a3b8">Orchard Mat</text>

        {/* Loose Apples on Mat */}
        {onMatApples.map(a => (
          <g key={a.id} id={'apple-' + a.id} style={{ cursor: 'pointer' }}>
            <circle cx={a.x} cy={a.y} r="14" fill="transparent" />
            {drawApple(a.x, a.y, 10.5, scoopSelectedSet.has(a.id))}
          </g>
        ))}

        {/* Dragged single apple preview when dragging down to crate */}
        {scoop && scoop.hitAppleId !== null && scoop.curY > MAT.y + MAT.h && (
          <g style={{ pointerEvents: 'none' }}>
            {drawApple(scoop.curX, scoop.curY, 12, true)}
          </g>
        )}

        {/* Scoop Net Rectangle */}
        {isScoopDragging && (
          <rect
            x={Math.max(MAT.x + 4, Math.min(scoop.startX, scoop.curX) - 10)}
            y={Math.max(MAT.y + 4, Math.min(scoop.startY, scoop.curY) - 10)}
            width={Math.min(MAT.x + MAT.w - 4, Math.max(scoop.startX, scoop.curX) + 10) - Math.max(MAT.x + 4, Math.min(scoop.startX, scoop.curX) - 10)}
            height={Math.min(MAT.y + MAT.h - 4, Math.max(scoop.startY, scoop.curY) + 10) - Math.max(MAT.y + 4, Math.min(scoop.startY, scoop.curY) - 10)}
            rx="8"
            fill={scoopOverflow ? 'rgba(251, 113, 133, 0.14)' : 'rgba(34, 211, 238, 0.12)'}
            stroke={scoopOverflow ? '#fb7185' : '#22d3ee'}
            strokeWidth="2.5"
            strokeDasharray="6 4"
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Working 10-Crate */}
        <rect
          id="working-crate"
          x={CRATE.x}
          y={CRATE.y}
          width={CRATE.w}
          height={CRATE.h}
          rx="14"
          fill="#1e293b"
          stroke={warnTooMany ? '#fb7185' : workingTray.length === 10 ? '#22d3ee' : workingTray.length > 10 ? '#fbbf24' : '#475569'}
          strokeWidth={workingTray.length === 10 || warnTooMany ? '2.5' : '2'}
          onPointerDown={e => {
            if (workingTray.length === 10) {
              const p = svgPoint(svgRef.current, e);
              setCrateDrag({ x: p.x, y: p.y });
            }
          }}
        />
        <text x="34" y="404" fontSize="14" fontWeight="600" fill="#cbd5e1">
          {warnTooMany ? 'Too many for one scoop!' : '10-Crate'}
        </text>

        {/* 10 slots inside crate */}
        {Array.from({ length: 10 }, (_, idx) => {
          const p = slotPos(idx);
          const appleId = workingTray[idx];
          const filled = appleId !== undefined;
          return (
            <g
              key={idx}
              id={'crate-slot-' + idx}
              onClick={e => {
                if (filled) {
                  e.stopPropagation();
                  removeFromTray(appleId);
                }
              }}
              onPointerDown={e => {
                if (filled) e.stopPropagation();
              }}
              style={{ cursor: filled ? 'pointer' : 'default' }}
            >
              <rect
                x={p.x - 20}
                y={p.y - 20}
                width="40"
                height="40"
                rx="8"
                fill={filled ? '#334155' : 'none'}
                stroke={filled ? '#64748b' : '#475569'}
                strokeWidth="2"
                strokeDasharray={filled ? undefined : '5 4'}
              />
              {filled && drawApple(p.x, p.y, 13, false)}
            </g>
          );
        })}

        {/* Overflow extra area when > 10 */}
        {workingTray.length > 10 && (
          <g>
            <rect x="288" y="418" width="112" height="104" rx="10" fill="rgba(251, 191, 36, 0.08)" stroke="#fbbf24" strokeWidth="2" strokeDasharray="5 4" />
            <text x="344" y="404" textAnchor="middle" fontSize="13" fontWeight="600" fill="#fbbf24">Extra (tap out)</text>
            {workingTray.slice(10).map((appleId, eIdx) => {
              const p = slotPos(10 + eIdx);
              return (
                <g
                  key={appleId}
                  id={'crate-extra-' + eIdx}
                  onClick={e => {
                    e.stopPropagation();
                    removeFromTray(appleId);
                  }}
                  onPointerDown={e => e.stopPropagation()}
                  style={{ cursor: 'pointer' }}
                >
                  <circle cx={p.x} cy={p.y} r="18" fill="#334155" stroke="#fbbf24" strokeWidth="1.5" />
                  {drawApple(p.x, p.y, 12, false)}
                </g>
              );
            })}
          </g>
        )}

        {/* Stack 10 handle when exactly 10 apples are in the crate */}
        {workingTray.length === 10 && (
          <g
            id="pack-crate"
            onClick={e => {
              e.stopPropagation();
              packFullCrate();
            }}
            onPointerDown={e => e.stopPropagation()}
            style={{ cursor: 'pointer' }}
          >
            <rect x="288" y="424" width="110" height="88" rx="12" fill="#334155" stroke="#22d3ee" strokeWidth="2.5" />
            <text x="343" y="462" textAnchor="middle" fontSize="16" fontWeight="700" fill="#e2e8f0">Stack 10</text>
            <text x="343" y="486" textAnchor="middle" fontSize="14" fill="#22d3ee">to Shelf ↑</text>
          </g>
        )}

        {/* Dragged full crate preview */}
        {crateDrag && (
          <g style={{ pointerEvents: 'none' }} opacity="0.88">
            <rect x={crateDrag.x - 36} y={crateDrag.y - 22} width="72" height="44" rx="8" fill="#334155" stroke="#22d3ee" strokeWidth="2.5" />
            {Array.from({ length: 10 }, (_, k) => (
              <circle
                key={k}
                cx={crateDrag.x - 22 + (k % 5) * 11}
                cy={crateDrag.y - 7 + Math.floor(k / 5) * 14}
                r="4"
                fill="#ef4444"
              />
            ))}
          </g>
        )}

        {/* Crates of 10 Shelf */}
        <rect
          id="tens-shelf"
          x={SHELF.x}
          y={SHELF.y}
          width={SHELF.w}
          height={SHELF.h}
          rx="14"
          fill="#1e293b"
          stroke={crateDrag && inRect(crateDrag, SHELF) ? '#22d3ee' : '#475569'}
          strokeWidth={crateDrag && inRect(crateDrag, SHELF) ? '2.5' : '2'}
        />
        <text x="444" y="40" fontSize="14" fontWeight="600" fill="#cbd5e1">Crates of 10</text>

        {Array.from({ length: 12 }, (_, idx) => {
          const sp = shelfSlotPos(idx);
          const isPacked = idx < packedCrates.length;
          return (
            <g
              key={idx}
              id={isPacked ? 'packed-crate-' + idx : 'shelf-slot-' + idx}
              onClick={e => {
                if (isPacked) {
                  e.stopPropagation();
                  unpackCrate(idx);
                }
              }}
              onPointerDown={e => e.stopPropagation()}
              style={{ cursor: isPacked ? 'pointer' : 'default' }}
            >
              <rect
                x={sp.x}
                y={sp.y}
                width={sp.w}
                height={sp.h}
                rx="7"
                fill={isPacked ? '#334155' : 'none'}
                stroke={isPacked ? '#fbbf24' : '#334155'}
                strokeWidth={isPacked ? '2' : '1.5'}
                strokeDasharray={isPacked ? undefined : '4 4'}
              />
              {isPacked &&
                Array.from({ length: 10 }, (_, k) => (
                  <circle
                    key={k}
                    cx={sp.x + 12 + (k % 5) * 10}
                    cy={sp.y + 13 + Math.floor(k / 5) * 14}
                    r="3.8"
                    fill="#ef4444"
                  />
                ))}
            </g>
          );
        })}

        {/* Harvest Tag & Keypad */}
        <rect x="428" y="258" width="234" height="284" rx="14" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <text x="444" y="280" fontSize="14" fontWeight="600" fill="#cbd5e1">How many apples?</text>

        <rect
          id="numeral-display"
          x="444"
          y="290"
          width="202"
          height="50"
          rx="10"
          fill="#0f172a"
          stroke={numeralStr.length > 0 ? '#22d3ee' : '#475569'}
          strokeWidth="2"
          strokeDasharray={numeralStr.length > 0 ? undefined : '6 5'}
        />
        <text
          x="545"
          y="324"
          textAnchor="middle"
          fontSize="30"
          fontWeight="700"
          fill={numeralStr.length > 0 ? '#e2e8f0' : '#64748b'}
        >
          {numeralStr.length > 0 ? numeralStr : '?'}
        </text>

        {/* Keypad 1-9 */}
        {keypadRows.map((row, rIdx) =>
          row.map((digit, cIdx) => {
            const kx = 446 + cIdx * 68;
            const ky = 350 + rIdx * 48;
            return (
              <g
                key={digit}
                id={'key-' + digit}
                onClick={e => {
                  e.stopPropagation();
                  addDigit(digit);
                }}
                onPointerDown={e => e.stopPropagation()}
                style={{ cursor: 'pointer' }}
              >
                <rect x={kx} y={ky} width="60" height="44" rx="9" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
                <text x={kx + 30} y={ky + 29} textAnchor="middle" fontSize="20" fontWeight="600" fill="#e2e8f0">
                  {digit}
                </text>
              </g>
            );
          })
        )}

        {/* Row 3: 0 and Backspace */}
        <g
          id="key-0"
          onClick={e => {
            e.stopPropagation();
            addDigit(0);
          }}
          onPointerDown={e => e.stopPropagation()}
          style={{ cursor: 'pointer' }}
        >
          <rect x="446" y="494" width="128" height="44" rx="9" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
          <text x="510" y="523" textAnchor="middle" fontSize="20" fontWeight="600" fill="#e2e8f0">0</text>
        </g>

        <g
          id="key-back"
          onClick={e => {
            e.stopPropagation();
            backspaceDigit();
          }}
          onPointerDown={e => e.stopPropagation()}
          style={{ cursor: 'pointer' }}
        >
          <rect x="582" y="494" width="64" height="44" rx="9" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
          <text x="614" y="523" textAnchor="middle" fontSize="20" fontWeight="600" fill="#cbd5e1">⌫</text>
        </g>
      </svg>
    </Panel>
  );
}