import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Badge, EmptyState, Tabs } from '@/components/ui'
import { useOffersForUser, useUsersStore, useListingsStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import { MessageSquare } from 'lucide-react'
import { usePageTitle } from '@/lib/utils'
import { OFFER_STATUS_LABELS } from '@/types'

type Tab = 'incoming' | 'outgoing'

const statusBadge: Record<string, { variant: 'teal' | 'gold' | 'clay' | 'closed'; label: string }> = {
  pending: { variant: 'gold', label: OFFER_STATUS_LABELS.pending },
  countered: { variant: 'gold', label: OFFER_STATUS_LABELS.countered },
  accepted: { variant: 'teal', label: OFFER_STATUS_LABELS.accepted },
  declined: { variant: 'clay', label: OFFER_STATUS_LABELS.declined },
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
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-heading-page text-ink mb-4">Offers</h1>

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
        <div className="space-y-3">
          {offers.map((offer) => {
            const otherUserId = tab === 'incoming' ? offer.fromUserId : offer.toUserId
            const otherUser = getUserById(otherUserId)
            const listing = getListingById(offer.listingId)
            const lastMessage = offer.messages[offer.messages.length - 1]
            const isOpen = offer.status === 'pending' || offer.status === 'countered'
            const myTurn = isOpen && lastMessage?.fromUserId !== currentUser.id
            const sb = myTurn ? { variant: 'teal' as const, label: 'Your turn' } : statusBadge[offer.status]

            return (
              <Link
                key={offer.id}
                to={`/offers/${offer.id}`}
                className="flex items-start gap-3 p-4 border border-ink bg-cream transition-colors hover:bg-sand-light"
              >
                <Avatar
                  src={otherUser?.avatarUrl}
                  name={otherUser?.displayName || 'Neighbor'}
                  userId={otherUserId}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-ink truncate">{otherUser?.displayName}</p>
                    <Badge variant={sb.variant}>{sb.label}</Badge>
                  </div>
                  <p className="text-xs text-muted mt-0.5 truncate">{listing?.title}</p>
                  {lastMessage && (
                    <p className="text-xs text-ink-2 mt-1 line-clamp-1">{lastMessage.content}</p>
                  )}
                </div>
                <p className="text-[10px] text-muted shrink-0">
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
