# NM Group site — Vite + Firebase Google Sign-In

## What's in this package
```
index.html          ← your full site, unchanged except the Firebase block
src/main.js          ← wires the sign-in modal to Firebase (entry point)
src/firebase-auth.js ← modular Firebase Auth (real npm package, not a CDN script)
.env                  ← your real nm-research-innovation Firebase config (gitignored)
.env.example          ← blank template, safe to commit
.gitignore
package.json / package-lock.json
```

## Run it
```
npm install       # installs firebase + vite — I tested this exact install, 0 vulnerabilities
npm run dev       # local dev server, http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve the production build locally to test it
```

## Before Google Sign-In will actually work
This is the one thing that has to happen in the Firebase console, not in code:

1. https://console.firebase.google.com → **nm-research-innovation** project
2. Authentication → Sign-in method → confirm **Google** is enabled
3. Authentication → Settings → **Authorized domains** → add every domain this
   site will be served from (your production domain, any Vercel preview
   domains). `localhost` is allowed by default, so `npm run dev` will work
   for testing without any extra setup.

Skip step 3 and every sign-in attempt fails with `auth/unauthorized-domain`
— that error is expected and correct until the domain is added, it isn't a
bug in this code.

## Deploying (Vercel, Netlify, etc.)
Do **not** upload the `.env` file to your host. Instead, set these as
environment variables in your hosting platform's dashboard (values are in
your local `.env`):
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```
Build command: `npm run build`. Output directory: `dist`.

One honest note: the Firebase Web `apiKey` is **not a secret** — it's
designed to be visible in your shipped JS bundle, and Firebase's real
security boundary is Firestore/Storage Security Rules and the Authorized
Domains list above, not hiding this key. Putting it in `.env` is still
correct practice (keeps per-environment config out of git, makes it easy to
point staging vs. production at different Firebase projects) — just don't
mistake it for the thing that's actually protecting your data.

## What changed vs. the CDN version you had before
- Removed the `<script src="https://www.gstatic.com/firebasejs/...">` tags
  and the inline compat-SDK `<script>` block.
- Replaced with one line: `<script type="module" src="/src/main.js"></script>`
- All the sign-in modal HTML/CSS (the button, the profile card, the nav
  avatar chip) is untouched — same markup, same ids.
- The `onclick="openAuthModal()"` etc. attributes already in your HTML still
  work: `main.js` exposes those four functions on `window` on purpose, so
  nothing else in your 6,000-line file needed to change.
- Fixed one pre-existing bug the Vite build caught: your Google Fonts
  `@import` was in the middle of the stylesheet instead of at the top,
  which is invalid CSS. Moved it — same font, now spec-compliant.
