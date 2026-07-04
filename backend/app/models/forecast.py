# backend/app/models/forecast.py
"""
Forecast models — skill-level forward projection (ForecastService).

The forecast answers "which skills, when" by zipping knowledge-graph order
(frontier in selector/IRT order, successors in prerequisite topology) with
pace-proportional throughput. It is a PROJECTION, not a promise: materialized
once per day at students/{id}/forecasts/{date}, so consecutive docs yield
drift ("Fractions moved +2 weeks since Monday"). The daily session plan
remains the only plan of record.
"""

from typing import List, Optional

from pydantic import BaseModel, Field


class RateBand(BaseModel):
    """Weekly subskill throughput under three scenarios."""
    optimistic:  float
    best:        float
    pessimistic: float


class EtaBand(BaseModel):
    """Projected completion date (ISO) under three scenarios."""
    optimistic:  str
    best:        str
    pessimistic: str


class SubskillEta(BaseModel):
    """One remaining subskill with its projected arrival week."""
    subskill_id: str
    description: str = ""
    skill_id:    str = ""
    unit_title:  str = ""
    eta_week:    str        # ISO date of the projected week's start
    # "selector" = the live IRT brain ranked this today (high confidence);
    # "topology" = prerequisite order only — the selector re-ranks on arrival.
    order_basis: str = "topology"
    reason:      str = ""   # selector's own reason, passed through verbatim


class UnitForecast(BaseModel):
    """A curriculum unit's projected window on the calendar."""
    unit_title:    str
    subskills:     int
    eta_start:     str
    eta_end:       EtaBand
    order_basis:   str = "topology"
    past_year_end: bool = False   # pessimistic scenario misses year end


class ReviewLoad(BaseModel):
    """
    Retest triage (see planner design §3b): due retests split by graph
    position instead of all becoming dedicated blocks. graph_coverage is the
    observed fraction of this subject's subskills that have dependents —
    the structural ceiling on subsumption.
    """
    due_per_week:     float
    subsumed:         float   # active dependent exercises it — free
    riders:           float   # folded into nearby lessons at marginal cost
    dedicated_blocks: float   # orphan leaves — the only real block cost
    graph_coverage:   float


class SubjectForecast(BaseModel):
    subject:                   str
    total_subskills:           int
    remaining_subskills:       int
    allocated_minutes_per_day: float
    weekly_rate:               RateBand
    review_load:               ReviewLoad
    projected_finish:          EtaBand
    units:                     List[UnitForecast] = Field(default_factory=list)
    subskill_etas:             List[SubskillEta] = Field(default_factory=list)


class UnitDrift(BaseModel):
    """How far one unit's best-estimate ETA moved vs the prior forecast."""
    subject:      str
    unit_title:   str
    previous_eta: str
    current_eta:  str
    delta_days:   int   # positive = slipped later


class ForecastDrift(BaseModel):
    compared_to: str                      # date key of the prior forecast doc
    units:       List[UnitDrift] = Field(default_factory=list)


class StudentForecast(BaseModel):
    """One materialized forecast — the doc stored per student per day."""
    student_id:               str
    date:                     str   # YYYY-MM-DD doc key
    generated_at:             str
    # Grade of record the graphs were scoped to (students/{id}.grade_level).
    # None = gradeless student, graphs resolved by the ambiguous scan.
    grade_level:              Optional[str] = None
    policy:                   str = "pace_proportional"
    year_start:               str = ""
    year_end:                 str = ""
    weeks_remaining:          int = 0
    budget_minutes:           int = 75
    # ASSUMED until the block time ledger supplies observed values — named
    # so consumers can tell which they got (null once observed lands).
    assumed_min_per_subskill: Optional[int] = None
    required_minutes_per_day: float = 0.0
    subjects:                 List[SubjectForecast] = Field(default_factory=list)
    # Computed at read time against the most recent prior forecast doc.
    drift:                    Optional[ForecastDrift] = None
    warnings:                 List[str] = Field(default_factory=list)
