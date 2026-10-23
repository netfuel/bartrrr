import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Calendar, MapPin, Info, CheckCircle, Handshake, PartyPopper, MessageSquare } from 'lucide-react'
import { cn, usePageTitle } from '@/lib/utils'
import { Button, BackLink, ConfirmDialog } from '@/components/ui'
import { showToast } from '@/stores/toast-store'
import { EXCHANGE_METHOD_LABELS } from '@/types'
import { AgreementCard, FirstTradeCelebration } from '@/components/bartrrr'
import { useAgreementsStore, useUsersStore, useNotificationsStore } from '@/stores'
import { useReviewsStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import { ReviewForm, ReviewCard } from '@/components/bartrrr'

export default function AgreementDetailPage() {
  const { id } = useParams()
  const { currentUser } = useAuth()
  const agreement = useAgreementsStore((s) => s.getAgreementById(id || ''))
  const signAgreement = useAgreementsStore((s) => s.signAgreement)
  const completeAgreement = useAgreementsStore((s) => s.completeAgreement)
  const getUserById = useUsersStore((s) => s.getUserById)
  const incrementTradeCount = useUsersStore((s) => s.incrementTradeCount)
  const addNotification = useNotificationsStore((s) => s.addNotification)
  const addReview = useReviewsStore((s) => s.addReview)
  const hasReviewed = useReviewsStore((s) => s.hasReviewed)
  const reviews = useReviewsStore((s) => s.reviews)
  const [showCelebration, setShowCelebration] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  usePageTitle('Trade agreement')

  if (!agreement || !currentUser) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted">We couldn't find this trade agreement. It may have been canceled, or the link is wrong.</p>
        <Link to="/agreements" className="text-ink underline underline-offset-4 text-base mt-2 inline-block">Go to your agreements</Link>
      </div>
    )
  }

  const partyA = getUserById(agreement.partyA.userId)
  const partyB = getUserById(agreement.partyB.userId)
  if (!partyA || !partyB) return null

  const otherPartyId = agreement.partyA.userId === currentUser.id
    ? agreement.partyB.userId
    : agreement.partyA.userId
  const otherParty = getUserById(otherPartyId)
  const otherFirstName = otherParty?.displayName.split(' ')[0] ?? 'your neighbor'
  const isParticipant = agreement.partyA.userId === currentUser.id || agreement.partyB.userId === currentUser.id

  const alreadyReviewed = hasReviewed(agreement.id, currentUser.id)
  const agreementReviews = reviews.filter((r) => r.agreementId === agreement.id)

  // Where this trade is in its journey: agree → meet & swap → done
  const journeyStep = agreement.status === 'completed' ? 2 : agreement.status === 'active' ? 1 : 0
  const journey = [
    { label: 'Both sign', icon: Handshake },
    { label: 'Meet and swap', icon: MapPin },
    { label: 'Done', icon: PartyPopper },
  ]

  const handleSign = () => {
    signAgreement(agreement.id, currentUser.id)
    addNotification({
      userId: otherPartyId,
      type: 'agreement_ready',
      title: 'Trade agreement signed',
      body: `${currentUser.displayName} signed the trade agreement.`,
      data: { agreementId: agreement.id },
    })
    const theyAlreadySigned =
      agreement.partyA.userId === currentUser.id ? agreement.partyB.signed : agreement.partyA.signed
    showToast(
      theyAlreadySigned
        ? 'You both signed. Time to meet up and swap.'
        : `Signed. We'll let you know when ${otherFirstName} signs too.`,
      'success',
    )
  }

  const handleComplete = () => {
    setShowCompleteConfirm(false)
    const isFirstTrade = !currentUser.tradeCount || currentUser.tradeCount === 0
    completeAgreement(agreement.id)
    incrementTradeCount(agreement.partyA.userId)
    incrementTradeCount(agreement.partyB.userId)
    addNotification({
      userId: otherPartyId,
      type: 'trade_complete',
      title: 'Trade complete',
      body: `${currentUser.displayName} marked your trade as done. How did it go? Leave a review.`,
      data: { agreementId: agreement.id },
    })
    if (isFirstTrade) {
      setShowCelebration(true)
    } else {
      showToast('Trade complete. Nice swap! Leave a review below.', 'success')
    }
  }

  const handleReview = (rating: number, comment: string) => {
    addReview({
      agreementId: agreement.id,
      reviewerId: currentUser.id,
      revieweeId: otherPartyId,
      rating,
      comment,
    })
    addNotification({
      userId: otherPartyId,
      type: 'review_request',
      title: 'New review',
      body: `${currentUser.displayName} left you a review.`,
      data: { agreementId: agreement.id },
    })
    showToast('Review posted. Thanks for helping neighbors trade with confidence.', 'success')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <BackLink to="/agreements" className="mb-2">All agreements</BackLink>

      {/* Journey: agree → meet → done */}
      <div className="border border-ink bg-cream p-5 mb-4">
        <div className="flex items-center">
          {journey.map(({ label, icon: Icon }, i) => (
            <div key={label} className={cn('flex items-center', i > 0 && 'flex-1')}>
              {i > 0 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-2',
                    i <= journeyStep ? 'bg-teal' : 'bg-sand',
                  )}
                />
              )}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full transition-colors',
                    i < journeyStep
                      ? 'bg-teal text-white'
                      : i === journeyStep
                        ? 'bg-forest text-white'
                        : 'bg-sand-light text-muted',
                  )}
                >
                  {i < journeyStep ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <p
                  className={cn(
                    'text-xs font-medium whitespace-nowrap',
                    i <= journeyStep ? 'text-ink' : 'text-muted',
                  )}
                >
                  {label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2.5 bg-gold-light rounded-none p-4 mb-6 text-small text-gold leading-relaxed">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          This agreement is voluntary and not legally binding. It's a shared record of what
          you and your neighbor agreed to trade, so nobody has to remember the details.
          Bartrrr helps you keep track; it doesn't enforce the deal.
        </p>
      </div>

      {/* Agreement card */}
      <AgreementCard
        agreement={agreement}
        partyA={partyA}
        partyB={partyB}
        currentUserId={currentUser.id}
        onSign={handleSign}
      />

      {/* Exchange details */}
      {(agreement.exchangeDate || agreement.exchangeLocation || agreement.specialInstructions) ? (
        <div className="mt-6 border border-ink bg-cream p-5 space-y-3">
          <h3 className="font-display text-lg font-semibold text-ink">When and where</h3>
          {agreement.exchangeMethod && (
            <div className="text-[15px]">
              <span className="text-muted">How: </span>
              <span className="text-ink">{EXCHANGE_METHOD_LABELS[agreement.exchangeMethod]}</span>
            </div>
          )}
          {agreement.exchangeDate && (
            <div className="flex items-center gap-2 text-[15px]">
              <Calendar className="h-4 w-4 text-muted" />
              <span className="text-ink">
                {new Date(agreement.exchangeDate).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          )}
          {agreement.exchangeLocation && (
            <div className="flex items-center gap-2 text-[15px]">
              <MapPin className="h-4 w-4 text-muted" />
              <span className="text-ink">{agreement.exchangeLocation}</span>
            </div>
          )}
          {agreement.specialInstructions && (
            <div className="text-[15px]">
              <span className="text-muted">Notes: </span>
              <span className="text-ink-2">{agreement.specialInstructions}</span>
            </div>
          )}
        </div>
      ) : (
        agreement.status !== 'completed' && agreement.status !== 'cancelled' && (
          <div className="mt-6 border border-ink bg-cream p-5">
            <h3 className="font-display text-lg font-semibold text-ink mb-1">When and where</h3>
            <p className="text-[15px] text-ink-2">
              No time or place yet. Message {otherFirstName} to pick one. A public spot like a
              library, coffee shop, or community center is a good bet.
            </p>
          </div>
        )
      )}

      {isParticipant && agreement.status !== 'completed' && agreement.status !== 'cancelled' && (
        <Link
          to={`/offers/${agreement.offerId}`}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-base text-ink underline underline-offset-4"
        >
          <MessageSquare className="h-4 w-4" /> Message {otherFirstName}
        </Link>
      )}

      {/* What if plans change */}
      {agreement.status !== 'completed' && agreement.status !== 'cancelled' && (
        <div className="mt-6 text-small text-muted leading-relaxed space-y-2">
          <p>
            <span className="font-medium text-ink-2">Plans changed?</span> Let {otherFirstName} know
            as early as you can. Canceling within 24 hours of the meetup counts as a late
            cancellation on your profile.
          </p>
          <p>
            <span className="font-medium text-ink-2">Something not right?</span> Talk it through
            with {otherFirstName} first. Bartrrr keeps the record of what you agreed to, but it
            can't decide who's right or guarantee an outcome.
          </p>
        </div>
      )}

      {/* Mark as complete (when both signed) */}
      {agreement.status === 'active' && (
        <div className="mt-6 bg-teal-light rounded-none p-6 text-center animate-fade-up">
          <CheckCircle className="h-10 w-10 text-teal mx-auto mb-3" />
          <p className="text-base font-medium text-teal-dark mb-4">
            You both signed. After you've met up and swapped, mark the trade as done.
          </p>
          <Button variant="confirm" size="lg" onClick={() => setShowCompleteConfirm(true)}>
            We made the swap
          </Button>
        </div>
      )}

      {/* Review section */}
      {agreement.status === 'completed' && (
        <div className="mt-6">
          <h3 className="font-display text-lg font-semibold text-ink mb-3">Reviews</h3>

          {agreementReviews.map((review) => {
            const reviewer = getUserById(review.reviewerId)
            return (
              <ReviewCard key={review.id} review={review} reviewer={reviewer!} />
            )
          })}

          {!alreadyReviewed && otherParty && (
            <ReviewForm
              revieweeName={otherParty.displayName}
              onSubmit={handleReview}
            />
          )}
        </div>
      )}

      {showCompleteConfirm && (
        <ConfirmDialog
          title="Did the swap happen?"
          description={
            <p>
              Only mark it done after you and {otherFirstName} have both handed over your side of
              the trade. This closes the agreement and can't be undone.
            </p>
          }
          confirmLabel="Yes, we swapped"
          confirmVariant="confirm"
          onConfirm={handleComplete}
          onClose={() => setShowCompleteConfirm(false)}
        />
      )}

      {/* First trade celebration */}
      {showCelebration && (
        <FirstTradeCelebration
          userId={currentUser.username}
          onClose={() => setShowCelebration(false)}
        />
      )}
    </div>
  )
}
