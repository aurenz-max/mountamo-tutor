'use client';

/**
 * The two controllers a runner-era balance-scale surface can be handed (workspace rollout W1):
 * the scripted judged runner, or the shared tutor/JEV workspace. `withWorkspaceController`
 * picks one per mount, so a surface's hooks never change owner.
 */
import { useJudgedScriptRunner, type JudgedRunSummary, type JudgedScriptRun, type JudgedScriptRunnerOptions }
  from '../../../hooks/useJudgedScriptRunner';
import type { JudgedScriptItem, JudgedScriptPack } from '../../../hooks/judgedScriptContract';
import type { TeachingAssignment } from '../../../components/live-activity/runtime/useTeachingWorkspace';
import { useWorkspaceRunner, type LiveRun, type WorkspaceRunOptions } from '../../../components/live-activity/runtime/useWorkspaceRunner';

/** What the metrics read, from either controller's finished record. */
export type BalanceFinish = Pick<JudgedRunSummary, 'outcomes'> & Partial<Pick<JudgedRunSummary, 'learningResponses' | 'diagnosisEvidence'>>
  & { teachingAttempts?: unknown; assistanceProvenance?: string };

export type BalanceControllerOptions<Item extends JudgedScriptItem> =
  Omit<WorkspaceRunOptions<Item>, 'primitiveId' | 'assignment' | 'onFinished'>
  & Omit<JudgedScriptRunnerOptions<Item>, 'pack' | 'onFinished'>
  & { pack?: JudgedScriptPack<Item>; onFinished: (summary: BalanceFinish) => void };

/** The runner's coaching loop and solved set exist on the scripted path only. */
export type BalanceRun<Item> = LiveRun<Item> & Partial<Pick<JudgedScriptRun<JudgedScriptItem>, 'loop' | 'solvedIds'>>;

export function useScriptedBalance<Item extends JudgedScriptItem>(options: BalanceControllerOptions<Item>): BalanceRun<Item> {
  return useJudgedScriptRunner<Item>({ ...options, pack: options.pack! }) as unknown as BalanceRun<Item>;
}

export const workspaceBalance = <Item extends JudgedScriptItem>(assignment: (item: Item) => TeachingAssignment) =>
  function useWorkspaceBalance(options: BalanceControllerOptions<Item>): BalanceRun<Item> {
    return useWorkspaceRunner<Item>({ ...options, primitiveId: 'balance-scale', assignment });
  };
