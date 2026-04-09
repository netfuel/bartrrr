import type { TradeAgreement } from '@/types'

export const mockAgreements: TradeAgreement[] = [
  {
    id: 'agreement-001',
    offerId: 'offer-002',
    partyA: {
      userId: 'user-001',
      item: 'Complete Gardening Tool Set (spade, rake, pruners, kneeling pad)',
      signed: true,
    },
    partyB: {
      userId: 'user-008',
      item: 'KitchenAid Stand Mixer (red, 5-quart, with all attachments)',
      signed: false,
    },
    exchangeMethod: 'in_person',
    exchangeDate: '2026-04-12T10:00:00Z',
    exchangeLocation: 'East Memphis Community Center parking lot',
    specialInstructions:
      'The mixer is heavy — bring a box or bag. I\'ll have the tools in a canvas tote.',
    status: 'pending_signatures',
    createdAt: '2026-04-06T17:00:00Z',
  },
  {
    id: 'agreement-002',
    offerId: 'offer-005',
    partyA: {
      userId: 'user-008',
      item: 'Homemade Lasagna + Garlic Bread',
      signed: true,
    },
    partyB: {
      userId: 'user-002',
      item: '2 Hours of Math Tutoring (algebra, middle school level)',
      signed: true,
    },
    exchangeMethod: 'service_at_location',
    exchangeDate: '2026-04-13T15:00:00Z',
    exchangeLocation: "Maria's home (address shared privately)",
    specialInstructions:
      "Dave will drop off food at 3pm, tutoring session starts at 3:30. Daughter's name is Lily.",
    status: 'active',
    createdAt: '2026-04-08T19:00:00Z',
  },
  {
    id: 'agreement-003',
    offerId: 'offer-006',
    partyA: {
      userId: 'user-007',
      item: 'Custom Logo Design (3 concepts, 2 revisions, final files)',
      signed: true,
    },
    partyB: {
      userId: 'user-003',
      item: '4 Hours of Home Repair (drywall patching and painting)',
      signed: true,
    },
    exchangeMethod: 'service_at_location',
    exchangeDate: '2026-03-28T09:00:00Z',
    exchangeLocation: "Nina's studio / Alex's apartment",
    status: 'completed',
    createdAt: '2026-03-20T12:00:00Z',
  },
]

export function getMockAgreement(id: string): TradeAgreement | undefined {
  return mockAgreements.find((a) => a.id === id)
}
