"""
Graph cache management service - orchestrates between BigQuery and Firestore
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime

from app.services.prerequisite_manager import prerequisite_manager
from app.db.firestore_graph_service import firestore_graph_service
from app.models.prerequisites import PrerequisiteGraph

logger = logging.getLogger(__name__)


class GraphCacheManager:
    """Manages curriculum graph caching and retrieval"""

    async def get_graph(
        self,
        subject_id: str,
        include_drafts: bool = False,
        force_refresh: bool = False
    ) -> PrerequisiteGraph:
        """
        Get curriculum graph - returns cached version if available, otherwise generates and caches

        Args:
            subject_id: Subject identifier
            include_drafts: Include draft entities in graph
            force_refresh: Force regeneration even if cached version exists

        Returns:
            PrerequisiteGraph with nodes and edges
        """
        version_type = "draft" if include_drafts else "published"

        # Check cache first (unless forced refresh)
        if not force_refresh:
            cached = await self._get_from_cache(subject_id, version_type)
            if cached:
                logger.info(f"✅ Returning cached graph for {subject_id} ({version_type})")
                return cached

        # Generate and cache new graph
        logger.info(f"🔄 Generating fresh graph for {subject_id} ({version_type})")
        graph = await self._generate_and_cache(subject_id, include_drafts, version_type)

        return graph

    async def _get_from_cache(
        self,
        subject_id: str,
        version_type: str
    ) -> Optional[PrerequisiteGraph]:
        """Retrieve graph from Firestore cache"""
        try:
            doc = await firestore_graph_service.get_graph_document(subject_id, version_type)

            if doc:
                # Convert to PrerequisiteGraph model
                graph_data = doc.get("graph", {})
                graph = PrerequisiteGraph(
                    nodes=graph_data.get("nodes", []),
                    edges=graph_data.get("edges", [])
                )
                logger.info(f"📦 Cache hit for {subject_id} ({version_type})")
                return graph

            logger.info(f"📭 Cache miss for {subject_id} ({version_type})")
            return None

        except Exception as e:
            logger.error(f"❌ Error retrieving from cache: {e}")
            # On cache error, fall back to generating fresh
            return None

    async def _generate_and_cache(
        self,
        subject_id: str,
        include_drafts: bool,
        version_type: str
    ) -> PrerequisiteGraph:
        """Generate graph from BigQuery and cache in Firestore"""
        try:
            # Generate enriched graph from BigQuery
            graph = await prerequisite_manager.build_enriched_graph(
                subject_id,
                include_drafts
            )

            # Calculate metadata
            skill_count = sum(1 for n in graph.nodes if n.get("type") == "skill")
            subskill_count = sum(1 for n in graph.nodes if n.get("type") == "subskill")

            metadata = {
                "entity_counts": {
                    "skills": skill_count,
                    "subskills": subskill_count,
                    "total": len(graph.nodes)
                },
                "edge_count": len(graph.edges),
                "include_drafts": include_drafts
            }

            # Get version_id (use "latest" for now, will be enhanced with proper versioning)
            version_id = f"latest_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

            # Cache in Firestore
            await firestore_graph_service.create_graph_document(
                subject_id=subject_id,
                version_id=version_id,
                version_type=version_type,
                graph_data={
                    "nodes": graph.nodes,
                    "edges": graph.edges
                },
                metadata=metadata
            )

            logger.info(f"✅ Generated and cached graph for {subject_id}")
            return graph

        except Exception as e:
            logger.error(f"❌ Error generating and caching graph: {e}")
            raise

    async def invalidate_cache(
        self,
        subject_id: str,
        version_type: Optional[str] = None
    ) -> int:
        """
        Invalidate cached graphs for a subject

        Args:
            subject_id: Subject identifier
            version_type: Optional - "draft" or "published". If None, invalidates both.

        Returns:
            Number of documents deleted
        """
        try:
            deleted_count = await firestore_graph_service.delete_graph_documents(
                subject_id,
                version_type
            )

            logger.info(f"🗑️ Invalidated {deleted_count} cached graph(s) for {subject_id}")
            return deleted_count

        except Exception as e:
            logger.error(f"❌ Error invalidating cache: {e}")
            raise

    async def regenerate_graph(
        self,
        subject_id: str,
        include_drafts: bool = False
    ) -> PrerequisiteGraph:
        """
        Force regeneration of graph (invalidates cache and rebuilds)

        Args:
            subject_id: Subject identifier
            include_drafts: Include draft entities

        Returns:
            Newly generated PrerequisiteGraph
        """
        version_type = "draft" if include_drafts else "published"

        logger.info(f"🔄 Force regenerating graph for {subject_id} ({version_type})")

        # Invalidate existing cache
        await self.invalidate_cache(subject_id, version_type)

        # Generate and cache new graph
        graph = await self._generate_and_cache(subject_id, include_drafts, version_type)

        return graph

    async def regenerate_all_versions(
        self,
        subject_id: str
    ) -> Dict[str, PrerequisiteGraph]:
        """
        Regenerate both draft and published graphs for a subject

        Useful after publishing changes or major curriculum updates.

        Args:
            subject_id: Subject identifier

        Returns:
            Dictionary with "draft" and "published" keys containing graphs
        """
        logger.info(f"🔄 Regenerating all graph versions for {subject_id}")

        # Invalidate all caches for this subject
        await self.invalidate_cache(subject_id)

        # Generate both versions
        published_graph = await self._generate_and_cache(
            subject_id,
            include_drafts=False,
            version_type="published"
        )

        draft_graph = await self._generate_and_cache(
            subject_id,
            include_drafts=True,
            version_type="draft"
        )

        logger.info(f"✅ Regenerated all graphs for {subject_id}")

        return {
            "published": published_graph,
            "draft": draft_graph
        }

    async def get_cache_status(
        self,
        subject_id: str
    ) -> Dict[str, Any]:
        """
        Get cache status information for a subject

        Returns information about cached versions, timestamps, and metadata
        """
        try:
            status = await firestore_graph_service.get_graph_status(subject_id)
            return status

        except Exception as e:
            logger.error(f"❌ Error getting cache status: {e}")
            raise

    async def list_all_cached_subjects(self) -> list[str]:
        """List all subjects that have cached graphs"""
        try:
            subjects = await firestore_graph_service.list_all_cached_subjects()
            return subjects

        except Exception as e:
            logger.error(f"❌ Error listing cached subjects: {e}")
            raise


# Global instance
graph_cache_manager = GraphCacheManager()
