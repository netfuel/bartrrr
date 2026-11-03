import { describe, expect, it } from 'vitest'
import { isMemphisZip, MEMPHIS_ZIP_CODES } from './zip'
import { ZIP_CENTROIDS } from './zipCentroids'
import { getZipFromCoords } from './geolocation'

// O-01: who can sign up (Memphis service area)
describe('isMemphisZip (O-01)', () => {
  it.each(['38103', '38104', '38111', '38117', '38122', '38152', '38016', '38018', '38027', '38053', '38060', '38157'])(
    'accepts Memphis-area ZIP %s',
    (zip) => {
      expect(isMemphisZip(zip)).toBe(true)
    },
  )

  it.each([
    ['38654', 'Olive Branch, MS'],
    ['38671', 'Southaven, MS'],
    ['72301', 'West Memphis, AR'],
    ['38002', 'Arlington, TN (in the centroid table but outside the area)'],
    ['37203', 'Nashville'],
    ['10001', 'New York'],
  ])('rejects %s (%s)', (zip) => {
    expect(isMemphisZip(zip)).toBe(false)
  })

  it('trims surrounding whitespace', () => {
    expect(isMemphisZip(' 38104 ')).toBe(true)
    expect(isMemphisZip('\t38152\n')).toBe(true)
  })

  it.each(['', ' ', '3810', '381044', '38104-1234', 'abcde', '38 104', '３８１０４', '38104;drop', '-38104', '38104.0'])(
    'rejects malformed input %j',
    (zip) => {
      expect(isMemphisZip(zip)).toBe(false)
    },
  )

  it('only contains 5-digit ZIPs', () => {
    for (const zip of MEMPHIS_ZIP_CODES) expect(zip).toMatch(/^\d{5}$/)
  })
})

describe('ZIP centroids and on-device ZIP lookup (O-01)', () => {
  it('has well-formed rows with Memphis-region coordinates and no duplicates', () => {
    const seen = new Set<string>()
    for (const [zip, lat, lng] of ZIP_CENTROIDS) {
      expect(zip).toMatch(/^\d{5}$/)
      expect(seen.has(zip)).toBe(false)
      seen.add(zip)
      expect(lat).toBeGreaterThan(34.5)
      expect(lat).toBeLessThan(35.8)
      expect(lng).toBeGreaterThan(-90.6)
      expect(lng).toBeLessThan(-89.4)
    }
  })

  it('has a centroid for every service-area ZIP except the PO-box-only ones', () => {
    const withCentroid = new Set(ZIP_CENTROIDS.map(([z]) => z))
    const missing = [...MEMPHIS_ZIP_CODES].filter((z) => !withCentroid.has(z)).sort()
    expect(missing).toEqual(['38027', '38157'])
  })

  it('resolves each centroid back to its own ZIP', async () => {
    for (const [zip, lat, lng] of ZIP_CENTROIDS) {
      await expect(getZipFromCoords(lat, lng)).resolves.toBe(zip)
    }
  })

  it('resolves 38122 and 38152 from their centroids and both are in the service area', async () => {
    for (const zip of ['38122', '38152']) {
      const row = ZIP_CENTROIDS.find(([z]) => z === zip)
      expect(row).toBeDefined()
      const found = await getZipFromCoords(row![1], row![2])
      expect(found).toBe(zip)
      expect(isMemphisZip(found!)).toBe(true)
    }
  })

  it('resolves a nearby suburb outside the area to its own ZIP, which is then refused', async () => {
    const arlington = ZIP_CENTROIDS.find(([z]) => z === '38002')!
    const zip = await getZipFromCoords(arlington[1], arlington[2])
    expect(zip).toBe('38002')
    expect(isMemphisZip(zip!)).toBe(false)
  })

  it('returns null far from Memphis and for non-finite input', async () => {
    await expect(getZipFromCoords(36.1627, -86.7816)).resolves.toBeNull() // Nashville
    await expect(getZipFromCoords(0, 0)).resolves.toBeNull()
    await expect(getZipFromCoords(Number.NaN, -90)).resolves.toBeNull()
    await expect(getZipFromCoords(35.1, Number.POSITIVE_INFINITY)).resolves.toBeNull()
  })
})
