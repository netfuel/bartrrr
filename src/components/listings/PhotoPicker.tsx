import { useEffect, useLayoutEffect, useRef, useState, type DragEvent } from 'react'
import { AlertCircle, ImagePlus, Loader2, RotateCcw, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAX_PHOTOS, PhotoError, deleteListingPhotos, uploadListingPhoto } from '@/lib/photos'

interface Pending {
  id: string
  file: File
  preview: string
  status: 'uploading' | 'done' | 'error'
  url?: string
  error?: string
  retryable?: boolean
}

export interface PhotoPickerProps {
  /** Uploaded photo URLs, in order. The first one is the cover. */
  value: string[]
  onChange: (urls: string[]) => void
  userId: string
  /** Photos already saved on the listing: removing one only takes effect on save. */
  saved?: string[]
  /** True while any photo is still uploading. */
  onBusyChange?: (busy: boolean) => void
}

/**
 * Pick, upload, reorder and remove listing photos. Uploads start as soon as
 * photos are chosen and run in parallel, but land in the order chosen.
 * Failed uploads can be retried in place.
 */
export function PhotoPicker({ value, onChange, userId, saved = [], onBusyChange }: PhotoPickerProps) {
  const [pending, setPending] = useState<Pending[]>([])
  const [notice, setNotice] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Uploads finish out of order and after re-renders: refs hold the latest lists
  const valueRef = useRef(value)
  useLayoutEffect(() => { valueRef.current = value }, [value])
  const pendingRef = useRef<Pending[]>([])

  const busy = pending.some((p) => p.status === 'uploading')
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange])

  // Free local previews when the picker goes away
  useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), [])

  /** Save the pending list, moving finished uploads into value in chosen order. */
  const commit = (list: Pending[]) => {
    const keep: Pending[] = []
    const landed: string[] = []
    let blocked = false
    for (const p of list) {
      if (p.status === 'uploading') blocked = true
      if (p.status === 'done' && !blocked && p.url) {
        URL.revokeObjectURL(p.preview)
        landed.push(p.url)
      } else {
        keep.push(p)
      }
    }
    pendingRef.current = keep
    setPending(keep)
    if (landed.length) {
      valueRef.current = [...valueRef.current, ...landed]
      onChange(valueRef.current)
    }
    if (!keep.some((p) => p.status === 'uploading')) {
      const failed = keep.filter((p) => p.status === 'error').length
      setNotice(failed ? `${failed} ${failed === 1 ? 'photo' : 'photos'} couldn’t be added.` : '')
    }
  }

  const update = (id: string, patch: Partial<Pending>) =>
    commit(pendingRef.current.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const upload = async (item: Pending) => {
    try {
      const url = await uploadListingPhoto(item.file, userId)
      update(item.id, { status: 'done', url })
    } catch (err) {
      const known = err instanceof PhotoError
      update(item.id, {
        status: 'error',
        error: known ? err.message : 'That photo didn’t upload. Try again in a moment.',
        retryable: known ? err.retryable : true,
      })
    }
  }

  const addFiles = (files: FileList | File[]) => {
    const room = MAX_PHOTOS - valueRef.current.length - pendingRef.current.length
    const chosen = Array.from(files)
    if (chosen.length === 0) return
    if (room <= 0) {
      setNotice(`You can add up to ${MAX_PHOTOS} photos. Remove one to add another.`)
      return
    }
    const accepted = chosen.slice(0, room)
    setNotice(
      chosen.length > room
        ? `Only the first ${room} ${room === 1 ? 'photo was' : 'photos were'} added. Listings hold up to ${MAX_PHOTOS}.`
        : `Uploading ${accepted.length} ${accepted.length === 1 ? 'photo' : 'photos'}…`,
    )
    const items: Pending[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      status: 'uploading',
    }))
    commit([...pendingRef.current, ...items])
    items.forEach(upload)
  }

  const retry = (item: Pending) => {
    setNotice('Uploading 1 photo…')
    update(item.id, { status: 'uploading', error: undefined })
    upload(item)
  }

  const dismiss = (item: Pending) => {
    URL.revokeObjectURL(item.preview)
    commit(pendingRef.current.filter((p) => p.id !== item.id))
  }

  const remove = (url: string, index: number) => {
    onChange(value.filter((u) => u !== url))
    // A photo uploaded in this session isn't used anywhere else yet
    if (!saved.includes(url)) deleteListingPhotos([url])
    setNotice(`Photo ${index + 1} removed.`)
  }

  const makeCover = (url: string) => {
    onChange([url, ...value.filter((u) => u !== url)])
    setNotice('Cover photo changed.')
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const full = value.length + pending.length >= MAX_PHOTOS

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }}
      onDrop={onDrop}
      className={cn('space-y-3 transition-colors', dragging && 'outline outline-1 outline-offset-4 outline-clay')}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <ul className="grid grid-cols-3 gap-3" aria-label="Listing photos">
        {value.map((url, i) => (
          <li key={url} className="animate-scale-in group relative aspect-square overflow-hidden border border-ink bg-sand-light">
            <img src={url} alt={`Photo ${i + 1}${i === 0 ? ', cover' : ''}`} className="photo-warm h-full w-full object-cover" />
            {i === 0 ? (
              <span className="text-label absolute bottom-0 left-0 bg-ink px-2 py-1 text-[10px] text-cream">Cover</span>
            ) : (
              <button
                type="button"
                onClick={() => makeCover(url)}
                className="text-label absolute bottom-0 left-0 min-h-[28px] bg-cream/90 px-2 text-[10px] text-ink hover:bg-ink hover:text-cream transition-colors"
              >
                Make cover
              </button>
            )}
            <button
              type="button"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => remove(url, i)}
              className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-ink/70 text-cream backdrop-blur-sm hover:bg-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}

        {pending.map((p) => (
          <li key={p.id} className="relative aspect-square overflow-hidden border border-ink bg-sand-light">
            {(p.status !== 'error' || p.retryable) && (
              <img src={p.preview} alt="" className={cn('h-full w-full object-cover', p.status === 'error' ? 'opacity-25' : 'opacity-50')} />
            )}
            {p.status !== 'error' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-ink">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                <span className="text-label text-[10px]">Uploading</span>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center">
                <AlertCircle className="h-5 w-5 text-clay" aria-hidden="true" />
                <span className="text-[12px] leading-tight text-ink">{p.error}</span>
                <div className="flex gap-1.5">
                  {p.retryable && <button type="button" onClick={() => retry(p)} className="text-label inline-flex min-h-[28px] items-center gap-1 rounded-full border border-ink bg-cream px-2.5 text-[10px] hover:bg-ink hover:text-cream">
                    <RotateCcw className="h-3 w-3" aria-hidden="true" /> Retry
                  </button>}
                  <button type="button" onClick={() => dismiss(p)} aria-label="Remove this photo" className="flex h-7 w-7 items-center justify-center rounded-full border border-ink bg-cream hover:bg-ink hover:text-cream">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}

        {!full && (
          <li className={cn(value.length + pending.length === 0 && 'col-span-3')}>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                'flex w-full flex-col items-center justify-center gap-2 border border-dashed border-ink/40 bg-paper text-ink transition-colors hover:border-ink hover:bg-sand-light',
                value.length + pending.length === 0 ? 'aspect-[3/1]' : 'aspect-square',
              )}
            >
              <ImagePlus className="h-6 w-6 text-clay" aria-hidden="true" />
              <span className="text-label">{value.length + pending.length === 0 ? 'Add photos' : 'Add more'}</span>
              {value.length + pending.length === 0 && (
                <span className="hidden text-[13px] text-muted sm:block">or drag them here</span>
              )}
            </button>
          </li>
        )}
      </ul>

      <p className="text-[13px] text-muted" aria-live="polite">
        {notice || `${value.length} of ${MAX_PHOTOS} photos. The first one is the cover.`}
      </p>
    </div>
  )
}
