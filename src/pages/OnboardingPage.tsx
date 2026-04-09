import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, ArrowRight, CheckCircle, Sparkles } from 'lucide-react'
import { Button, Chip } from '@/components/ui'
import { useAuth } from '@/providers/AuthProvider'
import { useUsersStore } from '@/stores'

type Step = 'welcome' | 'neighborhood' | 'interests' | 'done'

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

  const toggleInterest = (id: string) => {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const handleFinish = () => {
    if (neighborhood) {
      updateUser(currentUser.id, { neighborhood })
    }
    markOnboarded(currentUser.id)
    navigate('/browse')
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['welcome', 'neighborhood', 'interests', 'done'] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step
                  ? 'w-8 bg-clay'
                  : ['welcome', 'neighborhood', 'interests', 'done'].indexOf(step) > i
                  ? 'w-4 bg-clay-mid'
                  : 'w-4 bg-sand'
              }`}
            />
          ))}
        </div>

        {/* ── Step 1: Welcome ── */}
        {step === 'welcome' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-clay-light flex items-center justify-center mx-auto mb-6">
              <Sparkles className="h-8 w-8 text-clay" />
            </div>
            <h1 className="font-display text-3xl font-bold text-ink mb-3">
              Welcome to Bartrrr, {currentUser.displayName.split(' ')[0]}!
            </h1>
            <p className="text-base text-muted mb-2">
              Trade what you have for what you need.
            </p>
            <p className="text-sm text-muted mb-8">
              No money. Just neighbors helping neighbors.
            </p>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => setStep('neighborhood')}
            >
              Get started <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* ── Step 2: Neighborhood ── */}
        {step === 'neighborhood' && (
          <div>
            <div className="w-12 h-12 rounded-full bg-forest-light flex items-center justify-center mb-4">
              <MapPin className="h-6 w-6 text-forest" />
            </div>
            <h2 className="font-display text-2xl font-bold text-ink mb-1">
              Where do you live?
            </h2>
            <p className="text-sm text-muted mb-6">
              Pick your Memphis neighborhood and we'll surface trades closest to you.
            </p>

            <div className="grid grid-cols-3 gap-2 mb-6">
              {NEIGHBORHOODS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNeighborhood(n)}
                  className={`p-3 rounded-lg border text-sm font-medium text-left transition-colors ${
                    neighborhood === n
                      ? 'border-clay bg-clay-light text-clay'
                      : 'border-sand-light hover:border-sand text-ink'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep('welcome')} className="flex-1">
                Back
              </Button>
              <Button
                variant="primary"
                onClick={() => setStep('interests')}
                disabled={!neighborhood}
                className="flex-1"
              >
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Interests ── */}
        {step === 'interests' && (
          <div>
            <h2 className="font-display text-2xl font-bold text-ink mb-1">
              What are you looking for?
            </h2>
            <p className="text-sm text-muted mb-6">
              Pick a few categories to personalize your feed. Select at least 3.
            </p>

            <div className="flex flex-wrap gap-2 mb-6">
              {INTEREST_CATEGORIES.map((cat) => (
                <Chip
                  key={cat.id}
                  label={`${cat.emoji} ${cat.label}`}
                  selected={interests.includes(cat.id)}
                  onToggle={() => toggleInterest(cat.id)}
                />
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setStep('neighborhood')} className="flex-1">
                Back
              </Button>
              <Button
                variant="primary"
                onClick={() => setStep('done')}
                disabled={interests.length < 3}
                className="flex-1"
              >
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === 'done' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-teal-light flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-teal" />
            </div>
            <h2 className="font-display text-2xl font-bold text-ink mb-2">
              You're all set!
            </h2>
            <p className="text-sm text-muted mb-1">
              You're in <span className="font-medium text-ink">{neighborhood}</span>.
            </p>
            <p className="text-sm text-muted mb-8">
              Explore nearby listings or post your first item to start trading.
            </p>

            <div className="flex flex-col gap-3">
              <Button variant="primary" size="lg" onClick={handleFinish} className="w-full">
                Explore listings →
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => { markOnboarded(currentUser.id); navigate('/listing/new') }}
                className="w-full"
              >
                Post my first listing
              </Button>
            </div>

            <p className="text-xs text-muted mt-4">
              You selected {interests.length} interest{interests.length !== 1 ? 's' : ''}.
              Your feed is ready.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
