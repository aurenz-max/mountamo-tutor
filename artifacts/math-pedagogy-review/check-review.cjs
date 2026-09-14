const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('../../my-tutoring-app/node_modules/jsdom');
const errors = [];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', error => errors.push(error.message));
const dom = new JSDOM(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), {
  runScripts: 'dangerously', virtualConsole,
});
const doc = dom.window.document;
assert.deepEqual(errors, []);
assert.match(doc.querySelector('#shared-applicability').textContent, /shared LLM planner/);
assert.equal(doc.querySelectorAll('#adaptation-draws tr').length, 2);
assert.match(doc.querySelector('#adaptation-draws').textContent, /6,191/);
assert.match(doc.querySelector('#adaptation-draws').textContent, /8,905/);
assert.equal(doc.querySelector('#current-library').textContent, '69');
assert.equal(doc.querySelectorAll('#general-observation-examples li').length, 2);
assert.equal(doc.querySelectorAll('#two-primitive-draws tr').length, 4);
assert.match(doc.querySelector('#two-primitive-draws').textContent, /base-ten-blocks/);
assert.match(doc.querySelector('#two-primitive-draws').textContent, /7,000/);
assert.match(doc.querySelector('#general-observation-examples').textContent, /Saved strength/);
assert.match(doc.querySelector('#general-observation-examples').textContent, /Saved support/);
const planFile = JSON.parse(fs.readFileSync(path.join(__dirname, 'plans.json'), 'utf8'));
assert.equal(doc.querySelectorAll('#plan-matrix tbody tr').length, planFile.plans.length);
assert.equal(doc.querySelectorAll('#plan-cards .plan-card').length, planFile.plans.length);
assert.equal(doc.querySelectorAll('#cards .primitive .plan-link').length, planFile.plans.length);
for (const plan of planFile.plans) {
  const card = doc.getElementById('plan-' + plan.id);
  assert.ok(card, 'plan card ' + plan.id);
  assert.equal(card.querySelectorAll('dt').length, planFile.stations.length, 'stations for ' + plan.id);
  for (const move of plan.capability.moves) assert.match(card.textContent, new RegExp(move.id));
  assert.match(card.querySelector('summary').textContent, new RegExp(plan.status, 'i'));
}
assert.equal(doc.querySelectorAll('#plan-matrix tbody .status-implemented').length, planFile.plans.filter(p => p.status === 'implemented').length);
if (planFile.plans.some(p => /^Not run/.test(p.probe))) assert.match(doc.querySelector('#plan-matrix').textContent, /Not run/);
assert.match(doc.querySelector('#plan-matrix').textContent, /PASS/);
for (const anchor of doc.querySelectorAll('#progress a[href], #plans a[href]')) {
  const href = anchor.getAttribute('href');
  if (href.startsWith('#') || /^https?:/.test(href)) continue;
  assert.ok(fs.existsSync(path.resolve(__dirname, href)), `Missing link: ${href}`);
}
dom.window.close();
console.log(`Review verified: scripts, two harness draws, 69 inventory entries, ${planFile.plans.length} build plans and progress/plan links.`);
