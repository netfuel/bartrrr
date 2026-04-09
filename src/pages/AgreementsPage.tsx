import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui'
import { AgreementCard } from '@/components/bartrrr'
import { useAgreementsStore, useUsersStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import type { AgreementStatus } from '@/types'

type Tab = 'pending' | 'active' | 'completed'

const tabFilter: Record<Tab, AgreementStatus[]> = {
  pending: ['draft', 'under_review', 'pending_signatures'],
  active: ['active'],
  completed: ['completed', 'cancelled', 'disputed'],
}

export default function AgreementsPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const { currentUser } = useAuth()
  const agreements = useAgreementsStore((s) => s.agreements)
  const getUserById = useUsersStore((s) => s.getUserById)

  if (!currentUser) return null

  const userAgreements = agreements.filter(
    (a) => a.partyA.userId === currentUser.id || a.partyB.userId === currentUser.id,
  )
  const filtered = userAgreements.filter((a) => tabFilter[tab].includes(a.status))

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-display text-2xl font-bold text-ink mb-4">Trade Agreements</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-sand-light rounded-full p-1 mb-6">
        {(['pending', 'active', 'completed'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-full transition-colors capitalize',
              tab === t ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink-2',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No agreements here"
          description="Your agreements will live here once you've confirmed a trade."
          icon={<FileCheck className="h-10 w-10" />}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((agreement) => {
            const partyA = getUserById(agreement.partyA.userId)
            const partyB = getUserById(agreement.partyB.userId)
            if (!partyA || !partyB) return null
            return (
              <Link key={agreement.id} to={`/agreements/${agreement.id}`}>
                <AgreementCard
                  agreement={agreement}
                  partyA={partyA}
                  partyB={partyB}
                  currentUserId={currentUser.id}
                />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
