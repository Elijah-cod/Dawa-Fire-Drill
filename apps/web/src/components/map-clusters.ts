/**
 * Screen box (px) around a group's first point within which markers share one cluster: about
 * one cluster pill (at most 160 px wide, two lines high), so cluster labels cannot overlap.
 */
export const CLUSTER_BOX = Object.freeze({ width: 168, height: 48 });

/**
 * Screen-space grouping: start with one group per point and keep merging the first pair of
 * groups whose centres lie within one box of each other, until none do. Tight clusters stay
 * whole, no two cluster labels overlap, and the result is deterministic for a given order.
 */
export function clusterPoints<T extends { x: number; y: number }>(
  points: T[],
  box: { width: number; height: number } = CLUSTER_BOX,
): T[][] {
  const groups = points.map((point) => [point]);
  const centre = (group: T[]) => ({
    x: group.reduce((sum, item) => sum + item.x, 0) / group.length,
    y: group.reduce((sum, item) => sum + item.y, 0) / group.length,
  });
  for (let merged = true; merged;) {
    merged = false;
    search: for (let i = 0; i < groups.length; i++)
      for (let j = i + 1; j < groups.length; j++) {
        const a = centre(groups[i]);
        const b = centre(groups[j]);
        if (
          Math.abs(a.x - b.x) <= box.width &&
          Math.abs(a.y - b.y) <= box.height
        ) {
          groups[i].push(...groups.splice(j, 1)[0]);
          merged = true;
          break search;
        }
      }
  }
  return groups;
}

export type StatusCounts = {
  critical: number;
  watch: number;
  stable: number;
  unknown: number;
};
const ORDER = ["critical", "watch", "stable", "unknown"] as const;

/** Non-zero statuses, worst first, e.g. [["critical", 2], ["watch", 3], ["stable", 1]]. */
export function statusMix(counts: StatusCounts) {
  return ORDER.filter((status) => counts[status] > 0).map(
    (status) => [status, counts[status]] as const,
  );
}

/** Visible cluster text: size, then each non-zero status with a short label. */
export function clusterText(
  size: number,
  counts: StatusCounts,
  short: Record<(typeof ORDER)[number], string>,
) {
  return [
    String(size),
    ...statusMix(counts).map(([status, count]) => `${count} ${short[status]}`),
  ].join(" · ");
}
