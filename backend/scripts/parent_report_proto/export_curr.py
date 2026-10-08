import sys, json, os
sys.path.insert(0, r"C:\Users\xbox3\claude web tutor\backend")
from dotenv import load_dotenv
load_dotenv(r"C:\Users\xbox3\claude web tutor\backend\.env")
from app.db.firestore_service import FirestoreService
c = FirestoreService().client
out = os.path.dirname(__file__) + "/data/curriculum.json"
lookup = {}; units = {}
for g in sorted(c.collection('curriculum_published').stream(), key=lambda g: 0 if g.id=='Kindergarten' else 1):
    for s in g.reference.collection('subjects').stream():
        d = s.to_dict() or {}
        for k, v in (d.get('subskill_index') or {}).items():
            v = dict(v); v['grade_doc'] = g.id; v['subject_id'] = s.id
            lookup.setdefault(k, v)
            lookup.setdefault(v.get('skill_id'), {"skill_description": v.get('skill_description'), "unit_title": v.get('unit_title'), "subject": v.get('subject'), "grade": v.get('grade'), "is_skill": True})
        # unit order + skill order for K
        if g.id == 'Kindergarten':
            units[s.id] = [{"unit_id":u.get('unit_id'),"title":u.get('unit_title'),"skills":[{"skill_id":sk.get('skill_id'),"desc":sk.get('skill_description'),"subskills":[ss.get('subskill_id') for ss in sk.get('subskills',[])]} for sk in u.get('skills',[])]} for u in d.get('curriculum',[])]
json.dump({"lookup":lookup,"k_units":units}, open(out,"w"), default=str)
print(len(lookup))
