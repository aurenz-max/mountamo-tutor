// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { DRAWER_REGISTRY } from './drawerRegistry';
import { FIXTURES } from './drawerFixtures';

// Radix sliders measure themselves; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

type Comp = React.ComponentType<{ data: unknown }>;
const kinds = Object.entries(DRAWER_REGISTRY).map(([id, e]) => [id, e.component as Comp] as const);

describe('drawers', () => {
  afterEach(() => { cleanup(); });

  // A malformed spec must show the "could not be built" card, never throw inside a lesson.
  it.each(kinds)('%s survives a malformed spec', (_id, C) => {
    const { getByText } = render(<C data={{ title: 'Broken', caption: 'x' }} />);
    expect(getByText(/could not be built/)).toBeTruthy();
  });

  it.each(Object.entries(FIXTURES))('drawer-%s renders a valid spec', (kind, data) => {
    const C = DRAWER_REGISTRY[`drawer-${kind}` as keyof typeof DRAWER_REGISTRY].component as Comp;
    const { container, queryByText } = render(<C data={data} />);
    expect(queryByText(/could not be built/)).toBeNull();
    expect(container.querySelector(`[data-drawer="${kind}"]`)).toBeTruthy();
  });
});
