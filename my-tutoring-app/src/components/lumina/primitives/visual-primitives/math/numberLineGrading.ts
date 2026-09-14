/**
 * Placements are already snapped to the number type's grid, so the nearest grid
 * point to any reachable answer is the answer itself. A neighbouring grid point
 * (one tick short or past) is a different answer, not grading tolerance.
 */
export function isSnappedPlacementExact(placed: number, expected: number, snapPrecision: number): boolean {
  return Math.abs(placed - expected) < snapPrecision / 2;
}

export function isFindBetweenAnswerCorrect(
  point: number,
  bounds: number[],
  exactTargetValue: number | undefined,
  _numberType: string,
): boolean {
  if (bounds.length < 2) return false;
  if (typeof exactTargetValue === 'number' && Number.isFinite(exactTargetValue)) {
    // The pointer has already snapped to the number type's grid. A whole snap
    // step is therefore a different answer, not grading tolerance.
    return Math.abs(point - exactTargetValue) <= 0.001;
  }
  const low = Math.min(...bounds);
  const high = Math.max(...bounds);
  return point > low && point < high;
}
