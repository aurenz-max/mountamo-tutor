from typing import Optional, Dict, List
import random
from datetime import datetime
import asyncio

# The recommender takes CompetencyService as a dependency
class ProblemRecommender:
    def __init__(self, competency_service):
        """Initialize with injected CompetencyService."""
        self.competency_service = competency_service
        # Make sure difficulty overrides exist
        self._difficulty_overrides = {}

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
            # Verify that competency_service is available
            if not self.competency_service:
                print("[ERROR] CompetencyService not initialized")
                return None
                
            from asyncio import to_thread

            # FIXED: Use get_available_subjects() instead of syllabus_cache
            print(f"[DEBUG] Getting available subjects for matching: {subject}")
            available_subjects = await self.competency_service.get_available_subjects()
            print(f"[DEBUG] Available subjects: {available_subjects}")
            
            # Move subject matching to thread since it's CPU-intensive
            matched_subject = await to_thread(lambda: next(
                (s for s in available_subjects 
                 if s.lower() == subject.lower()), 
                None
            ))
            
            if not matched_subject:
                print(f"[ERROR] No subject found matching: {subject}")
                print(f"[DEBUG] Available subjects were: {available_subjects}")
                return None
                
            print(f"[DEBUG] Matched subject: {matched_subject}")
            
            curriculum = await self.competency_service.get_curriculum(matched_subject)
            if not curriculum:
                print(f"[ERROR] No curriculum found for subject: {matched_subject}")
                return None

            print(f"[DEBUG] Got curriculum with {len(curriculum)} units")

            # Get filtered items with async processing
            filtered_items = await self._filter_curriculum_async(
                curriculum, student_id, matched_subject, unit_filter, skill_filter, subskill_filter
            )

            if not filtered_items:
                print("[ERROR] No items match the filter criteria")
                return None

            print(f"[DEBUG] Filtered to {len(filtered_items)} items")

            selected_skill = await self._select_skill(student_id, filtered_items)
            if not selected_skill:
                print("[ERROR] Failed to select skill")
                return None

            print(f"[DEBUG] Selected skill with {len(selected_skill['items'])} items")

            selected_subskill = await self._select_subskill(student_id, selected_skill)
            if not selected_subskill:
                print("[ERROR] Failed to select subskill")
                return None

            print(f"[DEBUG] Selected subskill: {selected_subskill['subskill_id']}")

            # Move unit finding to thread
            unit = await to_thread(lambda: next(u for u in curriculum if u["id"] == selected_subskill["unit_id"]))

            difficulty = await self._determine_difficulty(
                student_id=student_id,
                subject=matched_subject,
                subskill=selected_subskill
            )

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

    async def _select_objective(self, subject: str, subskill_id: str) -> dict:
        """Select an objective for the subskill"""
        try:
            # Verify that competency_service is available
            if not self.competency_service:
                print("[ERROR] CompetencyService not initialized")
                return {
                    'ConceptGroup': 'General',
                    'DetailedObjective': 'Develop core skills'
                }
                
            objectives = await self.competency_service.get_detailed_objectives(
                subject=subject,
                subskill_id=subskill_id
            )
            
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

    async def _filter_curriculum_async(
        self, 
        curriculum: List[Dict],
        student_id: int,
        subject: str,
        unit_filter: Optional[str],
        skill_filter: Optional[str],
        subskill_filter: Optional[str]
    ) -> List[Dict]:
        """Async curriculum filtering with parallel competency fetching"""
        try:
            # Verify that competency_service is available
            if not self.competency_service:
                print("[ERROR] CompetencyService not initialized")
                return []
                
            filtered = []
            tasks = []

            print(f"[DEBUG] Filtering curriculum - filters: unit={unit_filter}, skill={skill_filter}, subskill={subskill_filter}")

            # Create tasks for all potential items
            for unit in curriculum:
                if unit_filter and unit["id"] != unit_filter:
                    continue
                    
                for skill in unit["skills"]:
                    if skill_filter and skill["id"] != skill_filter:
                        continue
                    
                    for subskill in skill["subskills"]:
                        if subskill_filter and subskill["id"] != subskill_filter:
                            continue

                        # Create task for getting competency and objectives
                        tasks.append({
                            "unit": unit,
                            "skill": skill,
                            "subskill": subskill,
                            "competency_task": self.competency_service.get_competency(
                                student_id=student_id,
                                subject=subject,
                                skill_id=skill["id"],
                                subskill_id=subskill["id"]
                            ),
                            "objective_task": self.competency_service.get_detailed_objectives(
                                subject=subject,
                                subskill_id=subskill["id"]
                            )
                        })

            print(f"[DEBUG] Created {len(tasks)} tasks for filtering")

            # Process all tasks in parallel
            for i, task in enumerate(tasks):
                try:
                    competency = await task["competency_task"]
                    objective = await task["objective_task"]
                    
                    filtered.append({
                        "unit_id": task["unit"]["id"],
                        "unit_title": task["unit"]["title"],
                        "skill_id": task["skill"]["id"],
                        "skill_description": task["skill"]["description"],
                        "subskill_id": task["subskill"]["id"],
                        "subskill_description": task["subskill"]["description"],
                        "difficulty_range": task["subskill"]["difficulty_range"],
                        "concept_group": objective.get("ConceptGroup", "General"),
                        "detailed_objective": objective.get("DetailedObjective", "Develop core skills"),
                        "competency": competency
                    })
                except Exception as e:
                    print(f"[ERROR] Error processing task {i+1}: {str(e)}")
                    continue

            print(f"[DEBUG] Successfully processed {len(filtered)} items")
            return filtered

        except Exception as e:
            print(f"[ERROR] Error in _filter_curriculum_async: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    async def _select_skill(self, student_id: int, filtered: List[Dict]) -> Optional[Dict]:
        """Weighted random skill selection based on competency"""
        from asyncio import to_thread
        
        if not filtered:
            return None

        def process_selection():
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

            weights = []
            skill_list = []
            for skill in skills.values():
                weight = max(0.1, skill["total_difficulty"] - skill["competency"])
                weights.append(weight)
                skill_list.append(skill)

            if sum(weights) == 0:
                return random.choice(skill_list) if skill_list else None
                
            return random.choices(skill_list, weights=weights, k=1)[0]

        return await to_thread(process_selection)

    async def _select_subskill(self, student_id: int, skill: Dict) -> Optional[Dict]:
        """Weighted subskill selection with new student detection"""
        from asyncio import to_thread
        
        def process_selection():
            subskills = skill["items"]
            is_new = all(s["competency"]["total_attempts"] == 0 for s in subskills)

            weights = []
            for subskill in subskills:
                if is_new:
                    weight = 1 / (subskill["difficulty_range"]["target"] + 0.1)
                else:
                    weight = max(0.1, 1 - subskill["competency"]["current_score"] / 100)
                weights.append(weight)

            if sum(weights) == 0:
                return random.choice(subskills) if subskills else None
                
            return random.choices(subskills, weights=weights, k=1)[0]

        return await to_thread(process_selection)

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
            
            self._difficulty_overrides[override_key] = {
                'difficulty': difficulty_override,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            print(f"[DEBUG] Updated difficulty override for {override_key}: {difficulty_override}")
            
        except Exception as e:
            print(f"[ERROR] Failed to update difficulty override: {str(e)}")
            raise

    async def _determine_difficulty(
        self,
        student_id: int,
        subject: str,
        subskill: Dict
    ) -> float:
        """Calculate adaptive difficulty based on both skill baseline and student competency."""
        try:
            # Verify that competency_service is available
            if not self.competency_service:
                print("[ERROR] CompetencyService not initialized")
                return 5.0  # Default difficulty
                
            from asyncio import to_thread
            
            print(f"[DEBUG] Determining difficulty for subskill: {subskill}")
            
            # Get base difficulty range for this skill
            diff_range = subskill.get("difficulty_range", {})
            base_difficulty = diff_range.get("target", 5.0)
            print(f"[DEBUG] Base difficulty for skill: {base_difficulty}")
            
            # Check for difficulty override
            override_key = f"{student_id}_{subject}_{subskill['unit_id']}_{subskill['skill_id']}_{subskill['subskill_id']}"
            if override_key in self._difficulty_overrides:
                override = self._difficulty_overrides[override_key]['difficulty']
                if override is not None:
                    print(f"[DEBUG] Using difficulty override: {override}")
                    return override
            
            # Get student's competency with proper parameters
            competency = await self.competency_service.get_competency(
                student_id=student_id,
                subject=subject,
                skill_id=subskill["skill_id"],
                subskill_id=subskill["subskill_id"]
            )
            
            competency_score = competency.get("current_score", 5.0)
            credibility = competency.get("credibility", 0.0)
            print(f"[DEBUG] Student competency: {competency_score}, Credibility: {credibility}")

            def calculate_adjustment():
                competency_adjustment = (competency_score - 5.0) / 5.0
                weighted_adjustment = competency_adjustment * credibility * 2.0
                
                final_difficulty = base_difficulty + weighted_adjustment
                min_difficulty = diff_range.get("start", 1.0)
                max_difficulty = diff_range.get("end", 10.0)
                
                return max(min_difficulty, min(max_difficulty, final_difficulty))

            final_difficulty = await to_thread(calculate_adjustment)
            
            print(f"[DEBUG] Final difficulty calculation:")
            print(f"  Base difficulty: {base_difficulty}")
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