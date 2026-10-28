import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button, Input, Textarea, Chip } from '@/components/ui'
import { useListingsStore, showToast } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import type { Category, ListingCondition } from '@/types'
import { CATEGORY_LABELS, CONDITION_LABELS } from '@/types'
import { usePageTitle } from '@/lib/utils'
import { PhotoPicker } from '@/components/listings/PhotoPicker'
import { deleteListingPhotos } from '@/lib/photos'

const categories: Category[] = ['goods', 'services', 'skills', 'outdoor']
const conditions: ListingCondition[] = ['new', 'like_new', 'good', 'fair']

export default function EditListingPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const listing = useListingsStore((s) => s.getListingById(id || ''))
  const updateListing = useListingsStore((s) => s.updateListing)

  const [title, setTitle] = useState(listing?.title || '')
  const [description, setDescription] = useState(listing?.description || '')
  const [category, setCategory] = useState<Category | null>(listing?.category || null)
  const [condition, setCondition] = useState<ListingCondition | null>(listing?.condition || null)
  const [seeking, setSeeking] = useState(listing?.seeking || '')
  const [images, setImages] = useState<string[]>(listing?.images || [])
  const [uploading, setUploading] = useState(false)
  usePageTitle('Edit listing')

  // Photos added here but never saved get cleaned up when leaving
  const saved = listing?.images
  const imagesRef = useRef(images)
  const didSave = useRef(false)
  useEffect(() => { imagesRef.current = images }, [images])
  useEffect(
    () => () => {
      if (!didSave.current) deleteListingPhotos(imagesRef.current.filter((u) => !saved?.includes(u)))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  if (!listing || !currentUser || listing.userId !== currentUser.id) {
    return (
      <div className="px-5 py-24 text-center">
        <p className="font-display text-[24px] text-ink max-w-md mx-auto">We couldn't open this listing for editing.</p>
        <p className="text-base text-ink-2 mt-2 max-w-md mx-auto">It may have been removed, or it belongs to another neighbor.</p>
        <Link to="/dashboard" className="text-label link-underline mt-4 inline-block text-ink">Go to your listings</Link>
      </div>
    )
  }

  const handleSave = () => {
    updateListing(listing.id, {
      title,
      description,
      category: category!,
      condition: condition || undefined,
      seeking,
      images,
    })
    didSave.current = true
    showToast('Changes saved.', 'success')
    navigate(`/listing/${listing.id}`)
  }

  const titleError = title.trim().length < 3 ? 'Add a title (at least 3 characters).' : ''
  const seekingError = seeking.trim().length < 3 ? 'Tell neighbors what you’d like in return.' : ''
  const isValid = !titleError && category && !seekingError && !uploading

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link
        to={`/listing/${listing.id}`}
        className="group inline-flex min-h-[44px] items-center gap-2 text-label text-muted hover:text-ink transition-colors mb-2"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-300 ease-out-soft group-hover:-translate-x-1" />
        Back to listing
      </Link>

      <h1 className="text-heading-page text-ink mb-8">Edit listing</h1>

      <div className="space-y-6">
        <div>
          <p className="text-label text-ink-2 mb-2.5">Photos</p>
          <PhotoPicker
            value={images}
            onChange={setImages}
            userId={currentUser.id}
            saved={listing.images}
            onBusyChange={setUploading}
          />
        </div>

        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What are you offering?"
          maxLength={80}
          error={titleError || undefined}
        />

        <Textarea
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Size, condition, how long it takes: whatever a neighbor would want to know"
        />

        <div>
          <p id="edit-category-label" className="text-label text-ink-2 mb-2.5">Category</p>
          <div role="group" aria-labelledby="edit-category-label" className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Chip
                key={cat}
                label={CATEGORY_LABELS[cat]}
                selected={category === cat}
                onToggle={() => setCategory(cat)}
              />
            ))}
          </div>
        </div>

        {(category === 'goods' || category === 'outdoor') && (
          <div>
            <p id="edit-condition-label" className="text-label text-ink-2 mb-2.5">Condition (optional)</p>
            <div role="group" aria-labelledby="edit-condition-label" className="flex flex-wrap gap-2">
              {conditions.map((c) => (
                <Chip
                  key={c}
                  label={CONDITION_LABELS[c]}
                  selected={condition === c}
                  onToggle={() => setCondition(c)}
                />
              ))}
            </div>
          </div>
        )}

        <Textarea
          label="What would you like in return?"
          value={seeking}
          onChange={(e) => setSeeking(e.target.value)}
          placeholder="Like: gardening help, kitchen appliances, or good books"
          error={seekingError || undefined}
        />

        <div className="flex gap-3 border-t border-ink pt-6">
          <Button variant="ghost" onClick={() => navigate(`/listing/${listing.id}`)} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!isValid} className="flex-1">
            Save changes
          </Button>
        </div>
      </div>
    </div>
  )
}
