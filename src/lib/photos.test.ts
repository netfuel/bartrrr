import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const upload = vi.fn()
  const remove = vi.fn()
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://proj.supabase.co/storage/v1/object/public/listing-photos/${path}` },
  }))
  const from = vi.fn(() => ({ upload, remove, getPublicUrl }))
  return {
    upload,
    remove,
    getPublicUrl,
    from,
    client: { storage: { from } } as unknown,
    useClient: true,
  }
})

vi.mock('@/lib/env', () => ({ SUPABASE_URL: 'https://proj.supabase.co/' }))
vi.mock('@/lib/supabase', () => ({
  get supabase() {
    return h.useClient ? h.client : null
  },
}))

import {
  AVATAR_EDGE,
  deleteListingPhotos,
  deleteOwnedPhotos,
  MAX_PHOTOS,
  ownedPhotoPath,
  PHOTO_BUCKET,
  PhotoError,
  preparePhoto,
  uploadAvatar,
  uploadListingPhoto,
} from './photos'

const MB = 1024 * 1024
const OWNED = 'https://proj.supabase.co/storage/v1/object/public/listing-photos/'

interface Encode {
  type: string
  quality: number
  width: number
  height: number
}

let encodes: Encode[]
let draws: unknown[][]
/** What toBlob hands back for a requested type: [type, size] or null */
let encoder: (type: string, quality: number) => [string, number] | null
let bitmap: { width: number; height: number; close: ReturnType<typeof vi.fn> }

function photo(name = 'bike.jpg', type = 'image/jpeg', size = 2 * MB): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

beforeEach(() => {
  encodes = []
  draws = []
  encoder = (type) => [type, 300 * 1024]
  bitmap = { width: 4000, height: 3000, close: vi.fn() }
  h.useClient = true
  h.upload.mockReset().mockResolvedValue({ data: {}, error: null })
  h.remove.mockReset().mockResolvedValue({ data: [], error: null })
  h.from.mockClear()

  vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap))
  const ctx = {
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn((...args: unknown[]) => draws.push(args)),
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => ctx as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    cb: BlobCallback,
    type?: string,
    quality?: number,
  ) {
    encodes.push({ type: type ?? '', quality: quality ?? 0, width: this.width, height: this.height })
    const out = encoder(type ?? '', quality ?? 0)
    if (!out) return cb(null)
    const blob = new Blob(['x'], { type: out[0] })
    Object.defineProperty(blob, 'size', { value: out[1] })
    cb(blob)
  })
  URL.createObjectURL = vi.fn(() => 'blob:https://bartrrr.app/local-1')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('preparePhoto (L-02 / P-03)', () => {
  it('scales a landscape photo so the longest side is 1600', async () => {
    const blob = await preparePhoto(photo())
    expect(blob.type).toBe('image/webp')
    expect(encodes[0]).toMatchObject({ type: 'image/webp', quality: 0.82, width: 1600, height: 1200 })
    // whole photo is the source rectangle
    expect(draws[0]).toEqual([bitmap, 0, 0, 4000, 3000, 0, 0, 1600, 1200])
    expect(bitmap.close).toHaveBeenCalled()
  })

  it('scales a portrait photo by its height', async () => {
    bitmap = { width: 3024, height: 4032, close: vi.fn() }
    await preparePhoto(photo())
    expect(encodes[0]).toMatchObject({ width: 1200, height: 1600 })
  })

  it('never upscales a small photo', async () => {
    bitmap = { width: 640, height: 480, close: vi.fn() }
    await preparePhoto(photo())
    expect(encodes[0]).toMatchObject({ width: 640, height: 480 })
  })

  it('keeps at least 1px on a very thin panorama', async () => {
    bitmap = { width: 20000, height: 5, close: vi.fn() }
    await preparePhoto(photo())
    expect(encodes[0]).toMatchObject({ width: 1600, height: 1 })
  })

  it('square option center-crops then scales to 512 (avatars)', async () => {
    await preparePhoto(photo(), { maxEdge: AVATAR_EDGE, square: true })
    expect(encodes[0]).toMatchObject({ width: 512, height: 512 })
    // centered 3000×3000 from a 4000×3000 photo
    expect(draws[0]).toEqual([bitmap, 500, 0, 3000, 3000, 0, 0, 512, 512])
  })

  it('square crop of a portrait takes the vertical middle', async () => {
    bitmap = { width: 3000, height: 4000, close: vi.fn() }
    await preparePhoto(photo(), { maxEdge: 512, square: true })
    expect(draws[0]).toEqual([bitmap, 0, 500, 3000, 3000, 0, 0, 512, 512])
  })

  it('paints white under transparency', async () => {
    await preparePhoto(photo('logo.png', 'image/png'))
    const ctx = HTMLCanvasElement.prototype.getContext.call(document.createElement('canvas'), '2d') as unknown as {
      fillStyle: string
      fillRect: ReturnType<typeof vi.fn>
    }
    expect(ctx.fillStyle).toBe('#ffffff')
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1600, 1200)
  })

  it('falls back to JPEG when the browser returns PNG for WebP (Safari)', async () => {
    encoder = (type) => (type === 'image/webp' ? ['image/png', 900 * 1024] : [type, 400 * 1024])
    const blob = await preparePhoto(photo())
    expect(blob.type).toBe('image/jpeg')
    expect(encodes.map((e) => [e.type, e.quality])).toEqual([
      ['image/webp', 0.82],
      ['image/jpeg', 0.85],
    ])
  })

  it('falls back to JPEG when WebP encoding returns null', async () => {
    encoder = (type) => (type === 'image/webp' ? null : [type, 100])
    expect((await preparePhoto(photo())).type).toBe('image/jpeg')
  })

  it('re-encodes at lower quality when over 2 MB', async () => {
    encoder = (type, q) => (q === 0.7 ? [type, 1.5 * MB] : [type, 2 * MB + 1])
    const blob = await preparePhoto(photo())
    expect(blob.type).toBe('image/jpeg')
    expect(blob.size).toBe(1.5 * MB)
    expect(encodes.at(-1)).toMatchObject({ type: 'image/jpeg', quality: 0.7 })
  })

  it('accepts exactly 2 MB without re-encoding', async () => {
    encoder = (type) => [type, 2 * MB]
    await preparePhoto(photo())
    expect(encodes).toHaveLength(1)
  })

  it('refuses when still over 2 MB at low quality', async () => {
    encoder = (type) => [type, 3 * MB]
    await expect(preparePhoto(photo())).rejects.toThrow('That photo is too detailed to upload. Try another one.')
  })

  it('refuses when nothing can be encoded', async () => {
    encoder = () => null
    await expect(preparePhoto(photo())).rejects.toThrow('We couldn’t prepare that photo. Try another one.')
  })

  it('refuses a non-image file', async () => {
    const err = await preparePhoto(photo('notes.pdf', 'application/pdf')).catch((e) => e)
    expect(err).toBeInstanceOf(PhotoError)
    expect(err.retryable).toBe(false)
    expect(err.message).toMatch(/isn’t a photo/)
    expect(createImageBitmap).not.toHaveBeenCalled()
  })

  it('accepts HEIC by extension when the browser gives no type', async () => {
    await expect(preparePhoto(photo('IMG_0001.HEIC', ''))).resolves.toBeInstanceOf(Blob)
  })

  it('accepts exactly 25 MB, refuses 25 MB + 1 byte', async () => {
    await expect(preparePhoto(photo('a.jpg', 'image/jpeg', 25 * MB))).resolves.toBeInstanceOf(Blob)
    const err = await preparePhoto(photo('a.jpg', 'image/jpeg', 25 * MB + 1)).catch((e) => e)
    expect(err).toBeInstanceOf(PhotoError)
    expect(err.message).toBe('That photo is over 25 MB. Choose a smaller one.')
  })

  it('falls back to <img> decode when createImageBitmap fails (older Safari)', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => Promise.reject(new Error('nope'))))
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = 2000
      naturalHeight = 1000
      set src(_v: string) {
        setTimeout(() => this.onload?.(), 0)
      }
    }
    vi.stubGlobal('Image', FakeImage)
    await preparePhoto(photo())
    await new Promise((r) => setTimeout(r, 0))
    expect(encodes[0]).toMatchObject({ width: 1600, height: 800 })
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:https://bartrrr.app/local-1')
  })

  it('explains when the photo cannot be decoded at all', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => Promise.reject(new Error('nope'))))
    class BrokenImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_v: string) {
        setTimeout(() => this.onerror?.(), 0)
      }
    }
    vi.stubGlobal('Image', BrokenImage)
    const err = await preparePhoto(photo()).catch((e) => e)
    expect(err).toBeInstanceOf(PhotoError)
    expect(err.message).toMatch(/can’t open that photo/)
  })

  it('refuses an empty (0×0) image', async () => {
    bitmap = { width: 0, height: 0, close: vi.fn() }
    await expect(preparePhoto(photo())).rejects.toThrow('That photo looks empty. Try another one.')
  })

  it('explains when the browser has no 2D canvas', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    await expect(preparePhoto(photo())).rejects.toThrow(/can’t prepare photos/)
  })
})

describe('uploads', () => {
  it('uploads a listing photo to <user id>/<uuid>.webp and returns its public URL', async () => {
    const url = await uploadListingPhoto(photo(), 'user-1')
    expect(h.from).toHaveBeenCalledWith(PHOTO_BUCKET)
    const [path, blob, opts] = h.upload.mock.calls[0]
    expect(path).toMatch(/^user-1\/[0-9a-f-]{36}\.webp$/)
    expect((blob as Blob).type).toBe('image/webp')
    expect(opts).toEqual({ contentType: 'image/webp', cacheControl: '31536000', upsert: false })
    expect(url).toBe(`${OWNED}${path}`)
  })

  it('uses .jpg for the JPEG fallback', async () => {
    encoder = (type) => (type === 'image/webp' ? ['image/png', 1] : [type, 1])
    await uploadListingPhoto(photo(), 'user-1')
    expect(h.upload.mock.calls[0][0]).toMatch(/\.jpg$/)
  })

  it('avatar: 512 square at avatar-<uuid>, reporting stages', async () => {
    const stages: string[] = []
    await uploadAvatar(photo(), 'user-1', (s) => stages.push(s))
    expect(stages).toEqual(['preparing', 'uploading'])
    expect(encodes[0]).toMatchObject({ width: 512, height: 512 })
    expect(h.upload.mock.calls[0][0]).toMatch(/^user-1\/avatar-[0-9a-f-]{36}\.webp$/)
  })

  it('a failed upload is a retryable PhotoError', async () => {
    h.upload.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const err = await uploadListingPhoto(photo(), 'user-1').catch((e) => e)
    expect(err).toBeInstanceOf(PhotoError)
    expect(err.retryable).toBe(true)
    expect(err.message).toBe('That photo didn’t upload. Try again in a moment.')
  })

  it('offline upload failure says so', async () => {
    h.upload.mockResolvedValue({ data: null, error: { message: 'fetch' } })
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const err = await uploadListingPhoto(photo(), 'user-1').catch((e) => e)
    expect(err.message).toBe('You’re offline. Reconnect and try that photo again.')
    expect(err.retryable).toBe(true)
  })

  it('demo mode keeps the photo on the device as a blob: URL', async () => {
    h.useClient = false
    await expect(uploadListingPhoto(photo(), 'user-1')).resolves.toBe('blob:https://bartrrr.app/local-1')
    expect(h.upload).not.toHaveBeenCalled()
  })

  it('MAX_PHOTOS is 6', () => expect(MAX_PHOTOS).toBe(6))
})

describe('ownedPhotoPath', () => {
  it('returns the storage path for our bucket URLs (trailing slash in SUPABASE_URL tolerated)', () => {
    expect(ownedPhotoPath(`${OWNED}user-1/abc.webp`)).toBe('user-1/abc.webp')
  })
  it('decodes percent-encoding', () => {
    expect(ownedPhotoPath(`${OWNED}user-1/my%20photo.jpg`)).toBe('user-1/my photo.jpg')
  })
  it.each([
    'https://lh3.googleusercontent.com/a/photo.jpg',
    'https://proj.supabase.co/storage/v1/object/public/other-bucket/user-1/a.webp',
    'https://evil.co/storage/v1/object/public/listing-photos/user-1/a.webp',
    'https://proj.supabase.co.evil.co/storage/v1/object/public/listing-photos/user-1/a.webp',
    'http://proj.supabase.co/storage/v1/object/public/listing-photos/user-1/a.webp',
    'blob:https://bartrrr.app/local-1',
    '',
  ])('null for anything else: %s', (url) => {
    expect(ownedPhotoPath(url)).toBeNull()
  })
})

describe('deleteOwnedPhotos / deleteListingPhotos', () => {
  it('removes only our storage paths and revokes blob: URLs', async () => {
    await deleteOwnedPhotos([
      `${OWNED}user-1/a.webp`,
      'https://lh3.googleusercontent.com/a/photo.jpg',
      'blob:https://bartrrr.app/local-9',
      `${OWNED}user-1/b.jpg`,
    ])
    expect(h.remove).toHaveBeenCalledTimes(1)
    expect(h.remove).toHaveBeenCalledWith(['user-1/a.webp', 'user-1/b.jpg'])
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:https://bartrrr.app/local-9')
  })

  it('makes no storage call when nothing is ours', async () => {
    await deleteListingPhotos(['https://example.com/a.jpg'])
    await deleteListingPhotos([])
    expect(h.remove).not.toHaveBeenCalled()
  })

  it('ignores storage failures', async () => {
    h.remove.mockRejectedValue(new Error('down'))
    await expect(deleteOwnedPhotos([`${OWNED}user-1/a.webp`])).resolves.toBeUndefined()
  })

  it('demo mode only revokes blob: URLs', async () => {
    h.useClient = false
    await deleteOwnedPhotos([`${OWNED}user-1/a.webp`, 'blob:https://bartrrr.app/x'])
    expect(h.remove).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:https://bartrrr.app/x')
  })

  it('deleteListingPhotos is the same function', () => {
    expect(deleteListingPhotos).toBe(deleteOwnedPhotos)
  })
})
