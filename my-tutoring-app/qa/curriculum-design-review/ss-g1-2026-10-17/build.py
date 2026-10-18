"""Build the Social Studies grade 1 curriculum design review: manifests, bundle, briefs, HTML.

Run from anywhere: python build.py. Reads sample.json, catalog.json and evidence/*.json
from this directory; writes manifests/, briefs/, manifest-bundle.json and index.html.
Lesson decisions live in lessons_src.py and briefs in briefs_src.py (authored, not generated).
"""
import hashlib
import html
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).parent
sample = json.loads((HERE / 'sample.json').read_text(encoding='utf-8'))
catalog = {p['id']: p for p in json.loads((HERE / 'catalog.json').read_text(encoding='utf-8'))}
published = {s['id']: (g, s) for g in sample['selected'] for s in g['selectedSubskills']}
SUBJECT, GRADE, GRADE_LABEL, RUN = 'SOCIAL_STUDIES', '1', '1st Grade', 'ss-g1-2026-10-17'

from lessons_src import PROBES, LESSONS, ISSUES  # noqa: E402
from briefs_src import BRIEFS  # noqa: E402

def esc(s):
    return html.escape(str(s), quote=True)

def manifest_for(lesson):
    g, sub = published[lesson['id']]
    comps = []
    for i, b in enumerate(lesson['sequence'], 1):
        assert b['componentId'] in catalog, b['componentId']
        modes = {m['id'] for m in catalog[b['componentId']]['modes']}
        assert (b['mode'] in modes) if b['mode'] else not modes, (b['componentId'], b['mode'])
        config = {'subject': 'Social Studies', 'unitTitle': g['unitTitle']}
        if b['mode']:
            config = {'targetEvalMode': b['mode'], **config}
        comps.append({'componentId': b['componentId'], 'instanceId': f"{lesson['id'].lower()}-{i}-{b['componentId']}",
                      'title': b['title'], 'intent': b['intent'], 'config': config})
    block = {'objectiveId': 'obj1', 'objectiveText': sub['description'], 'objectiveVerb': lesson['verb'], 'components': comps}
    layout = [{**c, 'objectiveIds': ['obj1']} for c in comps]
    return {'topic': lesson['title'], 'gradeLevel': GRADE_LABEL, 'themeColor': '#8a4b2f', 'subject': SUBJECT,
            'objectiveBlocks': [block], 'layout': layout}

def wrapper(lesson, n):
    g, sub = published[lesson['id']]
    return {'lessonId': f'lesson-{n:02d}',
            'curriculum': {'subject': SUBJECT, 'grade': GRADE, 'unitId': g['unitId'], 'skillId': g['skill']['id'],
                           'subskillId': sub['id'], 'description': sub['description'],
                           'targetPrimitive': sub.get('target_primitive'), 'targetEvalModes': sub.get('target_eval_modes')},
            'status': 'authored; catalog-checked; each binding generator-probed once; not hydrated as a lesson; not runtime-tested',
            'learnerAction': lesson['action'], 'estimatedMinutes': lesson['minutes'],
            'manifest': manifest_for(lesson),
            'sequence': [{'step': i, 'componentId': b['componentId'], 'evalMode': b['mode'], 'role': b['role']} for i, b in enumerate(lesson['sequence'], 1)],
            'evidenceCriteria': lesson['evidence'], 'coverageLimits': lesson['limits'],
            'recommendation': {'kind': lesson['decision'], 'rationale': lesson['decisionText']}}

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

# ---- write JSON + briefs -------------------------------------------------
(HERE / 'manifests').mkdir(exist_ok=True)
(HERE / 'briefs').mkdir(exist_ok=True)
wrappers = []
for n, lesson in enumerate(LESSONS, 1):
    w = wrapper(lesson, n)
    wrappers.append(w)
    (HERE / 'manifests' / f"{w['lessonId']}-{lesson['id']}.json").write_text(json.dumps(w, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
(HERE / 'manifest-bundle.json').write_text(json.dumps(wrappers, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
for fname, (title, ids, body) in BRIEFS.items():
    (HERE / 'briefs' / fname).write_text(f'# {title}\n\nCurriculum IDs: {", ".join(ids)} ({SUBJECT}, grade {GRADE}). Source: design review {RUN}.\n' + body, encoding='utf-8')

# ---- validation ------------------------------------------------------------
ids = [l['id'] for l in LESSONS]
assert len(set(ids)) == 10 and set(ids) == set(published)
assert len({g['skill']['id'] for g in sample['selected']}) == 5
for l in LESSONS:
    g, sub = published[l['id']]
    assert sub['id'].startswith(g['skill']['id'])
inst = [c['instanceId'] for w in wrappers for c in w['manifest']['objectiveBlocks'][0]['components']]
assert len(inst) == len(set(inst))
for k in PROBES:
    assert k[0] in published and k[1] in catalog and k[2] in {m['id'] for m in catalog[k[1]]['modes']}
    assert (HERE / 'evidence' / f'{k[0]}-{k[1]}-{k[2]}.json').exists(), k

# ---- HTML --------------------------------------------------------------------
commit = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True, cwd=HERE).stdout.strip()
DEC = {'reuse': ('Reuse', 'ok'), 'repair': ('Repair existing', 'warn'), 'new-mode': ('New mode', 'new'), 'new-primitive': ('New primitive', 'new')}
VER = {'usable': ('usable', 'ok'), 'partial': ('partial', 'warn'), 'unfit': ('wrong fit', 'bad'), 'defect': ('defect', 'bad')}

def lesson_html(n, l, w):
    g, sub = published[l['id']]
    label, cls = DEC[l['decision']]
    seq = ''.join(f"<li><span class='mono'>{esc(b['componentId'])}</span> · <span class='mono'>{esc(b['mode'] or 'no eval modes')}</span> <span class='role'>{esc(b['role'])}</span><div class='bt'>{esc(b['title'])}</div></li>" for b in l['sequence'])
    probes = ''.join(
        f"<tr><td class='mono'>{esc(p)}<br>{esc(m)}</td><td><span class='chip {VER[v][1]}'>{VER[v][0]}</span></td><td>{esc(t)}</td></tr>"
        for (i, p, m), (v, t) in PROBES.items() if i == l['id'])
    ev = ''.join(f'<li>{esc(x)}</li>' for x in l['evidence'])
    lim = ''.join(f'<li>{esc(x)}</li>' for x in l['limits'])
    fname = f"manifests/{w['lessonId']}-{l['id']}.json"
    return f"""
<section class="lesson" id="{esc(l['id'])}">
  <header class="lh">
    <div><div class="eyebrow">Lesson {n} · {esc(g['unitTitle'])} · {esc(g['skill']['description'])}</div>
    <h3>{esc(l['title'])}</h3></div>
    <span class="chip {cls}">{label}</span>
  </header>
  <p class="cur"><span class="mono">{esc(sub['id'])}</span> {esc(sub['description'])}</p>
  <p class="meta">Published target: <span class="mono">{esc(sub.get('target_primitive') or 'none')}</span> (provenance only) · Planned length {l['minutes']} min</p>
  <div class="grid2">
    <div><h4>Learner action</h4><p>{esc(l['action'])}</p>
      <h4>Sequence</h4><ol class="seq">{seq}</ol></div>
    <div><h4>Evidence of mastery</h4><ul>{ev}</ul>
      <h4>Limits found</h4><ul>{lim}</ul></div>
  </div>
  <div class="decision"><strong>{label}.</strong> {esc(l['decisionText'])}</div>
  <h4>Generator probes (one draw per binding, exact curriculum text, grade 1)</h4>
  <div class="tw"><table class="probes"><tbody>{probes or '<tr><td colspan=3>Bindings in this lesson reuse probed modes from other lessons or were not probed (see table).</td></tr>'}</tbody></table></div>
  <details><summary>Manifest JSON · <a href="{esc(fname)}">{esc(fname)}</a></summary><pre>{esc(json.dumps(w['manifest'], indent=2, ensure_ascii=False))}</pre></details>
</section>"""

counts = {k: sum(1 for l in LESSONS if l['decision'] == k) for k in DEC}
vcounts = {k: sum(1 for v, _ in PROBES.values() if v == k) for k in VER}
rows = ''.join(f"<tr><td class='mono'><a href='#{esc(l['id'])}'>{esc(l['id'])}</a></td><td>{esc(published[l['id']][0]['skill']['description'])}</td><td>{esc(l['title'])}</td><td><span class='chip {DEC[l['decision']][1]}'>{DEC[l['decision']][0]}</span></td></tr>" for l in LESSONS)
issues = ''.join(f"<tr><td class='mono'>{esc(i)}</td><td class='mono'>{esc(p)}<br>{esc(m)}</td><td><span class='chip {'bad' if s=='HIGH' else 'warn'}'>{s}</span></td><td><strong>{esc(c)}.</strong> {esc(d)}</td></tr>" for i, p, m, s, c, d, _ in ISSUES)
briefs = ''.join(f"<details class='brief'><summary><strong>{esc(t)}</strong> · {esc(', '.join(ids))} · <a href='briefs/{esc(f)}'>briefs/{esc(f)}</a></summary><pre class='md'>{esc((HERE/'briefs'/f).read_text(encoding='utf-8'))}</pre></details>" for f, (t, ids, _) in BRIEFS.items())
sel = ''.join(f"<li><span class='mono'>{esc(g['skill']['id'])}</span> {esc(g['skill']['description'])}: {', '.join('<span class=mono>'+esc(s['id'])+'</span>' for s in g['selectedSubskills'])} <span class='muted'>(of {len(g['skill']['subskills'])})</span></li>" for g in sample['selected'])
lessons_html = ''.join(lesson_html(n, l, w) for n, (l, w) in enumerate(zip(LESSONS, wrappers), 1))

from report_text import intro, prov  # noqa: E402
INTRO = intro(counts, vcounts, sample)
PROV = prov(sample, catalog, commit, sha, HERE, PROBES, esc)
page = f"""<title>Social Studies G1 Review</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,650&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: one reading column with a sticky section nav; lesson cards carry the detail. */
:root {{
  --bg:#f5f6f3; --surface:#ffffff; --fg:#1e2522; --muted:#5d6762; --line:#d9ddd8;
  --accent:#8a4b2f; --accent-soft:#f3e7df;
  --ok:#2c6e3f; --ok-bg:#e1f0e4; --warn:#8a5a00; --warn-bg:#f7ebcf; --bad:#a3322a; --bad-bg:#f6dfdc; --new:#2f4f9a; --new-bg:#e1e7f6;
  --display:"Source Serif 4", Georgia, serif; --body:"IBM Plex Sans", system-ui, sans-serif; --mono:"IBM Plex Mono", ui-monospace, Consolas, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg:#141917; --surface:#1c2320; --fg:#e4e9e6; --muted:#9aa5a0; --line:#2f3935;
  --accent:#e3a888; --accent-soft:#3a271d;
  --ok:#8fd3a0; --ok-bg:#1d3324; --warn:#e9c071; --warn-bg:#3a2f14; --bad:#f0a199; --bad-bg:#3d2220; --new:#a9bdf0; --new-bg:#22294a; color-scheme:dark; }} }}
:root[data-theme="dark"] {{
  --bg:#141917; --surface:#1c2320; --fg:#e4e9e6; --muted:#9aa5a0; --line:#2f3935;
  --accent:#e3a888; --accent-soft:#3a271d;
  --ok:#8fd3a0; --ok-bg:#1d3324; --warn:#e9c071; --warn-bg:#3a2f14; --bad:#f0a199; --bad-bg:#3d2220; --new:#a9bdf0; --new-bg:#22294a; color-scheme:dark; }}
* {{ box-sizing:border-box }}
body {{ background:var(--bg); color:var(--fg); font:15px/1.6 var(--body); }}
.wrap {{ max-width:980px; margin:0 auto; padding-inline:16px; padding-block:28px 64px; }}
h1,h2,h3 {{ font-family:var(--display); text-wrap:balance; line-height:1.2; margin:0 }}
h1 {{ font-size:2.1rem; font-weight:650 }}
h2 {{ font-size:1.45rem; font-weight:650; margin-top:2.6rem; margin-bottom:.8rem }}
h3 {{ font-size:1.2rem; font-weight:650 }}
h4 {{ font-size:.78rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:1rem 0 .35rem }}
p, li {{ max-width:70ch }}
a {{ color:var(--accent) }}
a:focus-visible, summary:focus-visible {{ outline:2px solid var(--accent); outline-offset:2px }}
.mono {{ font-family:var(--mono); font-size:.86em }}
.muted, .meta {{ color:var(--muted) }}
.meta {{ font-size:.85rem }}
.eyebrow {{ font-size:.74rem; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); margin-bottom:.25rem }}
nav {{ position:sticky; top:env(safe-area-inset-top,0px); z-index:2; background:var(--bg); border-bottom:1px solid var(--line); padding-block:.5rem; display:flex; flex-wrap:wrap; gap:.4rem 1rem; font-size:.88rem }}
.lede {{ font-size:1.05rem; margin-top:.8rem }}
.stats {{ display:flex; flex-wrap:wrap; gap:.5rem; margin-top:1rem }}
.chip {{ display:inline-block; padding:.08rem .55rem; border-radius:999px; font-size:.76rem; font-weight:600; white-space:nowrap }}
.chip.ok {{ background:var(--ok-bg); color:var(--ok) }} .chip.warn {{ background:var(--warn-bg); color:var(--warn) }}
.chip.bad {{ background:var(--bad-bg); color:var(--bad) }} .chip.new {{ background:var(--new-bg); color:var(--new) }}
.tw {{ overflow-x:auto }}
table {{ border-collapse:collapse; width:100%; font-size:.9rem }}
th, td {{ text-align:left; vertical-align:top; padding:.5rem .6rem; border-bottom:1px solid var(--line) }}
th {{ font-size:.75rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); font-weight:600 }}
.lesson {{ background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:1.1rem 1.2rem; margin-top:1.2rem; scroll-margin-top:3.5rem }}
.lh {{ display:flex; justify-content:space-between; align-items:flex-start; gap:1rem }}
.cur {{ font-size:.9rem; background:var(--accent-soft); padding:.6rem .75rem; border-radius:6px; margin:.8rem 0 .4rem; max-width:none }}
.grid2 {{ display:grid; grid-template-columns:1fr 1fr; gap:0 1.6rem }}
.grid2 > div {{ min-width:0 }}
@media (max-width:720px) {{ .grid2 {{ grid-template-columns:1fr }} }}
ul, ol {{ padding-left:1.2rem; margin:.2rem 0 }}
.seq li {{ margin-bottom:.45rem }}
.role {{ color:var(--muted); font-size:.8rem }}
.bt {{ font-size:.86rem }}
.decision {{ border-left:3px solid var(--accent); padding:.4rem .8rem; margin:1rem 0 .2rem; background:var(--accent-soft); border-radius:0 6px 6px 0 }}
details {{ margin-top:.8rem }}
summary {{ cursor:pointer; color:var(--muted); font-size:.88rem }}
pre {{ background:var(--bg); border:1px solid var(--line); border-radius:6px; padding:.7rem; overflow-x:auto; font:12.5px/1.5 var(--mono); max-height:420px }}
pre.md {{ white-space:pre-wrap; font-family:var(--body); font-size:.88rem; max-height:none }}
.brief {{ background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:.7rem 1rem }}
.brief summary {{ color:var(--fg) }}
dl {{ display:grid; grid-template-columns:max-content 1fr; gap:.3rem 1rem; font-size:.88rem }}
dt {{ color:var(--muted) }} dd {{ margin:0; min-width:0; overflow-wrap:anywhere }}
@media (max-width:520px) {{ dl {{ grid-template-columns:1fr }} .lh {{ flex-direction:column }} table.probes td {{ display:block; border-bottom:0; padding-block:.2rem }} table.probes tr {{ display:block; border-bottom:1px solid var(--line); padding-block:.4rem }} }}
@media (prefers-reduced-motion: reduce) {{ * {{ scroll-behavior:auto }} }}
</style>
<div class="wrap">
{INTRO}

<h2 id="sample">Sample</h2>
<p>Seed <span class="mono">{sample['seed']}</span>, {sample['scopedSkillCount']} eligible skills, sampled without replacement at both levels.</p>
<ul>{sel}</ul>
<div class="tw"><table><thead><tr><th>Subskill</th><th>Skill</th><th>Lesson</th><th>Decision</th></tr></thead><tbody>{rows}</tbody></table></div>

<h2 id="lessons">Lessons</h2>
{lessons_html}

<h2 id="issues">Defects found (filed to qa/EVAL_TRACKER.md)</h2>
<div class="tw"><table><thead><tr><th>ID</th><th>Primitive · mode</th><th>Severity</th><th>Finding</th></tr></thead><tbody>{issues}</tbody></table></div>
<p class="meta">Each is from a single draw plus a source read; rates are unmeasured except where the code makes the outcome certain (SSC-F1 unchecked cells).</p>

<h2 id="briefs">Build briefs</h2>
<p>Each brief stands alone for a new session and leaves schema, naming and build order to that session.</p>
{briefs}

<h2 id="provenance">Provenance and validation</h2>
<dl>
{PROV}
</dl>
<p class="meta">Files: <a href="manifest-bundle.json">manifest-bundle.json</a> · <a href="sample.json">sample.json</a> · manifests/ · briefs/ · in the repo only: snapshot.json, catalog.json, evidence/ (qa/curriculum-design-review/ss-g1-2026-10-17/)</p>
</div>
"""
(HERE / 'index.html').write_text(page, encoding='utf-8')
print('ok', len(LESSONS), 'lessons,', len(PROBES), 'probes,', len(BRIEFS), 'briefs')
