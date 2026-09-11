// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { selectSpatialPathChallenges } from '../../../service/math/gemini-spatial-path';
import SpatialPath, { type SpatialPathData } from './SpatialPath';

vi.mock('@/lib/firebase', () => ({
  auth: { currentUser: null, onAuthStateChanged: () => () => {} },
  db: {},
  app: {},
}));
vi.mock('../../../hooks/useLuminaAI', () => ({
  useLuminaAI: () => ({ sendText: vi.fn(), isConnected: false }),
}));
vi.mock('../../../utils/SoundManager', () => ({
  SoundManager: {
    playCorrect: vi.fn(), playIncorrect: vi.fn(), select: vi.fn(),
    isEnabled: () => false, getVolume: () => 0, celebrate: vi.fn(), play: vi.fn(),
  },
}));

afterEach(cleanup);

function mount() {
  const data: SpatialPathData = {
    title: 'Path Explorer',
    description: 'Choose by path shape.',
    challengeType: 'choose_route',
    challenges: selectSpatialPathChallenges(3),
    gradeBand: 'K',
    instanceId: 'spatial-path-test',
  };
  return render(<SpatialPath data={data} />);
}

describe('SpatialPath route evidence', () => {
  it('withholds the correct route highlight until submission, then replays the selected geometry', () => {
    const challenge = selectSpatialPathChallenges(3)[0];
    const correctRouteNumber = challenge.routes.findIndex(
      (route) => route.id === challenge.correctRouteId,
    ) + 1;
    const { container } = mount();
    const correctVisiblePath = container.querySelector('#spatial-path-1-route-through');
    expect(correctVisiblePath?.getAttribute('stroke')).not.toBe('#34d399');
    expect(screen.queryByText(new RegExp(`Route ${correctRouteNumber}: through`, 'i'))).toBeNull();

    fireEvent.click(screen.getByLabelText('Choose route 1'));
    fireEvent.click(screen.getByRole('button', { name: /animate this route/i }));

    expect(screen.getByText(new RegExp(`goes ${challenge.routes[0].relation}, not through`, 'i'))).toBeTruthy();
    expect(correctVisiblePath?.getAttribute('stroke')).toBe('#34d399');
    expect(screen.getByText(new RegExp(`Route ${correctRouteNumber}: through`, 'i'))).toBeTruthy();
    const replay = container.querySelector('animateMotion, animatemotion');
    expect(replay?.getAttribute('path')).toBe(challenge.routes[0].d);
  });
});
