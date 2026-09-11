import { describe, expect, it } from 'vitest';
import type { DiActionContract, JudgedScriptItem, JudgedScriptPack } from './judgedScriptContract';
import { checkDiActionContracts } from './judgedScriptContract.testkit';

const action: DiActionContract = {
  id: 'say',
  label: 'Say it',
  icon: 'A',
  answerKind: 'voice',
  instruction: 'Say the answer aloud.',
  checkingInstruction: 'Listening for the answer.',
};

const item = (id: string, actionContract?: DiActionContract): JudgedScriptItem => ({
  id,
  action: 'say',
  answerKind: 'voice',
  responseClass: 'short_spoken_word',
  ...(actionContract ? { actionContract } : {}),
});

const pack = (items: JudgedScriptItem[], spoken = action.instruction): JudgedScriptPack<JudgedScriptItem> => ({
  primitiveType: 'test',
  activityLine: 'test activity',
  items,
  itemCue: () => `[TEST] Say exactly: "${spoken}"`,
  moveOnCue: () => '[TEST] Say exactly: "Good try."',
  completeCue: () => '[TEST] Say exactly: "Done."',
  contextFor: () => ({}),
});

describe('checkDiActionContracts', () => {
  it('allows a legacy pack until it adopts the action contract', () => {
    expect(checkDiActionContracts(pack([item('legacy')]))).toEqual([]);
  });

  it('accepts a complete contract whose instruction reaches the spoken ask', () => {
    expect(checkDiActionContracts(pack([item('new', action)]))).toEqual([]);
  });

  it('rejects partial adoption, modality drift, and screen/voice drift', () => {
    const gestureAction = { ...action, answerKind: 'gesture' as const };
    const issues = checkDiActionContracts(pack([
      item('drift', gestureAction),
      item('missing'),
    ], 'A different spoken ask.'));
    expect(issues).toContain('drift: answerKind voice disagrees with actionContract gesture');
    expect(issues).toContain('drift: spoken ask does not contain actionContract.instruction exactly');
    expect(issues).toContain('missing: missing actionContract after this pack adopted the DI action house style');
  });
});
