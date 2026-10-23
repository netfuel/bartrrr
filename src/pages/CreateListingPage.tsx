import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Camera, Check, Plus, X } from 'lucide-react'
import { cn, usePageTitle } from '@/lib/utils'
import { Button, Input, Textarea, Chip } from '@/components/ui'
import { CATEGORY_LABELS, CONDITION_LABELS, type Category, type ListingCondition } from '@/types'
import { useListingsStore, useUsersStore, useNotificationsStore, showToast } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'

const categories: Category[] = ['goods', 'services', 'skills', 'outdoor']
const conditions = (Object.keys(CONDITION_LABELS) as ListingCondition[]).map((value) => ({
  value,
  label: CONDITION_LABELS[value],
}))

const steps = ['Photos', 'Details', 'In return', 'Review']

export default function CreateListingPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const addListing = useListingsStore((s) => s.addListing)
  const users = useUsersStore((s) => s.users)
  const addNotification = useNotificationsStore((s) => s.addNotification)

  const [step, setStep] = useState(0)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [condition, setCondition] = useState<ListingCondition | null>(null)
  const [seeking, setSeeking] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [imageError, setImageError] = useState('')
  usePageTitle('Post a listing')

  if (!currentUser) return null

  // Why "Next" is disabled, in plain words. Empty string = ready.
  const blocker = (): string => {
    if (step === 1) {
      if (title.trim().length < 3) return 'Add a title (at least 3 characters) to continue.'
      if (category === null) return 'Pick a category to continue.'
    }
    if (step === 2 && seeking.trim().length < 3) {
      return 'Tell neighbors what you’d like in return to continue.'
    }
    return ''
  }
  const canAdvance = () => blocker() === ''

  const addImage = () => {
    const url = imageUrl.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) {
      setImageError('That doesn’t look like a web link. It should start with https://')
      return
    }
    if (images.includes(url)) {
      setImageError('You’ve already added that photo.')
      return
    }
    if (images.length >= 6) {
      setImageError('You can add up to 6 photos.')
      return
    }
    setImages((prev) => [...prev, url])
    setImageUrl('')
    setImageError('')
  }

  const handleSubmit = () => {
    const newId = addListing({
      title,
      description,
      category: category!,
      condition: condition || undefined,
      seeking,
      images,
      userId: currentUser.id,
      location: {
        lat: 35.1495,
        lng: -90.049,
        neighborhood: currentUser.neighborhood,
      },
    })

    // Notify users whose interests match the new listing's category
    const listingCategory = category!
    users.forEach((u) => {
      if (u.id !== currentUser.id && u.interests?.includes(listingCategory)) {
        addNotification({
          userId: u.id,
          type: 'match',
          title: 'New listing you might like',
          body: `A neighbor just posted "${title}". It matches what you're looking for.`,
          data: { listingId: newId },
        })
      }
    })

    showToast('Your listing is live.', 'success')
    navigate(`/listing/${newId}`, { state: { justCreated: true } })
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/browse" aria-label="Cancel and go back to browse" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full hover:bg-sand-light transition-colors">
          <ArrowLeft className="h-5 w-5 text-ink" />
        </Link>
        <h1 className="text-heading-page text-ink">Post a listing</h1>
      </div>

      {/* Progress */}
      <p className="sr-only" aria-live="polite">
        Step {step + 1} of {steps.length}: {steps[step]}
      </p>
      <ol className="grid grid-cols-4 gap-2 mb-10">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-col gap-2" aria-current={i === step ? 'step' : undefined}>
            <div className="h-px bg-ink/20">
              <div className={cn('h-px transition-[width] duration-700 ease-out-soft', i <= step ? 'w-full bg-ink' : 'w-0')} />
            </div>
            <span className={cn('flex items-center gap-1.5 text-label', i === step ? 'text-ink' : i < step ? 'text-ink-2' : 'text-muted')}>
              {i < step ? <Check className="h-3 w-3 text-teal-dark" /> : <span className="tabular-nums">{String(i + 1).padStart(2, '0')}</span>}
              <span className="hidden sm:inline">{s}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="space-y-6">
        {step === 0 && (
          <>
            <h2 className="text-heading-section text-ink">Add some photos</h2>
            <p className="text-[15px] text-ink-2 -mt-3">Clear photos help neighbors decide faster. Add up to 6 by pasting image links. Photos are optional, so you can skip this step.</p>

            {/* Image URL input */}
            <div className="flex items-start gap-2">
              <div className="flex-1">
              <Input
                aria-label="Photo link"
                placeholder="https://…"
                value={imageUrl}
                onChange={(e) => { setImageUrl(e.target.value); setImageError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addImage() } }}
                error={imageError || undefined}
              />
              </div>
              <Button variant="outline" aria-label="Add photo" className="h-[50px] w-[50px] shrink-0 px-0" onClick={addImage} disabled={!imageUrl.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Image previews */}
            <div className="grid grid-cols-3 gap-3">
              {images.map((url, i) => (
                <div key={url} className="animate-scale-in relative aspect-square rounded-none overflow-hidden border border-ink bg-sand-light">
                  <img src={url} alt={`Photo ${i + 1}`} className="photo-warm w-full h-full object-cover" />
                  <button
                    type="button"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                    className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-cream backdrop-blur-sm hover:bg-ink"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {images.length === 0 && (
                <div className="col-span-3 aspect-[3/1] rounded-none border border-dashed border-ink/40 bg-paper flex flex-col items-center justify-center gap-2 text-muted">
                  <Camera className="h-6 w-6 text-clay" />
                  <span className="text-label">No photos yet</span>
                </div>
              )}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="text-heading-section text-ink">Describe your listing</h2>
            <Input label="Title" placeholder="Like: Vintage lamp, or 2 hours of gardening help" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea label="Description (optional)" placeholder="Size, condition, how long it takes: whatever a neighbor would want to know" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            <div>
              <p id="category-label" className="text-label text-ink-2 mb-2.5">Category</p>
              <div role="group" aria-labelledby="category-label" className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Chip key={cat} label={CATEGORY_LABELS[cat]} selected={category === cat} onToggle={() => setCategory(cat)} />
                ))}
              </div>
            </div>
            {(category === 'goods' || category === 'outdoor') && (
              <div>
                <p id="condition-label" className="text-label text-ink-2 mb-2.5">Condition (optional)</p>
                <div role="group" aria-labelledby="condition-label" className="flex flex-wrap gap-2">
                  {conditions.map((c) => (
                    <Chip key={c.value} label={c.label} selected={condition === c.value} onToggle={() => setCondition(c.value)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-heading-section text-ink">What would you like in return?</h2>
            <p className="text-[15px] text-ink-2 -mt-3">Be specific, but leave room for ideas. Neighbors use this to shape their offers.</p>
            <Textarea label="I'd trade this for…" placeholder="Like: gardening help, kitchen appliances, or good books" value={seeking} onChange={(e) => setSeeking(e.target.value)} rows={4} />
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-heading-section text-ink">Review your listing</h2>
            <div className="border border-ink bg-paper p-5 space-y-4">
              {images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {images.map((url) => (
                    <img key={url} src={url} alt="" className="photo-warm w-20 h-20 rounded-none border border-ink object-cover shrink-0" />
                  ))}
                </div>
              )}
              <div>
                <p className="text-label text-muted">Title</p>
                <p className="font-display text-[22px] leading-tight text-ink mt-1">{title}</p>
              </div>
              {description && (
                <div>
                  <p className="text-label text-muted">Description</p>
                  <p className="text-[15px] text-ink-2 mt-1">{description}</p>
                </div>
              )}
              <div>
                <p className="text-label text-muted">Category</p>
                <p className="text-[15px] text-ink mt-1">{category ? CATEGORY_LABELS[category] : ''}</p>
              </div>
              {condition && (
                <div>
                  <p className="text-label text-muted">Condition</p>
                  <p className="text-[15px] text-ink mt-1">{CONDITION_LABELS[condition]}</p>
                </div>
              )}
              <div className="border-l-2 border-clay bg-clay-light/60 py-2.5 pl-3.5 pr-3">
                <p className="text-label text-clay-dark mb-1">Looking for</p>
                <p className="text-[15px] text-ink-2">{seeking}</p>
              </div>
            </div>
            <p className="text-small text-muted">
              Your listing stays up for 30 days. Neighbors see your neighborhood, never your address.
            </p>
          </>
        )}
      </div>

      <div className="flex gap-3 mt-10 border-t border-ink pt-6">
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} className="flex-1">Back</Button>
        )}
        {step < steps.length - 1 ? (
          <Button variant="primary" disabled={!canAdvance()} onClick={() => setStep((s) => s + 1)} className="flex-1">
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="confirm" onClick={handleSubmit} className="flex-1">
            Post listing <Check className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="mt-2 text-small text-muted text-right min-h-[20px]" aria-live="polite">{blocker()}</p>
    </div>
  )
}
