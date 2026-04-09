import type { Offer } from '@/types'

export const mockOffers: Offer[] = [
  {
    id: 'offer-001',
    listingId: 'listing-001',
    fromUserId: 'user-006',
    toUserId: 'user-001',
    messages: [
      {
        id: 'msg-001',
        fromUserId: 'user-006',
        content:
          "Hey Jamie! I'd love to trade for your record player. I have a great acoustic guitar that might interest you.",
        items: ['Yamaha FG800 Acoustic Guitar'],
        type: 'offer',
        createdAt: '2026-04-05T18:00:00Z',
      },
      {
        id: 'msg-002',
        fromUserId: 'user-001',
        content:
          "The guitar sounds great, but I think the record player is worth a bit more. Could you throw in something extra?",
        type: 'message',
        createdAt: '2026-04-05T20:30:00Z',
      },
      {
        id: 'msg-003',
        fromUserId: 'user-006',
        content:
          "Fair enough! How about I add a free bike tune-up? That's one of my listed services.",
        items: ['Yamaha FG800 Acoustic Guitar', 'Free Bike Tune-Up'],
        type: 'counter',
        createdAt: '2026-04-06T09:00:00Z',
      },
    ],
    status: 'countered',
    round: 2,
    maxRounds: 5,
    expiresAt: '2026-04-09T09:00:00Z',
    createdAt: '2026-04-05T18:00:00Z',
  },
  {
    id: 'offer-002',
    listingId: 'listing-003',
    fromUserId: 'user-001',
    toUserId: 'user-008',
    messages: [
      {
        id: 'msg-004',
        fromUserId: 'user-001',
        content:
          "Hi Dave! I've got a complete set of gardening tools I'd love to trade for your KitchenAid mixer. Includes spade, rake, pruners, and a kneeling pad.",
        items: ['Complete Gardening Tool Set'],
        type: 'offer',
        createdAt: '2026-04-06T14:00:00Z',
      },
      {
        id: 'msg-005',
        fromUserId: 'user-008',
        content: "That's exactly what I've been looking for! Deal!",
        type: 'accept',
        createdAt: '2026-04-06T16:30:00Z',
      },
    ],
    status: 'accepted',
    round: 1,
    maxRounds: 5,
    expiresAt: '2026-04-09T14:00:00Z',
    createdAt: '2026-04-06T14:00:00Z',
  },
  {
    id: 'offer-003',
    listingId: 'listing-010',
    fromUserId: 'user-005',
    toUserId: 'user-006',
    messages: [
      {
        id: 'msg-006',
        fromUserId: 'user-005',
        content:
          'Hey Sam, would you take a set of camping gear for the mountain bike? I have a 2-person tent, sleeping bag, and camping stove.',
        items: ['2-Person Tent', 'Sleeping Bag', 'Camping Stove'],
        type: 'offer',
        createdAt: '2026-04-07T10:00:00Z',
      },
      {
        id: 'msg-007',
        fromUserId: 'user-006',
        content:
          "Appreciate the offer but I actually already have camping gear. I'm really looking for a kayak or piano lessons specifically. Thanks though!",
        type: 'decline',
        createdAt: '2026-04-07T14:00:00Z',
      },
    ],
    status: 'declined',
    round: 1,
    maxRounds: 5,
    expiresAt: '2026-04-10T10:00:00Z',
    createdAt: '2026-04-07T10:00:00Z',
  },
  {
    id: 'offer-004',
    listingId: 'listing-007',
    fromUserId: 'user-004',
    toUserId: 'user-007',
    messages: [
      {
        id: 'msg-008',
        fromUserId: 'user-004',
        content:
          "Nina! I love your work. I'd trade you a big selection of Copic markers (30+ colors) and a Moleskine sketchbook for a logo design for my pottery Instagram.",
        items: ['30+ Copic Markers', 'Moleskine Sketchbook'],
        type: 'offer',
        createdAt: '2026-04-08T11:00:00Z',
      },
    ],
    status: 'pending',
    round: 1,
    maxRounds: 5,
    expiresAt: '2026-04-11T11:00:00Z',
    createdAt: '2026-04-08T11:00:00Z',
  },
  {
    id: 'offer-005',
    listingId: 'listing-002',
    fromUserId: 'user-008',
    toUserId: 'user-002',
    messages: [
      {
        id: 'msg-009',
        fromUserId: 'user-008',
        content:
          "Hi Maria! My daughter needs help with algebra. I'd love to trade 2 hours of tutoring for a batch of my homemade lasagna and garlic bread. I make a mean bolognese!",
        items: ['Homemade Lasagna', 'Garlic Bread'],
        type: 'offer',
        createdAt: '2026-04-08T16:00:00Z',
      },
      {
        id: 'msg-010',
        fromUserId: 'user-002',
        content:
          "Dave, that sounds wonderful! I love homemade Italian food. Let's do it! When works for your daughter?",
        type: 'accept',
        createdAt: '2026-04-08T18:00:00Z',
      },
    ],
    status: 'accepted',
    round: 1,
    maxRounds: 5,
    expiresAt: '2026-04-11T16:00:00Z',
    createdAt: '2026-04-08T16:00:00Z',
  },
]

export function getMockOffer(id: string): Offer | undefined {
  return mockOffers.find((o) => o.id === id)
}
