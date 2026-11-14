import 'server-only';
import { learnerNotesForTask, type NoteAssignment } from './applyNotes';

type Item = { componentId: string; instanceId: string; intent?: string; title?: string; config?: Record<string, unknown> };

/**
 * The manifest item with `config.learnerNotes` set from the verified launch packet, or removed. Runs at the
 * one dispatch site (`generateComponentContent`), names no primitive, and never fails a generation: any error
 * is the item without notes. `resolveGenerationContext` turns the field into `ctx.learnerNotes` and the
 * private block on `ctx.intent`.
 */
export async function withLearnerNotes<T extends Item>(item: T, topic: string, activity?: NoteAssignment['activity']): Promise<T> {
  const { learnerNotes: _untrusted, ...config } = item.config ?? {};
  const bare = { ...item, config };
  try {
    const objective = String(config.objectiveText || config.intent || item.intent || '').trim();
    if (!objective) return bare;
    const notes = await learnerNotesForTask(
      { subject: config.objectiveSubject, grade: config.objectiveGrade, skillId: config.skillId, subskillId: config.subskillId },
      { subject: typeof config.objectiveSubject === 'string' ? config.objectiveSubject : undefined, topic, objective,
        activity: activity ?? { name: item.componentId } });
    return notes.length ? { ...item, config: { ...config, learnerNotes: notes } } : bare;
  } catch {
    return bare;
  }
}
