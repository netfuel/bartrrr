import { Link } from 'react-router-dom'
import { ArrowRight, Repeat, MapPin, Shield } from 'lucide-react'
import { Button } from '@/components/ui'

// Swap this for your actual hosted photo URL
const STATS_BG = 'https://picsum.photos/seed/bartrrr-warm/1600/700'

const steps = [
  {
    num: '01',
    icon: <MapPin className="h-6 w-6" />,
    title: 'List what you have',
    desc: "Post items or services you want to trade. Add photos and describe what you're looking for in return.",
  },
  {
    num: '02',
    icon: <Repeat className="h-6 w-6" />,
    title: 'Make an offer',
    desc: 'Found something you like? Propose a swap. Negotiate back and forth until the deal feels right.',
  },
  {
    num: '03',
    icon: <Shield className="h-6 w-6" />,
    title: 'Swap with confidence',
    desc: 'Sign a trade agreement, meet up, and exchange. Rate your neighbor after the swap.',
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
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
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
      <section className="flex items-center justify-center min-h-[88vh] max-w-4xl mx-auto">

        {/* Copy */}
        <div className="flex flex-col justify-center px-8 py-16 lg:px-16">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-clay mb-5">
            Hyperlocal trading
          </span>
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold text-ink leading-[1.05] mb-6">
            Trade,<br />don't buy.
          </h1>
          <p className="text-lg text-ink-2 max-w-md leading-relaxed mb-10">
            Bartrrr makes swapping with your neighbors as easy as texting —
            no price tags, no cash, just fair exchange.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/auth/signup">
              <Button variant="primary" size="lg">
                Start trading <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/browse">
              <Button variant="outline" size="lg">Browse listings</Button>
            </Link>
          </div>
        </div>

      </section>

      {/* ── How it works ── */}
      <section className="bg-white px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-clay mb-3">Simple by design</p>
            <h2 className="font-display text-4xl font-bold text-ink">How it works</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-10">
            {steps.map((step) => (
              <div key={step.num} className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="font-display text-4xl font-bold text-clay-mid leading-none">{step.num}</span>
                  <div className="w-px h-8 bg-sand" />
                  <div className="w-10 h-10 rounded-full bg-clay-light text-clay flex items-center justify-center shrink-0">
                    {step.icon}
                  </div>
                </div>
                <h3 className="font-display text-xl font-semibold text-ink">{step.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats over photo ── */}
      <section className="relative py-24 px-6">
        <img src={STATS_BG} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-ink/75" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <p className="text-clay-mid text-xs font-semibold uppercase tracking-widest mb-4">Growing every day</p>
          <h2 className="font-display text-4xl font-bold text-white mb-12">
            Your neighbors are already trading
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {stats.map((item) => (
              <div key={item.label} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-8">
                <p className="font-display text-4xl font-bold text-clay-mid mb-2">{item.stat}</p>
                <p className="text-sm text-white/70">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 py-20 bg-forest text-white text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-forest-mid mb-4">Join the community</p>
        <h2 className="font-display text-4xl font-bold mb-4">Ready to swap?</h2>
        <p className="text-forest-mid mb-8 max-w-md mx-auto leading-relaxed">
          List something you have. Find something you need. Meet your neighbors.
        </p>
        <Link to="/auth/signup">
          <Button variant="confirm" size="lg">Get started — it's free</Button>
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="px-6 py-8 bg-ink text-center">
        <span className="font-display text-lg font-bold text-clay-mid">Bartrrr</span>
        <p className="text-xs text-muted mt-1">
          Trade, don't buy. &copy; {new Date().getFullYear()}
        </p>
      </footer>

    </div>
  )
}
