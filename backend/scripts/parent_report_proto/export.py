import sys, json, os, datetime
sys.path.insert(0, r"C:\Users\xbox3\claude web tutor\backend")
from dotenv import load_dotenv
load_dotenv(r"C:\Users\xbox3\claude web tutor\backend\.env")
from app.db.firestore_service import FirestoreService
fs = FirestoreService()
c = fs.client
out = os.path.dirname(__file__) + "/data"
os.makedirs(out, exist_ok=True)
def ser(o):
    if isinstance(o, (datetime.datetime, datetime.date)): return o.isoformat()
    return str(o)
ref = c.collection("students").document("1004")
snap = ref.get()
json.dump(snap.to_dict(), open(out+"/student.json","w"), default=ser, indent=1)
for sub in ref.collections():
    docs = {}
    for d in sub.stream():
        docs[d.id] = d.to_dict()
        for ss in d.reference.collections():
            docs[d.id]["__sub__"+ss.id] = {x.id: x.to_dict() for x in ss.stream()}
    json.dump(docs, open(f"{out}/{sub.id}.json","w"), default=ser)
    print(sub.id, len(docs))
