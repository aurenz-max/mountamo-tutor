"""
Memory layer: will the child still retrieve a subskill after a gap, and what
does serving it today add to that? (ROADMAP C5; lab prototype
`scripts/learner_model_lab/memory.py`.)

Knowledge (the engine's P(mastered), P(right)) says what the child can do;
memory says how long it stays retrievable. Per practised subskill:

    S   stability in days: the gap at which recall falls to 0.9
    R   retrievability after t days: R = (1 + F t / S) ** D, D = -0.5, F = 19/81
        (power-law forgetting from a gamma mixture of exponential rates, the
        form FSRS fits on large review logs; R(S) = 0.9)

Update, once per subskill per day (the day's first answer; same-day repeats
are retrieved at R ~ 1 and build nothing, as in FSRS). Each day is rated as
FSRS rates a review, from the day's first answer as the child did it: under
half right is "again", passed with misses "hard", all right "good", and all
right on knowledge far above the subskill (the model's P(right) on its typical
item >= EASY_P) "easy". Rating by the typical item alone read a child who went
4/4 on the easier item served as "hard" every day (gifted PTRN001-01-D, 10-16):
    first      S = S_FIRST[rating]             (FSRS-5 defaults, days)
    success    S <- S * (1 + A * BONUS[rating] * (1 - R))
                                            the spacing effect: a review grows
                                            stability more the further recall
                                            had faded (FSRS: x3.5 at R = 0.9,
                                            x1.9 at R = 0.96 for S ~ 3, D = 5;
                                            linear A = 25 matches both); hard
                                            penalty and easy bonus as FSRS-5
    failure    S <- max(S_FIRST["again"], B * S)
Overlearned material (a G1 child at 99.7% on a K skill) is stable for weeks;
a skill scraped through at 60% is not.

Selection value, in one currency: the expected P(mastered and retrievable)
that serving the subskill today adds.

    retain = pm * (R(H; S') - R(gap + H; S))   what a review keeps, H days out
             S' = P(right) * S_success + (1 - P(right)) * S_failure
    learn  = dpm * built                       new learning, by how much of the
             dpm   the engine's expected P(mastered) increase from one item
                   (LAMBDA x the 85%-rule weight x teaching value; see `w85`)
             built the share of the stability after today's practice that
                   today's practice builds, A(1-R) / (1 + A(1-R)); 1 for a
                   first exposure, ~0.5 the day after it, falling toward 0 as
                   daily repeats make the subskill stable (FSRS: a review at
                   R ~ 1 adds little)

Repeating yesterday's subskill is worth less the more stable it already is,
and a faded one is worth reviewing. Massed practice loses on value, not on a
rule: there is no day limit anywhere.

The child's own forgetting (10-16). The FSRS-5 defaults describe an average
learner; a child who forgets twice as fast lapsed four times as often under
them (C11: forgetful 12.3 lapses vs 2.7 with retests). One parameter per child
and subject, a stability multiplier m (R = (1 + F t / (m S)) ** D; m < 1
forgets faster), is fitted from the child's reviews: each direct practice of a
subskill a day or more after the last is a recall test, scored against what
the knowledge model predicted for that item: recalled, the child answers each
challenge at the predicted P(right) p; not recalled, at FORGOT_P. Likelihood of
the day's first answer (share x of n challenges right):
    R p^xn (1-p)^(1-x)n + (1 - R) FORGOT_P^xn (1-FORGOT_P)^(1-x)n
so a miss the knowledge model expected (a skill not yet learned) is not read
as forgetting; scoring "x >= SUCCESS" alone read the struggling child as the
fastest forgetter and the forgetful one as average (10-16). The fit keeps the
log-likelihood over a grid of log m (fixed size, exact). Until there is evidence the defaults hold; with
evidence the estimate is credibility-weighted (Buhlmann):
    log m = Z * log m_hat,  Z = n / (n + K)
n reviews, m_hat the grid maximum, K calibrated on predicting the next review
(`tests/pulse_agent/forgetting_fit.py`).
"""
from __future__ import annotations

import math
from datetime import date
from statistics import NormalDist
from typing import Optional

D, F = -0.5, 19.0 / 81.0
S_FIRST = {"again": 0.4, "hard": 1.2, "good": 3.2, "easy": 15.7}   # FSRS-5 default w0-w3
BONUS = {"hard": 0.23, "good": 1.0, "easy": 2.9}                    # FSRS-5 w15, w16
S0 = S_FIRST["good"]   # a never-practised subskill's first stability, for probe values
A = 25.0        # spacing gain, see the module docstring
B = 0.5         # stability kept after a failed day
HORIZON = 7.0   # days ahead the value is read at
SUCCESS = 0.5   # a day's first answer (first-try share) counts as recalled at or above this
GOOD_P = 0.84   # default typical-item P(right) where none is known
EASY_P = 0.95   # typical-item P(right) at which an all-right day rates "easy"
LOG_M = [round(-2.3 + 0.1 * i, 1) for i in range(47)]   # log stability multiplier grid, m 0.1..10
FORGOT_P = 0.25 # per-challenge P(right) of a child who cannot retrieve the subskill
# Reviews at which the child's own estimate gets half the weight. inf (not
# applied) until knowledge and recall are fitted jointly: with the knowledge
# likelihood alone, a forgetful child's post-gap misses are absorbed as lower
# ability, answers then match predictions at every gap, and the fit reads
# "forgets slower than the defaults" (C12, 10-16: forgetful_hl, half-life 3 days,
# m_hat 6-10), which would cut its reviews further.
K_CRED = math.inf


def retrievability(t_days: float, s: float) -> float:
    return (1.0 + F * max(0.0, t_days) / s) ** D


def new_fit() -> dict:
    return {"ll": [0.0] * len(LOG_M), "n": 0}


def recall_lik(x: float, n: float, p: float) -> tuple:
    """(likelihood if recalled, likelihood if not) of x right of n at P(right) p."""
    p = min(max(p, 1e-4), 1 - 1e-4)
    return (p ** (x * n) * (1 - p) ** ((1 - x) * n),
            FORGOT_P ** (x * n) * (1 - FORGOT_P) ** ((1 - x) * n))


def observe_recall(fit: dict, t: dict, day: Optional[str], x: float, n: float, p: float) -> None:
    """Add one recall test to the child's forgetting fit, in place: a direct
    practice of a subskill with a memory trace, a day or more after the last;
    `x` the first-try share of `n` challenges, `p` the knowledge model's P(right)
    on the item before the answer."""
    gap = gap_days(t.get("mem_day"), day)
    if t.get("S") is None or not gap or gap < 1 or n <= 0:
        return
    l1, l0 = recall_lik(x, n, p)
    s = float(t["S"])
    for i, g in enumerate(LOG_M):
        r = retrievability(gap, s * math.exp(g))
        fit["ll"][i] += math.log(max(r * l1 + (1 - r) * l0, 1e-300))
    fit["n"] += 1


def multiplier(fit: Optional[dict], k: Optional[float] = None) -> float:
    """The child's stability multiplier: 1 (the defaults) without reviews, the
    credibility-weighted grid estimate with them."""
    if not fit or not fit.get("n"):
        return 1.0
    k = K_CRED if k is None else k
    ll = fit["ll"]
    g = LOG_M[max(range(len(ll)), key=ll.__getitem__)]
    z = fit["n"] / (fit["n"] + k)
    return math.exp(z * g)


def gap_days(last: Optional[str], today: Optional[str]) -> Optional[float]:
    if not last or not today:
        return None
    return float((date.fromisoformat(today) - date.fromisoformat(last)).days)


def rating(x: float, pc: float) -> str:
    if x < SUCCESS:
        return "again"
    if x < 1.0:
        return "hard"
    return "easy" if pc >= EASY_P else "good"


def update(t: dict, day: Optional[str], x: float, pc: float = GOOD_P, m: float = 1.0) -> dict:
    """Memory fields of a touched entry `t` after an answer `x` (first-try share)
    on `day`, the model's P(right) on the typical item `pc`. `t` holds the
    previous entry (its `day` is the last practice day). `m` is the child's
    stability multiplier (`multiplier`); S is stored in default units."""
    if not day:
        return {k: t[k] for k in ("S", "mem_day") if k in t}
    if t.get("mem_day") == day:
        return {"S": float(t["S"]), "mem_day": day}
    rt, s = rating(x, pc), t.get("S")
    if s is None:
        return {"S": S_FIRST[rt], "mem_day": day}
    r = retrievability(gap_days(t.get("mem_day"), day) or 0.0, float(s) * m)
    s = (float(s) * (1.0 + A * BONUS[rt] * (1.0 - r)) if rt != "again"
         else max(S_FIRST["again"], B * float(s)))
    return {"S": s, "mem_day": day}


def w85(p: float) -> float:
    """Learning per item at P(right) = p, relative to its peak: Delta * phi(Delta)
    with Delta = Phi^-1(p), maximal at Delta = 1 (p = 0.84) (Wilson et al. 2019,
    "The Eighty Five Percent Rule for optimal learning"). Items far too easy or
    too hard teach little; 0 at or below p = 0.5."""
    nd = NormalDist()
    d = nd.inv_cdf(min(max(p, 1e-4), 1 - 1e-4))
    return max(0.0, d) * nd.pdf(d) / nd.pdf(1.0)


def value(t: Optional[dict], today: Optional[str], pm: float, pc: float, dpm: float, m: float = 1.0) -> dict:
    """{value, retain, learn, R} for serving the subskill today. `t` is the
    touched entry (None: never practised), `dpm` the expected P(mastered)
    increase from one item."""
    s = (t or {}).get("S")
    if s is None:
        return {"value": dpm, "retain": 0.0, "learn": dpm, "R": None}
    s = float(s)
    gap = gap_days(t.get("mem_day"), today) or 0.0
    r_now = retrievability(gap, s * m)
    grow = A * (1.0 - r_now)
    if gap == 0:          # already practised today: a repeat builds no stability
        s_new, built = s, 0.0
    else:
        g_ok = grow * BONUS[rating(1.0, pc)]     # expected pass: all right
        s_new = pc * s * (1.0 + g_ok) + (1.0 - pc) * max(S_FIRST["again"], B * s)
        built = g_ok / (1.0 + g_ok)
    retain = pm * max(0.0, retrievability(HORIZON, s_new * m) - retrievability(gap + HORIZON, s * m))
    learn = dpm * built
    return {"value": retain + learn, "retain": retain, "learn": learn, "R": r_now}
