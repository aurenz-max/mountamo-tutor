const subjects=[['MATHEMATICS','Mathematics'],['LANGUAGE_ARTS','Language Arts'],['SCIENCE','Science'],['SOCIAL_STUDIES','Social Studies']];
const grades=['K',...Array.from({length:12},(_,i)=>String(i+1))];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId=new Map(DATA.catalog.map(p=>[p.id,p]));
const labels={candidate:'Direct candidate',partial:'Partial support',development:'Development needed'};
let state={grade:DATA.grade,subject:DATA.subject,view:'curriculum',query:'',unit:'',filter:'all',selected:null};
let allGrades=false;
try{state.selected=decodeURIComponent(location.hash.slice(1))||null;}catch{}
const available=()=>state.grade===DATA.grade&&state.subject===DATA.subject;
const scopeRows=()=>available()?DATA.requirements:[];
const status=r=>r.review.content==='failed'?'content-failed':r.review.content==='stale'?'stale':r.review.fit;
const hasFinding=r=>r.evidence.some(e=>e.result==='failed');
const badge=r=>r.review.content==='failed'?'Content finding':r.review.content==='stale'?(hasFinding(r)?'Finding recorded; source changed':'Evidence stale'):labels[r.review.fit];
const counts=()=>Object.fromEntries(['candidate','partial','development'].map(k=>[k,scopeRows().filter(r=>r.review.fit===k).length]));
function matrix(){
  const visibleGrades=allGrades?grades:[...new Set(['K','1','2',state.grade])];
  document.querySelector('#matrix').innerHTML='<thead><tr><th>Grade</th>'+subjects.map(s=>'<th>'+esc(s[1])+'</th>').join('')+'</tr></thead><tbody>'+visibleGrades.map(g=>'<tr><th scope="row">'+(g==='K'?'Kinder':'Grade '+g)+'</th>'+subjects.map(([id,name])=>{
    const loaded=g===DATA.grade&&id===DATA.subject;
    const numbers=['candidate','partial','development'].map(k=>DATA.requirements.filter(r=>r.review.fit===k).length);
    return '<td><button data-grade="'+g+'" data-subject="'+id+'" aria-label="'+esc(name)+', grade '+g+(loaded?', 191 requirements reviewed':', not loaded')+'" aria-pressed="'+(state.grade===g&&state.subject===id)+'" class="'+(loaded?'loaded':'')+'">'+(loaded?'<span class="cell-title">'+DATA.requirements.length+' reviewed</span><span class="mini-bar">'+numbers.map((n,i)=>'<i class="bar-'+i+'" style="flex:'+n+'"></i>').join('')+'</span><span>'+numbers.join(' / ')+'</span>':'Not loaded')+'</button></td>';
  }).join('')+'</tr>').join('')+'</tbody>';
}
function scope(){
  const title=(subjects.find(s=>s[0]===state.subject)?.[1]||state.subject)+' · '+(state.grade==='K'?'Kindergarten':'Grade '+state.grade);
  const c=counts(),tested=scopeRows().filter(r=>r.evidence.length).length,failed=scopeRows().filter(hasFinding).length,stale=scopeRows().filter(r=>r.review.content==='stale').length;
  document.querySelector('#scope').innerHTML='<div class="section-head scope-head"><h2>'+esc(title)+'</h2><small>'+(available()?'Published curriculum · explicit capability review':'No snapshot loaded')+'</small></div>'+(available()?
    '<div class="stats"><div class="stat"><b>'+c.candidate+'</b><span>Direct candidates · not certified</span></div><div class="stat"><b>'+c.partial+'</b><span>Partial support · unmet actions</span></div><div class="stat"><b>'+c.development+'</b><span>Requirements needing development</span></div><div class="stat"><b>'+tested+' / '+scopeRows().length+'</b><span>Requirements with content probes</span></div></div>'+
    '<div class="notice"><strong>'+failed+' sampled pairs have recorded content findings.</strong> '+(stale?stale+' pairs have changed source hashes; their saved draws are historical evidence and need revalidation. ':'')+'Every row has an action-based catalog review. Six pairs have two saved generation draws each; live interaction remains untested. Blue means a direct candidate, not a verified learning outcome.</div>'+
    '<div class="toolbar"><div class="tabs" aria-label="Reference direction">'+[['curriculum','Curriculum → primitives'],['primitives','Primitives → curriculum'],['work','Development queue']].map(([v,t])=>'<button data-view="'+v+'" aria-pressed="'+(state.view===v)+'">'+t+'</button>').join('')+'</div>'+
    '<input id="search" type="search" placeholder="Find a concept, ID, mode or development task…" aria-label="Search requirements and primitives" value="'+esc(state.query)+'">'+
    '<select id="unit" aria-label="Filter curriculum unit"><option value="">All units</option>'+[...new Set(scopeRows().map(r=>r.unit))].sort().map(u=>'<option '+(u===state.unit?'selected':'')+'>'+esc(u)+'</option>').join('')+'</select>'+
    '<select id="filter" aria-label="Filter review findings"><option value="all">All findings</option><option value="candidate">Direct candidates</option><option value="partial">Partial support</option><option value="development">Development needed</option><option value="tested">Content probed</option><option value="failed">Recorded content findings</option><option value="stale">Evidence needs revalidation</option><option value="unmapped">No reviewed home</option></select></div>'+
    '<div class="result-count" id="count" role="status"></div><div class="workspace"><div id="list" class="list" aria-label="Matching records"></div><aside id="detail" class="detail" aria-label="Selected record and evidence"></aside></div>':
    '<div class="empty"><h3>This scope has not been audited.</h3><p>No fit verdict exists for this grade and subject. Its missing snapshot is not a curriculum gap.</p></div>');
  if(available()){document.querySelector('#filter').value=state.filter;results();}
}
function matchFilter(r){return state.filter==='all'||state.filter===r.review.fit||state.filter==='tested'&&r.evidence.length>0||state.filter==='failed'&&hasFinding(r)||state.filter==='stale'&&r.review.content==='stale'||state.filter==='unmapped'&&!r.review.candidates.length;}
function records(){
  const rows=scopeRows().filter(r=>!state.unit||r.unit===state.unit),q=state.query.toLowerCase();
  if(state.view==='curriculum')return rows.filter(r=>matchFilter(r)&&[r.text,r.id,r.skill,r.review.reason,...r.review.candidates.flatMap(e=>[e.primitive,e.mode])].join(' ').toLowerCase().includes(q)).sort((a,b)=>(hasFinding(a)?0:a.evidence.length?1:2)-(hasFinding(b)?0:b.evidence.length?1:2));
  if(state.view==='primitives')return DATA.catalog.map(p=>({...p,refs:rows.filter(r=>r.review.candidates.some(e=>e.primitive===p.id))})).filter(p=>(state.filter==='all'||state.filter==='unmapped'&&p.refs.length===0||state.filter!=='unmapped'&&p.refs.some(matchFilter))&&[p.id,p.description,...p.modes.map(m=>m.id),...p.refs.map(r=>r.text)].join(' ').toLowerCase().includes(q)).sort((a,b)=>b.refs.length-a.refs.length);
  return DATA.workItems.map(w=>({...w,refs:rows.filter(r=>w.requirements.includes(r.id))})).filter(w=>w.refs.length&&(state.filter==='all'||w.refs.some(matchFilter))&&[w.title,w.target,w.problem,w.proposal,w.executor,...w.refs.map(r=>r.text)].join(' ').toLowerCase().includes(q)).sort((a,b)=>a.priority.localeCompare(b.priority)||b.refs.length-a.refs.length);
}
function results(){
  const rows=records();if(!rows.some(r=>r.id===state.selected))state.selected=rows[0]?.id??null;
  document.querySelector('#count').textContent=rows.length+' '+({curriculum:'requirements',primitives:'primitives',work:'development tasks'}[state.view])+' shown'+(state.view==='primitives'?' · includes partial candidates; homes are scoped to this curriculum':'');
  document.querySelector('#list').innerHTML=rows.length?rows.map(r=>'<button class="row" data-record="'+esc(r.id)+'" aria-pressed="'+(state.selected===r.id)+'">'+rowMarkup(r)+'</button>').join(''):'<div class="empty">No matching records. Clear search or adjust the filters.</div>';
  detail(rows.find(r=>r.id===state.selected));
}
function rowMarkup(r){
  if(state.view==='curriculum')return '<span class="units">'+esc(r.unit)+'</span><span class="row-title">'+esc(r.text.split('\n')[0])+'</span><span class="row-bottom"><span>'+esc(r.id)+'</span><span class="chip '+status(r)+'">'+badge(r)+'</span></span><div class="edge-line">'+(r.review.candidates.length?r.review.candidates.map(e=>'<span>'+esc(e.primitive)+' <b> / '+esc(e.mode)+'</b></span>').join(''):'<span>'+esc(DATA.workItems.find(w=>w.id===r.review.work)?.title||'New capability required')+'</span>')+'</div>';
  if(state.view==='primitives')return '<span class="units">'+esc(r.domain)+' · '+r.modes.length+' declared modes</span><span class="row-title">'+esc(r.id)+'</span><span class="row-bottom"><span>'+r.refs.length+' reviewed curriculum connections</span><span class="chip">'+(r.refs.length?'Candidate / partial edges':'No reviewed home in scope')+'</span></span>';
  return '<span class="units">'+esc(r.priority)+' · '+esc(r.kind)+'</span><span class="row-title">'+esc(r.title)+'</span><span class="row-bottom"><span>'+r.refs.length+' requirements affected</span><span class="chip">'+esc(r.target)+'</span></span>';
}
function evidence(r){
  const d=r.review;
  const checks=[...new Set(DATA.workItems.filter(w=>w.requirements.includes(r.id)).map(w=>w.modality.liveCheck))];
  return '<h3>Evidence, by stage</h3><div class="evidence"><div><strong>Capability</strong>'+esc(d.reviewLevel)+'<br><b>'+labels[d.fit]+'</b></div><div><strong>Content</strong>'+({failed:'Finding confirmed',sampled:'Samples checked',stale:'Stale · rerun',not_tested:'Not tested'}[d.content])+(r.evidence.length?'<br>'+r.evidence.length+(d.content==='stale'?' saved draws':' source-matched draws'):'')+'</div><div><strong>Live interaction</strong>Not tested<br>'+esc(checks.join('; ')||'Required student action and feedback need a live check')+'</div></div>'+(d.contentNote?'<p class="evidence-note">'+esc(d.contentNote)+'</p>':'');
}
function modalityView(w){
  const m=w.modality;
  let demo='';
  if(w.id==='riddle-cues')demo='<div class="design-demo"><div class="phase-strip"><div><small>Independent attempt</small><div class="picture-preview" aria-label="Answer picture hidden">?</div><p>I shine bright in the sky during the day and keep you warm. What am I?</p><small>Child reasons from the clues and responds aloud.</small></div><div><small>Feedback · after the attempt</small><details class="reveal-demo"><summary>Preview the feedback reveal</summary><div class="picture-preview" role="img" aria-label="Sun">☀️</div><p>The sun gives us daylight and warmth.</p><small>This reveal is assistance. An independent retry needs a fresh riddle.</small></details></div></div></div>';
  if(w.id==='letter-writing')demo='<div class="design-demo"><div class="phase-strip writing-phases">'+[
    ['Trace','Follow the visible path.','<path d="M50 20 V95 Q50 105 62 100" stroke="#658e7b" stroke-dasharray="4 4"/>'],
    ['Copy','Model beside a blank writing area.','<path d="M18 20 V55 Q18 62 26 59" stroke="#18332f"/><rect x="38" y="12" width="54" height="98" stroke="#afbeb2" stroke-dasharray="3 3"/>'],
    ['Write','Hear “write lowercase l”; no form shown.','<rect x="12" y="12" width="80" height="98" stroke="#afbeb2" stroke-dasharray="3 3"/>']
  ].map(([title,caption,marks])=>'<div><strong>'+title+'</strong><svg viewBox="0 0 104 124" role="img" aria-label="'+esc(caption)+'"><path d="M7 22 H97 M7 102 H97" stroke="#d9e0da"/><g fill="none" stroke-width="3" stroke-linecap="round">'+marks+'</g></svg><small>'+caption+'</small></div>').join('')+'</div><small>Illustrative lowercase l only. These are design diagrams, not a drawing surface or validated stroke templates.</small></div>';
  return '<section class="modality-prescription" data-modality="'+esc(w.id)+'"><h3>Required modality · '+esc(w.title)+'</h3><span class="chip development">Proposed contract · not implemented or verified</span>'+demo+
    '<dl class="modality-fields">'+[['stimulus','Present'],['response','Student does'],['visibility','Show / mask'],['feedback','After the attempt'],['score','Evidence to score']].map(([k,label])=>'<div><dt>'+label+'</dt><dd>'+esc(m[k])+'</dd></div>').join('')+'</dl>'+
    (m.reuseFinding?'<details><summary>Existing implementation inspected</summary><p>'+esc(m.reuseFinding)+'</p>'+m.reuseSources.map(s=>'<p><small>'+esc(s.path)+'<br>SHA-256: '+esc(s.sha256)+'</small></p>').join('')+'</details>':'')+'</section>';
}
function preview(s){
  let scene='';
  if(s.kind==='scale')scene='<div class="scale-preview">'+s.scale.map((w,i)=>'<span class="'+(i===s.targetIndex?'blank':'')+'">'+esc(i===s.targetIndex?'?':w)+'</span>').join('')+'</div>';
  else if(s.emoji)scene='<div class="picture-preview">'+esc(s.emoji)+'</div>'+(s.stimulus?'<div class="stimulus-label">'+esc(s.stimulus)+'</div>':'');
  return '<div class="task-preview">'+scene+'<p class="ask">“'+esc(s.prompt)+'”</p><small>Child responds aloud</small><details><summary>Answer / scoring reference</summary><p>'+esc(s.answer||'See the source scoring contract')+'</p>'+(s.kind==='association'?'<small>This is one example; other defensible related objects may be accepted.</small>':'')+'</details></div>';
}
function drawView(e){
  return '<details class="draw" '+(e.draw===1?'open':'')+'><summary>Draw '+e.draw+' · '+e.itemCount+' usable items · '+(e.stale?'stale':e.result==='failed'?'finding':'checks passed')+'</summary><p><small>Reconstructed task previews from actual payloads and production cue builders; not a recording of the component.</small></p>'+(e.samples.length?e.samples.map(preview).join(''):'<div class="empty"><strong>No practice was built.</strong><p>The generator returned an empty item set. The student cannot attempt this objective.</p></div>')+'<div class="checklist">'+e.checks.map(c=>'<div class="check '+(c.pass?'ok':'bad')+'">'+(c.pass?'✓ ':'× ')+esc(c.name)+(c.detail?' <small>'+esc(c.detail)+'</small>':'')+'</div>').join('')+'</div><small>'+esc(e.requestedAt)+' · '+(e.durationMs/1000).toFixed(1)+' seconds · endpoint reported '+esc(e.endpointStatus)+'</small></details>';
}
function linkedRequirement(r){return '<button class="linked-req" data-requirement="'+esc(r.id)+'"><small>'+esc(r.id)+' · '+badge(r)+'</small><span>'+esc(r.text.split('\n')[0])+'</span></button>';}
function detail(r){
  const target=document.querySelector('#detail');if(!r){target.innerHTML='<p class="muted">Select a record to inspect its fit and evidence.</p>';return;}
  if(state.view==='curriculum'){
    const d=r.review;
    const design=DATA.designs.find(t=>t.requirements.some(ref=>ref.id===r.id));
    target.innerHTML='<span class="eyebrow">'+badge(r)+'</span><h2>'+esc(r.text.split('\n')[0])+'</h2><small>'+esc(r.id)+' · '+esc(r.skill)+'</small><h3>Why this fit</h3><p>'+esc(d.reason)+'</p>'+
      (design?'<a class="linked-req" href="design-studio.html#'+esc(design.id)+'"><small>Visual design concept · proposed</small><span>Explore '+esc(design.title)+' →</span></a>':'')+
      (d.candidates.length?'<div class="route">'+d.candidates.map(e=>{const p=byId.get(e.primitive),m=p.modes.find(m=>m.id===e.mode);return '<div class="mode"><strong>'+esc(e.primitive)+'</strong><br><span class="chip">'+esc(e.mode)+'</span><p>'+esc(m.description)+'</p><details><summary>Capability constraints & source</summary><p>'+esc(p.constraints)+'</p><small>'+esc(e.source)+'</small></details></div>';}).join('')+'</div>':'')+
      evidence(r)+'<h3>Next concrete action</h3><p>'+esc(d.nextAction)+'</p>'+DATA.workItems.filter(w=>w.requirements.includes(r.id)).map(w=>'<button class="linked-req" data-work="'+esc(w.id)+'"><small>'+esc(w.priority)+' · '+esc(w.executor)+'</small><span>'+esc(w.title)+'</span></button>'+modalityView(w)).join('')+
      (r.evidence.length?'<h3>Actual generated content</h3>'+r.evidence.map(drawView).join(''):'')+
      '<details><summary>Original curriculum & audit provenance</summary><p class="verbatim">'+esc(r.text)+'</p><small>Legacy assignment (not used as the recommendation): '+esc(r.primitive||'None')+'<br>Review: '+esc(d.reviewedAt)+'<br>Requirement SHA-256: '+esc(d.requirementHash)+'</small></details>';
  }else if(state.view==='primitives'){
    target.innerHTML='<span class="eyebrow">Primitive → curriculum</span><h2>'+esc(r.id)+'</h2><p>'+esc(r.description)+'</p><h3>Reviewed homes in this scope</h3>'+(r.refs.length?r.refs.map(linkedRequirement).join(''):'<p class="muted">No reviewed edge in K Language Arts. This does not mean the primitive is unused or lacks a home in another subject/grade.</p>')+'<h3>Declared modes</h3>'+r.modes.map(m=>'<div class="mode"><strong>'+esc(m.id)+'</strong><p>'+esc(m.description)+'</p><small>'+r.refs.filter(ref=>ref.review.candidates.some(e=>e.primitive===r.id&&e.mode===m.id)).length+' reviewed edges</small></div>').join('');
  }else{
    target.innerHTML='<span class="eyebrow">'+esc(r.priority)+' · '+esc(r.kind)+'</span><h2>'+esc(r.title)+'</h2><span class="chip">'+esc(r.target)+'</span><h3>What is missing</h3><p>'+esc(r.problem)+'</p><h3>Smallest useful change</h3><p>'+esc(r.proposal)+'</p>'+modalityView(r)+'<h3>Acceptance evidence</h3><p>'+esc(r.acceptance)+'</p><h3>Executor</h3><p>'+esc(r.executor)+'</p><h3>Affected requirements ('+r.refs.length+')</h3>'+r.refs.map(linkedRequirement).join('');
  }
}
document.addEventListener('click',e=>{
  if(e.target.id==='grades-toggle'){allGrades=!allGrades;e.target.textContent=allGrades?'Show early grades':'Show all grades';e.target.setAttribute('aria-expanded',String(allGrades));matrix();}
  const cell=e.target.closest('[data-grade]');if(cell){state={...state,grade:cell.dataset.grade,subject:cell.dataset.subject,selected:null,unit:'',filter:'all',query:''};matrix();scope();document.querySelector('#scope').scrollIntoView?.({behavior:'smooth',block:'start'});}
  const tab=e.target.closest('[data-view]');if(tab){state.view=tab.dataset.view;state.selected=null;scope();}
  const row=e.target.closest('[data-record]');if(row){state.selected=row.dataset.record;results();}
  const requirement=e.target.closest('[data-requirement]');if(requirement){state={...state,view:'curriculum',selected:requirement.dataset.requirement,filter:'all',query:''};scope();}
  const work=e.target.closest('[data-work]');if(work){state={...state,view:'work',selected:work.dataset.work,filter:'all',query:''};scope();}
  if((row||requirement)&&state.view==='curriculum'){try{history.replaceState(null,'','#'+encodeURIComponent(state.selected));}catch{}}
});
document.addEventListener('input',e=>{if(e.target.id==='search'){state.query=e.target.value;results();}});
document.addEventListener('change',e=>{if(e.target.id==='unit'||e.target.id==='filter'){state[e.target.id]=e.target.value;results();}});
document.querySelector('#sources').innerHTML='Published read: '+esc(DATA.sourceUrl)+'<br>Fetched: '+esc(DATA.fetchedAt)+'<br>Snapshot: '+esc(DATA.snapshotPath)+'<br>Curriculum SHA-256: '+esc(DATA.snapshotHash)+'<br>Catalog SHA-256: '+esc(DATA.catalogHash)+'<br>Artifact built: '+esc(DATA.generated)+'<br>Review: 191 explicit action-to-capability decisions. Legacy assignments are provenance only.<br>Content: 12 saved draws over 6 exact requirement/mode pairs. Evidence is invalidated when recorded source hashes change.<br>Code verification: '+DATA.verification.tests+' tests across '+DATA.verification.suites+' suites passed. '+esc(DATA.verification.note);
matrix();scope();
