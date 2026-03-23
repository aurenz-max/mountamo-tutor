"""
Reclassify suggestion pipeline output — post-hoc promotion & gate correction.

Based on manual review of 702 MATHEMATICS suggestions (2026-03-22):
  - 166 builds_on + is_prerequisite=true
  - 22 applies + is_prerequisite=true
  - 1 reinforces + is_prerequisite=true

The LLM over-assigned is_prerequisite on non-prerequisite relationship types.
This script reclassifies without re-running the expensive Gemini pipeline.

Rules:
  Tier 1 (strength * confidence >= 0.76): promote relationship to "prerequisite"
  Tier 2 (0.60 <= combo < 0.76):
    - Same-unit: promote to "prerequisite"
    - Cross-unit: promote if strong domain path, drop gate if weak
  Tier 3 (combo < 0.60): drop is_prerequisite flag

  applies + is_prerequisite: same tier logic, but check for redundant source fan-out

Usage:
  cd curriculum-authoring-service
  python -m scripts.reclassify_suggestions [--dry-run]
"""

import argparse
import logging
import sys
from collections import defaultdict

import google.cloud.firestore as firestore

from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

SUBJECT_ID = "MATHEMATICS"

# Domain mapping for cross-unit analysis
UNIT_DOMAINS = {
    "COUNT": "NumSense",
    "OPS": "NumSense",
    "MEAS": "MeasData",
    "GEOM": "Geometry",
    "PTRN": "Patterns",
    "TIME": "Time",
}

# Cross-unit domain paths that justify prerequisite gating
STRONG_CROSS_DOMAIN_PATHS = {
    ("NumSense", "NumSense"),   # COUNT -> OPS: counting foundations for operations
    ("NumSense", "MeasData"),   # COUNT -> MEAS: counting needed for measurement
    ("NumSense", "Time"),       # COUNT -> TIME: ordering needed for sequencing
    ("MeasData", "NumSense"),   # MEAS -> OPS: categorized counting -> arithmetic
    ("MeasData", "Patterns"),   # MEAS -> PTRN: sorting progressions
    ("MeasData", "Time"),       # MEAS -> TIME: duration -> clock reading
    ("Patterns", "Time"),       # PTRN -> TIME: sequencing -> daily schedules
}

# Weak cross-domain paths — keep as discovery, not gating
WEAK_CROSS_DOMAIN_PATHS = {
    ("Geometry", "MeasData"),   # vocabulary transfer, not blocking
    ("Geometry", "Patterns"),   # shape recognition doesn't gate sorting
    ("Geometry", "Time"),       # no real dependency
    ("NumSense", "Patterns"),   # counting doesn't gate pattern identification
    ("Patterns", "NumSense"),   # patterns don't gate arithmetic
    ("Time", "MeasData"),       # time doesn't gate measurement
}


def get_domain(entity_id: str) -> str:
    prefix = entity_id.split("001")[0]
    return UNIT_DOMAINS.get(prefix, "Unknown")


def get_unit(entity_id: str) -> str:
    return entity_id.split("-")[0]


def classify_suggestion(s: dict) -> dict:
    """Classify a single suggestion and return the update fields (or empty dict if no change)."""
    rel = s.get("relationship", "")
    is_prereq = s.get("is_prerequisite", False)

    # Only reclassify builds_on/applies/reinforces that have is_prerequisite=true
    if rel == "prerequisite" or not is_prereq:
        return {}

    strength = s.get("strength", 0)
    confidence = s.get("confidence", 0)
    combo = strength * confidence

    src_id = s.get("source_entity_id", "")
    tgt_id = s.get("target_entity_id", "")
    src_unit = get_unit(src_id)
    tgt_unit = get_unit(tgt_id)
    same_unit = src_unit == tgt_unit

    src_domain = get_domain(src_id)
    tgt_domain = get_domain(tgt_id)
    domain_path = (src_domain, tgt_domain)

    # --- Tier 1: strong signal → promote to prerequisite ---
    if combo >= 0.76:
        return {
            "relationship": "prerequisite",
            "action": "promote",
            "tier": 1,
            "combo": combo,
        }

    # --- Tier 3: weak signal → drop gate ---
    if combo < 0.60:
        return {
            "is_prerequisite": False,
            "threshold": None,
            "action": "drop_gate",
            "tier": 3,
            "combo": combo,
        }

    # --- Tier 2: moderate signal → depends on context ---

    # Same-unit: developmental progressions within a domain → promote
    if same_unit:
        return {
            "relationship": "prerequisite",
            "action": "promote",
            "tier": 2,
            "reason": "same_unit",
            "combo": combo,
        }

    # Cross-unit: depends on domain path
    if domain_path in STRONG_CROSS_DOMAIN_PATHS and combo >= 0.63:
        return {
            "relationship": "prerequisite",
            "action": "promote",
            "tier": 2,
            "reason": f"strong_path:{src_domain}->{tgt_domain}",
            "combo": combo,
        }

    # Weak domain paths or below threshold → drop gate, keep as discovery
    return {
        "is_prerequisite": False,
        "threshold": None,
        "action": "drop_gate",
        "tier": 2,
        "reason": f"weak_path:{src_domain}->{tgt_domain}" if domain_path in WEAK_CROSS_DOMAIN_PATHS else f"below_threshold:{combo:.2f}",
        "combo": combo,
    }


def check_redundant_sources(promotions: list[dict]) -> set[str]:
    """Find source nodes that fan out to 3+ prerequisite targets.

    For these, keep only the 2 highest-combo targets gated; drop gate on the rest.
    This prevents one bottleneck node from blocking too many downstream skills.
    """
    source_targets = defaultdict(list)
    for p in promotions:
        src = p["source_entity_id"]
        source_targets[src].append(p)

    demote_ids = set()
    for src, targets in source_targets.items():
        if len(targets) <= 2:
            continue
        # Sort by combo descending, keep top 2, demote the rest
        targets.sort(key=lambda x: -x.get("_combo", 0))
        for t in targets[2:]:
            demote_ids.add(t["suggestion_id"])
            logger.info(
                f"  Redundancy cap: {src} -> {t['target_entity_id']} "
                f"(combo={t.get('_combo', 0):.2f}) — demoting to non-gated"
            )

    return demote_ids


def main():
    parser = argparse.ArgumentParser(description="Reclassify suggestion pipeline output")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing to Firestore")
    args = parser.parse_args()

    logger.info(f"{'DRY RUN — ' if args.dry_run else ''}Reclassifying suggestions for {SUBJECT_ID}")

    # Connect to Firestore
    db = firestore.Client(project=settings.GOOGLE_CLOUD_PROJECT)
    coll = db.collection("edge_suggestions").document(SUBJECT_ID).collection("pending")

    # Fetch all pending suggestions
    docs = list(coll.where("status", "==", "pending").stream())
    logger.info(f"Loaded {len(docs)} pending suggestions")

    # Classify each suggestion
    promotions = []  # Will become prerequisite
    gate_drops = []  # Will lose is_prerequisite
    unchanged = []   # No change needed

    for doc in docs:
        data = doc.to_dict()
        data["suggestion_id"] = doc.id
        data["_combo"] = data.get("strength", 0) * data.get("confidence", 0)

        result = classify_suggestion(data)

        if not result:
            unchanged.append(data)
            continue

        data["_classification"] = result

        if result.get("action") == "promote":
            promotions.append(data)
        elif result.get("action") == "drop_gate":
            gate_drops.append(data)

    # Check for redundant source fan-out among promotions
    demote_ids = check_redundant_sources(promotions)
    final_promotions = []
    for p in promotions:
        if p["suggestion_id"] in demote_ids:
            # Demote: keep relationship, drop gate
            p["_classification"] = {
                "is_prerequisite": False,
                "threshold": None,
                "action": "drop_gate",
                "tier": p["_classification"]["tier"],
                "reason": "redundancy_cap",
                "combo": p["_combo"],
            }
            gate_drops.append(p)
        else:
            final_promotions.append(p)

    # Summary
    logger.info("")
    logger.info("=" * 60)
    logger.info("RECLASSIFICATION SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Total pending:     {len(docs)}")
    logger.info(f"Unchanged:         {len(unchanged)} (already correct)")
    logger.info(f"Promoted → prereq: {len(final_promotions)}")
    logger.info(f"Gate dropped:      {len(gate_drops)}")
    logger.info("")

    # Breakdown by tier
    from collections import Counter
    promo_tiers = Counter(p["_classification"]["tier"] for p in final_promotions)
    drop_tiers = Counter(p["_classification"]["tier"] for p in gate_drops)
    logger.info("Promotions by tier:")
    for tier in sorted(promo_tiers):
        logger.info(f"  Tier {tier}: {promo_tiers[tier]}")
    logger.info("Gate drops by tier:")
    for tier in sorted(drop_tiers):
        logger.info(f"  Tier {tier}: {drop_tiers[tier]}")
    logger.info("")

    # Existing + new prerequisite count
    existing_prereqs = sum(
        1 for doc in docs
        if doc.to_dict().get("relationship") == "prerequisite"
    )
    logger.info(f"Existing prerequisite suggestions:  {existing_prereqs}")
    logger.info(f"+ Newly promoted:                  +{len(final_promotions)}")
    logger.info(f"= Total prerequisite suggestions:   {existing_prereqs + len(final_promotions)}")
    logger.info("")

    if args.dry_run:
        logger.info("DRY RUN — no changes written. Remove --dry-run to apply.")

        # Show sample promotions
        logger.info("")
        logger.info("Sample promotions (first 10):")
        for p in final_promotions[:10]:
            c = p["_classification"]
            logger.info(
                f"  T{c['tier']} {p['source_entity_id']} -> {p['target_entity_id']} "
                f"(combo={p['_combo']:.2f}, was={p['relationship']})"
            )
            logger.info(f"    {p.get('source_label', '')[:60]}")
            logger.info(f"    -> {p.get('target_label', '')[:60]}")

        logger.info("")
        logger.info("Sample gate drops (first 10):")
        for g in gate_drops[:10]:
            c = g["_classification"]
            reason = c.get("reason", "")
            logger.info(
                f"  T{c['tier']} {g['source_entity_id']} -> {g['target_entity_id']} "
                f"(combo={g['_combo']:.2f}, reason={reason})"
            )

        return

    # --- Apply changes ---
    batch = db.batch()
    batch_count = 0
    BATCH_LIMIT = 450  # Firestore batch limit is 500, leave headroom

    def flush_batch():
        nonlocal batch, batch_count
        if batch_count > 0:
            batch.commit()
            logger.info(f"  Committed batch of {batch_count} updates")
            batch = db.batch()
            batch_count = 0

    # Apply promotions
    logger.info(f"Promoting {len(final_promotions)} suggestions to prerequisite...")
    for p in final_promotions:
        doc_ref = coll.document(p["suggestion_id"])
        batch.update(doc_ref, {
            "relationship": "prerequisite",
            # is_prerequisite stays true, threshold stays 0.8
        })
        batch_count += 1
        if batch_count >= BATCH_LIMIT:
            flush_batch()

    # Apply gate drops
    logger.info(f"Dropping gate on {len(gate_drops)} suggestions...")
    for g in gate_drops:
        doc_ref = coll.document(g["suggestion_id"])
        batch.update(doc_ref, {
            "is_prerequisite": False,
            "threshold": None,
        })
        batch_count += 1
        if batch_count >= BATCH_LIMIT:
            flush_batch()

    flush_batch()

    logger.info("")
    logger.info("✅ Reclassification complete!")

    # Verify
    final_docs = list(coll.where("status", "==", "pending").stream())
    final_prereq = sum(1 for d in final_docs if d.to_dict().get("relationship") == "prerequisite")
    final_gated = sum(1 for d in final_docs if d.to_dict().get("is_prerequisite"))
    logger.info(f"Verification — relationship=prerequisite: {final_prereq}, is_prerequisite=true: {final_gated}")


if __name__ == "__main__":
    main()
