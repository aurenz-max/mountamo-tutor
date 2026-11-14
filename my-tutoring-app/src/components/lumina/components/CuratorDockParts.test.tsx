// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DockSwitch, SectionTracker } from './CuratorDockParts';

const state = vi.hoisted(() => ({ sections: [] as any[], submitted: [] as any[] }));
vi.mock('@/contexts/LuminaAIContext', () => ({ useMicLevel: () => 0 }));
vi.mock('../contexts/ExhibitContext', () => ({ useExhibitContext: () => ({ sections: state.sections }) }));
vi.mock('../evaluation', () => ({ useEvaluationContext: () => ({ submittedResults: state.submitted }) }));
vi.mock('../config/primitiveRegistry', () => ({ getPrimitive: () => ({ component: () => null, sectionTitle: 'Registry Title' }) }));

const lesson = [
  { componentId: 'curator-brief', instanceId: 'brief', title: 'Intro', data: {} },
  { componentId: 'ten-frame', instanceId: 'a', title: 'Ten frame', data: {} },
  { componentId: 'knowledge-check', instanceId: 'kc', title: 'Quick check', data: { problems: [{}, {}] } },
  { componentId: 'number-line', instanceId: 'c', title: 'Number line', data: {} },
  { componentId: 'fact-file', instanceId: 'parent', title: 'For grown-ups', data: {}, audience: 'caregiver' },
];

afterEach(() => { cleanup(); state.sections = []; state.submitted = []; });

it('names the active section and counts only the child-facing parts', () => {
  state.sections = lesson;
  render(<SectionTracker activeId="kc" fallbackName={null} />);
  expect(screen.getByText('Quick check')).toBeTruthy();
  expect(screen.getByText('Part 2 of 3')).toBeTruthy();
});

it('marks a section done from submitted results, and a knowledge-check only when every problem reported', () => {
  state.sections = lesson;
  state.submitted = [{ instanceId: 'a' }, { instanceId: 'kc::p0' }];
  render(<SectionTracker activeId="c" fallbackName={null} />);
  expect(screen.getByLabelText('Part 1: Ten frame, done')).toBeTruthy();
  expect(screen.getByLabelText('Part 2: Quick check')).toBeTruthy();
  expect(screen.getByLabelText('Part 3: Number line, now')).toBeTruthy();
});

it('offers no rail buttons when only one section is on the page (kindergarten stage)', () => {
  state.sections = lesson;
  render(<><div data-primitive-instance-id="a" /><SectionTracker activeId="a" fallbackName={null} /></>);
  expect(screen.queryAllByRole('button')).toHaveLength(0);
});

it('scrolls to a visible section when its segment is tapped', () => {
  state.sections = lesson;
  const scrolled = vi.fn();
  Element.prototype.scrollIntoView = scrolled;
  render(<>
    <div data-primitive-instance-id="a" /><div data-primitive-instance-id="kc" />
    <div hidden><div data-primitive-instance-id="c" /></div>
    <SectionTracker activeId="a" fallbackName={null} />
  </>);
  expect(screen.getAllByRole('button')).toHaveLength(1); // not the active one, not the hidden one
  fireEvent.click(screen.getByLabelText('Go to Part 2: Quick check'));
  expect(scrolled).toHaveBeenCalledTimes(1);
});

it('falls back to the primitive name outside a lesson and shows no rail', () => {
  render(<SectionTracker activeId="x" fallbackName="Ten Frame" />);
  expect(screen.getByText('Ten Frame')).toBeTruthy();
  expect(screen.queryByText(/Part/)).toBeNull();
});

it('reports the next value when the switch is pressed', () => {
  const onChange = vi.fn();
  render(<DockSwitch label="Microphone" detail="d" on onChange={onChange} />);
  const sw = screen.getByRole('switch', { name: /Microphone/ });
  expect(sw.getAttribute('aria-checked')).toBe('true');
  fireEvent.click(sw);
  expect(onChange).toHaveBeenCalledWith(false);
});
