# UK SMS providers for Pro's text notifications and reminders

Research for #141 (part of the Pro PRD map, #140). All prices were read from the providers' own pricing pages and docs on **24 November 2026**. They exclude VAT and they change often, so check them again before Pro is priced.

## What Pro needs

- One-way texts to UK mobiles: the Staff Link and changes on Publish / Send Updates, and a reminder the day before a Shift.
- A sender name such as `RotaReady` rather than a phone number.
- Delivery reports, so the app can show whether a text arrived and count it against the Venue's monthly allowance.
- A Node API callable from the Express API on Render.
- No monthly commitment while volumes are small.

## Comparison

| Provider | Price per UK text (one segment) | Minimum / commitment | Alphanumeric sender | Delivery reports | Node API | Free trial |
|---|---|---|---|---|---|---|
| **Twilio** | **$0.056** per segment, all volumes until volume discounts ([pricing][twilio-price]) | None, pay as you go | Free, no UK pre-registration ([pricing][twilio-price], [UK guidelines][twilio-gb]) | Status callbacks per message | Official `twilio` npm package | Trial credit; trial accounts send only to verified numbers |
| **AWS End User Messaging SMS** | **$0.05** ([price CSV][aws-csv], linked from [pricing][aws-price]) | None, but new accounts start in a sandbox with a low spend limit raised by support request | Supported | Event destinations (SNS, CloudWatch, Firehose) | AWS SDK v3 | Sandbox only |
| **ClickSend** | **4.11p** (top-ups from £10), 3.72p (from £300), 3.30p (from £1,500) ([pricing][clicksend]) | £10 top-up; "additional carrier fees apply", amounts not listed | Yes | Yes | Official SDK | Free trial |
| **The SMS Works** (UK) | **4.4p** standard; from 3.1p at high volume ([pricing][smsworks]) | £10 minimum for BACS invoices; credits never expire; undelivered UK texts refunded | Yes, 4 to 11 characters, no spaces ([docs][smsworks-dev]) | Webhook per message ([docs][smsworks-dev]) | SDK on GitHub (`TheSMSWorks/smsw-nodejs-sdk`) | 50 free test credits |
| **Firetext** (UK) | **5p** (500 credits for £25) ([pricing][firetext]) | No contract; credits don't expire | Yes | Yes | REST API | Free trial, no card |
| **Vonage** | Not published for the UK without an account: the rate table didn't load and the page points to a downloadable sheet or the dashboard ([pricing][vonage]) | — | — | — | Official SDK | "Try it free" |

Dollar prices are in USD. At an assumed $1.30 to the pound (check the rate on the day), Twilio's $0.056 is about **4.3p** and AWS's $0.05 is about **3.8p**.

## Monthly cost at 500 and 2,000 texts

Assuming every text fits in one segment (see *Segments* below). Excluding VAT.

| Provider | 500 texts | 2,000 texts |
|---|---|---|
| Twilio | $28 (about £22) | $112 (about £86) |
| AWS End User Messaging | $25 (about £19) | $100 (about £77) |
| ClickSend (£10 top-ups at 4.11p) | £20.55 + carrier fees | £82.20 + carrier fees |
| The SMS Works (4.4p) | £22 | £88 |
| Firetext (5p) | £25 | £100 |

At these volumes the providers are within a few pounds of each other. The choice should rest on reliability, developer experience and operational burden, not price.

## Segments

A segment is 160 GSM-7 characters, or 70 if the text contains any character outside GSM-7 (an emoji, a curly quote, some accented letters), and long texts are split and each part is charged ([Twilio UK guidelines][twilio-gb]). A text with a Staff Link URL and a list of changed Shifts can easily pass 160 characters, so:

- Keep templates in plain GSM-7 and short: name, "your rota has changed", the Staff Link. Put the detail behind the link.
- Count segments, not texts, against the monthly allowance, or cap each notification at one segment.
- Translated templates (`t()`) need checking too: some languages force UCS-2 and halve the limit.

## UK sender-name rules

- Alphanumeric sender IDs are supported in the UK and need **no pre-registration**, and the sender ID is preserved ([Twilio UK guidelines][twilio-gb]).
- Up to 11 characters; letters, numbers and a few symbols. The SMS Works allows 4 to 11 characters with no spaces ([docs][smsworks-dev]). `RotaReady` (9) fits.
- Generic IDs such as `SMS`, `TEXT`, `INFO`, `Alert` and `Verify` are blocked by UK operators ([Twilio][twilio-gb], [The SMS Works][smsworks-dev]).
- Brand names protected by the MEF SenderID Protection Registry or BT must be pre-registered with the provider, and BT blocks unlisted brand-related IDs by default ([Twilio UK guidelines][twilio-gb]). `RotaReady` isn't a protected brand today; registering it once Pro launches would stop others spoofing it.
- **Recipients can't reply to an alphanumeric sender** ([Twilio opt-out keywords][twilio-stop], [The SMS Works][smsworks-dev]).

## Opt-out handling

- Because nobody can reply to `RotaReady`, provider STOP handling doesn't apply: Twilio says its STOP, START and HELP keywords "are not applicable for Alpha Sender IDs" ([Twilio][twilio-stop]). The SMS Works documents no STOP handling at all ([docs][smsworks-dev]).
- So Rota Ready must own opt-out: a per-Staff-Member "texts on / off" setting, reachable from the Staff Link page, which the API checks before sending. Each text can end with a short line such as "Stop texts: <link>" if segment length allows.
- Rota texts are service messages, not marketing. The ICO frames PECR's consent and opt-out rules around marketing ([ICO, electronic mail marketing][ico-pecr]), so they likely don't apply, but UK GDPR still needs a lawful basis for using Staff Members' phone numbers. That belongs to the map's *Legal* question, not this one.
- Twilio also asks senders to text only during daytime unless urgent ([UK guidelines][twilio-gb]); schedule day-before reminders for, say, 10:00 to 18:00 UK time.

## Recommendation

**Twilio**, with an alphanumeric sender `RotaReady`.

- About 4.3p a text: roughly **£22 a month at 500 texts and £86 at 2,000**, excluding VAT, with no minimum spend and no number rental (the alpha sender is free).
- The most mature Node SDK and docs, per-message status callbacks for delivery reports and allowance accounting, a trial account to build against, and a Messaging Service that can later add a UK long code if two-way texting is ever wanted.
- Downsides: billed in USD, so the GBP cost moves with the exchange rate; and it's about 10 to 15% dearer than AWS.

**Runner-up: The SMS Works** if a UK, GBP-billed provider matters more than SDK maturity: 4.4p, credits that never expire, and refunds for undelivered texts. Its Node SDK is a less-used GitHub project, so expect to call its REST API directly.

AWS is cheapest but adds an AWS account, IAM, a sandbox and a support request to raise the spend limit, which is a lot of operational weight for an app hosted on Render with no other AWS use.

Whichever is chosen, put it behind a small `TextSender` module in the API so the provider can be swapped, and set Pro's allowance in segments with headroom: at 4.3p, an allowance of 500 texts costs about £22 a month before VAT, which sets a floor under Pro's price.

## Not checked

- Vonage's UK rate (needs an account or the downloadable sheet).
- ClickSend's and Twilio's UK carrier fees, which both pages mention without amounts.
- Bird (formerly MessageBird), Esendex and Sinch.

[twilio-price]: https://www.twilio.com/en-us/sms/pricing/gb
[twilio-gb]: https://www.twilio.com/en-us/guidelines/gb/sms
[twilio-stop]: https://support.twilio.com/hc/en-us/articles/223134027-Twilio-Support-for-Opt-out-Keywords-SMS-STOP-Filtering
[aws-price]: https://aws.amazon.com/end-user-messaging/pricing/
[aws-csv]: https://d1.awsstatic.com/onedam/marketing-channels/website/aws/en_US/business-applications/approved/documents/End-User-Messaging-SMS-Prices.ebc340b4d416d90832dd59629c4792b0deb6f8bc.csv
[clicksend]: https://www.clicksend.com/gb/pricing/gb/
[smsworks]: https://www.thesmsworks.co.uk/pricing
[smsworks-dev]: https://thesmsworks.co.uk/developers
[firetext]: https://www.firetext.co.uk/pricing
[vonage]: https://www.vonage.co.uk/communications-apis/sms/pricing/
[ico-pecr]: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/
