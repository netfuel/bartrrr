import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import confetti from 'canvas-confetti'
import { Button, ShareButton, Modal } from '@/components/ui'

interface FirstTradeCelebrationProps {
  userId: string
  onClose: () => void
}

export function FirstTradeCelebration({ userId, onClose }: FirstTradeCelebrationProps) {
  useEffect(() => {
    // Fire confetti with clay and forest colors
    const fire = (particleRatio: number, opts: confetti.Options) => {
      confetti({
        origin: { y: 0.6 },
        colors: ['#C05A35', '#2A5240', '#D4B896', '#F8F3EC'],
        ...opts,
        particleCount: Math.floor(200 * particleRatio),
      })
    }

    fire(0.25, { spread: 26, startVelocity: 55 })
    fire(0.2, { spread: 60 })
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 })
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 })
    fire(0.1, { spread: 120, startVelocity: 45 })
  }, [])

  return (
    <Modal
      onClose={onClose}
      labelledBy="first-trade-title"
      className="max-w-sm rounded-2xl bg-cream p-8 text-center"
    >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-sand-light transition-colors text-muted hover:text-ink"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Celebration emoji */}
        <div className="text-6xl mb-4" aria-hidden="true">🎉</div>

        {/* Title */}
        <h2 id="first-trade-title" className="font-display text-2xl font-bold text-ink mb-2">
          First Trade Complete!
        </h2>

        {/* Subtitle */}
        <p className="text-sm text-muted leading-relaxed mb-8">
          You're officially a Bartrrr trader. Welcome to the neighborhood.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <ShareButton
            title="My first Bartrrr trade!"
            text="I just completed my first trade on Bartrrr — swapping with neighbors instead of buying. Come barter with us!"
            url={window.location.origin}
            label="Share the news"
            variant="primary"
            size="lg"
            className="w-full"
          />
          <Link to={`/profile/${userId}`} onClick={onClose}>
            <Button variant="secondary" size="lg" className="w-full">
              View your profile
            </Button>
          </Link>
          <Button variant="ghost" size="lg" onClick={onClose} className="w-full">
            Keep exploring
          </Button>
        </div>
    </Modal>
  )
}
