// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import DrawerBlock from './DrawerBlock';
import type { DrawerBlockData } from '../types';
// Drawer sections the agentic author shipped (qa/deep-dive-bench/agent-drawers-r2.json).
import fixtures from './drawerBlock.fixture.json';

describe('DrawerBlock', () => {
  it.each(Object.entries(fixtures))('renders the %s drawer through its registered component', (_, block) => {
    const data = block as unknown as DrawerBlockData;
    const { container } = render(<DrawerBlock data={data} />);
    expect(container.querySelector(`[data-deep-dive-drawer="${data.drawerId}"]`)).not.toBeNull();
    expect(container.textContent).toContain((data.spec as { title: string }).title);
    expect(container.textContent).not.toContain('could not be built');
  });

  it('renders nothing for an unknown drawer or a missing spec', () => {
    const base = { id: 'b', label: 'x', blockType: 'drawer' as const };
    expect(render(<DrawerBlock data={{ ...base, drawerId: 'drawer-nope', spec: {} }} />).container.innerHTML).toBe('');
    expect(render(<DrawerBlock data={{ ...base, drawerId: 'drawer-cause-chain', spec: null }} />).container.innerHTML).toBe('');
  });
});
