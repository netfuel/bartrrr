import { describe, expect, it } from 'vitest'
import * as zip from './zip'

describe('Memphis service area', () => {
  it('exports something to check ZIPs with', () => {
    expect(Object.keys(zip).length).toBeGreaterThan(0)
  })
})
