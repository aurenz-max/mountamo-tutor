function Display({ params, lumina }) {
  const boulderWeight = params?.boulderWeight ?? 300;
  const maxPush = params?.maxPush ?? 60;
  const minLiftCm = params?.minLiftCm ?? 0;
  const showArms = params?.showArms !== false;
  const canTest = params?.canTest !== false;
  const totalSlots = 10;

  // Fulcrum position: slot 1 to 9 (boulder at slot 0, push at slot 10)
  const [fulcrumSlot, setFulcrumSlot] = useState(5);
  const [isPushing, setIsPushing] = useState(false);
  const [tested, setTested] = useState(false);
  const timer = useRef(null);

  const loadArm = fulcrumSlot;
  const effortArm = totalSlots - fulcrumSlot;
  const canLift = boulderWeight * loadArm <= maxPush * effortArm;

  // The hand moves 12 cm for each unit of effort arm; the boulder rises 12 cm for each unit of load arm.
  const pushCm = effortArm * 12;
  const liftCm = loadArm * 12;

  // A right placement is right whether or not the child has tested it, so the moving boulder is not the verdict.
  const wiredRight = canLift && liftCm >= minLiftCm;

  useEffect(() => {
    lumina.goal(wiredRight);
    lumina.scene({
      boulderN: boulderWeight,
      strongestPushN: maxPush,
      fulcrumSlot,
      ...(showArms ? { loadArm, effortArm } : {}),
      ...(minLiftCm ? { mustRiseCm: minLiftCm } : {}),
      lastPush: tested ? (canLift ? { boulder: 'rose', handMovedCm: pushCm, boulderRoseCm: liftCm } : { boulder: 'did not move' }) : 'none yet',
    });
  }, [wiredRight, boulderWeight, maxPush, fulcrumSlot, loadArm, effortArm, tested, canLift, pushCm, liftCm, minLiftCm, showArms]);

  const beamLeft = 90;
  const beamRight = 590;
  const beamLength = beamRight - beamLeft;
  const slotStep = beamLength / totalSlots;
  const fulcrumX = beamLeft + fulcrumSlot * slotStep;

  const moved = isPushing || tested;
  // The beam turns until its push end reaches the ground.
  const tiltAngle = moved ? (canLift ? Math.min(14, (Math.atan(44 / (beamRight - fulcrumX)) * 180) / Math.PI) : 1.2) : 0;

  const moveFulcrum = ({ x }) => {
    clearTimeout(timer.current);
    setIsPushing(false);
    setTested(false);
    setFulcrumSlot(Math.max(1, Math.min(totalSlots - 1, Math.round((x - beamLeft) / slotStep))));
  };

  const pushDown = () => {
    if (isPushing) return;
    setIsPushing(true);
    timer.current = setTimeout(() => { setIsPushing(false); setTested(true); }, 900);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  const card = { background: '#1e293b', padding: '10px 14px', borderRadius: 8, border: '1px solid #334155' };
  const cardHead = { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 };
  const big = { fontSize: 22, fontWeight: 700, color: '#f1f5f9' };
  const small = { fontSize: 13, color: '#cbd5e1' };

  return (
    <Panel title="Boulder and Lever" caption={canTest ? 'Drag the fulcrum along the ground. Tap PUSH to try the lever.' : 'Drag the fulcrum along the ground.'}>
      <Stack gap={12}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div style={card}>
            <div style={cardHead}>Boulder</div>
            <div style={big}>{boulderWeight} N</div>
            {minLiftCm > 0 && <div style={small}>Must rise at least {minLiftCm} cm</div>}
          </div>
          <div style={card}>
            <div style={cardHead}>Your strongest push</div>
            <div style={big}>{maxPush} N</div>
          </div>
          <div style={card}>
            <div style={cardHead}>Last push</div>
            {!tested && <div style={small}>{canTest ? 'None yet' : 'No test pushes here'}</div>}
            {tested && canLift && <div style={small}>Your hand moved {pushCm} cm. The boulder rose {liftCm} cm.</div>}
            {tested && !canLift && <div style={small}>The boulder did not move.</div>}
          </div>
        </div>

        <div style={{ background: '#0f172a', borderRadius: 10, border: '1px solid #1e293b', overflow: 'hidden' }}>
          <svg viewBox="0 0 680 300" style={{ width: '100%', height: 'auto', display: 'block', userSelect: 'none', touchAction: 'none' }}>
            <rect x="0" y="240" width="680" height="60" fill="#1e293b" />
            <line x1="0" y1="240" x2="680" y2="240" stroke="#475569" strokeWidth="2" />

            {Array.from({ length: totalSlots + 1 }).map((_, i) => {
              const sx = beamLeft + i * slotStep;
              return (
                <g key={i}>
                  <circle id={`slot-${i}`} cx={sx} cy="240" r="2" fill="transparent" pointerEvents="none" />
                  <line x1={sx} y1="237" x2={sx} y2="243" stroke="#64748b" strokeWidth="2" />
                  <text x={sx} y="258" fill="#94a3b8" fontSize="12" textAnchor="middle">{i}</text>
                </g>
              );
            })}

            <g transform={`rotate(${tiltAngle}, ${fulcrumX}, 196)`}>
              <rect x={beamLeft} y={189} width={beamLength} height={14} rx={4} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />

              {showArms && !moved && (
                <g>
                  <line x1={beamLeft + 6} y1="212" x2={fulcrumX - 8} y2="212" stroke="#f87171" strokeWidth="2" strokeDasharray="3,3" />
                  <text x={(beamLeft + fulcrumX) / 2} y="228" fill="#f87171" fontSize="12" fontWeight="600" textAnchor="middle">{loadArm}</text>
                  <line x1={fulcrumX + 8} y1="212" x2={beamRight - 6} y2="212" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3,3" />
                  <text x={(fulcrumX + beamRight) / 2} y="228" fill="#38bdf8" fontSize="12" fontWeight="600" textAnchor="middle">{effortArm}</text>
                </g>
              )}

              <g id="boulder" transform={`translate(${beamLeft + 8}, 189)`}>
                <circle cx="0" cy="-35" r="35" fill="#64748b" stroke="#475569" strokeWidth="2" />
                <text x="0" y="-30" fill="#f8fafc" fontSize="14" fontWeight="800" textAnchor="middle">{boulderWeight} N</text>
              </g>

              <g id={canTest ? 'effort-handle' : undefined} transform={`translate(${beamRight - 8}, 189)`} style={canTest ? { cursor: 'pointer' } : undefined} onClick={canTest ? pushDown : undefined}>
                <circle cx="0" cy="-16" r="24" fill="transparent" />
                <circle cx="0" cy="-6" r="14" fill="#38bdf8" stroke="#0284c7" strokeWidth="2" />
                {canTest && <text x="0" y="-33" fill="#38bdf8" fontSize="12" fontWeight="800" textAnchor="middle">PUSH</text>}
              </g>
            </g>

            <Handle id="fulcrum" x={fulcrumX} y={240} r={24} onDrag={moveFulcrum} onDrop={moveFulcrum}>
              <polygon points="-24,0 24,0 0,-44" fill="#f59e0b" stroke="#d97706" strokeWidth="2" />
              <text x="0" y="36" fill="#f59e0b" fontSize="12" fontWeight="700" textAnchor="middle">Fulcrum</text>
            </Handle>

            {moved && canLift && (
              <g>
                <line x1={beamLeft - 30} y1="210" x2={beamLeft - 30} y2="155" stroke="#38bdf8" strokeWidth="3" />
                <polygon points={`${beamLeft - 34},160 ${beamLeft - 26},160 ${beamLeft - 30},150`} fill="#38bdf8" />
                <line x1={beamRight + 30} y1="165" x2={beamRight + 30} y2="225" stroke="#38bdf8" strokeWidth="3" />
                <polygon points={`${beamRight + 26},220 ${beamRight + 34},220 ${beamRight + 30},230`} fill="#38bdf8" />
              </g>
            )}
          </svg>
        </div>
      </Stack>
    </Panel>
  );
}
