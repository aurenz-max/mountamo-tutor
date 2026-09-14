const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const ts = require(path.join(root, 'my-tutoring-app/node_modules/typescript'));
const base = 'my-tutoring-app/src/components/lumina/';
const read = p => fs.readFileSync(path.join(root,p),'utf8');
function parse(p){return ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true);}
function value(n){
 if(!n)return null;
 if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))return n.text;
 if(ts.isNumericLiteral(n))return +n.text;
 if(n.kind===ts.SyntaxKind.TrueKeyword)return true;
 if(n.kind===ts.SyntaxKind.FalseKeyword)return false;
 if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.PlusToken)return String(value(n.left)||'')+String(value(n.right)||'');
 if(ts.isArrayLiteralExpression(n))return n.elements.map(value);
 if(ts.isObjectLiteralExpression(n))return Object.fromEntries(n.properties.filter(ts.isPropertyAssignment).map(p=>[p.name.getText().replace(/['"]/g,''),value(p.initializer)]));
 return {$ref:n.getText()};
}
function catalog(p,name){const ast=parse(p);let out=[];function walk(n){if(ts.isVariableDeclaration(n)&&n.name.getText()===name)out=n.initializer.elements.map(e=>({...value(e),source:p,line:ast.getLineAndCharacterOfPosition(e.getStart()).line+1}));ts.forEachChild(n,walk)}walk(ast);return out;}
const math = catalog(base+'service/manifest/catalog/math.ts','MATH_CATALOG');
const di = catalog(base+'service/manifest/catalog/di.ts','DI_CATALOG').filter(x=>['di-math-facts','di-dice-roll','di-shapes','di-worked-procedure','di-word-problem-setup'].includes(x.id));
const genMap={};
for(const p of ['mathGenerators.ts','diGenerators.ts']){
 const file=base+'service/registry/generators/'+p;if(!fs.existsSync(path.join(root,file)))continue;
 const ast=parse(file), imports={};
 for(const st of ast.statements)if(ts.isImportDeclaration(st)&&st.importClause?.namedBindings&&ts.isNamedImports(st.importClause.namedBindings))for(const e of st.importClause.namedBindings.elements)imports[e.name.text]=path.posix.normalize(path.posix.join(path.posix.dirname(file),st.moduleSpecifier.text+'.ts'));
 function walk(n){if(ts.isCallExpression(n)&&/register.*Generator/.test(n.expression.getText())&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0])){const id=n.arguments[0].text;for(const [fn,file]of Object.entries(imports))if(n.getText().includes(fn+'('))genMap[id]=file;}ts.forEachChild(n,walk)}walk(ast);
}
const walkFiles=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walkFiles(dir+'/'+e.name):[dir+'/'+e.name]);
const components=walkFiles(base+'primitives').filter(p=>p.endsWith('.tsx')&&!/test|__tests__/.test(p));
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases={'3d-shape-explorer':'ThreeDShapeExplorer','systems-equations-visualizer':'SystemsEquationsVisualizer','matrix-display':'MatrixDisplay'};
const extras=Object.keys(genMap).filter(id=>!math.some(x=>x.id===id)&&id==='spatial-path').map(id=>({id,description:'Registered math generator; absent from MATH_CATALOG. Availability through other catalogs or launch paths was not verified.',source:base+'service/registry/generators/mathGenerators.ts',line:421,registryOnly:true}));
const rows=[...math,...di,...extras].map(x=>{
 const generator=genMap[x.id];const gt=generator?read(generator):'';
 const component=components.find(p=>norm(path.basename(p,'.tsx'))===norm(aliases[x.id]||x.id));const ct=component?read(component):'';
 return {...x,catalog:x.registryOnly?'Registry only':x.id.startsWith('di-')?'Math DI':'Math',generator,component,
 signals:{scope:x.misconceptionScope||null,tutor:!!x.tutoring,modes:Array.isArray(x.evalModes)?x.evalModes.length:x.evalModes?.$ref||0,
 evidence:/diagnosisEvidence|DiagnosisEvidence/.test(ct),remediation:/buildRemediationPrompt\s*\(|build\w*Remediation\w*\s*\(|ctx\.remediationFocus|config\??\.remediationFocus/.test(gt),support:/supportTier|SupportTier|supportScaffold/.test(gt)}};
});
fs.writeFileSync(path.join(__dirname,'inventory.json'),JSON.stringify(rows,null,2));
const proposals=fs.readFileSync(path.join(__dirname,'opportunities.txt'),'utf8').trim().split(/\r?\n/).map(line=>{
 const parts=line.split('|');if(parts.length!==6)throw new Error('Invalid proposal: '+line);
 const [id,domain,misconception,probe,teaching,transfer]=parts;return {id,domain,misconception,probe,teaching,transfer};
});
if(new Set(proposals.map(x=>x.id)).size!==proposals.length)throw new Error('Duplicate proposal');
if(rows.length!==proposals.length)throw new Error('Inventory/proposal count mismatch');
const data=rows.map(x=>{const p=proposals.find(p=>p.id===x.id);if(!p)throw new Error('Missing proposal '+x.id);return {...x,...p};});
// Per-primitive build plans (plans.json). Validated against the inventory so a plan
// can never name a primitive, station or move that the review cannot back.
const planFile=JSON.parse(fs.readFileSync(path.join(__dirname,'plans.json'),'utf8'));
const stationKeys=planFile.stations.map(([k])=>k);
const planStatuses=new Set(['planned','implemented','later']);
if(new Set(planFile.plans.map(p=>p.id)).size!==planFile.plans.length)throw new Error('Duplicate plan');
for(const p of planFile.plans){
 const row=rows.find(x=>x.id===p.id);if(!row)throw new Error('Plan for unknown primitive '+p.id);
 if(!planStatuses.has(p.status))throw new Error('Bad plan status '+p.id);
 for(const k of stationKeys)if(p[k]==null)throw new Error(`Plan ${p.id} missing station ${k}`);
 if(!Array.isArray(p.capability.moves)||!p.capability.moves.length)throw new Error('Plan without moves '+p.id);
 for(const m of p.capability.moves)if(!/^[a-z][a-z_]+$/.test(m.id))throw new Error('Bad move id '+m.id);
 // An "implemented" claim must be visible in the generator's direct file.
 if(p.status==='implemented'&&!row.signals.remediation)throw new Error('Implemented plan without a generator remediation marker: '+p.id);
 if(p.status!=='implemented'&&row.signals.remediation)throw new Error('Generator has a remediation marker but the plan is not implemented: '+p.id);
 for(const f of p.files)if(!/\(new\)$/.test(f)&&!fs.existsSync(path.join(root,f)))throw new Error(`Plan ${p.id} names a missing file ${f}`);
}
const runDir='my-tutoring-app/qa/misconception/place-value-opportunities/2026-09-12T21-17-43-669Z/';
const pilot={generated:JSON.parse(read(runDir+'targeted-1.json')), generation:JSON.parse(read(runDir+'report.json')),
 store:JSON.parse(read(runDir+'real-store-report.json')), runDir,
 authenticated:JSON.parse(read('my-tutoring-app/qa/misconception/place-value-opportunities/pvc-http-qa-2b1fa50ecef746f6813e784ce95bd780/authenticated-report.json'))};
const demoDir='my-tutoring-app/qa/misconception/place-value-opportunities/pvc-http-qa-1d28be47cc404d9f8db70ec924df4684/';
pilot.demo={dir:demoDir, report:JSON.parse(read(demoDir+'authenticated-report.json')),
  baseline:JSON.parse(read(demoDir+'generation-baseline.json')),
  draws:[0,1].map(i=>JSON.parse(read(demoDir+`generation-targeted-${i}.json`)))};
const encode=x=>JSON.stringify(x).replace(/</g,'\\u003c');
const responseDir='my-tutoring-app/qa/misconception/place-value-opportunities/pvc-http-qa-da7b82ddce4e4396b67df3c9698a7339/';
pilot.responseObservations={dir:responseDir, report:JSON.parse(read(responseDir+'authenticated-report.json')),
  evidence:JSON.parse(read(responseDir+'general-observations.json'))};
const bridgeDir='my-tutoring-app/qa/misconception/place-value-opportunities/pvc-http-qa-d562ee3ca0d94c5d8856f08a6ce90e1e/';
pilot.bridge={dir:bridgeDir, report:JSON.parse(read(bridgeDir+'authenticated-report.json')),
  draws:JSON.parse(read(bridgeDir+'two-primitive-demonstration.json'))};
const progress=fs.readFileSync(path.join(__dirname,'progress.html'),'utf8').replace('__PILOT__',encode(pilot));
const html=fs.readFileSync(path.join(__dirname,'review.template.html'),'utf8')
 .replace('__PROGRESS__',progress).replace('__DATA__',encode(data)).replace('__PLANS__',encode(planFile))
 .replaceAll('__MATH_CAPTURE__',String(math.filter(x=>x.misconceptionScope).length))
 .replaceAll('__MATH_NAMES__',math.filter(x=>x.misconceptionScope).map(x=>x.id).join(', '));
fs.writeFileSync(path.join(__dirname,'index.html'),html);
console.log(JSON.stringify({math:math.length,di:di.length,extras:extras.length,scope:math.filter(x=>x.misconceptionScope).map(x=>x.id),generators:rows.filter(x=>x.generator).length,components:rows.filter(x=>x.component).length,plans:planFile.plans.map(p=>`${p.id}:${p.status}`)},null,2));
