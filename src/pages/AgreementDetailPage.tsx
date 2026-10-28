import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Calendar,
  MapPin,
  Info,
  CheckCircle,
  Handshake,
  PartyPopper,
  MessageSquare,
  Pencil,
  Flag,
  X,
} from 'lucide-react'
import { cn, usePageTitle } from '@/lib/utils'
import { Button, BackLink, ConfirmDialog } from '@/components/ui'
import { showToast } from '@/stores/toast-store'
import { EXCHANGE_METHOD_LABELS, type ExchangeDetails } from '@/types'
import {
  AgreementCard,
  ExchangeDetailsForm,
  FirstTradeCelebration,
  FlagTradeDialog,
} from '@/components/bartrrr'
import { useAgreementsStore, useUsersStore, useNotificationsStore } from '@/stores'
import { useReviewsStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import { ReviewForm, ReviewCard } from '@/components/bartrrr'
import {
  canCancel,
  canFlag,
  exchangeTime,
  formatExchangeTime,
  formatShortDate,
  isBeingAgreed,
  isLateCancellation,
  listPhrase,
  missingDetails,
} from '@/lib/agreements'
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal'

export default function AgreementDetailPage() {
  const { id } = useParams()
  const { currentUser } = useAuth()
  const agreement = useAgreementsStore((s) => s.getAgreementById(id || ''))
  const signAgreement = useAgreementsStore((s) => s.signAgreement)
  const completeAgreement = useAgreementsStore((s) => s.completeAgreement)
  const updateExchangeDetails = useAgreementsStore((s) => s.updateExchangeDetails)
  const cancelAgreement = useAgreementsStore((s) => s.cancelAgreement)
  const flagAgreement = useAgreementsStore((s) => s.flagAgreement)
  const getUserById = useUsersStore((s) => s.getUserById)
  const incrementTradeCount = useUsersStore((s) => s.incrementTradeCount)
  const noteLateCancellation = useUsersStore((s) => s.noteLateCancellation)
  const addNotification = useNotificationsStore((s) => s.addNotification)
  const addReview = useReviewsStore((s) => s.addReview)
  const hasReviewed = useReviewsStore((s) => s.hasReviewed)
  const reviews = useReviewsStore((s) => s.reviews)
  const [showCelebration, setShowCelebration] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  /** When the cancel dialog opened (null: closed); drives the late warning */
  const [cancelAskedAt, setCancelAskedAt] = useState<number | null>(null)
  const [showFlagDialog, setShowFlagDialog] = useState(false)
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
  const myFirstName = currentUser.displayName.split(' ')[0]
  const isParticipant = agreement.partyA.userId === currentUser.id || agreement.partyB.userId === currentUser.id

  /** "You" for the reader, otherwise the neighbor's first name */
  const nameOf = (userId: string | undefined, you = 'You') =>
    userId === currentUser.id
      ? you
      : (getUserById(userId ?? '')?.displayName.split(' ')[0] ?? 'Your neighbor')
  const open = isBeingAgreed(agreement)
  const missing = open ? missingDetails(agreement) : []
  const swapAt = exchangeTime(agreement)
  const anySigned = agreement.partyA.signed || agreement.partyB.signed
  const isClosed = agreement.status === 'cancelled' || agreement.status === 'disputed'
  const hasAnyDetail = Boolean(agreement.exchangeMethod || agreement.exchangeDate || agreement.exchangeLocation)

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

  const handleSaveDetails = (details: ExchangeDetails) => {
    updateExchangeDetails(agreement.id, currentUser.id, details)
    setEditingDetails(false)
    addNotification({
      userId: otherPartyId,
      type: 'agreement_ready',
      title: 'Trade details changed',
      body: `${myFirstName} changed the time and place. Review the agreement and sign again.`,
      data: { agreementId: agreement.id },
    })
    showToast(
      anySigned
        ? `Saved. You and ${otherFirstName} will both sign again.`
        : `Saved. We'll let ${otherFirstName} know.`,
      'success',
    )
  }

  const handleCancel = () => {
    setCancelAskedAt(null)
    const late = cancelAgreement(agreement.id, currentUser.id)
    if (late) noteLateCancellation(currentUser.id)
    addNotification({
      userId: otherPartyId,
      type: 'agreement_ready',
      title: 'Trade canceled',
      body: `${myFirstName} canceled your trade agreement. Message them if you want to try again.`,
      data: { agreementId: agreement.id },
    })
    showToast(`Trade canceled. We let ${otherFirstName} know.`, 'success')
  }

  const handleFlag = (reason: string) => {
    setShowFlagDialog(false)
    flagAgreement(agreement.id, currentUser.id, reason)
    addNotification({
      userId: otherPartyId,
      type: 'agreement_ready',
      title: 'Trade flagged for review',
      body: `${myFirstName} flagged your trade: “${reason.slice(0, 120)}” Talk it through with them in your messages.`,
      data: { agreementId: agreement.id },
    })
    showToast(`Trade flagged. We let ${otherFirstName} know.`, 'success')
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

      {/* Journey: agree → meet → done (hidden once canceled or flagged) */}
      {!isClosed && (
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
      )}

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

      {/* Canceled */}
      {agreement.status === 'cancelled' && (
        <section className="mt-8 border border-ink/40 bg-sand-light px-5 py-5 sm:px-7" aria-labelledby="cancelled-title">
          <h3 id="cancelled-title" className="flex items-center gap-2 text-heading-section text-ink">
            <X className="h-5 w-5" aria-hidden="true" /> Canceled
          </h3>
          <p className="mt-2 text-[16px] text-ink-2 leading-relaxed">
            {agreement.cancelledBy
              ? `${nameOf(agreement.cancelledBy)} canceled this trade${agreement.cancelledAt ? ` on ${formatShortDate(agreement.cancelledAt)}` : ''}.`
              : 'This trade was canceled.'}
            {agreement.cancelledLate &&
              (agreement.cancelledBy === currentUser.id
                ? ' It was less than 24 hours before the swap, so it shows as a late cancellation on your profile.'
                : ' It was less than 24 hours before the swap, so it shows as a late cancellation on their profile.')}
          </p>
        </section>
      )}

      {/* Flagged for review */}
      {agreement.status === 'disputed' && (
        <section className="mt-8 border border-clay bg-clay-light/60 px-5 py-5 sm:px-7" aria-labelledby="flagged-title">
          <h3 id="flagged-title" className="flex items-center gap-2 text-heading-section text-ink">
            <Flag className="h-5 w-5 text-clay-dark" aria-hidden="true" /> Flagged for review
          </h3>
          <p className="mt-2 text-[16px] text-ink-2">
            {nameOf(agreement.disputedBy)} flagged this trade
            {agreement.disputedAt ? ` on ${formatShortDate(agreement.disputedAt)}` : ''}:
          </p>
          {agreement.disputeReason && (
            <blockquote className="mt-2 border-l-2 border-clay pl-4 font-display text-[19px] leading-snug text-ink break-words">
              {agreement.disputeReason}
            </blockquote>
          )}
          <p className="mt-4 text-small text-ink-2 leading-relaxed">
            Talk it through with {otherFirstName} in your messages. Bartrrr keeps the record of what
            you agreed to and can help you two talk, but it can't decide who's right or guarantee an
            outcome. Need a hand? Email{' '}
            <a className="link-underline text-ink" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
          </p>
        </section>
      )}

      {/* When and where: editable by either neighbor until both sign */}
      <section className="mt-8" aria-labelledby="when-where">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 id="when-where" className="text-heading-section text-ink">When and where</h3>
          {isParticipant && open && !editingDetails && (
            <Button variant="outline" size="sm" onClick={() => setEditingDetails(true)}>
              <Pencil className="h-3.5 w-3.5" />
              {hasAnyDetail ? 'Edit time and place' : 'Add time and place'}
            </Button>
          )}
        </div>

        {editingDetails ? (
          <ExchangeDetailsForm
            initial={agreement}
            anySigned={anySigned}
            otherName={otherFirstName}
            onSave={handleSaveDetails}
            onCancel={() => setEditingDetails(false)}
          />
        ) : open || hasAnyDetail ? (
          <>
            {missing.length > 0 && (
              <p role="status" className="mb-4 border-l-2 border-gold bg-gold-light/70 px-4 py-3 text-small text-ink-2 leading-relaxed">
                {missing.length === 3
                  ? `No time or place yet. Pick them with ${otherFirstName}, then add them here. You can both sign once they're set.`
                  : `Almost there: add ${listPhrase(missing)} so you can both sign.`}
              </p>
            )}
            <dl className="divide-y divide-ink/20 border-y border-ink">
              <div className="flex items-baseline gap-4 py-3.5 text-[16px]">
                <dt className="text-label w-20 shrink-0 text-muted">How</dt>
                <dd className={agreement.exchangeMethod ? 'text-ink' : 'text-muted italic'}>
                  {agreement.exchangeMethod ? EXCHANGE_METHOD_LABELS[agreement.exchangeMethod] : 'Not set yet'}
                </dd>
              </div>
              <div className="flex items-baseline gap-4 py-3.5 text-[16px]">
                <dt className="text-label w-20 shrink-0 text-muted flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-clay" aria-hidden="true" /> When
                </dt>
                <dd className={agreement.exchangeDate ? 'text-ink' : 'text-muted italic'}>
                  {swapAt ? formatExchangeTime(swapAt) : (agreement.exchangeDate ?? 'Not set yet')}
                </dd>
              </div>
              <div className="flex items-baseline gap-4 py-3.5 text-[16px]">
                <dt className="text-label w-20 shrink-0 text-muted flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-clay" aria-hidden="true" /> Where
                </dt>
                <dd className={cn('min-w-0 break-words', agreement.exchangeLocation ? 'text-ink' : 'text-muted italic')}>
                  {agreement.exchangeLocation ?? 'Not set yet'}
                </dd>
              </div>
              {agreement.specialInstructions && (
                <div className="flex items-baseline gap-4 py-3.5 text-[16px]">
                  <dt className="text-label w-20 shrink-0 text-muted">Notes</dt>
                  <dd className="min-w-0 break-words text-ink-2 leading-relaxed">{agreement.specialInstructions}</dd>
                </div>
              )}
            </dl>
            {open && isParticipant && (
              <p className="mt-3 text-small text-muted">
                {agreement.termsUpdatedBy && agreement.termsUpdatedAt
                  ? `Last changed by ${nameOf(agreement.termsUpdatedBy, 'you')} on ${formatShortDate(agreement.termsUpdatedAt)}. `
                  : ''}
                Either of you can change these until you've both signed. A change clears both signatures.
              </p>
            )}
          </>
        ) : (
          <p className="border-y border-ink py-3.5 text-[16px] text-ink-2 leading-relaxed">
            No time or place was set for this trade.
          </p>
        )}
      </section>

      {isParticipant && agreement.status !== 'completed' && agreement.status !== 'cancelled' && (
        <Link
          to={`/offers/${agreement.offerId}`}
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-label link-underline text-ink"
        >
          <MessageSquare className="h-4 w-4" /> Message {otherFirstName}
        </Link>
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

      {/* Plans changed / something not right */}
      {isParticipant && (canCancel(agreement) || canFlag(agreement)) && (
        <section className="mt-10 border-t border-ink/30 pt-6 space-y-6" aria-label="If plans change">
          {canCancel(agreement) && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <p className="text-small text-muted leading-relaxed max-w-[52ch]">
                <span className="font-medium text-ink-2">Plans changed?</span> Let {otherFirstName} know
                as early as you can. Canceling within 24 hours of the meetup counts as a late
                cancellation on your profile.
              </p>
              <Button variant="outline" size="sm" className="shrink-0 self-start" onClick={() => setCancelAskedAt(Date.now())}>
                Cancel trade
              </Button>
            </div>
          )}
          {canFlag(agreement) && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <p className="text-small text-muted leading-relaxed max-w-[52ch]">
                <span className="font-medium text-ink-2">Something not right?</span> Talk it through
                with {otherFirstName} first. If that doesn't settle it, flag the trade for review.
                Bartrrr keeps the record of what you agreed to, but it can't decide who's right or
                guarantee an outcome.
              </p>
              <Button variant="outline" size="sm" className="shrink-0 self-start" onClick={() => setShowFlagDialog(true)}>
                <Flag className="h-3.5 w-3.5" /> Flag for review
              </Button>
            </div>
          )}
        </section>
      )}

      {cancelAskedAt !== null && (
        <ConfirmDialog
          title="Cancel this trade?"
          description={
            <>
              <p>
                This closes the agreement for both of you and can't be undone. We'll let{' '}
                {otherFirstName} know.
              </p>
              {isLateCancellation(agreement, cancelAskedAt) && (
                <p className="mt-3 border-l-2 border-clay bg-clay-light px-3 py-2 text-ink">
                  {swapAt && swapAt.getTime() < cancelAskedAt
                    ? 'The swap time has already passed'
                    : 'The swap is less than 24 hours away'}
                  , so this counts as a late cancellation on your profile.
                </p>
              )}
            </>
          }
          confirmLabel="Cancel trade"
          cancelLabel="Keep the trade"
          onConfirm={handleCancel}
          onClose={() => setCancelAskedAt(null)}
        />
      )}

      {showFlagDialog && (
        <FlagTradeDialog
          otherName={otherFirstName}
          completed={agreement.status === 'completed'}
          onFlag={handleFlag}
          onClose={() => setShowFlagDialog(false)}
        />
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
