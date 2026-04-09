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
      <div className="p-8 text-center">
        <p className="text-muted">Listing not found or you don't have permission to edit it.</p>
        <Link to="/browse" className="text-clay text-sm mt-2 inline-block">Back to browse</Link>
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
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link
        to={`/listing/${listing.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to listing
      </Link>

      <h1 className="font-display text-2xl font-bold text-ink mb-6">Edit Listing</h1>

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
          <p className="text-sm font-medium text-ink-2 mb-2">Category</p>
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
            <p className="text-sm font-medium text-ink-2 mb-2">Condition</p>
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

        <div className="flex gap-3">
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
