from google.cloud import bigquery

client = bigquery.Client()

# Check prerequisites by version_id
query = """
SELECT DISTINCT p.version_id, COUNT(*) as count
FROM `mountamo-tutor-h7wnta.analytics.curriculum_prerequisites` p
GROUP BY p.version_id
ORDER BY count DESC
LIMIT 20
"""

print("Prerequisites by version_id:")
print("-" * 80)
results = client.query(query).result()
for row in results:
    print(f"version_id: {row['version_id']}, count: {row['count']}")

# Check if math version exists in prerequisites
math_version = "208bf195-c257-4112-908f-2e51efe7eba9"
print(f"\n\nChecking for MATHEMATICS version: {math_version}")
print("-" * 80)

query2 = f"""
SELECT COUNT(*) as count
FROM `mountamo-tutor-h7wnta.analytics.curriculum_prerequisites` p
WHERE p.version_id = '{math_version}'
"""

results2 = client.query(query2).result()
for row in results2:
    print(f"Prerequisites with math version: {row['count']}")
