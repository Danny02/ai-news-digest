# 03 — Email delivery mechanism

**Status:** decided
**Date:** (generated)
**Blocked by:** none (independent of runner choice 04)

## Recommendation

**Use Resend (transactional email API) on its Free plan.**

For one text digest per day (~30 emails/month), Resend Free gives you $0/month,
3,000 emails/month, and a 100 emails/day cap. You sit far inside every limit.
You authenticate with a dedicated API key, not your personal-mail credentials.
The machine sends through Resend's shared SMTP infrastructure with proper
domain authentication, which is the most reliable path to the inbox for an
automated sender.

Send via the Resend Node.js SDK (one call, no SMTP plumbing):

```js
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: "AI News Digest <digest@yourdomain.com>",
  to: ["you@example.com"],
  subject: "AI news digest — 2025-06-01",
  text: "…your text digest…",
});
```

The REST equivalent is a `POST https://api.resend.com/emails` with an
`Authorization: Bearer <API_KEY>` header and a JSON body of
`{ from, to, subject, text }`. The SDK is the simplest shape; no SMTP client
or config is required.

Credentials: one `RESEND_API_KEY` environment variable on the runner. This is a
service-scoped key with "Sending access" (optionally locked to one domain).
It cannot read or send anything from your personal email accounts, so a leak is
contained to this job. Prefer this over storing a Gmail/Outlook app password.

## Runner-up

**Postmark (Developer plan)** if you prefer a provider that charges only for
volume and wants a second dedicated-service option. Postmark's free Developer
plan is 100 emails/month at $0, an auto-granted no-expiration trial. It fits
~30/month and also authenticates with a service API token. The trade-off: the
free tier is smaller (100 vs 3,000/month), so it gives you little room to grow,
and Postmark mainly targets transactional delivery. Both Resend and Postmark
require verifying a sending domain (SPF/DKIM) before production sends. Choose
Resend over Postmark only because the free tier is 30× larger and the SDK/REST
shape is marginally simpler; either is a sound choice.

## Comparison

| Mechanism | Free tier | Limit fit (~30/mo) | Auth | Deliverability | Setup | Notes |
|---|---|---|---|---|---|---|
| **Resend** (recommended) | $0, 3,000 emails/month, 100/day cap | Yes, comfortable | Dedicated API key (Sending access, domain-restricted) | High — sends via shared IP pool with per-domain SPF/DKIM; 0.08% spam-rate and 4% bounce-rate requirements | Verify sending domain (SPF/DKIM), create API key | Quotes count To/CC/BCC recipients; full access or sending-only key; SDKs for Node, Python, Go, Java, Rust, .NET; also exposes SMTP |
| **Postmark** (runner-up) | $0, 100 emails/month (Developer plan, no-expiration trial) | Yes, but tight headroom | Service API token (Server token) | High — transactional-focused, strong reputation, requires sender signature | Verify domain / sender signature | Free tier smaller (100/mo); paid plans start at 10,000/mo (~$15); no overage on free |
| **SendGrid** | $0, 100 emails/day, but **60-day trial only**; permanent free plan retired May 2025 | Yes while trial lasts, then paid | API key | High | Domain authentication (SPF/DKIM) | Not a stable free option — free tier is temporary, so it drops out of consideration |
| **Gmail app password** (SMTP `smtp.gmail.com`) | 500 emails/day / 500 recipients/day | Yes | **Personal-mail app password** (requires 2-Step Verification on) | Lower/reliant on personal reputation; consumer Gmail not designed for automated senders | Turn on 2-Step Verification, generate app password, SMTP config | App password is a credential to a real personal inbox — a leak is higher-impact; no domain-based reputation isolation; Outlook `smtp.office365.com` similar route |
| **Plain SMTP (self-hosted / relay)** | N/A or provider-dependent | Depends on relay | Varies | Poor without proper SPF/DKIM/DMARC and warmed IP | Highest: run/maintain MTA or configure relay | Most effort, worst deliverability; no reason for a single daily message |

### Weighting against the decision criteria

- **Free-tier fit for ~30 emails/month:** Resend (3,000), Postmark (100),
  SendGrid (100/day) all fit; Resend has the widest margin.
- **Setup effort:** Resend/SDK is a single `createClient` + `send` call after
  one domain verification; Gmail needs 2-Step Verification + app password +
  SMTP config.
- **Reliability/deliverability:** Dedicated transactional APIs with verified
  domains land in the inbox more reliably than a consumer mailbox; Gmail SMTP
  is acceptable only at very low volume to trusted recipients.
- **Credential sensitivity (weighted strongest):** An API key is service-scoped
  and revocable with no access to personal mail. A Gmail/Outlook app password
  is a live credential to a personal inbox — leaking it is far more damaging.
  This tips the decision to a dedicated service (Resend/Postmark) and against
  the app-password route.

## Primary sources

- Resend pricing (Free = $0, 3,000 emails, 100/day): https://resend.com/pricing
- Resend account quotas and limits (100 emails/day, 3,000/month, daily cap,
  recipients count separately, no free overages): https://resend.com/docs/knowledge-base/account-quotas-and-limits
- Resend API keys (create key, Sending vs Full access, server-side secret):
  https://resend.com/docs/dashboard/api-keys/introduction
- Resend SDKs (Node.js and others): https://resend.com/docs/sdks
- Resend Send Email API (fields `from`/`to`/`subject`): https://resend.com/docs/api-reference/emails/send-email
- Postmark pricing (free Developer plan, 100 emails/month, no-expiration
  trial): https://postmarkapp.com/pricing/
- SendGrid / Twilio Email API pricing (100/day, 60-day trial, $0): https://www.twilio.com/en-us/products/email-api/pricing
- Twilio changelog "Changes coming to SendGrid's Free Plan" (free plan retired
  May 2025): https://www.twilio.com/en-us/changelog/sendgrid-free-plan
- Gmail Help — Limits for sending & getting mail (500 recipients/500 emails per
  day, 1–24h restore): https://support.google.com/mail/answer/22839
- Google Account Help — Sign in with app passwords (16-digit code, requires
  2-Step Verification): https://support.google.com/accounts/answer/185833

## Decision-ready summary

- **Choose:** Resend Free — $0, 3,000 emails/month, 100 emails/day. Fits one
  daily digest with 100× headroom.
- **Auth:** one `RESEND_API_KEY` env var (Sending access, domain-restricted).
  Service-scoped; a leak cannot touch your personal mail.
- **Send:** `resend.emails.send({ from, to, subject, text })` via the Node SDK,
  or a `POST /emails` REST call.
- **Setup:** verify one sending domain (SPF/DKIM), create the key, store the
  key on the runner. ~15 minutes.
- **Runner-up:** Postmark Developer plan ($0, 100 emails/month) if you prefer a
  dedicated transactional sender with a smaller free tier.
- **Avoid:** Gmail/Outlook app passwords (personal-credential risk, weaker
  automated deliverability) and SendGrid (free tier is a temporary 60-day
  trial).
