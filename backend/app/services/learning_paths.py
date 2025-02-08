# app/services/learning_paths.py

from typing import List, Dict, Any, Optional
import json
from pathlib import Path
from ..core.config import settings
from .competency import CompetencyService

class LearningPathsService:
    def __init__(self, data_dir: str = "data", competency_service: Optional[CompetencyService] = None):
        DATA_DIR = Path(__file__).parent.parent.parent / "data"
        self.data_dir = Path(data_dir)
        self.decision_tree_file = DATA_DIR / "learning_path_decision_tree.json"
        self._decision_tree_data = None
        self.competency_service = competency_service or CompetencyService()
        
        # Competency threshold to consider a skill "mastered"
        self.MASTERY_THRESHOLD = 0.8  # 80% competency
        # Minimum credibility needed to trust the competency score
        self.CREDIBILITY_THRESHOLD = 0.6  # 60% credibility

    def load_decision_tree_data(self) -> Dict[str, List[str]]:
        """Load decision tree data from JSON file"""
        if self._decision_tree_data is None:
            try:
                print(f"Loading decision tree data from: {self.decision_tree_file}")
                if not self.decision_tree_file.exists():
                    print(f"File not found at: {self.decision_tree_file}")
                    raise FileNotFoundError(f"Decision tree file not found at {self.decision_tree_file}")

                with open(self.decision_tree_file) as f:
                    data = json.load(f)
                    self._decision_tree_data = data.get("learning_path_decision_tree", {})
                    print(f"Loaded decision tree with {len(self._decision_tree_data)} skills")
            except Exception as e:
                print(f"Error loading decision tree data: {str(e)}")
                raise
        return self._decision_tree_data

    async def get_next_recommendations(
        self,
        student_id: int,
        subject: str,
        current_skill_id: Optional[str] = None,
        current_subskill_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get recommended next skills based on current progress and learning paths"""
        try:
            decision_tree = self.load_decision_tree_data()
            
            # If no current skill provided, start with the root skill
            if not current_skill_id:
                return {
                    "current_skill": None,
                    "recommended_skills": ["COUNT001-01"],  # Root skill
                    "rationale": "Starting with foundational counting skills"
                }

            # Get current skill competency
            current_competency = await self.competency_service.get_competency(
                student_id=student_id,
                subject=subject,
                skill_id=current_skill_id,
                subskill_id=current_subskill_id or ""
            )

            print(f"Current competency for {current_skill_id}: {current_competency}")

            # Check if current skill is mastered
            is_mastered = (
                current_competency["current_score"] >= self.MASTERY_THRESHOLD and
                current_competency["credibility"] >= self.CREDIBILITY_THRESHOLD
            )

            if not is_mastered:
                return {
                    "current_skill": current_skill_id,
                    "recommended_skills": [current_skill_id],
                    "rationale": "Current skill needs more practice to achieve mastery",
                    "competency_data": current_competency
                }

            # Get possible next skills from decision tree
            next_skills = decision_tree.get(current_skill_id, [])
            
            if not next_skills:
                return {
                    "current_skill": current_skill_id,
                    "recommended_skills": [],
                    "rationale": "No further skills in current learning path",
                    "competency_data": current_competency
                }

            # Filter and rank next skills based on prerequisites and competencies
            ranked_skills = await self._rank_next_skills(
                student_id=student_id,
                subject=subject,
                next_skills=next_skills
            )

            return {
                "current_skill": current_skill_id,
                "recommended_skills": ranked_skills,
                "rationale": "Skills recommended based on current mastery and learning path",
                "competency_data": current_competency
            }

        except Exception as e:
            print(f"Error getting next recommendations: {str(e)}")
            raise

    async def _rank_next_skills(
        self,
        student_id: int,
        subject: str,
        next_skills: List[str]
    ) -> List[str]:
        """Rank next skills based on prerequisites and existing competencies"""
        try:
            skill_scores = []
            
            for skill_id in next_skills:
                # Get competency for this skill
                competency = await self.competency_service.get_competency(
                    student_id=student_id,
                    subject=subject,
                    skill_id=skill_id,
                    subskill_id=""  # Empty string for skill-level competency
                )
                
                # Calculate a score for this skill
                # Lower scores are better (we want skills with low existing competency)
                score = competency["current_score"] if competency["credibility"] > 0.2 else 0
                
                skill_scores.append((skill_id, score))
            
            # Sort skills by score (ascending)
            sorted_skills = sorted(skill_scores, key=lambda x: x[1])
            
            # Return just the skill IDs in ranked order
            return [skill[0] for skill in sorted_skills]
            
        except Exception as e:
            print(f"Error ranking next skills: {str(e)}")
            raise

    async def get_skill_prerequisites(self, skill_id: str) -> List[str]:
        """Get list of prerequisite skills for a given skill"""
        try:
            decision_tree = self.load_decision_tree_data()
            prerequisites = []
            
            # Find all skills that list the target skill as a next step
            for skill, next_skills in decision_tree.items():
                if skill_id in next_skills:
                    prerequisites.append(skill)
                    
            return prerequisites
            
        except Exception as e:
            print(f"Error getting skill prerequisites: {str(e)}")
            raise

    async def get_learning_paths(self) -> Dict[str, List[str]]: # Updated return type
        try:
            decision_tree_data = self.load_decision_tree_data()
            return decision_tree_data  # Simply return the loaded decision tree data

        except json.JSONDecodeError as e:
            print(f"Error reading JSON: {e}")
            raise
        except Exception as e:
            print(f"Error processing learning paths: {str(e)}")
            raise