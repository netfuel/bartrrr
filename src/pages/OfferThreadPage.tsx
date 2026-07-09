import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ArrowLeftRight } from 'lucide-react'
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
        <Link to="/offers" className="text-clay text-base mt-2 inline-block">Back to offers</Link>
      </div>
    )
  }

  const fromUser = getUserById(offer.fromUserId)
  const toUser = getUserById(offer.toUserId)
  const listing = getListingById(offer.listingId)
  if (!fromUser || !toUser) return null

  const otherUserId = currentUser.id === offer.fromUserId ? offer.toUserId : offer.fromUserId
  const otherUser = currentUser.id === offer.fromUserId ? toUser : fromUser
  const lastMessage = offer.messages[offer.messages.length - 1]
  const isWaiting = lastMessage?.fromUserId === currentUser.id && (offer.status === 'pending' || offer.status === 'countered')
  const canCounter = offer.round < offer.maxRounds
  const isActive = offer.status === 'pending' || offer.status === 'countered'

  // The trade in plain terms: the offer-maker gives the proposed items,
  // the listing owner gives the listed item (mirrors handleAccept below).
  const latestOfferMsg = [...offer.messages].reverse().find((m) => m.type === 'offer' || m.type === 'counter')
  const offeredItems = latestOfferMsg?.items?.join(', ') || 'Offered items'
  const listedItem = listing?.title || 'Listed item'
  const iAmOfferMaker = currentUser.id === offer.fromUserId
  const youGive = iAmOfferMaker ? offeredItems : listedItem
  const youGet = iAmOfferMaker ? listedItem : offeredItems

  const handleAccept = () => {
    acceptOffer(offer.id, currentUser.id)

    const agreementId = createAgreement({
      offerId: offer.id,
      partyA: { userId: offer.fromUserId, item: offeredItems },
      partyB: { userId: offer.toUserId, item: listedItem },
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
    <div className="max-w-2xl mx-auto px-4 py-6 pb-56">
      <Link to="/offers" className="inline-flex min-h-[44px] items-center gap-1.5 text-base text-muted hover:text-ink transition-colors mb-2">
        <ArrowLeft className="h-5 w-5" /> Back to offers
      </Link>

      {/* The trade, in plain terms */}
      <div className="bg-white rounded-lg shadow-soft p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-label text-muted">The trade so far</p>
          <Badge variant={offer.status === 'accepted' ? 'teal' : offer.status === 'declined' ? 'clay' : 'gold'}>
            {offer.status}
          </Badge>
        </div>
        <div className="flex items-stretch gap-3">
          <div className="flex-1 rounded-md bg-clay-light/50 p-4">
            <p className="text-label text-clay mb-1.5">You give</p>
            <p className="text-base font-medium text-ink leading-snug">{youGive}</p>
          </div>
          <div className="flex items-center text-muted shrink-0">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div className="flex-1 rounded-md bg-forest-light/60 p-4">
            <p className="text-label text-forest mb-1.5">You get</p>
            <p className="text-base font-medium text-ink leading-snug">{youGet}</p>
          </div>
        </div>
        {listing && (
          <Link
            to={`/listing/${listing.id}`}
            className="mt-4 flex items-center gap-3 rounded-md border border-sand-light p-2.5 hover:border-sand transition-colors"
          >
            {listing.images[0] && (
              <img src={listing.images[0]} alt={listing.title} className="w-12 h-12 rounded-md object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-ink truncate">{listing.title}</p>
              <p className="text-small text-muted">{listing.location.neighborhood}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted shrink-0" />
          </Link>
        )}
      </div>

      {/* Where things stand */}
      <div className="bg-white rounded-lg shadow-soft px-5 py-4 mb-6 overflow-x-auto">
        <OfferTimeline offer={offer} />
        <p className="text-small text-muted mt-3">
          Round {offer.round} of {offer.maxRounds}
          {isActive && !isWaiting && ' — your move: accept, suggest a change, or pass.'}
          {isActive && isWaiting && ` — waiting for ${otherUser.displayName.split(' ')[0]} to respond.`}
        </p>
      </div>

      {/* Conversation */}
      <OfferThread offer={offer} currentUserId={currentUser.id} fromUser={fromUser} toUser={toUser} />

      {/* Counter offer form (inline) */}
      {showCounterForm && (
        <div className="mt-4 animate-fade-up">
          <CounterOfferForm
            onSubmit={handleCounter}
            onCancel={() => setShowCounterForm(false)}
          />
        </div>
      )}

      {/* Action bar */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 lg:left-60 right-0 bg-white/95 backdrop-blur-md border-t border-sand-light p-4 z-30">
        <div className="max-w-2xl mx-auto space-y-3">
          {/* Message composer for active offers */}
          {isActive && (
            <MessageComposer onSend={handleSendMessage} placeholder={`Message ${otherUser.displayName.split(' ')[0]}...`} />
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {isActive ? (
              isWaiting ? (
                <Button variant="ghost" disabled className="flex-1">
                  Waiting for {otherUser.displayName.split(' ')[0]} to respond…
                </Button>
              ) : (
                <>
                  <Button variant="ghost" className="flex-1" onClick={() => setShowDeclineModal(true)}>
                    No thanks
                  </Button>
                  {canCounter && (
                    <Button variant="outline" className="flex-1" onClick={() => setShowCounterForm(!showCounterForm)}>
                      Suggest a change
                    </Button>
                  )}
                  <Button variant="confirm" className="flex-1" onClick={handleAccept}>
                    Accept trade
                  </Button>
                </>
              )
            ) : offer.status === 'accepted' && agreement ? (
              <Link to={`/agreements/${agreement.id}`} className="flex-1">
                <Button variant="confirm" className="w-full">View agreement</Button>
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
