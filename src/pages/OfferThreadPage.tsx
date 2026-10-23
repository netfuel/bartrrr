import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowRight, ArrowLeftRight } from 'lucide-react'
import { Button, Badge, BackLink } from '@/components/ui'
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
      <div className="px-5 py-24 text-center">
        <p className="font-display text-[28px] text-ink">Offer not found.</p>
        <Link to="/offers" className="text-label link-underline mt-4 inline-block text-ink">Back to offers</Link>
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-64 lg:pb-48">
      <BackLink to="/offers" className="mb-3">Back to offers</BackLink>

      {/* The trade, in plain terms */}
      <section className="border border-ink bg-paper mb-5">
        <div className="flex items-center justify-between gap-4 border-b border-ink px-5 py-3.5">
          <p className="eyebrow">The trade so far</p>
          <Badge variant={offer.status === 'accepted' ? 'teal' : offer.status === 'declined' ? 'clay' : 'gold'}>
            {offer.status}
          </Badge>
        </div>
        <div className="relative grid grid-cols-1 sm:grid-cols-2">
          <div className="px-5 py-5 sm:py-6 sm:pr-10 border-b border-ink/20 sm:border-b-0 sm:border-r">
            <p className="text-label text-clay-dark mb-2">You give</p>
            <p className="font-display text-[22px] leading-[1.25] tracking-[-0.01em] text-ink">{youGive}</p>
          </div>
          <div className="px-5 py-5 sm:py-6 sm:pl-10">
            <p className="text-label text-forest mb-2">You get</p>
            <p className="font-display text-[22px] leading-[1.25] tracking-[-0.01em] text-ink">{youGet}</p>
          </div>
          <span
            aria-hidden="true"
            className="absolute right-5 top-[calc(50%-1.25rem)] sm:right-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-ink bg-cream text-ink"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </span>
        </div>
        {listing && (
          <Link
            to={`/listing/${listing.id}`}
            className="group flex items-center gap-3 border-t border-ink px-5 py-3 transition-colors hover:bg-cream"
          >
            {listing.images[0] && (
              <img src={listing.images[0]} alt="" className="photo-warm w-11 h-11 rounded-none object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-medium text-ink truncate">{listing.title}</p>
              <p className="text-small text-muted">{listing.location.neighborhood}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted shrink-0 transition-transform duration-300 ease-out-soft group-hover:translate-x-1 group-hover:text-ink" />
          </Link>
        )}
      </section>

      {/* Where things stand */}
      <div className="border-y border-ink/30 py-5 mb-8">
        <OfferTimeline offer={offer} />
        <p className="text-small text-ink-2 mt-4">
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
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-0 left-0 lg:left-60 right-0 bg-cream/95 backdrop-blur-md border-t border-ink px-4 py-3 sm:p-4 z-30">
        <div className="max-w-3xl mx-auto space-y-2.5 sm:space-y-3 sm:px-2">
          {/* Message composer for active offers */}
          {isActive && (
            <MessageComposer onSend={handleSendMessage} placeholder={`Message ${otherUser.displayName.split(' ')[0]}...`} />
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:gap-3">
            {isActive ? (
              isWaiting ? (
                <Button variant="ghost" disabled className="flex-1">
                  Waiting for {otherUser.displayName.split(' ')[0]} to respond…
                </Button>
              ) : (
                <>
                  <Button variant="ghost" className="shrink-0 whitespace-nowrap px-3 text-[14px] sm:px-5 sm:text-[15px]" onClick={() => setShowDeclineModal(true)}>
                    No thanks
                  </Button>
                  {canCounter && (
                    <Button variant="outline" className="flex-1 min-w-max whitespace-nowrap px-3 text-[14px] sm:text-[15px]" aria-expanded={showCounterForm} onClick={() => setShowCounterForm(!showCounterForm)}>
                      Suggest a change
                    </Button>
                  )}
                  <Button variant="confirm" className="flex-1 min-w-max whitespace-nowrap px-4 text-[14px] sm:text-[15px]" onClick={handleAccept}>
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
