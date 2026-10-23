import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { Button, Textarea, Chip, Modal } from '@/components/ui'
import { useListingsStore, useOffersStore, useNotificationsStore, useMyActiveListings } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'

export interface OfferBuilderProps {
  listingId: string
  toUserId: string
  onClose: () => void
}

export function OfferBuilder({ listingId, toUserId, onClose }: OfferBuilderProps) {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const listing = useListingsStore((s) => s.getListingById(listingId))
  const myListings = useMyActiveListings(currentUser?.id)
  const createOffer = useOffersStore((s) => s.createOffer)
  const addNotification = useNotificationsStore((s) => s.addNotification)

  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [customItem, setCustomItem] = useState('')
  const [message, setMessage] = useState('')

  if (!currentUser || !listing) return null

  const allItems = [
    ...selectedItems,
    ...customItem.split('\n').map((s) => s.trim()).filter(Boolean),
  ]

  const handleSubmit = () => {
    if (allItems.length === 0) return

    const offerId = createOffer({
      listingId,
      fromUserId: currentUser.id,
      toUserId,
      content: message || `I'd like to trade for your ${listing.title}`,
      items: allItems,
    })

    addNotification({
      userId: toUserId,
      type: 'new_offer',
      title: 'New offer received',
      body: `${currentUser.displayName} wants to trade for your ${listing.title}`,
      data: { offerId },
    })

    onClose()
    navigate(`/offers/${offerId}`)
  }

  const toggleListing = (title: string) => {
    setSelectedItems((prev) =>
      prev.includes(title) ? prev.filter((i) => i !== title) : [...prev, title],
    )
  }

  return (
    <Modal onClose={onClose} labelledBy="offer-builder-title">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-sand-light hover:text-ink transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 id="offer-builder-title" className="font-display text-[28px] font-normal tracking-[-0.015em] text-ink mb-1">
          Make an offer
        </h2>
        <p className="text-[15px] text-muted mb-6 pb-5 border-b border-ink">
          for <span className="font-display italic text-[17px] text-ink">{listing.title}</span>
        </p>

        {/* User's listings as quick picks */}
        {myListings.length > 0 && (
          <div className="mb-4">
            <p className="text-label text-ink-2 mb-2.5">
              Offer from your listings:
            </p>
            <div className="flex flex-wrap gap-2">
              {myListings.map((l) => (
                <Chip
                  key={l.id}
                  label={l.title}
                  selected={selectedItems.includes(l.title)}
                  onToggle={() => toggleListing(l.title)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Custom items */}
        <Textarea
          label="Or describe what you're offering"
          placeholder="e.g. 2 hours of gardening help, homemade bread, guitar lessons..."
          value={customItem}
          onChange={(e) => setCustomItem(e.target.value)}
          rows={3}
        />

        {/* Message */}
        <div className="mt-4">
          <Textarea
            label="Add a message (optional)"
            placeholder="Tell them why this is a fair trade..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
          />
        </div>

        {/* Summary */}
        {allItems.length > 0 && (
          <div className="animate-fade-in mt-5 border-l-2 border-forest bg-forest-light py-2.5 pl-3.5 pr-3">
            <p className="text-label text-forest mb-1">
              Your offer
            </p>
            <p className="font-display text-[17px] leading-snug text-ink">{allItems.join(', ')}</p>
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          className="w-full mt-6"
          disabled={allItems.length === 0}
          onClick={handleSubmit}
        >
          Send offer
        </Button>
    </Modal>
  )
}
