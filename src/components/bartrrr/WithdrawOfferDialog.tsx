import { ConfirmDialog } from '@/components/ui'
import { useOffersStore, useNotificationsStore } from '@/stores'
import { showToast } from '@/stores/toast-store'
import type { Offer } from '@/types'

export interface WithdrawOfferDialogProps {
  offer: Offer
  /** The signed-in neighbor, who must be the one who made the offer */
  currentUser: { id: string; displayName: string }
  /** First name of the listing owner */
  otherName: string
  listingTitle?: string
  onClose: () => void
}

/**
 * Confirm step for withdrawing your own open offer. The server allows this
 * for the offer's maker only, while it's pending or countered, whoever sent
 * the latest counter-offer (offers_guard, migration 004).
 */
export function WithdrawOfferDialog({ offer, currentUser, otherName, listingTitle, onClose }: WithdrawOfferDialogProps) {
  const withdrawOffer = useOffersStore((s) => s.withdrawOffer)
  const addNotification = useNotificationsStore((s) => s.addNotification)

  const handleConfirm = () => {
    onClose()
    if (!withdrawOffer(offer.id, currentUser.id)) return
    // Local-only in demo mode; with a backend this is a no-op
    addNotification({
      userId: offer.toUserId,
      type: 'offer_declined',
      title: 'Offer withdrawn',
      body: `${currentUser.displayName} withdrew their offer on your ${listingTitle || 'listing'}.`,
      data: { offerId: offer.id },
    })
    showToast(`Offer withdrawn. We let ${otherName} know.`, 'info')
  }

  return (
    <ConfirmDialog
      title="Withdraw this offer?"
      description={
        <>
          <p>
            This ends the negotiation{listingTitle ? <> for <span className="font-medium text-ink">{listingTitle}</span></> : null}.
            We'll let {otherName} know you withdrew it.
          </p>
          <p className="mt-2">
            You can't undo this. If you change your mind, make a new offer while the listing is still up.
          </p>
        </>
      }
      confirmLabel="Withdraw offer"
      cancelLabel="Keep my offer"
      onConfirm={handleConfirm}
      onClose={onClose}
    />
  )
}
