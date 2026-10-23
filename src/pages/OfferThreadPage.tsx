import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowRight, ArrowLeftRight } from 'lucide-react'
import { Button, Badge, BackLink, ConfirmDialog } from '@/components/ui'
import { OfferThread, OfferTimeline, DeclineModal, CounterOfferForm, MessageComposer } from '@/components/bartrrr'
import { useOffersStore, useUsersStore, useListingsStore, useAgreementsStore, useNotificationsStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import { showToast } from '@/stores/toast-store'
import { formatTimeLeft, usePageTitle } from '@/lib/utils'
import { OFFER_STATUS_LABELS, DECLINE_REASON_LABELS, type OfferDeclineReason } from '@/types'

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
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false)
  usePageTitle('Offer')

  if (!offer || !currentUser) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted">We couldn't find this offer. It may have been removed, or the link is wrong.</p>
        <Link to="/offers" className="text-ink underline underline-offset-4 text-base mt-2 inline-block">Go to your offers</Link>
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
  const roundsLeft = offer.maxRounds - offer.round
  const isActive = offer.status === 'pending' || offer.status === 'countered'
  const otherFirstName = otherUser.displayName.split(' ')[0]
  const timeLeft = formatTimeLeft(offer.expiresAt)
  const agreement = getAgreementByOfferId(offer.id)

  // The trade in plain terms: the offer-maker gives the proposed items,
  // the listing owner gives the listed item (mirrors handleAccept below).
  const latestOfferMsg = [...offer.messages].reverse().find((m) => m.type === 'offer' || m.type === 'counter')
  const offeredItems = latestOfferMsg?.items?.join(', ') || 'Items offered'
  const listedItem = listing?.title || 'The listing'
  const iAmOfferMaker = currentUser.id === offer.fromUserId
  const youGive = iAmOfferMaker ? offeredItems : listedItem
  const youGet = iAmOfferMaker ? listedItem : offeredItems

  const handleAccept = () => {
    setShowAcceptConfirm(false)
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
      title: 'Offer accepted',
      body: `${currentUser.displayName} accepted the trade. Next: review and sign the trade agreement.`,
      data: { offerId: offer.id, agreementId },
    })
    showToast('Trade accepted. Next, review and sign the trade agreement.', 'success')
  }

  const handleDecline = (reason: OfferDeclineReason, note?: string) => {
    declineOffer(offer.id, currentUser.id, reason, note)
    setShowDeclineModal(false)
    addNotification({
      userId: otherUserId,
      type: 'offer_declined',
      title: 'Offer declined',
      body: `${currentUser.displayName} passed on this trade: ${DECLINE_REASON_LABELS[reason].toLowerCase()}.`,
      data: { offerId: offer.id },
    })
    showToast(`Offer declined. We let ${otherFirstName} know.`, 'info')
  }

  const handleCounter = (content: string, items: string[]) => {
    counterOffer(offer.id, currentUser.id, content, items)
    setShowCounterForm(false)
    addNotification({
      userId: otherUserId,
      type: 'counter_offer',
      title: 'New counter-offer',
      body: `${currentUser.displayName} suggested a change to your trade. Take a look.`,
      data: { offerId: offer.id },
    })
    showToast(`Counter-offer sent. Waiting for ${otherFirstName} to reply.`, 'success')
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-56">
      <BackLink to="/offers" className="mb-2">All offers</BackLink>

      {/* The trade, in plain terms */}
      <div className="border border-ink bg-cream p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-label text-muted">The trade so far</p>
          <Badge variant={offer.status === 'accepted' ? 'teal' : offer.status === 'declined' ? 'clay' : 'gold'}>
            {OFFER_STATUS_LABELS[offer.status]}
          </Badge>
        </div>
        <div className="flex items-stretch gap-3">
          <div className="flex-1 rounded-none bg-clay-light/50 p-4">
            <p className="text-label text-clay mb-1.5">You give</p>
            <p className="text-base font-medium text-ink leading-snug">{youGive}</p>
          </div>
          <div className="flex items-center text-muted shrink-0">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div className="flex-1 rounded-none bg-forest-light/60 p-4">
            <p className="text-label text-forest mb-1.5">You get</p>
            <p className="text-base font-medium text-ink leading-snug">{youGet}</p>
          </div>
        </div>
        {listing && (
          <Link
            to={`/listing/${listing.id}`}
            className="mt-4 flex items-center gap-3 rounded-none border border-sand-light p-2.5 hover:border-sand transition-colors"
          >
            {listing.images[0] && (
              <img src={listing.images[0]} alt={listing.title} className="w-12 h-12 rounded-none object-cover" />
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
      <div className="border border-ink bg-cream px-5 py-4 mb-6 overflow-x-auto">
        <OfferTimeline offer={offer} />
        <div className="mt-3 space-y-1" role="status" aria-live="polite">
          <p className="text-small text-ink-2">
            {isActive && !isWaiting && (canCounter
              ? 'Your move: accept, counter-offer, or decline.'
              : 'Your move: accept or decline. This is the last round, so counter-offers are closed.')}
            {isActive && isWaiting && `Waiting for ${otherFirstName} to reply. We'll let you know when they do.`}
            {offer.status === 'accepted' && (agreement
              ? 'Trade accepted. Next: you both sign the trade agreement.'
              : 'Trade accepted. Setting up your trade agreement…')}
            {offer.status === 'declined' && (iAmOfferMaker
              ? `${otherFirstName} declined this offer. Their reason is in the thread below.`
              : 'You declined this offer.')}
          </p>
          {isActive && (
            <p className="text-small text-muted">
              Round {offer.round} of {offer.maxRounds}
              {canCounter ? ` · ${roundsLeft} ${roundsLeft === 1 ? 'counter-offer' : 'counter-offers'} left` : ''}
              {timeLeft ? ` · Expires in ${timeLeft}` : ' · Reply window has closed'}
            </p>
          )}
          {isActive && !isWaiting && canCounter && roundsLeft === 1 && (
            <p className="text-small text-muted">
              One counter-offer left. If you're close, now's a good time to meet in the middle.
            </p>
          )}
        </div>
      </div>

      {/* Conversation */}
      <OfferThread offer={offer} currentUserId={currentUser.id} fromUser={fromUser} toUser={toUser} />

      {/* Counter offer form (inline) */}
      {showCounterForm && (
        <div className="mt-4 animate-fade-up">
          <CounterOfferForm
            onSubmit={handleCounter}
            onCancel={() => setShowCounterForm(false)}
            initialItems={latestOfferMsg?.items ?? []}
            otherName={otherFirstName}
            isOfferMaker={iAmOfferMaker}
            isLastRound={roundsLeft === 1}
          />
        </div>
      )}

      {/* Action bar */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 lg:left-60 right-0 bg-cream/95 backdrop-blur-sm border-t border-ink p-4 z-30">
        <div className="max-w-2xl mx-auto space-y-3">
          {/* Message composer for active offers */}
          {isActive && (
            <MessageComposer onSend={handleSendMessage} placeholder={`Message ${otherFirstName}…`} label={`Message ${otherFirstName}`} />
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {isActive ? (
              isWaiting ? (
                <Button variant="ghost" disabled className="flex-1">
                  Waiting for {otherFirstName} to reply
                </Button>
              ) : (
                <>
                  <Button variant="ghost" className="flex-1" onClick={() => setShowDeclineModal(true)}>
                    Decline
                  </Button>
                  {canCounter && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      aria-expanded={showCounterForm}
                      onClick={() => setShowCounterForm(!showCounterForm)}
                    >
                      Counter-offer
                    </Button>
                  )}
                  <Button variant="confirm" className="flex-1" onClick={() => setShowAcceptConfirm(true)}>
                    Accept trade
                  </Button>
                </>
              )
            ) : offer.status === 'accepted' && agreement ? (
              <Link to={`/agreements/${agreement.id}`} className="flex-1">
                <Button variant="confirm" className="w-full">Review and sign agreement</Button>
              </Link>
            ) : offer.status === 'declined' && iAmOfferMaker ? (
              <Link to="/browse" className="flex-1">
                <Button variant="outline" className="w-full">Find another trade</Button>
              </Link>
            ) : (
              <Link to="/offers" className="flex-1">
                <Button variant="ghost" className="w-full">Back to your offers</Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Accept confirmation */}
      {showAcceptConfirm && (
        <ConfirmDialog
          title="Accept this trade?"
          description={
            <>
              <p>
                You give <span className="font-medium text-ink">{youGive}</span> and
                get <span className="font-medium text-ink">{youGet}</span>.
              </p>
              <p className="mt-2">
                This ends the negotiation. Next, you'll both review and sign a simple trade
                agreement, then pick a time and place to swap.
              </p>
            </>
          }
          confirmLabel="Accept trade"
          confirmVariant="confirm"
          onConfirm={handleAccept}
          onClose={() => setShowAcceptConfirm(false)}
        />
      )}

      {/* Decline modal */}
      {showDeclineModal && (
        <DeclineModal
          otherName={otherFirstName}
          onDecline={handleDecline}
          onClose={() => setShowDeclineModal(false)}
        />
      )}
    </div>
  )
}
