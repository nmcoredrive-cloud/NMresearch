// lib/mailer.mjs
// Shared helpers for the NM Group form endpoints (contact / register / community).
// .mjs extension forces ES module parsing regardless of the project's
// package.json "type" setting, so this works no matter how the rest of the
// project (Vite frontend, existing api/ai/chat.js) is configured.
// Lives OUTSIDE /api on purpose — Vercel turns every file directly inside
// /api into its own route, so shared code must sit elsewhere and be imported.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LEN = 200;    // short fields: name, subject, affiliation, etc.
const MAX_MESSAGE_LEN = 5000; // long fields: message / publications

/** Trim, strip control chars and HTML tags, hard-cap length. */
export function sanitize(value, maxLen = MAX_FIELD_LEN) {
  if (value == null) return '';
  let s = String(value);
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
  s = s.trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/** Same as sanitize() but preserves single newlines (Message / Publications). */
export function sanitizeMultiline(value, maxLen = MAX_MESSAGE_LEN) {
  if (value == null) return '';
  let s = String(value);
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/\r\n/g, '\n').replace(/[ \t]{2,}/g, ' ');
  s = s.trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

export function isValidEmail(value) {
  return typeof value === 'string' && value.length <= MAX_FIELD_LEN && EMAIL_RE.test(value.trim());
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Build a simple, professional table-style HTML email body from a field map. */
export function buildEmailHtml(heading, fields) {
  const rows = fields
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(
      ([label, v]) =>
        `<tr><td style="padding:8px 14px;font-weight:600;color:#0a2463;border-bottom:1px solid #eee;white-space:nowrap;">${escapeHtml(
          label
        )}</td><td style="padding:8px 14px;color:#222;border-bottom:1px solid #eee;">${escapeHtml(
          v
        ).replace(/\n/g, '<br>')}</td></tr>`
    )
    .join('');

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#0a2463;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
      <h2 style="margin:0;font-size:18px;">${escapeHtml(heading)}</h2>
      <div style="font-size:12px;opacity:0.8;margin-top:4px;">NM Group of Industries and Research Foundation — Website</div>
    </div>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eee;border-radius:0 0 8px 8px;">
      ${rows}
    </table>
  </div>`;
}

/**
 * Send an email via the Resend API (https://resend.com).
 * Requires env vars: RESEND_API_KEY, EMAIL_TO, EMAIL_FROM.
 * Returns { ok: true } or { ok: false, error } — error is for server logs
 * only; callers must NEVER forward it to the client response.
 */
export async function sendEmail({ subject, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.EMAIL_TO;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !to || !from) {
    return { ok: false, error: 'Missing RESEND_API_KEY, EMAIL_TO, or EMAIL_FROM env var' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `Resend API ${res.status}: ${detail}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Resend request failed: ${err.message}` };
  }
}

/** Very light spam guard: honeypot field must be empty, and method must be POST. */
export function rejectIfSpamOrBadMethod(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed.' });
    return true;
  }
  const body = req.body || {};
  if (body._hp) {
    // Honeypot tripped — respond as if it succeeded so bots learn nothing,
    // but never actually send an email.
    res.status(200).json({ success: true });
    return true;
  }
  return false;
}
