"""
Script to clear a specific package from Cosmos DB cache.
This forces regeneration with the latest metadata calculations.

Usage:
    python clear_package_cache.py <subskill_id>

Example:
    python clear_package_cache.py LANGUAGE_ARTS-U1759890612122-ura6j995z-1759890862269-wi7duwcds-1759891079384-1c0fmvdz0
"""

import asyncio
import sys
from azure.cosmos.aio import CosmosClient
from app.core.config import settings

async def clear_package_cache(subskill_id: str):
    """Delete the cached package for a specific subskill"""
    package_id = f"bq_{subskill_id}_active"

    print(f"🗑️  Clearing package: {package_id}")

    async with CosmosClient(settings.COSMOS_URL, credential=settings.COSMOS_KEY) as client:
        database = client.get_database_client(settings.COSMOS_DATABASE_NAME)
        container = database.get_container_client(settings.COSMOS_CONTAINER_NAME)

        try:
            # Cosmos DB requires partition key for deletion
            # The partition key format is: "{subject}-{unit}"
            # We need to query the item first to get its partition key
            query = f"SELECT * FROM c WHERE c.id = @package_id"
            parameters = [{"name": "@package_id", "value": package_id}]

            items = []
            async for item in container.query_items(
                query=query,
                parameters=parameters,
                enable_cross_partition_query=True
            ):
                items.append(item)

            if not items:
                print(f"❌ Package not found: {package_id}")
                return False

            package = items[0]
            partition_key = package.get('partition_key')

            print(f"📦 Found package with partition key: {partition_key}")
            print(f"   Subject: {package.get('subject')}")
            print(f"   Skill: {package.get('skill')}")
            print(f"   Subskill: {package.get('subskill')}")

            # Delete the item
            await container.delete_item(item=package_id, partition_key=partition_key)

            print(f"✅ Package deleted successfully!")
            print(f"   Next request for this subskill will regenerate with new metadata")
            return True

        except Exception as e:
            print(f"❌ Error deleting package: {str(e)}")
            return False

async def main():
    if len(sys.argv) < 2:
        print("❌ Error: Please provide a subskill_id")
        print(f"\nUsage: python {sys.argv[0]} <subskill_id>")
        print(f"\nExample: python {sys.argv[0]} LANGUAGE_ARTS-U1759890612122-ura6j995z-1759890862269-wi7duwcds-1759891079384-1c0fmvdz0")
        sys.exit(1)

    subskill_id = sys.argv[1]
    success = await clear_package_cache(subskill_id)

    if not success:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
