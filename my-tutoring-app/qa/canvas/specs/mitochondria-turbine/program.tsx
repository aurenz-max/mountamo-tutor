function Display({ params, lumina }) {
  const targetATP = params?.targetATP ?? 3;
  const protonsPerATP = params?.protonsPerATP ?? 1;

  const [reservoirProtons, setReservoirProtons] = useState(params?.startReservoir ?? 2);
  const [matrixProtons, setMatrixProtons] = useState(params?.startMatrix ?? 8);
  const [gateOpen, setGateOpen] = useState(false);
  const [throughTurbine, setThroughTurbine] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [turbineAngle, setTurbineAngle] = useState(0);
  const [pumpFlash, setPumpFlash] = useState(false);
  const [leak, setLeak] = useState(params?.startLeak === true);

  const atpCharged = Math.min(targetATP, Math.floor(throughTurbine / protonsPerATP));

  useEffect(() => {
    let animId;
    let lastTime = performance.now();
    const loop = (time) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      if (spinning && speed > 0) setTurbineAngle((prev) => (prev + speed * 180 * dt) % 360);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [spinning, speed]);

  // Protons run down the gradient through the open gate, back into the matrix, and each one turns the turbine.
  useEffect(() => {
    if (!gateOpen || reservoirProtons <= 2) {
      setSpinning(false);
      setSpeed(0);
      return;
    }
    setSpinning(true);
    setSpeed(Math.min(3, (reservoirProtons - 2) * 0.4));
    const interval = setInterval(() => {
      setReservoirProtons((r) => (r > 2 ? r - 1 : r));
      setMatrixProtons((m) => Math.min(14, m + 1));
      setThroughTurbine((c) => c + 1);
    }, 700);
    return () => clearInterval(interval);
  }, [gateOpen, reservoirProtons]);

  // A hole in the inner membrane lets protons back without turning the turbine.
  useEffect(() => {
    if (!leak) return;
    const interval = setInterval(() => {
      setReservoirProtons((r) => {
        if (r <= 0) return r;
        setMatrixProtons((m) => Math.min(14, m + 1));
        return r - 1;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [leak]);

  const handlePump = () => {
    if (matrixProtons <= 1) return;
    setPumpFlash(true);
    setTimeout(() => setPumpFlash(false), 200);
    setMatrixProtons((m) => m - 1);
    setReservoirProtons((r) => r + 1);
  };

  useEffect(() => {
    lumina.goal(atpCharged >= targetATP);
    lumina.scene({
      protonsInSpace: reservoirProtons,
      protonsInMatrix: matrixProtons,
      gate: gateOpen ? 'open' : 'closed',
      batteriesCharged: atpCharged,
      batteriesInRack: targetATP,
      turbine: spinning ? 'spinning' : 'still',
      innerMembrane: leak ? 'has a hole' : 'sealed',
      ...(protonsPerATP > 1 ? { protonsPerBattery: protonsPerATP } : {}),
    });
  }, [atpCharged, targetATP, reservoirProtons, matrixProtons, gateOpen, spinning, leak, protonsPerATP]);

  const reservoirDots = useMemo(() => {
    const dots = [];
    const count = Math.min(reservoirProtons, 16);
    for (let i = 0; i < count; i++) dots.push({ x: 205 + (i % 8) * 34 + (i >= 8 ? 17 : 0), y: i >= 8 ? 105 : 75, id: `h-res-${i}` });
    return dots;
  }, [reservoirProtons]);

  const matrixDots = useMemo(() => {
    const dots = [];
    const count = Math.min(matrixProtons, 14);
    for (let i = 0; i < count; i++) dots.push({ x: 140 + (i % 5) * 48, y: 230 + Math.floor(i / 5) * 40, id: `h-mat-${i}` });
    return dots;
  }, [matrixProtons]);

  const partial = protonsPerATP > 1 && atpCharged < targetATP ? throughTurbine % protonsPerATP : 0;

  return (
    <Panel title="Mitochondrion Power Plant" caption="Tap the pump, the turbine gate, or anything broken.">
      <Stack gap={10}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, background: '#1e293b', padding: '10px 14px', borderRadius: 10, border: '1px solid #334155' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>ATP batteries</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: targetATP }).map((_, idx) => (
              <div key={idx} id={`battery-${idx}`} style={{ width: 24, height: 32, borderRadius: 4, border: idx < atpCharged ? '2px solid #fbbf24' : '2px dashed #64748b', background: idx < atpCharged ? '#b45309' : '#0f172a' }} />
            ))}
          </div>
          {protonsPerATP > 1 && <span style={{ fontSize: 13, color: '#cbd5e1' }}>Each battery takes {protonsPerATP} H⁺ through the turbine{partial ? ` (${partial} so far)` : ''}.</span>}
        </div>

        <div style={{ background: '#0b1120', borderRadius: 10, border: '1px solid #334155' }}>
          <svg viewBox="0 0 680 370" style={{ width: '100%', display: 'block', userSelect: 'none' }}>
            <rect x="25" y="20" width="630" height="330" rx="35" ry="35" fill="none" stroke="#6366f1" strokeWidth="4" />
            <text x="48" y="44" fill="#a5b4fc" fontSize="12" fontWeight="bold">OUTER MEMBRANE</text>

            <path d="M 40 55 Q 340 50 640 55 L 640 135 Q 340 130 40 135 Z" fill="#1e1b4b" stroke="#4338ca" strokeWidth="1.5" />
            <text x="205" y="127" fill="#a5b4fc" fontSize="12" fontWeight="bold">INTERMEMBRANE SPACE</text>

            <path d="M 40 140 Q 340 135 640 140 L 640 335 Q 340 340 40 335 Z" fill="#111c30" stroke="#22d3ee" strokeWidth="3" />
            <text x="205" y="162" fill="#67e8f9" fontSize="12" fontWeight="bold">INNER MEMBRANE</text>
            <text x="48" y="325" fill="#94a3b8" fontSize="12" fontWeight="bold">MATRIX</text>

            <g id="btn-pump" transform="translate(120, 110)" style={{ cursor: 'pointer' }} onClick={handlePump}>
              <rect x="-50" y="-30" width="100" height="72" rx="8" fill={pumpFlash ? '#f59e0b' : '#b45309'} stroke="#fbbf24" strokeWidth="2" />
              <text x="0" y="-8" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="bold">H⁺ PUMP</text>
              <text x="0" y="8" textAnchor="middle" fill="#fef3c7" fontSize="11">runs on food energy</text>
              <text x="0" y="28" textAnchor="middle" fill="#ffffff" fontSize="16" fontWeight="bold">↑</text>
            </g>

            {leak && (
              <g id="btn-leak" transform="translate(395, 137)" style={{ cursor: 'pointer' }} onClick={() => setLeak(false)}>
                <rect x="-34" y="-24" width="68" height="48" fill="transparent" />
                <ellipse cx="0" cy="2" rx="28" ry="7" fill="#0b1120" stroke="#f87171" strokeWidth="2.5" strokeDasharray="4 3" />
                <text x="0" y="22" textAnchor="middle" fill="#fca5a5" fontSize="12" fontWeight="bold">HOLE</text>
              </g>
            )}

            <g transform="translate(480, 140)">
              <g id="btn-gate" style={{ cursor: 'pointer' }} onClick={() => setGateOpen((v) => !v)}>
                <rect x="-48" y="-24" width="96" height="48" fill="transparent" />
                <rect x="-38" y="-17" width="76" height="36" rx="6" fill={gateOpen ? '#0e7490' : '#334155'} stroke="#22d3ee" strokeWidth="2" />
                <text x="0" y="6" textAnchor="middle" fill="#e0f2fe" fontSize="12" fontWeight="bold">{gateOpen ? 'GATE OPEN' : 'GATE SHUT'}</text>
              </g>
              <g transform={`translate(0, 56) rotate(${turbineAngle})`}>
                <circle r="26" fill="#164e63" stroke="#22d3ee" strokeWidth="2.5" />
                <rect x="-4" y="-24" width="8" height="48" rx="2" fill="#67e8f9" />
                <rect x="-24" y="-4" width="48" height="8" rx="2" fill="#67e8f9" />
                <circle r="7" fill="#ffffff" />
              </g>
              <text x="0" y="106" textAnchor="middle" fill="#cbd5e1" fontSize="12" fontWeight="bold">TURBINE (ATP SYNTHASE)</text>
              {spinning && <path d="M 0 -22 L 0 26" stroke="#60a5fa" strokeWidth="4" strokeDasharray="6 3" />}
            </g>

            {reservoirDots.map((d) => (
              <g key={d.id} id={d.id} transform={`translate(${d.x}, ${d.y})`}>
                <circle r="13" fill="#3b82f6" stroke="#93c5fd" strokeWidth="2" />
                <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">H⁺</text>
              </g>
            ))}

            {matrixDots.map((d) => (
              <g key={d.id} id={d.id} transform={`translate(${d.x}, ${d.y})`}>
                <circle r="13" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="1.5" />
                <text x="0" y="4" textAnchor="middle" fill="#bfdbfe" fontSize="11" fontWeight="bold">H⁺</text>
              </g>
            ))}
          </svg>
        </div>
      </Stack>
    </Panel>
  );
}
