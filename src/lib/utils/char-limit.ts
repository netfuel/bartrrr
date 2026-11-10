import { useRef, type ChangeEvent, type CompositionEvent } from 'react'
import { charCount } from '@/lib/validation'

/*
 * Character limits the way Postgres char_length and our validation count
 * them: code points, so an emoji is 1. The browser's `maxLength` counts
 * UTF-16 units instead, which cuts emoji-heavy text at about half the real
 * limit (T-66), so text fields use `limit` (this file) rather than maxLength.
 */
export { charCount }

/**
 * Cut `value` down to `max` characters. The characters removed are the ones
 * just before the caret (what was just typed or pasted), so pasting into the
 * middle of a full field keeps the text after the caret intact.
 * `caret` and the returned caret are UTF-16 offsets, like selectionEnd.
 */
export function clampChars(value: string, max: number, caret = value.length): { value: string; caret: number } {
  const over = charCount(value) - max
  if (over <= 0) return { value, caret }
  const before = Array.from(value.slice(0, caret))
  if (before.length >= over) {
    const kept = before.slice(0, before.length - over).join('')
    return { value: kept + value.slice(caret), caret: kept.length }
  }
  const cut = Array.from(value).slice(0, max).join('')
  return { value: cut, caret: Math.min(caret, cut.length) }
}

/** Show the counter once text reaches this share of the limit. */
const NEAR = 0.8

/** "1,620 of 2,000 characters" */
export const formatCharCount = (count: number, max: number) =>
  `${count.toLocaleString('en-US')} of ${max.toLocaleString('en-US')} characters`

/** True once `count` is close enough to `max` that the counter should show. */
export const nearCharLimit = (count: number, max: number) => count >= Math.floor(max * NEAR)

type TextEl = HTMLInputElement | HTMLTextAreaElement

/** Set a field's value so React's onChange sees it (bypasses React's value tracker). */
function setNativeValue(el: TextEl, value: string) {
  const proto = Object.getPrototypeOf(el) as object
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
}

/**
 * Trim the field in place. `untracked` writes past React's value tracker so
 * a change event dispatched afterwards still reaches onChange; inside
 * onChange the normal setter is used so the tracker stays in step.
 */
function clampElement(el: TextEl, max: number, untracked = false): boolean {
  if (charCount(el.value) <= max) return false
  let caret = el.value.length
  try {
    caret = el.selectionEnd ?? caret
  } catch {
    // Some input types (email) have no selection
  }
  const next = clampChars(el.value, max, caret)
  if (untracked) setNativeValue(el, next.value)
  else el.value = next.value
  try {
    el.setSelectionRange(next.caret, next.caret)
  } catch {
    // ignore: no selection API on this input type
  }
  return true
}

interface CharLimitHandlers<E extends TextEl> {
  onChange?: (e: ChangeEvent<E>) => void
  onCompositionStart?: (e: CompositionEvent<E>) => void
  onCompositionEnd?: (e: CompositionEvent<E>) => void
}

/**
 * Blocks typing and pasting past `max` characters (code points). Text being
 * composed with an IME (Japanese, Chinese, Korean…) is left alone until the
 * composition ends, then trimmed, so candidate selection isn't broken.
 * Spread the returned handlers on the field in place of your own.
 */
export function useCharLimit<E extends TextEl>(
  max: number | undefined,
  handlers: CharLimitHandlers<E>,
): Required<CharLimitHandlers<E>> {
  const composing = useRef(false)
  const { onChange, onCompositionStart, onCompositionEnd } = handlers
  return {
    onChange: (e) => {
      const native = e.nativeEvent as InputEvent
      if (max !== undefined && !composing.current && !native.isComposing) clampElement(e.target, max)
      onChange?.(e)
    },
    onCompositionStart: (e) => {
      composing.current = true
      onCompositionStart?.(e)
    },
    onCompositionEnd: (e) => {
      composing.current = false
      onCompositionEnd?.(e)
      const el = e.currentTarget
      if (max === undefined || !clampElement(el, max, true)) return
      // Let React see the trimmed value through a normal change event
      el.dispatchEvent(new Event('input', { bubbles: true }))
    },
  }
}

/** Whether a field with `limit` shows its counter for `value` right now. */
export function showsCharCounter(value: unknown, limit: number | undefined, always = false): limit is number {
  if (limit === undefined) return false
  return always || nearCharLimit(charCount(String(value ?? '')), limit)
}
