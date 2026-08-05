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
