import { Link } from 'react-router-dom'
import { LegalShell, type LegalSection } from '@/components/layout'
import { usePageTitle } from '@/lib/utils'
import { LEGAL_CONTACT_EMAIL, LEGAL_MIN_AGE, LEGAL_OPERATOR } from '@/lib/legal'

const mail = <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>

const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <>
        <p>
          {LEGAL_OPERATOR} ("we", "us") runs bartrrr.app, a place for neighbors in the Memphis area to trade goods,
          services and skills without money. This policy explains what we collect when you use Bartrrr, why, who can
          see it, and the choices you have.
        </p>
        <p>Questions about your information go to {mail}.</p>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <>
        <h3>When you create an account</h3>
        <ul>
          <li>
            <strong>With email:</strong> your name, email address and a password. Passwords are stored as a secure
            hash by our sign-in provider; we can't read them.
          </li>
          <li>
            <strong>With Google or Apple:</strong> the name, email address and profile photo that service shares
            with us. Apple may give us a private relay email instead of your real one. We never see your Google or
            Apple password.
          </li>
        </ul>

        <h3>Your profile</h3>
        <p>
          Your display name, username, neighborhood, the categories you're interested in, and anything you add
          yourself, like a bio or a photo link.
        </p>

        <h3>Your location</h3>
        <p>
          When you sign up, we ask your device for its location once, to check that you're inside our Memphis
          service area. The coordinates go to Mapbox, our map provider, to look up your ZIP code. We don't save those
          coordinates. You can type a ZIP code instead.
        </p>
        <p>
          Listings are placed on the map at the center of your neighborhood, never at your address. An exact meeting
          spot only appears if you and the other neighbor add one to your trade agreement.
        </p>

        <h3>What you post and send</h3>
        <ul>
          <li>Listings, including descriptions, condition, what you're looking for, and photo links.</li>
          <li>Offers, counter-offers and messages you exchange with neighbors.</li>
          <li>Trade agreements, including what each side gives and any exchange details you add.</li>
          <li>Reviews you leave, and reviews other neighbors leave about you.</li>
        </ul>

        <h3>Settings and notifications</h3>
        <p>
          Your notification choices, the notifications we send you, and, if you turn on browser notifications, the
          technical address your browser gives us for delivering them.
        </p>

        <h3>Technical information</h3>
        <p>
          Your browser stores a sign-in token so you stay logged in. The services that host Bartrrr keep standard
          logs, such as IP address, browser type and the time of a request, to keep the service running and secure.
        </p>
      </>
    ),
  },
  {
    id: 'how-we-use-it',
    title: 'How we use it',
    body: (
      <>
        <p>We use your information to:</p>
        <ul>
          <li>Run Bartrrr: show listings, deliver offers and messages, and keep trade agreements and reviews.</li>
          <li>Keep you signed in and your account secure.</li>
          <li>Send account emails, like sign-up confirmation and password resets.</li>
          <li>Send notifications about your offers and trades, if you have them turned on.</li>
          <li>Keep the community safe: look into reports, remove listings that break our rules, and stop abuse.</li>
          <li>Fix problems and improve how Bartrrr works.</li>
        </ul>
        <p>
          <strong>We don't sell your information, show ads, or use advertising or analytics trackers.</strong>
        </p>
      </>
    ),
  },
  {
    id: 'who-can-see-it',
    title: 'Who can see what',
    body: (
      <>
        <ul>
          <li>
            <strong>Anyone, including people who aren't signed in:</strong> your public profile (display name,
            username, photo, bio, neighborhood, interests, rating, trade count and join date), your active listings,
            and reviews.
          </li>
          <li>
            <strong>Only you and the other neighbor:</strong> offers, counter-offers and messages between you, and
            your trade agreements.
          </li>
          <li>
            <strong>Only you:</strong> your email address, notifications and settings.
          </li>
        </ul>
        <p>
          When you trade in person, the other neighbor will see you and anything you choose to share. Only share what
          you're comfortable with.
        </p>
      </>
    ),
  },
  {
    id: 'who-we-share-with',
    title: 'Services we rely on',
    body: (
      <>
        <p>
          We use a small number of companies to run Bartrrr. They handle your information on our behalf and only for
          that purpose:
        </p>
        <ul>
          <li><strong>Supabase:</strong> our database and sign-in.</li>
          <li><strong>Cloudflare:</strong> hosting and delivering the website.</li>
          <li><strong>Mapbox:</strong> maps and the ZIP code lookup at sign-up.</li>
          <li><strong>Google Fonts:</strong> the typefaces on the site, which your browser downloads from Google.</li>
          <li><strong>Google and Apple:</strong> only if you choose to sign in with them.</li>
          <li><strong>Our email provider:</strong> sending account emails.</li>
          <li><strong>Your browser's push service:</strong> delivering notifications, if you turn them on.</li>
        </ul>
        <p>
          Listing photos are links to images hosted elsewhere. When you view a listing, your browser loads its photos
          from wherever they're hosted.
        </p>
        <p>
          We'll also share information if the law requires it, or if we believe it's needed to protect someone's
          safety, to investigate fraud or abuse, or to protect Bartrrr and its neighbors.
        </p>
      </>
    ),
  },
  {
    id: 'storage',
    title: 'Cookies and browser storage',
    body: (
      <p>
        We don't use advertising or tracking cookies. Bartrrr stores a few things in your browser so it works: your
        sign-in session, where to send you after you log in, and some app data so pages load quickly. Clearing your
        browser data logs you out.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <>
        <p>
          We keep your account information for as long as your account is open. Offers, messages and agreements stay
          available to both neighbors in a trade, because they're a shared record.
        </p>
        <p>When you delete your account, we:</p>
        <ul>
          <li>Delete your sign-in details, profile photo, bio, interests, notifications and notification settings.</li>
          <li>Delete listings nobody has made an offer on, and take down and clear the rest.</li>
          <li>Withdraw your open offers and cancel trade agreements that aren't finished.</li>
          <li>
            Show "Former neighbor" in place of your name on past trades and reviews, so the other neighbor keeps their
            record.
          </li>
        </ul>
        <p>
          Messages you sent stay in the other neighbor's conversation history. Copies may stay in backups for a short
          time before they're overwritten. We may keep what's needed to prevent abuse or meet a legal duty.
        </p>
      </>
    ),
  },
  {
    id: 'your-choices',
    title: 'Your choices',
    body: (
      <ul>
        <li>
          <strong>Edit your profile</strong> any time in <Link to="/settings">Settings</Link>.
        </li>
        <li>
          <strong>Turn notifications on or off</strong> in Settings, or in your browser.
        </li>
        <li>
          <strong>Take down a listing</strong> from the listing page.
        </li>
        <li>
          <strong>Get a copy of your information, correct it, or delete your account</strong> by emailing {mail} from
          the address on your account. We'll reply within 30 days.
        </li>
      </ul>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        Bartrrr uses encrypted connections, and our database rules limit each neighbor to their own information.
        No service is perfectly secure, so use a strong password you don't use elsewhere, and tell us right away at
        {' '}{mail} if you think your account has been misused.
      </p>
    ),
  },
  {
    id: 'age',
    title: 'Age requirement',
    body: (
      <p>
        Bartrrr is for people {LEGAL_MIN_AGE} and older, because trades happen in person between neighbors. We don't
        knowingly collect information from anyone younger. If you think someone under {LEGAL_MIN_AGE} has an account,
        email {mail} and we'll remove it.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        If we change this policy, we'll update the date at the top. For changes that matter, we'll tell you in the
        app or by email before they take effect.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact us',
    body: <p>Write to {mail} with any question about your information or this policy.</p>,
  },
]

export default function PrivacyPage() {
  usePageTitle('Privacy policy')
  return (
    <LegalShell
      eyebrow="Privacy policy"
      title={<>What we keep, and <em>who sees it.</em></>}
      sibling={{ to: '/terms', label: 'Terms of use' }}
      summary={
        <>
          <p>We collect what Bartrrr needs to work: your account, your profile, and what you post and send.</p>
          <p>
            Your profile, listings and reviews are public. Offers, messages and agreements are only between you and
            the other neighbor.
          </p>
          <p>We show your neighborhood, never your address. We don't sell your information or show ads.</p>
        </>
      }
      sections={sections}
    />
  )
}
