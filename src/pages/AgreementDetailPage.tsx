import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Calendar, MapPin, Info, CheckCircle, Handshake, PartyPopper } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, BackLink } from '@/components/ui'
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

  if (!agreement || !currentUser) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted">Agreement not found.</p>
        <Link to="/agreements" className="text-clay text-base mt-2 inline-block">Back to agreements</Link>
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

  const alreadyReviewed = hasReviewed(agreement.id, currentUser.id)
  const agreementReviews = reviews.filter((r) => r.agreementId === agreement.id)

  // Where this trade is in its journey: agree → meet & swap → done
  const journeyStep = agreement.status === 'completed' ? 2 : agreement.status === 'active' ? 1 : 0
  const journey = [
    { label: 'You both agree', icon: Handshake },
    { label: 'Meet & swap', icon: MapPin },
    { label: 'Done!', icon: PartyPopper },
  ]

  const handleSign = () => {
    signAgreement(agreement.id, currentUser.id)
    addNotification({
      userId: otherPartyId,
      type: 'agreement_ready',
      title: 'Agreement signed',
      body: `${currentUser.displayName} has signed the trade agreement.`,
      data: { agreementId: agreement.id },
    })
  }

  const handleComplete = () => {
    const isFirstTrade = !currentUser.tradeCount || currentUser.tradeCount === 0
    completeAgreement(agreement.id)
    incrementTradeCount(agreement.partyA.userId)
    incrementTradeCount(agreement.partyB.userId)
    addNotification({
      userId: otherPartyId,
      type: 'trade_complete',
      title: 'Trade completed!',
      body: 'Your trade has been marked as complete. Leave a review!',
      data: { agreementId: agreement.id },
    })
    if (isFirstTrade) {
      setShowCelebration(true)
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
      title: 'New review received',
      body: `${currentUser.displayName} left you a review.`,
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <BackLink to="/agreements" className="mb-2">Back to agreements</BackLink>

      {/* Journey: agree → meet → done */}
      <div className="bg-white rounded-lg shadow-soft p-5 mb-4">
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
      <div className="flex items-start gap-2.5 bg-gold-light rounded-lg p-4 mb-6 text-small text-gold leading-relaxed">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          This is a voluntary, non-legally-binding agreement between two parties
          facilitated by Bartrrr. It documents the terms of a barter exchange.
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
      {(agreement.exchangeDate || agreement.exchangeLocation || agreement.specialInstructions) && (
        <div className="mt-6 bg-white rounded-lg p-5 shadow-soft space-y-3">
          <h3 className="font-display text-lg font-semibold text-ink">When & where</h3>
          {agreement.exchangeMethod && (
            <div className="text-[15px]">
              <span className="text-muted">Method: </span>
              <span className="text-ink capitalize">{agreement.exchangeMethod.replace(/_/g, ' ')}</span>
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
      )}

      {/* Mark as complete (when both signed) */}
      {agreement.status === 'active' && (
        <div className="mt-6 bg-teal-light rounded-lg p-6 text-center animate-fade-up">
          <CheckCircle className="h-10 w-10 text-teal mx-auto mb-3" />
          <p className="text-base font-medium text-teal-dark mb-4">
            You both agreed. Once you've met and swapped, mark it complete.
          </p>
          <Button variant="confirm" size="lg" onClick={handleComplete}>
            We made the trade
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
