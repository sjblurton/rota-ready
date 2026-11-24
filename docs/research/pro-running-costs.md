# What it costs each month to run Rota Ready Pro before the first customer

Research for [#143](https://github.com/sjblurton/rota-ready/issues/143), part of the map [#140](https://github.com/sjblurton/rota-ready/issues/140). All prices were read on **24 November 2026** from the providers' own pricing pages and docs, linked below. Prices are in US dollars, as the providers bill them, and exclude VAT. Text messages (SMS) are priced in their own ticket and aren't counted here.

## Answer

| | Monthly |
| --- | --- |
| **Required floor for Pro** (`.co.uk` domain) | **about $32.50** |
| Required floor with a `.com` domain instead | about $33.00 |
| Floor if the Supabase upgrade waits for the first paying customer | about $7.50 |

The required floor is a domain, a Render web service that doesn't sleep, and Supabase Pro. The real email sender costs nothing at first: Resend's free plan can verify our own domain, and both the app's emails and Supabase Auth's emails can go through it. Resend Pro ($20 a month) becomes required once we send more than 100 emails a day or 3,000 a month.

## Today

Rota Ready runs entirely free (README, **Production** and **Production auth and email settings**): Supabase Free for Auth and Postgres, a Render Free web service for the API that sleeps after 15 minutes, a Render static site for the web app, app emails through Resend's test sender `onboarding@resend.dev` (reaches only the Resend account owner), and Supabase Auth emails through Supabase's built-in sender.

## Required for Pro

| Cost | Monthly | Why Pro needs it |
| --- | --- | --- |
| Domain, `.co.uk` | $0.47 ($5.66 a year) | Resend and Supabase Auth can only send to real people from a verified domain of our own |
| *or* domain, `.com` | $0.98 ($11.81 a year) | Same |
| Render web service for the API, smallest paid size (512 MB, under 1 CPU) | $7.00 | Free web services sleep after 15 minutes, and the first request then takes about a minute |
| Render workspace, Hobby | $0 | Hobby includes 2 custom domains (the app and the API) and 5 GB of bandwidth |
| Render static site for the web app | $0 | Static sites are free on every workspace plan |
| Supabase Pro (includes $10 of compute credit, which covers the Micro instance we'd run) | $25.00 | Free has no backups, pauses a project after a week of inactivity and caps the database at 500 MB |
| Resend Free, with our domain verified | $0 | 3,000 emails a month, 100 a day, up to 3 domains |
| Supabase Auth custom SMTP through Resend | $0 | Custom SMTP comes with every Supabase plan |
| **Total** | **about $32.50** (`.co.uk`) | |

### Domain

Prices from Porkbun, a mainstream registrar, for a non-premium one-year registration, including ICANN fees: `.com` $11.81 a year, `.co.uk` $5.66 a year, the same to renew ([Porkbun](https://porkbun.com/products/domains)). Cloudflare Registrar sells at cost with "no mark up" ([Cloudflare](https://www.cloudflare.com/products/registrar/)); a third-party price list puts that at $10.46 for `.com` and $5.30 for `.co.uk` ([cfdomainpricing.com](https://cfdomainpricing.com/), not first-party). Either way, the domain is under $1 a month.

### Email sender

Resend's plans ([Resend pricing](https://resend.com/pricing)):

| Plan | Price | Emails a month | Daily limit | Domains |
| --- | --- | --- | --- | --- |
| Free | $0 | 3,000 | 100 | 3 |
| Pro | $20 | 50,000 | none | 10 |
| Pro | $35 | 100,000 | none | 10 |
| Scale | from $90 | from 100,000 | none | 1,000 |

Paid plans charge $0.90 per 1,000 emails over the allowance, with pay-as-you-go turned on.

The free plan allows our own domain, so the test sender can go as soon as the domain is verified. Before the first customer, the 100-a-day limit is plenty. One Publish emails every Staff Member at a Venue, and Pro promises unlimited Staff Members, so a handful of Pro Venues publishing on the same day would hit 100. That's the point to move to Resend Pro at $20 a month.

Supabase's built-in Auth sender "will refuse to deliver messages to addresses that are not part of the project's team" and is limited to 2 messages an hour. With custom SMTP set up, Auth sends to every address, starting at a 30-an-hour rate limit that can be raised ([Supabase SMTP docs](https://supabase.com/docs/guides/auth/auth-smtp)). Custom SMTP is included on Supabase Free and Pro ([Supabase pricing](https://supabase.com/pricing)). Auth emails sent through Resend count against the same Resend allowance.

### API that doesn't sleep

Render spins a Free web service down after 15 minutes without inbound traffic, and spinning up takes about a minute. Free web services also can't send on ports 25, 465 or 587, and share 750 free instance hours a month per workspace. "Upgrading a service to any paid compute plan removes the Free instance limitations. Upgrading your workspace plan does not." ([Render free docs](https://render.com/docs/free)).

The smallest paid web service is $7 a month for 512 MB of RAM and under 1 CPU; the next is $25 a month for 1 CPU and 2 GB ([Render pricing](https://render.com/pricing.md)). The $7 size has the same 512 MB of RAM as the Free instance the API runs on now. Render's workspace plans are a flat fee with no per-user charge, and Hobby is $0 plus compute ([Render pricing](https://render.com/pricing.md)).

Bandwidth beyond the Hobby workspace's 5 GB costs $0.15 per GB ([Render pricing](https://render.com/pricing.md)).

### Database

Supabase Free vs Pro ([Supabase pricing](https://supabase.com/pricing)):

| | Free | Pro |
| --- | --- | --- |
| Price | $0 | from $25 a month |
| Database | 500 MB | 8 GB disk, then $0.125 per GB |
| Auth monthly active users | 50,000 | 100,000, then $0.00325 each |
| Egress | 5 GB | 250 GB, then $0.09 per GB |
| Pausing | paused after 1 week of inactivity | never paused |
| Backups | none | daily, kept 7 days |
| Compute | shared | $10 credit a month, covering one Micro instance ($10) |

Supabase Pro is required before taking money, mainly for backups: on Free, losing the database means losing every customer's rotas. A non-sleeping API with real traffic keeps the project from pausing, and 500 MB is a lot of rotas, so neither is pressing on its own. That's why the upgrade *could* wait until the day the first customer pays, bringing the floor down to about $7.50 a month.

## Nice to have

| Cost | Monthly | What it buys |
| --- | --- | --- |
| Resend Pro | $20.00 | Over 100 emails a day or 3,000 a month; required once Pro Venues send that much |
| Render PR previews of the API (#28), on the Hobby workspace | $7.00 per open PR, prorated by the second | A preview of the API per PR. Static site previews are free |
| Render full-stack preview environments | $25.00 workspace (Pro) plus compute per preview | One copy of every service per PR. Needs the Pro workspace |
| Supabase branching, a database per preview | $0.01344 per branch per hour (about $9.80 for a branch open all month) | Previews with their own database rather than sharing one |
| Supabase point-in-time recovery | $100.00 per 7 days of retention | Restore to any moment rather than to last night's backup |
| Supabase Small compute instead of Micro | +$5.00 ($15 less the $10 credit) | More database headroom |
| Render 1 CPU / 2 GB API | +$18.00 ($25 instead of $7) | More API headroom |

### Previews (#28)

Render offers two kinds of preview:

- **Service previews** (pull request previews) copy one service per PR. "PR Previews are billed at the same rate as your base service", prorated by the second; free static sites get free previews; a preview of a paid service can't use the Free plan ([Render service previews](https://render.com/docs/service-previews)). Render's pricing page lists "single-service previews" on the Hobby workspace ([Render pricing](https://render.com/pricing.md)). Once the API is on the $7 plan, a PR open for a week costs about $1.60.
- **Preview environments** copy every service, datastore and environment group in a Blueprint. They "require a Pro workspace plan or higher" ($25 a month) and are billed like other services ([Render preview environments](https://render.com/docs/preview-environments)).

Our database is on Supabase, not Render, so neither kind gives a preview its own database. A preview pointing at production's database would run unmerged migrations against real data. Each preview would need a Supabase branch ($0.01344 an hour, Pro plan only) or a shared staging project.

## Caveats

- **VAT:** prices exclude VAT. Whether the providers add UK VAT depends on whether Rota Ready is VAT-registered; not researched here.
- **Currency:** every provider bills in US dollars, so the pound cost moves with the exchange rate.
- **Render's pricing page** rendered no figures when fetched directly; the figures come from its Markdown version, `render.com/pricing.md`, on the same site.
- **Cloudflare domain prices** come from a third-party list; Porkbun's are first-party.
