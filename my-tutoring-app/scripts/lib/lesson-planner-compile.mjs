// Experimental-plan adapter only. Production enrichment/assembly remain authoritative.
export function compilePlan(plan, fixture, catalog) {
  if (plan.objectiveId !== fixture.objective.id) throw new Error('Cannot compile changed objective');
  const defs = new Map(catalog.map(c => [c.id, c]));
  const seen = new Set();
  for (const e of plan.experiences) {
    const def = defs.get(e.componentId);
    if (!def || !e.id || seen.has(e.id)) throw new Error('Cannot compile unknown or duplicate component');
    seen.add(e.id);
    const modes = def.evalModes ?? [];
    if (modes.length ? !modes.some(m => m.evalMode === e.mode) : e.mode !== '') throw new Error('Cannot compile invalid mode');
  }
  const briefs = plan.experiences.filter(e => e.componentId === 'curator-brief');
  if (briefs.length > 1) throw new Error('Multiple curator briefs cannot be represented');
  if (briefs.length && plan.experiences[0] !== briefs[0]) throw new Error('Curator brief must lead the executable manifest');
  const activities = plan.experiences.filter(e => e.componentId !== 'curator-brief');
  const last = activities.at(-1);
  const final = last && ['knowledge-check', 'flashcard-deck'].includes(last.componentId)
    && last.contributions.includes('closing_independent_assessment') ? last : null;
  const component = e => ({ componentId: e.componentId, instanceId: e.id,
    title: e.componentId.replaceAll('-', ' '),
    intent: `${e.intent}\nLearner action: ${e.learnerAction}\nSupport: ${e.support}`,
    config: e.mode ? { targetEvalMode: e.mode } : {},
  });
  const objective = fixture.objective;
  return {
    topic: objective.text, gradeLevel: 'kindergarten', subject: 'MATHEMATICS', themeColor: '#6366f1',
    ...(briefs.length ? { curatorBrief: { instanceId: briefs[0].id, title: plan.title, intent: briefs[0].intent } } : {}),
    objectiveBlocks: [{ objectiveId: objective.id, objectiveText: objective.text, objectiveVerb: fixture.verb ?? 'apply',
      components: activities.filter(e => e !== final).map(component) }],
    ...(final ? { finalAssessment: component(final) } : {}),
  };
}
