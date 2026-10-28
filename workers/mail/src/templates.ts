/**
 * Auth email copy and layout. Voice follows docs/content-style-guide.md:
 * sentence case, plain words, colons instead of em dashes, one clear action.
 * Layout is a single table-based column with inline styles so it holds up
 * in Gmail, Apple Mail and Outlook.
 */

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

interface EmailContent {
  subject: string
  heading: string
  intro: string
  /** Primary button; omitted for notices */
  action?: { label: string; url: string }
  /** Shown as a large code (reauthentication, OTP sign-in) */
  code?: string
  /** Small print under the button */
  footnote: string
}

const COLORS = {
  page: '#f6f1eb',
  card: '#fbf8f3',
  ink: '#403a34',
  body: '#333333',
  muted: '#6b625a',
  clay: '#9c5b3c',
  rule: '#d8cfc3',
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function layout(c: EmailContent, siteUrl: string): RenderedEmail {
  const button = c.action
    ? `<tr><td style="padding:8px 0 24px">
         <a href="${escapeHtml(c.action.url)}" style="display:inline-block;background:${COLORS.clay};color:#ffffff;text-decoration:none;font:600 16px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;padding:16px 28px;border-radius:2px">${escapeHtml(c.action.label)}</a>
       </td></tr>
       <tr><td style="padding:0 0 24px;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${COLORS.muted}">
         Button not working? Paste this link into your browser:<br>
         <a href="${escapeHtml(c.action.url)}" style="color:${COLORS.clay};word-break:break-all">${escapeHtml(c.action.url)}</a>
       </td></tr>`
    : ''
  const code = c.code
    ? `<tr><td style="padding:8px 0 24px">
         <div style="display:inline-block;border:1px solid ${COLORS.rule};background:#ffffff;padding:14px 22px;font:600 28px/1 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:6px;color:${COLORS.ink}">${escapeHtml(c.code)}</div>
       </td></tr>`
    : ''

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(c.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page}">
  <tr><td align="center" style="padding:40px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
      <tr><td style="padding:0 0 24px;font:400 26px/1 Georgia,'Times New Roman',serif;color:${COLORS.ink}">bart<em style="color:${COLORS.clay}">rrr</em></td></tr>
      <tr><td style="background:${COLORS.card};border:1px solid ${COLORS.ink};padding:32px 28px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:0 0 16px;font:400 28px/1.15 Georgia,'Times New Roman',serif;color:${COLORS.ink}">${escapeHtml(c.heading)}</td></tr>
          <tr><td style="padding:0 0 24px;font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${COLORS.body}">${escapeHtml(c.intro)}</td></tr>
          ${button}
          ${code}
          <tr><td style="border-top:1px solid ${COLORS.rule};padding:20px 0 0;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${COLORS.muted}">${escapeHtml(c.footnote)}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:24px 0 0;font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${COLORS.muted}">
        Bartrrr: trade, don't buy. Neighbors in Memphis swapping goods, skills and services.<br>
        <a href="${escapeHtml(siteUrl)}" style="color:${COLORS.muted}">bartrrr.app</a> · Questions? Reply to this email.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

  const text = [
    c.heading,
    '',
    c.intro,
    '',
    ...(c.action ? [`${c.action.label}: ${c.action.url}`, ''] : []),
    ...(c.code ? [`Your code: ${c.code}`, ''] : []),
    c.footnote,
    '',
    `Bartrrr: trade, don't buy. ${siteUrl}`,
    'Questions? Reply to this email.',
  ].join('\n')

  return { subject: c.subject, html, text }
}

export type EmailKind =
  | { kind: 'signup'; url: string }
  | { kind: 'recovery'; url: string }
  | { kind: 'magiclink'; url: string; code?: string }
  | { kind: 'invite'; url: string }
  | { kind: 'email_change_new'; url: string }
  | { kind: 'email_change_current'; url: string; newEmail: string }
  | { kind: 'reauthentication'; code: string }
  | { kind: 'otp'; code: string }
  | { kind: 'password_changed' }
  | { kind: 'email_changed'; oldEmail?: string }
  | { kind: 'account_updated' }

const IGNORE = "If you didn't ask for this, you can ignore this email. Nothing will change."
const NOT_YOU = "If this wasn't you, reply to this email right away so we can help secure your account."

export function renderEmail(e: EmailKind, siteUrl: string): RenderedEmail {
  switch (e.kind) {
    case 'signup':
      return layout({
        subject: 'Confirm your email for Bartrrr',
        heading: 'Welcome, neighbor.',
        intro: 'Confirm your email to finish creating your Bartrrr account. Then you can post what you have and see what neighbors nearby are offering.',
        action: { label: 'Confirm my email', url: e.url },
        footnote: `This link works for 1 hour. ${IGNORE}`,
      }, siteUrl)
    case 'recovery':
      return layout({
        subject: 'Reset your Bartrrr password',
        heading: 'Choose a new password.',
        intro: 'Someone, hopefully you, asked to reset the password for your Bartrrr account. Use the button below to choose a new one.',
        action: { label: 'Choose a new password', url: e.url },
        footnote: `This link works for 1 hour and only once. ${IGNORE}`,
      }, siteUrl)
    case 'magiclink':
      return layout({
        subject: 'Your Bartrrr sign-in link',
        heading: 'Sign in to Bartrrr.',
        intro: 'Use the button below to sign in. No password needed.',
        action: { label: 'Sign in', url: e.url },
        code: e.code,
        footnote: `This link works for 1 hour and only once. ${IGNORE}`,
      }, siteUrl)
    case 'invite':
      return layout({
        subject: "You're invited to Bartrrr",
        heading: "You're invited.",
        intro: 'A neighbor invited you to Bartrrr, where people in Memphis trade goods, skills and services without money. Accept to set up your account.',
        action: { label: 'Accept invite', url: e.url },
        footnote: IGNORE,
      }, siteUrl)
    case 'email_change_new':
      return layout({
        subject: 'Confirm your new email for Bartrrr',
        heading: 'Confirm your new email.',
        intro: 'Confirm this address to start using it for your Bartrrr account.',
        action: { label: 'Confirm new email', url: e.url },
        footnote: `This link works for 1 hour. ${IGNORE}`,
      }, siteUrl)
    case 'email_change_current':
      return layout({
        subject: 'Confirm your Bartrrr email change',
        heading: 'Confirm your email change.',
        intro: `Someone asked to change your Bartrrr email to ${e.newEmail}. Confirm from this address to approve it.`,
        action: { label: 'Approve the change', url: e.url },
        footnote: `This link works for 1 hour. ${NOT_YOU}`,
      }, siteUrl)
    case 'reauthentication':
      return layout({
        subject: 'Your Bartrrr confirmation code',
        heading: 'Confirm it’s you.',
        intro: 'Enter this code in Bartrrr to continue.',
        code: e.code,
        footnote: `This code works for 1 hour. ${IGNORE}`,
      }, siteUrl)
    case 'otp':
      return layout({
        subject: 'Your Bartrrr sign-in code',
        heading: 'Your sign-in code.',
        intro: 'Enter this code in Bartrrr to sign in.',
        code: e.code,
        footnote: `This code works for 1 hour. ${IGNORE}`,
      }, siteUrl)
    case 'password_changed':
      return layout({
        subject: 'Your Bartrrr password was changed',
        heading: 'Your password was changed.',
        intro: 'The password for your Bartrrr account was just changed.',
        footnote: NOT_YOU,
      }, siteUrl)
    case 'email_changed':
      return layout({
        subject: 'Your Bartrrr email was changed',
        heading: 'Your email was changed.',
        intro: e.oldEmail
          ? `Your Bartrrr account no longer uses ${e.oldEmail}.`
          : 'The email address on your Bartrrr account was just changed.',
        footnote: NOT_YOU,
      }, siteUrl)
    case 'account_updated':
      return layout({
        subject: 'Your Bartrrr account was updated',
        heading: 'Your account was updated.',
        intro: 'A sign-in or security setting on your Bartrrr account was just changed.',
        footnote: NOT_YOU,
      }, siteUrl)
  }
}
