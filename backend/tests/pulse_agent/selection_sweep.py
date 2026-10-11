"""
Selection-policy sweep
======================

Runs the truth-model Pulse journey under alternative item-selection policies
and reports what the child experiences (success rate, miss streaks, rough
sessions) next to what the engine learns (estimator error) and what the child
learns (true-ability gain). Production code is not edited: each policy is
swapped in at runtime by patching PulseEngine.select_best_mode and the
module-level item_information that the utility ranking calls.

Policies
  baseline        current engine: max-information mode, utility = I x sigma^2
  rank@T          utility = I x sigma^2 x w(P; T); mode stays max-information
                  (the "adjust the Fisher weight" edit)
  mode@T          mode = the one whose predicted P is closest to T; ranking
                  unchanged
  both@T          rank@T and mode@T together

Learning assumptions (the truth model's gain per exposure; the default
model is difficulty-blind, so it cannot rank targets by learning on its own)
  flat     every item teaches the same amount (current truth model)
  zone     gain x 4P(1-P): most learning near 50% (pure "desirable difficulty")
  success  gain x P: you learn from what you get right

Usage
  python -m tests.pulse_agent.selection_sweep --sessions 20 --seeds 3 \
      --out ./reports/selection_sweep.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import math
import statistics as st
from dataclasses import replace
from pathlib import Path
from typing import Any, Callable, Dict, List

import app.services.pulse_engine as pe_mod
from app.services.calibration_engine import item_information as _orig_info, p_correct
from app.services.pulse_engine import PulseEngine

from tests.pulse_agent.agent import PulseAgentRunner
from tests.pulse_agent.profiles import ALL_PROFILES
from tests.pulse_agent.run_scenarios import build_engine_in_memory
from tests.pulse_agent import truth_model as tm

logging.disable(logging.CRITICAL)

_orig_select = PulseEngine.select_best_mode
PASS = 6.0  # score >= 6/10 counts as a success


# ── Policies ────────────────────────────────────────────────────────────────

def _weight(p: float, target: float, width: float = 0.12) -> float:
    return math.exp(-((p - target) / width) ** 2)


def _make_weighted_info(target: float) -> Callable:
    def info(theta, a, b, c=0.0):
        return _orig_info(theta, a, b, c) * _weight(p_correct(theta, a, b, c), target)
    return info


def _make_targeted_select(target: float) -> Callable:
    def select(theta, primitive_type, allowed_modes=None):
        modes = pe_mod.PROBLEM_TYPE_REGISTRY.get(primitive_type)
        if not modes:
            m = pe_mod.theta_to_mode(theta)
            return m, pe_mod.mode_to_beta(m), "default"
        best = None
        for idx, (name, cfg) in enumerate(
            sorted(modes.items(), key=lambda x: x[1].prior_beta), start=1
        ):
            if allowed_modes and name not in allowed_modes:
                continue
            a, c = pe_mod.get_item_discrimination(primitive_type, name)
            gap = abs(p_correct(theta, a, cfg.prior_beta, c) - target)
            if best is None or gap < best[0]:
                best = (gap, idx, cfg.prior_beta, name)
        if best is None:
            return 1, 3.5, "default"
        return min(best[1], 6), best[2], best[3]
    return select


def apply_policy(kind: str, target: float | None) -> None:
    # select_best_mode reads the module global too, so the rank-only policy
    # pins it to the original information function.
    def orig_select(theta, primitive_type, allowed_modes=None):
        saved = pe_mod.item_information
        pe_mod.item_information = _orig_info
        try:
            return _orig_select(theta, primitive_type, allowed_modes)
        finally:
            pe_mod.item_information = saved

    if kind == "baseline":
        pe_mod.item_information = _orig_info
        PulseEngine.select_best_mode = staticmethod(_orig_select)
    elif kind == "rank":
        pe_mod.item_information = _make_weighted_info(target)
        PulseEngine.select_best_mode = staticmethod(orig_select)
    elif kind == "mode":
        pe_mod.item_information = _orig_info
        PulseEngine.select_best_mode = staticmethod(_make_targeted_select(target))
    elif kind == "both":
        pe_mod.item_information = _make_weighted_info(target)
        PulseEngine.select_best_mode = staticmethod(_make_targeted_select(target))
    else:
        raise ValueError(kind)


# ── Learning assumption ─────────────────────────────────────────────────────

def make_strategy(profile, seed: int, learning: str, log: List[Dict]):
    strat = tm.get_truth_strategy(profile, seed=seed)
    student = strat.student
    params = student.params

    def answer(item):
        theta = student.theta_for(item.skill_id, item.description)
        prob = p_correct(theta, tm.DEFAULT_DISCRIMINATION_A, item.target_beta)
        weight = params.guess + (1.0 - params.guess - params.slip) * prob
        weight += student.rng.gauss(0.0, params.noise_sd)
        weight = max(0.0, min(1.0, weight))
        mult = {"flat": 1.0, "zone": 4 * prob * (1 - prob), "success": prob}[learning]
        before = student.theta_true[item.skill_id]
        gain = params.learning_rate * max(0.0, params.growth_cap - before) / params.growth_cap
        student.theta_true[item.skill_id] = params.clamp_theta(before + gain * mult)
        student._peak[item.skill_id] = max(student._peak[item.skill_id],
                                           student.theta_true[item.skill_id])
        student.exposures[item.skill_id] += 1
        log.append({"skill": item.skill_id, "true_p": prob, "band": item.band.value,
                    "beta": item.target_beta})
        return round(weight * 10.0, 1)

    student.answer = answer
    return strat


# ── Metrics ─────────────────────────────────────────────────────────────────

def summarize(timeline, strat, log: List[Dict]) -> Dict[str, Any]:
    items = [i for s in timeline.sessions for i in s.items]
    scores = [i.score for i in items]
    pred = []
    for i in items:
        a = i.discrimination_a or tm.DEFAULT_DISCRIMINATION_A
        pred.append(p_correct(i.theta_before, a, i.target_beta))

    max_streak, rough = 0, 0
    for s in timeline.sessions:
        run = 0
        for i in s.items:
            run = run + 1 if i.score < PASS else 0
            max_streak = max(max_streak, run)
        if sum(i.score >= PASS for i in s.items) <= len(s.items) // 3:
            rough += 1

    # Estimator error on skills the engine actually measured
    est: Dict[str, float] = {}
    for i in items:
        est[i.skill_id] = i.theta_after
    truth = strat.student.theta_true
    errs = [abs(est[k] - truth[k]) for k in est if k in truth]

    gains = [truth[k] - strat.student._theta0[k] for k in truth]
    mastered = {i.subskill_id for i in items if i.gate_after >= 4}

    return {
        "items": len(items),
        "success": sum(x >= PASS for x in scores) / max(1, len(scores)),
        "pred_p": st.mean(pred) if pred else 0,
        "true_p": st.mean(l["true_p"] for l in log) if log else 0,
        "max_miss_streak": max_streak,
        "rough_sessions": rough / max(1, len(timeline.sessions)),
        "est_mae": st.mean(errs) if errs else None,
        "learning_total": sum(gains),
        "skills_touched": len(est),
        "subskills_mastered": len(mastered),
        "gate_advances": timeline.total_gate_advances,
        "leapfrogs": timeline.total_leapfrogs,
        "frontier_share": sum(l["band"] == "frontier" for l in log) / max(1, len(log)),
        "per_session_success": [
            sum(i.score >= PASS for i in s.items) / max(1, len(s.items))
            for s in timeline.sessions
        ],
        "per_session_true_p": [],
    }


# ── Driver ──────────────────────────────────────────────────────────────────

async def main_async(args) -> None:
    engine, mem_fs = await build_engine_in_memory(subjects=[args.subject_id], grade=args.grade)
    runner_base = dict(seed=None)

    policies = [("baseline", None)]
    for kind in args.kinds:
        for t in args.targets:
            policies.append((kind, t))

    results: List[Dict[str, Any]] = []
    total = len(policies) * len(args.profiles) * len(args.learning) * args.seeds
    n = 0
    for learning in args.learning:
        for kind, target in policies:
            apply_policy(kind, target)
            for pname in args.profiles:
                for seed in range(args.seeds):
                    n += 1
                    base = ALL_PROFILES[pname]
                    profile = replace(base, subject=args.subject_id)
                    mem_fs.clear_student(profile.student_id)
                    runner = PulseAgentRunner(engine, mem_fs, seed=1000 + seed)
                    log: List[Dict] = []
                    strat = make_strategy(profile, 1000 + seed, learning, log)
                    tl = await runner.run_profile(profile, strategy_override=strat,
                                                  session_limit=args.sessions)
                    row = summarize(tl, strat, log)
                    row.update(policy=kind if target is None else f"{kind}@{target:.2f}",
                               kind=kind, target=target, profile=pname,
                               seed=seed, learning=learning)
                    results.append(row)
                    print(f"[{n}/{total}] {learning:7s} {row['policy']:12s} {pname:18s} s{seed} "
                          f"succ={row['success']:.2f} streak={row['max_miss_streak']} "
                          f"mae={row['est_mae'] or 0:.2f} learn={row['learning_total']:.1f} "
                          f"skills={row['skills_touched']}", flush=True)
    apply_policy("baseline", None)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(results, indent=1, default=str))
    print(f"wrote {out} ({len(results)} runs)")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--subject-id", default="MATHEMATICS_GK")
    p.add_argument("--grade", default="K")
    p.add_argument("--sessions", type=int, default=20)
    p.add_argument("--seeds", type=int, default=3)
    p.add_argument("--profiles", nargs="+",
                   default=["struggling", "steady", "gifted", "fraction_weakness", "accelerating"])
    p.add_argument("--kinds", nargs="+", default=["rank", "mode", "both"])
    p.add_argument("--targets", nargs="+", type=float, default=[0.6, 0.7, 0.8, 0.9])
    p.add_argument("--learning", nargs="+", default=["flat", "zone", "success"])
    p.add_argument("--out", default="./reports/selection_sweep.json")
    asyncio.run(main_async(p.parse_args()))


if __name__ == "__main__":
    main()
