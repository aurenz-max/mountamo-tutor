"""
Graph cache management service — caches curriculum graph data in Firestore
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime

from app.services.edge_manager import edge_manager
from app.db.firestore_graph_service import firestore_graph_service
from app.models.prerequisites import PrerequisiteGraph
from app.models.edges import CurriculumGraph

logger = logging.getLogger(__name__)


class GraphCacheManager:
    """Manages curriculum graph caching and retrieval"""

    async def get_graph(
        self,
        subject_id: str,
        grade: str,
        include_drafts: bool = False,
        force_refresh: bool = False
    ) -> PrerequisiteGraph:
        """
        Get curriculum graph - returns cached version if available, otherwise generates and caches

        Args:
            subject_id: Subject identifier (normalized to UPPER_SNAKE_CASE for Firestore consistency)
            grade: Grade level (e.g. Kindergarten, 1)
            include_drafts: Include draft entities in graph
            force_refresh: Force regeneration even if cached version exists

        Returns:
            PrerequisiteGraph with nodes and edges
        """
        subject_id = subject_id.upper().replace(" ", "_")
        version_type = "draft" if include_drafts else "published"

        if not force_refresh:
            cached = await self._get_from_cache(subject_id, version_type)
            if cached:
                logger.info(f"✅ Returning cached graph for {subject_id} ({version_type})")
                return cached

        logger.info(f"🔄 Generating fresh graph for {subject_id} ({version_type})")
        graph = await self._generate_and_cache(subject_id, grade, include_drafts, version_type)

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
            return None

    async def _generate_and_cache(
        self,
        subject_id: str,
        grade: str,
        include_drafts: bool,
        version_type: str
    ) -> PrerequisiteGraph:
        """Generate graph from edges subcollection and cache in Firestore."""
        try:
            kg_graph: CurriculumGraph = await edge_manager.get_subject_graph(
                subject_id, include_drafts, grade=grade
            )
            graph = PrerequisiteGraph(nodes=kg_graph.nodes, edges=kg_graph.edges)

            skill_count = sum(1 for n in graph.nodes if n.get("type") == "skill")
            subskill_count = sum(1 for n in graph.nodes if n.get("type") == "subskill")

            from collections import Counter
            rel_counts = Counter(e.get("relationship", "prerequisite") for e in graph.edges)

            metadata = {
                "entity_counts": {
                    "skills": skill_count,
                    "subskills": subskill_count,
                    "total": len(graph.nodes)
                },
                "edge_count": len(graph.edges),
                "edge_counts": {
                    "total": len(graph.edges),
                    "prerequisite": rel_counts.get("prerequisite", 0),
                    "builds_on": rel_counts.get("builds_on", 0),
                    "reinforces": rel_counts.get("reinforces", 0),
                    "parallel": rel_counts.get("parallel", 0),
                    "applies": rel_counts.get("applies", 0),
                },
                "include_drafts": include_drafts
            }

            version_id = "latest"

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
        grade: Optional[str] = None,
        version_type: Optional[str] = None
    ) -> int:
        """
        Invalidate cached graphs for a subject

        Args:
            subject_id: Subject identifier
            grade: Grade level (accepted for API consistency, not used in cache key)
            version_type: Optional - "draft" or "published". If None, invalidates both.

        Returns:
            Number of documents deleted
        """
        subject_id = subject_id.upper().replace(" ", "_")
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
        grade: str,
        include_drafts: bool = False
    ) -> PrerequisiteGraph:
        """
        Force regeneration of graph (invalidates cache and rebuilds)

        Args:
            subject_id: Subject identifier
            grade: Grade level
            include_drafts: Include draft entities

        Returns:
            Newly generated PrerequisiteGraph
        """
        subject_id = subject_id.upper().replace(" ", "_")
        version_type = "draft" if include_drafts else "published"

        logger.info(f"🔄 Force regenerating graph for {subject_id} ({version_type})")

        await self.invalidate_cache(subject_id, version_type=version_type)

        graph = await self._generate_and_cache(subject_id, grade, include_drafts, version_type)

        return graph

    async def regenerate_all_versions(
        self,
        subject_id: str,
        grade: str,
    ) -> Dict[str, PrerequisiteGraph]:
        """
        Regenerate both draft and published graphs for a subject.

        Args:
            subject_id: Subject identifier
            grade: Grade level

        Returns:
            Dictionary with "draft" and "published" keys containing graphs
        """
        logger.info(f"🔄 Regenerating all graph versions for {subject_id}")

        await self.invalidate_cache(subject_id)

        published_graph = await self._generate_and_cache(
            subject_id,
            grade,
            include_drafts=False,
            version_type="published"
        )

        draft_graph = await self._generate_and_cache(
            subject_id,
            grade,
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
        subject_id: str,
        grade: Optional[str] = None,
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

    async def list_all_cached_graphs(self) -> list[Dict[str, Any]]:
        """List all cached graph documents with metadata"""
        try:
            graphs = await firestore_graph_service.list_all_graph_documents()
            logger.info(f"📋 Listed {len(graphs)} cached graph documents")
            return graphs

        except Exception as e:
            logger.error(f"❌ Error listing cached graphs: {e}")
            raise

    async def delete_all_cached_graphs(self) -> int:
        """
        Delete ALL cached graphs from Firestore (use with caution!)

        Returns:
            Number of documents deleted
        """
        try:
            deleted_count = await firestore_graph_service.delete_all_graph_documents()
            logger.info(f"🗑️ Deleted all {deleted_count} cached graph documents")
            return deleted_count

        except Exception as e:
            logger.error(f"❌ Error deleting all cached graphs: {e}")
            raise

    async def delete_cached_graphs_by_ids(self, document_ids: list[str]) -> int:
        """
        Delete specific cached graphs by their document IDs

        Args:
            document_ids: List of document IDs to delete (e.g., ["SCIENCE_latest_draft"])

        Returns:
            Number of documents deleted
        """
        try:
            deleted_count = await firestore_graph_service.delete_graph_documents_by_ids(document_ids)
            logger.info(f"🗑️ Deleted {deleted_count} specific cached graph documents")
            return deleted_count

        except Exception as e:
            logger.error(f"❌ Error deleting specific cached graphs: {e}")
            raise


# Global instance
graph_cache_manager = GraphCacheManager()
