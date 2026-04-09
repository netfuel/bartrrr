import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { Star, MapPin, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, Chip } from '@/components/ui'
import { TradeCard, ReviewCard } from '@/components/bartrrr'
import { useUsersStore, useListingsStore, useReviewsStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'

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

  if (!user) {
    return <div className="p-8 text-center text-muted">Profile not found.</div>
  }

  const userListings = listings.filter((l) => l.userId === user.id && l.status === 'active')
  const reviews = getReviewsForUser(user.id)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Profile header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
        <Avatar src={user.avatarUrl} name={user.displayName} userId={user.id} size="xl" />
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold text-ink">{user.displayName}</h1>
          <div className="flex items-center justify-center sm:justify-start gap-3 mt-1 text-sm text-muted">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {user.neighborhood}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Joined {new Date(user.joinedAt).toLocaleDateString([], { month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center justify-center sm:justify-start gap-4 mt-2">
            <span className="flex items-center gap-1 text-sm font-medium text-gold">
              <Star className="h-4 w-4 fill-gold" />
              {user.reputationScore.toFixed(1)}
            </span>
            <span className="text-sm text-ink-2">{user.tradeCount} trades</span>
          </div>
          {user.bio && <p className="mt-3 text-sm text-ink-2 leading-relaxed">{user.bio}</p>}
          {user.lookingFor && user.lookingFor.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">Looking for</p>
              <div className="flex flex-wrap gap-1.5">
                {user.lookingFor.map((tag) => (<Chip key={tag} label={tag} />))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-sand-light rounded-full p-1 mt-8 mb-6">
        {(['portfolio', 'reviews'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-full transition-colors capitalize',
              tab === t ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink-2',
            )}
          >
            {t} {t === 'reviews' && reviews.length > 0 ? `(${reviews.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'portfolio' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {userListings.length === 0 ? (
            <p className="text-sm text-muted col-span-full text-center py-8">No listings yet.</p>
          ) : (
            userListings.map((listing) => (
              <TradeCard key={listing.id} listing={listing} user={user} />
            ))
          )}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted">
              Reviews will appear here after completed trades.
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
