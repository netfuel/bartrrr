import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Avatar, Badge, EmptyState } from '@/components/ui'
import { useOffersStore, useUsersStore, useListingsStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import { MessageSquare } from 'lucide-react'

type Tab = 'incoming' | 'outgoing'

const statusBadge: Record<string, { variant: 'teal' | 'gold' | 'clay' | 'closed'; label: string }> = {
  pending: { variant: 'gold', label: 'Pending' },
  countered: { variant: 'gold', label: 'Countered' },
  accepted: { variant: 'teal', label: 'Accepted' },
  declined: { variant: 'clay', label: 'Declined' },
}

export default function OffersInboxPage() {
  const [tab, setTab] = useState<Tab>('incoming')
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const getUserById = useUsersStore((s) => s.getUserById)
  const getListingById = useListingsStore((s) => s.getListingById)
  const allOffers = useOffersStore((s) => s.offers)

  if (!currentUser) return null

  const incoming = allOffers.filter((o) => o.toUserId === currentUser.id)
  const outgoing = allOffers.filter((o) => o.fromUserId === currentUser.id)
  const offers = tab === 'incoming' ? incoming : outgoing

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-display text-2xl font-bold text-ink mb-4">My Offers</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-sand-light rounded-full p-1 mb-6">
        {(['incoming', 'outgoing'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-full transition-colors capitalize',
              tab === t ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink-2',
            )}
          >
            {t} ({t === 'incoming' ? incoming.length : outgoing.length})
          </button>
        ))}
      </div>

      {/* Offer list */}
      {offers.length === 0 ? (
        <EmptyState
          title="No offers yet"
          description="No offers yet. Browse nearby listings and propose a swap."
          actionLabel="Browse listings"
          onAction={() => navigate('/browse')}
          icon={<MessageSquare className="h-10 w-10" />}
        />
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => {
            const otherUserId = tab === 'incoming' ? offer.fromUserId : offer.toUserId
            const otherUser = getUserById(otherUserId)
            const listing = getListingById(offer.listingId)
            const lastMessage = offer.messages[offer.messages.length - 1]
            const sb = statusBadge[offer.status]

            return (
              <Link
                key={offer.id}
                to={`/offers/${offer.id}`}
                className="flex items-start gap-3 p-4 bg-white rounded-lg border border-sand-light hover:border-sand transition-colors"
              >
                <Avatar
                  src={otherUser?.avatarUrl}
                  name={otherUser?.displayName || 'User'}
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
