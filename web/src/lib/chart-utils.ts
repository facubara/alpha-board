/**
 * Utility to determine which Y-axis labels should be visible
 * based on proximity, avoiding overlapping text.
 */
export function getYAxisLabelVisibility(
  baselineY: number,
  maxY: number,
  minY: number | null,
  minGap = 20
): { showBaseline: boolean; showMax: boolean; showMin: boolean } {
  const showMax = true;

  const showMin =
    minY !== null && Math.abs(minY - maxY) > minGap;

  const showBaseline =
    Math.abs(baselineY - maxY) > minGap &&
    (minY === null || Math.abs(baselineY - minY) > minGap);

  return { showBaseline, showMax, showMin };
}
