"""
Simulated children with prerequisite dependence.

Deliberately NOT the Bayesian model's form, so the comparison is not circular:
  - ability is continuous per subskill (0-10, the production theta scale),
    not binary mastery
  - a weak prerequisite LOWERS the effective ability on its dependents
    (a soft penalty along truth edges Jev scores as a performed step; the
    truth graph has no parent cap, so it is denser than the model's)
  - practice raises ability, scaled by how ready the prerequisites are, so a
    child cannot learn CVC decoding while blending is missing
  - answers are sampled the way tests/pulse_agent/truth_model.py samples them
    (3PL probability -> continuous 0-10 score with guess, slip and noise)

A subskill counts as truly mastered when its effective ability gives an 80%
chance on its median-difficulty item.
"""

from __future__ import annotations

import math
import random
import re
from dataclasses import dataclass
from typing import Dict, List, Optional

from app.services.calibration_engine import p_correct

from .graph import MASTERY_MARGIN, Graph, Item

PENALTY = 0.6        # ability lost per point a prerequisite falls short
STEP_MIN = 0.8       # only edges Jev scores as a performed step carry a penalty
PENALTY_CAP = 4.0
GUESS, SLIP, NOISE = 0.03, 0.05, 0.08

# How one practice item changes true ability (set by run.py --learning):
#   ready    gain x readiness of the prerequisites (default; the selector's own assumption)
#   flat     every item teaches the same amount; prerequisites do not gate learning
#   zone     gain x 4P(1-P): most learning near 50% success
#   success  gain x P: children learn from what they get right
LEARNING = "ready"
TRANSFER = 0.0       # share of practice on an easier form that reaches the harder skill (run.py --transfer)


@dataclass
class Persona:
    name: str
    base: float
    jitter: float = 0.8
    lr: float = 0.12
    cap: float = 8.5
    weak: Optional[str] = None      # regex on the subskill label: these start low
    strong: Optional[str] = None    # regex: these start high
    desc: str = ""


BLEND = r"blend|segment|phoneme"
LETTER = r"letter-sound|letter sound|sounds? introduced|sound for"
DECODE = r"decode|cvc"

PERSONAS: Dict[str, Persona] = {
    "struggling": Persona("struggling", base=2.0, lr=0.06, cap=5.5, desc="Low ability everywhere"),
    "steady": Persona("steady", base=4.3, desc="Middle ability"),
    "gifted": Persona("gifted", base=6.5, lr=0.2, cap=9.2, desc="High ability everywhere"),
    "no_blend": Persona("no_blend", base=4.5, weak=BLEND, desc="B: knows letter sounds, cannot blend"),
    "no_letter_sound": Persona("no_letter_sound", base=4.5, weak=LETTER, desc="C: can blend, weak letter sounds"),
    "no_decode": Persona("no_decode", base=4.5, weak=DECODE, strong=f"{BLEND}|{LETTER}",
                         desc="D: has both prerequisites, cannot decode"),
}

PLACE_VALUE = r"tens|place value|ones"
FACTS = r"fact|fluen|within 10|within 20|make (a )?10"
SUBTRACT = r"subtract|take (from|away|apart)|how many (more|fewer)"

MATH_PERSONAS: Dict[str, Persona] = {
    "struggling": Persona("struggling", base=2.0, lr=0.06, cap=5.5, desc="Low ability everywhere"),
    "steady": Persona("steady", base=4.3, desc="Middle ability"),
    "gifted": Persona("gifted", base=6.5, lr=0.2, cap=9.2, desc="High ability everywhere"),
    "no_place_value": Persona("no_place_value", base=4.5, weak=PLACE_VALUE, desc="Counts and adds small numbers, no tens/ones"),
    "no_facts": Persona("no_facts", base=4.5, weak=FACTS, desc="Understands operations, facts not known"),
    "no_subtract": Persona("no_subtract", base=4.5, weak=SUBTRACT, desc="Adds, cannot take apart or subtract"),
}

PERSONAS_BY_SUBJECT = {"LANGUAGE_ARTS": PERSONAS, "MATHEMATICS": MATH_PERSONAS}


class TruthStudent:
    def __init__(self, g: Graph, persona: Persona, seed: int):
        self.g, self.p = g, persona
        self.rng = random.Random(seed)
        self.order = g.topo(g.truth_parents)
        self.theta: List[float] = []
        for nd in g.nodes:
            t = persona.base + self.rng.gauss(0.0, persona.jitter)
            label = nd.label.lower()
            if persona.strong and re.search(persona.strong, label):
                t = max(t, nd.beta_med + MASTERY_MARGIN + 1.5)
            if persona.weak and re.search(persona.weak, label):
                t = min(t, 0.8 + self.rng.gauss(0.0, 0.3))
            self.theta.append(min(10.0, max(0.0, t)))
        self._eff: Optional[List[float]] = None

    # effective ability after prerequisite penalties, in truth-topological order
    def eff(self) -> List[float]:
        if self._eff is None:
            e = [0.0] * self.g.n
            for k in self.order:
                pen = 0.0
                for p, s in zip(self.g.truth_parents[k], self.g.truth_scores[k]):
                    if self.g.step.get((p, k), 0.0) < STEP_MIN:
                        continue
                    need = self.g.nodes[p].beta_med + MASTERY_MARGIN
                    pen += PENALTY * s * max(0.0, need - e[p])
                e[k] = max(0.0, self.theta[k] - min(PENALTY_CAP, pen))
            self._eff = e
        return self._eff

    def _e_children(self, k: int):
        if not hasattr(self, "_ech"):
            self._ech = {}
        if k not in self._ech:
            self._ech[k] = self.g.easier_children(k, self.g.truth_parents)
        return self._ech[k]

    def mastered(self) -> List[bool]:
        e = self.eff()
        return [e[k] >= nd.beta_med + MASTERY_MARGIN for k, nd in enumerate(self.g.nodes)]

    def prereq_gap(self, k: int) -> bool:
        """True when some truth prerequisite with a strong step score is unmastered."""
        m = self.mastered()
        return any(not m[p] for p in self.g.truth_parents[k] if self.g.step.get((p, k), 0.0) >= STEP_MIN)

    def on_frontier(self, k: int) -> bool:
        """Truly ready to learn: unmastered, every strong-step prerequisite mastered."""
        return (not self.mastered()[k]) and not self.prereq_gap(k)

    def p_right(self, it: Item) -> float:
        return p_correct(self.eff()[it.node], it.a, it.beta, it.c)

    def answer(self, it: Item) -> float:
        prob = self.p_right(it)
        w = GUESS + (1 - GUESS - SLIP) * prob + self.rng.gauss(0.0, NOISE)
        w = max(0.0, min(1.0, w))
        self._practice(it.node, prob)
        return round(w * 10.0, 1)

    def answer_first(self, it: Item, n: int = 4) -> float:
        """A review of n challenges scored the way real first-try data is:
        10 x the fraction right on the first try. Each challenge is practice."""
        right = 0
        for _ in range(n):
            prob = self.p_right(it)
            right += self.rng.random() < prob
            self._practice(it.node, prob)
        return round(10.0 * right / n, 1)

    def _practice(self, k: int, prob: float) -> None:
        e = self.eff()
        ready = 1.0
        for p in self.g.truth_parents[k]:
            if LEARNING != "ready":
                break
            if self.g.step.get((p, k), 0.0) < STEP_MIN:
                continue
            need = self.g.nodes[p].beta_med + MASTERY_MARGIN
            ready *= 1 / (1 + math.exp(-2.0 * (e[p] - need)))
        mult = {"ready": ready, "flat": 1.0, "zone": 4 * prob * (1 - prob), "success": prob}[LEARNING]
        t = self.theta[k]
        self.theta[k] = min(10.0, t + self.p.lr * max(0.0, self.p.cap - t) / self.p.cap * mult)
        if TRANSFER:
            for c, e in self._e_children(k):
                tc = self.theta[c]
                self.theta[c] = min(10.0, tc + TRANSFER * e * self.p.lr * max(0.0, self.p.cap - tc) / self.p.cap * mult)
        self._eff = None
