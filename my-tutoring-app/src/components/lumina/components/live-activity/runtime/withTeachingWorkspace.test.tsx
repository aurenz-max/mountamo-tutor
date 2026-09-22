// @vitest-environment jsdom
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { withTeachingWorkspace } from './withTeachingWorkspace';
import { LiveRuntimeContext } from './LiveRuntimeContext';
import { LiveLessonRuntime } from './LiveLessonRuntime';
import { NUMBER_SEQUENCER_WORKSPACE_MODES } from '../../../primitives/visual-primitives/math/numberSequencerDomain';

afterEach(cleanup);
const Teaching = () => <p>teaching</p>;
const Scripted = () => <p>scripted</p>;
// The number train binds every catalog mode. Shape Sorter also binds every catalog
// mode now, so this fixture stands in for a family that binds `identify` only, to
// exercise the switch's partial-binding branch — it is not shape-sorter's real list.
const Train = withTeachingWorkspace('number-sequencer', NUMBER_SEQUENCER_WORKSPACE_MODES, Teaching, Scripted);
const Shapes = withTeachingWorkspace('shape-sorter', ['identify'], Teaching, Scripted);
const mounted = (Family: React.FC<{ runtimeEvalMode?: string }>, pin?: string, runtime = true) => render(runtime
  ? <LiveRuntimeContext.Provider value={new LiveLessonRuntime('switch')}><Family runtimeEvalMode={pin} /></LiveRuntimeContext.Provider>
  : <Family runtimeEvalMode={pin} />).container.textContent;

it.each([
  ['before_after', 'teaching'], ['count_from|before_after', 'teaching'], ['mixed', 'teaching'],
  ['count_from|not_a_mode', 'scripted'], ['', 'scripted'], [undefined, 'scripted'],
])('inside a live runtime, a number-train pin %s mounts the %s path', (pin, expected) => {
  expect(mounted(Train, pin)).toBe(expected);
});

it('mounts the scripted drill for a blend or mixed pin with an unbound mode, and whenever there is no runtime', () => {
  expect(mounted(Shapes, 'identify')).toBe('teaching');
  expect(mounted(Shapes, 'identify|count')).toBe('scripted');
  expect(mounted(Shapes, 'mixed')).toBe('scripted');
  expect(mounted(Train, 'before_after', false)).toBe('scripted');
});
