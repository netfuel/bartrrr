import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { charCount, clampChars, formatCharCount, nearCharLimit } from './char-limit'
import { Input } from '@/components/ui/Input'

describe('charCount (T-66)', () => {
  it('counts code points, like Postgres char_length', () => {
    expect(charCount('')).toBe(0)
    expect(charCount('abc')).toBe(3)
    expect(charCount('🚲')).toBe(1)
    expect('🚲'.length).toBe(2) // what maxLength sees
    expect(charCount('🚲'.repeat(120))).toBe(120)
    expect(charCount('café')).toBe(4)
  })
})

describe('clampChars', () => {
  it('leaves text within the limit alone', () => {
    expect(clampChars('abc', 3)).toEqual({ value: 'abc', caret: 3 })
    expect(clampChars('🚲🚲', 2)).toEqual({ value: '🚲🚲', caret: 4 })
  })
  it('cuts at the end when typing at the end', () => {
    expect(clampChars('abcd', 3)).toEqual({ value: 'abc', caret: 3 })
    expect(clampChars('🚲'.repeat(121), 120).value).toBe('🚲'.repeat(120))
  })
  it('never splits an emoji in half', () => {
    const { value } = clampChars('a🚲🚲', 2)
    expect(value).toBe('a🚲')
    expect(value).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
  })
  it('drops what was just pasted in the middle, keeping the text after the caret', () => {
    // "ab|cd" with "XYZ" pasted at 2 → "abXYZ|cd", limit 5
    expect(clampChars('abXYZcd', 5, 5)).toEqual({ value: 'abXcd', caret: 3 })
  })
})

describe('counter copy', () => {
  it('formats with thousands separators', () => {
    expect(formatCharCount(1620, 2000)).toBe('1,620 of 2,000 characters')
    expect(formatCharCount(0, 500)).toBe('0 of 500 characters')
  })
  it('shows from 80% of the limit', () => {
    expect(nearCharLimit(399, 500)).toBe(false)
    expect(nearCharLimit(400, 500)).toBe(true)
  })
})

function Field({ limit }: { limit: number }) {
  const [v, setV] = useState('')
  return <Input label="Title" limit={limit} value={v} onChange={(e) => setV(e.target.value)} />
}

describe('<Input limit>', () => {
  afterEach(cleanup)

  it('has no maxLength, accepts 120 emoji in a 120 field and stops the 121st', () => {
    render(<Field limit={120} />)
    const input = screen.getByLabelText('Title') as HTMLInputElement
    expect(input.hasAttribute('maxlength')).toBe(false)
    fireEvent.change(input, { target: { value: '🚲'.repeat(120) } })
    expect(input.value).toBe('🚲'.repeat(120))
    expect(screen.getByText('120 of 120 characters')).toBeTruthy()
    fireEvent.change(input, { target: { value: '🚲'.repeat(121) } })
    expect(input.value).toBe('🚲'.repeat(120))
  })
  it('shows the counter only near the limit, linked to the field', () => {
    render(<Field limit={10} />)
    const input = screen.getByLabelText('Title') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(screen.queryByText(/of 10 characters/)).toBeNull()
    fireEvent.change(input, { target: { value: 'abcdefgh' } })
    const counter = screen.getByText('8 of 10 characters')
    expect(input.getAttribute('aria-describedby')).toContain(counter.id)
  })
  it('leaves IME composition alone, then trims when it ends', () => {
    render(<Field limit={3} />)
    const input = screen.getByLabelText('Title') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'ab' } })
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: 'abにほ' } })
    expect(input.value).toBe('abにほ')
    fireEvent.compositionEnd(input)
    expect(input.value).toBe('abに')
  })
})
