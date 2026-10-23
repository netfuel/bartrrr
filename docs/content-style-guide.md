# Bartrrr content style guide

How Bartrrr talks. Use this for every string a person can see or hear: UI labels, buttons, helper text, errors, toasts, notifications, empty states, aria-labels, page titles, the trade agreement, and marketing pages.

Bartrrr is a hyperlocal barter app for the Memphis, TN metro. Neighbors trade goods, services and skills. No money changes hands.

---

## 1. Voice

**Write like a trusted neighbor, not a platform.**

| Principle | In practice |
|---|---|
| Warm, plain, direct | Short sentences. Everyday words. Say the thing. |
| Trade, not buy | Every interaction is an exchange. Never talk about money. |
| Local first | Name the neighborhood. Say "neighbor", not "user". |
| Trust through clarity | Always say what just happened, what happens next, and who's waiting on whom. |
| Honest | Don't promise what the product can't do. Don't invent numbers. |

### Tone by moment

| Moment | Tone | Example |
|---|---|---|
| Neutral UI | Calm, brief | "Offers" |
| Waiting | Reassuring, specific | "Waiting for Jamie to reply. We'll let you know when they do." |
| Success | Warm, then the next step | "Trade accepted. Next, review and sign the trade agreement." |
| Error | Calm, specific, fixable | "We couldn't log you in. Check your connection and try again." |
| Irreversible action | Clear about the consequence | "This closes the agreement and can't be undone." |
| Celebration | Delight is fine, keep it short | "First trade complete!" |

---

## 2. Mechanics

- **Brand name:** always **Bartrrr** (capital B, three r's). Never "Bartr", "Barter" or "bartrrr" in sentences. The lowercase wordmark in the logo is a visual treatment, not copy.
- **Sentence case** for everything: headings, buttons, tabs, labels, badges, page titles, notification titles. Capitalize only the first word and proper nouns (Memphis, Cooper-Young, Bartrrr).
- **Colons, not em dashes.** "Your move: accept, counter-offer, or decline." Use a period if a colon feels forced.
- **Ellipsis** is one character (…), used only for in-progress states ("Signing in…") and placeholders that trail off. Never three periods.
- **Numbers:** numerals for counts and time ("3 hours", "Round 2 of 5", "72 hours"). Pluralize correctly: "1 trade", "2 trades".
- **Distance:** miles, one decimal: "0.4 mi away", "2.1 mi away". Under 0.1 mi: "Nearby". No feet, no km.
- **Dates and times:** "Apr 12", "Saturday, April 12 at 10:00 AM". Relative times in feeds: "5m ago", "2h ago", "3d ago", "just now".
- **ZIP code** is all caps.
- **Exclamation points:** at most one per screen, only for real celebration. Never in errors.
- **Contractions** are good: you're, we'll, can't, didn't.
- **"You" and "we":** "you" is the person reading. "We" is Bartrrr, used sparingly and only when Bartrrr is doing something ("We'll let you know").
- **Names:** use the other neighbor's first name in flow copy ("Waiting for Jamie to reply"). Fall back to "your neighbor", never "the user" or "someone".

---

## 3. Glossary

One term per concept. Use these exact words everywhere.

| Use | Meaning | Don't use |
|---|---|---|
| **neighbor** | Any person on Bartrrr | user, member, trader (as a label), seller, buyer, customer |
| **listing** | Something a neighbor posts to trade: a good, service, or skill | item (as the object), post, ad, product |
| **looking for** / **in return** | What the listing owner would like for it | seeking, wants, price, asking |
| **offer** | A proposal to trade something for a listing | bid, request, proposal |
| **make an offer** / **send offer** | Starting an offer | submit a bid, place a bid |
| **counter-offer** (noun and button) | A changed offer sent back. Always hyphenated | counter, counter offer, suggest a change, revise |
| **round** | One offer or counter-offer. Max 5 rounds (1 offer + 4 counter-offers) | turn, step |
| **accept trade** | Agree to the current terms of an offer | confirm, approve |
| **decline** | Say no to an offer | reject, no thanks, pass |
| **trade** | The whole exchange, from accepted offer to done | deal, transaction, purchase, order |
| **swap** | The physical handoff, or a friendly synonym for trade in marketing | exchange (in UI), checkout, pickup |
| **trade agreement** | The non-binding record both neighbors sign after an offer is accepted. "Agreement" on second mention | contract, terms, barter contract |
| **sign** | Acknowledge the trade agreement (checkbox + button) | e-sign, execute, finalize |
| **take down** | Remove your own listing. "Relist" brings it back | withdraw, delete, deactivate |
| **relist** | Put an expired or taken-down listing back up for 30 days | renew, repost |
| **mark as done** / **we made the swap** | Confirm the swap happened | complete transaction, close |
| **review** | Star rating and comment after a trade | feedback, rating (as the whole thing) |
| **neighborhood** | Where a neighbor is, shown instead of an address | location, zone, area (as a label) |

### Status labels

Offers (`OFFER_STATUS_LABELS`): **Waiting for reply** · **Counter-offer** · **Accepted** · **Declined**. In lists, an open offer where it's the reader's move shows **Your turn**.

Trade agreements (`AGREEMENT_STATUS_LABELS`): **Draft** · **In review** · **Waiting to sign** · **Ready to swap** · **Completed** · **Canceled** · **Flagged**.

Listings: **Active** (no badge) · **Trade in progress** · **No longer available**.

Exchange methods (`EXCHANGE_METHOD_LABELS`): **Meet up in person** · **Drop-off** · **Service on site**.

Conditions (`CONDITION_LABELS`): **New** · **Like new** · **Good** · **Fair**.

Categories (`CATEGORY_LABELS`): **Goods** · **Services** · **Skills & expertise** · **Outdoor & garden**.

All of these live in `src/types/index.ts`. Never render a raw enum value (`pending_signatures`, `like_new`, `not_interested`) to people.

### Never say

buy, sell, selling, price, cost, purchase, checkout, cart, pay, payment, fee (except "no fees"), deal (in UI), transaction, user, submit, OK.

"Trade, don't buy" is the tagline and the only place "buy" appears.

---

## 4. Buttons and calls to action

**A button says what happens when you press it.** Verb first, sentence case, 1 to 4 words.

| Do | Don't |
|---|---|
| Send offer | Submit |
| Accept trade | OK, Confirm |
| Send counter-offer | Send, Suggest a change |
| Decline offer | No thanks |
| Sign agreement | I agree, Finalize |
| We made the swap | Complete |
| Post listing | Create |
| Take down listing | Withdraw, Delete |
| Relist for 30 days | Renew |
| Post review | Submit review |
| Save changes | Save, Update |

- **Primary action** is the rightmost or bottom button.
- **Cancel / safe choice** in a confirmation is specific when possible: "Keep it up", "Keep talking", "Not yet". Plain "Cancel" is fine in forms.
- **Disabled buttons always come with a reason** in nearby text: "Add a title (at least 3 characters) to continue." Never leave someone guessing why they can't proceed.
- **Loading states** use the verb in progress: "Signing in…", "Joining…".
- **Icon-only buttons** need an `aria-label` that names the action: "Add photo", "Remove photo 2", "Close preview", "Dismiss notification".

---

## 5. Confirmations

Ask before anything irreversible or that changes the other neighbor's state. Use `ConfirmDialog` (`src/components/ui/ConfirmDialog.tsx`).

Pattern: **question title** + **what happens, including whether it can be undone** + **named confirm button** + **safe cancel**.

| Action | Title | Body | Confirm | Cancel |
|---|---|---|---|---|
| Accept an offer | Accept this trade? | You give {X} and get {Y}. This ends the negotiation. Next, you'll both review and sign a simple trade agreement, then pick a time and place to swap. | Accept trade | Not yet |
| Decline an offer | Decline this offer? | This ends the negotiation. Pick a reason so {name} knows what to try next time. | Decline offer | Keep talking |
| Take down a listing | Take down this listing? | Neighbors won't see it anymore and can't make new offers. You can relist it later from this page. | Take down listing | Keep it up |
| Mark trade done | Did the swap happen? | Only mark it done after you and {name} have both handed over your side of the trade. This closes the agreement and can't be undone. | Yes, we swapped | Not yet |

Signing an agreement is confirmed with the acknowledgment checkbox instead of a dialog.

---

## 6. Status and next steps

In the offer and agreement flow, every screen answers three questions:

1. **Where are we?** "Round 2 of 5"
2. **Whose move is it?** "Your move: accept, counter-offer, or decline." / "Waiting for Jamie to reply."
3. **What's left?** "3 counter-offers left · Expires in 2 days"

Rules:
- Offers expire after **72 hours** without a reply. Say so when an offer is sent: "They have 72 hours to accept, decline, or send a counter-offer."
- Negotiations are capped at **5 rounds**. Show the round and counter-offers left. On the last available counter-offer, nudge: "One counter-offer left. If you're close, now's a good time to meet in the middle." When counters are used up: "This is the last round, so counter-offers are closed."
- Listings stay up **30 days**. Say so when posting and relisting.
- Status lines live in an `aria-live="polite"` region so screen readers hear changes.

---

## 7. Errors and validation

**Say what went wrong and how to fix it.** Calm, specific, no blame, no codes, no exclamation points.

Structure: `[What happened]. [How to fix it].`

| Situation | Copy |
|---|---|
| Save failed (network) | Couldn't send your offer. Check your connection and try again. |
| Login failed | We couldn't log you in. Check your connection and try again. |
| Bad ZIP | Enter a 5-digit ZIP code, like 38104. |
| Location denied | We couldn't get your location. Enter your ZIP code instead. |
| Bad photo link | That doesn't look like a web link. It should start with https:// |
| Duplicate photo | You've already added that photo. |
| Too many photos | You can add up to 6 photos. |
| Missing title | Add a title (at least 3 characters). |
| Missing "in return" | Tell neighbors what you'd like in return. |
| Missing name | Add a name so neighbors know who they're trading with. |
| Clipboard blocked | Couldn't copy the link. Copy it from your browser's address bar instead. |
| Not found | We couldn't find this listing. It may have been traded or taken down. + link to a useful place |

Validation timing:
- Validate on submit or on the step's Next button, not on every keystroke for empty fields.
- Clear a field's error as soon as the person edits that field.
- Inline errors go under the field (`error` prop on `Input`/`Textarea`), linked with `aria-describedby`. Toasts are for things that happened outside the form (network, background saves).

---

## 8. Empty states

**Say why it's empty, then give one clear next action.** Warm, never "No results found."

Structure: **title** (what's true) + **description** (why, and what would fill it) + **one action**.

| Where | Title | Description | Action |
|---|---|---|---|
| Browse, nothing posted | No listings here yet | Your neighbors haven't posted yet. Be the first: post something you'd love to trade. | Post a listing |
| Browse, filters hide everything | No matches | Nothing nearby matches these filters. Try another category or a wider distance. | Clear filters |
| Offers received | No offers yet | When a neighbor wants to trade for one of your listings, their offer shows up here. More listings mean more offers. | Post a listing |
| Offers sent | You haven't made any offers | See something you like nearby? Make an offer and propose a swap. | Browse listings |
| Agreements to sign | Nothing to sign | When you accept a trade, or a neighbor accepts yours, the trade agreement shows up here for you both to sign. | Check your offers |
| Agreements ready to swap | No swaps scheduled | Once you've both signed an agreement, it moves here until you've met up and made the swap. | none |
| Agreements done | No finished trades yet | Trades you mark as done land here, along with your reviews. | none |
| Dashboard listings | Your dashboard is quiet, for now | List something you'd love to trade. Neighbors can't make offers until you do. | Post a listing |
| Notifications | You're all caught up. | New offers, messages, and trade updates will show up here. | none |
| Feed | No activity yet | When neighbors in {neighborhood} post listings or finish trades, you'll see them here. | Post a listing |

---

## 9. Toasts and notifications

**Toasts** confirm something just happened and point to the next step. One or two short sentences. Success and info toasts are announced politely; errors are announced as alerts.

- "Offer sent. They have 72 hours to reply."
- "Counter-offer sent. Waiting for Jamie to reply."
- "Trade accepted. Next, review and sign the trade agreement."
- "Signed. We'll let you know when Jamie signs too."
- "Listing taken down. You can relist it anytime."

**Notifications** (in-app and push) have a short title naming the event and a body that says who and what to do.

| Event | Title | Body |
|---|---|---|
| New offer | New offer on your listing | {Name} wants to trade for your {listing}. Take a look. |
| Counter-offer | New counter-offer | {Name} suggested a change to your trade. Take a look. |
| Accepted | Offer accepted | {Name} accepted the trade. Next: review and sign the trade agreement. |
| Declined | Offer declined | {Name} declined your offer. Their reason: "{reason}" |
| Other side signed | Your turn to sign | Your neighbor signed the trade agreement. Review it and sign to lock in the trade. |
| Both signed | You're both signed: time to swap | You both signed the trade agreement. Meet up and make the swap. |
| Trade done | Trade complete | {Name} marked your trade as done. How did it go? Leave a review. |
| Review | New review | {Name} left you a review. |
| Match | New listing you might like | A neighbor just posted "{title}". It matches what you're looking for. |

---

## 10. The trade agreement

The agreement is the one place legal clarity matters. Keep it readable anyway.

- **Disclaimer:** "This agreement is voluntary and not legally binding. It's a shared record of what you and your neighbor agreed to trade, so nobody has to remember the details. Bartrrr helps you keep track; it doesn't enforce the deal."
- **Acknowledgment (checkbox):** "I've described what I'm giving honestly, including its condition, and I agree to these terms."
- **Under the sign button:** "Signing isn't a legal contract. It's a shared record of what you both agreed to."
- **Cancellation:** "Let {name} know as early as you can. Canceling within 24 hours of the meetup counts as a late cancellation on your profile."
- **Disputes:** "Talk it through with {name} first. Bartrrr keeps the record of what you agreed to, but it can't decide who's right or guarantee an outcome."
- **Meetup:** recommend public places: "A public spot like a library, coffee shop, or community center is a good bet."

Always present the trade from the reader's side: **You give** / **You get**.

---

## 11. Accessibility copy

- Every input has a visible label or, if the design hides it, an `aria-label`. Placeholders are examples, never labels.
- Icon-only controls get an `aria-label` naming the action.
- Groups of choice chips get `role="group"` and a label ("Category", "Reason for declining").
- Toggle buttons use `aria-pressed`; disclosure buttons use `aria-expanded`.
- Status changes in flows go in `role="status"` / `aria-live="polite"` regions. The toast region stays mounted so announcements aren't missed.
- Star ratings: "4 out of 5 stars". Rating inputs are a radiogroup with "1 star" … "5 stars".
- Image alt text describes the subject: "Photos of {title}", "{title} photo 2".
- Page titles: `{Page} | Bartrrr` via `usePageTitle()`. The landing page uses "Bartrrr: Trade, don't buy".

---

## 12. Marketing copy

Same voice, a little more room to breathe.

- Lead with the human benefit: "Swap goods, skills, and services with your Memphis neighbors. No cash, no awkward money talk, just a fair trade."
- **No unverifiable claims.** No user counts, trade counts, ratings, or neighborhood counts until they're real and sourced. Prefer true product facts: "0 dollars changing hands", "72 hours to answer an offer", "30 days each listing stays up".
- Example testimonials are labeled as examples ("Trades like these") until we have real, permissioned quotes.
- "Free to use" is fine. Avoid "free forever" and other promises about the future.
- English only. No borrowed foreign phrases as labels.
