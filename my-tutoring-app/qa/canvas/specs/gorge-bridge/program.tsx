function Display({ params, lumina }) {
  const truckWeight = params?.truckWeight ?? 12; // tons
  const budget = params?.budget ?? null;
  const canTest = params?.canTest !== false;

  // Design state
  const [material, setMaterial] = useState("Wood");
  const [thickness, setThickness] = useState(1); // 1 thin, 2 medium, 3 thick
  const [support, setSupport] = useState("None");

  // Simulation state
  const [animState, setAnimState] = useState("idle"); // idle, driving, broken, crossed
  const [truckPos, setTruckPos] = useState(40);
  const [sag, setSag] = useState(0);

  const animRef = useRef(null);

  const materialProps = {
    "Wood": { stiffness: 1.0, maxSag: 45, color: "#d97706", label: "Pine Wood", cost: 1 },
    "Hardwood": { stiffness: 2.2, maxSag: 40, color: "#92400e", label: "Oak Hardwood", cost: 3 },
    "Steel": { stiffness: 6.0, maxSag: 35, color: "#64748b", label: "Steel I-Beam", cost: 6 }
  };
  const thicknessOptions = [{ val: 1, label: "Thin", cost: 1 }, { val: 2, label: "Medium", cost: 2 }, { val: 3, label: "Thick", cost: 3 }];
  const supportOptions = [{ type: "None", label: "Flat Beam Only", cost: 0 }, { type: "Truss", label: "Truss Frame", cost: 3 }, { type: "Center Pier", label: "Center Pier", cost: 6 }];

  const leftBank = 120;
  const rightBank = 560;
  const gapWidth = rightBank - leftBank;
  const bridgeY = 220;

  const thicknessFactor = Math.pow(thickness, 2.5);
  const supportBonus = support === "Center Pier" ? 8 : (support === "Truss" ? 4.5 : 1);
  const effectiveStiffness = materialProps[material].stiffness * thicknessFactor * supportBonus;
  const baseDeflection = (truckWeight * 85) / effectiveStiffness;
  const maxSagAllowed = materialProps[material].maxSag;
  const willBreak = baseDeflection > maxSagAllowed;
  const cost = materialProps[material].cost + thickness + supportOptions.find(s => s.type === support).cost;

  const resetSim = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setAnimState("idle");
    setTruckPos(40);
    setSag(0);
  };

  const handleTest = () => {
    resetSim();
    setAnimState("driving");
    let currentX = 40;
    const targetX = 600;
    let lastTime = performance.now();
    const breakAt = support === "Center Pier" ? 0.25 : 0.5;

    const step = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      currentX += 380 * dt;
      setTruckPos(currentX);

      if (currentX > leftBank && currentX < rightBank) {
        const progressOnBridge = (currentX - leftBank) / gapWidth;
        const positionFactor = support === "Center Pier"
          ? Math.abs(Math.sin(progressOnBridge * 2 * Math.PI))
          : Math.sin(progressOnBridge * Math.PI);
        setSag(baseDeflection * positionFactor);
        // The same rule as the design: a bridge that cannot take the truck fails at its weakest point.
        if (willBreak && progressOnBridge >= breakAt) {
          setAnimState("broken");
          return;
        }
      } else {
        setSag(0);
      }

      if (currentX < targetX) {
        animRef.current = requestAnimationFrame(step);
      } else {
        setAnimState("crossed");
        setSag(0);
      }
    };

    animRef.current = requestAnimationFrame(step);
  };

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);

  // A right design is right whether or not the child has driven the truck, so the crossing is not the verdict.
  const designWorks = !willBreak && (budget === null || cost <= budget);

  useEffect(() => {
    lumina.goal(designWorks);
    lumina.scene({
      truckTons: truckWeight,
      material,
      thickness: thicknessOptions[thickness - 1].label,
      support,
      ...(budget !== null ? { cost, budget } : {}),
      lastTest: animState === "idle" ? "none yet" : animState === "broken" ? "the bridge collapsed" : animState === "crossed" ? "the truck reached the far bank" : "the truck is driving",
    });
  }, [designWorks, truckWeight, material, thickness, support, cost, budget, animState]);

  // Beam drawing coordinates
  const midX = (leftBank + rightBank) / 2;
  const midY = bridgeY + sag;
  const beamThicknessPx = 10 + thickness * 8;

  // Path for deflected beam
  let beamPath = "";
  if (animState === "broken") {
    beamPath = `M ${leftBank} ${bridgeY} L ${midX - 10} ${bridgeY + maxSagAllowed * 1.5} M ${midX + 10} ${bridgeY + maxSagAllowed * 1.5} L ${rightBank} ${bridgeY}`;
  } else if (support === "Center Pier") {
    const q1X = leftBank + gapWidth * 0.25;
    const q3X = leftBank + gapWidth * 0.75;
    const q1Y = bridgeY + sag * 0.8;
    const q3Y = bridgeY + sag * 0.8;
    beamPath = `M ${leftBank} ${bridgeY} Q ${q1X} ${q1Y} ${midX} ${bridgeY} Q ${q3X} ${q3Y} ${rightBank} ${bridgeY}`;
  } else {
    beamPath = `M ${leftBank} ${bridgeY} Q ${midX} ${midY + (sag * 0.4)} ${rightBank} ${bridgeY}`;
  }

  // Calculate truck rotation & y coordinate to stay seated on deflected beam
  let truckY = bridgeY - 32;
  let truckAngle = 0;
  if (truckPos >= leftBank && truckPos <= rightBank) {
    if (animState === "broken") {
      truckY = bridgeY + maxSagAllowed * 0.9;
      truckAngle = 25;
    } else {
      const u = (truckPos - leftBank) / gapWidth;
      truckY = bridgeY + 4 * sag * u * (1 - u) - 32;
      const slope = 4 * sag * (1 - 2 * u) / gapWidth;
      truckAngle = Math.atan(slope) * (180 / Math.PI);
    }
  }

  const optionStyle = (on) => ({
    padding: "8px 10px", minHeight: 44, borderRadius: 6, fontSize: 13, fontWeight: on ? 700 : 500, width: "100%",
    display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer",
    backgroundColor: on ? "#0c4a6e" : "#0f172a", color: on ? "#e0f2fe" : "#cbd5e1", border: "2px solid " + (on ? "#38bdf8" : "#334155"),
  });
  const costTag = (c) => (budget !== null ? <span>{"$" + c}</span> : null);
  const groupHead = { fontSize: 13, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 };
  const group = { background: "#1e293b", padding: 12, borderRadius: 8, border: "1px solid #334155", display: "flex", flexDirection: "column", gap: 6 };

  return (
    <Panel title="Supply Gorge Crossing" caption={canTest ? "Choose the beam and its support. Drive the truck to test it." : "Choose the beam and its support."}>
      <Stack gap={12}>
      <Row gap={14}>
        <Readout label="Truck" value={truckWeight} unit="tons" color="amber" />
        {budget !== null && <Readout label="Budget" value={"$" + budget} color="white" />}
        {budget !== null && <Readout label="This design" value={"$" + cost} color="white" />}
        {canTest && <button id="test-btn" onClick={handleTest} disabled={animState === "driving"} style={{ padding: "10px 20px", minHeight: 44, backgroundColor: animState === "driving" ? "#475569" : "#0284c7", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Drive the Truck</button>}
      </Row>
      {/* SVG Canvas World */}
      <div style={{ position: "relative", width: "100%", height: 320, background: "linear-gradient(to bottom, #bae6fd, #e0f2fe)", borderRadius: 12, overflow: "hidden", border: "1px solid #93c5fd" }}>
        <svg viewBox="0 0 680 320" style={{ width: "100%", height: "100%", display: "block" }}>
          <defs>
            <linearGradient id="rockGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#78716c" />
              <stop offset="100%" stopColor="#44403c" />
            </linearGradient>
          </defs>

          {/* Mountains & Clouds */}
          <path d="M 20 180 Q 90 90 160 180" fill="#93c5fd" opacity="0.4" />
          <path d="M 500 180 Q 580 100 660 180" fill="#93c5fd" opacity="0.4" />
          <circle cx="90" cy="50" r="22" fill="#fff" opacity="0.8" />
          <circle cx="115" cy="45" r="30" fill="#fff" opacity="0.8" />
          <circle cx="140" cy="52" r="20" fill="#fff" opacity="0.8" />
          <circle cx="560" cy="60" r="26" fill="#fff" opacity="0.8" />
          <circle cx="590" cy="55" r="32" fill="#fff" opacity="0.8" />

          {/* Canyon Cliffs */}
          <path d="M 0 220 L 120 220 L 115 320 L 0 320 Z" fill="url(#rockGrad)" />
          <rect x="0" y="220" width="120" height="8" fill="#15803d" />
          <path d="M 560 220 L 680 220 L 680 320 L 565 320 Z" fill="url(#rockGrad)" />
          <rect x="560" y="220" width="120" height="8" fill="#15803d" />

          {/* Canyon Floor / River */}
          <rect x="110" y="295" width="460" height="25" fill="#38bdf8" />
          <path d="M 120 300 Q 200 292 280 302 T 440 295 T 560 302" stroke="#bae6fd" strokeWidth="2" fill="none" />

          {/* Optional Reinforcement: Truss or Pier */}
          {support === "Center Pier" && (
            <g id="pier-support">
              <rect x={midX - 16} y={bridgeY} width="32" height={300 - bridgeY} fill="#64748b" rx="2" />
              <line x1={midX - 16} y1={bridgeY + 30} x2={midX + 16} y2={bridgeY + 30} stroke="#475569" strokeWidth="2" />
              <line x1={midX - 16} y1={bridgeY + 50} x2={midX + 16} y2={bridgeY + 50} stroke="#475569" strokeWidth="2" />
              <rect x={midX - 22} y={290} width="44" height="15" fill="#334155" rx="3" />
            </g>
          )}

          {support === "Truss" && animState !== "broken" && (
            <g id="truss-support">
              {Array.from({ length: 11 }).map((_, i) => {
                const x1 = leftBank + i * 40;
                const x2 = leftBank + (i + 1) * 40;
                const xm = (x1 + x2) / 2;
                const trussBottomY = bridgeY + 35 + (sag * 0.8);
                return (
                  <g key={i}>
                    <line x1={x1} y1={bridgeY + sag * 0.3} x2={xm} y2={trussBottomY} stroke="#475569" strokeWidth="3" />
                    <line x1={x2} y1={bridgeY + sag * 0.3} x2={xm} y2={trussBottomY} stroke="#475569" strokeWidth="3" />
                    <line x1={x1} y1={trussBottomY} x2={x2} y2={trussBottomY} stroke="#334155" strokeWidth="3.5" />
                  </g>
                );
              })}
            </g>
          )}

          {/* Main Bridge Beam */}
          <path
            id="bridge-beam"
            d={beamPath}
            fill="none"
            stroke={materialProps[material].color}
            strokeWidth={beamThicknessPx}
            strokeLinecap="round"
          />

          {/* Beam surface road markings */}
          {animState !== "broken" && (
            <path
              d={beamPath}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeDasharray="6 8"
              opacity="0.8"
            />
          )}

          {/* Deflection / Stress indicator */}
          {animState === "driving" && sag > 3 && (
            <g>
              <line x1={midX} y1={bridgeY} x2={midX} y2={midY} stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />
              <text x={midX + 8} y={midY - 4} fontSize="11" fill="#ef4444" fontWeight="bold">
                Sag: {Math.round(sag)}cm
              </text>
            </g>
          )}

          {/* Supply Truck */}
          <g
            id="truck-group"
            transform={`translate(${truckPos}, ${truckY}) rotate(${truckAngle}, 30, 25)`}
          >
            {/* Cargo Box */}
            <rect x="0" y="0" width="46" height="24" rx="3" fill="#ea580c" />
            <rect x="4" y="4" width="38" height="16" fill="#f97316" rx="2" />
            <text x="23" y="16" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">{truckWeight} T</text>
            
            {/* Cab */}
            <path d="M 46 8 L 58 8 L 64 16 L 64 24 L 46 24 Z" fill="#2563eb" />
            <polygon points="50,11 56,11 60,16 50,16" fill="#93c5fd" />
            <rect x="62" y="17" width="3" height="4" fill="#facc15" />

            {/* Wheels */}
            <circle cx="12" cy="26" r="6" fill="#1e293b" />
            <circle cx="12" cy="26" r="2.5" fill="#94a3b8" />
            <circle cx="34" cy="26" r="6" fill="#1e293b" />
            <circle cx="34" cy="26" r="2.5" fill="#94a3b8" />
            <circle cx="54" cy="26" r="6" fill="#1e293b" />
            <circle cx="54" cy="26" r="2.5" fill="#94a3b8" />
          </g>
          {animState === "broken" && <circle cx={midX} cy={bridgeY + 30} r="22" fill="#ef4444" opacity="0.3" />}
        </svg>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div style={group}>
          <div style={groupHead}>Beam material</div>
          {["Wood", "Hardwood", "Steel"].map((mat) => (
            <button key={mat} id={"mat-" + mat.toLowerCase()} disabled={animState === "driving"} onClick={() => { setMaterial(mat); resetSim(); }} style={optionStyle(material === mat)}>
              <span>{materialProps[mat].label}</span>{costTag(materialProps[mat].cost)}
            </button>
          ))}
        </div>
        <div style={group}>
          <div style={groupHead}>Beam thickness</div>
          {thicknessOptions.map((th) => (
            <button key={th.val} id={"thickness-" + th.val} disabled={animState === "driving"} onClick={() => { setThickness(th.val); resetSim(); }} style={optionStyle(thickness === th.val)}>
              <span>{th.label}</span>{costTag(th.cost)}
            </button>
          ))}
        </div>
        <div style={group}>
          <div style={groupHead}>Reinforcement</div>
          {supportOptions.map((sup) => (
            <button key={sup.type} id={"support-" + sup.type.toLowerCase().replace(" ", "-")} disabled={animState === "driving"} onClick={() => { setSupport(sup.type); resetSim(); }} style={optionStyle(support === sup.type)}>
              <span>{sup.label}</span>{costTag(sup.cost)}
            </button>
          ))}
        </div>
      </div>
      </Stack>
    </Panel>
  );
}
