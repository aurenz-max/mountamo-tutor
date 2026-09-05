import type { LessonPackage } from './lessonPackage';

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** A positional match is a comparison aid; only identical reviewed material inherits approval. */
export function canCarryKeep(before: LessonPackage, beforeId: string, after: LessonPackage, afterId: string): boolean {
  const material = (pkg: LessonPackage, instanceId: string) => {
    const block = pkg.manifest.layout?.find((b) => b.instanceId === instanceId);
    const payload = pkg.components.find((c) => c.instanceId === instanceId);
    if (!block || !payload || payload.data == null) return null;
    return {
      componentId: block.componentId, title: block.title, intent: block.intent, config: block.config,
      objectives: pkg.curatorBrief.objectives.filter((o) => block.objectiveIds?.includes(o.id)),
      gradeLevel: pkg.manifest.gradeLevel, data: payload.data,
    };
  };
  const a = material(before, beforeId), b = material(after, afterId);
  return a !== null && b !== null && stable(a) === stable(b);
}
