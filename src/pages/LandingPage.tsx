import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Repeat, MapPin, Shield, Star, Handshake, ShieldCheck,
  Sparkles, MessageCircle, ChevronDown,
} from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { cn, usePageTitle } from '@/lib/utils'
import { Button } from '@/components/ui'
import { mockListings } from '@/data/mock-listings'
import { CATEGORY_LABELS } from '@/types'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// ── Photo URLs ────────────────────────────────────────────────────────────────
const PHOTOS = {
  editorial: '/photo-editorial.jpg',   // two neighbors sharing a phone
  statsBg:   '/photo-stats-bg.jpg',    // moody overhead — notebook, coffee, laptop
}
// ─────────────────────────────────────────────────────────────────────────────

const TICKER = [
  'Goods', 'Services', 'Skills & expertise', 'Outdoor & garden',
  'Memphis, TN', 'No price tags', 'Just neighbors', "Trade, don't buy",
]

const steps = [
  {
    num: '01',
    icon: <MapPin className="h-5 w-5" strokeWidth={1.5} />,
    title: 'List what you have',
    desc: "Post items, skills, or services. Add photos and say what you'd like in return.",
  },
  {
    num: '02',
    icon: <Repeat className="h-5 w-5" strokeWidth={1.5} />,
    title: 'Make an offer',
    desc: 'Spot something you like? Propose a swap, and go back and forth until it feels fair.',
  },
  {
    num: '03',
    icon: <Shield className="h-5 w-5" strokeWidth={1.5} />,
    title: 'Swap with confidence',
    desc: 'Sign a simple trade agreement, meet up, and swap. Then leave each other a review.',
  },
]

const features = [
  {
    icon: Handshake,
    title: 'No price tags',
    desc: 'Trade value for value. No haggling over dollars, no awkward money talk.',
  },
  {
    icon: ShieldCheck,
    title: 'Simple agreements',
    desc: 'Every trade gets a plain-language agreement you both sign. Everyone knows the deal.',
  },
  {
    icon: Star,
    title: 'Reputation you can trust',
    desc: 'Ratings and reviews after every trade, so you always know who you’re swapping with.',
  },
  {
    icon: MapPin,
    title: 'Local by design',
    desc: 'Memphis only. Every listing is a short drive away, and your address stays private until you agree to a trade.',
  },
  {
    icon: Sparkles,
    title: 'Smart matching',
    desc: 'Tell us what you’re looking for and we’ll point out listings that fit.',
  },
  {
    icon: MessageCircle,
    title: 'Built-in messaging',
    desc: 'Negotiate right in the offer thread. No phone numbers or emails until you’re ready.',
  },
]

const faqs = [
  {
    q: 'Is Bartrrr really free?',
    a: 'Completely. No listing fees, no commissions, no premium tier. Bartrrr exists to help Memphis neighbors trade with each other, not to take a cut.',
  },
  {
    q: 'How does a trade actually work?',
    a: 'You post what you have and what you’d like in return. A neighbor makes an offer, and you can accept it, decline it, or send a counter-offer. Once you both agree, you sign a simple trade agreement, pick a meeting spot, and swap.',
  },
  {
    q: 'Is it safe to trade with strangers?',
    a: 'Every neighbor has a public profile with ratings and reviews from past trades. Trade agreements spell out what each of you is giving, and we recommend meeting in a public place to swap.',
  },
  {
    q: 'What can I trade?',
    a: 'Goods (furniture, tools, electronics), services (lawn care, home repair), and skills (tutoring, tech help, photography). If a neighbor might want it, you can list it.',
  },
  {
    q: 'Do I have to meet in person?',
    a: 'Most trades happen in person because they’re local, but you two decide. Porch drop-offs and on-site services work too, and how you’ll swap goes in your agreement.',
  },
  {
    q: 'What if a trade goes wrong?',
    a: 'Your trade agreement is a record of what you both promised, and reviews keep everyone accountable. Agreements aren’t legal contracts, so if something feels off before you swap, you can walk away. We just ask that you tell your neighbor early.',
  },
]

// Product rules, not traction claims: every number here is true on day one.
const stats = [
  { stat: '0', value: 0, suffix: '', label: 'Dollars changing hands' },
  { stat: '72', value: 72, suffix: '', label: 'Hours to answer an offer' },
  { stat: '30', value: 30, suffix: '', label: 'Days each listing stays up' },
]

// Real inventory for the "trading right now" strip
const showcaseListings = mockListings
  .filter((l) => l.status === 'active' && l.images[0])
  .slice(0, 8)

const TESTIMONIALS = [
  {
    quote: 'I traded two hours of yard work for a stand mixer that runs better than the one I almost bought. Never opened my wallet once.',
    name: 'Dave M.', neighborhood: 'East Memphis', initials: 'DM',
    trade: 'Yard work ⇄ KitchenAid mixer',
  },
  {
    quote: "My kids outgrew everything at once. One weekend on Bartrrr and their closets are full again — and another family got the crib they needed.",
    name: 'Priya P.', neighborhood: 'Germantown', initials: 'PP',
    trade: 'Kids’ clothes ⇄ Crib',
  },
  {
    quote: "I fix bikes. My neighbor bakes bread. We've been trading for three months now and I'm never buying bread again.",
    name: 'Sam N.', neighborhood: 'Overton Square', initials: 'SN',
    trade: 'Bike repair ⇄ Sourdough',
  },
  {
    quote: "My pension doesn't stretch like it used to. Trading my sewing for fresh produce has honestly changed my month-to-month.",
    name: 'Nina R.', neighborhood: 'South Main Arts District', initials: 'NR',
    trade: 'Alterations ⇄ Garden produce',
  },
  {
    quote: 'Posted my old record player at lunch. By dinner I had guitar lessons lined up for my daughter.',
    name: 'Jamie O.', neighborhood: 'Downtown Memphis', initials: 'JO',
    trade: 'Record player ⇄ Guitar lessons',
  },
  {
    quote: "It's the neighborly Memphis I remember growing up in — just easier to find.",
    name: 'Alex C.', neighborhood: 'Cooper-Young', initials: 'AC',
    trade: null,
  },
]

export default function LandingPage() {
  const container = useRef<HTMLDivElement>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  usePageTitle()

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // ── Hero entrance ──
        gsap
          .timeline({ defaults: { ease: 'power3.out' } })
          .from('.hero-eyebrow', { y: 16, autoAlpha: 0, duration: 0.6 })
          .from('.hero-line > span', {
            yPercent: 115,
            duration: 1,
            stagger: 0.14,
            ease: 'power4.out',
          }, '-=0.3')

        // Slow hero video drift
        gsap.to('.hero-video', {
          scale: 1.06,
          ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        })

        // ── Section reveals ──
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
          gsap.from(el, {
            y: 40,
            autoAlpha: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 85%' },
          })
        })

        gsap.utils.toArray<HTMLElement>('[data-reveal-group]').forEach((group) => {
          gsap.from(group.children, {
            y: 32,
            autoAlpha: 0,
            duration: 0.7,
            stagger: 0.08,
            ease: 'power3.out',
            scrollTrigger: { trigger: group, start: 'top 85%' },
          })
        })

        // Editorial photo curtain reveal
        gsap.from('.editorial-photo', {
          clipPath: 'inset(0 100% 0 0)',
          duration: 1.1,
          ease: 'power4.inOut',
          scrollTrigger: { trigger: '.editorial-photo', start: 'top 75%' },
        })

        // ── Animated stat counters ──
        gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
          const target = parseFloat(el.dataset.count || '0')
          const suffix = el.dataset.suffix || ''
          const decimals = target % 1 !== 0 ? 1 : 0
          const counter = { n: 0 }
          gsap.to(counter, {
            n: target,
            duration: 1.6,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 88%' },
            onUpdate: () => {
              el.textContent =
                counter.n.toLocaleString('en-US', {
                  minimumFractionDigits: decimals,
                  maximumFractionDigits: decimals,
                }) + suffix
            },
          })
        })
      })
    },
    { scope: container },
  )

  return (
    <div ref={container} className="min-h-screen overflow-x-hidden bg-cream text-ink">

      {/* ── Top bar: typography + one hairline, nothing else ── */}
      <nav className="flex items-center justify-between gap-4 border-b border-ink px-5 py-4 lg:px-8">
        <a href="#top" className="text-[18px] font-medium lowercase tracking-tight">
          bartrrr
        </a>
        <div className="hidden md:flex items-center gap-7">
          <a href="#listings" className="text-label hover:opacity-60 transition-opacity">Listings</a>
          <a href="#how" className="text-label hover:opacity-60 transition-opacity">How it works</a>
          <a href="#faq" className="text-label hover:opacity-60 transition-opacity">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/auth/login"
            className="pressable text-label rounded-full border border-ink px-5 py-2 hover:bg-ink hover:text-cream transition-colors"
          >
            Log in
          </Link>
          <Link
            to="/auth/signup"
            className="pressable text-label bg-ink px-6 py-2.5 text-cream hover:bg-ink-2 transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero: the photograph is the page ── */}
      <section id="top" className="hero relative h-[82vh] overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/homes-poster.jpg"
          className="hero-video absolute inset-0 h-full w-full object-cover"
        >
          <source src="/homes.mp4" type="video/mp4" />
        </video>
        {/* Minimal legibility scrim, bottom third only */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink/50 to-transparent" />

        <div className="absolute bottom-8 left-5 lg:left-8 z-10 text-cream">
          <p className="hero-eyebrow text-label mb-3 opacity-90">Memphis, Tennessee</p>
          <h1 className="text-display">
            <span className="hero-line block overflow-hidden"><span className="block">Trade,</span></span>
            <span className="hero-line block overflow-hidden"><span className="block">don't buy.</span></span>
          </h1>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="border-b border-ink">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-5 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p className="max-w-[50ch] text-[20px] leading-[1.4] tracking-[-0.004em] text-ink-2">
            Swap goods, skills, and services with your Memphis neighbors. No cash,
            no awkward money talk, just a fair trade.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/auth/signup">
              <Button variant="primary" size="lg" className="text-label px-8">Start trading</Button>
            </Link>
            <Link to="/browse">
              <Button variant="outline" size="lg" className="text-label px-8">See live listings</Button>
            </Link>
          </div>
        </div>
        <p className="mx-auto max-w-[1400px] px-5 pb-8 lg:px-8 text-label text-muted">
          Memphis only &nbsp;·&nbsp; Free to use &nbsp;·&nbsp; No cash, ever
        </p>
      </section>

      {/* ── Ticker ── */}
      <div className="select-none overflow-hidden border-b border-ink py-3">
        <div className="flex whitespace-nowrap animate-ticker">
          {[...TICKER, ...TICKER].map((item, i) => (
            <span key={i} className="text-label px-6 text-ink">
              {item} <span className="mx-2 opacity-40">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Trading right now: real inventory strip ── */}
      <section id="listings" className="scroll-mt-8 border-b border-ink py-20 overflow-hidden">
        <div data-reveal className="mx-auto max-w-[1400px] px-5 lg:px-8">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-label mb-4 text-muted">Live in Memphis</p>
              <h2 className="text-heading-editorial">Trading<br />right now</h2>
            </div>
            <Link to="/browse" className="text-label underline underline-offset-4 hover:opacity-60 transition-opacity shrink-0">
              Browse all →
            </Link>
          </div>
        </div>
        <div
          data-reveal-group
          className="no-scrollbar flex snap-x gap-5 overflow-x-auto px-5 lg:px-[max(2rem,calc((100vw-1400px)/2+2rem))]"
        >
          {showcaseListings.map((l) => (
            <Link
              key={l.id}
              to="/browse"
              className="group w-[280px] shrink-0 snap-start border border-ink"
            >
              <div className="relative aspect-[4/3] overflow-hidden border-b border-ink">
                <img
                  src={l.images[0]}
                  alt={l.title}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.04]"
                />
              </div>
              <div className="p-5">
                <p className="text-label mb-2 text-muted">{CATEGORY_LABELS[l.category]} · {l.location.neighborhood}</p>
                <h3 className="truncate text-[20px] font-medium tracking-tight">{l.title}</h3>
                <div className="mt-4 border-t border-ink pt-3">
                  <p className="text-label mb-1">Looking for</p>
                  <p className="line-clamp-2 text-[14px] leading-snug text-muted">{l.seeking}</p>
                </div>
              </div>
            </Link>
          ))}
          {/* End cap */}
          <Link
            to="/auth/signup"
            className="pressable flex w-[280px] shrink-0 snap-start flex-col items-start justify-end gap-3 border border-ink p-5 hover:bg-ink hover:text-cream transition-colors"
          >
            <span className="text-display !text-[64px] leading-none">→</span>
            <span className="text-[20px] font-medium tracking-tight">Your listing here</span>
            <span className="text-label opacity-60">Post something. Get offers.</span>
          </Link>
        </div>
      </section>

      {/* ── Editorial statement ── */}
      <section className="border-b border-ink">
        <div data-reveal className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8">
          <p className="text-label mb-8 text-muted">Why Bartrrr</p>
          <h2 className="text-heading-editorial max-w-[24ch]">
            Your neighbor has exactly what you need.
          </h2>
          <div className="mt-14 grid gap-8 lg:grid-cols-2">
            <p className="text-label lg:text-right lg:pr-16">From handyman help to homemade meals</p>
            <p className="max-w-[50ch] text-[18px] leading-[1.5] text-ink-2">
              Memphis neighbors already trade favors every day. Bartrrr gives it a home:
              a place to list what you have, find what you need, and agree on a fair swap
              without a dollar changing hands.
            </p>
          </div>
        </div>
        <div className="editorial-photo relative h-[60vh] overflow-hidden border-t border-ink">
          <img
            src={PHOTOS.editorial}
            alt="Two neighbors looking at a phone together"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="scroll-mt-8 border-b border-ink">
        <div className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8">
          <div data-reveal className="mb-16 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-label mb-4 text-muted">Simple by design</p>
              <h2 className="text-heading-editorial">How it works</h2>
            </div>
            <Link to="/browse" className="text-label underline underline-offset-4 hover:opacity-60 transition-opacity shrink-0">
              See live listings →
            </Link>
          </div>

          <div data-reveal-group className="grid border-t border-l border-ink sm:grid-cols-3">
            {steps.map((step) => (
              <div key={step.num} className="flex flex-col gap-6 border-b border-r border-ink p-8 lg:p-10">
                <span className="text-[60px] font-normal leading-none tracking-[-0.056em]">{step.num}</span>
                <div className="text-ink">{step.icon}</div>
                <h3 className="text-[20px] font-medium tracking-tight">{step.title}</h3>
                <p className="text-[18px] leading-[1.5] text-ink-2">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features: hairline grid ── */}
      <section className="border-b border-ink">
        <div className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8">
          <div data-reveal className="mb-16">
            <p className="text-label mb-4 text-muted">Everything you need</p>
            <h2 className="text-heading-editorial">Built for<br />fair trades</h2>
          </div>

          <div data-reveal-group className="grid border-t border-l border-ink sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group border-b border-r border-ink p-8 transition-colors duration-300 hover:bg-sand-light">
                <Icon className="mb-6 h-5 w-5" strokeWidth={1.5} />
                <h3 className="mb-3 text-[20px] font-medium tracking-tight">{title}</h3>
                <p className="text-[18px] leading-[1.5] text-ink-2">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Neighbors are talking ── */}
      <section className="border-b border-ink">
        <div className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8">
          <div data-reveal className="mb-16">
            <p className="text-label mb-4 text-muted">Trades like these</p>
            <h2 className="text-heading-editorial">What a swap<br />can look like</h2>
          </div>

          <div data-reveal-group className="columns-1 gap-5 sm:columns-2 lg:columns-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="mb-5 break-inside-avoid border border-ink p-6">
                <blockquote className="text-[18px] leading-[1.5] text-ink-2">“{t.quote}”</blockquote>
                {t.trade && (
                  <p className="text-label mt-4 inline-block rounded-full border border-ink px-4 py-1.5">
                    {t.trade}
                  </p>
                )}
                <figcaption className="mt-5 flex items-center gap-3 border-t border-ink pt-4">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-ink text-[12px] font-medium"
                  >
                    {t.initials}
                  </span>
                  <span>
                    <span className="block text-[14px] font-medium">{t.name}</span>
                    <span className="text-label block text-muted">{t.neighborhood}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats over photograph ── */}
      <section className="relative border-b border-ink py-28">
        <img src={PHOTOS.statsBg} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-ink/60" />
        <div className="relative z-10 mx-auto max-w-[1400px] px-5 lg:px-8 text-cream">
          <p data-reveal className="text-label mb-14 opacity-80">Fair by design</p>
          <div data-reveal-group className="grid gap-10 sm:grid-cols-3">
            {stats.map((item) => (
              <div key={item.label}>
                <p
                  data-count={item.value}
                  data-suffix={item.suffix}
                  className="text-[clamp(3.5rem,8vw,7.5rem)] font-normal leading-none tracking-[-0.056em]"
                >
                  {item.stat}
                </p>
                <p className="text-label mt-4 opacity-80">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="scroll-mt-8 border-b border-ink">
        <div className="mx-auto max-w-[1400px] px-5 py-24 lg:px-8">
          <div data-reveal className="mb-16">
            <p className="text-label mb-4 text-muted">Good questions</p>
            <h2 className="text-heading-editorial">Before you ask</h2>
          </div>

          <div data-reveal-group className="border-t border-ink">
            {faqs.map(({ q, a }, i) => {
              const open = openFaq === i
              return (
                <div key={q} className="border-b border-ink">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left"
                  >
                    <span className="text-[20px] font-medium tracking-tight">{q}</span>
                    <ChevronDown
                      strokeWidth={1.5}
                      className={cn('h-5 w-5 shrink-0 transition-transform duration-300 ease-out-soft', open && 'rotate-180')}
                    />
                  </button>
                  <div
                    className={cn(
                      'grid transition-[grid-template-rows] duration-300 ease-out-soft',
                      open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="max-w-[60ch] pb-8 text-[18px] leading-[1.5] text-ink-2">{a}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Final statement + CTA ── */}
      <section className="border-b border-ink">
        <div data-reveal className="mx-auto max-w-[1400px] px-5 py-28 lg:px-8">
          <p className="text-label mb-6 text-muted">Memphis neighbors</p>
          <h2 className="text-display mb-12">Ready<br />to swap?</h2>
          <div className="flex flex-wrap items-center gap-6">
            <Link to="/auth/signup">
              <Button variant="primary" size="lg" className="text-label px-10">Get started</Button>
            </Link>
            <p className="text-label text-muted">Free to use · No cash, ever</p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-6 px-5 py-10 sm:flex-row sm:items-center lg:px-8">
        <span className="text-[18px] font-medium lowercase tracking-tight">bartrrr</span>
        <div className="flex items-center gap-7">
          <Link to="/browse" className="text-label hover:opacity-60 transition-opacity">Browse</Link>
          <Link to="/auth/signup" className="text-label hover:opacity-60 transition-opacity">Sign up</Link>
          <Link to="/auth/login" className="text-label hover:opacity-60 transition-opacity">Log in</Link>
        </div>
        <p className="text-label text-muted">
          Trade, don't buy · © {new Date().getFullYear()}
        </p>
      </footer>

    </div>
  )
}
