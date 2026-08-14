# 03 — Choose the email delivery mechanism

Status: resolved
Type: research
Blocked by:

## Question

How should the digest's email actually be sent each day?

Resolve as a decision with a recommendation. Weigh:

- Providers/mechanisms: a transactional email API (Resend, Postmark, SendGrid),
  plain SMTP, or a personal Gmail/Outlook app-password route.
- Free-tier fit for one daily message (most transactional APIs allow this free).
- What credentials live where the runner (04) runs, and how sensitive they are.
- Reliability and deliverability (spam folder risk).

The delivery *channel* (email) is already decided; this ticket picks the
*machinery*. It is independent of 04's runner choice — email APIs work from any
runner — so it is unblocked.

## Answer

**Use Resend (transactional email API) on its Free plan.**

- $0/mo, 3,000 emails/month, 100/day cap — one daily digest sits far inside
  every limit.
- Auth: one `RESEND_API_KEY` env var (Sending access, domain-restricted).
  Service-scoped key; a leak cannot touch personal mail.
- Send: `resend.emails.send({ from, to, subject, text })` via Node SDK, or
  `POST /emails` REST.
- Setup: verify one sending domain (SPF/DKIM), create key, store on runner
  (~15 min).
- Runner-up: Postmark Developer plan ($0, 100 emails/month).
- Avoid: Gmail/Outlook app passwords (personal-credential risk, weaker
  automated deliverability) and SendGrid (free tier is a temporary 60-day
  trial).

Full findings + primary sources:
`research/03-email-delivery-mechanism.md` on branch `research/03`.
