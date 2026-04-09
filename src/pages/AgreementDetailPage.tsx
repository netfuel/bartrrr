import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Info, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui'
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

  if (!agreement || !currentUser) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted">Agreement not found.</p>
        <Link to="/agreements" className="text-clay text-sm mt-2 inline-block">Back to agreements</Link>
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

  const [showCelebration, setShowCelebration] = useState(false)

  const alreadyReviewed = hasReviewed(agreement.id, currentUser.id)
  const agreementReviews = reviews.filter((r) => r.agreementId === agreement.id)

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
      <Link
        to="/agreements"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to agreements
      </Link>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-gold-light rounded-lg p-3 mb-6 text-xs text-gold leading-relaxed">
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
        <div className="mt-6 bg-white rounded-lg p-4 border border-sand-light space-y-3">
          <h3 className="font-display text-base font-semibold text-ink">Exchange Details</h3>
          {agreement.exchangeMethod && (
            <div className="text-sm">
              <span className="text-muted">Method: </span>
              <span className="text-ink capitalize">{agreement.exchangeMethod.replace(/_/g, ' ')}</span>
            </div>
          )}
          {agreement.exchangeDate && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted" />
              <span className="text-ink">
                {new Date(agreement.exchangeDate).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          )}
          {agreement.exchangeLocation && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted" />
              <span className="text-ink">{agreement.exchangeLocation}</span>
            </div>
          )}
          {agreement.specialInstructions && (
            <div className="text-sm">
              <span className="text-muted">Notes: </span>
              <span className="text-ink-2">{agreement.specialInstructions}</span>
            </div>
          )}
        </div>
      )}

      {/* Mark as complete (when both signed) */}
      {agreement.status === 'active' && (
        <div className="mt-6 bg-teal-light rounded-lg p-4 text-center">
          <CheckCircle className="h-8 w-8 text-teal mx-auto mb-2" />
          <p className="text-sm font-medium text-teal-dark mb-3">Both parties have signed. Ready to complete?</p>
          <Button variant="confirm" onClick={handleComplete}>
            Mark trade as complete
          </Button>
        </div>
      )}

      {/* Review section */}
      {agreement.status === 'completed' && (
        <div className="mt-6">
          <h3 className="font-display text-base font-semibold text-ink mb-3">Reviews</h3>

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
