const fs=require('fs');const path=require('path');
for(const f of process.argv.slice(2)){if(!fs.existsSync(f))continue;const d=JSON.parse(fs.readFileSync(f,'utf8'));
console.log(`\n== ${path.basename(f,'.json')}  (${d.objective})${d.err?' ERR '+d.err:''}`);
for(const p of d.problems){const stem=(p.question||p.statement||p.textWithBlanks||p.instruction||p.prompt||'').replace(/\s+/g,' ');
const o=(p.options||[]).map(o=>o.text+(o.id===p.correctOptionId?'*':'')).join(' / ');
const ex=p.blanks?` blanks=${p.blanks.length}`:p.items?` items=${p.items.length}`:p.leftItems?` pairs=${p.leftItems.length}`:'';
const sh=p.itemSpace?`β${p.itemSpace.beta} ${p.itemSpace.structure}`:`${p.type}/${p.difficulty}${ex}${p.inset?' inset='+p.inset.type:''}`;
console.log(`  [${sh}] ${stem.slice(0,220)}${o?'  {'+o+'}':''}`);
if(p.items&&!p.leftItems)console.log('     items:',JSON.stringify(p.items).slice(0,250));
if(p.leftItems)console.log('     pairs:',JSON.stringify(p.leftItems.map(x=>x.text||x)).slice(0,200));
if(p.categories)console.log('     cats:',JSON.stringify(p.categories).slice(0,200));
if(p.inset&&p.inset.content)console.log('     inset:',String(p.inset.content).replace(/\s+/g,' ').slice(0,250));
}}
