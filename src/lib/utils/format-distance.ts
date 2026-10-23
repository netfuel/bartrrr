export function formatDistance(mi: number): string {
  if (mi < 0.1) return 'Nearby'
  if (mi < 1) return `${mi.toFixed(1)} mi away`
  return `${mi.toFixed(1)} mi away`
}
