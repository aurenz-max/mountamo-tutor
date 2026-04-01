"""
Bulk primitive assignment for SOCIAL_STUDIES (Kindergarten)
Assigns target_primitive and primitive_ids to all 159 subskills.
"""
import json
import time
import urllib.request

BASE = "http://localhost:8001"

def put_subskill(subskill_id, target_primitive, primitive_ids=None):
    """Update a subskill's primitive assignment."""
    if primitive_ids is None:
        primitive_ids = [target_primitive]
    url = f"{BASE}/api/curriculum/subskills/{subskill_id}?subject_id=SOCIAL_STUDIES"
    body = json.dumps({
        "target_primitive": target_primitive,
        "primitive_ids": primitive_ids
    }).encode()
    req = urllib.request.Request(url, data=body, method="PUT",
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e), "subskill_id": subskill_id}

# ============================================================================
# PRIMITIVE MAPPING — every subskill → best primitive + eval modes
# Format: (subskill_id, target_primitive)
# ============================================================================

MAPPINGS = [
    # === SS001: Civics and Government ===
    # SS001-01: Rules and Responsibilities
    ("SS001-01-A", "how-it-works"),          # Sequential routine steps
    ("SS001-01-B", "foundation-explorer"),    # Identify concepts
    ("SS001-01-C", "sorting-station"),        # Sort safe/unsafe behaviors
    ("SS001-01-D", "knowledge-check"),        # Explain rules
    ("SS001-01-E", "foundation-explorer"),    # Identify responsibilities visually
    ("SS001-01-F", "media-player"),           # I-messages demonstration
    ("SS001-01-G", "fact-file"),              # Authority figures profiles
    ("SS001-01-H", "media-player"),           # Conflict resolution role-play
    ("SS001-01-I", "knowledge-check"),        # Actions → consequences scenarios
    ("SS001-01-J", "knowledge-check"),        # Class agreements understanding

    # SS001-02: Citizenship
    ("SS001-02-A", "how-it-works"),           # Step-by-step citizenship behaviors
    ("SS001-02-B", "fact-file"),              # Community helpers profiles
    ("SS001-02-C", "fact-file"),              # American symbols profiles
    ("SS001-02-D", "media-player"),           # Patriotic activities demonstration
    ("SS001-02-E", "knowledge-check"),        # Classroom democracy
    ("SS001-02-F", "media-player"),           # Conflict resolution I-statements
    ("SS001-02-G", "how-it-works"),           # Recycling/conservation process
    ("SS001-02-H", "take-home-activity"),     # Map drawing hands-on
    ("SS001-02-I", "fast-fact"),              # Safety sign recognition drill

    # SS001-03: Government
    ("SS001-03-A", "fact-file"),              # American flag profile
    ("SS001-03-B", "foundation-explorer"),    # Government buildings
    ("SS001-03-C", "fast-fact"),              # Matching helpers to gov roles
    ("SS001-03-D", "comparison-panel"),       # Rules vs laws
    ("SS001-03-E", "knowledge-check"),        # Voting importance
    ("SS001-03-F", "fact-file"),              # Leaders: mayor, governor, president
    ("SS001-03-G", "how-it-works"),           # Government → services → community
    ("SS001-03-H", "concept-card-grid"),      # Participation concepts
    ("SS001-03-I", "how-it-works"),           # Taxes → services flow

    # SS001-04: Community Places and Services
    ("SS001-04-A", "foundation-explorer"),    # Public places identification
    ("SS001-04-B", "fast-fact"),              # Match helpers to workplaces
    ("SS001-04-C", "knowledge-check"),        # Explain how public spaces help
    ("SS001-04-D", "sorting-station"),        # Sort services by category
    ("SS001-04-E", "take-home-activity"),     # Draw map of services
    ("SS001-04-F", "take-home-activity"),     # Build model with blocks
    ("SS001-04-G", "knowledge-check"),        # Community improvements discussion
    ("SS001-04-H", "media-player"),           # Town meeting role-play

    # SS001-05: Problem Solving and Conflict Resolution
    ("SS001-05-A", "foundation-explorer"),    # Identify community problems
    ("SS001-05-B", "fast-fact"),              # Match helpers to problems
    ("SS001-05-C", "sorting-station"),        # Sort tools by helper type
    ("SS001-05-D", "vocabulary-explorer"),    # Conflict resolution vocabulary
    ("SS001-05-E", "media-player"),           # "I feel" statements practice
    ("SS001-05-F", "media-player"),           # Active listening exercise
    ("SS001-05-G", "media-player"),           # Peer mediation scenarios
    ("SS001-05-H", "knowledge-check"),        # Create solutions for problems
    ("SS001-05-I", "take-home-activity"),     # Design visual aids/posters
    ("SS001-05-J", "take-home-activity"),     # Classroom improvement project

    # === SS002: Economics ===
    # SS002-01: Needs and Wants
    ("SS002-01-A", "sorting-station"),        # Sort needs vs wants
    ("SS002-01-B", "comparison-panel"),       # Compare seasonal needs/wants
    ("SS002-01-C", "fast-fact"),              # Match helpers to needs
    ("SS002-01-D", "take-home-activity"),     # Draw spending plan
    ("SS002-01-E", "take-home-activity"),     # Illustrate conservation
    ("SS002-01-F", "media-player"),           # Shopping role-play scenario
    ("SS002-01-G", "comparison-panel"),       # Needs/wants across cultures
    ("SS002-01-H", "sorting-station"),        # Prioritize needs vs wants
    ("SS002-01-I", "how-it-works"),           # Sharing/trading helps communities

    # SS002-02: Goods and Services (NEW)
    ("SS002-02-A", "foundation-explorer"),    # Identify goods from pictures
    ("SS002-02-B", "foundation-explorer"),    # Identify service providers
    ("SS002-02-C", "sorting-station"),        # Sort goods vs services
    ("SS002-02-D", "fast-fact"),              # Match helpers to tools
    ("SS002-02-E", "knowledge-check"),        # Connect services to goods
    ("SS002-02-F", "media-player"),           # Service provider role-play
    ("SS002-02-G", "take-home-activity"),     # Draw money uses
    ("SS002-02-H", "media-player"),           # Classroom marketplace sim

    # SS002-03: Marketplace and Trade
    ("SS002-03-A", "media-player"),           # Making product and trading
    ("SS002-03-B", "sorting-station"),        # Sort producers vs consumers
    ("SS002-03-C", "media-player"),           # Classroom business with money
    ("SS002-03-D", "comparison-panel"),       # Producers need consumers
    ("SS002-03-E", "take-home-activity"),     # Class business plan
    ("SS002-03-F", "media-player"),           # Pay peers with play money
    ("SS002-03-G", "media-player"),           # Purchase goods in store
    ("SS002-03-H", "sorting-station"),        # Sort made vs grown goods
    ("SS002-03-I", "media-player"),           # Farmer market role-play

    # SS002-04: Supply and Demand
    ("SS002-04-A", "media-player"),           # Lemonade stand scarcity
    ("SS002-04-B", "sorting-station"),        # Sort high/low demand
    ("SS002-04-C", "media-player"),           # Market price simulation
    ("SS002-04-D", "take-home-activity"),     # Draw scarcity scenario
    ("SS002-04-E", "knowledge-check"),        # Predict scarcity outcomes
    ("SS002-04-F", "generative-table"),       # Pictograph: weather → demand
    ("SS002-04-G", "take-home-activity"),     # Design ad poster
    ("SS002-04-H", "comparison-panel"),       # Compare prices across stores
    ("SS002-04-I", "media-player"),           # Sale day simulation

    # === SS003: Geography ===
    # SS003-02: Places and Environments
    ("SS003-02-A", "vocabulary-explorer"),    # Directional words
    ("SS003-02-B", "take-home-activity"),     # Create maps with symbols
    ("SS003-02-C", "foundation-explorer"),    # Identify community buildings
    ("SS003-02-D", "fact-file"),              # Landforms profiles
    ("SS003-02-E", "comparison-panel"),       # Urban/suburban/rural
    ("SS003-02-F", "sorting-station"),        # Weather → clothing sorting
    ("SS003-02-G", "timeline-explorer"),      # Seasonal changes over time
    ("SS003-02-H", "concept-card-grid"),      # Natural resource concepts
    ("SS003-02-I", "comparison-panel"),       # Adapting to environments

    # SS003-03: Natural and Human-Made Features
    ("SS003-03-A", "foundation-explorer"),    # Identify natural features
    ("SS003-03-B", "foundation-explorer"),    # Identify human-made features
    ("SS003-03-C", "sorting-station"),        # Sort natural vs human-made
    ("SS003-03-D", "fast-fact"),              # Match resources to products
    ("SS003-03-E", "take-home-activity"),     # Create feature map
    ("SS003-03-F", "knowledge-check"),        # How structures help use nature
    ("SS003-03-G", "take-home-activity"),     # Create neighborhood collage
    ("SS003-03-H", "knowledge-check"),        # Design solution for nature

    # === SS004: History ===
    # SS004-01: Personal History
    ("SS004-01-A", "how-it-works"),           # Time markers in a day
    ("SS004-01-B", "image-comparison"),       # Compare photos from ages
    ("SS004-01-C", "fast-fact"),              # Match family roles
    ("SS004-01-D", "timeline-explorer"),      # Personal timeline 3-4 events
    ("SS004-01-E", "take-home-activity"),     # Draw family tree
    ("SS004-01-F", "image-comparison"),       # Personal growth changes
    ("SS004-01-G", "fact-file"),              # Family traditions profile
    ("SS004-01-H", "comparison-panel"),       # Own life vs parents' childhood
    ("SS004-01-I", "take-home-activity"),     # Memory collection
    ("SS004-01-J", "image-comparison"),       # Environment change over time

    # SS004-02: American History Basics
    ("SS004-02-A", "sorting-station"),        # Sort past vs present objects
    ("SS004-02-B", "fact-file"),              # American symbols profiles
    ("SS004-02-C", "timeline-explorer"),      # Sequence personal events
    ("SS004-02-D", "comparison-panel"),       # Life past vs present
    ("SS004-02-E", "fact-file"),              # National holidays profiles
    ("SS004-02-F", "take-home-activity"),     # Family tree creation
    ("SS004-02-G", "fast-fact"),              # Match figures to achievements
    ("SS004-02-H", "comparison-panel"),       # Schools past vs present
    ("SS004-02-I", "media-player"),           # Historical figure role-play
    ("SS004-02-J", "timeline-explorer"),      # Technology changes timeline

    # SS004-03: Timelines and Sequencing
    ("SS004-03-A", "knowledge-check"),        # Before/after in classroom
    ("SS004-03-B", "timeline-explorer"),      # Sequence story events
    ("SS004-03-C", "how-it-works"),           # Daily picture schedule
    ("SS004-03-D", "timeline-explorer"),      # 3-day timeline
    ("SS004-03-E", "timeline-explorer"),      # Four-seasons timeline
    ("SS004-03-F", "timeline-explorer"),      # Personal timeline 5 events
    ("SS004-03-G", "timeline-explorer"),      # Class timeline with photos
    ("SS004-03-H", "comparison-panel"),       # Personal vs family timeline

    # SS004-04: Past and Present
    ("SS004-04-A", "sorting-station"),        # Sort past/present objects
    ("SS004-04-B", "fast-fact"),              # Match past/present pairs
    ("SS004-04-C", "sorting-station"),        # Sort past/present categories
    ("SS004-04-D", "knowledge-check"),        # Explain past/present differences
    ("SS004-04-E", "image-comparison"),       # Tasks past vs present
    ("SS004-04-F", "comparison-panel"),       # Transportation past vs present
    ("SS004-04-G", "timeline-explorer"),      # Before/after timeline cards
    ("SS004-04-H", "take-home-activity"),     # Build past/present home models

    # SS004-05: Family Traditions and Culture
    ("SS004-05-A", "take-home-activity"),     # Draw family traditions
    ("SS004-05-B", "fast-fact"),              # Match cultural symbols
    ("SS004-05-C", "knowledge-check"),        # Describe cultural photo
    ("SS004-05-D", "take-home-activity"),     # Create cultural symbols
    ("SS004-05-E", "comparison-panel"),       # Compare traditional foods
    ("SS004-05-F", "media-player"),           # Demonstrate cultural practice
    ("SS004-05-G", "knowledge-check"),        # Celebrations → heritage
    ("SS004-05-H", "take-home-activity"),     # Family traditions collage

    # === SS005: Culture and Diversity ===
    # SS005-01: Cultural Awareness
    ("SS005-01-A", "media-player"),           # Cultural diversity stories
    ("SS005-01-B", "vocabulary-explorer"),    # Cultural greetings 3 cultures
    ("SS005-01-C", "sorting-station"),        # Sort cultural items
    ("SS005-01-D", "fact-file"),              # Homes/foods/clothing profiles
    ("SS005-01-E", "take-home-activity"),     # Cultural games/crafts
    ("SS005-01-F", "comparison-panel"),       # Compare celebrations
    ("SS005-01-G", "comparison-panel"),       # Similarities/differences daily life
    ("SS005-01-H", "media-player"),           # Respect for differences stories
    ("SS005-01-I", "take-home-activity"),     # Create cultural artifacts

    # SS005-02: World Cultures
    ("SS005-02-A", "foundation-explorer"),    # Locate continent on map
    ("SS005-02-B", "vocabulary-explorer"),    # Cultural greetings phrases
    ("SS005-02-C", "sorting-station"),        # Match climate to clothing
    ("SS005-02-D", "comparison-panel"),       # Compare transportation globally
    ("SS005-02-E", "fast-fact"),              # Match foods/clothing to countries
    ("SS005-02-F", "take-home-activity"),     # Cultural songs/games/art
    ("SS005-02-G", "comparison-panel"),       # Compare daily routines
    ("SS005-02-H", "knowledge-check"),        # Similarities and differences
]

# ============================================================================
# Execute upgrades
# ============================================================================
def main():
    success = 0
    errors = []

    print(f"Upgrading {len(MAPPINGS)} subskills...")
    print()

    for i, (subskill_id, primitive) in enumerate(MAPPINGS):
        result = put_subskill(subskill_id, primitive)
        if "error" in result:
            errors.append((subskill_id, primitive, result["error"]))
            print(f"[ERROR] {subskill_id}: {primitive} — {result['error']}")
        else:
            success += 1
            if (i + 1) % 20 == 0:
                print(f"  ... {i+1}/{len(MAPPINGS)} done")

        # Small delay to avoid overwhelming the service
        if (i + 1) % 10 == 0:
            time.sleep(0.2)

    print()
    print(f"=== UPGRADE COMPLETE ===")
    print(f"Success: {success}/{len(MAPPINGS)}")
    if errors:
        print(f"Errors: {len(errors)}")
        for sid, prim, err in errors:
            print(f"  {sid}: {prim} — {err}")

    # Summary by primitive
    from collections import Counter
    prim_counts = Counter(p for _, p in MAPPINGS)
    print()
    print("=== PRIMITIVE DISTRIBUTION ===")
    for prim, count in prim_counts.most_common():
        print(f"  {prim}: {count}")

if __name__ == "__main__":
    main()
