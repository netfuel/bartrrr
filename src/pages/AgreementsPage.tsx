import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileCheck } from 'lucide-react'
import { EmptyState, Tabs } from '@/components/ui'
import { AgreementCard } from '@/components/bartrrr'
import { useAgreementsForUser, useUsersStore } from '@/stores'
import { useAuth } from '@/providers/AuthProvider'
import { usePageTitle } from '@/lib/utils'
import type { AgreementStatus } from '@/types'

type Tab = 'pending' | 'active' | 'completed'

const emptyCopy: Record<Tab, { title: string; description: string }> = {
  pending: {
    title: 'Nothing to sign',
    description: "When you accept a trade, or a neighbor accepts yours, the trade agreement shows up here for you both to sign.",
  },
  active: {
    title: 'No swaps scheduled',
    description: "Once you've both signed an agreement, it moves here until you've met up and made the swap.",
  },
  completed: {
    title: 'No finished trades yet',
    description: 'Trades you mark as done land here, along with your reviews.',
  },
}

const tabFilter: Record<Tab, AgreementStatus[]> = {
  pending: ['draft', 'under_review', 'pending_signatures'],
  active: ['active'],
  completed: ['completed', 'cancelled', 'disputed'],
}

export default function AgreementsPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const userAgreements = useAgreementsForUser(currentUser?.id)
  const getUserById = useUsersStore((s) => s.getUserById)
  usePageTitle('Trade agreements')

  if (!currentUser) return null

  const filtered = userAgreements.filter((a) => tabFilter[tab].includes(a.status))

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-heading-page text-ink mb-4">Trade agreements</h1>

      <Tabs
        label="Agreement status"
        className="mb-6"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'pending', label: 'To sign' },
          { id: 'active', label: 'Ready to swap' },
          { id: 'completed', label: 'Done' },
        ]}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={emptyCopy[tab].title}
          description={emptyCopy[tab].description}
          actionLabel={tab === 'pending' ? 'Check your offers' : undefined}
          onAction={tab === 'pending' ? () => navigate('/offers') : undefined}
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
