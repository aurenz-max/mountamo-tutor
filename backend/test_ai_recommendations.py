#!/usr/bin/env python3
# test_ai_recommendations.py - Quick test for AI recommendation system

import asyncio
import json
import logging
import os
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
from app.services.ai_recommendations import AIRecommendationService

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def test_ai_recommendations():
    """Test the AI recommendation service"""
    
    # Load environment
    env_path = backend_dir / ".env"
    load_dotenv(env_path)
    
    # Check required environment variables
    required_vars = ['GEMINI_API_KEY', 'GCP_PROJECT_ID']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {missing_vars}")
        return
    
    # Initialize service
    try:
        project_id = os.getenv('GCP_PROJECT_ID')
        service = AIRecommendationService(project_id=project_id)
        logger.info("AI Recommendation Service initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize service: {e}")
        return
    
    # Test health check first
    logger.info("Testing health check...")
    try:
        health = await service.health_check()
        logger.info(f"Health check result: {health}")
        
        if health.get('status') != 'healthy':
            logger.warning("Service is not healthy, but continuing with test...")
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return
    
    # Test parsimonious daily playlist scenarios
    test_scenarios = [
        {
            "name": "Standard 6-activity daily playlist",
            "params": {
                "student_id": 1004,
                "target_activities": 6
            }
        },
        {
            "name": "Short 4-activity playlist",
            "params": {
                "student_id": 1004,
                "target_activities": 4,
                "daily_theme": "Quick Learning Burst"
            }
        },
        {
            "name": "Extended 8-activity playlist",
            "params": {
                "student_id": 1004,
                "target_activities": 8,
                "daily_theme": "Deep Dive Discovery"
            }
        }
    ]
    
    for scenario in test_scenarios:
        logger.info(f"\n=== Testing: {scenario['name']} ===")
        
        try:
            playlist = await service.generate_daily_playlist(**scenario['params'])
            
            if playlist and playlist.get("activities"):
                activities = playlist["activities"]
                session_plan = playlist.get("session_plan", {})
                
                logger.info(f"✅ Generated playlist with {len(activities)} activities")
                logger.info(f"Theme: {playlist.get('daily_theme', 'N/A')}")
                logger.info(f"Session Focus: {session_plan.get('session_focus', 'N/A')}")
                logger.info(f"Estimated Time: {session_plan.get('estimated_time_minutes', 'N/A')} minutes")
                
                logger.info("Activities:")
                for i, activity in enumerate(activities, 1):
                    activity_type = activity.get('activity_type', 'unknown')
                    subject = activity.get('subject', 'N/A')
                    desc = activity.get('subskill_description', 'N/A')
                    reason = activity.get('reason', 'N/A')
                    time_est = activity.get('estimated_time', 'N/A')
                    
                    logger.info(f"  {i}. [{activity_type.upper()}] {subject}: {desc}")
                    logger.info(f"     Reason: {reason}")
                    logger.info(f"     Time: {time_est} min")
                    
                # Show learning objectives if present
                objectives = playlist.get("learning_objectives", [])
                if objectives:
                    logger.info(f"Learning Objectives: {', '.join(objectives)}")
            else:
                logger.warning("❌ No playlist generated")
                
        except Exception as e:
            logger.error(f"❌ Test failed: {e}")
    
    logger.info("\n=== Testing Complete ===")

async def test_data_summary_only():
    """Test just the optimized data summary phase"""
    
    # Load environment
    env_path = backend_dir / ".env"
    load_dotenv(env_path)
    
    project_id = os.getenv('GCP_PROJECT_ID')
    if not project_id:
        logger.error("GCP_PROJECT_ID not found in environment")
        return
    
    try:
        service = AIRecommendationService(project_id=project_id)
        logger.info("Testing optimized student summary for student 1004...")
        
        # Test data summary
        student_summary = await service._get_student_summary(1004)
        
        if student_summary:
            logger.info("✅ Student summary successful")
            subjects = student_summary.get('subjects', [])
            logger.info(f"Found {len(subjects)} subjects")
            
            for subject_data in subjects:
                subject = subject_data['subject']
                velocity = subject_data.get('velocity_status', 'Unknown')
                velocity_pct = subject_data.get('velocity_percentage', 0)
                available_count = len(subject_data.get('available_subskills', []))
                
                logger.info(f"  {subject}: {velocity} ({velocity_pct}%), {available_count} available subskills")
        else:
            logger.warning("❌ No student summary found")
            
    except Exception as e:
        logger.error(f"❌ Student summary test failed: {e}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Test AI Recommendations')
    parser.add_argument('--data-only', action='store_true', help='Test only data aggregation (no LLM)')
    
    args = parser.parse_args()
    
    if args.data_only:
        asyncio.run(test_data_summary_only())
    else:
        asyncio.run(test_ai_recommendations())