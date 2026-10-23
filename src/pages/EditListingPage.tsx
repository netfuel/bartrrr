import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button, Input, Textarea, Chip } from '@/components/ui'
import { useListingsStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import type { Category, ListingCondition } from '@/types'
import { CATEGORY_LABELS } from '@/types'

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

  if (!listing || !currentUser || listing.userId !== currentUser.id) {
    return (
      <div className="px-5 py-24 text-center">
        <p className="font-display text-[24px] text-ink max-w-md mx-auto">Listing not found or you don't have permission to edit it.</p>
        <Link to="/browse" className="text-label link-underline mt-4 inline-block text-ink">Back to browse</Link>
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
    })
    navigate(`/listing/${listing.id}`)
  }

  const isValid = title.length >= 3 && category && seeking.length >= 3

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <Link
        to={`/listing/${listing.id}`}
        className="group inline-flex min-h-[44px] items-center gap-2 text-label text-muted hover:text-ink transition-colors mb-2"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-300 ease-out-soft group-hover:-translate-x-1" />
        Back to listing
      </Link>

      <h1 className="text-heading-page text-ink mb-8">Edit Listing</h1>

      <div className="space-y-6">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What are you offering?"
        />

        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your item or service..."
        />

        <div>
          <p className="text-label text-ink-2 mb-2.5">Category</p>
          <div className="flex flex-wrap gap-2">
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
            <p className="text-label text-ink-2 mb-2.5">Condition</p>
            <div className="flex flex-wrap gap-2">
              {conditions.map((c) => (
                <Chip
                  key={c}
                  label={c.replace('_', ' ')}
                  selected={condition === c}
                  onToggle={() => setCondition(c)}
                />
              ))}
            </div>
          </div>
        )}

        <Textarea
          label="What are you looking for?"
          value={seeking}
          onChange={(e) => setSeeking(e.target.value)}
          placeholder="Describe what you'd like in return..."
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
