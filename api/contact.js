// api/contact.js
// Vercel serverless function (Node.js runtime).
// This file becomes a live endpoint at /api/contact purely by living at
// this path — no routing config needed, that's Vercel's convention.
//
// Handles all three of the site's forms — Contact "Send a Message",
// Researcher Registration, and Join Research Community — each sends its
// own payload shape, all normalized below into one email to you.
//
// Contract with the frontend (wired in index.html):
//   POST /api/contact
//   body:     { formType, name, email, subject?, message, ...anything else }
//   success:  { ok: true }
//   failure:  { ok: false, error: string }
//
// ═══════════════════════════════════════════════════════════════════════
// SETUP REQUIRED — this cannot work until you do this:
//   1. Go to resend.com -> sign up (free tier: 100 emails/day, 3000/month,
//      no credit card needed to start) -> API Keys -> create a key.
//   2. Vercel dashboard -> your project -> Settings -> Environment
//      Variables -> add:
//        RESEND_API_KEY = <the key from step 1>
//        NOTIFY_EMAIL   = hello.nmassociation@gmail.com   (or your inbox)
//   3. Redeploy (env var changes need a redeploy to take effect).
//
// IMPORTANT — the "from" address below (onboarding@resend.dev) is Resend's
// own shared test address, which works immediately with zero setup, but
// Resend may rate-limit or eventually restrict shared-domain sending.
// For a permanent, professional setup: in Resend, add and verify your own
// domain (nmresearch.co.in) under Domains — a few DNS records, takes
// ~10 minutes — then change FROM_EMAIL below to something like
// "NM Group Website <notify@nmresearch.co.in>". Not required to get this
// working today, but do it before you rely on this for real leads.
// ═══════════════════════════════════════════════════════════════════════

const FROM_EMAIL = 'NM Group Website <onboarding@resend.dev>';
const MAX_FIELD_LENGTH = 3000;

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX_REQUESTS;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .toString()
    .split(',')[0]
    .trim();

  if (!checkRateLimit(ip)) {
    res.status(429).json({ ok: false, error: 'Too many submissions — please wait a moment and try again.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { formType, name, email, subject, message, ...extra } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ ok: false, error: 'Name is required.' });
    return;
  }
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    res.status(400).json({ ok: false, error: 'A valid email is required.' });
    return;
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ ok: false, error: 'Message is required.' });
    return;
  }
  if (message.length > MAX_FIELD_LENGTH) {
    res.status(400).json({ ok: false, error: 'Message is too long.' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const notifyTo = process.env.NOTIFY_EMAIL || 'hello.nmassociation@gmail.com';
  if (!apiKey) {
    console.error('[api/contact] RESEND_API_KEY is not set in Vercel environment variables.');
    res.status(500).json({ ok: false, error: 'Email notifications are not configured on the server yet.' });
    return;
  }

  const kindLabel = {
    contact: 'Contact form',
    registration: 'Researcher Registration',
    community: 'Join Research Community',
  }[formType] || 'Website form';

  const extraLines = Object.entries(extra)
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `${k}: ${String(v).trim()}`)
    .join('\n');

  const emailSubject = `[${kindLabel}] ${subject ? subject : 'New submission from ' + name.trim()}`;
  const emailText = [
    `New ${kindLabel.toLowerCase()} submission from your website.`,
    '',
    `Name: ${name.trim()}`,
    `Email: ${email.trim()}`,
    extraLines,
    '',
    'Message:',
    message.trim(),
  ].filter(Boolean).join('\n');

  try {
    const upstream = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [notifyTo],
        reply_to: email.trim(),
        subject: emailSubject,
        text: emailText,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      console.error('[api/contact] Resend API error:', upstream.status, errText);
      res.status(502).json({ ok: false, error: 'Could not send the notification email. Please try again shortly.' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[api/contact] Handler error:', err);
    res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
}
