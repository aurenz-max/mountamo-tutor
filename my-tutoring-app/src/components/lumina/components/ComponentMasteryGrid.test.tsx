// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

const getComponentMastery = vi.fn();
vi.mock('@/lib/studentAnalyticsAPI', () => ({ analyticsApi: { getComponentMastery: (...a: unknown[]) => getComponentMastery(...a) } }));

import ComponentMasteryGrid, { cellState, gridRows } from './ComponentMasteryGrid';

const CATALOG = { kind: 'letter_sound', title: 'Letter sounds', components: [
  { id: 's/S', label: 's', detail: 's', group: 'Letter group 1' },
  { id: 'a/AE', label: 'a', detail: 'a', group: 'Letter group 1' },
  { id: 'sh/SH', label: 'sh', detail: 'sh', group: 'Digraphs' },
  { id: 's/Z', label: 's', detail: 'z', group: 'Other spellings' },
  { id: 'y/IY', label: 'y', detail: 'iː', group: 'Other spellings' },
] };
const serve = (catalog: unknown) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => catalog })));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); getComponentMastery.mockReset(); });

describe('cellState', () => {
  it('says how well only from three observations up', () => {
    expect(cellState(undefined)).toBe('none');
    expect(cellState({ attempts: 2, correct: 0 })).toBe('seen');
    expect(cellState({ attempts: 10, correct: 9 })).toBe('secure');
    expect(cellState({ attempts: 10, correct: 7 })).toBe('growing');
    expect(cellState({ attempts: 10, correct: 6 })).toBe('shaky');
  });
});

describe('gridRows', () => {
  it('keeps every taught cell and only the observed cells of the catch-all group', () => {
    const rows = gridRows(CATALOG.components, { 's/Z': { attempts: 1, correct: 1 } }, 'Other spellings');
    expect(rows.map(r => [r.group, r.cells.map(c => c.id)])).toEqual([
      ['Letter group 1', ['s/S', 'a/AE']], ['Digraphs', ['sh/SH']], ['Other spellings', ['s/Z']],
    ]);
  });
});

describe('ComponentMasteryGrid', () => {
  it('draws one cell per component with the child\'s tally and state', async () => {
    serve(CATALOG);
    getComponentMastery.mockResolvedValue({ kind: 'letter_sound', components: {
      's/S': { attempts: 10, correct: 10 }, 'a/AE': { attempts: 5, correct: 2 }, 'sh/SH': { attempts: 1, correct: 0 } } });
    const { container } = render(<ComponentMasteryGrid studentId={7} kind="letter_sound" />);
    await waitFor(() => expect(screen.getByText('Letter sounds')).toBeTruthy());
    const state = (id: string) => container.querySelector(`[data-component="${id}"]`)?.getAttribute('data-state');
    expect([state('s/S'), state('a/AE'), state('sh/SH')]).toEqual(['secure', 'shaky', 'seen']);
    expect(container.querySelector('[data-component="y/IY"]')).toBeNull();
    expect(screen.getByText('10/10')).toBeTruthy();
    expect(screen.getByText('3 seen')).toBeTruthy();
    expect(getComponentMastery).toHaveBeenCalledWith(7, 'letter_sound');
  });

  it('renders nothing for a child with no observations, and when a read fails', async () => {
    serve(CATALOG);
    getComponentMastery.mockResolvedValue({ kind: 'letter_sound', components: {} });
    const first = render(<ComponentMasteryGrid studentId={7} kind="letter_sound" />);
    await waitFor(() => expect(getComponentMastery).toHaveBeenCalled());
    expect(first.container.innerHTML).toBe('');
    cleanup();
    getComponentMastery.mockRejectedValue(new Error('offline'));
    const second = render(<ComponentMasteryGrid studentId={7} kind="letter_sound" />);
    await waitFor(() => expect(getComponentMastery).toHaveBeenCalledTimes(2));
    expect(second.container.innerHTML).toBe('');
  });
});
