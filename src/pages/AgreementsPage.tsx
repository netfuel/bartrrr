import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileCheck } from 'lucide-react'
import { EmptyState, Tabs } from '@/components/ui'
import { AgreementCard } from '@/components/bartrrr'
import { useAgreementsForUser, useUsersStore } from '@/stores'
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
  const userAgreements = useAgreementsForUser(currentUser?.id)
  const getUserById = useUsersStore((s) => s.getUserById)

  if (!currentUser) return null

  const filtered = userAgreements.filter((a) => tabFilter[tab].includes(a.status))

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-display text-2xl font-bold text-ink mb-4">Trade Agreements</h1>

      <Tabs
        label="Agreement status"
        className="mb-6"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'pending', label: 'Pending' },
          { id: 'active', label: 'Active' },
          { id: 'completed', label: 'Completed' },
        ]}
      />

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
