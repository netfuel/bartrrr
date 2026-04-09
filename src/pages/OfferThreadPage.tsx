import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { OfferThread, OfferTimeline, DeclineModal, CounterOfferForm, MessageComposer } from '@/components/bartrrr'
import { useOffersStore, useUsersStore, useListingsStore, useAgreementsStore, useNotificationsStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import type { OfferDeclineReason } from '@/types'

export default function OfferThreadPage() {
  const { id } = useParams()
  const { currentUser } = useAuth()
  const offer = useOffersStore((s) => s.getOfferById(id || ''))
  const acceptOffer = useOffersStore((s) => s.acceptOffer)
  const declineOffer = useOffersStore((s) => s.declineOffer)
  const counterOffer = useOffersStore((s) => s.counterOffer)
  const addMessage = useOffersStore((s) => s.addMessage)
  const getUserById = useUsersStore((s) => s.getUserById)
  const getListingById = useListingsStore((s) => s.getListingById)
  const updateListing = useListingsStore((s) => s.updateListing)
  const createAgreement = useAgreementsStore((s) => s.createAgreement)
  const getAgreementByOfferId = useAgreementsStore((s) => s.getAgreementByOfferId)
  const addNotification = useNotificationsStore((s) => s.addNotification)

  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [showCounterForm, setShowCounterForm] = useState(false)

  if (!offer || !currentUser) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted">Offer not found.</p>
        <Link to="/offers" className="text-clay text-sm mt-2 inline-block">Back to offers</Link>
      </div>
    )
  }

  const fromUser = getUserById(offer.fromUserId)
  const toUser = getUserById(offer.toUserId)
  const listing = getListingById(offer.listingId)
  if (!fromUser || !toUser) return null

  const otherUserId = currentUser.id === offer.fromUserId ? offer.toUserId : offer.fromUserId
  const lastMessage = offer.messages[offer.messages.length - 1]
  const isWaiting = lastMessage?.fromUserId === currentUser.id && (offer.status === 'pending' || offer.status === 'countered')
  const canCounter = offer.round < offer.maxRounds
  const isActive = offer.status === 'pending' || offer.status === 'countered'

  const handleAccept = () => {
    acceptOffer(offer.id, currentUser.id)

    // Extract items from latest offer/counter message
    const latestOfferMsg = [...offer.messages].reverse().find((m) => m.type === 'offer' || m.type === 'counter')
    const agreementId = createAgreement({
      offerId: offer.id,
      partyA: { userId: offer.fromUserId, item: latestOfferMsg?.items?.join(', ') || 'Offered items' },
      partyB: { userId: offer.toUserId, item: listing?.title || 'Listed item' },
    })

    if (listing) updateListing(listing.id, { status: 'pending' })

    addNotification({
      userId: otherUserId,
      type: 'offer_accepted',
      title: 'Offer accepted!',
      body: `${currentUser.displayName} accepted your offer.`,
      data: { offerId: offer.id, agreementId },
    })
  }

  const handleDecline = (reason: OfferDeclineReason, note?: string) => {
    declineOffer(offer.id, currentUser.id, reason, note)
    setShowDeclineModal(false)
    addNotification({
      userId: otherUserId,
      type: 'offer_declined',
      title: 'Offer declined',
      body: `${currentUser.displayName} declined the offer.`,
      data: { offerId: offer.id },
    })
  }

  const handleCounter = (content: string, items: string[]) => {
    counterOffer(offer.id, currentUser.id, content, items)
    setShowCounterForm(false)
    addNotification({
      userId: otherUserId,
      type: 'counter_offer',
      title: 'Counter offer received',
      body: `${currentUser.displayName} sent a counter offer.`,
      data: { offerId: offer.id },
    })
  }

  const handleSendMessage = (content: string) => {
    addMessage(offer.id, currentUser.id, content)
    addNotification({
      userId: otherUserId,
      type: 'new_message',
      title: 'New message',
      body: `${currentUser.displayName}: ${content.slice(0, 50)}`,
      data: { offerId: offer.id },
    })
  }

  const agreement = getAgreementByOfferId(offer.id)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-48">
      <Link to="/offers" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to offers
      </Link>

      {/* Listing context card */}
      {listing && (
        <Link
          to={`/listing/${listing.id}`}
          className="flex items-center gap-3 p-3 bg-white rounded-lg border border-sand-light mb-6 hover:border-sand transition-colors"
        >
          {listing.images[0] && (
            <img src={listing.images[0]} alt={listing.title} className="w-14 h-14 rounded-md object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink truncate">{listing.title}</p>
            <p className="text-xs text-muted">{listing.location.neighborhood}</p>
          </div>
          <Badge variant={offer.status === 'accepted' ? 'teal' : offer.status === 'declined' ? 'clay' : 'gold'}>
            {offer.status}
          </Badge>
        </Link>
      )}

      {/* Status timeline */}
      <div className="bg-white rounded-lg border border-sand-light px-4 py-3 mb-4 overflow-x-auto">
        <OfferTimeline offer={offer} />
      </div>

      {/* Thread */}
      <OfferThread offer={offer} currentUserId={currentUser.id} fromUser={fromUser} toUser={toUser} />

      {/* Counter offer form (inline) */}
      {showCounterForm && (
        <div className="mt-4">
          <CounterOfferForm
            onSubmit={handleCounter}
            onCancel={() => setShowCounterForm(false)}
          />
        </div>
      )}

      {/* Action bar */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 lg:left-60 right-0 bg-white border-t border-sand-light p-4 z-30">
        <div className="max-w-2xl mx-auto space-y-3">
          {/* Message composer for active offers */}
          {isActive && (
            <MessageComposer onSend={handleSendMessage} placeholder="Send a message..." />
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {isActive ? (
              isWaiting ? (
                <Button variant="ghost" disabled className="flex-1">
                  Waiting for response...
                </Button>
              ) : (
                <>
                  <Button variant="ghost" className="flex-1" onClick={() => setShowDeclineModal(true)}>
                    Decline
                  </Button>
                  {canCounter && (
                    <Button variant="outline" className="flex-1" onClick={() => setShowCounterForm(!showCounterForm)}>
                      Counter
                    </Button>
                  )}
                  <Button variant="confirm" className="flex-1" onClick={handleAccept}>
                    Accept
                  </Button>
                </>
              )
            ) : offer.status === 'accepted' && agreement ? (
              <Link to={`/agreements/${agreement.id}`} className="flex-1">
                <Button variant="confirm" className="w-full">View Agreement</Button>
              </Link>
            ) : (
              <Button variant="ghost" disabled className="flex-1">
                This offer has been {offer.status}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Decline modal */}
      {showDeclineModal && (
        <DeclineModal
          onDecline={handleDecline}
          onClose={() => setShowDeclineModal(false)}
        />
      )}
    </div>
  )
}
