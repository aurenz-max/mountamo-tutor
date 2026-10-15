import { describe, expect, it } from 'vitest';
import {
  AIRPLANE_PARTS, PART_INFO, airplaneMiss, askFor, buildAirplaneChallenge, buildFlightPlanChallenge, flightFeedback,
  flightMiss, flyTrip, pickFlightNumbers, selectParts, tanksNeeded, tapFeedback,
} from './airplaneModel';
import { airplaneScene } from './airplaneWorkspace';
import { cleanAirline, cleanFocus, cleanTrips, framingNamesPart } from '../../../service/engineering/gemini-airplane-diorama';

describe('airplane diorama model', () => {
  it('a job ask never names its part (or any part); a name ask does', () => {
    for (const part of AIRPLANE_PARTS) {
      const job = askFor(part, 'job').toLowerCase();
      for (const other of AIRPLANE_PARTS) {
        expect(job, `${part} job ask names ${other}`).not.toContain(PART_INFO[other].title.toLowerCase());
      }
      expect(askFor(part, 'name')).toContain(PART_INFO[part].name);
    }
  });

  it('band picks the ask style: K-2 by name, 3-5 by job', () => {
    expect(buildAirplaneChallenge('wings', { id: 'a', band: 'K-2' }).instruction).toBe('Find the wings on the jet and tap them.');
    expect(buildAirplaneChallenge('engines', { id: 'a', band: '3-5' }).instruction).toBe('Find the part that pushes the plane forward and tap it.');
  });

  it('the miss is close for a neighbouring part, wrong otherwise, none for the right one', () => {
    const c = buildAirplaneChallenge('wings', { id: 'a', band: 'K-2' });
    expect(airplaneMiss(c, 'wings')).toBeUndefined();
    expect(airplaneMiss(c, 'tail')).toBe('close_part');
    expect(airplaneMiss(c, 'nose')).toBe('wrong_part');
  });

  it('feedback names what was tapped and, on a job ask, never the asked part', () => {
    const c = buildAirplaneChallenge('engines', { id: 'a', band: '3-5' });
    const wrong = tapFeedback(c, 'tail');
    expect(wrong).toContain('the tail');
    expect(wrong.toLowerCase()).not.toContain('engine');
    expect(tapFeedback(c, 'engines')).toMatch(/^Yes!/);
  });

  it('selectParts puts the focus first and never repeats a part', () => {
    const parts = selectParts(['engines', 'wings', 'engines'], 5, () => 0.3);
    expect(parts.slice(0, 2)).toEqual(['engines', 'wings']);
    expect(new Set(parts).size).toBe(5);
  });

  it('the scene never tells the tutor which part a job ask wants', () => {
    const c = buildAirplaneChallenge('gear', { id: 'a', band: '3-5' });
    const facts = JSON.stringify(airplaneScene(c, { tapped: 'wings', taps: 1, showing: false }));
    expect(facts).not.toMatch(/gear/i);
    expect(facts).toContain('the wings');
  });

  it('cleans the airline and focus the model returns', () => {
    expect(cleanAirline('Bluebird')).toBe('Bluebird');
    expect(cleanAirline('Delta 123')).toBe('Skyway');
    expect(cleanFocus(['wings', 'propeller', 'wings', 'tail'])).toEqual(['wings', 'tail']);
  });

  it('flags framing that names a part (a job-ask session cannot show it)', () => {
    expect(framingNamesPart('Wings and Engines')).toBe(true);
    expect(framingNamesPart('How a Jet Flies')).toBe(false);
    expect(framingNamesPart('Nosey Neighbors')).toBe(false);
  });
});

describe('airplane flight plan', () => {
  const trip = { from: 'Pine Hill', to: 'Bay Town', cargo: 'the school band' };

  it('the key is the trip tanks plus one spare; misses split short, no spare and too much', () => {
    const c = buildFlightPlanChallenge(trip, { units: 'km', distance: 1200, perTank: 300 }, 'f');
    expect(tanksNeeded(c)).toBe(5);
    expect(flightMiss(c, 3)).toBe('too_little_fuel');
    expect(flightMiss(c, 4)).toBe('no_spare_fuel');
    expect(flightMiss(c, 5)).toBeUndefined();
    expect(flightMiss(c, 7)).toBe('too_much_fuel');
    expect(flyTrip(c, 3)).toMatchObject({ reached: false, flown: 900, short: 300 });
    expect(flyTrip(c, 7)).toMatchObject({ reached: true, left: 3 });
  });

  it('the instruction states the trip and the rule, never the number of tanks', () => {
    for (const band of ['K-2', '3-5'] as const) {
      for (const numbers of pickFlightNumbers(band, 4)) {
        const c = buildFlightPlanChallenge(trip, numbers, 'f');
        expect(c.instruction).toContain('Bay Town');
        expect(c.instruction).toMatch(/spare tank/);
        expect(c.instruction).not.toMatch(new RegExp(`\b${tanksNeeded(c)} tanks\b`));
        const facts = JSON.stringify(airplaneScene(c, { tapped: null, taps: 0, showing: false, loaded: 0, flights: 0 }));
        expect(facts).not.toMatch(new RegExp(`\b${tanksNeeded(c)} (spare )?tanks?\b`));
      }
    }
  });

  it('a session gets different tank counts; K-2 is hops, 3-5 a distance to divide', () => {
    const k = pickFlightNumbers('K-2', 4, () => 0.42);
    expect(k.every(n => n.units === 'hops' && n.perTank === 1)).toBe(true);
    expect(new Set(k.map(n => n.distance)).size).toBe(4);
    const g = pickFlightNumbers('3-5', 4, () => 0.42);
    expect(g.every(n => n.units === 'km' && n.distance % n.perTank === 0 && n.distance / n.perTank >= 3)).toBe(true);
    expect(new Set(g.map(n => n.distance / n.perTank)).size).toBe(4);
  });

  it('feedback after a flight says what happened, never how many tanks were needed', () => {
    const c = buildFlightPlanChallenge(trip, { units: 'hops', distance: 4, perTank: 1 }, 'f');
    expect(flightFeedback(c, flyTrip(c, 2))).toBe('Out of fuel! The jet flew 2 hops and had to land 2 hops short of Bay Town.');
    expect(flightFeedback(c, flyTrip(c, 4))).toMatch(/tanks were empty/);
    expect(flightFeedback(c, flyTrip(c, 5))).toMatch(/^Yes!.*1 spare tank left/);
    expect(flightFeedback(c, flyTrip(c, 8))).toMatch(/4 tanks left, more than the spare/);
  });

  it('cleans trips: made-up towns, a the/a cargo, no digits, no repeats', () => {
    expect(cleanTrips([
      { from: 'pine hill', to: 'Bay Town', cargo: 'The school band.' },
      { from: 'Route 9', to: 'Elm', cargo: 'the team' },
      { from: 'Elm', to: 'Elm', cargo: 'the team' },
      { from: 'Elm', to: 'Bay Town', cargo: 'a load of apples' },
      { from: 'Oak', to: 'Snow Peak', cargo: 'skiers' },
    ])).toEqual([{ from: 'Pine Hill', to: 'Bay Town', cargo: 'the school band' }]);
  });
});
