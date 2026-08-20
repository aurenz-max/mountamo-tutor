export const VEHICLE_VISUAL_KINDS = [
  'airplane',
  'helicopter',
  'car',
  'bus',
  'train',
  'truck',
  'bicycle',
  'motorcycle',
  'ship',
  'boat',
  'submarine',
  'spacecraft',
  'construction',
  'generic',
] as const;

export type VehicleVisualKind = (typeof VEHICLE_VISUAL_KINDS)[number];
export type VehicleVisualCategory = 'air' | 'land' | 'sea' | 'space';

const VISUAL_KIND_SET = new Set<string>(VEHICLE_VISUAL_KINDS);

export function isVehicleVisualKind(value: unknown): value is VehicleVisualKind {
  return typeof value === 'string' && VISUAL_KIND_SET.has(value);
}

/**
 * Prefer an unambiguous class named by the vehicle itself, then accept the
 * bounded generator field. Unknown models stay generic instead of borrowing a
 * misleading category silhouette (for example, rendering every land vehicle
 * as a sedan).
 */
export function resolveVehicleVisualKind(vehicle: {
  name?: string | null;
  category?: VehicleVisualCategory | null;
  visualKind?: unknown;
}): VehicleVisualKind {
  const name = (vehicle.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const namedKinds: Array<[VehicleVisualKind, RegExp]> = [
    ['bicycle', /\b(bicycle|bike|bmx|tricycle|velocipede)\b/],
    ['motorcycle', /\b(motorcycle|motorbike|scooter|moped)\b/],
    ['bus', /\b(bus|coach)\b/],
    ['train', /\b(train|locomotive|railcar|shinkansen|metro|subway|tram|trolley)\b/],
    ['truck', /\b(truck|lorry|pickup|semi|tractor trailer)\b/],
    ['construction', /\b(excavator|bulldozer|backhoe|grader|forklift|crane|loader)\b/],
    ['helicopter', /\b(helicopter|chopper|rotorcraft)\b/],
    ['airplane', /\b(airplane|aeroplane|plane|jet|airliner|boeing|airbus|cessna|glider|wright flyer)\b/],
    ['submarine', /\b(submarine|submersible)\b/],
    ['ship', /\b(ship|liner|ferry|freighter|tanker|destroyer|carrier)\b/],
    ['boat', /\b(boat|canoe|kayak|yacht|sailboat|raft)\b/],
    ['spacecraft', /\b(spacecraft|spaceship|rocket|space shuttle|capsule|lander|space probe)\b/],
    ['car', /\b(car|sedan|coupe|hatchback|roadster|suv|taxi|van|tesla|model t)\b/],
  ];

  const namedKind = namedKinds.find(([, pattern]) => pattern.test(name))?.[0];
  if (namedKind) return namedKind;
  return isVehicleVisualKind(vehicle.visualKind) ? vehicle.visualKind : 'generic';
}
