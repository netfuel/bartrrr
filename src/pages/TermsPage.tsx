import { Link } from 'react-router-dom'
import { LegalShell, type LegalSection } from '@/components/layout'
import { usePageTitle } from '@/lib/utils'
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_GOVERNING_STATE,
  LEGAL_MIN_AGE,
  LEGAL_OPERATOR,
  LEGAL_VENUE,
} from '@/lib/legal'

const mail = <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>

const sections: LegalSection[] = [
  {
    id: 'agreement',
    title: 'Using Bartrrr',
    body: (
      <>
        <p>
          These terms are an agreement between you and {LEGAL_OPERATOR} ("we", "us") for using bartrrr.app. By
          creating an account or using Bartrrr, you agree to them and to our{' '}
          <Link to="/privacy">privacy policy</Link>. If you don't agree, please don't use Bartrrr.
        </p>
      </>
    ),
  },
  {
    id: 'who-can-join',
    title: 'Who can join',
    body: (
      <ul>
        <li>You're at least {LEGAL_MIN_AGE} years old.</li>
        <li>You live or spend your days in our Memphis service area.</li>
        <li>You're trading as a person, not a business.</li>
        <li>You keep one account, with accurate information about yourself.</li>
        <li>We haven't previously removed you from Bartrrr.</li>
      </ul>
    ),
  },
  {
    id: 'your-account',
    title: 'Your account',
    body: (
      <p>
        You're responsible for what happens on your account. Keep your password private, and if you sign in with
        Google or Apple, keep that account secure too. If you think someone else is using your account, email {mail}
        right away.
      </p>
    ),
  },
  {
    id: 'what-bartrrr-is',
    title: "What Bartrrr is and isn't",
    body: (
      <>
        <p>
          Bartrrr helps neighbors find each other and agree on trades. <strong>We're not part of any trade.</strong>{' '}
          We don't own, inspect or hold the items, we don't perform or check the services, and we don't verify who
          neighbors are beyond what's shown on their profile.
        </p>
        <p>
          Ratings, reviews and badges come from other neighbors. They help, but they aren't a guarantee. Use your own
          judgment about who you trade with and what you accept.
        </p>
      </>
    ),
  },
  {
    id: 'no-money',
    title: 'Trades, not sales',
    body: (
      <p>
        Bartrrr is for trading only. Don't use it to sell anything, ask for or offer money, gift cards or payment
        apps, or run a business. Listings or offers that involve payment will be taken down.
      </p>
    ),
  },
  {
    id: 'listings-and-conduct',
    title: 'Listings and conduct',
    body: (
      <>
        <p>
          Describe what you're offering honestly, including its condition and any flaws, and only list things that are
          yours to trade. Be respectful in messages. Don't:
        </p>
        <ul>
          <li>Harass, threaten, discriminate against or mislead other neighbors.</li>
          <li>Post spam, scams, or anything you don't intend to trade.</li>
          <li>Share someone else's private information or photos without permission.</li>
          <li>Try to get around our safety features, or access accounts or data that aren't yours.</li>
          <li>Use Bartrrr for anything illegal.</li>
        </ul>

        <h3>Things you can't trade</h3>
        <ul>
          <li>Weapons, ammunition, explosives and their parts.</li>
          <li>Drugs, prescription medicine, alcohol, tobacco, vapes and cannabis products.</li>
          <li>Stolen, counterfeit or recalled items.</li>
          <li>Hazardous materials.</li>
          <li>Live animals.</li>
          <li>Adult content or services.</li>
          <li>Personal documents, accounts or identities.</li>
          <li>Services that legally need a license you don't have.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'trade-agreements',
    title: 'Trade agreements',
    body: (
      <>
        <p>
          When an offer is accepted, Bartrrr creates a trade agreement so both of you have a clear record of what you
          agreed to. Signing it means you've described your side honestly and intend to follow through.
        </p>
        <p>
          A trade agreement is a voluntary record between two neighbors. {LEGAL_OPERATOR} isn't a party to it and
          doesn't enforce it. Whether it creates any legal obligation between the two of you depends on the law, not
          on Bartrrr.
        </p>
        <p>
          If plans change, tell the other neighbor as early as you can. We may show late cancellations on your
          profile so neighbors know what to expect.
        </p>
      </>
    ),
  },
  {
    id: 'safety',
    title: 'Meeting up safely',
    body: (
      <>
        <p>You're responsible for your own safety when you trade. We recommend that you:</p>
        <ul>
          <li>Meet in a public, well-lit place in daylight when you can.</li>
          <li>Bring a friend, or tell someone where you're going.</li>
          <li>Keep conversations in Bartrrr until you're comfortable.</li>
          <li>Check items before you hand yours over.</li>
          <li>Walk away from any trade that feels wrong.</li>
        </ul>
        <p>If you're ever in danger, call 911 first. Then tell us at {mail}.</p>
      </>
    ),
  },
  {
    id: 'reviews',
    title: 'Reviews',
    body: (
      <p>
        Leave reviews only for trades you actually made, and keep them honest and about the trade. Don't offer
        anything in return for a review, or review yourself. We may remove reviews that break these rules.
      </p>
    ),
  },
  {
    id: 'your-content',
    title: 'What you post',
    body: (
      <p>
        You keep ownership of what you post. By posting it, you give us permission to store, show and share it on
        Bartrrr so the service works, for example showing your listing to neighbors nearby. This permission ends when
        you delete the content or your account, except for copies already shared with neighbors in your trades. Only
        post photos and text you have the right to share.
      </p>
    ),
  },
  {
    id: 'disputes-between-neighbors',
    title: 'Problems between neighbors',
    body: (
      <p>
        If a trade goes wrong, start by talking with the other neighbor. You can also report a neighbor or listing to
        us at {mail}. We may help you communicate, and we'll act on accounts that break these terms, but we don't
        settle disputes or make up for losses between neighbors.
      </p>
    ),
  },
  {
    id: 'our-rights',
    title: 'Removing content and accounts',
    body: (
      <p>
        We may remove listings, messages or reviews, or limit, suspend or close accounts, if we believe they break
        these terms, put someone at risk, or harm Bartrrr. Where it's safe and reasonable, we'll tell you why.
      </p>
    ),
  },
  {
    id: 'leaving',
    title: 'Leaving Bartrrr',
    body: (
      <p>
        You can stop using Bartrrr whenever you like. To delete your account, choose Delete account at the bottom of
        Settings, or email {mail} from the address on your account. Deleting withdraws your open offers and cancels
        trade agreements that aren't finished, so please finish or cancel open trades first.
      </p>
    ),
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers',
    body: (
      <p>
        Bartrrr is provided "as is" and "as available". To the fullest extent the law allows, we make no promises
        about the service or about any neighbor, item or service traded through it, including that it will always be
        available, error-free, or right for your needs.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Limits on our liability',
    body: (
      <>
        <p>
          To the fullest extent the law allows, {LEGAL_OPERATOR} isn't liable for anything that happens between
          neighbors, including during a meetup, or for the condition, safety or legality of anything traded.
        </p>
        <p>
          We're also not liable for indirect or consequential losses. Because Bartrrr is free, our total liability for
          any claim about the service is limited to $100. Some places don't allow these limits, so they may not all
          apply to you.
        </p>
        <p>
          If your use of Bartrrr, or your breaking these terms, leads to a claim against us by someone else, you agree
          to cover our reasonable costs from it.
        </p>
      </>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: (
      <p>
        These terms are governed by the laws of {LEGAL_GOVERNING_STATE}. Any dispute with us will be handled in the
        state or federal courts in {LEGAL_VENUE}, unless the law where you live says otherwise. Before filing a claim,
        please email {mail} so we can try to sort it out.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        If we change these terms, we'll update the date at the top. For changes that matter, we'll tell you in the app
        or by email before they take effect. Using Bartrrr after that means you accept the new terms.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: <p>Questions about these terms go to {mail}.</p>,
  },
]

export default function TermsPage() {
  usePageTitle('Terms of use')
  return (
    <LegalShell
      eyebrow="Terms of use"
      title={<>The ground rules for <em>trading here.</em></>}
      sibling={{ to: '/privacy', label: 'Privacy policy' }}
      summary={
        <>
          <p>Bartrrr is for adults in the Memphis area trading with each other. No money, no selling.</p>
          <p>
            Be honest about what you offer, be kind in messages, and follow through on what you agree to. We're not
            part of your trades, so meet safely and use your judgment.
          </p>
          <p>We can remove content or accounts that break these rules.</p>
        </>
      }
      sections={sections}
    />
  )
}
