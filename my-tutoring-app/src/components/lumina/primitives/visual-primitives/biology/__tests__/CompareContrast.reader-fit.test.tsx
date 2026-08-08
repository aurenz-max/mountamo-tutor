// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for bio-compare-contrast — 15A / S5.
 *
 * Pre-fix at K-2 the primitive had NO channel to a non-reader (no catalog
 * tutoring block, no `useLuminaAI`), and neither mode was completable:
 * venn-interactive is HTML5 drag-only with ~17 text cards behind a multi-clause
 * written protocol and a deferred "Check My Work"; side-by-side is a silent wall
 * of prose with nothing to do.
 *
 * Two further defects were measured in the answer-key builder at EVERY grade and
 * are covered here because the K tap task is built on it:
 *   - the B-only region was structurally unreachable (0 cards at K, G1 and G4);
 *   - a shared attribute could be emitted twice with contradictory answers,
 *     capping a perfect player at 60% on the generator's own K-2 example.
 *
 * Behaviors tsc cannot see: the ORIENT beat fires and withholds the answer, the
 * staged characteristic is SPOKEN (the tutor's voice is the card), one tap
 * answers and advances, feedback lands on the touched target, and the adult
 * chrome is gone at K-2 but kept at 3-5.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));
const submitResultSpy = vi.fn();
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({
    submitResult: submitResultSpy,
    hasSubmitted: false,
    resetAttempt: vi.fn(),
  }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import CompareContrast, {
  buildComparisonItems,
  type CompareContrastData,
} from '../CompareContrast';

const IMAGE_PROMPT_A = 'a friendly golden retriever sitting on grass, wagging its tail';
const IMAGE_PROMPT_B = 'a fluffy orange tabby cat sitting on a windowsill';

const kData = (over: Partial<CompareContrastData> = {}): CompareContrastData => ({
  title: 'Dogs and Cats',
  mode: 'venn-interactive',
  gradeBand: 'K-2',
  entityA: {
    name: 'Dog',
    imagePrompt: IMAGE_PROMPT_A,
    attributes: [
      { category: 'Sound', value: 'Barks', isShared: false },
      { category: 'Size', value: 'Bigger', isShared: false },
    ],
  },
  entityB: {
    name: 'Cat',
    imagePrompt: IMAGE_PROMPT_B,
    attributes: [
      { category: 'Sound', value: 'Meows', isShared: false },
      { category: 'Size', value: 'Smaller', isShared: false },
    ],
  },
  sharedAttributes: [{ category: 'Body covering', value: 'Covered in fur' }],
  keyInsight: 'Dogs and cats are both furry pets that live in our homes.',
  ...over,
});

const g4Data = (over: Partial<CompareContrastData> = {}) => kData({ gradeBand: '3-5', ...over });

const sent = () => sendTextSpy.mock.calls.map((c) => String(c[0]));
const sentWith = (tag: string) => sent().filter((m) => m.includes(tag));

beforeEach(() => {
  sendTextSpy.mockReset();
  submitResultSpy.mockReset();
  cleanup();
});

// ============================================================================
// The answer key — both defects measured pre-fix
// ============================================================================

describe('buildComparisonItems — the B-only region must be reachable', () => {
  it('keeps entity B attributes that reuse a category with a different value', () => {
    // Pre-fix: entityB was filtered with `!entityA.some(a => a.category === b.category)`,
    // while the generator prompt demands parallel categories. Probed live, entity B
    // contributed 0 cards at K, G1 AND G4 — one of three Venn regions was never
    // correct for anything, and the K three-target tap task would be unanswerable.
    const items = buildComparisonItems(kData());
    const bOnly = items.filter((i) => i.correctRegion === 'B-only');
    expect(bOnly.length).toBeGreaterThan(0);
    expect(bOnly.map((i) => i.value)).toEqual(expect.arrayContaining(['Meows', 'Smaller']));
  });

  it('produces all three regions for a normal parallel-category draw', () => {
    const regions = new Set(buildComparisonItems(kData()).map((i) => i.correctRegion));
    expect(regions).toEqual(new Set(['A-only', 'shared', 'B-only']));
  });
});

describe('buildComparisonItems — the answer key cannot contradict itself', () => {
  /** The generator's OWN K-2 example (Dog vs Cat), verbatim in shape. */
  const generatorExample = (): CompareContrastData =>
    kData({
      entityA: {
        name: 'Dog',
        imagePrompt: IMAGE_PROMPT_A,
        attributes: [
          { category: 'Size', value: 'Usually bigger than a cat', isShared: false },
          { category: 'Body covering', value: 'Covered in fur', isShared: true },
          { category: 'Diet', value: 'Eats meat and some plants', isShared: true },
        ],
      },
      entityB: {
        name: 'Cat',
        imagePrompt: IMAGE_PROMPT_B,
        attributes: [
          { category: 'Size', value: 'Usually smaller than a dog', isShared: false },
          { category: 'Body covering', value: 'Covered in fur', isShared: true },
          { category: 'Diet', value: 'Eats meat and some plants', isShared: true },
        ],
      },
      sharedAttributes: [
        { category: 'Body covering', value: 'Covered in fur' },
        { category: 'Diet', value: 'Eats meat and some plants' },
      ],
    });

  it('emits each card key exactly once', () => {
    const items = buildComparisonItems(generatorExample());
    const keys = items.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('a perfect player can score 100% on the generator\'s own K-2 example', () => {
    // Pre-fix ceiling on this exact input was 60%: "Body covering: Covered in fur"
    // and "Diet: Eats meat and some plants" each existed twice, once as A-only and
    // once as shared, under one placement key.
    const items = buildComparisonItems(generatorExample());

    // Score a player who places every card in its declared correct region.
    // Pre-fix this could not reach 100 because one key carried two answers.
    const placements = new Map<string, string>();
    items.forEach((i) => placements.set(i.key, i.correctRegion));
    const correct = items.filter((i) => placements.get(i.key) === i.correctRegion).length;
    expect((correct / items.length) * 100).toBe(100);

    const byKey = new Map<string, Set<string>>();
    items.forEach((i) => {
      if (!byKey.has(i.key)) byKey.set(i.key, new Set());
      byKey.get(i.key)!.add(i.correctRegion);
    });
    for (const regions of Array.from(byKey.values())) expect(regions.size).toBe(1);
  });

  it('files identical text as shared rather than claiming it for entity A', () => {
    const items = buildComparisonItems(generatorExample());
    const fur = items.find((i) => i.value === 'Covered in fur');
    expect(fur?.correctRegion).toBe('shared');
  });

  it('files a claim BOTH entities state identically as shared, even with no sharedAttributes entry', () => {
    // The shared-first ordering already rescues the case above. This is the path
    // it does NOT cover: the generator states "Covered in fur" on both entities
    // but forgets to list it under sharedAttributes. Pre-fix that card was
    // scored 'A-only', so a student who correctly answered "both" was marked
    // wrong — and entity B's identical card was dropped entirely.
    const items = buildComparisonItems(
      kData({
        entityA: {
          name: 'Dog',
          imagePrompt: IMAGE_PROMPT_A,
          attributes: [{ category: 'Body covering', value: 'Covered in fur', isShared: true }],
        },
        entityB: {
          name: 'Cat',
          imagePrompt: IMAGE_PROMPT_B,
          attributes: [{ category: 'Body covering', value: 'Covered in fur', isShared: true }],
        },
        sharedAttributes: [],
      }),
    );
    const fur = items.filter((i) => i.value === 'Covered in fur');
    expect(fur).toHaveLength(1);
    expect(fur[0].correctRegion).toBe('shared');
  });

  it('does NOT trust isShared when the value is entity-specific prose', () => {
    // "Vertebrate mammal belonging to the canine family" is flagged isShared by
    // the live generator but is dog-specific — filing it in the middle of a Venn
    // would be a wrong answer key.
    const items = buildComparisonItems(
      kData({
        entityA: {
          name: 'Dog',
          imagePrompt: IMAGE_PROMPT_A,
          attributes: [
            { category: 'Classification', value: 'Vertebrate mammal in the canine family', isShared: true },
          ],
        },
        entityB: { name: 'Cat', imagePrompt: IMAGE_PROMPT_B, attributes: [] },
        sharedAttributes: [{ category: 'Classification', value: 'Both are vertebrate mammals' }],
      }),
    );
    const canine = items.find((i) => i.value.includes('canine'));
    expect(canine?.correctRegion).toBe('A-only');
  });
});

// ============================================================================
// Audit B — the scaffold reaches the child
// ============================================================================

describe('CompareContrast — ORIENT (the non-reader learns the task unprompted)', () => {
  it('fires an orient beat on mount at K-2', () => {
    render(<CompareContrast data={kData()} />);
    expect(sentWith('[COMPARE_ORIENT]')).toHaveLength(1);
  });

  it('names both entities in the orient beat', () => {
    render(<CompareContrast data={kData()} />);
    const msg = sentWith('[COMPARE_ORIENT]')[0];
    expect(msg).toContain('Dog');
    expect(msg).toContain('Cat');
  });

  it('never leaks the answer in the orient beat', () => {
    render(<CompareContrast data={kData()} />);
    expect(sentWith('[COMPARE_ORIENT]')[0]).toMatch(/NEVER say which side/i);
  });

  it('sends every beat silently — a non-silent post reads as if the child typed it', () => {
    render(<CompareContrast data={kData()} />);
    // Exercise the click-driven beats too, not just the ones that fire on mount:
    // read-aloud and the answer beat are the ones a child triggers most.
    fireEvent.click(screen.getByLabelText(/read the title aloud/i));
    fireEvent.click(screen.getByLabelText(/hear it again/i));
    fireEvent.click(screen.getByRole('button', { name: /both of them/i }));

    const tags = ['[COMPARE_ORIENT]', '[COMPARE_ATTRIBUTE_SHOWN]', '[COMPARE_READ_ALOUD]', '[COMPARE_ANSWERED]'];
    for (const tag of tags) expect(sentWith(tag).length).toBeGreaterThan(0);

    expect(sendTextSpy.mock.calls.length).toBeGreaterThanOrEqual(tags.length);
    for (const call of sendTextSpy.mock.calls) {
      expect((call[1] as { silent?: boolean } | undefined)?.silent).toBe(true);
    }
  });
});

describe('CompareContrast — STIMULUS (the tutor voice IS the card)', () => {
  it('speaks the staged characteristic as soon as it is shown', () => {
    render(<CompareContrast data={kData()} />);
    const shown = sentWith('[COMPARE_ATTRIBUTE_SHOWN]');
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatch(/Body covering: Covered in fur/);
  });

  it('asks the three-way question without answering or narrowing it', () => {
    render(<CompareContrast data={kData()} />);
    const msg = sentWith('[COMPARE_ATTRIBUTE_SHOWN]')[0];
    expect(msg).toMatch(/or to BOTH/i);
    expect(msg).toMatch(/do NOT rule any of the three out/i);
  });

  it('speaks the NEXT characteristic after one is answered', () => {
    vi.useFakeTimers();
    try {
      render(<CompareContrast data={kData()} />);
      const first = sentWith('[COMPARE_ATTRIBUTE_SHOWN]')[0];
      fireEvent.click(screen.getByRole('button', { name: /both of them/i }));
      act(() => { vi.advanceTimersByTime(1000); });
      const shown = sentWith('[COMPARE_ATTRIBUTE_SHOWN]');
      expect(shown).toHaveLength(2);
      expect(shown[1]).not.toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('CompareContrast — read-aloud surfaces at K-2', () => {
  it('offers read-aloud on the title, the staged card and the big idea', () => {
    render(<CompareContrast data={kData()} />);
    expect(screen.getByLabelText(/read the title aloud/i)).toBeTruthy();
    expect(screen.getByLabelText(/hear it again/i)).toBeTruthy();
    expect(screen.getByLabelText(/read the big idea aloud/i)).toBeTruthy();
  });

  it('read-aloud sends the exact text, word for word', () => {
    render(<CompareContrast data={kData()} />);
    fireEvent.click(screen.getByLabelText(/read the big idea aloud/i));
    const msg = sentWith('[COMPARE_READ_ALOUD]')[0];
    expect(msg).toContain('Dogs and cats are both furry pets that live in our homes.');
    expect(msg).toMatch(/word for word/i);
  });

  it('offers no read-aloud chrome at 3-5', () => {
    render(<CompareContrast data={g4Data()} />);
    expect(screen.queryByLabelText(/read the title aloud/i)).toBeNull();
  });
});

// ============================================================================
// Audit C — the band contract
// ============================================================================

describe('CompareContrast — rule 2: tap = choose (no drag at K-2)', () => {
  it('renders three tap targets and no draggable cards at K-2', () => {
    const { container } = render(<CompareContrast data={kData()} />);
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /^Dog only$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Both of them$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Cat only$/i })).toBeTruthy();
  });

  it('one tap answers — there is no Check My Work button at K-2', () => {
    render(<CompareContrast data={kData()} />);
    expect(screen.queryByText(/check my work/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /both of them/i }));
    expect(sentWith('[COMPARE_ANSWERED]')).toHaveLength(1);
  });

  it('keeps drag and the explicit check at 3-5', () => {
    const { container } = render(<CompareContrast data={g4Data()} />);
    expect(container.querySelectorAll('[draggable="true"]').length).toBeGreaterThan(0);
    expect(screen.getByText(/check my work/i)).toBeTruthy();
  });
});

describe('CompareContrast — rule 5: feedback without reading', () => {
  it('reports the choice and its correctness on the answered beat', () => {
    render(<CompareContrast data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: /both of them/i }));
    const msg = sentWith('[COMPARE_ANSWERED]')[0];
    expect(msg).toMatch(/both of them/i);
    expect(msg).toMatch(/RIGHT/);
  });

  it('supplies the true answer for a WRONG choice, in child words not a region slug', () => {
    render(<CompareContrast data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Dog only$/i }));
    const msg = sentWith('[COMPARE_ANSWERED]')[0];
    expect(msg).toMatch(/not right/i);
    expect(msg).toMatch(/both of them/i);
    expect(msg).not.toMatch(/A-only|B-only/);
  });

  it('says nothing about characteristics the child has not seen', () => {
    render(<CompareContrast data={kData()} />);
    fireEvent.click(screen.getByRole('button', { name: /both of them/i }));
    expect(sentWith('[COMPARE_ANSWERED]')[0]).toMatch(/Say nothing about the things they have not seen/i);
  });
});

describe('CompareContrast — rule 7: no adult chrome in the child field', () => {
  it('hides the developer band readout at K-2 and keeps it at 3-5', () => {
    const { unmount } = render(<CompareContrast data={kData()} />);
    expect(screen.queryByText(/Grade K-2/)).toBeNull();
    unmount();
    render(<CompareContrast data={g4Data({ mode: 'side-by-side' })} />);
    expect(screen.getByText(/Grade 3-5/)).toBeTruthy();
  });

  it('never renders imagePrompt as student copy at ANY grade', () => {
    const { container, unmount } = render(<CompareContrast data={kData({ mode: 'side-by-side' })} />);
    expect(container.textContent).not.toContain(IMAGE_PROMPT_A);
    expect(container.textContent).not.toContain(IMAGE_PROMPT_B);
    unmount();
    const g4 = render(<CompareContrast data={g4Data({ mode: 'side-by-side' })} />);
    expect(g4.container.textContent).not.toContain(IMAGE_PROMPT_A);
    expect(g4.container.textContent).not.toContain(IMAGE_PROMPT_B);
  });

  it('shows no numeric counter while answering at K-2', () => {
    const { container } = render(<CompareContrast data={kData()} />);
    expect(container.textContent).not.toMatch(/\b\d+\s*(of|\/)\s*\d+\b/);
  });

  it('replaces the dev region slug in Venn error text at 3-5', () => {
    // Driven to the state that actually renders the correction: every card
    // placed in a deliberately wrong region, then checked. Asserting on an
    // un-submitted render passes whether or not the slug was ever fixed.
    const data = g4Data();
    const items = buildComparisonItems(data);
    const { container } = render(<CompareContrast data={data} />);

    const zones = container.querySelectorAll('[data-testid], .min-h-\\[300px\\]');
    expect(zones.length).toBeGreaterThan(0);

    // Drop every card into the FIRST region; anything not belonging there is wrong.
    items.forEach((item) => {
      fireEvent.drop(zones[0], {
        dataTransfer: { getData: () => item.key, setData: () => {} },
      });
    });
    fireEvent.click(screen.getByText(/check my work/i));

    expect(container.textContent).not.toMatch(/A-only|B-only/);
    expect(screen.getAllByText(/Belongs in/i).length).toBeGreaterThan(0);
  });
});

describe('CompareContrast — side-by-side is listenable at K-2', () => {
  it('turns every attribute row into a read-aloud button at K-2', () => {
    render(<CompareContrast data={kData({ mode: 'side-by-side' })} />);
    const row = screen.getByRole('button', { name: /read Sound aloud/i });
    expect(row).toBeTruthy();
    fireEvent.click(row);
    const msg = sentWith('[COMPARE_READ_ALOUD]')[0];
    expect(msg).toContain('Barks');
    expect(msg).toContain('Meows');
  });

  it('never nests a button inside a button', () => {
    // Real Chrome caught `validateDOMNesting: <button> cannot appear as a
    // descendant of <button>` here and jsdom did not — the first version wrapped
    // a LuminaReadAloud inside a full-row button. Invalid HTML, and it breaks
    // keyboard and assistive-tech traversal for exactly the band that depends on
    // it most. Guarded structurally so the shape cannot come back.
    for (const data of [kData({ mode: 'side-by-side' }), kData(), g4Data({ mode: 'side-by-side' })]) {
      const { container, unmount } = render(<CompareContrast data={data} />);
      const nested = container.querySelectorAll('button button');
      expect(nested).toHaveLength(0);
      unmount();
    }
  });

  it('leaves the rows as plain text at 3-5', () => {
    render(<CompareContrast data={g4Data({ mode: 'side-by-side' })} />);
    expect(screen.queryByRole('button', { name: /read Sound aloud/i })).toBeNull();
  });

  it('drops the Shared Characteristics text ledger at K-2 only', () => {
    const { unmount } = render(<CompareContrast data={kData({ mode: 'side-by-side' })} />);
    expect(screen.queryByText(/Shared Characteristics/i)).toBeNull();
    unmount();
    render(<CompareContrast data={g4Data({ mode: 'side-by-side' })} />);
    expect(screen.getByText(/Shared Characteristics/i)).toBeTruthy();
  });

  it('hides the Generate Visual affordance at K-2 (images arrive pre-generated)', () => {
    const { unmount } = render(<CompareContrast data={kData({ mode: 'side-by-side' })} />);
    expect(screen.queryByText(/Generate Visual/i)).toBeNull();
    unmount();
    render(<CompareContrast data={g4Data({ mode: 'side-by-side' })} />);
    expect(screen.getAllByText(/Generate Visual/i).length).toBeGreaterThan(0);
  });
});

describe('CompareContrast — the K-2 path is completable end to end', () => {
  it('advances through every characteristic and submits once', async () => {
    vi.useFakeTimers();
    try {
      render(<CompareContrast data={kData()} />);
      const total = buildComparisonItems(kData()).length;

      for (let i = 0; i < total; i++) {
        const both = screen.getByRole('button', { name: /both of them/i });
        fireEvent.click(both);
        act(() => { vi.advanceTimersByTime(1000); });
      }

      expect(submitResultSpy).toHaveBeenCalledTimes(1);
      expect(sentWith('[COMPARE_FINISHED]')).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('speaks each characteristic exactly once as it is staged', () => {
    vi.useFakeTimers();
    try {
      render(<CompareContrast data={kData()} />);
      const total = buildComparisonItems(kData()).length;
      for (let i = 0; i < total; i++) {
        fireEvent.click(screen.getByRole('button', { name: /both of them/i }));
        act(() => { vi.advanceTimersByTime(1000); });
      }
      expect(sentWith('[COMPARE_ATTRIBUTE_SHOWN]')).toHaveLength(total);
    } finally {
      vi.useRealTimers();
    }
  });
});
