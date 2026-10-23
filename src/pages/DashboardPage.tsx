import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Package, MessageSquare, FileCheck, Plus, ArrowRight, History, Send } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { useListingsStore, useUsersStore, useOffersForUser, useAgreementsForUser, useMyActiveListings } from '@/stores'
import { Button, Badge, Avatar, Card, EmptyState, Tabs } from '@/components/ui'
import { TradeCard } from '@/components/bartrrr'
import { usePageTitle } from '@/lib/utils'
import { OFFER_STATUS_LABELS, AGREEMENT_STATUS_LABELS } from '@/types'

type Tab = 'listings' | 'incoming' | 'outgoing' | 'trades' | 'history'

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'listings', label: 'My listings', icon: <Package className="h-4 w-4" /> },
  { id: 'incoming', label: 'Offers received', icon: <MessageSquare className="h-4 w-4" /> },
  { id: 'outgoing', label: 'Offers sent', icon: <Send className="h-4 w-4" /> },
  { id: 'trades', label: 'Active trades', icon: <FileCheck className="h-4 w-4" /> },
  { id: 'history', label: 'Trade history', icon: <History className="h-4 w-4" /> },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('listings')
  const getUserById = useUsersStore((s) => s.getUserById)
  const getListingById = useListingsStore((s) => s.getListingById)
  usePageTitle('Dashboard')

  const userId = currentUser?.id
  const userOffers = useOffersForUser(userId)
  const agreements = useAgreementsForUser(userId)
  const myListings = useMyActiveListings(userId)
  const { incoming, outgoing } = useMemo(
    () => ({
      incoming: userOffers.filter((o) => o.toUserId === userId),
      outgoing: userOffers.filter((o) => o.fromUserId === userId),
    }),
    [userOffers, userId],
  )

  if (!currentUser) return null
  const pendingIncoming = incoming.filter((o) => o.status === 'pending' || o.status === 'countered')
  const pendingOutgoing = outgoing.filter((o) => o.status === 'pending' || o.status === 'countered')
  const activeAgreements = agreements.filter((a) => a.status === 'pending_signatures' || a.status === 'active')
  const completedAgreements = agreements.filter((a) => a.status === 'completed')

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-heading-page text-ink mb-1">
        Welcome back, {currentUser.displayName.split(' ')[0]}
      </h1>
      <p className="text-sm text-muted mb-6">{currentUser.neighborhood}</p>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="p-4 text-center">
          <p className="text-heading-page text-clay">{myListings.length}</p>
          <p className="text-xs text-muted">Active listings</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-heading-page text-gold">{pendingIncoming.length}</p>
          <p className="text-xs text-muted">Offers to answer</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-heading-page text-teal">{activeAgreements.length}</p>
          <p className="text-xs text-muted">Active trades</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-heading-page text-forest">{currentUser.tradeCount}</p>
          <p className="text-xs text-muted">Trades completed</p>
        </Card>
      </div>

      {/* Tab bar */}
      <Tabs
        variant="underline"
        label="Dashboard sections"
        className="mb-6"
        active={activeTab}
        onChange={setActiveTab}
        tabs={tabs.map((tab) => ({
          ...tab,
          count:
            tab.id === 'incoming' ? pendingIncoming.length :
            tab.id === 'outgoing' ? pendingOutgoing.length :
            tab.id === 'trades' ? activeAgreements.length : 0,
        }))}
      />

      {/* Tab content */}

      {activeTab === 'listings' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted">{myListings.length} active listing{myListings.length !== 1 ? 's' : ''}</p>
            <Link to="/listing/new">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4" /> New listing
              </Button>
            </Link>
          </div>
          {myListings.length === 0 ? (
            <EmptyState
              title="Your dashboard is quiet, for now"
              description="List something you'd love to trade. Neighbors can't make offers until you do."
              actionLabel="Post a listing"
              onAction={() => navigate('/listing/new')}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myListings.map((listing) => {
                const user = getUserById(listing.userId)
                if (!user) return null
                return <TradeCard key={listing.id} listing={listing} user={user} />
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'incoming' && (
        <div className="space-y-2">
          {pendingIncoming.length === 0 ? (
            <EmptyState
              title="No offers to answer"
              description="When a neighbor makes an offer on one of your listings, it shows up here. The more you list, the more offers you'll get."
              actionLabel="Post a listing"
              onAction={() => navigate('/listing/new')}
            />
          ) : (
            pendingIncoming.map((offer) => {
              const fromUser = getUserById(offer.fromUserId)
              const listing = getListingById(offer.listingId)
              if (!fromUser) return null
              return (
                <Link key={offer.id} to={`/offers/${offer.id}`}>
                  <Card className="p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                    <Avatar name={fromUser.displayName} userId={fromUser.id} size="md" src={fromUser.avatarUrl} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {fromUser.displayName} wants to trade
                      </p>
                      <p className="text-xs text-muted truncate">for {listing?.title || 'your listing'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={offer.status === 'countered' ? 'gold' : 'teal'}>
                        {OFFER_STATUS_LABELS[offer.status]}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted" />
                    </div>
                  </Card>
                </Link>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'outgoing' && (
        <div className="space-y-2">
          {pendingOutgoing.length === 0 ? (
            <EmptyState
              title="No open offers"
              description="See something you like nearby? Make an offer and propose a swap."
              actionLabel="Browse listings"
              onAction={() => navigate('/browse')}
            />
          ) : (
            pendingOutgoing.map((offer) => {
              const toUser = getUserById(offer.toUserId)
              const listing = getListingById(offer.listingId)
              if (!toUser) return null
              return (
                <Link key={offer.id} to={`/offers/${offer.id}`}>
                  <Card className="p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                    <Avatar name={toUser.displayName} userId={toUser.id} size="md" src={toUser.avatarUrl} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink">
                        Your offer to {toUser.displayName}
                      </p>
                      <p className="text-xs text-muted truncate">for {listing?.title || 'their listing'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={
                        offer.status === 'countered' ? 'gold' :
                        offer.status === 'pending' ? 'teal' : 'clay'
                      }>
                        {OFFER_STATUS_LABELS[offer.status]}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted" />
                    </div>
                  </Card>
                </Link>
              )
            })
          )}
          {outgoing.filter((o) => o.status === 'declined').length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted uppercase tracking-wider mb-2">Declined</p>
              {outgoing.filter((o) => o.status === 'declined').map((offer) => {
                const toUser = getUserById(offer.toUserId)
                const listing = getListingById(offer.listingId)
                if (!toUser) return null
                return (
                  <Link key={offer.id} to={`/offers/${offer.id}`}>
                    <Card className="p-3 flex items-center gap-3 opacity-60 mb-2">
                      <Avatar name={toUser.displayName} userId={toUser.id} size="sm" src={toUser.avatarUrl} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink truncate">{toUser.displayName}: {listing?.title}</p>
                      </div>
                      <Badge variant="clay">Declined</Badge>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'trades' && (
        <div className="space-y-2">
          {activeAgreements.length === 0 ? (
            <EmptyState
              title="No active trades"
              description="Once you accept an offer, or a neighbor accepts yours, the trade shows up here until you've swapped."
              actionLabel="Browse listings"
              onAction={() => navigate('/browse')}
            />
          ) : (
            activeAgreements.map((agreement) => {
              const otherPartyId = agreement.partyA.userId === currentUser.id
                ? agreement.partyB.userId
                : agreement.partyA.userId
              const otherUser = getUserById(otherPartyId)
              if (!otherUser) return null
              return (
                <Link key={agreement.id} to={`/agreements/${agreement.id}`}>
                  <Card className="p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
                    <Avatar name={otherUser.displayName} userId={otherUser.id} size="md" src={otherUser.avatarUrl} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink">Trade with {otherUser.displayName}</p>
                      <p className="text-xs text-muted truncate">
                        {agreement.partyA.item} ⇄ {agreement.partyB.item}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={agreement.status === 'active' ? 'teal' : 'gold'}>
                        {AGREEMENT_STATUS_LABELS[agreement.status]}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted" />
                    </div>
                  </Card>
                </Link>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-2">
          {completedAgreements.length === 0 ? (
            <EmptyState
              title="No completed trades yet"
              description="Your first trade is waiting. Explore what your neighbors have."
              actionLabel="Browse listings"
              onAction={() => navigate('/browse')}
            />
          ) : (
            completedAgreements.map((agreement) => {
              const otherPartyId = agreement.partyA.userId === currentUser.id
                ? agreement.partyB.userId
                : agreement.partyA.userId
              const otherUser = getUserById(otherPartyId)
              if (!otherUser) return null
              return (
                <Link key={agreement.id} to={`/agreements/${agreement.id}`}>
                  <Card className="p-4 flex items-center gap-3 hover:shadow-md transition-shadow opacity-80">
                    <Avatar name={otherUser.displayName} userId={otherUser.id} size="md" src={otherUser.avatarUrl} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink">Trade with {otherUser.displayName}</p>
                      <p className="text-xs text-muted truncate">
                        {agreement.partyA.item} ⇄ {agreement.partyB.item}
                      </p>
                      {agreement.completedAt && (
                        <p className="text-xs text-muted mt-0.5">
                          Completed {new Date(agreement.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <Badge variant="teal">Completed</Badge>
                  </Card>
                </Link>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
