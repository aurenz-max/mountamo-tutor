// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { withTeachingWorkspace } from './withTeachingWorkspace';
import { LiveRuntimeContext } from './LiveRuntimeContext';
import { LiveLessonRuntime } from './LiveLessonRuntime';

afterEach(cleanup);
const Teaching = () => <p>teaching</p>;
const Scripted = () => <p>scripted</p>;
// The catalog decides: number-sequencer declares `teachingWorkspace`, hundreds-chart does not.
const Train = withTeachingWorkspace('number-sequencer', Teaching, Scripted);
const Line = withTeachingWorkspace('hundreds-chart', Teaching, Scripted);
const mounted = (Family: React.FC<{ runtimeEvalMode?: string }>, pin?: string, runtime = true) => render(runtime
  ? <LiveRuntimeContext.Provider value={new LiveLessonRuntime('switch')}><Family runtimeEvalMode={pin} /></LiveRuntimeContext.Provider>
  : <Family runtimeEvalMode={pin} />).container.textContent;

it.each([
  ['before_after', 'teaching'], ['count_from|before_after', 'teaching'], ['mixed', 'teaching'],
  ['count_from|not_a_mode', 'scripted'], ['', 'scripted'], [undefined, 'scripted'],
])('inside a live runtime, a number-train pin %s mounts the %s path', (pin, expected) => {
  expect(mounted(Train, pin)).toBe(expected);
});

it('mounts the scripted drill for a family the catalog does not declare, and whenever there is no runtime', () => {
  expect(mounted(Line, 'count')).toBe('scripted');
  expect(mounted(Line, 'mixed')).toBe('scripted');
  expect(mounted(Train, 'before_after', false)).toBe('scripted');
});
