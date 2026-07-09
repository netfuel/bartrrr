import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Repeat, MapPin, Shield, Star, Handshake, ShieldCheck,
  Sparkles, MessageCircle, ChevronDown, Check,
} from 'lucide-react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui'

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
    icon: <MapPin className="h-5 w-5" />,
    title: 'List what you have',
    desc: "Post items, skills, or services. Add photos and say what you'd like in return.",
  },
  {
    num: '02',
    icon: <Repeat className="h-5 w-5" />,
    title: 'Make an offer',
    desc: 'Spot something you like? Propose a swap. Negotiate until the deal feels right.',
  },
  {
    num: '03',
    icon: <Shield className="h-5 w-5" />,
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
  { stat: '4.8 ★', value: 4.8, suffix: ' ★', label: 'Average rating' },
  { stat: '47', value: 47, suffix: '', label: 'Neighborhoods active' },
]

// Social-proof avatar cluster (initials, brand tones)
const proofAvatars = [
  { initials: 'JO', bg: '#C05A35' },
  { initials: 'MS', bg: '#2A5240' },
  { initials: 'AC', bg: '#C88A2A' },
  { initials: 'PP', bg: '#3AABA6' },
]

export default function LandingPage() {
  const container = useRef<HTMLDivElement>(null)
  const [navSolid, setNavSolid] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  useGSAP(
    () => {
      // Nav turns solid once the hero is mostly scrolled past
      ScrollTrigger.create({
        start: 'top -72',
        onUpdate: (self) => setNavSolid(self.progress > 0 || self.scroll() > 72),
        onToggle: (self) => setNavSolid(self.isActive),
      })

      const mm = gsap.matchMedia()
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // ── Hero entrance ──
        gsap
          .timeline({ defaults: { ease: 'power3.out' } })
          .from('.hero-badge', { y: 24, autoAlpha: 0, duration: 0.6 })
          .from('.hero-line > span', {
            yPercent: 115,
            duration: 0.9,
            stagger: 0.12,
            ease: 'power4.out',
          }, '-=0.3')
          .from('.hero-sub', { y: 24, autoAlpha: 0, duration: 0.6 }, '-=0.45')
          .from('.hero-cta', { y: 20, autoAlpha: 0, duration: 0.5, stagger: 0.08 }, '-=0.35')
          .from('.hero-proof', { y: 16, autoAlpha: 0, duration: 0.6 }, '-=0.2')

        // Slow hero video drift
        gsap.to('.hero-video', {
          scale: 1.08,
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

        // Staggered grids (how-it-works steps, feature cards, FAQ items)
        gsap.utils.toArray<HTMLElement>('[data-reveal-group]').forEach((group) => {
          gsap.from(group.children, {
            y: 36,
            autoAlpha: 0,
            duration: 0.7,
            stagger: 0.1,
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
    <div ref={container} className="min-h-screen overflow-x-hidden">

      {/* ── Sticky nav ── */}
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 transition-all duration-300',
          navSolid
            ? 'bg-cream/95 backdrop-blur-md border-b border-sand-light shadow-soft'
            : 'bg-transparent border-b border-transparent',
        )}
      >
        <a href="#top" className={cn('font-display text-2xl font-bold transition-colors duration-300', navSolid ? 'text-clay' : 'text-white')}>
          Bartrrr
        </a>
        <div className={cn('hidden md:flex items-center gap-8 text-[15px] font-medium transition-colors duration-300', navSolid ? 'text-ink-2' : 'text-white/80')}>
          <a href="#how" className="hover:opacity-70 transition-opacity">How it works</a>
          <a href="#features" className="hover:opacity-70 transition-opacity">Features</a>
          <a href="#faq" className="hover:opacity-70 transition-opacity">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/auth/login">
            <Button variant="ghost" size="sm" className={cn('transition-colors duration-300', !navSolid && 'text-white hover:bg-white/10')}>
              Log in
            </Button>
          </Link>
          <Link to="/auth/signup">
            <Button variant="primary" size="sm">Get started</Button>
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section id="top" className="hero relative flex flex-col items-center justify-center text-center min-h-[92vh] px-6 pt-28 pb-16 overflow-hidden">
        {/* Video background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="hero-video absolute inset-0 w-full h-full object-cover"
        >
          <source src="/homes.mp4" type="video/mp4" />
        </video>
        {/* Warm dark overlay */}
        <div className="absolute inset-0 bg-ink/55" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center">
          {/* Memphis badge */}
          <div className="hero-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/25 bg-white/10 text-white/80 text-xs font-semibold uppercase tracking-widest mb-8 backdrop-blur-sm">
            <MapPin className="h-3 w-3" /> Memphis, TN
          </div>

          <h1 className="font-display font-bold text-white leading-[0.95] mb-7"
            style={{ fontSize: 'clamp(3.5rem, 10vw, 7.5rem)' }}>
            <span className="hero-line block overflow-hidden"><span className="block">Trade,</span></span>
            <span className="hero-line block overflow-hidden"><span className="block">don't buy.</span></span>
          </h1>

          <p className="hero-sub text-lg text-white/70 max-w-sm leading-relaxed mb-9">
            Swap goods, skills, and services with your Memphis neighbors — no cash, no awkward pricing, just fair exchange.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/auth/signup" className="hero-cta">
              <Button variant="primary" size="lg">
                Start trading free <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/browse" className="hero-cta">
              <Button variant="ghost" size="lg" className="text-white border border-white/30 hover:bg-white/10">See live listings</Button>
            </Link>
          </div>

          <p className="hero-cta mt-4 flex items-center gap-1.5 text-small text-white/60">
            <Check className="h-4 w-4" /> Free forever · No credit card · Just neighbors
          </p>

          {/* Dynamic social proof */}
          <div className="hero-proof mt-10 flex items-center gap-3 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm pl-2 pr-5 py-2">
            <div className="flex -space-x-2.5">
              {proofAvatars.map(({ initials, bg }) => (
                <span
                  key={initials}
                  style={{ backgroundColor: bg }}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/70 text-[11px] font-bold text-white"
                >
                  {initials}
                </span>
              ))}
            </div>
            <p className="text-small text-white/85 text-left leading-snug">
              <span className="font-semibold text-white">1,200+ trades</span> by Memphis neighbors
              <span className="block text-white/60">★★★★★ 4.8 average rating</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── Ticker ── */}
      <div className="overflow-hidden bg-ink py-3.5 select-none">
        <div className="flex whitespace-nowrap animate-ticker">
          {[...TICKER, ...TICKER].map((item, i) => (
            <span key={i} className="text-xs font-semibold uppercase tracking-widest text-muted px-6">
              {item} <span className="text-clay mx-2">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Editorial photo split ── */}
      <section className="flex flex-col lg:flex-row min-h-[75vh]">
        {/* Photo */}
        <div className="editorial-photo relative lg:w-[55%] h-[65vw] max-h-[520px] lg:max-h-none lg:h-auto overflow-hidden">
          <img
            src={PHOTOS.editorial}
            alt="Neighbors exchanging"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          {/* Subtle warm vignette */}
          <div className="absolute inset-0 bg-gradient-to-br from-clay/10 to-ink/30" />
        </div>

        {/* Quote */}
        <div data-reveal className="lg:w-[45%] bg-cream flex flex-col justify-center px-8 py-14 lg:px-16 lg:py-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-clay mb-8">Why Bartrrr</p>
          <blockquote className="font-display text-3xl lg:text-[2.6rem] font-bold text-ink leading-[1.1] mb-7">
            "Your neighbor has exactly what you need."
          </blockquote>
          <p className="text-muted leading-relaxed max-w-xs">
            From handyman help to homemade meals, Memphis neighbors are already trading every day. Bartrrr makes it official.
          </p>
          <div className="mt-10 pt-8 border-t border-sand-light flex items-center gap-6">
            {stats.slice(0, 2).map((s) => (
              <div key={s.label}>
                <p className="font-display text-2xl font-bold text-clay">{s.stat}</p>
                <p className="text-xs text-muted mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="bg-white px-6 py-24 scroll-mt-16">
        <div className="max-w-5xl mx-auto">
          <div data-reveal className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-16 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-clay mb-3">Simple by design</p>
              <h2 className="font-display text-4xl lg:text-5xl font-bold text-ink">How it works</h2>
            </div>
            <Link to="/browse" className="text-sm font-medium text-clay underline underline-offset-4 shrink-0">
              See live listings →
            </Link>
          </div>

          <div data-reveal-group className="grid sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-sand-light">
            {steps.map((step) => (
              <div key={step.num} className="flex flex-col gap-5 px-0 sm:px-10 py-8 sm:py-0 first:pl-0 last:pr-0">
                <span className="font-display text-5xl font-bold text-sand leading-none">{step.num}</span>
                <div className="w-8 h-8 rounded-full bg-clay-light text-clay flex items-center justify-center">
                  {step.icon}
                </div>
                <h3 className="font-display text-xl font-semibold text-ink">{step.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section id="features" className="bg-cream px-6 py-24 scroll-mt-16">
        <div className="max-w-5xl mx-auto">
          <div data-reveal className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-clay mb-3">Everything you need</p>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-ink">Built for fair trades</h2>
          </div>

          <div data-reveal-group className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="group rounded-lg bg-white p-7 shadow-soft transition-[box-shadow,transform] duration-300 ease-out-soft hover:shadow-lift hover:-translate-y-1"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-sand-light text-ink-2 transition-colors duration-300 group-hover:bg-clay-light group-hover:text-clay">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="font-display text-xl font-semibold text-ink mb-2">{title}</h3>
                <p className="text-[15px] text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Atmospheric stats ── */}
      <section className="relative py-28 px-6">
        <img src={PHOTOS.statsBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-ink/80" />

        <div className="relative z-10 max-w-4xl mx-auto">
          <p data-reveal className="text-clay-mid text-xs font-semibold uppercase tracking-widest mb-5">Growing every day</p>
          <h2 data-reveal className="font-display font-bold text-white leading-tight mb-14"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>
            Your neighbors are<br />already trading.
          </h2>
          <div data-reveal-group className="grid sm:grid-cols-3 gap-4">
            {stats.map((item) => (
              <div key={item.label} className="bg-white/8 backdrop-blur-sm border border-white/15 rounded-2xl px-8 py-7">
                <p
                  data-count={item.value}
                  data-suffix={item.suffix}
                  className="font-display text-4xl font-bold text-clay-mid mb-1"
                >
                  {item.stat}
                </p>
                <p className="text-sm text-white/60">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="bg-white px-6 py-24 scroll-mt-16">
        <div className="max-w-2xl mx-auto">
          <div data-reveal className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-clay mb-3">Good questions</p>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-ink">Before you ask</h2>
          </div>

          <div data-reveal-group className="space-y-3">
            {faqs.map(({ q, a }, i) => {
              const open = openFaq === i
              return (
                <div key={q} className="rounded-lg border border-sand-light bg-cream overflow-hidden">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  >
                    <span className="text-base font-semibold text-ink">{q}</span>
                    <ChevronDown
                      className={cn('h-5 w-5 shrink-0 text-muted transition-transform duration-300 ease-out-soft', open && 'rotate-180 text-clay')}
                    />
                  </button>
                  <div
                    className={cn(
                      'grid transition-[grid-template-rows] duration-300 ease-out-soft',
                      open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="px-6 pb-6 text-[15px] text-ink-2 leading-relaxed">{a}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <p data-reveal className="mt-10 text-center text-[15px] text-muted">
            Still curious?{' '}
            <Link to="/browse" className="text-clay font-medium underline underline-offset-4">
              Browse live listings
            </Link>{' '}
            and see what neighbors are trading right now.
          </p>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 py-24 bg-forest text-white text-center">
        <div data-reveal>
          <p className="text-xs font-semibold uppercase tracking-widest text-forest-mid mb-5">Memphis neighbors</p>
          <h2 className="font-display text-4xl lg:text-5xl font-bold mb-5 leading-tight">
            Ready to swap?
          </h2>
          <p className="text-forest-mid mb-10 max-w-sm mx-auto leading-relaxed">
            List something you have. Find something you need. Keep it in the neighborhood.
          </p>
          <Link to="/auth/signup">
            <Button variant="confirm" size="lg">Get started — it's free</Button>
          </Link>
          <p className="mt-4 text-small text-forest-mid">Free forever. No credit card.</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-6 py-10 bg-ink">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-display text-lg font-bold text-clay-mid">Bartrrr</span>
          <div className="flex items-center gap-6 text-xs text-muted">
            <Link to="/browse" className="hover:text-clay-mid transition-colors">Browse</Link>
            <Link to="/auth/signup" className="hover:text-clay-mid transition-colors">Sign up</Link>
            <Link to="/auth/login" className="hover:text-clay-mid transition-colors">Log in</Link>
          </div>
          <p className="text-xs text-muted">
            Trade, don't buy. &copy; {new Date().getFullYear()}
          </p>
        </div>
      </footer>

    </div>
  )
}
