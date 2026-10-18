import json,glob,sys
def strip(o):
    if isinstance(o,dict):
        return {k:strip(v) for k,v in o.items() if not any(x in k.lower() for x in ('image','svg','color','style','icon','emoji','tutoring','audio','sound','pip','gradelevel','topic','theme'))}
    if isinstance(o,list): return [strip(x) for x in o]
    if isinstance(o,str) and len(o)>260: return o[:260]+'…'
    return o
for f in sys.argv[1:]:
    r=json.load(open(f,encoding='utf-8'))['response']
    print('=====',f)
    print(json.dumps(strip(r.get('fullData')),ensure_ascii=False)[:4000])
