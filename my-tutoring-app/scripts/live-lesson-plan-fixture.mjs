// Project a Lesson Bench package into the live lesson plan the sandbox runs, plus
// the production DI drive plan for each runner-owned item. No generation, no writes.
// Usage (from my-tutoring-app): node scripts/live-lesson-plan-fixture.mjs <package.json> [objectiveId ...]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vite from 'vite';

const [packagePath, ...objectiveIds] = process.argv.slice(2);
if (!packagePath) throw new Error('Pass a lesson package path.');
const root = process.cwd();
const server = await vite.createServer({ root, configFile: false, appType: 'custom', logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  resolve: { alias: { '@': resolve(root, 'src'), 'server-only': resolve(root, 'vitest.stubs/server-only.ts') } },
});
try {
  const load = vite.createServerModuleRunner(server.environments.ssr, { hmr: false });
  const { parseLessonPackage } = await load.import('/src/components/lumina/service/qa/lessonBench/lessonPackage.ts');
  const { projectLessonPlan, planForTutor } = await load.import('/src/components/lumina/components/live-activity/livePlan.ts');
  const { LIVE_ADAPTERS } = await load.import('/src/components/lumina/components/live-activity/activityContract.ts');
  const { buildLiveActivitySpec } = await load.import('/src/components/lumina/components/live-activity/liveActivitySpec.ts');
  const { getComponentById } = await load.import('/src/components/lumina/service/manifest/catalog/index.ts');
  const { buildDiDrivePlan } = await load.import('/src/components/lumina/service/qa/di/diDrivePlan.ts');
  const pkg = parseLessonPackage(JSON.parse(readFileSync(resolve(root, packagePath), 'utf8')));
  const plan = projectLessonPlan(pkg, objectiveIds.length ? { objectiveIds } : {});
  const out = {
    planId: plan.planId, topic: plan.topic, gradeLevel: plan.gradeLevel, unavailable: plan.unavailable,
    tutorPlan: { topic: plan.topic, items: planForTutor(plan) },
    activitySpec: buildLiveActivitySpec(plan.items.map(item => item.primitiveId)),
    items: plan.items.map(item => ({
      itemId: item.itemId, primitiveId: item.primitiveId, evalMode: item.evalMode,
      teachingOwner: LIVE_ADAPTERS[item.primitiveId].teachingOwner,
      planItem: { itemId: item.itemId, title: item.title, intent: item.intent, evalMode: item.evalMode, objective: item.objective.text },
      data: item.data,
      initialState: LIVE_ADAPTERS[item.primitiveId].initialState(item.data),
      tutoring: getComponentById(item.primitiveId)?.tutoring ?? null,
      diPlan: LIVE_ADAPTERS[item.primitiveId].teachingOwner === 'di-runner'
        ? buildDiDrivePlan(item.primitiveId, { ...item.data }, plan.gradeLevel) : null,
    })),
  };
  process.stdout.write(JSON.stringify(out));
} finally {
  await server.close();
}
