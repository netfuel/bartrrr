import { z } from 'zod'
import { ValidationError } from './validation-error'

/**
 * Validation at the client ↔ server boundary. These mirror the length
 * limits in supabase/migrations/004 so users get a clear message before the
 * database rejects the write. The database remains the real enforcement.
 */

const trimmed = (max: number, min = 0) => z.string().trim().min(min).max(max)

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.'))

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(72, 'Use 72 characters or fewer.')
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

export const listingInputSchema = z.object({
  title: trimmed(120, 1),
  description: trimmed(4000),
  category: z.enum(['goods', 'services', 'skills', 'outdoor']),
  condition: z.enum(['new', 'like_new', 'good', 'fair']).optional(),
  seeking: trimmed(1000, 1),
  images: z.array(httpsUrlSchema).max(6),
})

export const offerMessageSchema = trimmed(2000, 1)
export const offerItemsSchema = z.array(trimmed(200, 1)).max(10)
export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: trimmed(1000),
})

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
