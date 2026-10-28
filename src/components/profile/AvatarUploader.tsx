import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Camera, Loader2 } from 'lucide-react'
import { Avatar, Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import { PhotoError, deleteOwnedPhotos, uploadAvatar } from '@/lib/photos'
import { useUsersStore, showToast } from '@/stores'
import type { UserProfile } from '@/types'

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; label: string }
  | { kind: 'error'; message: string; retryFile?: File }

/**
 * Upload, replace or remove a profile photo. Saves on its own, apart from
 * the rest of the settings form: a new photo shows up as soon as it lands.
 * The old file is deleted only after the new one is saved.
 */
export function AvatarUploader({ user }: { user: UserProfile }) {
  const updateUser = useUsersStore((s) => s.updateUser)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = status.kind === 'busy'
  const current = user.avatarUrl || undefined

  // Free the local preview when it's replaced or the page goes away
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const choose = () => inputRef.current?.click()

  const upload = async (file: File) => {
    const previous = current
    setPreview(URL.createObjectURL(file))
    setStatus({ kind: 'busy', label: 'Preparing your photo…' })
    let url: string
    try {
      url = await uploadAvatar(file, user.id, (stage) => {
        if (stage === 'uploading') setStatus({ kind: 'busy', label: 'Uploading…' })
      })
    } catch (err) {
      const known = err instanceof PhotoError
      setPreview(null)
      setStatus({
        kind: 'error',
        message: known ? err.message : 'That photo didn’t upload. Try again in a moment.',
        retryFile: !known || err.retryable ? file : undefined,
      })
      return
    }

    setStatus({ kind: 'busy', label: 'Saving…' })
    updateUser(user.id, { avatarUrl: url }, {
      onSaved: () => {
        if (previous && previous !== url) deleteOwnedPhotos([previous])
        setPreview(null)
        setStatus({ kind: 'idle' })
        showToast('Profile photo saved.', 'success')
      },
      onFailed: () => {
        // The store already told them why: tidy up the file nobody uses
        deleteOwnedPhotos([url])
        setPreview(null)
        setStatus({ kind: 'error', message: 'Your new photo didn’t save. Try again in a moment.', retryFile: file })
      },
    })
  }

  const remove = () => {
    const previous = current
    if (!previous) return
    setStatus({ kind: 'busy', label: 'Removing…' })
    // An empty value clears the photo; neighbors see your initials instead
    updateUser(user.id, { avatarUrl: '' }, {
      onSaved: () => {
        deleteOwnedPhotos([previous])
        setStatus({ kind: 'idle' })
        showToast('Profile photo removed.', 'success')
      },
      onFailed: () => setStatus({ kind: 'error', message: 'Your photo is still there. Try removing it again in a moment.' }),
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label text-ink-2">Profile photo</span>
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={choose}
          disabled={busy}
          aria-label={current ? 'Change profile photo' : 'Add a profile photo'}
          className="group relative h-24 w-24 shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay disabled:cursor-wait"
        >
          {preview ? (
            <img src={preview} alt="" className="h-24 w-24 rounded-full object-cover opacity-50 ring-1 ring-ink/10" />
          ) : (
            <Avatar src={current} name={user.displayName} userId={user.id} size="xl" className="!h-24 !w-24 text-2xl" />
          )}
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-0 flex items-center justify-center rounded-full transition-colors',
              busy ? 'text-ink' : 'text-transparent group-hover:bg-ink/40 group-hover:text-cream',
            )}
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
          </span>
        </button>

        <div className="flex flex-col items-start gap-2">
          <Button variant="outline" size="sm" onClick={choose} disabled={busy}>
            {current ? 'Change photo' : 'Add a photo'}
          </Button>
          {current && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="text-label min-h-[32px] text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
            >
              Remove photo
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) upload(file)
        }}
      />

      <div aria-live="polite" className="text-small min-h-[20px]">
        {status.kind === 'busy' && <span className="text-ink-2">{status.label}</span>}
        {status.kind === 'error' && (
          <span className="flex items-start gap-2 text-ink">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-clay" aria-hidden="true" />
            <span>
              {status.message}{' '}
              {status.retryFile && (
                <button
                  type="button"
                  onClick={() => status.retryFile && upload(status.retryFile)}
                  className="text-label text-clay underline underline-offset-4 hover:text-ink"
                >
                  Try again
                </button>
              )}
            </span>
          </span>
        )}
        {status.kind === 'idle' && (
          <span className="text-muted">
            Neighbors see it on your profile, listings and offers. We crop it to a square and remove hidden details, like where it was taken.
          </span>
        )}
      </div>
    </div>
  )
}
