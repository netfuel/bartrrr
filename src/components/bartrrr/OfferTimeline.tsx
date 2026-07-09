import { Check, Clock, X, Send, Eye, FileCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Offer } from '@/types'

interface TimelineStep {
  label: string
  timestamp?: string
  status: 'complete' | 'active' | 'waiting' | 'declined'
  icon: React.ReactNode
}

function buildSteps(offer: Offer): TimelineStep[] {
  const steps: TimelineStep[] = [
    {
      label: 'Offer Sent',
      timestamp: offer.createdAt,
      status: 'complete',
      icon: <Send className="h-3.5 w-3.5" />,
    },
  ]

  if (offer.status === 'declined') {
    steps.push({
      label: 'Declined',
      timestamp: offer.messages[offer.messages.length - 1]?.createdAt,
      status: 'declined',
      icon: <X className="h-3.5 w-3.5" />,
    })
    return steps
  }

  if (offer.round > 1) {
    steps.push({
      label: `Counter #${offer.round - 1}`,
      timestamp: offer.messages.find((m) => m.type === 'counter')?.createdAt,
      status: 'complete',
      icon: <Eye className="h-3.5 w-3.5" />,
    })
  }

  if (offer.status === 'countered') {
    steps.push({
      label: 'Awaiting Response',
      status: 'waiting',
      icon: <Clock className="h-3.5 w-3.5" />,
    })
  }

  if (offer.status === 'accepted') {
    steps.push({
      label: 'Accepted',
      timestamp: offer.messages.find((m) => m.type === 'accept')?.createdAt,
      status: 'complete',
      icon: <Check className="h-3.5 w-3.5" />,
    })
    steps.push({
      label: 'Agreement',
      status: 'active',
      icon: <FileCheck className="h-3.5 w-3.5" />,
    })
  }

  if (offer.status === 'pending') {
    steps.push({
      label: 'Awaiting Response',
      status: 'waiting',
      icon: <Clock className="h-3.5 w-3.5" />,
    })
  }

  return steps
}

const statusColors = {
  complete: 'bg-teal text-white',
  active: 'bg-forest text-white',
  waiting: 'bg-gold-light text-gold',
  declined: 'bg-clay-light text-clay',
}

const lineColors = {
  complete: 'bg-teal',
  active: 'bg-forest',
  waiting: 'bg-sand',
  declined: 'bg-clay-light',
}

export interface OfferTimelineProps {
  offer: Offer
  className?: string
}

export function OfferTimeline({ offer, className }: OfferTimelineProps) {
  const steps = buildSteps(offer)

  return (
    <div className={cn('flex items-center gap-0 overflow-x-auto', className)}>
      {steps.map((step, i) => (
        <div key={i} className="flex items-center shrink-0">
          {/* Step */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-full',
                statusColors[step.status],
                step.status === 'waiting' && 'animate-pulse',
              )}
            >
              {step.icon}
            </div>
            <p className="text-xs font-medium text-ink-2 whitespace-nowrap">
              {step.label}
            </p>
            {step.timestamp && (
              <p className="text-[11px] text-muted">
                {new Date(step.timestamp).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            )}
          </div>

          {/* Connector line */}
          {i < steps.length - 1 && (
            <div
              className={cn(
                'h-0.5 w-10 mx-1.5 mt-[-22px]',
                lineColors[steps[i + 1].status],
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}
