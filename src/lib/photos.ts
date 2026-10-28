/**
 * Listing photo uploads.
 *
 * Every photo is decoded and re-drawn on a canvas before it leaves the
 * device: that shrinks it (longest side 1600px), fixes phone rotation, and
 * drops EXIF metadata, including GPS location. Only the re-encoded image is
 * uploaded, to Supabase Storage at listing-photos/<user id>/<random id>.
 *
 * In offline demo mode (no Supabase) photos stay on the device as blob: URLs.
 */
import { supabase } from '@/lib/supabase'
import { SUPABASE_URL } from '@/lib/env'

export const PHOTO_BUCKET = 'listing-photos'
export const MAX_PHOTOS = 6
const MAX_EDGE = 1600
const MAX_INPUT_BYTES = 25 * 1024 * 1024
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024 // matches the bucket limit (migration 008)

export class PhotoError extends Error {
  /** True when trying the same file again could work (network, server) */
  readonly retryable: boolean
  constructor(message: string, retryable = false) {
    super(message)
    this.retryable = retryable
  }
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Older Safari: fall back to an <img>, which also applies EXIF rotation
    const url = URL.createObjectURL(file)
    try {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('decode failed'))
        img.src = url
      })
    } finally {
      // The decoded pixels stay usable after the URL is revoked
      setTimeout(() => URL.revokeObjectURL(url), 0)
    }
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Resize, rotate and strip metadata. Returns a WebP (or JPEG) blob. */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
    throw new PhotoError('That file isn’t a photo. Choose a JPEG, PNG, WebP or HEIC image.')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new PhotoError('That photo is over 25 MB. Choose a smaller one.')
  }

  let source: ImageBitmap | HTMLImageElement
  try {
    source = await decode(file)
  } catch {
    throw new PhotoError('This browser can’t open that photo. Try a JPEG or PNG, or take a screenshot of it.')
  }

  const w = 'naturalWidth' in source ? source.naturalWidth : source.width
  const h = 'naturalHeight' in source ? source.naturalHeight : source.height
  if (!w || !h) throw new PhotoError('That photo looks empty. Try another one.')
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new PhotoError('This browser can’t prepare photos. Try another browser.')
  // White under transparent PNGs, since JPEG has no alpha
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  if ('close' in source) source.close()

  // Safari can't encode WebP and silently returns PNG; fall back to JPEG
  let blob = await toBlob(canvas, 'image/webp', 0.82)
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', 0.85)
  if (!blob) throw new PhotoError('We couldn’t prepare that photo. Try another one.')
  if (blob.size > MAX_OUTPUT_BYTES) blob = (await toBlob(canvas, 'image/jpeg', 0.7)) ?? blob
  if (blob.size > MAX_OUTPUT_BYTES) throw new PhotoError('That photo is too detailed to upload. Try another one.')
  return blob
}

/** Prepare and upload one photo. Resolves to its public https URL. */
export async function uploadListingPhoto(file: File, userId: string): Promise<string> {
  const blob = await preparePhoto(file)
  if (!supabase) return URL.createObjectURL(blob)

  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) {
    throw new PhotoError(
      navigator.onLine === false
        ? 'You’re offline. Reconnect and try that photo again.'
        : 'That photo didn’t upload. Try again in a moment.',
      true,
    )
  }
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
}

/** The storage path for a URL we host, or null for outside links. */
export function ownedPhotoPath(url: string): string | null {
  if (!SUPABASE_URL) return null
  const prefix = `${SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/${PHOTO_BUCKET}/`
  return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null
}

/**
 * Best-effort cleanup of photos we host that are no longer used. Failures
 * are ignored: an orphaned file is harmless and is removed with the account.
 */
export async function deleteListingPhotos(urls: string[]): Promise<void> {
  const paths = urls.map(ownedPhotoPath).filter((p): p is string => Boolean(p))
  urls.filter((u) => u.startsWith('blob:')).forEach((u) => URL.revokeObjectURL(u))
  if (!supabase || paths.length === 0) return
  await supabase.storage.from(PHOTO_BUCKET).remove(paths).catch(() => undefined)
}
