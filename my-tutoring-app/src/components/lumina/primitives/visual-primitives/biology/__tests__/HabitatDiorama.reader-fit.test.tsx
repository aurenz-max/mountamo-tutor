// @vitest-environment jsdom
/**
 * Reader-fit behavioral verification for habitat-diorama — 15B / S14.
 *
 * The interesting finding here is NOT that the component was band-blind — it
 * was already written band-aware, with five `gradeBand !== 'K-2'` gates. Every
 * one of them was DEAD CODE, because the generator resolved its band from a map
 * keyed on grade tokens but indexed with prose, so 'K-2' was never emitted.
 * Probe at `grade=K` before the fix: `gradeBand:'3-5'`, 7 organisms, 4
 * relationships and a disruption scenario, against a catalog K-2 rung reading
 * "4-5 recognizable organisms … NO disruption scenario (too complex)".
 *
 * These tests pin both the author's original intent (now reachable) and the
 * voice this slice added.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

const sendTextSpy = vi.fn();
vi.mock('../../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: sendTextSpy, isAudioPlaying: false, isConnected: true }),
}));
vi.mock('../../../../evaluation', () => ({
  usePrimitiveEvaluation: () => ({ submitResult: vi.fn(), hasSubmitted: false }),
}));
vi.mock('../../../../utils/SoundManager', () => ({
  SoundManager: new Proxy({}, { get: () => vi.fn() }),
}));

import HabitatDiorama from '../HabitatDiorama';

const baseProps = (gradeBand: 'K-2' | '3-5' | '6-8') => ({
  data: {
    primitiveType: 'habitat-diorama' as const,
    habitat: {
      name: 'Forest',
      type: 'forest',
      description: 'A shady woodland full of trees.',
      climate: 'temperate',
    },
    organisms: [
      {
        id: 'oak', commonName: 'Oak Tree', scientificName: 'Quercus', role: 'producer',
        description: 'A big tree that makes its own food from sunshine.',
        imagePrompt: 'a large oak plant', adaptations: ['Deep roots'],
        position: { x: 20, y: 40 }, size: 'large',
      },
      {
        id: 'deer', commonName: 'Deer', scientificName: 'Odocoileus', role: 'primary-consumer',
        description: 'A gentle animal that eats leaves and grass.',
        imagePrompt: 'a brown deer', adaptations: ['Fast runner'],
        position: { x: 55, y: 60 }, size: 'medium',
      },
    ],
    relationships: [
      { fromId: 'deer', toId: 'oak', type: 'predation', description: 'Deer browse oak leaves' },
    ],
    environmentalFeatures: [
      { id: 'water', name: 'Stream', type: 'water', description: 'Fresh water', position: { x: 80, y: 80 } },
    ],
    gradeBand,
    disruptionScenario: {
      event: 'A dry summer reduces acorns',
      effects: ['Fewer deer'],
    },
  } as any,
  instanceId: 'test-habitat',
});

const sent = () => sendTextSpy.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cleanup();
  sendTextSpy.mockClear();
});

describe('HabitatDiorama reader-fit — the voice (was the SCAFFOLD-GAP)', () => {
  it('fires an ORIENT beat naming the living things, with a no-jargon clause at K-2', () => {
    render(<HabitatDiorama {...baseProps('K-2')} />);
    const orient = sent().find((m) => m.includes('[HABITAT_ORIENT]'))!;
    expect(orient).toBeTruthy();
    expect(orient).toMatch(/pre-reader who cannot read any text/i);
    expect(orient).toContain('Oak Tree, Deer');
    expect(orient).toMatch(/NEVER use the words producer, consumer, decomposer/i);
  });

  it('drops the no-jargon clause at 3-5, where the vocabulary is the point', () => {
    render(<HabitatDiorama {...baseProps('3-5')} />);
    const orient = sent().find((m) => m.includes('[HABITAT_ORIENT]'))!;
    expect(orient).not.toMatch(/NEVER use the words producer/i);
  });

  it('voices a tapped organism in child words, without the jargon', () => {
    render(<HabitatDiorama {...baseProps('K-2')} />);
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Deer' }));
    const msg = sent().find((m) => m.includes('[HABITAT_ORGANISM_SELECTED]'))!;
    expect(msg).toBeTruthy();
    expect(msg).toContain('Deer');
    expect(msg).toMatch(/what it eats or where it lives/i);
    expect(msg).toMatch(/Never say producer, consumer/i);
  });

  it('does not re-voice when the same organism is tapped closed', () => {
    render(<HabitatDiorama {...baseProps('K-2')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deer' }));
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Deer' })); // closes it
    expect(sent().some((m) => m.includes('[HABITAT_ORGANISM_SELECTED]'))).toBe(false);
  });

  it('read-aloud sends the organism description verbatim', () => {
    render(<HabitatDiorama {...baseProps('K-2')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deer' }));
    sendTextSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /tell me about the deer/i }));
    const msg = sent().find((m) => m.includes('[HABITAT_READ_ALOUD]'))!;
    expect(msg).toContain('A gentle animal that eats leaves and grass.');
  });

  it('every tagged send is silent', () => {
    render(<HabitatDiorama {...baseProps('K-2')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deer' }));
    sendTextSpy.mock.calls.forEach((call) => {
      if (/^\[[A-Z_]+\]/.test(String(call[0]))) {
        expect(call[1]).toEqual({ silent: true });
      }
    });
    expect(sendTextSpy).toHaveBeenCalled();
  });
});

describe('HabitatDiorama reader-fit — band contract at PRE (K-2)', () => {
  it('hides the ecological role badge at K-2 (rule 7)', () => {
    render(<HabitatDiorama {...baseProps('K-2')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deer' }));
    expect(screen.queryByText(/primary consumer/i)).toBeNull();
  });

  it('shows the role badge at 3-5, where the vocabulary is being taught', () => {
    render(<HabitatDiorama {...baseProps('3-5')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deer' }));
    // Appears twice at 3-5: the organism's badge and the roles legend.
    expect(screen.getAllByText(/primary consumer/i).length).toBeGreaterThanOrEqual(2);
  });

  it('hides the whole Organism Roles legend at K-2, not just its descriptions', () => {
    render(<HabitatDiorama {...baseProps('K-2')} />);
    expect(screen.queryByText(/Organism Roles:/i)).toBeNull();
    expect(screen.queryByText(/Decomposer/i)).toBeNull();
  });

  it('shows the roles legend WITH its descriptions at 3-5', () => {
    render(<HabitatDiorama {...baseProps('3-5')} />);
    expect(screen.getByText(/Organism Roles:/i)).toBeTruthy();
    expect(screen.getByText(/Breaks down dead matter/i)).toBeTruthy();
  });

  it("honours the component's pre-existing K-2 gates, which the generator had made unreachable", () => {
    // Relationships panel inside the info card is gated `gradeBand !== 'K-2'`.
    render(<HabitatDiorama {...baseProps('K-2')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deer' }));
    expect(screen.queryByText(/Relationships:/i)).toBeNull();
  });

  it('shows the relationships panel at 3-5', () => {
    render(<HabitatDiorama {...baseProps('3-5')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Deer' }));
    expect(screen.getByText(/Relationships:/i)).toBeTruthy();
  });

  it('still gives a K-2 child the organism story — by voice, with a read-aloud', () => {
    render(<HabitatDiorama {...baseProps('K-2')} />);
    fireEvent.click(screen.getByRole('button', { name: 'Oak Tree' }));
    expect(screen.getByRole('button', { name: /tell me about the oak tree/i })).toBeTruthy();
    expect(screen.getByText('A big tree that makes its own food from sunshine.')).toBeTruthy();
  });
});
