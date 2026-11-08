/** Screen distance (px) within which markers share one cluster; about one marker width. */
export const CLUSTER_RADIUS_PX = 48;

/**
 * Greedy screen-space grouping in input order: each point joins the first group whose
 * anchor (first point) lies within the radius. Deterministic for a given order and zoom.
 */
export function clusterPoints<T extends { x: number; y: number }>(
  points: T[],
  radius = CLUSTER_RADIUS_PX,
): T[][] {
  const groups: T[][] = [];
  for (const point of points) {
    const group = groups.find(
      ([anchor]) =>
        Math.hypot(anchor.x - point.x, anchor.y - point.y) <= radius,
    );
    if (group) group.push(point);
    else groups.push([point]);
  }
  return groups;
}
