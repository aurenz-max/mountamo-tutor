import asyncio, logging, sys
logging.basicConfig(level=logging.ERROR, stream=sys.stdout)
from dotenv import load_dotenv; load_dotenv()
from app.dependencies import get_curriculum_service

async def main():
    cs = await get_curriculum_service()
    subs = await cs.get_available_subjects()
    print("available_subjects (subject_id, grade):")
    for s in subs:
        print(f"  {s.get('subject_id') or s.get('subject_name')!r:18} grade={s.get('grade')!r}")
    # Try loading K math under a few likely grade strings
    for g in ["Kindergarten", "kindergarten", "K", "0"]:
        try:
            units = await cs.get_curriculum("MATHEMATICS", grade=g)
            n = sum(len(sk.get("subskills", [])) for u in units for sk in u.get("skills", []))
            skills = [sk["id"] for u in units for sk in u.get("skills", [])]
            has_ord = any("ordinal" in sk["description"].lower() for u in units for sk in u.get("skills", []))
            print(f"\ngrade={g!r}: {len(units)} units, {n} subskills, ordinal_skill={has_ord}")
            if units:
                print(f"  skill_ids: {skills}")
        except Exception as e:
            print(f"\ngrade={g!r}: ERROR {e}")

asyncio.run(main())
