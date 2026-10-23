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
      <div className="px-5 py-24 text-center">
        <p className="font-display text-[28px] text-ink">We couldn't find this trade agreement.</p>
        <p className="text-base text-ink-2 mt-2">It may have been canceled, or the link is wrong.</p>
        <Link to="/agreements" className="text-label link-underline mt-4 inline-block text-ink">Go to your agreements</Link>
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-16">
      <BackLink to="/agreements" className="mb-3">All agreements</BackLink>

      {/* Journey: agree → meet → done */}
      <div className="border-y border-ink/30 py-5 mb-6">
        <div className="flex items-center">
          {journey.map(({ label, icon: Icon }, i) => (
            <div key={label} className={cn('flex items-center', i > 0 && 'flex-1')}>
              {i > 0 && (
                <div
                  className={cn(
                    'h-px flex-1 mx-3 -mt-6',
                    i <= journeyStep ? 'bg-ink' : 'bg-ink/20',
                  )}
                />
              )}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full border transition-colors duration-500',
                    i < journeyStep
                      ? 'border-ink bg-ink text-cream'
                      : i === journeyStep
                        ? 'border-forest bg-forest text-cream'
                        : 'border-ink/25 bg-cream text-muted',
                  )}
                >
                  {i < journeyStep ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <p
                  className={cn(
                    'text-label whitespace-nowrap',
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
      <div className="flex items-start gap-3 border-l-2 border-gold bg-gold-light/70 rounded-none px-4 py-3.5 mb-6 text-small text-ink-2 leading-relaxed">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-gold" />
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
        <section className="mt-8">
          <h3 className="text-heading-section text-ink mb-4">When and where</h3>
          <div className="divide-y divide-ink/20 border-y border-ink">
          {agreement.exchangeMethod && (
            <div className="flex items-baseline gap-4 py-3.5 text-[16px]">
              <span className="text-label w-20 shrink-0 text-muted">How: </span>
              <span className="text-ink">{EXCHANGE_METHOD_LABELS[agreement.exchangeMethod]}</span>
            </div>
          )}
          {agreement.exchangeDate && (
            <div className="flex items-center gap-4 py-3.5 text-[16px]">
              <Calendar className="h-4 w-4 shrink-0 text-clay" />
              <span className="text-ink">
                {new Date(agreement.exchangeDate).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          )}
          {agreement.exchangeLocation && (
            <div className="flex items-center gap-4 py-3.5 text-[16px]">
              <MapPin className="h-4 w-4 shrink-0 text-clay" />
              <span className="text-ink">{agreement.exchangeLocation}</span>
            </div>
          )}
          {agreement.specialInstructions && (
            <div className="flex items-baseline gap-4 py-3.5 text-[16px]">
              <span className="text-label w-20 shrink-0 text-muted">Notes: </span>
              <span className="text-ink-2 leading-relaxed">{agreement.specialInstructions}</span>
            </div>
          )}
          </div>
        </section>
      ) : (
        agreement.status !== 'completed' && agreement.status !== 'cancelled' && (
          <section className="mt-8">
            <h3 className="text-heading-section text-ink mb-4">When and where</h3>
            <p className="border-y border-ink py-3.5 text-[16px] text-ink-2 leading-relaxed">
              No time or place yet. Message {otherFirstName} to pick one. A public spot like a
              library, coffee shop, or community center is a good bet.
            </p>
          </section>
        )
      )}

      {isParticipant && agreement.status !== 'completed' && agreement.status !== 'cancelled' && (
        <Link
          to={`/offers/${agreement.offerId}`}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-label link-underline text-ink"
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
        <div className="mt-8 border border-teal bg-teal-light rounded-none p-6 sm:p-8 text-center animate-fade-up">
          <CheckCircle className="h-9 w-9 text-teal-dark mx-auto mb-4" strokeWidth={1.25} />
          <p className="font-display text-[20px] leading-snug text-ink mb-5 max-w-[30ch] mx-auto">
            You both signed. After you've met up and swapped, mark the trade as done.
          </p>
          <Button variant="confirm" size="lg" onClick={() => setShowCompleteConfirm(true)}>
            We made the swap
          </Button>
        </div>
      )}

      {/* Review section */}
      {agreement.status === 'completed' && (
        <div className="mt-10">
          <h3 className="text-heading-section text-ink mb-4">Reviews</h3>

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
