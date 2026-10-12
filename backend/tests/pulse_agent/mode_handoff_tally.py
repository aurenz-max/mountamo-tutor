"""Tally whether Pulse items carry the engine's IRT eval mode (WORKSTREAMS 7.5/7.6).

Wraps PulseEngine.assemble_session, then runs the normal scenario CLI. Prints,
per band, how many items had no eval_mode_name and how many named a mode the
primitive's registry does not have.

    venv/Scripts/python -m tests.pulse_agent.mode_handoff_tally --all --in-memory --output ./reports
"""
import asyncio
import sys
from collections import Counter

from app.services.calibration.problem_type_registry import PROBLEM_TYPE_REGISTRY
from app.services.pulse_engine import PulseEngine

TALLY: Counter = Counter()
_orig = PulseEngine.assemble_session


async def _wrapped(self, *a, **kw):
    resp = await _orig(self, *a, **kw)
    for it in resp.items:
        band = it.band.value
        TALLY[(band, "items")] += 1
        if not it.eval_mode_name:
            TALLY[(band, "no_mode")] += 1
        elif it.eval_mode_name not in PROBLEM_TYPE_REGISTRY.get(it.primitive_affinity, {}):
            TALLY[(band, "mode_not_in_registry")] += 1
    return resp


PulseEngine.assemble_session = _wrapped


def report() -> None:
    print("\n=== MODE HANDOFF TALLY ===")
    for band in sorted({b for b, _ in TALLY}):
        n = TALLY[(band, "items")]
        print(f"{band:10s} items={n:4d}  no_mode={TALLY[(band, 'no_mode')]:4d}  "
              f"mode_not_in_registry={TALLY[(band, 'mode_not_in_registry')]:4d}")


if __name__ == "__main__":
    from tests.pulse_agent import run_scenarios
    try:
        rc = run_scenarios.main() if not asyncio.iscoroutinefunction(run_scenarios.main) else asyncio.run(run_scenarios.main())
    finally:
        report()
