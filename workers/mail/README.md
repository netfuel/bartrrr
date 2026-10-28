# bartrrr-mail

Sends Bartrrr's auth emails (sign-up confirmation, password reset, email change, sign-in links, security notices) through **Cloudflare Email Service**. Supabase calls it through its **Send Email** auth hook, so Supabase's own mailer and SMTP settings aren't used.

```
Supabase Auth ──signed POST──▶ bartrrr-mail (Worker) ──send_email binding──▶ Cloudflare Email Service ──▶ inbox
```

- `src/webhook.ts`: verifies the Standard Webhooks signature Supabase sends (HMAC-SHA256, 5-minute timestamp tolerance).
- `src/index.ts`: maps each `email_action_type` to the email(s) to send. Secure email change sends two: one to the current address, one to the new one.
- `src/templates.ts`: copy and HTML. Edit wording here; it follows `docs/content-style-guide.md`.
- Sender: `no-reply@bartrrr.app` (bartrrr.app is onboarded under Email Service → Email Sending). Replies go to `hello@bartrrr.app`, which forwards via Email Routing.

## Setup

1. **Cloudflare → Workers & Pages → Create → Import a repository** → `netfuel/bartrrr`. Project name `bartrrr-mail`, **root directory `workers/mail`**, deploy command `npx wrangler deploy`. Builds on every push to `main`.
2. **Supabase → Authentication → Auth Hooks → Add hook → Send Email hook**: type HTTPS, URL `https://bartrrr-mail.netfuel.workers.dev`, then **Generate secret**. Copy the secret (`v1,whsec_…`).
3. **Cloudflare → bartrrr-mail → Settings → Variables and secrets → Add**: type **Secret**, name `SEND_EMAIL_HOOK_SECRET`, value the secret from step 2. Deploy.
4. Enable the hook in Supabase.

Check: `GET https://bartrrr-mail.netfuel.workers.dev/health` returns `{"ok":true}`. Every send is logged (Worker → Observability) and shows in Email Service → Email Sending → bartrrr.app → Activity log.

## Limits

Cloudflare's account-wide daily sending quota starts around 200 and grows with good sending history. Supabase still applies its own auth rate limits (Authentication → Rate Limits).
