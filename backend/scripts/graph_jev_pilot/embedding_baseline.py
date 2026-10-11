"""Score the embedding method (gemini-embedding-2-preview cosine, as in the
authoring service's suggestion engine) on the same hand-labelled pairs as Jev."""
import json, re
from pathlib import Path
import numpy as np
from google import genai

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "reports" / "graph-jev-pilot-2026-10-11"
env = (HERE.parents[1] / ".env").read_text(encoding="utf-8")
key = re.search(r"^(?:GEMINI_API_KEY|GOOGLE_API_KEY)=(.*)$", env, re.M).group(1).strip().strip("'\"")
client = genai.Client(api_key=key)

base = json.loads((OUT / "baseline_graphs.json").read_text(encoding="utf-8"))
lab = {n["id"]: n["label"] for g in base.values() for n in g["nodes"]}
jev = json.loads((OUT / "capability_variants.json").read_text(encoding="utf-8"))
labels, ans = jev["labels"], jev["answers"]
ids = sorted({i for k in labels for i in k.split(">")})
vecs = {}
for i in range(0, len(ids), 50):
    chunk = ids[i:i + 50]
    r = client.models.embed_content(model="gemini-embedding-2-preview", contents=[lab[x] for x in chunk])
    for x, e in zip(chunk, r.embeddings):
        v = np.array(e.values); vecs[x] = v / np.linalg.norm(v)
cos = {k: float(vecs[k.split(">")[0]] @ vecs[k.split(">")[1]]) for k in labels}

def auc(pos, neg):
    return sum((p > q) + 0.5 * (p == q) for p in pos for q in neg) / (len(pos) * len(neg))

print("| method | set | AUC all | AUC vs related-not-required | AUC vs reversed |\n|---|---|---|---|---|")
gold = json.loads((HERE / "gold_pairs_v2.json").read_text(encoding="utf-8"))["pairs"]
for name, f in [("embedding cosine", lambda k: cos[k]), ("Jev max(step, easier)", lambda k: max(ans[k]["step"], ans[k]["easier_form"]))]:
    for st in ("mine", "user_literacy"):
        ks = [k for k, l in labels.items() if l["set"] == st]
        pos = [f(k) for k in ks if labels[k]["required"]]
        neg = [f(k) for k in ks if not labels[k]["required"]]
        hard = [f(k) for k in ks if not labels[k]["required"] and gold.get(k, {}).get("kind") == "hard_neg"]
        rev = [f(k) for k in ks if not labels[k]["required"] and gold.get(k, {}).get("kind") == "reverse"]
        cols = [auc(pos, neg), auc(pos, hard) if hard else float("nan"), auc(pos, rev) if rev else float("nan")]
        print(f"| {name} | {st} | " + " | ".join(f"{c:.2f}" for c in cols) + " |")
print("\nexamples (cosine): " + "; ".join(f"{k} {cos[k]:.2f} [{labels[k]['label']}]" for k in
      ["OPS002-02-a>OPS002-02-b", "OPS002-02-b>OPS002-02-a", "NBT001-04-a>OPS002-02-b", "OPS001-02-c>OPS002-02-b", "LA002-01-a>LA001-01-a" if "LA002-01-a>LA001-01-a" in cos else "LA005-03-C>LA001-01-a"]))
