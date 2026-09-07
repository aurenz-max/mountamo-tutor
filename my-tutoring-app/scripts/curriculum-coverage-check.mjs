import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, createServerModuleRunner } from 'vite';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'qa/curriculum-coverage');
const server = await createServer({ configFile:false,root,logLevel:'error',appType:'custom',server:{middlewareMode:true,hmr:false,ws:false,watch:null},resolve:{alias:{'@':resolve(root,'src')}} });
try {
  const runner = createServerModuleRunner(server.environments.ssr,{hmr:false});
  const pv = await runner.import('/src/components/lumina/primitives/visual-primitives/literacy/pictureVocabularyScript.ts');
  const ws = await runner.import('/src/components/lumina/primitives/visual-primitives/literacy/wordSorterScript.ts');
  const results=[];
  for(const file of readdirSync(resolve(dir,'evidence')).filter(f=>f.endsWith('.json'))){
    const r=JSON.parse(readFileSync(resolve(dir,'evidence',file),'utf8'));
    const data=r.response?.fullData;
    if(!data) { results.push({...r,file,checks:[{name:'Generated content exists',pass:false}],result:'failed'});continue; }
    let items=data.items??data.challenges??[];
    if(r.primitive==='picture-vocabulary')items=pv.itemsFromChallenges(data.challenges??[]);
    if(r.primitive==='word-sorter')items=ws.itemsFromChallenges(data.challenges??[]);
    const checks=[{name:'Student-facing item set is nonempty after production item conversion',pass:items.length>0,detail:`${items.length} usable items`}];
    const samples=[];
    for(const item of items){
      if(r.mode==='gradable_scale'){
        checks.push({name:`${item.id}: scale target agrees with answer`,pass:item.scaleWords?.[item.scaleTargetIndex]===item.word});
        const spoken=pv.scaleSpokenFor(item);
        checks.push({name:`${item.id}: spoken scale omits target`,pass:!spoken.toLowerCase().split(/[^a-z]+/).includes(item.word.toLowerCase())});
        samples.push({id:item.id,kind:'scale',scale:item.scaleWords,targetIndex:item.scaleTargetIndex,prompt:spoken,answer:item.word});
      }else if(r.mode==='association'){
        checks.push({name:`${item.id}: picture stimulus is a pictograph`,pass:/\p{Extended_Pictographic}/u.test(item.baseEmoji??''),detail:item.baseEmoji});
        checks.push({name:`${item.id}: partner differs from stimulus`,pass:item.word!==item.baseWord});
        samples.push({id:item.id,kind:'association',emoji:item.baseEmoji,stimulus:item.baseWord,prompt:`What goes with ${item.baseWord}?`,answer:item.word});
      }else if(r.mode==='sentence_frame'){
        checks.push({name:`${item.id}: spoken frame omits target`,pass:!item.frameSpoken.toLowerCase().split(/[^a-z]+/).includes(item.word.toLowerCase())});
        samples.push({id:item.id,kind:'frame',prompt:item.frameSpoken,answer:item.word});
      }else if(r.primitive==='di-spoken-practice'){
        if(r.id==='LA005-02-I')checks.push({name:`${item.id}: riddle requires clue reasoning rather than an answer picture`,pass:item.stimulusKind!=='emoji',detail:'Source rendering shows stimulusEmoji before the answer; these icons depict the riddle solutions.'});
        samples.push({id:item.id,kind:'riddle',emoji:item.stimulusEmoji,prompt:item.ask,answer:item.expectedAnswer});
      }else if(r.primitive==='word-sorter'){
        samples.push({id:item.id,kind:'sort',prompt:ws.askFor(item),answer:item.answer,choices:item.choices,stimulus:item.word,emoji:item.emoji});
      }
    }
    if(r.primitive==='word-sorter')for(const ch of data.challenges??[])for(const w of ch.words??[])checks.push({name:`${ch.id}/${w.id}: answer names an existing group`,pass:ch.bucketLabels.includes(w.correctBucket)});
    const semantic={
      'LA005-01-H':'Reviewed both draws: size and temperature scales appear and their rungs are ordered. The task elicits missing vocabulary in an ordered list; it does not independently establish using all words in sentences.',
      'LA005-03-A':'Pairs are everyday associations, but the student produces a partner aloud. No cards are matched. Draw 2 also contains baseEmoji="pillows", plain text instead of a picture.',
      'LA005-02-I':'Every generated riddle displays an icon of its answer. The child can name the picture without interpreting the clues. This candidate fails the curriculum evidence requirement in both draws.',
      'LA004-06-E':'Both draws return an empty items array. The component renders its no-practice state. The eval-test API pass is a false positive for actual usable content; this candidate cannot currently support the objective.',
      'LA004-01-A':'Both draws supply nouns and action verbs with labels and emoji cues. The student says the category; there is no card manipulation. Noun examples do not systematically cover places, and ambiguous stand-alone verbs need context. This is partial support.',
      'LA005-02-H':'The frames are reasonable sentence-context noun completions. Source rendering deliberately hides the answer emoji until solved; there is no contextual scene illustration. Picture-clue reasoning remains unmet.',
    }[r.id];
    results.push({id:r.id,primitive:r.primitive,mode:r.mode,draw:r.draw,file,inputHash:r.inputHash,sourceHashes:r.sourceHashes,
      requestedAt:r.requestedAt,durationMs:r.durationMs,httpStatus:r.httpStatus,endpointStatus:r.response.status,
      itemCount:items.length,result:checks.every(c=>c.pass)?'sampled':'failed',checks,semantic,samples,
      interaction:'not_tested',interactionNote:'Production item converters and cue builders executed. No live microphone/session was driven.'});
  }
  writeFileSync(resolve(dir,'content-checks.json'),JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify({draws:results.length,sampled:results.filter(r=>r.result==='sampled').length,failed:results.filter(r=>r.result==='failed').length,items:results.reduce((n,r)=>n+(r.itemCount??0),0)}));
}finally{await server.close();}
