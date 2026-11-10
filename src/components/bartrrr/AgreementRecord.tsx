import { createPortal } from 'react-dom'
import { Wordmark } from '@/components/ui'
import {
  AGREEMENT_STATUS_LABELS,
  EXCHANGE_METHOD_LABELS,
  type TradeAgreement,
  type UserProfile,
} from '@/types'
import { exchangeTime, formatExchangeTime, formatLongDate } from '@/lib/agreements'

/** Signature time in Memphis time: "November 10, 2026 at 3:42 PM CST" */
const formatSignedAt = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
    timeZoneName: 'short',
  }).replace(/, (\d{1,2}:)/, ' at $1')

export interface AgreementRecordProps {
  agreement: TradeAgreement
  partyA: UserProfile
  partyB: UserProfile
}

/** Where the record says each neighbor's profile lives */
const profileLink = (u: UserProfile) =>
  `${window.location.host}/profile/${encodeURIComponent(u.username)}`

/**
 * The printable copy of a trade agreement (PRD 5.7: "downloadable as PDF").
 *
 * Rendered into <body> next to the app and hidden on screen. In print, the
 * `.print-record` rules in globals.css hide everything else, so the
 * browser's print window (and its Save as PDF) gets one clean paper
 * document. It's written for both neighbors, so it names each side instead
 * of "you". Only what's on the agreement and public profiles goes in: no
 * email addresses, no home addresses.
 */
export function AgreementRecord({ agreement, partyA, partyB }: AgreementRecordProps) {
  const swapAt = exchangeTime(agreement)
  const nameOf = (id?: string) =>
    id === partyA.id ? partyA.displayName : id === partyB.id ? partyB.displayName : 'A neighbor'
  const sides = [
    { role: 'Made the offer', user: partyA, side: agreement.partyA },
    { role: 'Posted the listing', user: partyB, side: agreement.partyB },
  ]

  const history: { label: string; text: string }[] = [
    { label: 'Created', text: formatLongDate(agreement.createdAt) },
  ]
  if (agreement.termsUpdatedAt) {
    history.push({
      label: 'Terms last changed',
      text: `${formatLongDate(agreement.termsUpdatedAt)}${agreement.termsUpdatedBy ? `, by ${nameOf(agreement.termsUpdatedBy)}` : ''}`,
    })
  }
  if (agreement.completedAt) {
    history.push({ label: 'Swap marked done', text: formatLongDate(agreement.completedAt) })
  }
  if (agreement.status === 'cancelled') {
    history.push({
      label: 'Canceled',
      text: [
        agreement.cancelledAt ? formatLongDate(agreement.cancelledAt) : null,
        agreement.cancelledBy ? `by ${nameOf(agreement.cancelledBy)}` : null,
        agreement.cancelledLate ? 'less than 24 hours before the swap (late cancellation)' : null,
      ].filter(Boolean).join(', ') || 'Yes',
    })
  }
  if (agreement.status === 'disputed') {
    history.push({
      label: 'Flagged for review',
      text: [
        agreement.disputedAt ? formatLongDate(agreement.disputedAt) : null,
        agreement.disputedBy ? `by ${nameOf(agreement.disputedBy)}` : null,
      ].filter(Boolean).join(', ') + (agreement.disputeReason ? `: “${agreement.disputeReason}”` : '') || 'Yes',
    })
  }

  const details: { label: string; value?: string }[] = [
    { label: 'How', value: agreement.exchangeMethod && EXCHANGE_METHOD_LABELS[agreement.exchangeMethod] },
    { label: 'When', value: swapAt ? formatExchangeTime(swapAt) : agreement.exchangeDate },
    { label: 'Where', value: agreement.exchangeLocation },
    { label: 'Notes', value: agreement.specialInstructions },
  ]

  return createPortal(
    <article className="print-record paper" data-testid="agreement-record">
      <header className="record-head">
        <div className="record-brand">
          <Wordmark className="text-[22px]" />
          <span className="record-status">{AGREEMENT_STATUS_LABELS[agreement.status]}</span>
        </div>
        <h1 className="record-title">Trade agreement</h1>
        <dl className="record-meta">
          <div><dt>Agreement</dt><dd>{agreement.id}</dd></div>
          <div><dt>Created</dt><dd>{formatLongDate(agreement.createdAt)}</dd></div>
          <div><dt>Copy saved</dt><dd>{formatLongDate(new Date().toISOString())}</dd></div>
        </dl>
      </header>

      <p className="record-note">
        This agreement is voluntary and not legally binding. It’s a shared record of what these
        two neighbors agreed to trade, so nobody has to remember the details. Bartrrr helps them
        keep track; it doesn’t enforce the deal.
      </p>

      <section className="record-section">
        <h2>The neighbors</h2>
        <div className="record-grid">
          {sides.map(({ role, user }) => (
            <div key={user.id}>
              <p className="record-label">{role}</p>
              <p className="record-name">{user.displayName}</p>
              <p className="record-small">{user.neighborhood}</p>
              <p className="record-small">{profileLink(user)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="record-section">
        <h2>The trade</h2>
        <div className="record-grid">
          {sides.map(({ user, side }) => (
            <div key={user.id}>
              <p className="record-label">{user.displayName} gives</p>
              <p className="record-item">{side.item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="record-section">
        <h2>When and where</h2>
        <dl className="record-rows">
          {details.filter((d) => d.label !== 'Notes' || d.value).map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={value ? undefined : 'record-empty'}>{value || 'Not set'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="record-section">
        <h2>What both neighbors agreed to</h2>
        <dl className="record-rows">
          <div>
            <dt>Condition</dt>
            <dd>
              Each neighbor signs by confirming: “I’ve described what I’m giving honestly,
              including its condition, and I agree to these terms.”
            </dd>
          </div>
          <div>
            <dt>Canceling</dt>
            <dd>
              Either neighbor can cancel before the swap. Canceling within 24 hours of the meetup
              counts as a late cancellation on that neighbor’s profile.
            </dd>
          </div>
          <div>
            <dt>Disputes</dt>
            <dd>
              If either neighbor thinks the terms weren’t met, they can flag the trade for review.
              Bartrrr keeps the record of what was agreed and can help them talk, but it can’t
              decide who’s right or guarantee an outcome.
            </dd>
          </div>
        </dl>
      </section>

      <section className="record-section record-keep">
        <h2>Signatures</h2>
        <div className="record-grid">
          {sides.map(({ user, side }) => (
            <div key={user.id}>
              <p className="record-signature">{side.signed ? user.displayName : ' '}</p>
              <p className="record-small">
                {user.displayName}:{' '}
                {!side.signed
                  ? 'not signed'
                  : side.signedAt
                    ? `signed ${formatSignedAt(side.signedAt)}`
                    : 'signed, time not recorded'}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="record-section record-keep">
        <h2>Status: {AGREEMENT_STATUS_LABELS[agreement.status]}</h2>
        <dl className="record-rows">
          {history.map(({ label, text }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="record-foot">
        Saved from Bartrrr, where Memphis neighbors trade goods, skills and services. No money
        changes hands.
      </footer>
    </article>,
    document.body,
  )
}
