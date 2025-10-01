# backend/app/services/parent_portal.py
"""
Parent Portal Service
Orchestrates data from multiple sources to provide parent-facing views
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import uuid

from ..models.parent_portal import (
    ParentAccount, ParentStudentLink, ParentDashboard,
    TodaysPlanSummary, WeeklySummaryMetrics, KeyInsight,
    WaysToHelpResponse, ReadyLearningItem, WeeklyExplorerResponse
)
from ..db.cosmos_db import CosmosDBService
from .bigquery_analytics import BigQueryAnalyticsService
from .ai_recommendations import AIRecommendationService
from .daily_activities import DailyActivitiesService
from ..core.config import settings

logger = logging.getLogger(__name__)


class ParentPortalService:
    """Service for parent portal functionality"""

    def __init__(
        self,
        cosmos_db: CosmosDBService,
        analytics_service: BigQueryAnalyticsService,
        ai_service: AIRecommendationService,
        daily_activities_service: DailyActivitiesService
    ):
        self.cosmos_db = cosmos_db
        self.analytics_service = analytics_service
        self.ai_service = ai_service
        self.daily_activities_service = daily_activities_service
        logger.info("ParentPortalService initialized")

    # ============================================================================
    # PARENT ACCOUNT MANAGEMENT
    # ============================================================================

    async def create_parent_account(
        self,
        parent_uid: str,
        email: str,
        display_name: Optional[str] = None
    ) -> ParentAccount:
        """Create a new parent account"""
        try:
            parent_account = ParentAccount(
                parent_uid=parent_uid,
                email=email,
                display_name=display_name,
                linked_student_ids=[],
                created_at=datetime.utcnow()
            )

            # Convert to dict with datetime serialization
            account_data = parent_account.dict()
            # Convert datetime objects to ISO strings
            if isinstance(account_data.get('created_at'), datetime):
                account_data['created_at'] = account_data['created_at'].isoformat()
            if account_data.get('last_login') and isinstance(account_data['last_login'], datetime):
                account_data['last_login'] = account_data['last_login'].isoformat()

            # Store in Cosmos DB
            await self.cosmos_db.upsert_parent_account(account_data)

            logger.info(f"✅ Created parent account: {parent_uid} ({email})")
            return parent_account

        except Exception as e:
            logger.error(f"❌ Failed to create parent account {parent_uid}: {e}")
            raise

    async def get_parent_account(self, parent_uid: str) -> Optional[ParentAccount]:
        """Get parent account by Firebase UID"""
        try:
            account_data = await self.cosmos_db.get_parent_account(parent_uid)
            if account_data:
                return ParentAccount(**account_data)
            return None
        except Exception as e:
            logger.error(f"❌ Failed to get parent account {parent_uid}: {e}")
            return None

    async def link_student_to_parent(
        self,
        parent_uid: str,
        student_id: int,
        relationship: str = "parent"
    ) -> ParentStudentLink:
        """Link a student to a parent account"""
        try:
            link = ParentStudentLink(
                link_id=str(uuid.uuid4()),
                parent_uid=parent_uid,
                student_id=student_id,
                relationship=relationship,
                access_level="full",
                created_at=datetime.utcnow(),
                verified=True  # Auto-verify for now; can add verification flow later
            )

            # Convert to dict with datetime serialization
            link_data = link.dict()
            if isinstance(link_data.get('created_at'), datetime):
                link_data['created_at'] = link_data['created_at'].isoformat()

            # Store link in Cosmos DB
            await self.cosmos_db.create_parent_student_link(link_data)

            # Update parent account with linked student
            parent_account = await self.get_parent_account(parent_uid)
            if parent_account:
                if student_id not in parent_account.linked_student_ids:
                    parent_account.linked_student_ids.append(student_id)

                    # Serialize parent account data
                    account_data = parent_account.dict()
                    if isinstance(account_data.get('created_at'), datetime):
                        account_data['created_at'] = account_data['created_at'].isoformat()
                    if account_data.get('last_login') and isinstance(account_data['last_login'], datetime):
                        account_data['last_login'] = account_data['last_login'].isoformat()

                    await self.cosmos_db.upsert_parent_account(account_data)

            logger.info(f"✅ Linked student {student_id} to parent {parent_uid}")
            return link

        except Exception as e:
            logger.error(f"❌ Failed to link student {student_id} to parent {parent_uid}: {e}")
            raise

    async def verify_parent_access(self, parent_uid: str, student_id: int) -> bool:
        """Verify that a parent has access to a student's data"""
        try:
            links = await self.cosmos_db.get_parent_student_links(parent_uid)
            for link in links:
                if link.get('student_id') == student_id and link.get('verified', False):
                    return True
            return False
        except Exception as e:
            logger.error(f"❌ Failed to verify parent access: {e}")
            return False

    async def complete_onboarding(
        self,
        parent_uid: str,
        notification_preferences: Optional[Dict[str, bool]] = None
    ) -> ParentAccount:
        """Complete parent onboarding and update preferences"""
        try:
            # Get existing account
            parent_account = await self.get_parent_account(parent_uid)
            if not parent_account:
                raise ValueError(f"Parent account not found for {parent_uid}")

            # Update onboarding status
            parent_account.onboarding_completed = True

            # Update notification preferences if provided
            if notification_preferences:
                parent_account.notification_preferences.update(notification_preferences)

            # Serialize and save to Cosmos DB
            account_data = parent_account.dict()
            if isinstance(account_data.get('created_at'), datetime):
                account_data['created_at'] = account_data['created_at'].isoformat()
            if account_data.get('last_login') and isinstance(account_data['last_login'], datetime):
                account_data['last_login'] = account_data['last_login'].isoformat()

            await self.cosmos_db.upsert_parent_account(account_data)

            logger.info(f"✅ Completed onboarding for parent {parent_uid}")
            return parent_account

        except Exception as e:
            logger.error(f"❌ Failed to complete onboarding for {parent_uid}: {e}")
            raise

    async def update_notification_preferences(
        self,
        parent_uid: str,
        preferences: Dict[str, bool]
    ) -> ParentAccount:
        """Update notification preferences for a parent"""
        try:
            parent_account = await self.get_parent_account(parent_uid)
            if not parent_account:
                raise ValueError(f"Parent account not found for {parent_uid}")

            # Update preferences
            parent_account.notification_preferences.update(preferences)

            # Serialize and save
            account_data = parent_account.dict()
            if isinstance(account_data.get('created_at'), datetime):
                account_data['created_at'] = account_data['created_at'].isoformat()
            if account_data.get('last_login') and isinstance(account_data['last_login'], datetime):
                account_data['last_login'] = account_data['last_login'].isoformat()

            await self.cosmos_db.upsert_parent_account(account_data)

            logger.info(f"✅ Updated notification preferences for parent {parent_uid}")
            return parent_account

        except Exception as e:
            logger.error(f"❌ Failed to update notification preferences: {e}")
            raise

    # ============================================================================
    # DASHBOARD GENERATION (Phase 1)
    # ============================================================================

    async def get_parent_dashboard(
        self,
        parent_uid: str,
        student_id: int
    ) -> ParentDashboard:
        """Generate complete parent dashboard for a student"""
        try:
            logger.info(f"📊 Generating parent dashboard for student {student_id}")

            # Verify parent has access
            has_access = await self.verify_parent_access(parent_uid, student_id)
            if not has_access:
                raise PermissionError(f"Parent {parent_uid} does not have access to student {student_id}")

            # Get student name (from user profiles or default)
            student_name = f"Student {student_id}"  # TODO: Fetch from user profiles service

            # Fetch all dashboard components in parallel
            todays_plan = await self._get_todays_plan_summary(student_id)
            weekly_summary = await self._get_weekly_summary(student_id)
            key_insights = await self._get_key_insights(student_id)

            dashboard = ParentDashboard(
                student_id=student_id,
                student_name=student_name,
                todays_plan=todays_plan,
                weekly_summary=weekly_summary,
                key_insights=key_insights
            )

            logger.info(f"✅ Generated parent dashboard for student {student_id}")
            return dashboard

        except Exception as e:
            logger.error(f"❌ Failed to generate parent dashboard: {e}")
            raise

    async def _get_todays_plan_summary(self, student_id: int) -> TodaysPlanSummary:
        """Get today's plan summary in parent-friendly format"""
        try:
            # Get today's daily plan
            today_str = datetime.utcnow().strftime("%Y-%m-%d")
            daily_plan = await self.daily_activities_service.get_or_generate_daily_plan(
                student_id,
                date=today_str,
                force_refresh=False
            )

            # Extract subjects covered
            subjects_covered = []
            for activity in daily_plan.activities:
                if activity.curriculum_metadata:
                    subject = activity.curriculum_metadata.subject
                    if subject and subject not in subjects_covered:
                        subjects_covered.append(subject)

            # Count completed activities
            completed_activities = sum(
                1 for activity in daily_plan.activities
                if activity.metadata.get('is_complete', False)
            )

            # Estimate total time
            estimated_total_time = sum(
                int(activity.estimated_time.split()[0])
                for activity in daily_plan.activities
                if activity.estimated_time and activity.estimated_time.split()[0].isdigit()
            )

            # Create simplified activity previews
            activities_preview = [
                {
                    'title': activity.title,
                    'type': activity.type,
                    'subject': activity.curriculum_metadata.subject if activity.curriculum_metadata else 'General',
                    'estimated_time': activity.estimated_time,
                    'is_complete': activity.metadata.get('is_complete', False)
                }
                for activity in daily_plan.activities[:5]  # Show first 5
            ]

            return TodaysPlanSummary(
                date=today_str,
                total_activities=len(daily_plan.activities),
                completed_activities=completed_activities,
                estimated_total_time=estimated_total_time,
                subjects_covered=subjects_covered,
                activities_preview=activities_preview
            )

        except Exception as e:
            logger.error(f"❌ Failed to get today's plan summary: {e}")
            # Return empty summary on error
            return TodaysPlanSummary(
                date=datetime.utcnow().strftime("%Y-%m-%d"),
                total_activities=0,
                completed_activities=0,
                estimated_total_time=0,
                subjects_covered=[],
                activities_preview=[]
            )

    async def _get_weekly_summary(self, student_id: int) -> WeeklySummaryMetrics:
        """Get 7-day summary metrics for parent dashboard"""
        try:
            # Get date range for past 7 days
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=7)

            # Fetch hierarchical metrics from BigQuery
            metrics = await self.analytics_service.get_hierarchical_metrics(
                student_id=student_id,
                subject=None,
                start_date=start_date,
                end_date=end_date
            )

            summary = metrics.get('summary', {})
            hierarchical_data = metrics.get('hierarchical_data', [])

            # Calculate subjects progress
            subjects_progress = []
            top_skill = None
            max_progress = 0

            for unit in hierarchical_data:
                subject = unit.get('unit_title', 'Unknown')
                mastery = unit.get('mastery', 0.0)
                completion = unit.get('completion', 0.0)

                subjects_progress.append({
                    'subject': subject,
                    'mastery': mastery,
                    'completion': completion,
                    'attempted_skills': unit.get('attempted_skills', 0),
                    'total_skills': unit.get('total_skills', 0)
                })

                # Track top skill
                if completion > max_progress:
                    max_progress = completion
                    top_skill = subject

            # Get streak from user profile (TODO: integrate with user_profiles service)
            streak_days = 0  # Placeholder

            return WeeklySummaryMetrics(
                week_start_date=start_date.strftime("%Y-%m-%d"),
                week_end_date=end_date.strftime("%Y-%m-%d"),
                total_time_spent_minutes=0,  # TODO: Calculate from activity logs
                problems_completed=summary.get('attempt_count', 0),
                average_mastery=summary.get('mastery', 0.0),
                subjects_progress=subjects_progress,
                streak_days=streak_days,
                top_skill=top_skill
            )

        except Exception as e:
            logger.error(f"❌ Failed to get weekly summary: {e}")
            # Return empty summary on error
            return WeeklySummaryMetrics(
                week_start_date=(datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d"),
                week_end_date=datetime.utcnow().strftime("%Y-%m-%d"),
                total_time_spent_minutes=0,
                problems_completed=0,
                average_mastery=0.0,
                subjects_progress=[],
                streak_days=0,
                top_skill=None
            )

    async def _get_key_insights(self, student_id: int) -> List[KeyInsight]:
        """Generate key insights from AI recommendations and analytics"""
        try:
            insights = []

            # Get AI recommendations
            ai_recommendations = await self.ai_service.get_ai_recommendations(
                student_id=student_id,
                target_count=5,
                session_type='daily'
            )

            if ai_recommendations:
                # Get top recommendation
                top_rec = ai_recommendations[0]
                insights.append(KeyInsight(
                    insight_type='recommendation',
                    priority='high',
                    title=f"Focus on {top_rec.get('subject', 'Learning')}",
                    message=self._translate_to_parent_language(top_rec.get('reason', '')),
                    subject=top_rec.get('subject'),
                    action_items=[
                        f"Encourage practice in {top_rec.get('subskill_description', 'this area')}",
                        f"Estimated time: {top_rec.get('estimated_time', 20)} minutes"
                    ]
                ))

            # Get velocity metrics for progress insights
            velocity_metrics = await self.analytics_service.get_velocity_metrics(student_id)

            for metric in velocity_metrics:
                velocity_status = metric.get('velocity_status', 'on_pace')
                subject = metric.get('subject', 'Learning')

                if velocity_status == 'ahead':
                    insights.append(KeyInsight(
                        insight_type='progress',
                        priority='medium',
                        title=f"Great progress in {subject}!",
                        message=f"Your child is ahead of pace in {subject}. They're doing excellent work!",
                        subject=subject,
                        action_items=[
                            "Celebrate their progress",
                            "Consider introducing more challenging topics"
                        ]
                    ))
                elif velocity_status == 'behind':
                    insights.append(KeyInsight(
                        insight_type='struggle',
                        priority='high',
                        title=f"{subject} needs attention",
                        message=f"Your child could use some extra support in {subject}.",
                        subject=subject,
                        action_items=[
                            f"Spend 15-20 extra minutes on {subject} this week",
                            "Check the 'Ways to Help' section for activity ideas"
                        ]
                    ))

            # Limit to top 5 insights
            return insights[:5]

        except Exception as e:
            logger.error(f"❌ Failed to generate key insights: {e}")
            return []

    def _translate_to_parent_language(self, ai_reason: str) -> str:
        """Translate technical AI reasoning into parent-friendly language"""
        # Simple translation for now; can be enhanced with LLM if needed
        parent_friendly = ai_reason.replace("subskill", "topic")
        parent_friendly = parent_friendly.replace("mastery", "understanding")
        parent_friendly = parent_friendly.replace("velocity", "pace")
        return parent_friendly

    # ============================================================================
    # WEEKLY EXPLORER (Phase 3)
    # ============================================================================

    async def get_weekly_explorer(
        self,
        parent_uid: str,
        student_id: int
    ) -> WeeklyExplorerResponse:
        """Get Weekly Explorer view with ready items and suggested projects"""
        try:
            logger.info(f"🔍 Generating Weekly Explorer for student {student_id}")

            # Verify parent access
            has_access = await self.verify_parent_access(parent_uid, student_id)
            if not has_access:
                raise PermissionError(f"Parent {parent_uid} does not have access to student {student_id}")

            # Get ready learning items from analytics
            ready_items = await self._get_ready_learning_items(student_id)

            # Get suggested projects (Phase 3 - will implement later)
            suggested_projects = []  # TODO: Fetch from explorer projects service

            week_start = datetime.utcnow().strftime("%Y-%m-%d")

            return WeeklyExplorerResponse(
                student_id=student_id,
                week_start_date=week_start,
                ready_items=ready_items,
                suggested_projects=suggested_projects
            )

        except Exception as e:
            logger.error(f"❌ Failed to generate Weekly Explorer: {e}")
            raise

    async def _get_ready_learning_items(self, student_id: int) -> List[ReadyLearningItem]:
        """Get subskills the student is ready to learn next"""
        try:
            # Get hierarchical metrics to find ready items
            metrics = await self.analytics_service.get_hierarchical_metrics(
                student_id=student_id,
                subject=None
            )

            ready_items = []

            for unit in metrics.get('hierarchical_data', []):
                for skill in unit.get('skills', []):
                    for subskill in skill.get('subskills', []):
                        readiness_status = subskill.get('readiness_status', '')

                        if readiness_status in ['ready', 'recommended']:
                            ready_items.append(ReadyLearningItem(
                                subskill_id=subskill.get('subskill_id', ''),
                                subskill_description=subskill.get('subskill_description', ''),
                                subject=unit.get('unit_title', ''),
                                unit_title=unit.get('unit_title', ''),
                                skill_description=skill.get('skill_description', ''),
                                readiness_status=readiness_status,
                                priority_order=subskill.get('priority_order', 999),
                                parent_starred=False  # TODO: Check parent priorities
                            ))

            # Sort by priority order and limit to top 10
            ready_items.sort(key=lambda x: x.priority_order)
            return ready_items[:10]

        except Exception as e:
            logger.error(f"❌ Failed to get ready learning items: {e}")
            return []


# Singleton instance (will be initialized in endpoints)
parent_portal_service: Optional[ParentPortalService] = None


def get_parent_portal_service() -> ParentPortalService:
    """Get or create parent portal service instance"""
    global parent_portal_service

    if parent_portal_service is None:
        from ..db.cosmos_db import CosmosDBService
        from .bigquery_analytics import BigQueryAnalyticsService
        from .ai_recommendations import AIRecommendationService
        from .daily_activities import DailyActivitiesService

        cosmos_db = CosmosDBService()
        analytics_service = BigQueryAnalyticsService(
            project_id=settings.GCP_PROJECT_ID,
            dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
        )
        ai_service = AIRecommendationService(
            project_id=settings.GCP_PROJECT_ID,
            dataset_id=getattr(settings, 'BIGQUERY_DATASET_ID', 'analytics')
        )
        daily_activities_service = DailyActivitiesService(
            analytics_service=analytics_service,
            ai_recommendation_service=ai_service,
            cosmos_db_service=cosmos_db
        )

        parent_portal_service = ParentPortalService(
            cosmos_db=cosmos_db,
            analytics_service=analytics_service,
            ai_service=ai_service,
            daily_activities_service=daily_activities_service
        )

    return parent_portal_service
