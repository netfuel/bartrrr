// Initials fallbacks draw from the earth palette (all clear AA with cream text)
const AVATAR_COLORS = [
  '#9c5b3c', // clay
  '#4a5240', // forest
  '#4d6a62', // teal
  '#86662a', // gold
  '#5f6532', // moss
]

export function hashToColor(id: string): string {
  const n = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}
