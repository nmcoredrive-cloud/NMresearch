# NM Group of Industries and Research Foundation — Website Spec

A single-page marketing + membership website for an Indian research foundation, built as a Vite project with Firebase Google authentication, a UPI/QR payment flow for membership signup, and a live Claude-powered chatbot backend. Live at **nmresearch.co.in**, deployed via GitHub → Vercel.

## Tech stack

- **Build tool**: Vite 7, vanilla JS (no framework) — one large `index.html` with inline `<style>` and multiple inline `<script>` blocks, plus two ES modules in `src/`, plus one Vercel serverless function in `api/`
- **Auth**: Firebase Authentication (modular v12 SDK), Google as the sole sign-in provider
- **AI chatbot backend**: Vercel serverless function calling the Anthropic API directly (model `claude-sonnet-4-5`), with a hand-written system prompt containing the site's real facts
- **Hosting**: Vercel (static site + serverless functions), custom domain `nmresearch.co.in` via GoDaddy DNS
- **Fonts**: Playfair Display (serif — headings, prices, numbers), Source Sans 3 (body/UI text), JetBrains Mono (UPI ID / monospace values)
- **No CSS framework** — hand-written CSS using custom properties for the design system

## Design system

- **Palette**: navy (`#0a2463` primary, `#071845` dark, `#1e3a7a` mid), gold/accent (`#C9A84C`, light `#e8c96a`), light background (`#f4f6fb`), white cards
- **Radius**: 12px default, 18px large
- **Typography rule**: Playfair Display serif for headings/prices/stat numbers; Source Sans 3 for everything else
- **Effects**: subtle glassmorphism on the navbar, gold/navy gradients used sparingly, soft shadows

> **Pending decision, not yet built**: the person running this site has expressed interest in redesigning entirely into a hand-drawn "doodle" illustration style (referencing a Dribbble SaaS product called "Authority Hawk"), which would replace this professional palette/typography wholesale. As of this spec, that has **not** been implemented — everything below still describes the current, live, professional-styled site. Flagged directly to them: a doodle/consumer-SaaS aesthetic is a significant tonal shift away from the credibility-first look this spec otherwise describes, for a business charging up to ₹49,999/year for research services.

## Page sections (in order)

1. **`#home`** — Hero: badge, headline, subheading, two CTA buttons (Start Research / Join Community), an animated 2D "atom-tripod" SVG orbit graphic, stat strip
2. **`#about`** — Foundation vision, value badges, stat counters, founder profile card (Dr. Mathivanan Nallathambi, Founder & CEO)
3. **`#services`** — Accordion cards: Research Consulting, Analytical Services (XRD, SEM, TEM, FTIR, UV-Vis, BET, EIS, XPS instrument tags), Publication Support, PhD Assistance
4. **`#registration`** — Individual Registration form + "Join the NM Research Community" panel with a WhatsApp **group invite** QR code and button (`chat.whatsapp.com/8U1z9l21pb55NrnczHdFes`) — distinct from the footer's direct-chat link, see Contact/Social section below
5. **`#research`** — "Core Research Subjects & Domains" — 11-item click-to-expand accordion (Chemistry & Materials Science, Biomedical & Life Sciences, Environmental & Energy Sciences, Agricultural & Food Sciences, Engineering & Technology, Energy Storage & Electrochemistry, Physics/Mathematics & Data, Management & Business Sciences, Social Sciences & Humanities, Law/IP & Entrepreneurship, Publication & Academic Support), each with a flat animated SVG icon tinted per-domain
6. **`#collaborations`** — Global Partnerships section, partner stats
7. **`#membership`** — Three pricing tiers opening a payment modal on click: Community ₹2,999/yr, Platinum ₹29,999/yr ("Most Popular"), Prime ₹49,999/yr
8. **`#contact`** — Contact form (posts to `/api/contact` — **not yet built**, see Known Gaps) + a company info card (phone, email, website, global offices, India state presence)
9. **Footer** — brand/social icons, **Navigation** links column, **Contact** column (phone numbers, emails, `nmresearch.co.in`). The footer previously had a third "Services" link column — **removed** on request; footer grid CSS updated from 4 columns to 3 accordingly.

## Navigation

- **Desktop navbar**: logo, nav links, mega-menu dropdowns (hover + click) for Services / Research & Domains / Membership, "Get Started" button, Sign In button/avatar chip, hamburger (mobile only) — unchanged, still has all items including Sign In and Research & Domains
- **Mobile nav drawer**: Home, About, Services, Registration, Membership, Contact — in that order. **"Research & Domains" and "Sign In" have been removed from this drawer specifically** (desktop nav still has both; this was a mobile-only removal on request). Ends with a gold CTA ("Start Your Research Journey")
- Scroll-spy JS highlights the current section in both navs

## Membership payment flow

Clicking a plan button opens a payment modal (`#payOverlay`) — resized to "medium" (440px max-width) with Playfair Display for the heading/price, matching the rest of the site's font system after an earlier revision:
- Plan name + price
- QR code (generated client-side via `qrcodejs`)
- Row of 5 real payment-app logo badges, embedded as base64 PNGs: Google Pay, PhonePe, Paytm, BHIM, and UPI — each cropped to its real bounding box and matched to a common display height
- UPI ID field + Copy button
- "Pay in UPI App" button
- Numbered how-to-pay steps + activation note (email screenshot to hello.nmassociation@gmail.com, 24-hour activation, support phone)
- The beneficiary/bank-account/IFSC detail block that originally sat below this was removed on request and has not been re-added

## Google Sign-In (Firebase Auth)

- **Project**: `nm-research-innovation`, `authDomain` deliberately left as the default `nm-research-innovation.firebaseapp.com` rather than a custom domain, since the site is hosted on Vercel, not Firebase Hosting — Firebase is used for auth only
- **Provider**: Google only, via `signInWithPopup` with automatic fallback to `signInWithRedirect` for Safari (ITP breaks popups), mobile browsers, and in-app WebViews
- **Reliability hardening**: concurrency guard against double-submit, `navigator.onLine` pre-check, per-error-code messages with a working "Try again" retry button
- **Config**: real Firebase values in a gitignored `.env` (`VITE_FIREBASE_*`), read via `import.meta.env`; `.env.example` committed as a template
- **Firebase-side requirement** (not code, must be done in console): the live domain must be added under Authentication → Settings → Authorized Domains — confirmed done for `nmresearch.co.in` during setup

## AI chatbot backend (`api/ai/chat.js`)

- Real Vercel serverless function, ES module (`export default async function handler(req, res)` — the project's `package.json` has `"type": "module"`, so this matters; an earlier CommonJS draft was caught and fixed before shipping)
- Contract: `POST /api/ai/chat` with `{ messages: [{role, content}] }` → `{ ok: true, reply }` or `{ ok: false, error }`, matching the frontend's existing `fetch` call exactly
- System prompt built from the site's real content: services, all 11 domains, membership pricing, founder name, contact details, global/India presence
- Calls Anthropic's API (`claude-sonnet-4-5`) server-side using `ANTHROPIC_API_KEY` from Vercel environment variables — never exposed to the browser
- Input validation (message count/length caps), a soft per-IP in-memory rate limit, specific error messages per failure mode
- Tested with mock requests through every validation branch, and with a real (deliberately invalid) API key against the live Anthropic endpoint to confirm the request/response shape is genuinely correct, not just assumed

## WhatsApp links (two distinct, intentional links — don't merge them)

- **Registration section QR + button**: `https://chat.whatsapp.com/8U1z9l21pb55NrnczHdFes` — joins the NM Research Community **group**
- **Footer social icon**: `https://wa.me/message/MF7XIJ4XBJE6D1` — opens a **direct 1:1 chat** with the admin account (changed from the group link on request; tooltip updated from "WhatsApp Community" to "Chat on WhatsApp")

## File structure

```
index.html              — the whole site: markup, <style>, inline <script> blocks
                           (mobile nav, reveal-on-scroll, payment modal, AI chat panel
                           frontend, accordion/domain logic, hero word rotation)
src/
  main.js                — Vite entry point; wires the sign-in modal UI to firebase-auth.js;
                            exposes auth functions on window for index.html's onclick="" markup
  firebase-auth.js        — modular Firebase Auth logic
api/
  ai/
    chat.js                — Vercel serverless function, the chatbot backend (see above)
.env / .env.example       — Firebase config (gitignored / committed template)
package.json              — "type": "module"; dependencies: firebase (^12), vite (^7, dev)
```

## Deployment

- **Source control**: GitHub, `nmcoredrive-cloud/NMresearch`
- **Host**: Vercel, project `n-mresearch` — build command `npm run build`, output `dist`, 7 `VITE_FIREBASE_*` env vars set in Vercel's dashboard (since `.env` is gitignored), plus `ANTHROPIC_API_KEY` for the chatbot (**still needs to be added** — chat currently returns "not configured" until this is set)
- **Domain**: `nmresearch.co.in`, registered via GoDaddy — required a NIXI e-KYC/DigiLocker verification step on GoDaddy's side before DNS editing unlocked (India-specific `.co.in` registrar requirement, unrelated to code) — A record on `@` points to Vercel's IP; confirmed live and resolving

## Known gaps (explicitly not built yet, flagged rather than silently skipped)

- **`/api/contact` does not exist.** The Contact section's form calls this endpoint; until it's built, form submissions will fail the same "not configured" way the chatbot did before its API key was set.
- **The doodle-style redesign** discussed but not yet started (see Design System note above).
- No backend database for registrations — lead-capture forms + manual UPI payment confirmation via email, not an automated gateway.
