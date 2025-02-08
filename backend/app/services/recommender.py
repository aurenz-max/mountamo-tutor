# recommender.py (updated)

from .competency import CompetencyService
from typing import Optional, Dict, List
import random
from datetime import datetime


class ProblemRecommender:
    def __init__(self, competency_service: CompetencyService):
        self.competency_service = competency_service

    async def get_recommendation(
        self,
        student_id: int,
        subject: str,
        unit_filter: Optional[str] = None,
        skill_filter: Optional[str] = None,
        subskill_filter: Optional[str] = None
    ) -> Optional[Dict]:
        """Get recommendation using competency-weighted selection"""
        try:
            matched_subject = next(
                (s for s in self.competency_service.syllabus_cache.keys() 
                 if s.lower() == subject.lower()), 
                None
            )
            
            if not matched_subject:
                print(f"[ERROR] No subject found matching: {subject}")
                return None
                
            curriculum = self.competency_service.get_curriculum(matched_subject)
            if not curriculum:
                print(f"[ERROR] No curriculum found for subject: {matched_subject}")
                return None

            # Filter curriculum based on provided filters
            filtered_items = []
            for unit in curriculum:
                # Skip if unit filter provided and doesn't match
                if unit_filter and unit["id"] != unit_filter:
                    continue
                    
                for skill in unit["skills"]:
                    # Skip if skill filter provided and doesn't match
                    if skill_filter and skill["id"] != skill_filter:
                        continue
                        
                    for subskill in skill["subskills"]:
                        # Skip if subskill filter provided and doesn't match
                        if subskill_filter and subskill["id"] != subskill_filter:
                            continue

                        # Get competency data for this item
                        competency = await self.competency_service.get_competency(
                            student_id,
                            matched_subject,
                            skill["id"],
                            subskill["id"]
                        )

                        filtered_items.append({
                            "unit_id": unit["id"],
                            "unit_title": unit["title"],
                            "skill_id": skill["id"],
                            "skill_description": skill["description"],
                            "subskill_id": subskill["id"],
                            "subskill_description": subskill["description"],
                            "difficulty_range": subskill["difficulty_range"],
                            "competency": competency
                        })

            if not filtered_items:
                print("[ERROR] No items match the filter criteria")
                return None

            # Use weighted selection to choose skill
            selected_skill = await self._select_skill(student_id, filtered_items)
            if not selected_skill:
                print("[ERROR] Failed to select skill")
                return None

            # Use weighted selection to choose subskill
            selected_subskill = await self._select_subskill(student_id, selected_skill)
            if not selected_subskill:
                print("[ERROR] Failed to select subskill")
                return None

            # Find the unit data for the selected skill
            unit_id = selected_subskill["unit_id"]
            unit = next(u for u in curriculum if u["id"] == unit_id)

            # Determine adaptive difficulty
            difficulty = await self._determine_difficulty(student_id, selected_subskill)

            # Create recommendation
            recommendation = {
                "unit": {
                    "id": unit["id"],
                    "title": unit["title"]
                },
                "skill": {
                    "id": selected_skill["items"][0]["skill_id"],
                    "description": selected_skill["items"][0]["skill_description"]
                },
                "subskill": {
                    "id": selected_subskill["subskill_id"],
                    "description": selected_subskill["subskill_description"]
                },
                "difficulty": difficulty
            }

            print(f"[DEBUG] Created recommendation: {recommendation}")
            return recommendation

        except Exception as e:
            print(f"[ERROR] Error in get_recommendation: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    def _select_objective(self, subskill_id: str) -> dict:
        """Select an objective for the subskill"""
        try:
            objectives = self.competency_service.get_detailed_objectives(subskill_id)
            if not objectives:
                return {
                    'ConceptGroup': 'General',
                    'DetailedObjective': 'Develop core skills'
                }
            return objectives
            
        except Exception as e:
            print(f"[ERROR] Error selecting objective: {str(e)}")
            return {
                'ConceptGroup': 'General',
                'DetailedObjective': 'Develop core skills'
            }

    def _filter_curriculum(self, curriculum, student_id, subject, unit_filter, skill_filter, subskill_filter):
        filtered = []
        for unit in curriculum:
            if unit_filter and unit["id"] != unit_filter:
                continue
                
            for skill in unit["skills"]:
                if skill_filter and skill["id"] != skill_filter:
                    continue
                
                for subskill in skill["subskills"]:
                    if subskill_filter and subskill["id"] != subskill_filter:
                        continue

                    selected_objective = self._select_objective(subskill["id"])

                    # Get detailed objectives from competency service
                    details = self.competency_service.get_detailed_objectives(subskill["id"])
                        
                    filtered.append({
                        "unit_id": unit["id"],
                        "unit_title": unit["title"],
                        "skill_id": skill["id"],
                        "skill_description": skill["description"],
                        "subskill_id": subskill["id"],
                        "subskill_description": subskill["description"],
                        "difficulty_range": subskill["difficulty_range"],
                        "concept_group": selected_objective['ConceptGroup'],
                        "detailed_objective": selected_objective['DetailedObjective'],
                        "competency": self.competency_service.get_competency(
                            student_id, subject, skill["id"], subskill["id"]
                        )
                    })
        return filtered


    async def _select_skill(self, student_id: int, filtered: List[Dict]) -> Optional[Dict]:
        """Weighted random skill selection based on competency"""
        if not filtered:
            return None

        # Group by skills and calculate weights
        skills = {}
        for item in filtered:
            key = (item["unit_id"], item["skill_id"])
            if key not in skills:
                skills[key] = {
                    "items": [],
                    "total_difficulty": item["difficulty_range"]["target"],
                    "competency": item["competency"]["current_score"]
                }
            skills[key]["items"].append(item)

        # Calculate weights using original formula
        weights = []
        skill_list = []
        for skill in skills.values():
            weight = max(0.1, skill["total_difficulty"] - skill["competency"])
            weights.append(weight)
            skill_list.append(skill)

        if sum(weights) == 0:
            return random.choice(skill_list) if skill_list else None
            
        return random.choices(skill_list, weights=weights, k=1)[0]


    async def _select_subskill(self, student_id: int, skill: Dict) -> Optional[Dict]:
        """Weighted subskill selection with new student detection"""
        subskills = skill["items"]
        is_new = all(s["competency"]["total_attempts"] == 0 for s in subskills)

        weights = []
        for subskill in subskills:
            if is_new:
                # Inverse weighting for new students
                weight = 1 / (subskill["difficulty_range"]["target"] + 0.1)
            else:
                # Competency-based weighting for others
                weight = max(0.1, 1 - subskill["competency"]["current_score"] / 100)
            weights.append(weight)

        if sum(weights) == 0:
            return random.choice(subskills) if subskills else None
            
        return random.choices(subskills, weights=weights, k=1)[0]

    async def update_difficulty_override(
        self,
        student_id: int,
        subject: str,
        unit_id: Optional[str] = None,
        skill_id: Optional[str] = None,
        subskill_id: Optional[str] = None,
        difficulty_override: float = None
    ) -> None:
        """Store a user's difficulty preference override."""
        try:
            # Create a key to store the override
            override_key = f"{student_id}_{subject}"
            if unit_id:
                override_key += f"_{unit_id}"
            if skill_id:
                override_key += f"_{skill_id}"
            if subskill_id:
                override_key += f"_{subskill_id}"
                
            # Store the override (you might want to use a database instead of memory)
            if not hasattr(self, '_difficulty_overrides'):
                self._difficulty_overrides = {}
                
            self._difficulty_overrides[override_key] = {
                'difficulty': difficulty_override,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            print(f"[DEBUG] Updated difficulty override for {override_key}: {difficulty_override}")
            
        except Exception as e:
            print(f"[ERROR] Failed to update difficulty override: {str(e)}")
            raise

    async def _determine_difficulty(self, student_id: int, subskill: Dict) -> float:
        """Calculate adaptive difficulty based on both skill baseline and student competency."""
        try:
            print(f"[DEBUG] Determining difficulty for subskill: {subskill}")
            
            # Get base difficulty range for this skill
            diff_range = subskill.get("difficulty_range", {})
            base_difficulty = diff_range.get("target", 5.0)
            print(f"[DEBUG] Base difficulty for skill: {base_difficulty}")
            
            # Get student's competency
            competency = await self.competency_service.get_competency(
                student_id=student_id,
                subject=subskill.get('subject'),
                skill_id=subskill.get('skill_id'),
                subskill_id=subskill.get('subskill_id')
            )
            
            competency_score = competency.get("current_score", 5.0)
            credibility = competency.get("credibility", 0.0)
            print(f"[DEBUG] Student competency: {competency_score}, Credibility: {credibility}")

            # Adjust difficulty based on competency
            # If student is doing well (competency > 7), increase difficulty
            # If student is struggling (competency < 4), decrease difficulty
            competency_adjustment = (competency_score - 5.0) / 5.0  # Range: -1.0 to 1.0
            
            # Weight the adjustment based on credibility of the competency score
            weighted_adjustment = competency_adjustment * credibility * 2.0  # Max ±2 difficulty points
            
            # Calculate final difficulty
            final_difficulty = base_difficulty + weighted_adjustment
            
            # Keep within the skill's defined range
            min_difficulty = diff_range.get("start", 1.0)
            max_difficulty = diff_range.get("end", 10.0)
            final_difficulty = max(min_difficulty, min(max_difficulty, final_difficulty))
            
            print(f"[DEBUG] Final difficulty calculation:")
            print(f"  Base difficulty: {base_difficulty}")
            print(f"  Competency adjustment: {weighted_adjustment}")
            print(f"  Final difficulty: {final_difficulty}")
            
            return round(final_difficulty, 1)
            
        except Exception as e:
            print(f"[ERROR] Error determining difficulty: {str(e)}")
            return 5.0  # Default fallback

    def _generate_rationale(self, subskill: Dict) -> str:
        """Generate explanation for recommendation"""
        return (
            f"Selected subskill {subskill['subskill_id']} based on "
            f"competency score {subskill['competency']['current_score']}/100 "
            f"with {subskill['competency']['total_attempts']} attempts"
        )
    
