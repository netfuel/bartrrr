import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { Star, MapPin, Calendar } from 'lucide-react'
import { Avatar, Chip, Tabs } from '@/components/ui'
import { TradeCard, ReviewCard } from '@/components/bartrrr'
import { useUsersStore, useListingsStore, useReviewsStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import { usePageTitle } from '@/lib/utils'

type Tab = 'portfolio' | 'reviews'

export default function ProfilePage() {
  const { username } = useParams()
  const [tab, setTab] = useState<Tab>('portfolio')
  const { currentUser } = useAuth()
  const getUserByUsername = useUsersStore((s) => s.getUserByUsername)
  const getUserById = useUsersStore((s) => s.getUserById)
  const listings = useListingsStore((s) => s.listings)
  const getReviewsForUser = useReviewsStore((s) => s.getReviewsForUser)

  const user = username === 'me' ? currentUser : getUserByUsername(username || '')
  usePageTitle(user?.displayName ?? 'Profile')

  if (!user) {
    return (
      <div className="px-5 py-24 text-center">
        <p className="font-display text-[28px] text-ink">We couldn't find this neighbor.</p>
        <p className="text-base text-ink-2 mt-2">They may have closed their account.</p>
        <Link to="/browse" className="text-label link-underline mt-4 inline-block text-ink">Browse listings</Link>
      </div>
    )
  }
  const isMe = currentUser?.id === user.id

  const userListings = listings.filter((l) => l.userId === user.id && l.status === 'active')
  const reviews = getReviewsForUser(user.id)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {/* Profile header */}
      <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
        <Avatar src={user.avatarUrl} name={user.displayName} userId={user.id} size="xl" className="!h-24 !w-24 sm:!h-28 sm:!w-28 text-2xl" />
        <div className="flex-1 min-w-0">
          <h1 className="text-heading-page text-ink">{user.displayName}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[15px] text-muted">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {user.neighborhood}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Joined {new Date(user.joinedAt).toLocaleDateString([], { month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="mt-5 inline-flex items-stretch border border-ink">
            <span className="flex items-center gap-1.5 px-4 py-2 text-numeral text-[26px] text-ink">
              <Star className="h-4 w-4 fill-gold text-gold" />
              {user.reputationScore.toFixed(1)}
            </span>
            <span className="flex items-center border-l border-ink px-4 py-2 text-label text-ink-2">{user.tradeCount} {user.tradeCount === 1 ? 'trade' : 'trades'}</span>
          </div>
          {user.bio && <p className="mt-6 max-w-[52ch] font-display text-[20px] leading-[1.45] text-ink">{user.bio}</p>}
          {user.lookingFor && user.lookingFor.length > 0 && (
            <div className="mt-6">
              <p className="eyebrow mb-3">Looking for</p>
              <div className="flex flex-wrap gap-2">
                {user.lookingFor.map((tag) => (<Chip key={tag} label={tag} />))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Tabs
        label="Profile sections"
        className="mt-10 mb-6 max-w-sm"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'portfolio', label: 'Listings' },
          { id: 'reviews', label: 'Reviews', count: reviews.length },
        ]}
      />

      {tab === 'portfolio' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {userListings.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="font-display text-[22px] text-muted">
                {isMe
                  ? "You don't have any active listings. Post one so neighbors can make offers."
                  : `${user.displayName.split(' ')[0]} doesn't have anything listed right now.`}
              </p>
              {isMe && (
                <Link to="/listing/new" className="text-label link-underline mt-4 inline-block text-ink">Post a listing</Link>
              )}
            </div>
          ) : (
            userListings.map((listing) => (
              <TradeCard key={listing.id} listing={listing} user={user} />
            ))
          )}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="max-w-2xl">
          {reviews.length === 0 ? (
            <div className="text-center py-12 font-display text-[22px] text-muted">
              {isMe
                ? 'No reviews yet. After each trade, your neighbor can leave one here.'
                : `No reviews yet. Reviews show up after ${user.displayName.split(' ')[0]} completes a trade.`}
            </div>
          ) : (
            reviews.map((review) => {
              const reviewer = getUserById(review.reviewerId)
              if (!reviewer) return null
              return <ReviewCard key={review.id} review={review} reviewer={reviewer} />
            })
          )}
        </div>
      )}
    </div>
  )
}
