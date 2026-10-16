"""Common-sense checks on what a simulated child was served, day by day.

The checks judge the TRACE (what was served, what the child answered), never
the engine's internals, so they hold across any selector or learner-model
change. Each one judges a subskill by its own first-try record with an
independent Beta-binomial (Beta(1, 1) prior): it does not share the engine's
model, so it cannot share its mistakes. Each limit comes from a published
finding, cited on the rule.

A record is per subskill AND item difficulty (the served item's beta): 48% on
a beta 4.5 lesson item and 75% on a beta 1.5 Pulse item of the same subskill
are two facts, not one 55% (pooled, they flagged a calibrated model as
overconfident, 10-15). Proven or failing is a claim about that item level.

    proven   P(first-try accuracy >= 0.8 | the subskill's own record) >= 0.95
             (mastery criterion 80%: Bloom 1968; stop at 95% confidence:
             Corbett & Anderson 1995, knowledge tracing). With no misses this
             takes 13 first-try passes in a row.
    failing  P(accuracy < 0.6 | own record) >= 0.95

    python -m tests.pulse_agent.common_sense reports/<run>/G1/loop_*.json
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List

MASTERY, CONFIDENT = 0.8, 0.95
FAILING = 0.6
SPACING_DAYS = 2      # re-serving a proven subskill sooner than this is drill, not review
MASSED_DAYS = 3       # longest run of consecutive days on one subskill
BAND = (0.70, 0.92)   # first-try accuracy band around the 85% rule
FORGET_DAYS = 14      # a proven subskill left this long gets a review
DECIDED_SD = 0.035    # posterior sd of accuracy at which the record has answered the question (~ +/-0.07)
CAL_N, CAL_GAP = 20, 0.15   # model P(right) vs the subskill's last CAL_N Pulse first-try results


def _beta_cdf(x: float, a: int, b: int) -> float:
    """P(p <= x) for p ~ Beta(a, b) with integer a, b (binomial tail identity)."""
    from math import comb
    n = a + b - 1
    return sum(comb(n, j) * x ** j * (1 - x) ** (n - j) for j in range(a, n + 1))


def p_above(x: float, hits: int, misses: int) -> float:
    return 1.0 - _beta_cdf(x, hits + 1, misses + 1)


@dataclass
class Rule:
    name: str
    basis: str
    passed: bool
    value: str
    examples: List[str] = field(default_factory=list)


def _events(d: dict) -> List[dict]:
    """Every served item in order: day, source, subskill, first-try flags, model P(mastered)."""
    out = []
    for day in d["days"]:
        n = day["day_number"]
        for it in day.get("lesson_log") or []:
            out.append({"day": n, "src": "lesson", "sid": it["subskill_id"], "ft": it.get("first_try"),
                        "score": it["score"], "pm": None, "kind": None, "beta": it.get("beta")})
        for it in day["pulse_log"]:
            out.append({"day": n, "src": "pulse", "sid": it["subskill_id"], "ft": it.get("first_try"),
                        "score": it["score"], "pm": it.get("p_mastered"), "kind": it.get("kind"),
                        "beta": it.get("target_beta"),
                        # P(right) on the item served; traces before 10-15 only have the
                        # typical item's (a = 1, beta_k), which differs from a served a = 1.4
                        "p_right": it.get("p_served", it.get("p_right"))})
    return out


def _name(key: tuple) -> str:
    return key[0] if key[1] is None else f"{key[0]}@b{key[1]}"


def check(d: dict) -> List[Rule]:
    ev = _events(d)
    if not any(e["ft"] for e in ev):
        return [Rule("first_try_evidence", "C3", False, "trace has no first-try flags (run with CHALLENGES > 0)")]
    rec: Dict[tuple, List[int]] = {}        # (sid, item beta) -> [hits, misses] so far
    proven_on: Dict[tuple, int] = {}
    last_day: Dict[tuple, int] = {}
    sid_last: Dict[str, int] = {}
    drill, under, over, answered, miscal = [], [], [], [], []
    recent: Dict[tuple, List[bool]] = {}   # (sid, item beta) -> Pulse first-try results
    for e in ev:
        b = round(e["beta"], 1) if e.get("beta") is not None else None
        sid, h_m = (e["sid"], b), rec.setdefault((e["sid"], b), [0, 0])
        proven = sid in proven_on
        if proven and e["day"] - last_day.get(sid, -99) < SPACING_DAYS:
            drill.append(f"day {e['day']} {e['src']} {_name(sid)}")
        a, b = h_m[0] + 1, h_m[1] + 1
        sd = (a * b / ((a + b) ** 2 * (a + b + 1))) ** 0.5
        if not proven and sd < DECIDED_SD and e["day"] - last_day.get(sid, -99) < SPACING_DAYS:
            answered.append(f"day {e['day']} {e['src']} {_name(sid)} after {h_m[0]}/{sum(h_m)} ({h_m[0] / sum(h_m):.0%})")
        rp = recent.get(sid, [])[-CAL_N:]
        if e["src"] == "pulse" and len(rp) >= CAL_N:
            pr = e.get("p_right")
            if pr is not None and abs(pr - sum(rp) / len(rp)) > CAL_GAP:
                miscal.append(f"day {e['day']} {_name(sid)} model P(right) {pr:.2f} vs last {len(rp)} first try {sum(rp) / len(rp):.2f}")
        if proven and e["pm"] is not None and e["pm"] < 0.5:
            under.append(f"day {e['day']} {_name(sid)} model P(mastered) {e['pm']:.2f} after {h_m[0]}/{sum(h_m)}")
        if e["pm"] is not None and e["pm"] >= MASTERY and sum(h_m) >= 4 and 1 - p_above(FAILING, *h_m) >= CONFIDENT:
            over.append(f"day {e['day']} {_name(sid)} model P(mastered) {e['pm']:.2f} with {h_m[0]}/{sum(h_m)} first try")
        ft = e["ft"] or []
        if e["src"] == "pulse":
            recent.setdefault(sid, []).extend(ft)
        h_m[0] += sum(ft)
        h_m[1] += len(ft) - sum(ft)
        if not proven and p_above(MASTERY, *h_m) >= CONFIDENT:
            proven_on[sid] = e["day"]
        last_day[sid] = e["day"]
        sid_last[e["sid"]] = e["day"]

    # consecutive-day runs, overall and while failing that day
    days_of: Dict[str, Dict[int, List[bool]]] = {}
    for e in ev:
        days_of.setdefault(e["sid"], {}).setdefault(e["day"], []).extend(e["ft"] or [])
    massed, failing = (0, ""), (0, "")
    for sid, by_day in days_of.items():
        run = frun = 0
        for n in range(1, len(d["days"]) + 1):
            if n in by_day:
                run += 1
                acc = sum(by_day[n]) / max(1, len(by_day[n]))
                frun = frun + 1 if acc < 0.5 else 0
            else:
                run = frun = 0
            if run > massed[0]:
                massed = (run, sid)
            if frun > failing[0]:
                failing = (frun, sid)

    pulse = [f for e in ev if e["src"] == "pulse" for f in (e["ft"] or [])]
    acc = sum(pulse) / max(1, len(pulse))
    end = len(d["days"])
    proven_sids = {s for s, _ in proven_on}
    # a success on a subskill that contains this one (its harder form, or one it
    # is a step of) retrieves it: adding within 20 reviews adding within 10.
    # Edges come from the trace (`learner_final.contained_in`, the learner graph)
    contained_in = (d.get("learner_final") or {}).get("contained_in") or {}
    ok_day: Dict[str, int] = {}
    for e in ev:
        if e["ft"] and sum(e["ft"]) / len(e["ft"]) >= 0.5:
            ok_day[e["sid"]] = e["day"]
    def last_review(s: str) -> int:
        return max([sid_last[s]] + [ok_day[c] for c in contained_in.get(s, []) if c in ok_day])
    stale = [s for s in proven_sids if end - last_review(s) >= FORGET_DAYS]
    via_harder = sum(1 for s in proven_sids if end - sid_last[s] >= FORGET_DAYS and s not in stale)
    n_items = len(ev)
    return [
        Rule("no_drill_when_proven",
             f"proven = P(acc >= {MASTERY}) >= {CONFIDENT} on its own record (Bloom 1968; Corbett & Anderson 1995); "
             f"re-serving within {SPACING_DAYS} days is massed practice (spacing effect, Cepeda et al. 2006)",
             len(drill) <= 0.05 * n_items, f"{len(drill)} of {n_items} items ({len(drill) / max(1, n_items):.0%}); limit 5%",
             drill[:5]),
        Rule("no_question_already_answered",
             f"the subskill's own record pins first-try accuracy (posterior sd < {DECIDED_SD}) and it was practised "
             f"under {SPACING_DAYS} days ago: another item adds no information and no spaced practice",
             len(answered) <= 0.05 * n_items, f"{len(answered)} of {n_items} items ({len(answered) / max(1, n_items):.0%}); limit 5%",
             answered[:5]),
        Rule("model_calibrated", f"model P(right) on the served item within {CAL_GAP} of the subskill's last {CAL_N} "
             "Pulse first-try results", len(miscal) <= 0.05 * max(1, sum(e["src"] == "pulse" for e in ev)),
             f"{len(miscal)} Pulse items off by more than {CAL_GAP}", miscal[:5]),
        Rule("not_massed", f"spacing effect (Cepeda et al. 2006): one subskill on more than {MASSED_DAYS} days running",
             massed[0] <= MASSED_DAYS, f"longest run {massed[0]} days ({massed[1]}); limit {MASSED_DAYS}"),
        Rule("no_failing_run", "out of reach: first-try accuracy below 50% on consecutive days "
             "(error rate far past the ~15% optimum, Wilson et al. 2019)",
             failing[0] <= MASSED_DAYS, f"longest run {failing[0]} days ({failing[1]}); limit {MASSED_DAYS}"),
        Rule("challenge_band", f"Pulse first-try accuracy in {BAND} around the 85% rule (Wilson et al. 2019)",
             BAND[0] <= acc <= BAND[1], f"{acc:.0%} over {len(pulse)} Pulse challenges"),
        Rule("model_not_underconfident", "the model reads P(mastered) < 0.5 on a subskill its own record has proven",
             len(under) == 0, f"{len(under)} items", under[:5]),
        Rule("model_not_overconfident", "the model reads P(mastered) >= 0.8 on a subskill its own record shows failing",
             len(over) == 0, f"{len(over)} items", over[:5]),
        Rule("proven_gets_review", f"a proven subskill untouched for {FORGET_DAYS}+ days gets a review, itself or a "
             "subskill containing it (forgetting curve; review value ~ P(forgotten), Tabibian et al. 2019)",
             len(stale) == 0 or end < 2 * FORGET_DAYS, f"{len(stale)} of {len(proven_sids)} proven subskills"
             + (f"; {via_harder} reviewed only through a subskill containing them" if via_harder else "")
             + (" (run shorter than 2 x the window: informational)" if end < 2 * FORGET_DAYS else ""), stale[:5]),
    ]


def report(path: str) -> str:
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    rules = check(d)
    lines = [f"### {Path(path).parent.parent.name}/{d['profile_name']} ({len(d['days'])} days)",
             "| check | result | value |", "|---|---|---|"]
    for r in rules:
        lines.append(f"| {r.name} | {'PASS' if r.passed else 'FAIL'} | {r.value} |")
    for r in rules:
        if not r.passed and r.examples:
            lines.append(f"- {r.name}: " + "; ".join(r.examples))
    return "\n".join(lines)


if __name__ == "__main__":
    print("\n\n".join(report(p) for p in sys.argv[1:]))
