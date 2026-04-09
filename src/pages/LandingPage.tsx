import { Link } from 'react-router-dom'
import { ArrowRight, Repeat, MapPin, Shield } from 'lucide-react'
import { Button } from '@/components/ui'

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

const stats = [
  { stat: '1,200+', label: 'Trades completed' },
  { stat: '4.8 ★', label: 'Average rating' },
  { stat: '47', label: 'Neighborhoods active' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-cream/90 backdrop-blur-md border-b border-sand-light">
        <span className="font-display text-2xl font-bold text-clay">Bartrrr</span>
        <div className="flex items-center gap-3">
          <Link to="/auth/login">
            <Button variant="ghost" size="sm">Log in</Button>
          </Link>
          <Link to="/auth/signup">
            <Button variant="primary" size="sm">Get started</Button>
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="flex flex-col items-center justify-center text-center min-h-[82vh] px-6 py-20">
        {/* Memphis badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-clay/30 bg-clay-light text-clay text-xs font-semibold uppercase tracking-widest mb-8">
          <MapPin className="h-3 w-3" /> Memphis, TN
        </div>

        <h1 className="font-display font-bold text-ink leading-[0.95] mb-7"
          style={{ fontSize: 'clamp(3.5rem, 10vw, 7.5rem)' }}>
          Trade,<br />don't buy.
        </h1>

        <p className="text-lg text-ink-2 max-w-sm leading-relaxed mb-10">
          Swap goods, skills, and services with your Memphis neighbors — no cash, no awkward pricing, just fair exchange.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/auth/signup">
            <Button variant="primary" size="lg">
              Start trading <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/browse">
            <Button variant="outline" size="lg">Browse listings</Button>
          </Link>
        </div>

        {/* Scroll hint */}
        <div className="mt-16 flex flex-col items-center gap-2 text-muted opacity-60">
          <div className="w-px h-10 bg-sand" />
          <span className="text-xs tracking-widest uppercase">Scroll</span>
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
        <div className="relative lg:w-[55%] h-[65vw] max-h-[520px] lg:max-h-none lg:h-auto overflow-hidden">
          <img
            src={PHOTOS.editorial}
            alt="Neighbors exchanging"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          {/* Subtle warm vignette */}
          <div className="absolute inset-0 bg-gradient-to-br from-clay/10 to-ink/30" />
        </div>

        {/* Quote */}
        <div className="lg:w-[45%] bg-cream flex flex-col justify-center px-8 py-14 lg:px-16 lg:py-20">
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
      <section className="bg-white px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-16 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-clay mb-3">Simple by design</p>
              <h2 className="font-display text-4xl lg:text-5xl font-bold text-ink">How it works</h2>
            </div>
            <Link to="/browse" className="text-sm font-medium text-clay underline underline-offset-4 shrink-0">
              See live listings →
            </Link>
          </div>

          <div className="grid sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-sand-light">
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

      {/* ── Atmospheric stats ── */}
      <section className="relative py-28 px-6">
        <img src={PHOTOS.statsBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-ink/80" />

        <div className="relative z-10 max-w-4xl mx-auto">
          <p className="text-clay-mid text-xs font-semibold uppercase tracking-widest mb-5">Growing every day</p>
          <h2 className="font-display font-bold text-white leading-tight mb-14"
            style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>
            Your neighbors are<br />already trading.
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {stats.map((item) => (
              <div key={item.label} className="bg-white/8 backdrop-blur-sm border border-white/15 rounded-2xl px-8 py-7">
                <p className="font-display text-4xl font-bold text-clay-mid mb-1">{item.stat}</p>
                <p className="text-sm text-white/60">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 py-24 bg-forest text-white text-center">
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
