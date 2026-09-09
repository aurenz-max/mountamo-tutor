import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
// K Mathematics atlas (scope math-k). Kept in its own file so the K Language Arts pilot's test
// stays owned by that lane; both run under `node --test scripts/curriculum-coverage-artifact*.test.mjs`.
const html = readFileSync(new URL('../qa/curriculum-coverage/math-k/index.html', import.meta.url), 'utf8');
const review = JSON.parse(readFileSync(new URL('../qa/curriculum-coverage/math-k/review.json', import.meta.url), 'utf8'));
const checks = JSON.parse(readFileSync(new URL('../qa/curriculum-coverage/math-k/content-checks.json', import.meta.url), 'utf8'));

test('K math atlas renders every reviewed requirement, its probes and its findings', () => {
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://atlas.test/math-k/' }), d = dom.window.document;
  try {
    assert.equal(Object.keys(review.decisions).length, 166);
    assert.equal(d.querySelectorAll('#list .row').length, 166);
    assert.match(d.querySelector('#notice').textContent, /K Mathematics · live curriculum audit\. 166 requirements reviewed/);
    assert.match(d.querySelector('#notice').textContent, /26 requirement\/mode pairs/);
    assert.equal(d.querySelector('#studio-link').textContent, '', 'no design studio for this scope');
    assert.equal(d.querySelector('#build-status').hidden, true, 'no build status for this scope');
    // The matrix loads K Mathematics and cross-links the K Language Arts atlas.
    assert.equal(d.querySelector('[data-grade="K"][data-subject="MATHEMATICS"]').getAttribute('aria-pressed'), 'true');
    const la = d.querySelector('a.scope-link[href="../index.html"]');
    assert.ok(la, 'K Language Arts cell links to its own atlas');
    assert.match(la.textContent, /191 reviewed/);
    // Legacy knowledge-check assignments (22 rows) never appear as recommendations.
    assert.ok(![...d.querySelectorAll('[data-record="TIME001-02-A"] .edge-line')].some(e => /knowledge-check/.test(e.textContent)));
    // The teen rows are the closed half of this pair of assertions: slice 2
    // shipped ten-frame's build_teen / decompose_teen and number-bond's
    // ten_and_ones on 2026-09-08, so COUNT001-05-B moved from a cap-below-
    // objective FINDING to a clean re-probe and its work item is gone. What the
    // atlas must still show is the DRAW, the double frame, and that live
    // interaction is untested — a passing content check is not a driven lesson.
    d.querySelector('[data-record="COUNT001-05-B"]').click();
    let detail = d.querySelector('#detail').textContent;
    assert.match(detail, /Frame is double/);
    assert.match(detail, /RE-PROBED 2026-09-08/);
    assert.match(detail, /Live interaction.*Not tested/s);
    assert.ok(!d.querySelector('[data-work="teen-numbers-ten-plus"]'), 'the teen work item is closed');
    // Slice 3 lifted the K ordinal cap; the 2026-09-09 redraw shows the ten-long line.
    d.querySelector('[data-record="COUNT001-04-D"]').click();
    detail = d.querySelector('#detail').textContent;
    assert.match(detail, /Positions reach past fifth/);
    assert.match(detail, /maxPosition 10/);
    assert.match(detail, /RE-PROBED 2026-09-09/);
    // The one finding the redraw ADDED: compare_groups counts above the objective's "up to 5".
    d.querySelector('[data-record="COUNT001-03-A"]').click();
    detail = d.querySelector('#detail').textContent;
    assert.match(detail, /Content finding/);
    assert.match(detail, /both groups stay within 1-5 objects/);
    assert.ok(d.querySelector('[data-work="compare-groups-objective-window"]'));
    // Answer leak in count_from is visible as a failing check with the offending instruction.
    d.querySelector('[data-record="COUNT001-01-I"]').click();
    detail = d.querySelector('#detail').textContent;
    assert.match(detail, /instruction does not recite the answers/);
    assert.match(detail, /Start at 3/);
    // A sampled-clean pair shows its previews and passes. Uses a pair the
    // CURRENT slice re-probed, so the assertion reads a live draw rather than
    // one a later catalog edit has since marked stale — slice 5 re-probed
    // PTRN001-03-C, which is also the row whose P1 it closed, so the
    // clock-reading check is asserted by name and cannot silently regress.
    d.querySelector('[data-record="PTRN001-03-C"]').click();
    detail = d.querySelector('#detail').textContent;
    assert.match(detail, /Samples checked/);
    assert.match(detail, /checks passed/);
    assert.match(detail, /the child is not asked to READ clock times/);
    // A slice-7 birth carries its own draw: measure-lab balance_predict on the weight row.
    d.querySelector('[data-record="MEAS001-04-D"]').click();
    detail = d.querySelector('#detail').textContent;
    assert.match(detail, /measure-lab/);
    assert.match(detail, /expected choice is the heavier object/);
    // Findings filter matches the content-checks file.
    const failedPairs = new Set(checks.filter(c => c.result === 'failed').map(c => c.id));
    const filter = d.querySelector('#filter'); filter.value = 'failed'; filter.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(d.querySelectorAll('#list .row').length, failedPairs.size);
    filter.value = 'tested'; filter.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(d.querySelectorAll('#list .row').length, 26);
    filter.value = 'development'; filter.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    assert.equal(d.querySelectorAll('#list .row').length, 5);
    filter.value = 'all'; filter.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    // Primitives direction: every K math home is scoped to this curriculum.
    d.querySelector('[data-view="primitives"]').click();
    d.querySelector('[data-record="ten-frame"]').click();
    assert.ok(d.querySelector('[data-requirement="COUNT001-05-B"]'));
    d.querySelector('[data-record="balance-scale"]').click();
    assert.ok(!d.querySelector('[data-requirement="MEAS001-04-D"]'), 'the legacy weight assignment is not a reviewed edge');
    // Development queue: every item has a modality prescription and at least one requirement.
    d.querySelector('[data-view="work"]').click();
    // The work tab opens on the "pull next" filter: only ranked (open) items, in execution order.
    const next = [...d.querySelectorAll('#list .row')].map(r => r.dataset.record);
    assert.equal(next.length, 12);
    assert.equal(next[0], 'compare-groups-objective-window');
    const workFilter = d.querySelector('#filter'); // the toolbar is rebuilt on a tab switch
    workFilter.value = 'all'; workFilter.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    const tasks = [...d.querySelectorAll('#list .row')];
    assert.equal(tasks.length, 23);
    for (const task of tasks) {
      d.querySelector('[data-record="' + task.dataset.record + '"]').click();
      assert.equal(d.querySelectorAll('.modality-prescription .modality-fields dt').length, 5, task.dataset.record);
      assert.ok(d.querySelectorAll('#detail [data-requirement]').length >= 1, task.dataset.record);
    }
    d.querySelector('[data-record="count-from-answer-leak"]').click();
    assert.match(d.querySelector('#detail').textContent, /P0/);
    assert.ok(d.querySelector('[data-requirement="COUNT001-01-I"]'));
  } finally { dom.window.close(); }
});
