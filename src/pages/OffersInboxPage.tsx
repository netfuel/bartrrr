import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Badge, EmptyState, Tabs } from '@/components/ui'
import { useOffersForUser, useUsersStore, useListingsStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import { MessageSquare } from 'lucide-react'
import { usePageTitle } from '@/lib/utils'
import { OFFER_STATUS_LABELS, type OfferStatus } from '@/types'

type Tab = 'incoming' | 'outgoing'

const statusBadge: Record<OfferStatus, { variant: 'teal' | 'gold' | 'clay' | 'closed'; label: string }> = {
  pending: { variant: 'gold', label: OFFER_STATUS_LABELS.pending },
  countered: { variant: 'gold', label: OFFER_STATUS_LABELS.countered },
  accepted: { variant: 'teal', label: OFFER_STATUS_LABELS.accepted },
  declined: { variant: 'clay', label: OFFER_STATUS_LABELS.declined },
  withdrawn: { variant: 'closed', label: OFFER_STATUS_LABELS.withdrawn },
  expired: { variant: 'closed', label: OFFER_STATUS_LABELS.expired },
}

export default function OffersInboxPage() {
  const [tab, setTab] = useState<Tab>('incoming')
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const getUserById = useUsersStore((s) => s.getUserById)
  const getListingById = useListingsStore((s) => s.getListingById)
  const allOffers = useOffersForUser(currentUser?.id)
  usePageTitle('Offers')

  if (!currentUser) return null

  const incoming = allOffers.filter((o) => o.toUserId === currentUser.id)
  const outgoing = allOffers.filter((o) => o.fromUserId === currentUser.id)
  const offers = tab === 'incoming' ? incoming : outgoing

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="text-heading-page text-ink mb-8">Offers</h1>

      <Tabs
        label="Offer direction"
        className="mb-6"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'incoming', label: 'Received', count: incoming.length },
          { id: 'outgoing', label: 'Sent', count: outgoing.length },
        ]}
      />

      {/* Offer list */}
      {offers.length === 0 ? (
        tab === 'incoming' ? (
          <EmptyState
            title="No offers yet"
            description="When a neighbor wants to trade for one of your listings, their offer shows up here. More listings mean more offers."
            actionLabel="Post a listing"
            onAction={() => navigate('/listing/new')}
            icon={<MessageSquare className="h-10 w-10" />}
          />
        ) : (
          <EmptyState
            title="You haven't made any offers"
            description="See something you like nearby? Make an offer and propose a swap."
            actionLabel="Browse listings"
            onAction={() => navigate('/browse')}
            icon={<MessageSquare className="h-10 w-10" />}
          />
        )
      ) : (
        <div className="border-t border-ink">
          {offers.map((offer) => {
            const otherUserId = tab === 'incoming' ? offer.fromUserId : offer.toUserId
            const otherUser = getUserById(otherUserId)
            const listing = getListingById(offer.listingId)
            const lastMessage = offer.messages[offer.messages.length - 1]
            const isOpen = offer.status === 'pending' || offer.status === 'countered'
            const myTurn = isOpen && lastMessage?.fromUserId !== currentUser.id
            const sb = myTurn
              ? { variant: 'teal' as const, label: 'Your turn' }
              : statusBadge[offer.status]

            return (
              <Link
                key={offer.id}
                to={`/offers/${offer.id}`}
                className="group flex items-start gap-4 border-b border-ink/20 px-1 py-5 transition-colors hover:bg-paper"
              >
                <Avatar
                  src={otherUser?.avatarUrl}
                  name={otherUser?.displayName || 'Neighbor'}
                  userId={otherUserId}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-[16px] font-medium text-ink truncate">{otherUser?.displayName}</p>
                    <Badge variant={sb.variant}>{sb.label}</Badge>
                  </div>
                  <p className="font-display text-[18px] leading-snug text-ink mt-1 truncate transition-colors group-hover:text-clay-dark">{listing?.title}</p>
                  {offer.status === 'withdrawn' ? (
                    // A withdrawal leaves no thread message, so say it here
                    <p className="text-small text-muted mt-1 line-clamp-1">
                      {tab === 'outgoing'
                        ? 'You withdrew this offer.'
                        : `${otherUser?.displayName.split(' ')[0] || 'Your neighbor'} withdrew this offer.`}
                    </p>
                  ) : lastMessage && (
                    <p className="text-small text-muted mt-1 line-clamp-1">{lastMessage.content}</p>
                  )}
                </div>
                <p className="text-label text-muted shrink-0 pt-0.5">
                  {new Date(offer.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
