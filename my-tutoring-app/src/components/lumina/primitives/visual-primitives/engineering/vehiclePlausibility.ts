/**
 * vehicle-comparison-lab: the range a real vehicle's statistic can fall in, by the kind of vehicle drawn (ruling R24,
 * 2026-10-16). The statistics are model-written facts and the keys are computed from the numbers shown, so a wrong
 * number is wrong on screen but scores consistently. A value outside its range (a jet at 9 km/h, a car of 40 tons) is
 * left off the table, and the oracle counts how often the model writes one.
 *
 * The ranges are wide on purpose: they catch a slipped unit or a lost digit, not a close call between two real values.
 * A unit the converter does not know is not judged.
 */
import type { VehicleVisualKind } from './vehicleVisualKind';
import type { MetricKey } from './vehicleComparisonWorkspace';

type Range = [number, number];
/** Canonical units: km/h, kg, km, people, tons, year, grams of CO₂ per rider per km. */
const ANY: Record<MetricKey, Range> = {
  topSpeed: [1, 800_000], weight: [1, 6e8], range: [1, 3e10], passengerCapacity: [0, 10_000],
  cargoCapacity: [0, 500_000], yearIntroduced: [-3000, 2035], co2PerPassengerKm: [0, 2000],
};
const BY_KIND: Partial<Record<VehicleVisualKind, Partial<Record<MetricKey, Range>>>> = {
  bicycle: { topSpeed: [8, 90], weight: [4, 40], passengerCapacity: [1, 3], cargoCapacity: [0, 0.5], yearIntroduced: [1810, 2035], co2PerPassengerKm: [0, 50] },
  motorcycle: { topSpeed: [40, 450], weight: [50, 600], passengerCapacity: [1, 3], cargoCapacity: [0, 0.5], range: [50, 1500], yearIntroduced: [1880, 2035] },
  car: { topSpeed: [40, 500], weight: [400, 5000], passengerCapacity: [1, 9], cargoCapacity: [0, 1.5], range: [50, 2500], yearIntroduced: [1880, 2035] },
  bus: { topSpeed: [30, 180], weight: [3000, 35_000], passengerCapacity: [8, 300], cargoCapacity: [0, 10], range: [50, 2500], yearIntroduced: [1820, 2035] },
  truck: { topSpeed: [30, 200], weight: [1500, 700_000], passengerCapacity: [1, 4], cargoCapacity: [0.3, 500], range: [50, 5000], yearIntroduced: [1890, 2035] },
  train: { topSpeed: [20, 650], weight: [10_000, 1.2e8], passengerCapacity: [0, 5000], cargoCapacity: [0, 100_000], yearIntroduced: [1800, 2035] },
  ship: { topSpeed: [5, 110], weight: [50_000, 6e8], cargoCapacity: [0, 500_000], range: [200, 1e6] },
  boat: { topSpeed: [2, 200], weight: [20, 1e6], passengerCapacity: [1, 2000], cargoCapacity: [0, 2000] },
  submarine: { topSpeed: [5, 90], weight: [5000, 5e7], passengerCapacity: [0, 200], yearIntroduced: [1600, 2035] },
  airplane: { topSpeed: [80, 4000], weight: [200, 700_000], passengerCapacity: [0, 900], cargoCapacity: [0, 300], range: [100, 45_000], yearIntroduced: [1903, 2035], co2PerPassengerKm: [20, 1000] },
  helicopter: { topSpeed: [60, 450], weight: [300, 60_000], passengerCapacity: [0, 100], cargoCapacity: [0, 30], range: [50, 2500], yearIntroduced: [1930, 2035] },
  spacecraft: { topSpeed: [1000, 800_000], weight: [1, 5e6], passengerCapacity: [0, 12], yearIntroduced: [1940, 2035] },
  construction: { topSpeed: [1, 130], weight: [300, 1.5e7], passengerCapacity: [0, 4], cargoCapacity: [0, 500], yearIntroduced: [1830, 2035] },
};

/** The value in the canonical unit, or null when the unit is not one this converter knows. */
export function toCanonical(m: MetricKey, value: number, unit: string): number | null {
  const u = unit.trim().toLowerCase().replace(/\.$/, '');
  if (m === 'topSpeed') {
    if (/^(km\/h|kmh|kph|km per hour|kilometers? per hour|kilometres? per hour)$/.test(u)) return value;
    if (/^(mph|mi\/h|miles? per hour)$/.test(u)) return value * 1.609;
    if (/^(knots?|kn|kt)$/.test(u)) return value * 1.852;
    if (/^(m\/s|meters? per second|metres? per second)$/.test(u)) return value * 3.6;
    return null;
  }
  if (m === 'weight') {
    if (/^(kg|kgs|kilograms?)$/.test(u)) return value;
    if (/^(t|tons?|tonnes?|metric tons?)$/.test(u)) return value * 1000;
    if (/^(lb|lbs|pounds?)$/.test(u)) return value * 0.4536;
    return null;
  }
  if (m === 'range') {
    if (/^(km|kms|kilometers?|kilometres?)$/.test(u)) return value;
    if (/^(mi|miles?)$/.test(u)) return value * 1.609;
    if (/^(nmi|nautical miles?)$/.test(u)) return value * 1.852;
    return null;
  }
  return value;
}

/** False when a vehicle of this kind could not have this statistic. Unknown kinds and units pass. */
export function plausible(m: MetricKey, value: number, unit: string, kind?: VehicleVisualKind): boolean {
  const v = toCanonical(m, value, unit);
  if (v == null) return true;
  const [lo, hi] = (kind && BY_KIND[kind]?.[m]) || ANY[m];
  return v >= lo && v <= hi;
}
