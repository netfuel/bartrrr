import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Repeat, MapPin, Shield, Star, Handshake, ShieldCheck,
  Sparkles, MessageCircle,
} from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { cn } from '@/lib/utils'
import { buttonStyles, Wordmark } from '@/components/ui'
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
  'Goods', 'Services', 'Skills & Expertise', 'Outdoor & Garden',
  'Memphis, TN', 'No price tags', 'Just neighbors', "Trade, don't buy",
]

const steps = [
  {
    num: '01',
    icon: <MapPin className="h-[18px] w-[18px]" strokeWidth={1.5} />,
    title: 'List what you have',
    desc: "Post items, skills, or services. Add photos and say what you'd like in return.",
  },
  {
    num: '02',
    icon: <Repeat className="h-[18px] w-[18px]" strokeWidth={1.5} />,
    title: 'Make an offer',
    desc: 'Spot something you like? Propose a swap. Negotiate until the deal feels right.',
  },
  {
    num: '03',
    icon: <Shield className="h-[18px] w-[18px]" strokeWidth={1.5} />,
    title: 'Swap with confidence',
    desc: 'Sign a trade agreement, meet up, exchange. Rate your neighbor afterward.',
  },
]

const features = [
  {
    icon: Handshake,
    title: 'No price tags',
    desc: 'Trade value for value. No haggling over dollars, no awkward pricing conversations.',
  },
  {
    icon: ShieldCheck,
    title: 'Simple agreements',
    desc: 'Every trade gets a plain-English agreement both sides sign. Everyone knows the deal.',
  },
  {
    icon: Star,
    title: 'Reputation you can trust',
    desc: 'Ratings and reviews after every trade, so you always know who you’re swapping with.',
  },
  {
    icon: MapPin,
    title: 'Hyper-local by design',
    desc: 'Memphis only. Every listing is a short drive away — most are in your neighborhood.',
  },
  {
    icon: Sparkles,
    title: 'Smart matching',
    desc: 'Tell us what you’re looking for and we’ll surface listings that fit, automatically.',
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
    a: 'You post what you have and what you’re looking for. A neighbor makes an offer, you can accept it, decline it, or suggest a change. Once you both agree, you sign a simple agreement, pick a meeting spot, and swap.',
  },
  {
    q: 'Is it safe to trade with strangers?',
    a: 'Every trader has a public profile with ratings and reviews from past trades. Trade agreements document what both sides committed to, and we recommend meeting in public places for exchanges.',
  },
  {
    q: 'What can I trade?',
    a: 'Goods (furniture, tools, electronics), services (lawn care, home repair), and skills (tutoring, tech help, photography). If a neighbor might want it, you can list it.',
  },
  {
    q: 'Do I have to meet in person?',
    a: 'Most trades happen in person because they’re local, but you and your trading partner choose — porch drop-offs and on-site services work too. The exchange method is part of your agreement.',
  },
  {
    q: 'What if a trade goes wrong?',
    a: 'Your signed agreement documents what was promised, and the review system holds everyone accountable. If something feels off before you swap, you can decline or walk away at any point — nothing is binding until you exchange.',
  },
]

const stats = [
  { stat: '1,200+', value: 1200, suffix: '+', label: 'Trades completed' },
  { stat: '4.8', value: 4.8, suffix: '', label: 'Average rating' },
  { stat: '47', value: 47, suffix: '', label: 'Neighborhoods active' },
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

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      // Reduced motion: hold the hero on its poster frame
      mm.add('(prefers-reduced-motion: reduce)', () => {
        container.current?.querySelector<HTMLVideoElement>('.hero-video')?.pause()
      })
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

        // Editorial photo: curtain reveal, then a slow parallax drift
        gsap.from('.editorial-photo', {
          clipPath: 'inset(0 100% 0 0)',
          duration: 1.2,
          ease: 'power4.inOut',
          scrollTrigger: { trigger: '.editorial-photo', start: 'top 75%' },
        })
        gsap.fromTo('.editorial-img', { yPercent: -8 }, {
          yPercent: 0,
          ease: 'none',
          scrollTrigger: { trigger: '.editorial-photo', start: 'top bottom', end: 'bottom top', scrub: true },
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
    <div ref={container} className="min-h-screen overflow-x-clip bg-cream text-ink">

      {/* ── Top bar: wordmark, three labels, two controls, one hairline ── */}
      <nav className="sticky top-0 z-40 border-b border-ink bg-cream/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-3.5 lg:px-8">
          <a href="#top" aria-label="Bartrrr home" className="-my-1 py-1">
            <Wordmark />
          </a>
          <div className="hidden md:flex items-center gap-8">
            <a href="#listings" className="text-label link-underline">En stock</a>
            <a href="#how" className="text-label link-underline">How it works</a>
            <a href="#faq" className="text-label link-underline">FAQ</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/auth/login"
              className="pressable text-label inline-flex min-h-[40px] items-center rounded-full border border-ink px-4 sm:px-5 hover:bg-ink hover:text-cream transition-colors duration-300"
            >
              Log in
            </Link>
            <Link
              to="/auth/signup"
              className="pressable text-label inline-flex min-h-[40px] items-center border border-ink bg-ink px-4 sm:px-6 text-cream hover:border-clay-dark hover:bg-clay-dark transition-colors duration-300"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero: the photograph is the page ── */}
      <section id="top" className="hero relative h-[86svh] min-h-[540px] overflow-hidden bg-ink">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/homes-poster.jpg"
          aria-hidden="true"
          className="hero-video photo-warm absolute inset-0 h-full w-full object-cover"
        >
          <source src="/homes.mp4" type="video/mp4" />
        </video>
        {/* Legibility scrim: warm walnut, bottom-weighted, never a flat grey */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/15 to-ink/5" />

        <div className="absolute inset-x-0 bottom-0 z-10">
          <div className="mx-auto max-w-[1400px] px-5 pb-8 sm:pb-12 lg:px-8 text-cream">
            <p className="hero-eyebrow text-label mb-5 flex items-center gap-3 text-cream/90">
              <span aria-hidden="true" className="h-px w-8 bg-cream/70" />
              Memphis, Tennessee
            </p>
            <h1 className="text-display">
              <span className="hero-line -mb-[0.12em] block overflow-hidden pb-[0.12em]"><span className="block">Trade,</span></span>
              <span className="hero-line -mb-[0.2em] block overflow-hidden pb-[0.2em]"><em className="block pr-[0.05em]">don't buy.</em></span>
            </h1>
          </div>
        </div>
      </section>

      {/* ── CTA band ── */}
      <section className="border-b border-ink">
        <div className="mx-auto grid max-w-[1400px] gap-8 px-5 py-10 sm:py-14 lg:grid-cols-12 lg:items-end lg:gap-10 lg:px-8">
          <div className="lg:col-span-7">
            <p className="max-w-[34ch] font-display text-[clamp(1.5rem,2.6vw,2.125rem)] font-normal leading-[1.2] tracking-[-0.015em] text-ink">
              Swap goods, skills, and services with your Memphis neighbors — no cash,
              no awkward pricing, just fair exchange.
            </p>
            <p className="text-label mt-6 text-muted">
              1,200+ trades &nbsp;·&nbsp; 4.8 average rating &nbsp;·&nbsp; Free forever
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:col-span-5 lg:justify-end">
            <Link to="/auth/signup" className={buttonStyles({ variant: 'primary', size: 'lg', className: 'text-label w-full px-8 sm:w-auto' })}>
              Start trading free
            </Link>
            <Link to="/browse" className={buttonStyles({ variant: 'outline', size: 'lg', className: 'text-label w-full px-8 sm:w-auto' })}>
              See live listings
            </Link>
          </div>
        </div>
      </section>

      {/* ── Ticker ── */}
      <div aria-hidden="true" className="ticker select-none overflow-hidden border-b border-ink bg-paper py-4">
        <div className="flex w-max whitespace-nowrap animate-ticker">
          {[...TICKER, ...TICKER].map((item, i) => (
            <span key={i} className="flex items-center font-display text-[22px] italic leading-none tracking-[-0.01em] text-ink sm:text-[26px]">
              <span className="px-6 sm:px-8">{item}</span>
              <span className="text-clay text-[16px] not-italic">✳</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Trading right now: real inventory strip ── */}
      <section id="listings" className="scroll-mt-16 border-b border-ink py-20 sm:py-28 overflow-hidden">
        <div data-reveal className="mx-auto max-w-[1400px] px-5 lg:px-8">
          <div className="mb-10 sm:mb-14 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow mb-6">En stock — live in Memphis</p>
              <h2 className="text-heading-editorial">Trading<br />right now</h2>
            </div>
            <Link to="/browse" className="text-label link-underline shrink-0 self-start sm:self-auto">
              Browse all →
            </Link>
          </div>
        </div>
        <div
          data-reveal-group
          className="no-scrollbar flex snap-x snap-mandatory gap-4 sm:gap-5 overflow-x-auto px-5 pb-2 scroll-px-5 lg:scroll-px-8 lg:px-[max(2rem,calc((100vw-1400px)/2+2rem))]"
        >
          {showcaseListings.map((l, i) => (
            <Link
              key={l.id}
              to="/browse"
              className="group flex w-[78vw] max-w-[300px] shrink-0 snap-start flex-col border border-ink bg-paper transition-colors duration-500 hover:bg-sand-light sm:w-[300px]"
            >
              <div className="relative aspect-[4/5] overflow-hidden border-b border-ink bg-sand-light">
                <img
                  src={l.images[0]}
                  alt={l.title}
                  loading="lazy"
                  decoding="async"
                  className="photo-warm h-full w-full object-cover transition-transform duration-[1200ms] ease-out-soft group-hover:scale-[1.05]"
                />
                <span aria-hidden="true" className="absolute left-3 top-3 font-display text-[15px] italic text-cream mix-blend-difference">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-label mb-2.5 truncate text-muted">{CATEGORY_LABELS[l.category]} · {l.location.neighborhood}</p>
                <h3 className="truncate font-display text-[22px] font-normal leading-tight tracking-[-0.015em]">{l.title}</h3>
                <div className="mt-auto pt-5">
                  <div className="border-t border-ink/30 pt-3">
                    <p className="text-label mb-1.5 text-clay">Looking for</p>
                    <p className="line-clamp-2 text-[14px] leading-snug text-ink-2">{l.seeking}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          {/* End cap */}
          <Link
            to="/auth/signup"
            className="group pressable flex w-[78vw] max-w-[300px] shrink-0 snap-start flex-col items-start justify-between gap-3 border border-ink bg-ink p-6 text-cream transition-colors duration-500 hover:bg-clay-dark sm:w-[300px]"
          >
            <span className="font-display text-[88px] font-light leading-none transition-transform duration-500 ease-out-soft group-hover:translate-x-2">→</span>
            <span>
              <span className="block font-display text-[28px] font-normal italic leading-tight tracking-[-0.015em]">Your listing here</span>
              <span className="text-label mt-3 block text-cream/70">Post something. See offers.</span>
            </span>
          </Link>
          <span aria-hidden="true" className="w-px shrink-0" />
        </div>
      </section>

      {/* ── Editorial statement ── */}
      <section className="border-b border-ink">
        <div data-reveal className="mx-auto max-w-[1400px] px-5 py-20 sm:py-28 lg:px-8">
          <p className="eyebrow mb-8">Why Bartrrr</p>
          <h2 className="text-heading-editorial max-w-[18ch]">
            Your neighbor has exactly what you need.
          </h2>
          <div className="mt-12 sm:mt-16 grid gap-6 border-t border-ink pt-8 lg:grid-cols-12 lg:gap-10">
            <p className="text-label text-clay lg:col-span-4">From handyman help to homemade meals</p>
            <p className="max-w-[46ch] text-[19px] leading-[1.55] text-ink-2 lg:col-span-6 lg:col-start-6">
              Memphis neighbors are already trading every day. Bartrrr makes it official —
              a place to list what you have, find what you need, and agree on a fair swap
              without a dollar changing hands.
            </p>
          </div>
        </div>
        <div className="editorial-photo relative h-[52svh] min-h-[320px] overflow-hidden border-t border-ink sm:h-[72vh]">
          <img
            src={PHOTOS.editorial}
            alt="Neighbors exchanging"
            loading="lazy"
            decoding="async"
            className="editorial-img photo-warm absolute inset-0 h-[115%] w-full object-cover object-[50%_40%]"
          />
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="scroll-mt-16 border-b border-ink">
        <div className="mx-auto max-w-[1400px] px-5 py-20 sm:py-28 lg:px-8">
          <div data-reveal className="mb-12 sm:mb-16 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow mb-6">Simple by design</p>
              <h2 className="text-heading-editorial">How it works</h2>
            </div>
            <Link to="/browse" className="text-label link-underline shrink-0 self-start sm:self-auto">
              See live listings →
            </Link>
          </div>

          <ol data-reveal-group className="grid border-t border-l border-ink md:grid-cols-3">
            {steps.map((step) => (
              <li key={step.num} className="group flex flex-col border-b border-r border-ink p-7 sm:p-8 lg:p-10 transition-colors duration-500 hover:bg-paper">
                <div className="mb-14 flex items-start justify-between sm:mb-20">
                  <span className="font-display text-[clamp(4rem,7vw,6rem)] font-light italic leading-[0.8] tracking-[-0.04em] text-clay">{step.num}</span>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-ink text-ink transition-colors duration-500 group-hover:bg-ink group-hover:text-cream">{step.icon}</span>
                </div>
                <h3 className="font-display text-[26px] font-normal leading-tight tracking-[-0.015em]">{step.title}</h3>
                <p className="mt-3 max-w-[34ch] text-[17px] leading-[1.55] text-ink-2">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Features: hairline grid ── */}
      <section className="border-b border-ink bg-paper">
        <div className="mx-auto max-w-[1400px] px-5 py-20 sm:py-28 lg:px-8">
          <div data-reveal className="mb-12 sm:mb-16 grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <p className="eyebrow mb-6">Everything you need</p>
              <h2 className="text-heading-editorial">Built for<br />fair trades</h2>
            </div>
          </div>

          <div data-reveal-group className="grid border-t border-l border-ink sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group border-b border-r border-ink p-7 sm:p-8 transition-colors duration-500 hover:bg-sand-light">
                <Icon className="mb-10 h-6 w-6 text-clay transition-transform duration-500 ease-out-soft group-hover:-translate-y-0.5" strokeWidth={1.25} />
                <h3 className="mb-2.5 font-display text-[24px] font-normal leading-tight tracking-[-0.015em]">{title}</h3>
                <p className="max-w-[36ch] text-[17px] leading-[1.55] text-ink-2">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Neighbors are talking ── */}
      <section className="border-b border-ink">
        <div className="mx-auto max-w-[1400px] px-5 py-20 sm:py-28 lg:px-8">
          <div data-reveal className="mb-12 sm:mb-16">
            <p className="eyebrow mb-6">Neighbors are talking</p>
            <h2 className="text-heading-editorial">Real trades,<br />real people</h2>
          </div>

          <div data-reveal-group className="columns-1 gap-5 sm:columns-2 lg:columns-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="mb-5 break-inside-avoid border border-ink bg-paper p-7">
                <span aria-hidden="true" className="-mb-3 block font-display text-[64px] leading-none text-clay">“</span>
                <blockquote className="font-display text-[21px] font-normal leading-[1.38] tracking-[-0.01em] text-ink">{t.quote}</blockquote>
                {t.trade && (
                  <p className="text-label mt-6 inline-flex items-center rounded-full border border-ink/40 px-3.5 py-1.5 text-ink-2">
                    {t.trade}
                  </p>
                )}
                <figcaption className="mt-6 flex items-center gap-3 border-t border-ink/30 pt-5">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-sand-light font-display text-[14px] italic text-ink"
                  >
                    {t.initials}
                  </span>
                  <span>
                    <span className="block text-[15px] font-medium">{t.name}</span>
                    <span className="text-label block text-muted">{t.neighborhood}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats over photograph ── */}
      <section className="relative overflow-hidden border-b border-ink py-24 sm:py-36">
        <img src={PHOTOS.statsBg} alt="" loading="lazy" decoding="async" className="photo-warm absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/65 to-ink/45" />
        <div className="relative z-10 mx-auto max-w-[1400px] px-5 lg:px-8 text-cream">
          <p data-reveal className="text-label mb-12 sm:mb-16 flex items-center gap-3 text-cream/85">
            <span aria-hidden="true" className="h-px w-5 bg-clay-mid" />
            Growing every day
          </p>
          <div data-reveal-group className="grid gap-12 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-cream/25">
            {stats.map((item) => (
              <div key={item.label} className="sm:px-8 sm:first:pl-0">
                <p
                  data-count={item.value}
                  data-suffix={item.suffix}
                  className="text-numeral text-[clamp(4rem,9vw,8.5rem)]"
                >
                  {item.stat}
                </p>
                <p className="text-label mt-5 text-cream/85">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="scroll-mt-16 border-b border-ink">
        <div className="mx-auto grid max-w-[1400px] gap-12 px-5 py-20 sm:py-28 lg:grid-cols-12 lg:gap-10 lg:px-8">
          <div data-reveal className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <p className="eyebrow mb-6">Good questions</p>
              <h2 className="text-heading-editorial">Before you ask</h2>
            </div>
          </div>

          <div data-reveal-group className="border-t border-ink lg:col-span-8">
            {faqs.map(({ q, a }, i) => {
              const open = openFaq === i
              return (
                <div key={q} className="border-b border-ink">
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`faq-${i}`}
                    id={`faq-q-${i}`}
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="group flex w-full items-baseline gap-5 py-6 text-left sm:gap-8 sm:py-7"
                  >
                    <span aria-hidden="true" className="w-6 shrink-0 font-display text-[15px] italic text-clay">{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex-1 font-display text-[22px] font-normal leading-snug tracking-[-0.012em] transition-colors group-hover:text-clay-dark sm:text-[26px]">{q}</span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'relative h-4 w-4 shrink-0 self-center transition-transform duration-500 ease-out-soft',
                        open && 'rotate-45',
                      )}
                    >
                      <span className="absolute left-0 top-1/2 h-px w-4 -translate-y-1/2 bg-ink" />
                      <span className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-ink" />
                    </span>
                  </button>
                  <div
                    id={`faq-${i}`}
                    role="region"
                    aria-labelledby={`faq-q-${i}`}
                    className={cn(
                      'grid transition-[grid-template-rows] duration-500 ease-out-soft',
                      open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="max-w-[58ch] pb-8 pl-11 text-[17px] leading-[1.6] text-ink-2 sm:pl-14">{a}</p>
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
        <div className="grid lg:grid-cols-12">
          <div data-reveal className="px-5 py-20 sm:py-28 lg:col-span-7 lg:pr-8 lg:pl-[max(2rem,calc((100vw-1400px)/2+2rem))]">
            <p className="eyebrow mb-8">Memphis neighbors</p>
            <h2 className="text-display mb-14">Ready<br /><em>to swap?</em></h2>
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
              <Link to="/auth/signup" className={buttonStyles({ variant: 'primary', size: 'lg', className: 'text-label w-full px-10 sm:w-auto' })}>
                Get started — it's free
              </Link>
              <p className="text-label text-muted">Free forever · No credit card</p>
            </div>
          </div>
          <div className="relative min-h-[320px] border-t border-ink lg:col-span-5 lg:border-l lg:border-t-0">
            <img
              src="/photo-community.jpg"
              alt=""
              loading="lazy"
              decoding="async"
              className="photo-warm absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-8 px-5 py-12 sm:flex-row sm:items-center lg:px-8">
        <Wordmark className="text-[28px]" />
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Link to="/browse" className="text-label link-underline">Browse</Link>
          <Link to="/auth/signup" className="text-label link-underline">Sign up</Link>
          <Link to="/auth/login" className="text-label link-underline">Log in</Link>
        </div>
        <p className="text-label text-muted">
          Trade, don't buy · © {new Date().getFullYear()}
        </p>
      </footer>

    </div>
  )
}
