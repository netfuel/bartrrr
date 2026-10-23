import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, ArrowRight, CheckCircle, Sparkles } from 'lucide-react'
import { Button, Chip, Wordmark } from '@/components/ui'
import { useAuth } from '@/providers/AuthProvider'
import { useUsersStore } from '@/stores'

type Step = 'welcome' | 'neighborhood' | 'interests' | 'done'

const STEPS: Step[] = ['welcome', 'neighborhood', 'interests', 'done']

const NEIGHBORHOODS = [
  'Downtown Memphis',
  'Midtown',
  'Cooper-Young',
  'South Main Arts District',
  'Overton Square',
  'East Memphis',
  'Germantown',
  'Cordova',
  'Bartlett',
  'Binghampton',
  'Whitehaven',
  'Collierville',
  'Harbor Town',
  'Frayser',
  'Millington',
  'Raleigh',
]

const INTEREST_CATEGORIES = [
  { id: 'household', label: 'Household', emoji: '🏠' },
  { id: 'electronics', label: 'Electronics', emoji: '💻' },
  { id: 'furniture', label: 'Furniture', emoji: '🪑' },
  { id: 'clothing', label: 'Clothing', emoji: '👕' },
  { id: 'kids', label: 'Kids & Baby', emoji: '🧸' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'books', label: 'Books & Media', emoji: '📚' },
  { id: 'tools', label: 'Tools', emoji: '🔧' },
  { id: 'garden', label: 'Garden', emoji: '🌿' },
  { id: 'food', label: 'Food & Homemade', emoji: '🍳' },
  { id: 'tutoring', label: 'Tutoring', emoji: '📐' },
  { id: 'handyman', label: 'Home Repair', emoji: '🔨' },
  { id: 'pets', label: 'Pet Care', emoji: '🐾' },
  { id: 'tech', label: 'Tech Help', emoji: '🖥️' },
  { id: 'creative', label: 'Creative', emoji: '🎨' },
  { id: 'transport', label: 'Transport', emoji: '🚗' },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { currentUser, markOnboarded } = useAuth()
  const updateUser = useUsersStore((s) => s.updateUser)

  const [step, setStep] = useState<Step>('welcome')
  const [neighborhood, setNeighborhood] = useState(currentUser?.neighborhood || '')
  const [interests, setInterests] = useState<string[]>([])

  if (!currentUser) return null

  const stepIndex = STEPS.indexOf(step)

  const toggleInterest = (id: string) => {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const handleFinish = () => {
    if (neighborhood) {
      updateUser(currentUser.id, { neighborhood, interests })
    }
    markOnboarded(currentUser.id)
    navigate('/browse')
  }

  return (
    <div className="min-h-[100svh] bg-cream flex flex-col px-5 py-6">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between">
        <Wordmark />
        {step !== 'done' && (
          <p className="text-label text-muted tabular-nums">Step {stepIndex + 1} of 3</p>
        )}
      </div>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-10">

        {/* Step progress — a hairline that fills */}
        <div className="mb-12 grid grid-cols-4 gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <div key={s} className="h-px bg-ink/20">
              <div
                className={`h-px bg-ink transition-[width] duration-700 ease-out-soft ${stepIndex >= i ? 'w-full' : 'w-0'}`}
              />
            </div>
          ))}
        </div>

        {/* key replays the entrance animation on every step change */}
        <div key={step} className="animate-fade-up">

          {/* ── Step 1: Welcome ── */}
          {step === 'welcome' && (
            <div>
              <div className="w-14 h-14 rounded-full border border-ink flex items-center justify-center mb-8 animate-scale-in">
                <Sparkles className="h-6 w-6 text-clay" />
              </div>
              <h1 className="text-display !text-[clamp(3rem,10vw,5.5rem)] text-ink mb-6">
                Welcome, <em>{currentUser.displayName.split(' ')[0]}!</em>
              </h1>
              <p className="font-display text-[22px] leading-snug text-ink-2 mb-2">
                Trade what you have for what you need.
              </p>
              <p className="text-base text-muted mb-10">
                No money. Just neighbors helping neighbors.
              </p>
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => setStep('neighborhood')}
              >
                Get started <ArrowRight className="h-5 w-5 ml-1" />
              </Button>
            </div>
          )}

          {/* ── Step 2: Neighborhood ── */}
          {step === 'neighborhood' && (
            <div>
              <div className="w-12 h-12 rounded-full border border-ink flex items-center justify-center mb-6">
                <MapPin className="h-5 w-5 text-clay" />
              </div>
              <h2 className="text-heading-page text-ink mb-3">
                Where do you live?
              </h2>
              <p className="text-base text-ink-2 mb-8">
                Pick your Memphis neighborhood and we'll show trades closest to you.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 border-t border-l border-ink mb-8">
                {NEIGHBORHOODS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNeighborhood(n)}
                    aria-pressed={neighborhood === n}
                    className={`pressable min-h-[60px] px-4 py-3 rounded-none border-b border-r border-ink text-[15px] font-medium text-left transition-colors duration-300 ${
                      neighborhood === n
                        ? 'bg-ink text-cream'
                        : 'text-ink hover:bg-paper'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="ghost" size="lg" onClick={() => setStep('welcome')} className="flex-1">
                  Back
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setStep('interests')}
                  disabled={!neighborhood}
                  className="flex-1"
                >
                  Continue <ArrowRight className="h-5 w-5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Interests ── */}
          {step === 'interests' && (
            <div>
              <h2 className="text-heading-page text-ink mb-3">
                What are you looking for?
              </h2>
              <p className="text-base text-ink-2 mb-8">
                Pick at least 3 categories and we'll personalize your feed.
              </p>

              <div className="flex flex-wrap gap-2.5 mb-4">
                {INTEREST_CATEGORIES.map((cat) => (
                  <Chip
                    key={cat.id}
                    label={`${cat.emoji} ${cat.label}`}
                    selected={interests.includes(cat.id)}
                    onToggle={() => toggleInterest(cat.id)}
                  />
                ))}
              </div>

              <p className="text-base mb-6 min-h-[24px]" aria-live="polite">
                {interests.length === 0 && <span className="text-muted">Tap a category to select it.</span>}
                {interests.length > 0 && interests.length < 3 && (
                  <span className="text-muted">{interests.length} picked — choose {3 - interests.length} more.</span>
                )}
                {interests.length >= 3 && (
                  <span className="text-teal-dark font-medium animate-fade-in">
                    {interests.length} picked — great choices!
                  </span>
                )}
              </p>

              <div className="flex gap-3">
                <Button variant="ghost" size="lg" onClick={() => setStep('neighborhood')} className="flex-1">
                  Back
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setStep('done')}
                  disabled={interests.length < 3}
                  className="flex-1"
                >
                  Continue <ArrowRight className="h-5 w-5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 4: Done ── */}
          {step === 'done' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full border border-teal bg-teal-light flex items-center justify-center mx-auto mb-8 animate-scale-in">
                <CheckCircle className="h-7 w-7 text-teal-dark" />
              </div>
              <h2 className="text-display !text-[clamp(3rem,10vw,5rem)] text-ink mb-5">
                <em>You're all set!</em>
              </h2>
              <p className="text-base text-muted mb-1">
                You're in <span className="font-display italic text-[18px] text-ink">{neighborhood}</span>.
              </p>
              <p className="text-base text-muted mb-8">
                Explore nearby listings or post your first item to start trading.
              </p>

              <div className="flex flex-col gap-3">
                <Button variant="primary" size="lg" onClick={handleFinish} className="w-full">
                  Explore listings <ArrowRight className="h-5 w-5 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => { if (neighborhood) updateUser(currentUser.id, { neighborhood, interests }); markOnboarded(currentUser.id); navigate('/listing/new') }}
                  className="w-full"
                >
                  Post my first listing
                </Button>
              </div>

              <p className="text-small text-muted mt-5">
                You selected {interests.length} interest{interests.length !== 1 ? 's' : ''}.
                Your feed is ready.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
