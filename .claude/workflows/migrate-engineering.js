export const meta = {
  name: 'migrate-engineering-primitives',
  description: 'Migrate all engineering visual-primitives onto the Lumina UI kit (frame only), then verify tsc against baseline and fix regressions',
  phases: [
    { title: 'Migrate', detail: 'one agent per primitive — swap chrome to Lumina* kit, leave the interaction surface' },
    { title: 'Verify', detail: 'single full tsc run + grep, diff against 1444 baseline' },
    { title: 'Fix', detail: 'one agent per file that regressed tsc' },
  ],
};

const DIR = 'my-tutoring-app/src/components/lumina/primitives/visual-primitives/engineering';
const REPO = 'c:/Users/xbox3/claude web tutor';
const BASELINE = 1444;

const FILES = [
  'MachineProfile.tsx', 'VehicleComparisonLab.tsx', 'PropulsionTimeline.tsx', 'BlueprintCanvas.tsx',
  'WheelAxleExplorer.tsx', 'GearTrainBuilder.tsx', 'TransportChallenge.tsx', 'FoundationBuilder.tsx',
  'LeverLab.tsx', 'TowerStacker.tsx', 'VehicleDesignStudio.tsx', 'PropulsionLab.tsx',
  'ShapeStrengthTester.tsx', 'DumpTruckLoader.tsx', 'ConstructionSequencePlanner.tsx', 'RampLab.tsx',
  'ExcavatorArmSimulator.tsx', 'EngineExplorer.tsx', 'AirfoilLab.tsx', 'PaperAirplaneDesigner.tsx',
  'FlightForcesExplorer.tsx', 'BridgeBuilder.tsx', 'PulleySystemBuilder.tsx', 'HydraulicsLab.tsx',
];

const MIGRATE_SCHEMA = {
  type: 'object',
  required: ['file', 'status', 'summary'],
  properties: {
    file: { type: 'string' },
    status: { enum: ['migrated', 'already-clean', 'partial', 'error'] },
    originalLines: { type: 'number' },
    newLines: { type: 'number' },
    glassStringsRemoved: { type: 'number' },
    stateHandlersRemoved: { type: 'number' },
    kitComponentsUsed: { type: 'array', items: { type: 'string' } },
    shadcnRetained: { type: 'array', items: { type: 'string' }, description: 'shadcn parts kept + why' },
    interactionSurfaceLeftAlone: { type: 'string', description: 'what canvas/SVG/drag surface was preserved untouched' },
    flaggedForKitPromotion: { type: 'array', items: { type: 'string' } },
    selfGrepClean: { type: 'boolean', description: 'true if chrome grep returns only legit interaction-surface matches' },
    summary: { type: 'string' },
  },
};

const rules = (file) => `You are migrating ONE Lumina primitive onto the Lumina UI kit. File:
  ${REPO}/${DIR}/${file}

## Read FIRST (authoritative, do not skip)
1. The kit barrel — the live list of Lumina* components you must use:
   ${REPO}/my-tutoring-app/src/components/lumina/ui/index.ts
2. The tokens (surfaces/text/accents/answer-state colors/tiers):
   ${REPO}/my-tutoring-app/src/components/lumina/ui/tokens.ts
3. The target file itself: ${REPO}/${DIR}/${file}
   Skim 2-3 sibling kit components (e.g. LuminaCard.tsx, LuminaButton.tsx, LuminaPanel.tsx,
   LuminaFeedbackCard.tsx, LuminaActionButton.tsx, LuminaAnswerChoice.tsx) to learn their exact props.

## The boundary — FRAME, not painting (most important rule)
These are large interactive engineering primitives. The bespoke INTERACTION SURFACE —
<canvas>, SVG simulation, drag targets, the object the student manipulates, physics readouts
drawn on the sim — STAYS CUSTOM and UNTOUCHED. Never wrap a canvas/SVG/drag grid in a
LuminaCard-shaped box. Migrate ONLY the chrome AROUND the interaction: outer card, header,
title/description, readout panels, buttons, badges, accordions, eval/feedback chrome.
When in doubt about whether something is frame or painting, LEAVE IT ALONE.

## What to swap (cross-check against the barrel for the current full list)
- Container glass div / <Card className="backdrop-blur-xl bg-slate-900/40 border-white/10 …"> -> LuminaCard (+ LuminaCardHeader/Title/Description/Content). Drop the glass className entirely; it's baked in. Use surface="nested"|"elevated" instead of hand-tuning bg.
- Nested section div (bg-black/20 border border-white/10 rounded-lg p-4) -> LuminaPanel (accent="cyan" etc. for a category rail). NOTE: LuminaPanel is ALWAYS nested and takes NO surface prop — accent only. <LuminaPanel surface=...> is a type error.
- <Button variant="ghost" className="bg-white/5 border border-white/20 …"> -> LuminaButton. Map intent to tone: default=ghost(default), emphasized=primary, destructive=danger, quiet=subtle. Remove inline style/onMouseEnter/onMouseLeave/hover strings.
- <Badge className="bg-slate-800/50 border-slate-700/50 text-{c}-300"> -> LuminaBadge accent="{c}".
- Custom expand/collapse state OR shadcn Accordion + glass -> LuminaAccordion / LuminaAccordionItem.
- Eval loop (if present): hand-rolled answer-state FSM -> LuminaAnswerChoice; feedback banner -> LuminaFeedbackCard (status correct|incorrect|insight); solid bg-blue-600/bg-blue-500/80 submit + reset/next -> LuminaActionButton (action check|retry|next); "Need a hint?" -> LuminaHintDisclosure; score ring/tier -> LuminaScoreRing (tier via getPerformanceTier/TIERS — never a local TIER_CONFIG).
- Generic typed-answer <input type="number"> with native spinners (bg-slate-700/800) -> LuminaInput. BUT leave grid-cell / bg-transparent interaction inputs alone (they're the painting).
- Other shadcn parts not wrapped by the kit (Tabs/Slider/Switch): import from @/components/ui/* and theme via the exported tokens (surface/text/accentText) — NEVER retype literal glass strings. If a chrome pattern repeats, note it in flaggedForKitPromotion.
- Per-item grading colors on a drag/match/sort surface -> tokenize via answerStateClasses[state]/answerStateClass(state). Transient interaction states (drag-in-progress highlight) stay bespoke.

## Import path
From this domain folder the kit is at '../../../ui':
  import { LuminaCard, LuminaCardHeader, LuminaCardTitle, LuminaCardDescription, LuminaCardContent, LuminaButton, LuminaBadge, LuminaPanel } from '../../../ui';
Remove now-unused @/components/ui/{card,button,badge} imports. Keep imports you still use.

## Constraints
- PRESERVE ALL FUNCTIONALITY. Handlers, props, generator data, eval logic, sound calls — unchanged. This is visual/structural refactoring only.
- Write the COMPLETE migrated file in ONE Write operation (never partial edits — broken JSX has bitten this repo repeatedly).
- Do NOT run tsc (a single project-wide tsc runs in a later verify phase; 24 concurrent compiles would thrash). DO self-grep your file.
- If the file is already fully on the kit with no chrome debt, make NO changes and report status "already-clean".

## Self-check before reporting (run on your file only)
  cd "${REPO}/my-tutoring-app" && grep -nE "backdrop-blur-xl bg-slate-900/40|bg-white/5 border border-white/20|bg-slate-800/50 border-slate-700/50|bg-blue-600|bg-blue-500/80|border-blue-500 bg-blue-500/20|bg-black/20 rounded-2xl|from '@/components/ui/card'|from '@/components/ui/button'|from '@/components/ui/badge'" "${DIR}/${file}"
Remaining matches are acceptable ONLY if they are on the genuine interaction surface (e.g. a transient drag highlight). Set selfGrepClean accordingly and explain any leftover in summary.

Return the structured report. originalLines/newLines = wc -l before/after.`;

phase('Migrate');
log(`Migrating ${FILES.length} engineering primitives onto the Lumina UI kit (frame only)…`);

const reports = await parallel(
  FILES.map((file) => () =>
    agent(rules(file), { label: `migrate:${file}`, phase: 'Migrate', schema: MIGRATE_SCHEMA }),
  ),
);

const done = reports.filter(Boolean);
const migrated = done.filter((r) => r.status === 'migrated' || r.status === 'partial');
log(`Migration pass done: ${migrated.length} changed, ${done.filter((r) => r.status === 'already-clean').length} already clean, ${done.filter((r) => r.status === 'error').length} errored.`);

// ---- Verify: ONE full tsc run + grep, diff against baseline ----
phase('Verify');
const VERIFY_SCHEMA = {
  type: 'object',
  required: ['totalErrors', 'baseline', 'regressed', 'newErrorFiles', 'verdict'],
  properties: {
    totalErrors: { type: 'number', description: 'global error TS count from full tsc' },
    baseline: { type: 'number' },
    regressed: { type: 'boolean', description: 'true if totalErrors > baseline' },
    newErrorFiles: {
      type: 'array',
      description: 'engineering files that now have tsc errors (path + representative error lines)',
      items: {
        type: 'object',
        required: ['file', 'errors'],
        properties: { file: { type: 'string' }, errors: { type: 'array', items: { type: 'string' } } },
      },
    },
    residualGlassFiles: { type: 'array', items: { type: 'string' }, description: 'engineering files still matching the chrome grep (outside interaction surface)' },
    verdict: { type: 'string' },
  },
};

const verify = await agent(
  `Verify the engineering-primitive migration. The known-good GLOBAL baseline is ${BASELINE} "error TS" lines.

1. Run the LOCAL compiler (NEVER npx tsc) and count global errors:
     cd "${REPO}/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -cE "error TS[0-9]"
   That count is totalErrors. baseline is ${BASELINE}. regressed = totalErrors > ${BASELINE}.
   ⚠️ Integrity: if tsc prints "This is not the tsc command you are looking for" or the count reads 0, tsc did NOT run — re-run with the explicit ./node_modules/.bin/tsc path. A clean migration leaves the count UNCHANGED at ${BASELINE}, not 0. Ignore the known pre-existing ManifestViewer.tsx Record<ComponentId,string> error.

2. Identify which files under ${DIR} now emit errors:
     cd "${REPO}/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "error TS[0-9]" | grep "engineering/"
   List each offending engineering file with representative error lines in newErrorFiles.

3. Residual chrome debt — run across the whole engineering dir:
     cd "${REPO}/my-tutoring-app" && grep -rnE "backdrop-blur-xl bg-slate-900/40|bg-white/5 border border-white/20|bg-slate-800/50 border-slate-700/50|bg-blue-600|bg-blue-500/80|border-blue-500 bg-blue-500/20|bg-black/20 rounded-2xl|from '@/components/ui/card'|from '@/components/ui/button'|from '@/components/ui/badge'" "${DIR}"
   List files still matching in residualGlassFiles (these may be legit interaction-surface matches; just report them).

Return the structured verdict.`,
  { label: 'verify:tsc+grep', phase: 'Verify', schema: VERIFY_SCHEMA },
);

// ---- Fix: one agent per regressed file ----
let fixes = [];
if (verify && verify.regressed && verify.newErrorFiles && verify.newErrorFiles.length) {
  phase('Fix');
  log(`tsc regressed (${verify.totalErrors} vs ${BASELINE}); fixing ${verify.newErrorFiles.length} file(s)…`);
  fixes = await parallel(
    verify.newErrorFiles.map((nf) => () =>
      agent(
        `Your migration of ${REPO}/${DIR}/${nf.file} introduced TypeScript errors (global count is now ${verify.totalErrors}, baseline ${BASELINE}). Fix ONLY these regressions; do not touch the interaction surface or change functionality.

Reported errors:
${nf.errors.join('\n')}

Read the file and the kit barrel (${REPO}/my-tutoring-app/src/components/lumina/ui/index.ts) + the specific Lumina* component you used. Common causes: wrong prop name (variant->tone, surface on LuminaPanel which has none, glass className left on a kit component), missing/wrong import path ('../../../ui'), removed import still referenced. Write the complete corrected file in ONE Write op. Then verify ONLY your file compiles cleanly by checking it no longer appears in:
   cd "${REPO}/my-tutoring-app" && ./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "error TS[0-9]" | grep "engineering/${nf.file}"
Report what you changed and whether your file is now clean.`,
        { label: `fix:${nf.file}`, phase: 'Fix', schema: { type: 'object', required: ['file', 'fixed', 'summary'], properties: { file: { type: 'string' }, fixed: { type: 'boolean' }, summary: { type: 'string' } } } },
      ),
    ),
  );
}

return {
  baseline: BASELINE,
  filesProcessed: FILES.length,
  reports: done,
  verify,
  fixes: fixes.filter(Boolean),
};
