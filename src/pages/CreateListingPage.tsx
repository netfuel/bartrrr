import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { cn, usePageTitle } from '@/lib/utils'
import { Button, Input, Textarea, Chip } from '@/components/ui'
import { CATEGORY_LABELS, CONDITION_LABELS, type Category, type ListingCondition } from '@/types'
import { useListingsStore, useUsersStore, useNotificationsStore, showToast } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import { neighborhoodCenter } from '@/data/neighborhoods'
import { PhotoPicker } from '@/components/listings/PhotoPicker'
import { deleteListingPhotos } from '@/lib/photos'

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
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  usePageTitle('Post a listing')

  // Leaving without posting: clean up photos uploaded for this draft
  const imagesRef = useRef(images)
  const posted = useRef(false)
  useEffect(() => { imagesRef.current = images }, [images])
  useEffect(() => () => { if (!posted.current) deleteListingPhotos(imagesRef.current) }, [])

  if (!currentUser) return null

  // Why "Next" is disabled, in plain words. Empty string = ready.
  const blocker = (): string => {
    if (step === 0 && uploading) return 'Wait for your photos to finish uploading.'
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

  const handleSubmit = () => {
    posted.current = true
    const newId = addListing({
      title,
      description,
      category: category!,
      condition: condition || undefined,
      seeking,
      images,
      userId: currentUser.id,
      // Neighborhood center, never the user's address (PRD: neighborhood-level only)
      location: {
        ...neighborhoodCenter(currentUser.neighborhood),
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
            <p className="text-[15px] text-ink-2 -mt-3">Clear photos help neighbors decide faster. Add up to 6 from your phone or computer. Photos are optional, so you can skip this step.</p>
            <PhotoPicker value={images} onChange={setImages} userId={currentUser.id} onBusyChange={setUploading} />
            <p className="text-[13px] text-muted">We shrink photos and remove hidden details like location before they upload.</p>
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
