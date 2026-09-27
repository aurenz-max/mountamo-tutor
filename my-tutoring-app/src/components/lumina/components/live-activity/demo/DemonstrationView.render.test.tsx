// @vitest-environment jsdom
/** Every bench script draws in the detour card, and stepping shows each built caption in order. */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SupportArtifactCard } from '../runtime/LiveRuntimeSurface';
import { DEMO_FIXTURES, demonstrationArtifact } from './demoFixtures';

afterEach(cleanup);

describe('DemonstrationView', () => {
  it.each(DEMO_FIXTURES)('steps through $id in the worked-example card', ({ script }) => {
    const artifact = demonstrationArtifact(script);
    const { container } = render(<SupportArtifactCard artifact={artifact} />);
    expect(screen.getByRole('complementary', { name: 'Worked example' }).getAttribute('data-artifact-kind')).toBe('demonstration');
    expect(container.querySelector(`[data-demo-view="${script.piece}"]`)).not.toBeNull();
    const back = screen.getByRole('button', { name: 'Back' }) as HTMLButtonElement;
    const next = screen.getByRole('button', { name: 'Next step' }) as HTMLButtonElement;
    expect(back.disabled).toBe(true);
    artifact.demonstration.frames.forEach((frame, i) => {
      expect(container.querySelector('figcaption')!.textContent).toBe(frame.caption);
      if (i < artifact.demonstration.frames.length - 1) fireEvent.click(next);
    });
    expect(next.disabled).toBe(true);
  });

  it('draws the hops the caption counts', () => {
    const { container } = render(<SupportArtifactCard artifact={demonstrationArtifact(DEMO_FIXTURES[0].script)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(container.querySelectorAll('[data-demo-view="number-line"] path[marker-end]')).toHaveLength(4);
  });

  it('labels the clock by fives up to the numeral', () => {
    const { container } = render(<SupportArtifactCard artifact={demonstrationArtifact(DEMO_FIXTURES[4].script)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(Array.from(container.querySelectorAll("[data-demo-minutes]")).map(n => n.getAttribute('data-demo-minutes'))).toEqual(['5', '10', '15']);
  });
});
