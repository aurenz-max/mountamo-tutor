# curriculum_tests.py
"""
Test functions to explore and validate curriculum endpoints
Run these to understand your curriculum data structure and verify functionality
"""

import asyncio
import httpx
import json
from typing import Dict, Any, List
from pprint import pprint

# Base URL for your API
BASE_URL = "http://localhost:8000"  # Adjust as needed

class CurriculumTester:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.client = httpx.AsyncClient(base_url=base_url)
    
    async def close(self):
        await self.client.aclose()
    
    async def test_health_check(self):
        """Test curriculum service health"""
        print("=" * 60)
        print("🏥 TESTING CURRICULUM HEALTH CHECK")
        print("=" * 60)
        
        try:
            response = await self.client.get("/curriculum/health")
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("✅ Health Check Response:")
                pprint(data)
            else:
                print(f"❌ Health check failed: {response.text}")
                
        except Exception as e:
            print(f"❌ Error during health check: {e}")
    
    async def test_get_subjects(self):
        """Test getting available subjects"""
        print("\n" + "=" * 60)
        print("📚 TESTING GET AVAILABLE SUBJECTS")
        print("=" * 60)
        
        try:
            response = await self.client.get("/curriculum/subjects")
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                subjects = data.get("subjects", [])
                print(f"✅ Found {len(subjects)} subjects:")
                for i, subject in enumerate(subjects, 1):
                    print(f"  {i}. {subject}")
                return subjects
            else:
                print(f"❌ Failed to get subjects: {response.text}")
                return []
                
        except Exception as e:
            print(f"❌ Error getting subjects: {e}")
            return []
    
    async def test_get_curriculum(self, subject: str):
        """Test getting curriculum structure for a subject"""
        print("\n" + "=" * 60)
        print(f"🎯 TESTING GET CURRICULUM FOR: {subject}")
        print("=" * 60)
        
        try:
            response = await self.client.get(f"/curriculum/curriculum/{subject}")
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                curriculum = data.get("curriculum", [])
                
                print(f"✅ Curriculum loaded for {subject}")
                print(f"📊 Total Units: {len(curriculum)}")
                
                total_skills = 0
                total_subskills = 0
                
                for unit in curriculum:
                    skills_count = len(unit.get("skills", []))
                    total_skills += skills_count
                    
                    subskills_count = sum(len(skill.get("subskills", [])) for skill in unit.get("skills", []))
                    total_subskills += subskills_count
                    
                    print(f"\n📁 Unit: {unit.get('title', 'Unknown')} (ID: {unit.get('id', 'Unknown')})")
                    print(f"   📌 Skills: {skills_count}")
                    print(f"   🎯 Subskills: {subskills_count}")
                
                print(f"\n📈 TOTALS:")
                print(f"   🎯 Total Skills: {total_skills}")
                print(f"   🎪 Total Subskills: {total_subskills}")
                
                # Show detailed structure for first unit
                if curriculum:
                    print(f"\n🔍 DETAILED VIEW - First Unit:")
                    print(f"Title: {curriculum[0].get('title')}")
                    print(f"ID: {curriculum[0].get('id')}")
                    
                    skills = curriculum[0].get("skills", [])
                    if skills:
                        print(f"\nFirst Skill:")
                        first_skill = skills[0]
                        print(f"  Skill ID: {first_skill.get('id')}")
                        print(f"  Description: {first_skill.get('description')}")
                        
                        subskills = first_skill.get("subskills", [])
                        if subskills:
                            print(f"  Subskills ({len(subskills)}):")
                            for subskill in subskills[:3]:  # Show first 3
                                print(f"    - {subskill.get('id')}: {subskill.get('description')}")
                            if len(subskills) > 3:
                                print(f"    ... and {len(subskills) - 3} more")
                
                return curriculum
            else:
                print(f"❌ Failed to get curriculum: {response.text}")
                return []
                
        except Exception as e:
            print(f"❌ Error getting curriculum: {e}")
            return []
    
    async def test_get_subskills(self, subject: str):
        """Test getting all subskills for a subject"""
        print("\n" + "=" * 60)
        print(f"🎪 TESTING GET SUBSKILLS FOR: {subject}")
        print("=" * 60)
        
        try:
            response = await self.client.get(f"/curriculum/subskills/{subject}")
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                subskills = data.get("problem_types", [])
                
                print(f"✅ Found {len(subskills)} subskills:")
                
                # Group by first part of ID (usually skill)
                grouped = {}
                for subskill in subskills:
                    parts = subskill.split(".")
                    if len(parts) >= 2:
                        skill_id = f"{parts[0]}.{parts[1]}"
                        if skill_id not in grouped:
                            grouped[skill_id] = []
                        grouped[skill_id].append(subskill)
                
                print(f"📊 Grouped by Skills ({len(grouped)} skills):")
                for skill_id, skill_subskills in list(grouped.items())[:5]:  # Show first 5
                    print(f"  {skill_id}: {len(skill_subskills)} subskills")
                    for subskill in skill_subskills[:2]:  # Show first 2
                        print(f"    - {subskill}")
                    if len(skill_subskills) > 2:
                        print(f"    ... and {len(skill_subskills) - 2} more")
                
                if len(grouped) > 5:
                    print(f"  ... and {len(grouped) - 5} more skills")
                
                return subskills
            else:
                print(f"❌ Failed to get subskills: {response.text}")
                return []
                
        except Exception as e:
            print(f"❌ Error getting subskills: {e}")
            return []
    
    async def test_get_objectives(self, subject: str, subskill_id: str):
        """Test getting detailed objectives for a subskill"""
        print("\n" + "=" * 60)
        print(f"🎯 TESTING GET OBJECTIVES FOR: {subskill_id}")
        print("=" * 60)
        
        try:
            response = await self.client.get(f"/curriculum/objectives/{subject}/{subskill_id}")
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                objectives = data.get("objectives", {})
                
                print(f"✅ Objectives loaded for {subskill_id}")
                print(f"📝 Objective Details:")
                for key, value in objectives.items():
                    print(f"  {key}: {value}")
                
                return objectives
            else:
                print(f"❌ Failed to get objectives: {response.text}")
                return {}
                
        except Exception as e:
            print(f"❌ Error getting objectives: {e}")
            return {}
    
    async def test_curriculum_stats(self):
        """Test getting curriculum statistics"""
        print("\n" + "=" * 60)
        print("📊 TESTING GET CURRICULUM STATS")
        print("=" * 60)
        
        try:
            response = await self.client.get("/curriculum/stats")
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                stats = response.json()
                print("✅ Curriculum Statistics:")
                pprint(stats)
                return stats
            else:
                print(f"❌ Failed to get stats: {response.text}")
                return {}
                
        except Exception as e:
            print(f"❌ Error getting stats: {e}")
            return {}
    
    async def test_list_files(self):
        """Test listing curriculum files"""
        print("\n" + "=" * 60)
        print("📁 TESTING LIST CURRICULUM FILES")
        print("=" * 60)
        
        try:
            response = await self.client.get("/curriculum/files")
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                files = data.get("files", [])
                
                print(f"✅ Found {len(files)} curriculum files:")
                for file_info in files:
                    print(f"  📄 {file_info.get('name', 'Unknown')}")
                    print(f"     Subject: {file_info.get('subject', 'Unknown')}")
                    print(f"     Type: {file_info.get('type', 'Unknown')}")
                    print(f"     Size: {file_info.get('size', 'Unknown')} bytes")
                    print(f"     Modified: {file_info.get('last_modified', 'Unknown')}")
                    print()
                
                return files
            else:
                print(f"❌ Failed to list files: {response.text}")
                return []
                
        except Exception as e:
            print(f"❌ Error listing files: {e}")
            return []
    
    async def test_preview_data(self, subject: str, file_type: str = "syllabus"):
        """Test previewing curriculum data"""
        print("\n" + "=" * 60)
        print(f"👀 TESTING PREVIEW DATA: {subject} - {file_type}")
        print("=" * 60)
        
        try:
            response = await self.client.get(f"/curriculum/preview/{subject}?file_type={file_type}&limit=5")
            print(f"Status Code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                print(f"✅ Preview for {subject} {file_type}:")
                print(f"📊 Total Rows: {data.get('total_rows')}")
                print(f"📋 Columns: {data.get('columns')}")
                print(f"\n📝 Sample Data:")
                
                preview = data.get("preview", [])
                for i, row in enumerate(preview, 1):
                    print(f"\n  Row {i}:")
                    for key, value in row.items():
                        print(f"    {key}: {value}")
                
                return data
            else:
                print(f"❌ Failed to preview data: {response.text}")
                return {}
                
        except Exception as e:
            print(f"❌ Error previewing data: {e}")
            return {}
    
    async def run_comprehensive_test(self):
        """Run all tests in sequence"""
        print("🚀 STARTING COMPREHENSIVE CURRICULUM TEST SUITE")
        print("=" * 80)
        
        # 1. Health check
        await self.test_health_check()
        
        # 2. Get available subjects
        subjects = await self.test_get_subjects()
        
        if not subjects:
            print("\n❌ No subjects found - cannot continue with detailed tests")
            return
        
        # Use the first subject for detailed testing
        test_subject = subjects[0]
        print(f"\n🎯 Using '{test_subject}' for detailed testing")
        
        # 3. Get curriculum structure
        curriculum = await self.test_get_curriculum(test_subject)
        
        # 4. Get all subskills
        subskills = await self.test_get_subskills(test_subject)
        
        # 5. Test objectives for first subskill
        if subskills:
            await self.test_get_objectives(test_subject, subskills[0])
        
        # 6. Get statistics
        await self.test_curriculum_stats()
        
        # 7. List files
        await self.test_list_files()
        
        # 8. Preview data
        await self.test_preview_data(test_subject, "syllabus")
        
        print("\n" + "=" * 80)
        print("✅ COMPREHENSIVE TEST SUITE COMPLETED")
        print("=" * 80)

async def run_quick_test():
    """Quick test to verify basic functionality"""
    tester = CurriculumTester()
    
    try:
        print("🏃‍♂️ RUNNING QUICK TEST")
        
        # Just test the basic endpoints
        await tester.test_health_check()
        subjects = await tester.test_get_subjects()
        
        if subjects:
            await tester.test_get_curriculum(subjects[0])
        
        print("\n✅ Quick test completed!")
        
    finally:
        await tester.close()

async def run_full_test():
    """Run the comprehensive test suite"""
    tester = CurriculumTester()
    
    try:
        await tester.run_comprehensive_test()
    finally:
        await tester.close()

# Helper function to test specific subject
async def test_specific_subject(subject_name: str):
    """Test a specific subject in detail"""
    tester = CurriculumTester()
    
    try:
        print(f"🔬 DETAILED TEST FOR SUBJECT: {subject_name}")
        print("=" * 60)
        
        curriculum = await tester.test_get_curriculum(subject_name)
        subskills = await tester.test_get_subskills(subject_name)
        
        if subskills:
            # Test objectives for a few different subskills
            for subskill in subskills[:3]:
                await tester.test_get_objectives(subject_name, subskill)
        
        await tester.test_preview_data(subject_name, "syllabus")
        await tester.test_preview_data(subject_name, "detailed_objectives")
        
    finally:
        await tester.close()

if __name__ == "__main__":
    # Run different test modes based on your needs
    
    # Option 1: Quick test
    print("Choose test mode:")
    print("1. Quick test (basic functionality)")
    print("2. Full comprehensive test")
    print("3. Test specific subject")
    
    choice = input("Enter choice (1/2/3): ").strip()
    
    if choice == "1":
        asyncio.run(run_quick_test())
    elif choice == "2":
        asyncio.run(run_full_test())
    elif choice == "3":
        subject = input("Enter subject name: ").strip()
        asyncio.run(test_specific_subject(subject))
    else:
        print("Running quick test by default...")
        asyncio.run(run_quick_test())