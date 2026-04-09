const AVATAR_COLORS = [
  '#C05A35',
  '#2A5240',
  '#3AABA6',
  '#C88A2A',
  '#7A9A3A',
]

export function hashToColor(id: string): string {
  const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}
