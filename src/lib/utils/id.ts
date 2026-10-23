/**
 * Random id. With a prefix it matches the DB's id format
 * (e.g. `offer-3f2a…`), so records created optimistically keep the same id
 * once saved: links like /offers/:id never point at a temporary id.
 */
export const generateId = (prefix?: string) =>
  prefix ? `${prefix}-${crypto.randomUUID().replace(/-/g, '')}` : crypto.randomUUID()
