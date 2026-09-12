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
const html=fs.readFileSync(path.join(__dirname,'review.template.html'),'utf8').replace('__DATA__',JSON.stringify(data).replace(/</g,'\\u003c'));
fs.writeFileSync(path.join(__dirname,'index.html'),html);
console.log(JSON.stringify({math:math.length,di:di.length,extras:extras.length,scope:math.filter(x=>x.misconceptionScope).map(x=>x.id),generators:rows.filter(x=>x.generator).length,components:rows.filter(x=>x.component).length},null,2));
