import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Camera, Check, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, Input, Textarea, Chip } from '@/components/ui'
import { CATEGORY_LABELS, type Category, type ListingCondition } from '@/types'
import { useListingsStore, useUsersStore, useNotificationsStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'

const categories: Category[] = ['goods', 'services', 'skills', 'outdoor']
const conditions: { value: ListingCondition; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
]

const steps = ['Photos', 'Details', 'Looking For', 'Review']

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

  if (!currentUser) return null

  const canAdvance = () => {
    if (step === 0) return true
    if (step === 1) return title.length >= 3 && category !== null
    if (step === 2) return seeking.length >= 3
    return true
  }

  const addImage = () => {
    if (imageUrl.trim()) {
      setImages((prev) => [...prev, imageUrl.trim()])
      setImageUrl('')
    }
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
          title: 'Perfect Match!',
          body: `A new listing matches your interests: "${title}"`,
          data: { listingId: newId },
        })
      }
    })

    navigate(`/listing/${newId}`, { state: { justCreated: true } })
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/browse" className="p-2 rounded-full hover:bg-sand-light transition-colors">
          <ArrowLeft className="h-5 w-5 text-muted" />
        </Link>
        <h1 className="font-display text-xl font-bold text-ink">Post a listing</h1>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0', i < step ? 'bg-teal text-white' : i === step ? 'bg-clay text-white' : 'bg-sand-light text-muted')}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            {i < steps.length - 1 && <div className={cn('h-0.5 flex-1', i < step ? 'bg-teal' : 'bg-sand-light')} />}
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {step === 0 && (
          <>
            <h2 className="font-display text-lg font-semibold">Add some photos</h2>
            <p className="text-sm text-muted">Listings with photos get 3x more offers. Paste image URLs below.</p>

            {/* Image URL input */}
            <div className="flex gap-2">
              <Input
                placeholder="Paste image URL..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" onClick={addImage} disabled={!imageUrl.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Image previews */}
            <div className="grid grid-cols-3 gap-3">
              {images.map((url, i) => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-sand-light">
                  <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-ink/60 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {images.length === 0 && (
                <div className="aspect-square rounded-lg border-2 border-dashed border-sand flex flex-col items-center justify-center gap-1 text-muted">
                  <Camera className="h-6 w-6" />
                  <span className="text-xs">No photos yet</span>
                </div>
              )}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="font-display text-lg font-semibold">Describe your listing</h2>
            <Input label="Title" placeholder="e.g. Vintage Lamp, 2 Hours of Gardening Help" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea label="Description" placeholder="Tell your neighbors about it..." value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            <div>
              <p className="text-sm font-medium text-ink-2 mb-2">Category</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Chip key={cat} label={CATEGORY_LABELS[cat]} selected={category === cat} onToggle={() => setCategory(cat)} />
                ))}
              </div>
            </div>
            {(category === 'goods' || category === 'outdoor') && (
              <div>
                <p className="text-sm font-medium text-ink-2 mb-2">Condition</p>
                <div className="flex flex-wrap gap-2">
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
            <h2 className="font-display text-lg font-semibold">What are you looking for?</h2>
            <p className="text-sm text-muted">Help neighbors know what you'd trade for.</p>
            <Textarea label="I'd trade this for..." placeholder="e.g. gardening help, kitchen appliances, interesting books" value={seeking} onChange={(e) => setSeeking(e.target.value)} rows={4} />
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-display text-lg font-semibold">Review your listing</h2>
            <div className="bg-white rounded-lg p-4 border border-sand-light space-y-3">
              {images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {images.map((url) => (
                    <img key={url} src={url} alt="" className="w-20 h-20 rounded-md object-cover shrink-0" />
                  ))}
                </div>
              )}
              <div>
                <p className="text-xs text-muted">Title</p>
                <p className="text-sm font-medium text-ink">{title || 'Untitled'}</p>
              </div>
              {description && (
                <div>
                  <p className="text-xs text-muted">Description</p>
                  <p className="text-sm text-ink-2">{description}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted">Category</p>
                <p className="text-sm text-ink">{category ? CATEGORY_LABELS[category] : '—'}</p>
              </div>
              <div className="bg-forest-light rounded-md p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-forest mb-0.5">Looking for</p>
                <p className="text-sm text-forest-dark">{seeking}</p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3 mt-8">
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
    </div>
  )
}
