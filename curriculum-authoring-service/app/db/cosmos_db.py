"""
Azure Cosmos DB service for curriculum graph caching
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from azure.cosmos import CosmosClient, PartitionKey
from azure.cosmos.exceptions import CosmosResourceNotFoundError, CosmosResourceExistsError

from app.core.config import settings

logger = logging.getLogger(__name__)


class CurriculumCosmosDB:
    """Cosmos DB service for curriculum graph storage and caching"""

    def __init__(self):
        """Initialize Cosmos DB client and containers"""
        self.client: Optional[CosmosClient] = None
        self.database = None
        self.curriculum_graphs = None

    def initialize(self):
        """Initialize Cosmos DB connection and create containers"""
        try:
            logger.info(f"🔌 Connecting to Cosmos DB at {settings.COSMOS_ENDPOINT}")

            self.client = CosmosClient(
                settings.COSMOS_ENDPOINT,
                settings.COSMOS_KEY
            )

            # Create or get database
            self.database = self.client.create_database_if_not_exists(
                id=settings.COSMOS_DATABASE
            )
            logger.info(f"✅ Connected to database: {settings.COSMOS_DATABASE}")

            # Create curriculum_graphs container
            self.curriculum_graphs = self.database.create_container_if_not_exists(
                id=settings.COSMOS_GRAPH_CONTAINER,
                partition_key=PartitionKey(path="/subject_id"),
                unique_key_policy={
                    'uniqueKeys': [
                        {'paths': ['/subject_id', '/version_id']}
                    ]
                }
            )
            logger.info(f"✅ Container ready: {settings.COSMOS_GRAPH_CONTAINER}")

            return True

        except Exception as e:
            logger.error(f"❌ Failed to initialize Cosmos DB: {e}")
            raise

    # ============================================================================
    # CURRICULUM GRAPH OPERATIONS
    # ============================================================================

    async def create_graph_document(
        self,
        subject_id: str,
        version_id: str,
        version_type: str,
        graph_data: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create or update a curriculum graph document"""
        try:
            doc_id = f"{subject_id}_{version_id}_{version_type}"

            document = {
                "id": doc_id,
                "subject_id": subject_id,
                "version_id": version_id,
                "version_type": version_type,  # "published" or "draft"
                "graph": graph_data,
                "metadata": metadata or {},
                "generated_at": datetime.utcnow().isoformat(),
                "last_accessed": datetime.utcnow().isoformat()
            }

            # Upsert (create or replace)
            result = self.curriculum_graphs.upsert_item(body=document)
            logger.info(f"✅ Saved graph for {subject_id} (version: {version_id}, type: {version_type})")

            return result

        except Exception as e:
            logger.error(f"❌ Failed to save graph document: {e}")
            raise

    async def get_graph_document(
        self,
        subject_id: str,
        version_type: str = "published",
        version_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Retrieve a curriculum graph document"""
        try:
            # If no version_id specified, get the latest for this type
            if not version_id:
                query = """
                SELECT TOP 1 * FROM c
                WHERE c.subject_id = @subject_id
                  AND c.version_type = @version_type
                ORDER BY c.generated_at DESC
                """
                parameters = [
                    {"name": "@subject_id", "value": subject_id},
                    {"name": "@version_type", "value": version_type}
                ]

                results = list(self.curriculum_graphs.query_items(
                    query=query,
                    parameters=parameters,
                    partition_key=subject_id
                ))

                if results:
                    doc = results[0]
                    # Update last accessed time
                    doc["last_accessed"] = datetime.utcnow().isoformat()
                    self.curriculum_graphs.upsert_item(body=doc)
                    logger.info(f"✅ Retrieved graph for {subject_id} (type: {version_type})")
                    return doc
                else:
                    logger.info(f"ℹ️ No graph found for {subject_id} (type: {version_type})")
                    return None
            else:
                # Get specific version
                doc_id = f"{subject_id}_{version_id}_{version_type}"
                doc = self.curriculum_graphs.read_item(
                    item=doc_id,
                    partition_key=subject_id
                )

                # Update last accessed time
                doc["last_accessed"] = datetime.utcnow().isoformat()
                self.curriculum_graphs.upsert_item(body=doc)

                logger.info(f"✅ Retrieved graph for {subject_id} (version: {version_id})")
                return doc

        except CosmosResourceNotFoundError:
            logger.info(f"ℹ️ Graph not found for {subject_id}")
            return None
        except Exception as e:
            logger.error(f"❌ Failed to retrieve graph: {e}")
            raise

    async def delete_graph_documents(
        self,
        subject_id: str,
        version_type: Optional[str] = None
    ) -> int:
        """Delete graph documents for a subject (all or specific version type)"""
        try:
            # Query for documents to delete
            if version_type:
                query = """
                SELECT c.id FROM c
                WHERE c.subject_id = @subject_id
                  AND c.version_type = @version_type
                """
                parameters = [
                    {"name": "@subject_id", "value": subject_id},
                    {"name": "@version_type", "value": version_type}
                ]
            else:
                query = """
                SELECT c.id FROM c
                WHERE c.subject_id = @subject_id
                """
                parameters = [
                    {"name": "@subject_id", "value": subject_id}
                ]

            results = list(self.curriculum_graphs.query_items(
                query=query,
                parameters=parameters,
                partition_key=subject_id
            ))

            # Delete each document
            deleted_count = 0
            for doc in results:
                self.curriculum_graphs.delete_item(
                    item=doc["id"],
                    partition_key=subject_id
                )
                deleted_count += 1

            logger.info(f"✅ Deleted {deleted_count} graph document(s) for {subject_id}")
            return deleted_count

        except Exception as e:
            logger.error(f"❌ Failed to delete graph documents: {e}")
            raise

    async def get_graph_status(
        self,
        subject_id: str
    ) -> Dict[str, Any]:
        """Get cache status information for a subject"""
        try:
            query = """
            SELECT c.version_type, c.version_id, c.generated_at, c.last_accessed, c.metadata
            FROM c
            WHERE c.subject_id = @subject_id
            ORDER BY c.generated_at DESC
            """
            parameters = [
                {"name": "@subject_id", "value": subject_id}
            ]

            results = list(self.curriculum_graphs.query_items(
                query=query,
                parameters=parameters,
                partition_key=subject_id
            ))

            status = {
                "subject_id": subject_id,
                "cached_versions": results,
                "has_published": any(r["version_type"] == "published" for r in results),
                "has_draft": any(r["version_type"] == "draft" for r in results),
                "total_cached": len(results)
            }

            return status

        except Exception as e:
            logger.error(f"❌ Failed to get graph status: {e}")
            raise

    async def list_all_cached_subjects(self) -> List[str]:
        """List all subjects that have cached graphs"""
        try:
            query = "SELECT DISTINCT VALUE c.subject_id FROM c"

            results = list(self.curriculum_graphs.query_items(
                query=query,
                enable_cross_partition_query=True
            ))

            logger.info(f"✅ Found {len(results)} subjects with cached graphs")
            return results

        except Exception as e:
            logger.error(f"❌ Failed to list cached subjects: {e}")
            raise


# Global instance
cosmos_db = CurriculumCosmosDB()
