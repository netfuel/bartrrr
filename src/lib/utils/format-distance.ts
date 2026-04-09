export function formatDistance(mi: number): string {
  if (mi < 0.1) return 'Nearby'
  if (mi < 1) return `${(mi * 5280).toFixed(0)} ft away`
  return `${mi.toFixed(1)} mi away`
}
