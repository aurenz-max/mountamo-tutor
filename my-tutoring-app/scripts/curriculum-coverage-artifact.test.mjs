import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
const html=readFileSync(new URL('../qa/curriculum-coverage/index.html',import.meta.url),'utf8');
test('atlas exposes reviewed fits and real content instead of legacy assignment labels',()=>{
  const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://atlas.test/'}),d=dom.window.document;
  try{
    assert.equal(d.querySelectorAll('#list .row').length,191);
    assert.ok(![...d.querySelectorAll('.edge-line')].some(e=>e.textContent.includes('ai-tutor-session')));
    d.querySelector('[data-record="LA005-01-H"]').click();
    assert.match(d.querySelector('#detail').textContent,/gradable_scale/);
    assert.ok(d.querySelector('.scale-preview .blank'));
    d.querySelector('[data-record="LA004-06-E"]').click();
    assert.match(d.querySelector('#detail').textContent,/No practice was built/);
    d.querySelector('[data-record="LA005-02-I"]').click();
    assert.match(d.querySelector('#detail').textContent,/name the picture without interpreting/);
    assert.ok(d.querySelector('.picture-preview'));
    const riddle=d.querySelector('[data-modality="riddle-cues"]');
    assert.match(riddle.textContent,/Mask the answer symbol/);
    assert.equal(riddle.querySelector('.reveal-demo').open,false);
    assert.equal(riddle.querySelector('[aria-label="Answer picture hidden"]').textContent,'?');
    d.querySelector('[data-record="LA005-03-A"]').click();
    assert.match(d.querySelector('#detail').textContent,/no partner cards|No cards|no cards/i);
    assert.match(d.querySelector('#detail').textContent,/Live interaction.*Not tested/s);
    d.querySelector('[data-view="primitives"]').click();
    assert.equal(d.querySelectorAll('#list .row').length,208);
    d.querySelector('[data-record="letter-workshop"]').click();
    assert.match(d.querySelector('#detail').textContent,/Implementation targets/);
    assert.equal(d.querySelectorAll('#detail [data-requirement]').length,4);
    assert.match(d.querySelector('#detail').textContent,/not reviewed fit/);
    assert.match(d.querySelector('[data-record="letter-workshop"] .chip').textContent,/Built for Letter Workshop/);
    d.querySelector('[data-record="you-and-me"]').click();
    assert.equal(d.querySelectorAll('#detail [data-requirement]').length,2);
    assert.match(d.querySelector('[data-build="you-and-me"]').textContent,/microphone acceptance/);
    d.querySelector('[data-record="story-ribbon"]').click();
    assert.equal(d.querySelectorAll('#detail [data-requirement]').length,2);
    assert.match(d.querySelector('[data-build="story-ribbon"]').textContent,/five eval modes/);
    d.querySelector('[data-record="picture-vocabulary"]').click();
    assert.ok(d.querySelector('[data-requirement="LA005-01-H"]'));
    d.querySelector('[data-requirement="LA005-01-H"]').click();
    assert.match(d.querySelector('#detail').textContent,/gradable_scale/);
    d.querySelector('[data-view="work"]').click();
    assert.deepEqual([...d.querySelectorAll('#list .row')].map(e=>e.dataset.record),['grammar-empty','riddle-cues','picture-stimulus']);
    const workFilter=d.querySelector('#filter');workFilter.value='all';workFilter.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
    const tasks=[...d.querySelectorAll('#list .row')];
    assert.equal(tasks.length,31);
    const buildState={'letter-writing':/Built · letter-workshop/,'oral-interaction':/Partly built · 2 of 14 requirements · you-and-me/,'oral-storytelling':/Partly built · 2 of 14 requirements · story-ribbon/,'two-story-compare':/Partly built · 1 of 7 requirements · story-bridge/};
    for(const task of tasks){
      d.querySelector('[data-record="'+task.dataset.record+'"]').click();
      assert.equal(d.querySelectorAll('.modality-prescription .modality-fields dt').length,5,task.dataset.record);
      const contract=d.querySelector('.modality-prescription').textContent;
      assert.match(contract,buildState[task.dataset.record]||/Proposed contract/,task.dataset.record);
      if(buildState[task.dataset.record])assert.doesNotMatch(contract,/Proposed contract/,task.dataset.record);
      assert.equal(d.querySelectorAll('.build-record').length,buildState[task.dataset.record]?1:0,task.dataset.record);
    }
    d.querySelector('[data-record="letter-writing"]').click();
    assert.equal(d.querySelectorAll('.writing-phases svg').length,3);
    assert.match(d.querySelector('#detail').textContent,/Implemented as letter-workshop/);
    assert.match(d.querySelector('#detail').textContent,/neither captures drawing input nor scores strokes/);
    assert.match(d.querySelector('[data-build="letter-workshop"]').textContent,/Still owed.*52 manuscript forms/s);
    d.querySelector('#detail [data-requirement]').click();
    assert.match(d.querySelector('#detail .eyebrow').textContent,/Development needed/);
    assert.match(d.querySelector('#detail .linked-req').textContent,/Built 2026-09-07 · letter-workshop/);
    assert.ok(d.querySelector('#detail [data-build="letter-workshop"]'));
    assert.match(d.querySelector('.evidence').textContent,/Stroke capture/);
    assert.match(d.querySelector('.evidence').textContent,/Live interaction.*Not tested/s);
    assert.doesNotMatch(d.querySelector('.evidence').textContent,/Voice/);
    d.querySelector('[data-view="work"]').click();
    d.querySelector('[data-record="grammar-empty"]').click();
    assert.match(d.querySelector('#detail').textContent,/Acceptance evidence/);
    assert.ok(d.querySelector('[data-requirement="LA004-06-E"]'));
    d.querySelector('#grades-toggle').click();
    assert.equal(d.querySelectorAll('#matrix tbody tr').length,13);
    d.querySelector('[data-grade="2"][data-subject="SCIENCE"]').click();
    assert.match(d.querySelector('#scope').textContent,/has not been audited/);
    d.querySelector('[data-grade="K"][data-subject="LANGUAGE_ARTS"]').click();
    d.querySelector('[data-view="curriculum"]').click();
    const filter=d.querySelector('#filter');filter.value='failed';filter.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
    assert.equal(d.querySelectorAll('#list .row').length,3);
    filter.value='built';filter.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
    assert.equal(d.querySelectorAll('#list .row').length,9);
    assert.match(d.querySelector('#build-status').textContent,/4 of 12 design themes are built.*Story Ribbon → story-ribbon\); 8 remain proposed/);
    assert.equal(d.querySelector('#build-status').hidden,false);
    const search=d.querySelector('#search');search.value='zzzz-no-match';search.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
    assert.match(d.querySelector('#list').textContent,/No matching records/);
  }finally{dom.window.close();}
});

test('design studio gives every unmapped requirement an explicit treatment and navigable storyboard',()=>{
  const studioHtml=readFileSync(new URL('../qa/curriculum-coverage/design-studio.html',import.meta.url),'utf8');
  const dom=new JSDOM(studioHtml,{runScripts:'dangerously',url:'https://atlas.test/design-studio.html#letter-workshop'}),d=dom.window.document;
  try{
    const themes=[...d.querySelectorAll('[data-theme]')].map(e=>e.dataset.theme);
    assert.equal(themes.length,12);
    const ids=[];
    for(const id of themes){
      d.querySelector('[data-theme="'+id+'"]').click();
      assert.equal(d.querySelectorAll('.frames button').length,3);
      assert.equal(d.querySelector('.frames [aria-pressed="true"]').dataset.frame,'0');
      assert.ok(d.querySelector('.scene').textContent.trim()||d.querySelector('.scene svg'));
      for(let frame=0;frame<3;frame++){
        d.querySelector('.frames [data-frame="'+frame+'"]').click();
        assert.equal(d.querySelector('.frames [aria-pressed="true"]').dataset.frame,String(frame));
        assert.ok(d.querySelector('.student-prompt').textContent.trim());
        assert.match(d.querySelector('.stage-top').textContent,/not a generated lesson/);
      }
      for(const link of d.querySelectorAll('.req a'))ids.push(decodeURIComponent(new URL(link.href).hash.slice(1)));
      assert.ok([...d.querySelectorAll('.req p')].every(p=>p.textContent.length>30));
    }
    const review=JSON.parse(readFileSync(new URL('../qa/curriculum-coverage/review.json',import.meta.url),'utf8'));
    const gaps=Object.entries(review.decisions).filter(([,r])=>!r.candidates.length).map(([id])=>id);
    assert.equal(ids.length,35);
    assert.equal(new Set(ids).size,ids.length);
    assert.deepEqual(ids.sort(),gaps.sort());
    d.querySelector('[data-theme="letter-workshop"]').click();
    assert.ok(d.querySelector('.writing circle'));
    assert.match(d.querySelector('#design .title-row .tag').textContent,/Built as letter-workshop/);
    d.querySelector('[data-theme="story-bridge"]').click();
    assert.match(d.querySelector('#design .title-row .tag').textContent,/Built as story-bridge/);
    d.querySelector('[data-theme="letter-workshop"]').click();
    d.querySelector('.frames [data-frame="2"]').click();
    assert.equal(d.querySelectorAll('.writing path').length,1,'Only ruled lines remain during independent writing');
    assert.equal(d.querySelector('.student-prompt').textContent,'Listen, then write.');
    d.querySelector('[data-theme="word-garden"]').click();
    assert.match(d.querySelector('#design .title-row .tag').textContent,/Proposed design/);
    assert.equal(d.querySelectorAll('.web-scene svg path').length,0,'No answer links before the attempt');
    assert.equal(dom.window.location.hash,'#word-garden');
  }finally{dom.window.close();}
});
