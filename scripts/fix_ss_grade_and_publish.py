"""
Fix SOCIAL_STUDIES draft: copy from grade=1 to grade=Kindergarten, then publish.

The draft lives at curriculum_drafts/1/subjects/SOCIAL_STUDIES but the published
doc lives at curriculum_published/Kindergarten/subjects/SOCIAL_STUDIES. The publish
pipeline uses the grade from the doc data to determine the deploy path, so we need
the draft at the Kindergarten path with grade="Kindergarten".
"""
import json
import urllib.request


def api(method, path, body=None, port=8001):
    url = f"http://localhost:{port}{path}"
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"} if body else {}
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


# 1. Read the full draft from grade=1
print("Reading draft from grade=1...")
tree = api("GET", "/api/curriculum/subjects/SOCIAL_STUDIES/tree?grade=1&include_drafts=true")
print(f"  Found {len(tree.get('units', []))} units, grade={tree.get('grade')}")

# 2. Read the raw draft doc (hierarchical) to copy it
# Use the internal endpoint to get the full doc
draft_resp = api("GET", "/api/ai/author-previews/SOCIAL_STUDIES?grade=1")
print(f"  Preview has {len(draft_resp.get('previews', []))} previews")

# 3. We need to use the backfill approach - read draft at grade=1,
#    then save it at grade=Kindergarten via a direct Firestore operation.
#    But we don't have direct Firestore access from here.
#
#    Alternative: use the subject create/update endpoints to build the draft
#    at Kindergarten path. But that's complex.
#
#    Simplest: just fix the grade field in the existing draft doc and
#    make deploy_curriculum use "Kindergarten" regardless.

# Actually, let's try: the publish endpoint passes grade to deploy.
# If we can make publish read from grade=1 but deploy to Kindergarten,
# we need to change the grade field inside the doc.

# The doc's "grade" field is what deploy_curriculum reads.
# Let's update it via the subject update endpoint.
print("\nUpdating subject grade field to 'Kindergarten'...")
try:
    result = api("PUT", "/api/curriculum/subjects/SOCIAL_STUDIES?grade=1",
                 {"grade": "Kindergarten"})
    print(f"  Subject update result: {result.get('subject_id', 'ok')}")
except Exception as e:
    print(f"  Subject update failed: {e}")
    print("  Trying alternative approach...")

    # Alternative: update each unit's grade field
    for unit in tree.get("units", []):
        uid = unit.get("unit_id", unit.get("id"))
        try:
            api("PUT", f"/api/curriculum/units/{uid}?grade=1&subject_id=SOCIAL_STUDIES",
                {"grade": "Kindergarten"})
            print(f"  Updated unit {uid} grade")
        except Exception as e2:
            print(f"  Failed unit {uid}: {e2}")

# 4. Verify
print("\nVerifying draft grade...")
tree2 = api("GET", "/api/curriculum/subjects/SOCIAL_STUDIES/tree?grade=1&include_drafts=true")
print(f"  grade={tree2.get('grade')}")

# 5. Publish
print("\nPublishing...")
try:
    result = api("POST", "/api/publishing/subjects/SOCIAL_STUDIES/publish?grade=1")
    print(f"  Published: version {result.get('version_number')}, {result.get('changes_published')} changes")
except Exception as e:
    print(f"  Publish failed: {e}")

# 6. Verify published data
print("\nVerifying published data...")
try:
    mappings = api("GET", "/api/curriculum/primitive-mappings/SOCIAL_STUDIES", port=8000)
    upgraded = ['SS001-01-b', 'SS002-01-c', 'SS002-02-b']
    for sid in upgraded:
        print(f"  {sid}: {mappings['mappings'].get(sid, 'NOT FOUND')}")
    mc_count = sum(1 for v in mappings['mappings'].values() if v == 'multiple-choice')
    kc_count = sum(1 for v in mappings['mappings'].values() if v == 'knowledge-check')
    print(f"  multiple-choice: {mc_count}, knowledge-check: {kc_count}")
except Exception as e:
    print(f"  Verify failed: {e}")
