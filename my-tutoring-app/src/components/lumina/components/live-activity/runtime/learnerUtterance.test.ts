import { expect, it } from 'vitest';
import { latestLearnerUtterance } from './learnerUtterance';
it('reassembles provider fragments and rejects a late tail from an old item', () => {
  const messages = [{ role: 'user' as const, content: 'can you help me count ', timestamp: 1, streamId: 4 },
    { role: 'user' as const, content: 'three', timestamp: 2, streamId: 4 }];
  expect(latestLearnerUtterance(messages, 0)?.text).toBe('can you help me count three');
  expect(latestLearnerUtterance(messages, 1)).toBeNull();
  expect(latestLearnerUtterance([...messages, { role: 'user', content: 'three stars', timestamp: 3, streamId: 5 }], 2)?.text).toBe('three stars');
});

it('waits for final audio text, including an empty final chunk and interleaved tutor speech', () => {
  const start = { role: 'user' as const, content: 'three', timestamp: 1, streamId: 8, isAudio: true };
  expect(latestLearnerUtterance([start], 0)).toBeNull();
  const messages = [start,
    { role: 'assistant' as const, content: 'I am listening.', timestamp: 2, streamId: 9 },
    { ...start, content: ' or can you help me?', timestamp: 3 },
    { ...start, content: '', timestamp: 4, transcriptFinished: true }];
  expect(latestLearnerUtterance(messages, 0)?.text).toBe('three or can you help me?');
  expect(latestLearnerUtterance(messages, 1)).toBeNull();
  expect(latestLearnerUtterance([...messages,
    { ...start, streamId: 10, content: 'four', timestamp: 5, transcriptFinished: true }], 0)?.text).toBe('four');
});
