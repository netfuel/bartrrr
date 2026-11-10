import { z } from 'zod'
import { ValidationError } from './validation-error'

/**
 * Validation at the client ↔ server boundary. These mirror the length
 * limits in supabase/migrations/004 so users get a clear message before the
 * database rejects the write. The database remains the real enforcement.
 */

/**
 * Length in characters the way Postgres char_length counts them: code
 * points, so an emoji is 1, not the 2 UTF-16 units String.length sees.
 */
export const charCount = (s: string) => [...s].length

/**
 * A max-length rule that counts code points (zod's .max() counts UTF-16
 * units, so emoji would count double against limits the database counts
 * once). Same issue shape and default message as .max().
 */
const maxChars = (max: number, message?: string) => (v: string, ctx: z.RefinementCtx) => {
  if (charCount(v) > max) {
    ctx.addIssue({ code: 'too_big', origin: 'string', maximum: max, inclusive: true, input: v, ...(message && { message }) })
  }
}

const trimmed = (max: number, min = 0) => z.string().trim().min(min).superRefine(maxChars(max))

/** bcrypt (Supabase Auth) only takes the first 72 bytes and refuses longer ones. */
export const PASSWORD_MAX_BYTES = 72
const utf8Bytes = (s: string) => new TextEncoder().encode(s).length

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.'))

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use 72 characters or fewer.')
  // Accented letters and emoji take 2–4 bytes each; only flag this when the
  // character count passed, so people see one reason at a time
  .refine(
    (p) => p.length > 72 || utf8Bytes(p) <= PASSWORD_MAX_BYTES,
    'Use a shorter password. Accented letters and emoji count extra toward the 72-character limit.',
  )
  .regex(/[a-zA-Z]/, 'Include at least one letter.')
  .regex(/\d/, 'Include at least one number.')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
})

export const signupSchema = z.object({
  displayName: trimmed(60, 1),
  email: emailSchema,
  password: passwordSchema,
})

/** Only https images may be stored or rendered from user content. */
export const httpsUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => {
    try {
      return new URL(v).protocol === 'https:'
    } catch {
      return false
    }
  }, 'Use an https:// image link.')

export const profileUpdateSchema = z
  .object({
    username: z.string().regex(/^[a-z0-9_]{2,32}$/),
    displayName: trimmed(60, 1),
    avatarUrl: httpsUrlSchema.optional(),
    bio: trimmed(500),
    neighborhood: trimmed(80),
    interests: z.array(trimmed(40, 1)).max(32),
    notificationPrefs: z.object({
      newOffers: z.boolean(),
      messages: z.boolean(),
      agreementUpdates: z.boolean(),
      tradeCompletions: z.boolean(),
      perfectMatches: z.boolean(),
    }),
  })
  .partial()

/** Listing titles: what the post and edit forms allow (T-65). */
export const LISTING_TITLE_MAX = 80

export const listingInputSchema = z.object({
  // The form caps titles at 80 so they fit on cards; the database allows 120 (T-65)
  title: z.string().trim().min(1).superRefine(maxChars(LISTING_TITLE_MAX, `Keep the title to ${LISTING_TITLE_MAX} characters or fewer.`)),
  description: trimmed(4000),
  category: z.enum(['goods', 'services', 'skills', 'outdoor']),
  // null clears it (an edit that switches to services or skills, T-49)
  condition: z.enum(['new', 'like_new', 'good', 'fair']).nullable().optional(),
  seeking: trimmed(1000, 1),
  images: z.array(httpsUrlSchema).max(6),
})

export const offerMessageSchema = trimmed(2000, 1)
export const offerItemsSchema = z.array(trimmed(200, 1)).max(10)
export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: trimmed(1000),
})

/**
 * Trade agreement time and place (agreements_terms_len in 004, details
 * guard in 009). Each part is optional so neighbors can fill it in over
 * time; signing needs method, time and place (enforced by the server).
 */
export const exchangeDetailsSchema = z.object({
  exchangeMethod: z.enum(['in_person', 'dropoff', 'service_at_location']).optional(),
  exchangeDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Pick a date and time for the swap.')
    .refine((v) => Date.parse(v) > Date.now(), "Pick a time that hasn't happened yet.")
    .optional(),
  exchangeLocation: z.string().trim().superRefine(maxChars(300, 'Keep the place to 300 characters or fewer.')).optional(),
  specialInstructions: z.string().trim().superRefine(maxChars(1000, 'Keep notes to 1,000 characters or fewer.')).optional(),
})

export const disputeReasonSchema = z
  .string()
  .trim()
  .min(1, 'Say briefly what went wrong.')
  .superRefine(maxChars(500, 'Keep it to 500 characters or fewer.'))

export { ValidationError }

/** Parse or throw a ValidationError carrying the first issue's message. */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    const issue = result.error.issues[0]
    const field = issue?.path.join('.')
    throw new ValidationError(field ? `${field}: ${issue.message}` : (issue?.message ?? 'Invalid input'))
  }
  return result.data
}

/** True for http(s) URLs safe to put in an <img src> or <a href>. */
export function isSafeHttpUrl(value: string | undefined | null): value is string {
  if (!value) return false
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}
