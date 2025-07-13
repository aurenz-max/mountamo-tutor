# services/cosmos_analytics_cache.py

import asyncio
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from google.cloud import bigquery
from azure.cosmos.aio import CosmosClient
from azure.cosmos import PartitionKey
import hashlib

logger = logging.getLogger(__name__)

class CosmosAnalyticsCache:
    """High-performance analytics cache using Azure Cosmos DB"""
    
    def __init__(self, 
                 cosmos_endpoint: str,
                 cosmos_key: str,
                 cosmos_database: str = "analytics_cache",
                 cosmos_container: str = "student_metrics",
                 bigquery_project_id: str = None,
                 bigquery_dataset: str = "analytics"):
        
        # Cosmos DB setup
        self.cosmos_client = CosmosClient(cosmos_endpoint, cosmos_key)
        self.database_name = cosmos_database
        self.container_name = cosmos_container
        self.database = None
        self.container = None
        
        # BigQuery setup
        self.bq_project_id = bigquery_project_id
        self.bq_dataset = bigquery_dataset
        self.bq_client = bigquery.Client(project=bigquery_project_id) if bigquery_project_id else None
        
        # Cache TTL settings (in seconds)
        self.cache_ttls = {
            "hierarchical_metrics": 900,   # 15 minutes
            "recommendations": 600,        # 10 minutes
            "timeseries_metrics": 1800,    # 30 minutes
            "student_summary": 300,        # 5 minutes
            "content_packages": 3600       # 1 hour
        }
    
    async def initialize(self) -> bool:
        """Initialize Cosmos DB database and container"""
        try:
            # Create database if it doesn't exist
            self.database = await self.cosmos_client.create_database_if_not_exists(
                id=self.database_name,
                offer_throughput=400  # Start with 400 RU/s, can scale up
            )
            
            # Create container with partition key on student_id for optimal performance
            self.container = await self.database.create_container_if_not_exists(
                id=self.container_name,
                partition_key=PartitionKey(path="/student_id"),
                offer_throughput=400
            )
            
            logger.info("Cosmos DB analytics cache initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize Cosmos DB cache: {e}")
            return False
    
    def _generate_cache_id(self, metric_type: str, student_id: int, **kwargs) -> str:
        """Generate consistent cache document ID"""
        # Sort kwargs for consistent hashing
        sorted_params = sorted(kwargs.items())
        param_str = "&".join(f"{k}={v}" for k, v in sorted_params if v is not None)
        
        # Create hash for long parameter strings
        if len(param_str) > 100:
            param_hash = hashlib.md5(param_str.encode()).hexdigest()[:8]
            return f"{metric_type}_{student_id}_{param_hash}"
        else:
            clean_params = param_str.replace("=", "_").replace("&", "_").replace(":", "_")
            return f"{metric_type}_{student_id}_{clean_params}"
    
    async def get_cached_metrics(self, metric_type: str, student_id: int, **kwargs) -> Optional[Dict]:
        """Get cached metrics from Cosmos DB"""
        try:
            cache_id = self._generate_cache_id(metric_type, student_id, **kwargs)
            
            # Point read - extremely fast in Cosmos DB
            response = await self.container.read_item(
                item=cache_id,
                partition_key=str(student_id)
            )
            
            # Check if cache is still valid
            expires_at = datetime.fromisoformat(response['expires_at'])
            if datetime.utcnow() < expires_at:
                logger.info(f"Cache hit for {metric_type}, student {student_id}")
                return response['data']
            else:
                # Expired - delete it
                await self.container.delete_item(
                    item=cache_id,
                    partition_key=str(student_id)
                )
                logger.info(f"Cache expired for {metric_type}, student {student_id}")
                
        except Exception as e:
            logger.debug(f"Cache miss for {metric_type}, student {student_id}: {e}")
        
        return None
    
    async def set_cached_metrics(self, metric_type: str, student_id: int, data: Any, **kwargs):
        """Store metrics in Cosmos DB cache"""
        try:
            cache_id = self._generate_cache_id(metric_type, student_id, **kwargs)
            ttl_seconds = self.cache_ttls.get(metric_type, 900)
            expires_at = datetime.utcnow() + timedelta(seconds=ttl_seconds)
            
            cache_document = {
                "id": cache_id,
                "student_id": str(student_id),  # Partition key
                "metric_type": metric_type,
                "data": data,
                "created_at": datetime.utcnow().isoformat(),
                "expires_at": expires_at.isoformat(),
                "parameters": kwargs,
                "ttl": ttl_seconds  # Cosmos DB TTL feature
            }
            
            await self.container.create_item(cache_document)
            logger.info(f"Cached {metric_type} for student {student_id}, expires at {expires_at}")
            
        except Exception as e:
            logger.warning(f"Failed to cache {metric_type} for student {student_id}: {e}")

    async def warm_student_cache(self, student_id: int, subject: Optional[str] = None) -> Dict[str, Any]:
        """Warm up all common metrics for a student"""
        logger.info(f"Warming cache for student {student_id}, subject: {subject}")
        
        warm_results = {
            "student_id": student_id,
            "subject": subject,
            "warmed_at": datetime.utcnow().isoformat(),
            "metrics_cached": []
        }
        
        try:
            # 1. Hierarchical metrics (most common query)
            hierarchical = await self.get_hierarchical_metrics(student_id, subject)
            warm_results["metrics_cached"].append("hierarchical_metrics")
            
            # 2. Recommendations
            recommendations = await self.get_recommendations(student_id, subject)
            warm_results["metrics_cached"].append("recommendations")
            
            # 3. Student summary
            summary = await self.get_student_summary(student_id, subject)
            warm_results["metrics_cached"].append("student_summary")
            
            # 4. Recent timeseries (last 30 days)
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=30)
            timeseries = await self.get_timeseries_metrics(
                student_id, subject, 'week', 'subject', start_date, end_date
            )
            warm_results["metrics_cached"].append("timeseries_metrics")
            
            logger.info(f"Successfully warmed {len(warm_results['metrics_cached'])} metrics for student {student_id}")
            
        except Exception as e:
            logger.error(f"Error warming cache for student {student_id}: {e}")
            warm_results["error"] = str(e)
        
        return warm_results

    async def get_hierarchical_metrics(self, student_id: int, subject: Optional[str] = None, 
                                     start_date: Optional[datetime] = None, 
                                     end_date: Optional[datetime] = None) -> Dict:
        """Get hierarchical metrics with Cosmos caching"""
        
        # Check cache first
        cache_params = {
            "subject": subject,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None
        }
        
        cached_result = await self.get_cached_metrics("hierarchical_metrics", student_id, **cache_params)
        if cached_result:
            return cached_result
        
        # Cache miss - query BigQuery
        logger.info(f"Computing hierarchical metrics for student {student_id}")
        result = await self._compute_hierarchical_metrics(student_id, subject, start_date, end_date)
        
        # Cache the result
        await self.set_cached_metrics("hierarchical_metrics", student_id, result, **cache_params)
        
        return result

    async def get_recommendations(self, student_id: int, subject: Optional[str] = None, 
                                limit: int = 5) -> List[Dict]:
        """Get recommendations with Cosmos caching"""
        
        cache_params = {"subject": subject, "limit": limit}
        cached_result = await self.get_cached_metrics("recommendations", student_id, **cache_params)
        if cached_result:
            return cached_result
        
        # Cache miss - compute recommendations
        logger.info(f"Computing recommendations for student {student_id}")
        result = await self._compute_recommendations(student_id, subject, limit)
        
        # Cache the result
        await self.set_cached_metrics("recommendations", student_id, result, **cache_params)
        
        return result

    async def get_student_summary(self, student_id: int, subject: Optional[str] = None) -> Dict:
        """Get high-level student summary with aggressive caching"""
        
        cache_params = {"subject": subject}
        cached_result = await self.get_cached_metrics("student_summary", student_id, **cache_params)
        if cached_result:
            return cached_result
        
        # Cache miss - compute summary
        result = await self._compute_student_summary(student_id, subject)
        
        # Cache with shorter TTL since this might be shown frequently
        await self.set_cached_metrics("student_summary", student_id, result, **cache_params)
        
        return result

    async def get_timeseries_metrics(self, student_id: int, subject: Optional[str] = None,
                                   interval: str = 'month', level: str = 'subject',
                                   start_date: Optional[datetime] = None,
                                   end_date: Optional[datetime] = None) -> List[Dict]:
        """Get timeseries metrics with Cosmos caching"""
        
        cache_params = {
            "subject": subject,
            "interval": interval,
            "level": level,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None
        }
        
        cached_result = await self.get_cached_metrics("timeseries_metrics", student_id, **cache_params)
        if cached_result:
            return cached_result
        
        # Cache miss - compute timeseries
        result = await self._compute_timeseries_metrics(student_id, subject, interval, level, start_date, end_date)
        
        # Cache with longer TTL since timeseries data changes less frequently
        await self.set_cached_metrics("timeseries_metrics", student_id, result, **cache_params)
        
        return result

    async def invalidate_student_cache(self, student_id: int, subject: Optional[str] = None):
        """Invalidate all cached data for a student"""
        try:
            # Query all documents for this student using partition key
            query = "SELECT * FROM c WHERE c.student_id = @student_id"
            parameters = [{"name": "@student_id", "value": str(student_id)}]
            
            if subject:
                query += " AND (c.parameters.subject = @subject OR c.parameters.subject IS NULL)"
                parameters.append({"name": "@subject", "value": subject})
            
            items = []
            async for item in self.container.query_items(
                query=query,
                parameters=parameters,
                partition_key=str(student_id)
            ):
                items.append(item)
            
            # Delete all matching cache entries
            delete_tasks = []
            for item in items:
                delete_tasks.append(
                    self.container.delete_item(
                        item=item['id'],
                        partition_key=str(student_id)
                    )
                )
            
            if delete_tasks:
                await asyncio.gather(*delete_tasks, return_exceptions=True)
                logger.info(f"Invalidated {len(delete_tasks)} cache entries for student {student_id}")
            
        except Exception as e:
            logger.error(f"Error invalidating cache for student {student_id}: {e}")

    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        try:
            # Query cache statistics
            stats_query = """
            SELECT 
                COUNT(1) as total_documents,
                c.metric_type,
                MIN(c.created_at) as oldest_entry,
                MAX(c.created_at) as newest_entry
            FROM c 
            GROUP BY c.metric_type
            """
            
            stats = []
            async for item in self.container.query_items(query=stats_query):
                stats.append(item)
            
            # Overall stats
            total_docs_query = "SELECT VALUE COUNT(1) FROM c"
            total_docs = 0
            async for count in self.container.query_items(query=total_docs_query):
                total_docs = count
                break
            
            return {
                "total_cached_documents": total_docs,
                "metrics_breakdown": stats,
                "cache_ttls": self.cache_ttls,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")
            return {"error": str(e)}

    async def cleanup_expired_cache(self):
        """Manual cleanup of expired cache entries (Cosmos TTL should handle this automatically)"""
        try:
            current_time = datetime.utcnow().isoformat()
            expired_query = f"SELECT * FROM c WHERE c.expires_at < '{current_time}'"
            
            expired_items = []
            async for item in self.container.query_items(query=expired_query):
                expired_items.append(item)
            
            # Delete expired items
            delete_tasks = []
            for item in expired_items:
                delete_tasks.append(
                    self.container.delete_item(
                        item=item['id'],
                        partition_key=item['student_id']
                    )
                )
            
            if delete_tasks:
                await asyncio.gather(*delete_tasks, return_exceptions=True)
                logger.info(f"Cleaned up {len(delete_tasks)} expired cache entries")
            
            return len(delete_tasks)
            
        except Exception as e:
            logger.error(f"Error during cache cleanup: {e}")
            return 0

    # Your existing BigQuery computation methods
    async def _compute_hierarchical_metrics(self, student_id: int, subject: Optional[str], 
                                          start_date: Optional[datetime], end_date: Optional[datetime]) -> Dict:
        """Compute hierarchical metrics from BigQuery"""
        # Your existing BigQuery logic here
        # This is where you'd run your complex BigQuery queries
        pass

    async def _compute_recommendations(self, student_id: int, subject: Optional[str], limit: int) -> List[Dict]:
        """Compute recommendations from BigQuery"""
        # Your existing recommendations logic
        pass

    async def _compute_student_summary(self, student_id: int, subject: Optional[str]) -> Dict:
        """Compute lightweight student summary"""
        # High-level summary metrics
        pass

    async def _compute_timeseries_metrics(self, student_id: int, subject: Optional[str],
                                        interval: str, level: str, 
                                        start_date: Optional[datetime], end_date: Optional[datetime]) -> List[Dict]:
        """Compute timeseries metrics from BigQuery"""
        # Your existing timeseries logic
        pass

    async def close(self):
        """Close Cosmos DB connection"""
        await self.cosmos_client.close()


# Usage in your FastAPI app
from fastapi import FastAPI, BackgroundTasks
import os

app = FastAPI()

# Initialize the service
analytics_cache = CosmosAnalyticsCache(
    cosmos_endpoint=os.getenv("COSMOS_ENDPOINT"),
    cosmos_key=os.getenv("COSMOS_KEY"),
    bigquery_project_id=os.getenv("BIGQUERY_PROJECT_ID")
)

@app.on_event("startup")
async def startup_event():
    await analytics_cache.initialize()

@app.on_event("shutdown") 
async def shutdown_event():
    await analytics_cache.close()

@app.post("/students/{student_id}/warm-cache")
async def warm_student_cache(student_id: int, background_tasks: BackgroundTasks, 
                           subject: Optional[str] = None):
    """Warm cache for a student (call on login)"""
    background_tasks.add_task(analytics_cache.warm_student_cache, student_id, subject)
    return {"message": f"Cache warming initiated for student {student_id}"}

@app.get("/students/{student_id}/metrics")
async def get_student_metrics(student_id: int, subject: Optional[str] = None):
    """Get hierarchical metrics (super fast from Cosmos cache)"""
    return await analytics_cache.get_hierarchical_metrics(student_id, subject)

@app.get("/students/{student_id}/recommendations")
async def get_recommendations(student_id: int, subject: Optional[str] = None):
    """Get recommendations (fast from cache)"""
    return await analytics_cache.get_recommendations(student_id, subject)

@app.post("/students/{student_id}/invalidate-cache")
async def invalidate_cache(student_id: int, subject: Optional[str] = None):
    """Invalidate cache when new data arrives"""
    await analytics_cache.invalidate_student_cache(student_id, subject)
    return {"message": f"Cache invalidated for student {student_id}"}

@app.get("/cache/stats")
async def cache_stats():
    """Get cache performance statistics"""
    return await analytics_cache.get_cache_stats()