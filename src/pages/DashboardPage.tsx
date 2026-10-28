import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Package, MessageSquare, FileCheck, Plus, ArrowRight, History, Send } from 'lucide-react'
import { useAuth } from '@/providers/AuthProvider'
import { useListingsStore, useUsersStore, useOffersForUser, useAgreementsForUser, useMyActiveListings } from '@/stores'
import { Badge, Avatar, Button, EmptyState, Tabs, buttonStyles } from '@/components/ui'
import { TradeCard, WithdrawOfferDialog } from '@/components/bartrrr'
import { usePageTitle } from '@/lib/utils'
import { OFFER_STATUS_LABELS, AGREEMENT_STATUS_LABELS, type Offer } from '@/types'

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
  const [withdrawing, setWithdrawing] = useState<Offer | null>(null)
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
  const closedOutgoing = outgoing.filter((o) => o.status === 'declined' || o.status === 'withdrawn' || o.status === 'expired')
  const activeAgreements = agreements.filter((a) => a.status === 'pending_signatures' || a.status === 'active')
  const completedAgreements = agreements.filter((a) => a.status === 'completed')

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <p className="eyebrow mb-4">{currentUser.neighborhood}</p>
      <h1 className="text-heading-page text-ink mb-8 sm:mb-10">
        Welcome back, <em>{currentUser.displayName.split(' ')[0]}</em>
      </h1>

      {/* Stats row: one hairline ledger, serif numerals */}
      <dl className="grid grid-cols-2 sm:grid-cols-4 border-t border-l border-ink mb-10">
        {[
          { value: myListings.length, label: 'Active listings' },
          { value: pendingIncoming.length, label: 'Offers to answer', accent: pendingIncoming.length > 0 },
          { value: activeAgreements.length, label: 'Active trades' },
          { value: currentUser.tradeCount, label: 'Trades completed' },
        ].map(({ value, label, accent }) => (
          <div key={label} className="flex flex-col-reverse gap-3 border-b border-r border-ink p-4 sm:p-5">
            <dt className="text-label text-muted">{label}</dt>
            <dd className="flex items-start gap-2 text-numeral text-[clamp(2.5rem,5vw,3.5rem)] text-ink">
              {value}
              {accent && <span aria-hidden="true" className="mt-2 h-2 w-2 rounded-full bg-clay" />}
            </dd>
          </div>
        ))}
      </dl>

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
          <div className="flex items-center justify-between mb-5">
            <p className="text-label text-muted">{myListings.length} active listing{myListings.length !== 1 ? 's' : ''}</p>
            <Link to="/listing/new" className={buttonStyles({ variant: 'outline', size: 'sm' })}>
              <Plus className="h-4 w-4" /> New listing
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <div className="border-t border-ink">
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
                  <div className="group flex items-center gap-4 border-b border-ink/20 px-1 py-4 transition-colors hover:bg-paper">
                    <Avatar name={fromUser.displayName} userId={fromUser.id} size="md" src={fromUser.avatarUrl} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[16px] font-medium text-ink">
                        {fromUser.displayName} wants to trade
                      </p>
                      <p className="text-small text-muted truncate mt-0.5">for {listing?.title || 'your listing'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={offer.status === 'countered' ? 'gold' : 'teal'}>
                        {OFFER_STATUS_LABELS[offer.status]}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted transition-transform duration-300 ease-out-soft group-hover:translate-x-1 group-hover:text-ink" />
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'outgoing' && (
        <div className="border-t border-ink">
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
              const toFirstName = toUser.displayName.split(' ')[0]
              return (
                // Stretched link: the whole row opens the offer; the withdraw button sits above it
                <div key={offer.id} className="group relative border-b border-ink/20 px-1 pt-4 pb-2 transition-colors hover:bg-paper">
                  <div className="flex items-center gap-4">
                    <Avatar name={toUser.displayName} userId={toUser.id} size="md" src={toUser.avatarUrl} />
                    <div className="flex-1 min-w-0">
                      <Link to={`/offers/${offer.id}`} className="text-[16px] font-medium text-ink after:absolute after:inset-0 after:content-['']">
                        Your offer to {toUser.displayName}
                      </Link>
                      <p className="text-small text-muted truncate mt-0.5">for {listing?.title || 'their listing'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={offer.status === 'countered' ? 'gold' : 'teal'}>
                        {OFFER_STATUS_LABELS[offer.status]}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted transition-transform duration-300 ease-out-soft group-hover:translate-x-1 group-hover:text-ink" />
                    </div>
                  </div>
                  {/* Lines the label up with the text column (32px avatar + 16px gap, minus button padding) */}
                  <div className="pl-9">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setWithdrawing(offer)}
                      className="relative z-10 whitespace-nowrap px-3 text-ink-2"
                      aria-label={`Withdraw offer to ${toFirstName}`}
                    >
                      Withdraw offer
                    </Button>
                  </div>
                </div>
              )
            })
          )}
          {closedOutgoing.length > 0 && (
            <div>
              <p className="text-label text-muted mt-8 mb-2">Closed</p>
              {closedOutgoing.map((offer) => {
                const toUser = getUserById(offer.toUserId)
                const listing = getListingById(offer.listingId)
                if (!toUser) return null
                return (
                  <Link key={offer.id} to={`/offers/${offer.id}`}>
                    <div className="flex items-center gap-3 border-b border-ink/15 px-1 py-3 text-muted transition-colors hover:bg-paper">
                      <Avatar name={toUser.displayName} userId={toUser.id} size="sm" src={toUser.avatarUrl} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-ink truncate">{toUser.displayName}: {listing?.title}</p>
                      </div>
                      <Badge variant={offer.status === 'declined' ? 'clay' : 'closed'}>
                        {OFFER_STATUS_LABELS[offer.status]}
                      </Badge>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'trades' && (
        <div className="border-t border-ink">
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
                  <div className="group flex items-center gap-4 border-b border-ink/20 px-1 py-4 transition-colors hover:bg-paper">
                    <Avatar name={otherUser.displayName} userId={otherUser.id} size="md" src={otherUser.avatarUrl} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[16px] font-medium text-ink">Trade with {otherUser.displayName}</p>
                      <p className="text-small text-muted truncate mt-0.5">
                        {agreement.partyA.item} ⇄ {agreement.partyB.item}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={agreement.status === 'active' ? 'teal' : 'gold'}>
                        {AGREEMENT_STATUS_LABELS[agreement.status]}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted transition-transform duration-300 ease-out-soft group-hover:translate-x-1 group-hover:text-ink" />
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="border-t border-ink">
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
                  <div className="group flex items-center gap-4 border-b border-ink/20 px-1 py-4 transition-colors hover:bg-paper">
                    <Avatar name={otherUser.displayName} userId={otherUser.id} size="md" src={otherUser.avatarUrl} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[16px] font-medium text-ink">Trade with {otherUser.displayName}</p>
                      <p className="text-small text-muted truncate mt-0.5">
                        {agreement.partyA.item} ⇄ {agreement.partyB.item}
                      </p>
                      {agreement.completedAt && (
                        <p className="text-label text-muted mt-1.5">
                          Completed {new Date(agreement.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <Badge variant="teal">Completed</Badge>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      )}

      {withdrawing && (
        <WithdrawOfferDialog
          offer={withdrawing}
          currentUser={currentUser}
          otherName={getUserById(withdrawing.toUserId)?.displayName.split(' ')[0] || 'your neighbor'}
          listingTitle={getListingById(withdrawing.listingId)?.title}
          onClose={() => setWithdrawing(null)}
        />
      )}
    </div>
  )
}
