// api/ai/chat.js
// Vercel serverless function (Node.js runtime).
// This file becomes a live endpoint at /api/ai/chat purely by living at this
// path — no routing config needed, that's Vercel's convention.
//
// Contract with the frontend (already wired in index.html — do not change
// the shape below without also updating the fetch() call there):
//   POST /api/ai/chat
//   body:     { messages: [{ role: 'user'|'assistant', content: string }, ...] }
//   success:  { ok: true,  reply: string }
//   failure:  { ok: false, error: string }
//
// ═══════════════════════════════════════════════════════════════════════
// SETUP REQUIRED — this cannot work until you do this one thing:
//   Vercel dashboard → your project → Settings → Environment Variables
//   → add ANTHROPIC_API_KEY = <your real key from console.anthropic.com>
//   Redeploy after adding it (env var changes need a redeploy to take
//   effect on already-built serverless functions).
// Until that's set, this endpoint returns a clear "not configured" error
// instead of a confusing crash — check Vercel's function logs if the chat
// button shows an error, that's where this file's console.error calls go.
// ═══════════════════════════════════════════════════════════════════════

// Real facts about NM Group, pulled directly from the live site content —
// keep this in sync if the site's services/pricing/domains ever change,
// since the model will confidently repeat whatever is written here.
const NM_KNOWLEDGE_BASE = `You are the AI research assistant for the NM Group of Industries and Research Foundation website (nmresearch.co.in). Answer questions using ONLY the facts below. Be concise, warm, and professional — this is a research foundation's site, not a generic chatbot. If asked something you don't have facts for, say you're not certain and suggest the visitor use the Contact form or WhatsApp instead of inventing an answer.

ABOUT NM GROUP
NM Group of Industries and Research Foundation is a global research and innovation ecosystem — 145+ research subjects across 11 research domains, offering publication support, PhD assistance, and analytical services. Founded by Dr. Mathivanan Nallathambi (Founder & CEO).

THE 11 RESEARCH DOMAINS
1. Chemistry & Materials Science
2. Biomedical & Life Sciences
3. Environmental & Energy Sciences
4. Agricultural & Food Sciences
5. Engineering & Technology
6. Energy Storage & Electrochemistry
7. Physics, Mathematics & Data
8. Management & Business Sciences
9. Social Sciences & Humanities
10. Law, IP & Entrepreneurship
11. Publication & Academic Support

SERVICES
- Research Consulting: free initial topic guidance and work plan discussions, personalized consultancy sessions with domain experts for early-stage and advanced researchers.
- Analytical Services: advanced characterization and analytical testing (XRD, SEM, TEM, FTIR, UV-Vis, BET, EIS, XPS), with professional data analysis and interpretation included.
- Publication Support: end-to-end research assistance from topic selection to publication in top-ranked international journals (SCI, SCIE, Scopus, Web of Science, UGC Care listed journals).
- PhD Assistance: comprehensive doctoral research support — topic selection, literature review, methodology design, thesis writing, and defence preparation.

MEMBERSHIP PLANS (annual)
- Community: ₹2,999/year
- Platinum: ₹29,999/year (most popular)
- Prime: ₹49,999/year
Payment is via UPI (QR code or any UPI app — Google Pay, PhonePe, Paytm, BHIM) on the website's Membership section. After paying, the visitor should email a screenshot of the payment confirmation to hello.nmassociation@gmail.com; membership activates within 24 hours.

CONTACT
- Phone: +91 8667334697 or +91 9578170536
- Email: hello.nmassociation@gmail.com
- Website: nmresearch.co.in
- WhatsApp community and direct chat links are available in the site's Registration and footer sections.

PRESENCE
- Global offices: India, USA, UK, Canada, Malaysia, Saudi Arabia, Singapore, Japan.
- India state presence: Tamil Nadu, Puducherry, Kerala, Andhra Pradesh, Telangana.

RULES
- Never invent pricing, dates, or facts not listed above.
- For anything about a specific researcher's personal project, application status, or payment troubleshooting, direct them to email hello.nmassociation@gmail.com or use the Contact form rather than guessing.
- Keep replies short — a few sentences, not an essay — this is a chat widget, not a report.`;

const MAX_MESSAGES = 20; // caps conversation length sent per request
const MAX_MESSAGE_LENGTH = 2000; // characters, per message
const MAX_TOKENS = 500; // caps the model's reply length

// Very lightweight in-memory rate limit. Serverless functions don't share
// memory across instances and get recycled, so this is a soft speed bump
// against accidental rapid-fire clicking, NOT real abuse protection. If
// you need real protection, use Vercel's own rate limiting / a proper
// store (e.g. Upstash Redis) instead.
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 15;

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

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { valid: false, error: 'messages array is required.' };
  }
  if (messages.length > MAX_MESSAGES) {
    return { valid: false, error: 'Conversation is too long — please refresh the chat and start again.' };
  }
  const clean = [];
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
      return { valid: false, error: 'Invalid message format.' };
    }
    const content = m.content.trim();
    if (!content) {
      return { valid: false, error: 'Empty message.' };
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      return { valid: false, error: 'Message is too long.' };
    }
    clean.push({ role: m.role, content });
  }
  return { valid: true, messages: clean };
}

export default async function handler(req, res) {
  // CORS: locked to same-origin by default since the frontend calls this
  // via a relative path. If you ever need to call this API from a
  // different domain, add that origin explicitly here instead of using '*'.
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
    res.status(429).json({ ok: false, error: 'Too many messages — please wait a moment and try again.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const validation = validateMessages(body.messages);
  if (!validation.valid) {
    res.status(400).json({ ok: false, error: validation.error });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[api/ai/chat] ANTHROPIC_API_KEY is not set in Vercel environment variables.');
    res.status(500).json({ ok: false, error: 'Chat is not configured on the server yet.' });
    return;
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: MAX_TOKENS,
        system: NM_KNOWLEDGE_BASE,
        messages: validation.messages,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      console.error('[api/ai/chat] Anthropic API error:', upstream.status, errText);
      const status = upstream.status === 429 ? 429 : 502;
      const msg = upstream.status === 429
        ? 'The AI service is busy right now — please try again shortly.'
        : 'The AI service is temporarily unavailable. Please try again.';
      res.status(status).json({ ok: false, error: msg });
      return;
    }

    const data = await upstream.json();
    const reply = (data.content || [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (!reply) {
      res.status(502).json({ ok: false, error: 'Received an empty response — please try again.' });
      return;
    }

    res.status(200).json({ ok: true, reply });
  } catch (err) {
    console.error('[api/ai/chat] Handler error:', err);
    res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
}
