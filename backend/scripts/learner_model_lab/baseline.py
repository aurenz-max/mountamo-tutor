"""
Today's engine, as far as the lab can hold it constant: the production
per-skill theta update (`CalibrationEngine._update_student_theta`, called
directly, unchanged) and pure-IRT selection (Fisher information x sigma^2,
the Pulse utility). No graph: each SKILL has one theta, as in production.

Not included: Pulse's bands, leapfrog, review scheduling and gate lifecycle.
Those sit on top of these two pieces and are the same for both engines once
the Bayesian model replaces the estimator.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Dict, List

from app.models.calibration import StudentAbility
from app.services.calibration_engine import CalibrationEngine, item_information, p_correct

from .graph import MASTERY_MARGIN, Graph, Item


class BaselineEngine:
    name = "today"

    def __init__(self, g: Graph):
        self.g = g
        self.cal = CalibrationEngine.__new__(CalibrationEngine)  # pure method; no Firestore
        self.ab: Dict[str, StudentAbility] = {}

    def _ability(self, k: int) -> StudentAbility:
        sk = self.g.nodes[k].skill
        if sk not in self.ab:
            self.ab[sk] = StudentAbility(skill_id=sk, student_id=0)
        return self.ab[sk]

    def predict(self, it: Item) -> float:
        a = self._ability(it.node)
        return p_correct(a.theta, it.a, it.beta, it.c)

    def observe(self, it: Item, score: float, n: float = 1.0) -> None:
        a = self._ability(it.node)
        self.ab[a.skill_id] = self.cal._update_student_theta(
            a, it.beta, score / 10.0, datetime.now(timezone.utc),
            self.g.nodes[it.node].primitive, it.mode, score, it.a, it.c, n)

    def mastery(self) -> List[float]:
        out = []
        for k, nd in enumerate(self.g.nodes):
            a = self._ability(k)
            z = (a.theta - (nd.beta_med + MASTERY_MARGIN)) / max(a.sigma, 1e-3)
            out.append(0.5 * (1 + math.erf(z / math.sqrt(2))))
        return out

    def select(self, items: List[Item]) -> Item:
        def util(it: Item) -> float:
            a = self._ability(it.node)
            return item_information(a.theta, it.a, it.beta, it.c) * a.sigma ** 2
        return max(items, key=util)
