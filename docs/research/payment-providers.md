# Payment provider for Rota Ready Pro

Research for #142, part of the map #140 (a PRD for Rota Ready Pro). All pricing and docs were read on **24 November 2026**. Prices change, so check them again before building.

## Question

Which provider should take a monthly Pro subscription, possibly with extra texts on top of an included allowance, from UK bars and restaurants? Compare Stripe Billing with merchant-of-record (MoR) options (Paddle, Lemon Squeezy) on fees, UK VAT and invoices, customer portal, usage add-ons, trials, webhooks and setup effort for a solo developer.

## Recommendation

**Use Stripe Billing directly, with Rota Ready as the seller: Stripe Checkout to subscribe, the hosted Stripe customer portal to cancel and change cards, and a metered price for extra texts.**

Why:

1. **It costs about half as much.** On a standard UK card, Stripe Billing costs about 3% of a £20 charge. Either MoR costs about 6.5% to 8% once VAT is added (see the worked example below).
2. **An MoR solves a problem Rota Ready doesn't have.** An MoR is worth paying for when you sell digital services to consumers in many countries, each with its own VAT or sales tax registration. Rota Ready sells to UK businesses from the UK. Below the £90,000 VAT threshold it charges no VAT. Above it, it charges one rate, UK 20%, which Stripe can add with a fixed tax rate at no extra cost.
3. **It supports everything Pro needs:** subscriptions, trials, a hosted portal, usage-based billing, webhooks and UK Bacs Direct Debit.
4. **Lemon Squeezy is out.** It no longer accepts sign-ups and shuts down on 31 March 2027.

Fallback: if Pro is later sold outside the UK, turn on **Stripe Managed Payments** (Stripe's own MoR, +3.5%) for those Checkout sessions. It uses the same Stripe account, products and webhooks, so the switch costs little.

## Fees

### Stripe (UK account), from [stripe.com/gb/pricing](https://stripe.com/gb/pricing) and [local payment methods](https://stripe.com/gb/pricing/local-payment-methods)

| Item | Fee |
| --- | --- |
| Standard UK cards | 1.5% + 20p |
| Premium UK cards | 2.8% + 20p |
| EEA cards | 2.5% + 20p |
| International cards | 3.15% + 20p (+2% if currency conversion is needed) |
| Bacs Direct Debit | 1%, minimum 20p, capped at £4.00; £5.00 per dispute |
| Stripe Billing (pay as you go) | 0.7% of Billing volume |
| Stripe Tax (optional) | 0.5% per transaction where registered (no-code), or £0.40 per transaction (API) |
| Card dispute | £20.00 received, plus £20.00 if countered (refunded if won) |
| Monthly or setup fee | None ("No setup fees, monthly fees, or hidden fees") |

Stripe Tax isn't needed for UK-only sales. A manual **Tax Rate** object (for example, VAT 20% exclusive) can be applied to subscriptions and Checkout for free ([Tax rates docs](https://docs.stripe.com/billing/taxes/tax-rates)).

### Stripe Managed Payments (MoR), from [stripe.com/gb/managed-payments](https://stripe.com/gb/managed-payments)

It "adds 3.5% per successful transaction to your standard Stripe processing fees". Billing is priced separately, so the 0.7% still applies to subscriptions.

### Paddle (MoR), from [paddle.com/pricing](https://www.paddle.com/pricing)

5% + 50¢ per transaction, with "No monthly fees". Products under $10 need bespoke pricing. The page doesn't list payout or currency fees.

### Lemon Squeezy (MoR), from [lemonsqueezy.com](https://www.lemonsqueezy.com/) and [its pricing page](https://www.lemonsqueezy.com/pricing)

5% + 50¢. The site says: "Lemon Squeezy is no longer accepting new sign-ups and will shut down on March 31, 2027", "The team behind it built Stripe Managed Payments", and "We recommend migrating to Managed Payments." **It isn't an option.**

### Worked example: Pro at £20 a month (an example price only; the price isn't decided)

| Setup | Customer pays | Provider fees | Share of the £20 |
| --- | --- | --- | --- |
| Stripe Billing, not VAT-registered, standard UK card | £20.00 | 30p + 20p + 14p = **£0.64** | 3.2% |
| Same, premium or business card | £20.00 | 56p + 20p + 14p = **£0.90** | 4.5% |
| Same, Bacs Direct Debit | £20.00 | 20p + 14p = **£0.34** | 1.7% |
| Stripe Billing, VAT-registered (20% added), standard card | £24.00 | 36p + 20p + 17p = **£0.73** | 3.6% |
| Stripe Managed Payments (MoR adds 20% VAT), standard card | £24.00 | 36p + 20p + 17p + 84p = **£1.57** | 7.8% |
| Paddle (MoR adds 20% VAT) | £24.00 | £1.20 + 50¢ (about 38p to 40p) = **about £1.59** | about 8% |

An MoR is the legal seller, so it charges UK VAT on every UK sale even while Rota Ready itself is below the VAT threshold. VAT-registered venues reclaim it. For small unregistered venues it's a real 20% price rise, or 20% less revenue if the price is VAT-inclusive. This is an inference from how MoRs work (see "UK VAT and invoices" below). Confirm it with an accountant.

## UK VAT and invoices

- **HMRC:** you must register for VAT once taxable turnover over the last 12 months "goes over £90,000 (the VAT threshold)". You can register voluntarily below it ([gov.uk/register-for-vat](https://www.gov.uk/register-for-vat)).
- **Stripe Billing (Rota Ready is the seller):** Rota Ready is responsible for VAT. Below £90k it charges none. Above it, it adds a 20% Tax Rate, and invoices and receipts show the tax line. Customer tax IDs can be stored and printed on invoice PDFs, and customers can update their tax ID in the portal ([customer portal](https://docs.stripe.com/customer-management)). Rota Ready files its own VAT return (quarterly, a single UK rate). Stripe Billing emails invoices and receipts automatically.
- **Stripe Managed Payments:** Stripe (selling as Onelink) "calculates and collects", "registers and files", "remits", and "issues tax invoices" in more than 80 countries, GB included, for both domestic and cross-border sales ([tax compliance](https://docs.stripe.com/payments/managed-payments/tax-compliance)). Receipts and invoices come from Onelink, and statements read `LINK.COM* <descriptor>` ([how it works](https://docs.stripe.com/payments/managed-payments/how-it-works)).
- **Paddle:** Paddle is the seller to the buyer and handles tax and invoicing. VAT-registered business buyers enter a VAT ID to avoid VAT on cross-border sales ([Paddle help: how Paddle handles VAT](https://www.paddle.com/help/sell/tax/how-paddle-handles-vat-on-your-behalf)). Paddle is a UK company, so a UK venue's purchase is a domestic sale and is charged 20% VAT (inference).

## Customer portal (cancel, change card, invoices)

- **Stripe:** the hosted, no-code customer portal, at no extra fee, lets customers update billing details and tax IDs, update payment methods, update, pause or cancel subscriptions (immediately or at period end), and view and pay invoices. It also has cancellation deflection with coupons and reasons. Limits: a subscription with **usage-based billing, multiple products or a trial can be cancelled but not updated** in the portal. Sessions are short-lived, and the portal can't sit in an iframe ([customer portal](https://docs.stripe.com/customer-management)). For Rota Ready that means the Owner can cancel and change card in the portal, and plan changes stay in the app.
- **Stripe Managed Payments:** customers manage orders on link.com (cancel, update card, billing address), and you can also offer the Customer Portal ([how it works](https://docs.stripe.com/payments/managed-payments/how-it-works)).
- **Paddle:** "fully hosted by Paddle", with nothing to set up. It shows payments and invoice PDFs, lets customers update payment details and cancel (with a cancellation flow and retention offer), and supports API deep links ([Paddle customer portal](https://developer.paddle.com/concepts/sell/customer-portal)).

## Usage add-ons (extra texts)

- **Stripe Billing:** combine a flat monthly price with a usage-based price ("fixed fee and overage"). The API records usage, and tiered or graduated pricing can make the first N texts free, so the allowance lives in Stripe ([pricing models](https://docs.stripe.com/products-prices/pricing-models)). Stripe recommends **Metronome** (now part of Stripe) for new usage-based integrations. The simpler **Meters API** "remains fully supported" and has "fuller compatibility with … Checkout" ([usage-based billing](https://docs.stripe.com/billing/subscriptions/usage-based)). For one usage line on a monthly plan, Meters are enough. A simpler option is to count texts in Rota Ready's own database and add an overage line to the next invoice.
- **Stripe Managed Payments:** subscriptions are supported through Billing, but the docs list as unsupported "Attaching invoice items on a Customer object to a Managed Payments subscription", one-off invoices, and creating subscriptions outside Checkout or Payment Links ([Managed Payments](https://docs.stripe.com/payments/managed-payments)). I couldn't find a statement on whether metered prices work under Managed Payments.
- **Paddle:** one-time charges on a subscription, `immediately` or `next_billing_period` (added to the renewal), not prorated, and blocked within 30 minutes of renewal or when the subscription is past due ([bill a one-time charge](https://developer.paddle.com/build/subscriptions/bill-add-one-time-charge)). Paddle's native usage-based billing is an early-access beta. Rota Ready would count the texts and push a charge each month.

## Trials

- **Stripe:** trials on subscriptions are supported. In the portal, a trialing subscription can be cancelled but not updated. By default, a portal change ends the trial unless `trial_update_behavior: continue_trial` is set ([customer portal](https://docs.stripe.com/customer-management)). Under Managed Payments, Stripe always sends a trial start email, and for trials over 7 days a trial ending reminder ([how it works](https://docs.stripe.com/payments/managed-payments/how-it-works)).
- **Paddle:** supports trials on prices (standard Paddle Billing feature; not looked up in detail here).

## Webhooks

- **Stripe:** `checkout.session.completed` plus subscription and invoice events. Stripe says to rely on webhooks, not the success page ([Managed Payments set-up](https://docs.stripe.com/payments/managed-payments/set-up)). The Stripe CLI forwards webhooks to localhost for development.
- **Paddle:** `transaction.created` and `subscription.updated`, among others ([bill a one-time charge](https://developer.paddle.com/build/subscriptions/bill-add-one-time-charge)).

## Setup effort for a solo developer (Vite SPA + Express on Render)

With Stripe Billing, the work is about the same for every option:

1. Create a product and monthly price in the Dashboard, and turn on and brand the customer portal (no code).
2. Add an Express route that creates a Checkout Session (`mode: subscription`) and returns its URL. The SPA redirects to it.
3. Add an Express route that creates a portal session for the Owner's "Manage billing" button.
4. Add a webhook route (raw body, signature check) that stores subscription status on the Venue or owner, which decides Free or Pro.
5. Later, for extra texts: a meter and a metered price, with usage sent when a text goes out.

No card data touches Rota Ready. Checkout and the portal are hosted, which keeps PCI scope minimal. Paddle and Managed Payments need the same webhook and plan-status code. They also add an onboarding review: Paddle reviews the website and domain, and Managed Payments has an eligibility review that requires an eligible SaaS tax code (`txcd_10103001`, SaaS for business use) ([eligibility](https://docs.stripe.com/payments/managed-payments/eligibility)). Rota Ready qualifies: GB is a supported business location and SaaS is supported.

## What this leaves for the PRD

- Price and text allowance (other tickets on #140). The fee table above can be recomputed for the chosen price.
- Whether to accept Bacs Direct Debit as well as cards. It is cheaper (1%, capped at £4) but slower to confirm.
- VAT: until turnover nears £90k, Rota Ready charges no VAT. Record registering, and adding a 20% Tax Rate, as a later step. Get an accountant's view before charging money.
- Anything costing money is a decision for the map, not something to set up now (map #140 Notes). A Stripe account costs nothing until it takes payments.

## Sources (read 24 November 2026)

- Stripe UK pricing: https://stripe.com/gb/pricing
- Stripe UK local payment methods pricing: https://stripe.com/gb/pricing/local-payment-methods
- Stripe Managed Payments pricing: https://stripe.com/gb/managed-payments
- Managed Payments docs: https://docs.stripe.com/payments/managed-payments, /how-it-works, /eligibility, /tax-compliance, /set-up
- Stripe customer portal: https://docs.stripe.com/customer-management
- Stripe usage-based billing: https://docs.stripe.com/billing/subscriptions/usage-based
- Stripe pricing models: https://docs.stripe.com/products-prices/pricing-models
- Stripe tax rates: https://docs.stripe.com/billing/taxes/tax-rates
- Paddle pricing: https://www.paddle.com/pricing
- Paddle customer portal: https://developer.paddle.com/concepts/sell/customer-portal
- Paddle one-time charges: https://developer.paddle.com/build/subscriptions/bill-add-one-time-charge
- Paddle VAT help: https://www.paddle.com/help/sell/tax/how-paddle-handles-vat-on-your-behalf
- Lemon Squeezy home and pricing: https://www.lemonsqueezy.com/, https://www.lemonsqueezy.com/pricing
- HMRC, register for VAT: https://www.gov.uk/register-for-vat
