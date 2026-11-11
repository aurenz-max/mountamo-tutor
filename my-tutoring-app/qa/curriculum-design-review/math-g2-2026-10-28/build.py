"""Build the Grade 2 Math curriculum design review: manifests, bundle, briefs, HTML.

Run from anywhere: python build.py. Reads sample.json, catalog.json and evidence/*.json
from this directory (lesson content in content.py); writes manifests/, briefs/, manifest-bundle.json and index.html.
The lesson decisions below are authored review content, not generated.
"""
import hashlib
import html
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent
sample = json.loads((HERE / 'sample.json').read_text(encoding='utf-8'))
catalog = {p['id']: p for p in json.loads((HERE / 'catalog.json').read_text(encoding='utf-8'))}
published = {s['id']: (g, s) for g in sample['selected'] for s in g['selectedSubskills']}
SUBJECT, GRADE, GRADE_LABEL, RUN = 'MATHEMATICS', '2', 'Grade 2', 'math-g2-2026-10-28'
LUMINA = 'my-tutoring-app/src/components/lumina/'
sys.path.insert(0, str(HERE))
from content import PROBES, LESSONS, ISSUES, BRIEFS, CONCLUSION, RECS, binding  # noqa: E402

HANDOFF = ('**Handoff.** Inspect current repository guidance (CLAUDE.md, the owning primitive contract in '
           '`docs/contracts/` if present, and the relevant `/add-*` or `/primitive` skill) before designing. Schema, '
           'architecture, mode naming, generator approach and build order are yours to choose. Deliver the working '
           'capability with the verification those skills require, and recheck the observations below against the code first: '
           'they describe the code on 2026-10-28 (commit {commit}). Most were read in source, not reproduced: Gemini generation was blocked by a spend cap during this review.')


def curr(ids):
    out = []
    for i in ids:
        g, s = published[i]
        out.append(f"- **{i}** ({g['skill']['id']} {g['skill']['description']}): {s['description']}")
    return '\n'.join(out)


# ---------------------------------------------------------------------------

def esc(s):
    return html.escape(str(s), quote=True)

def comp(lesson, i, b):
    g, s = published[lesson['id']]
    cfg = {'targetEvalMode': b['mode'], 'subject': 'Mathematics', 'unitTitle': g['unitTitle']}
    if b['difficulty']:
        cfg['difficulty'] = b['difficulty']
    return {'componentId': b['componentId'], 'instanceId': f"{lesson['id'].lower()}-{i}-{b['componentId']}",
            'title': b['title'], 'intent': b['intent'], 'config': cfg}

def manifest_for(lesson):
    g, s = published[lesson['id']]
    comps = [comp(lesson, i + 1, b) for i, b in enumerate(lesson['sequence'])]
    return {'topic': lesson['title'], 'gradeLevel': GRADE_LABEL, 'themeColor': '#3b5bdb', 'subject': SUBJECT,
            'objectiveBlocks': [{'objectiveId': 'obj1', 'objectiveText': s['description'], 'objectiveVerb': lesson['verb'], 'components': comps}],
            'layout': [dict(c, objectiveIds=['obj1']) for c in comps]}

def wrapper(lesson, n):
    g, s = published[lesson['id']]
    return {'lessonId': f'lesson-{n:02d}',
            'curriculum': {'subject': SUBJECT, 'grade': GRADE, 'unitId': g['unitId'], 'skillId': g['skill']['id'], 'subskillId': s['id'],
                           'description': s['description'], 'targetPrimitive': s.get('target_primitive'), 'difficultyRange': s.get('difficulty_range')},
            'status': 'authored; catalog-checked; source-reviewed; generator-probed only where code-only (Gemini monthly cap blocked the rest); not hydrated; not runtime-tested',
            'learnerAction': lesson['action'], 'estimatedMinutes': lesson['minutes'],
            'manifest': manifest_for(lesson),
            'sequence': [{'instanceId': f"{lesson['id'].lower()}-{i+1}-{b['componentId']}", 'role': b['role']} for i, b in enumerate(lesson['sequence'])],
            'evidenceCriteria': lesson['evidence'], 'coverageLimits': lesson['limits'],
            'recommendation': {'kind': lesson['decision'], 'proposedBinding': None, 'rationale': lesson['decisionText']}}

def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=HERE, capture_output=True, text=True).stdout.strip()

# --- validate --------------------------------------------------------------
assert len(LESSONS) == 10 and len({l['id'] for l in LESSONS}) == 10
assert {l['id'] for l in LESSONS} == set(published)
assert len({published[l['id']][0]['skill']['id'] for l in LESSONS}) == 5
for gsel in sample['selected']:
    sib = {c['id'] for c in gsel['skill']['subskills']}
    assert all(s['id'] in sib for s in gsel['selectedSubskills'])
for l in LESSONS:
    for b in l['sequence']:
        assert b['componentId'] in catalog, b['componentId']
        assert b['mode'] in [m['id'] for m in catalog[b['componentId']]['modes']], (b['componentId'], b['mode'])
        key = (l['id'], b['componentId'], b['mode'])
        if key in PROBES:
            assert (HERE / 'evidence' / f"{key[0]}-{key[1]}-{key[2]}.json").exists(), key
for b in BRIEFS:
    assert all(i in published for i in b['ids'])

(HERE / 'manifests').mkdir(exist_ok=True)
(HERE / 'briefs').mkdir(exist_ok=True)
wrappers = []
for n, lesson in enumerate(LESSONS, 1):
    w = wrapper(lesson, n)
    wrappers.append(w)
    (HERE / 'manifests' / f"{w['lessonId']}-{lesson['id']}.json").write_text(json.dumps(w, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
(HERE / 'manifest-bundle.json').write_text(json.dumps(wrappers, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
inst = [c['instanceId'] for w in wrappers for c in w['manifest']['objectiveBlocks'][0]['components']]
assert len(inst) == len(set(inst))
for f in (HERE / 'manifests').glob('*.json'):
    json.loads(f.read_text(encoding='utf-8'))

for b in BRIEFS:
    text = f"# {b['title']}\n\n*Kind: {b['kind']} · Curriculum design review {RUN} · written 2026-10-28*\n\n## Curriculum (published, verbatim)\n{curr(b['ids'])}\n\n{b['body']}\n{HANDOFF.format(commit=commit[:10])}\n"
    (HERE / 'briefs' / f"{b['slug']}.md").write_text(text, encoding='utf-8')

# --- HTML ------------------------------------------------------------------
DEC = {'reuse': ('Reuse', 'ok'), 'repair': ('Repair existing', 'warn'), 'new-mode': ('New mode', 'new'), 'new-primitive': ('New primitive', 'new')}
VER = {'usable': ('usable', 'ok'), 'partial': ('partial', 'warn'), 'unfit': ('wrong fit', 'bad'), 'defect': ('defect', 'bad')}
brief_for = {i: b for b in BRIEFS for i in b['ids']}

def lesson_html(n, l, w):
    g, s = published[l['id']]
    d, dc = DEC[l['decision']]
    rows = []
    for i, b in enumerate(l['sequence']):
        pv = PROBES.get((l['id'], b['componentId'], b['mode']))
        badge = f'<span class="tag {VER[pv[0]][1]}">{VER[pv[0]][0]}</span> {esc(pv[1])}' if pv else '<span class="tag">not probed (Gemini cap)</span>'
        rows.append(f"<tr><td>{i+1}</td><td><code>{esc(b['componentId'])}</code><br><code>{esc(b['mode'])}</code>{' · '+esc(b['difficulty']) if b['difficulty'] else ''}</td><td><b>{esc(b['title'])}</b><br><span class='muted'>{esc(b['role'])}</span></td><td>{badge}</td></tr>")
    fname = f"manifests/{w['lessonId']}-{l['id']}.json"
    br = brief_for.get(l['id'])
    brl = f' <a href="briefs/{esc(br["slug"])}.md">Brief: {esc(br["title"])}</a>' if br else ''
    return f'''<section class="card" id="{esc(l['id'])}">
  <div class="head"><span class="num">{n}</span><div><h3>{esc(l['title'])}</h3><p class="muted"><code>{esc(l['id'])}</code> · {esc(g['skill']['id'])} {esc(g['skill']['description'])} · {esc(g['unitTitle'])}</p></div><span class="tag {dc}">{d}</span></div>
  <blockquote>{esc(s['description'])}<br><span class="muted">Curriculum target: <code>{esc(s.get('target_primitive'))}</code> · difficulty range {esc(s.get('difficulty_range'))}</span></blockquote>
  <p><b>Learner action.</b> {esc(l['action'])} <span class="muted">(~{l['minutes']} min)</span></p>
  <div class="scroll"><table><thead><tr><th>#</th><th>Binding</th><th>Activity</th><th>Probe (one draw, grade 2)</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div>
  <div class="two"><div><h4>Evidence</h4><ul>{''.join(f'<li>{esc(x)}</li>' for x in l['evidence'])}</ul></div>
  <div><h4>Limits</h4><ul>{''.join(f'<li>{esc(x)}</li>' for x in l['limits'])}</ul></div></div>
  <p class="decision"><b>Decision: {d}.</b> {esc(l['decisionText'])}{brl}</p>
  <details><summary>Manifest JSON · <a href="{esc(fname)}">{esc(fname)}</a></summary><pre>{esc(json.dumps(w['manifest'], indent=2, ensure_ascii=False))}</pre></details>
</section>'''

sample_rows = ''.join(
    f"<tr><td><a href='#{esc(l['id'])}'>{n}</a></td><td><code>{esc(published[l['id']][0]['skill']['id'])}</code> {esc(published[l['id']][0]['skill']['description'])}</td><td><code>{esc(l['id'])}</code></td><td><code>{esc(published[l['id']][1].get('target_primitive'))}</code></td><td><span class='tag {DEC[l['decision']][1]}'>{DEC[l['decision']][0]}</span></td></tr>"
    for n, l in enumerate(LESSONS, 1))
brief_rows = ''.join(f"<li><a href='briefs/{esc(b['slug'])}.md'>{esc(b['title'])}</a> <span class='tag {DEC[b['kind']][1]}'>{DEC[b['kind']][0]}</span> <span class='muted'>{', '.join(b['ids'])}</span></li>" for b in BRIEFS)
issue_rows = ''.join(f"<tr><td><code>{esc(p)}</code></td><td>{esc(t)}</td><td>{esc(e)}</td><td><code>{esc(r)}</code></td></tr>" for p, t, e, r in ISSUES)
sources = sorted({b['componentId'] for l in LESSONS for b in l['sequence']})
sel = '; '.join(f"{g['skill']['id']} → {', '.join(s['id'] for s in g['selectedSubskills'])}" for g in sample['selected'])

page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Grade 2 Math Review</title>
<style>
:root{{--bg:#f7f7f5;--fg:#1d1f24;--muted:#5f6470;--card:#fff;--line:#e3e3df;--ok:#2b7a4b;--okb:#e5f3ea;--warn:#8a5a00;--warnb:#fbf0d9;--bad:#a12d2d;--badb:#f9e3e3;--new:#3b4fc4;--newb:#e6e9fb;--code:#f0f0ec}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#16181c;--fg:#e6e7ea;--muted:#9aa0ab;--card:#1f2228;--line:#30343c;--ok:#7fd0a0;--okb:#1e3328;--warn:#e8c27a;--warnb:#3a2f17;--bad:#f09a9a;--badb:#3d2020;--new:#a9b4ff;--newb:#262c4d;--code:#2a2e35}}}}
:root[data-theme="dark"]{{--bg:#16181c;--fg:#e6e7ea;--muted:#9aa0ab;--card:#1f2228;--line:#30343c;--ok:#7fd0a0;--okb:#1e3328;--warn:#e8c27a;--warnb:#3a2f17;--bad:#f09a9a;--badb:#3d2020;--new:#a9b4ff;--newb:#262c4d;--code:#2a2e35}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,Segoe UI,sans-serif}}
main{{max-width:1040px;margin:0 auto;padding:24px 16px 64px}}a{{color:var(--new)}}h1{{font-size:1.7rem;margin:.2em 0}}h2{{margin-top:2.2em;border-bottom:1px solid var(--line);padding-bottom:.3em}}
h3{{margin:0;font-size:1.15rem}}h4{{margin:.6em 0 .2em}}.muted{{color:var(--muted)}}code{{background:var(--code);padding:0 4px;border-radius:4px;font-size:.88em;overflow-wrap:anywhere}}
nav{{display:flex;flex-wrap:wrap;gap:6px 14px;margin:12px 0}}.card{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px;margin:18px 0}}
.head{{display:flex;gap:12px;align-items:flex-start}}.head>div{{flex:1;min-width:0}}.num{{background:var(--newb);color:var(--new);border-radius:50%;min-width:30px;height:30px;display:grid;place-items:center;font-weight:600}}
.tag{{display:inline-block;padding:1px 8px;border-radius:99px;font-size:.78rem;font-weight:600;background:var(--code);white-space:nowrap}}.ok{{background:var(--okb);color:var(--ok)}}.warn{{background:var(--warnb);color:var(--warn)}}.bad{{background:var(--badb);color:var(--bad)}}.new{{background:var(--newb);color:var(--new)}}
blockquote{{margin:12px 0;padding:8px 12px;border-left:3px solid var(--line);background:var(--bg);border-radius:4px}}
.scroll{{overflow-x:auto}}table{{border-collapse:collapse;width:100%;font-size:.92rem}}th,td{{text-align:left;vertical-align:top;padding:6px 8px;border-bottom:1px solid var(--line)}}
.two{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}@media (max-width:720px){{.two{{grid-template-columns:1fr}}}}ul{{padding-left:1.2em;margin:.3em 0}}
.decision{{background:var(--bg);padding:8px 12px;border-radius:6px}}details{{margin-top:10px}}pre{{background:var(--code);padding:10px;border-radius:6px;overflow:auto;font-size:.8rem;max-height:420px}}
dl{{display:grid;grid-template-columns:170px 1fr;gap:6px 14px}}@media (max-width:640px){{dl{{grid-template-columns:1fr}}}}dt{{font-weight:600}}dd{{margin:0;overflow-wrap:anywhere}}
</style></head><body><main>
<p class="muted">Curriculum design review · {RUN}</p>
<h1>Grade 2 Math: 10 sampled lessons (second sample)</h1>
<p>{CONCLUSION}</p>
<nav><a href="#sample">Sample</a><a href="#lessons">Lessons</a><a href="#recs">Recommendations</a><a href="#issues">Defects to queue</a><a href="#prov">Provenance</a></nav>

<h2 id="sample">Sample</h2>
<p class="muted">Seeded random draw: 5 of 21 eligible skills, then 2 subskills per skill, without replacement. A random sample, not a coverage audit.</p>
<div class="scroll"><table><thead><tr><th>#</th><th>Skill</th><th>Subskill</th><th>Curriculum target</th><th>Decision</th></tr></thead><tbody>{sample_rows}</tbody></table></div>

<h2 id="lessons">Lessons</h2>
{''.join(lesson_html(n, l, w) for n, (l, w) in enumerate(zip(LESSONS, wrappers), 1))}

<h2 id="recs">Recommendations</h2>
<ol>{''.join(f'<li>{r}</li>' for r in RECS)}</ol>
<p>Briefs:</p><ul>{brief_rows}</ul>
<p class="muted">Curriculum note: OPS002-01-c and several siblings name a target primitive in their constraint text. Those names were treated as hints; three of them (addition-subtraction-scene, shape-tracer, fraction-circles for 03-c) cannot meet the objective they are attached to.</p>

<h2 id="issues">Defects to queue</h2>
<p class="muted">Found during this review; none fixed here. Evidence: "source" = read in code; "probe" = seen in a saved generation; "recorded run" = earlier saved QA output.</p>
<div class="scroll"><table><thead><tr><th>Primitive</th><th>Finding</th><th>Evidence</th><th>Where</th></tr></thead><tbody>{issue_rows}</tbody></table></div>

<h2 id="prov">Provenance</h2>
<dl>
<dt>Curriculum</dt><dd>{esc(sample['sourceUrl'])} · retrieved 2026-10-28T11:25Z · snapshot.json SHA-256 <code>{sha(HERE/'snapshot.json')}</code> (byte-identical to the 10-27 snapshot)</dd>
<dt>Sampling</dt><dd>{esc(sample['algorithm'])} · seed <code>{sample['seed']}</code> · Python {esc(sample['pythonVersion'])} · {sample['scopedSkillCount']} skills in scope, {len(sample['eligibleSkillIds'])} eligible, none excluded · selected: {esc(sel)}. Fresh seed, first draw. OPS002-01-a and OPS002-01-c were also in the 10-27 sample.</dd>
<dt>Catalog</dt><dd>Live UNIVERSAL_CATALOG exported via export-catalog.mjs (Vite module runner), 237 primitives · catalog.json SHA-256 <code>{sha(HERE/'catalog.json')}</code></dd>
<dt>Code</dt><dd>Commit <code>{esc(commit)}</code> (branch ship/2026-08-10-judged-loop). Source-read: generators, components, workspaces and contracts for {', '.join(f'<code>{esc(s)}</code>' for s in sources)}, plus shape-tracer, fraction-bar, polygon-area-builder, area-model, addition-subtraction-scene, di-shapes and shape-composer (ruled out). Four parallel read-only source reviews; key claims spot-checked by hand (ShapeBuilder.tsx:1484, gemini-shape-builder.ts:775-778, CoinCounter.tsx:410, ArrayGrid.tsx:986, FractionCircles.tsx:717-722, fractionEqualBuild.ts:73-77, gemini-shape-tracer.ts:848-860). Paths are relative to <code>{LUMINA}</code>.</dd>
<dt>Probes</dt><dd>19 draws attempted through <code>/api/lumina/eval-test</code> (probe.mjs), exact published text as topic and intent, grade 2, difficulty medium. 16 returned HTTP 500 "exceeded its monthly spending cap" (Google AI Studio project cap) and 1 returned an empty payload for the same reason; these are kept in evidence-failed/. 2 code-only generators returned (evidence/). Gemini spend recorded by the meter: $0.00.</dd>
<dt>Validated</dt><dd>10 distinct subskills under 5 distinct skills with parent membership; every binding's component and eval mode exists in the live catalog; instance IDs unique; probed bindings have evidence files; manifests are valid JSON; curriculum text copied from the snapshot.</dd>
<dt>Not done</dt><dd>Gemini-backed generation (spend cap); no lesson hydrated; nothing rendered or played; no Live tutor run. Findings marked "source" were read in code, not reproduced.</dd>
</dl>
<p class="muted">Files: <a href="manifest-bundle.json">manifest-bundle.json</a> · <a href="sample.json">sample.json</a> · manifests/ · briefs/ · snapshot.json, catalog.json, evidence/ (qa/curriculum-design-review/{RUN}/)</p>
</main></body></html>
'''
(HERE / 'index.html').write_text(page, encoding='utf-8')
print('ok', len(wrappers), 'lessons', len(inst), 'bindings', len(BRIEFS), 'briefs')
