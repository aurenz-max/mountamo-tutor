# Topic Fidelity: vehicle-comparison-lab — 2026-08-17

Scope intended: the generated roster, visuals, facts, and evidence missions must follow the requested vehicle class or comparison instead of defaulting to the same air/land/sea set.

| Probe | Topic / intent | Student-facing result | Verdict |
|---|---|---|---|
| Focus | Comparing types of airplanes / passenger aircraft speed and capacity | Wright Flyer, Boeing 747-400, Concorde, Cessna 172, Airbus A380; all `air`; 3 evidence missions | HONORED |
| Discrimination | Comparing types of bicycles / speed, weight, carrying capacity | City commuter, road racing, mountain, and cargo bicycles; all `land`; 3 evidence missions | TRACKS |
| Broad control | How people travel / compare transportation choices | Boeing 747, Shinkansen, Tesla Model 3, school bus, bicycle; coherent mixed set | GRADE-BAND DEFAULT |

**Verdict:** FIDELITY BUG → fixed at Tier 1 plus deterministic post-validation.

**Mechanism:** topic and intent already reached the context and prompt, but lower prompt instructions overrode them by requiring a generic air/land/sea mix and seeding the same eight reference vehicles. The component also rendered no model graphics and reduced challenges to one vehicle lookup.

**Change:** topic scope is now authoritative; named vehicle classes stay within-class, named vehicles receive relevant peers, and mixed transport is reserved for broad topics. Each challenge carries a vehicle key plus an evidence key. Post-validation rejects keys that cannot be derived from visible values, removes unsupported “acceptable” answers, and restores three derived missions if Gemini emits invalid ones.

**Runtime contract checks:** all three probes returned status `pass`, 3 unique `evidence_choice` challenges, valid vehicle IDs, visible evidence metrics, and answer-free scenario text. Focused UI behavior: 4/4 Vitest checks pass.

**Type checks:** the Lumina gate passes with 0 errors. The legacy whole-app `tsc --noEmit` baseline still fails broadly (1,024 output lines), with 0 errors referencing the affected Vehicle Comparison Lab, generator, engineering catalog, or evaluation-type files.
