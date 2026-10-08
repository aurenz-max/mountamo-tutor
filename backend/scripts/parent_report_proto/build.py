"""Turn the raw students/1004 export into the parent-report dataset (report.json)."""
import json, ast, collections, datetime as dt, os

D = os.path.join(os.path.dirname(__file__), "data")
J = lambda n: json.load(open(os.path.join(D, n), encoding="utf-8"))
student = J("student.json"); attempts = list(J("attempts.json").values())
life = J("mastery_lifecycle.json"); ability = J("ability.json")
cur = J("curriculum.json"); LK, KU = cur["lookup"], cur["k_units"]
misc = J("misconceptions.json")

def ts(x): return dt.datetime.fromisoformat(str(x).replace("Z", "+00:00"))
def lit(v):
    if isinstance(v, (list, dict)): return v
    try: return ast.literal_eval(v)
    except Exception: return []
def num(v, d=0.0):
    try: return float(v)
    except Exception: return d

TODAY = dt.date(2026, 10, 7)
SUBJ_NAME = {"LANGUAGE_ARTS": "Reading & Language", "MATHEMATICS": "Math", "SCIENCE": "Science", "SOCIAL_STUDIES": "Social Studies"}

# ---- 1. clean attempts: drop machine bursts (>40 attempts on one subskill in one day) ----
by_day_ss = collections.Counter((str(a["timestamp"])[:10], a.get("subskill_id")) for a in attempts)
burst_keys = {k for k, n in by_day_ss.items() if n > 40}
clean = [a for a in attempts if (str(a["timestamp"])[:10], a.get("subskill_id")) not in burst_keys]
dropped = len(attempts) - len(clean)
for a in clean: a["_t"] = ts(a["timestamp"]); a["_s"] = num(a.get("score"))
clean.sort(key=lambda a: a["_t"])

# ---- 2. sessions (gap > 30 min splits) ----
sessions = []
for a in clean:
    if sessions and (a["_t"] - sessions[-1][-1]["_t"]).total_seconds() < 1800: sessions[-1].append(a)
    else: sessions.append([a])
def sess_minutes(s): return max(3, min(90, (s[-1]["_t"] - s[0]["_t"]).total_seconds() / 60 + 2))

# weekly series, last 16 weeks (weeks start Monday)
def wk(d): return d - dt.timedelta(days=d.weekday())
this_wk = wk(TODAY)
weeks = [this_wk - dt.timedelta(weeks=i) for i in range(15, -1, -1)]
W = {w: {"week": w.isoformat(), "minutes": 0, "days": set(), "items": 0, "score_sum": 0, "mastered": 0, "gates": 0} for w in weeks}
for s in sessions:
    w = wk(s[0]["_t"].date())
    if w in W:
        W[w]["minutes"] += sess_minutes(s); W[w]["days"].add(s[0]["_t"].date())
        W[w]["items"] += len(s); W[w]["score_sum"] += sum(a["_s"] for a in s)

# ---- 3. skill state from lifecycle (exact ids; lowercase ids are real G1 skills) ----
def meta(sid):
    m = LK.get(sid) or {}
    return {"desc": m.get("subskill_description") or sid, "skill": m.get("skill_description"), "unit": m.get("unit_title"),
            "subject": m.get("subject_id") or "", "grade": m.get("grade") or "?"}

att_by_ss = collections.defaultdict(list)
for a in clean: att_by_ss[a.get("subskill_id")].append(a)

state = {}
events = []  # gate crossings
for sid, L in life.items():
    gh = sorted(lit(L.get("gate_history")), key=lambda e: str(e.get("timestamp")))
    prev = 0; first_master = None
    for e in gh:
        g = int(num(e.get("gate"), 0))
        if g > prev:
            t = ts(e["timestamp"]).date()
            events.append({"date": t.isoformat(), "sid": sid, "gate": g})
            if g == 4 and not first_master: first_master = t
            prev = g
    at = att_by_ss.get(sid, [])
    state[sid] = {"gate": int(num(L.get("current_gate"))), "retention": L.get("retention_state"),
                  "passes": num(L.get("passes")), "fails": num(L.get("fails")),
                  "pass_rate": num(L.get("subskill_pass_rate"), None) if L.get("subskill_pass_rate") not in (None, "None") else None,
                  "attempts": len(at), "avg": round(sum(a["_s"] for a in at) / len(at) * 10) if at else None,
                  "first_try": None, "mastered_on": first_master.isoformat() if first_master else None,
                  "last": max([a["_t"] for a in at]).date().isoformat() if at else (str(L.get("updated_at"))[:10]),
                  **meta(sid)}
for e in events:
    w = wk(dt.date.fromisoformat(e["date"]))
    if w in W:
        W[w]["gates"] += 1
        if e["gate"] == 4: W[w]["mastered"] += 1

# ---- 4. Kindergarten map, per subject -> unit -> skill ----
k_subjects = []
for subj, units in KU.items():
    S = {"id": subj, "name": SUBJ_NAME.get(subj, subj), "units": [], "total": 0, "mastered": 0, "progress": 0, "started": 0}
    for u in units:
        UU = {"title": u["title"], "skills": [], "total": 0, "mastered": 0, "progress": 0}
        for sk in u["skills"]:
            cells = []
            for sid in sk["subskills"]:
                st = state.get(sid)
                g = st["gate"] if st else -1
                cells.append(g)
                S["total"] += 1; UU["total"] += 1
                if g == 4: S["mastered"] += 1; UU["mastered"] += 1
                elif g >= 1: S["progress"] += 1; UU["progress"] += 1
                elif g == 0: S["started"] += 1
            UU["skills"].append({"desc": sk["desc"], "cells": cells})
        S["units"].append(UU)
    k_subjects.append(S)

# ---- 5. strengths / help ----
kset = {sid for us in KU.values() for u in us for sk in u["skills"] for sid in sk["subskills"]}
def row(sid):
    s = state[sid]; return {"sid": sid, **{k: s[k] for k in ("desc", "skill", "unit", "subject", "grade", "gate", "attempts", "avg", "mastered_on", "last", "fails", "passes", "pass_rate")}}
recent_mastered = sorted([row(s) for s in state if state[s]["mastered_on"]], key=lambda r: r["mastered_on"], reverse=True)
# needs help: started, not mastered, and evidence of struggle
help_rows = []
for sid, s in state.items():
    if s["gate"] >= 4: continue
    struggle = (s["fails"] >= 2 and (s["pass_rate"] or 1) < 0.7) or (s["avg"] is not None and s["attempts"] >= 3 and s["avg"] < 70)
    if struggle: help_rows.append(row(sid))
help_rows.sort(key=lambda r: (-(r["fails"]), r["avg"] or 100))
in_progress = sorted([row(s) for s in state if 1 <= state[s]["gate"] < 4], key=lambda r: r["last"], reverse=True)
early = sorted([row(s) for s in state if state[s]["gate"] == 0 and state[s]["attempts"] > 0], key=lambda r: r["last"], reverse=True)

miscs = []
for k, m in misc.items():
    sid = m.get("subskill_id"); mm = meta(sid) if sid else {}
    miscs.append({"text": m.get("misconception_text"), "status": m.get("status"), "detected": str(m.get("last_detected_at"))[:10],
                  "sid": sid, "desc": mm.get("desc"), "grade": mm.get("grade"), "primitive": m.get("primitive_type"), "confidence": m.get("confidence")})

# ---- 6. interests / engagement ----
SUBJ_KEY = lambda s: str(s).upper().replace(" ", "_").split("_G")[0].replace("READING", "LANGUAGE_ARTS")
subj_minutes = collections.Counter(); prim_count = collections.Counter(); prim_score = collections.defaultdict(list)
for s in sessions:
    m = sess_minutes(s) / len(s)
    for a in s:
        subj_minutes[SUBJ_KEY(a.get("subject"))] += m
        p = a.get("primitive_type")
        if p: prim_count[p] += 1; prim_score[p].append(a["_s"])
grade_mix = collections.Counter()
for a in clean:
    g = (LK.get(a.get("subskill_id")) or {}).get("grade") or "?"
    grade_mix["K" if g in ("Kindergarten", "K") else g] += 1

# ---- 7. evidence quality ----
sig = {k: num(v.get("sigma"), 9) for k, v in ability.items()}

out = {
    "student": {"id": 1004, "grade": "Kindergarten", "interests": student.get("interests", []),
                "first_activity": clean[0]["_t"].date().isoformat(), "last_activity": clean[-1]["_t"].date().isoformat()},
    "totals": {"sessions": len(sessions), "minutes": round(sum(sess_minutes(s) for s in sessions)), "items": len(clean),
               "active_days": len({a["_t"].date() for a in clean}), "dropped_burst": dropped,
               "mastered_ever": sum(1 for s in state.values() if s["gate"] == 4),
               "mastered_30d": sum(1 for r in recent_mastered if r["mastered_on"] >= (TODAY - dt.timedelta(days=30)).isoformat()),
               "items_30d": sum(1 for a in clean if a["_t"].date() >= TODAY - dt.timedelta(days=30)),
               "days_30d": len({a["_t"].date() for a in clean if a["_t"].date() >= TODAY - dt.timedelta(days=30)}),
               "minutes_30d": round(sum(sess_minutes(s) for s in sessions if s[0]["_t"].date() >= TODAY - dt.timedelta(days=30)))},
    "weeks": [{**v, "days": len(v["days"]), "minutes": round(v["minutes"]), "avg": round(v["score_sum"] / v["items"] * 10) if v["items"] else None} for v in W.values()],
    "k_subjects": k_subjects,
    "recent_mastered": recent_mastered[:12],
    "help": help_rows[:10], "in_progress": in_progress[:12], "early": early[:8],
    "misconceptions": miscs,
    "subject_minutes": {k: round(v) for k, v in subj_minutes.most_common()},
    "primitives": [{"id": p, "n": n, "avg": round(sum(prim_score[p]) / n * 10)} for p, n in prim_count.most_common(14)],
    "grade_mix": dict(grade_mix),
}
json.dump(out, open(os.path.join(os.path.dirname(__file__), "report.json"), "w"), indent=1, default=str)
print(json.dumps(out["totals"], indent=1)); print("subjects", [(s["name"], s["mastered"], s["progress"], s["started"], s["total"]) for s in k_subjects])
print("grade mix", out["grade_mix"]); print("subj min", out["subject_minutes"])
print("help", [(r["sid"], r["desc"][:50], r["fails"], r["avg"]) for r in help_rows[:10]])
print("recent mastered", [(r["sid"], r["mastered_on"], r["desc"][:40]) for r in recent_mastered[:8]])
print("in prog", [(r["sid"], r["gate"], r["last"], r["desc"][:40]) for r in in_progress[:8]])
print("weeks", [(w["week"], w["minutes"], w["days"], w["items"], w["avg"], w["gates"], w["mastered"]) for w in out["weeks"]])
print("misc", [(m["text"][:60], m["status"], m["grade"]) for m in miscs])
print("prims", out["primitives"])

# ---- extras + compact payload for the page ----
import re, statistics
def clean(t):
    t = str(t or "").split("\n")[0].replace("**", "").strip()
    t = re.sub(r"^(Students|Student)\s+(\w)", lambda m: m.group(2).upper(), t)
    t = re.sub(r"\s*\(e\.g\..*$", "", t)
    return (t[:110] + "…") if len(t) > 112 else t
for key in ("recent_mastered", "help", "in_progress", "early"):
    for r in out[key]: r["desc"] = clean(r["desc"]); r["skill"] = clean(r["skill"])
for m in out["misconceptions"]: m["desc"] = clean(m["desc"])
for S in out["k_subjects"]:
    for U in S["units"]:
        for sk in U["skills"]: sk["desc"] = clean(sk["desc"])
out["totals"]["median_session"] = round(statistics.median(sess_minutes(s) for s in sessions[-40:]))
out["vehicle_items"] = sum(n for p, n in prim_count.items() if any(w in p for w in ("truck","excav","vehicle","hydraul","construct","crane")))
json.dump(out, open(os.path.join(os.path.dirname(__file__), "report.json"), "w"), default=str)
print("median", out["totals"]["median_session"], "vehicle", out["vehicle_items"])
print([p for p in prim_count if any(w in p for w in ("truck","excav","vehicle","hydraul","construct","dump","crane","train"))])
