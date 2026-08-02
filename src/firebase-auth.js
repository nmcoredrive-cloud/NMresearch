// src/firebase-auth.js
// Real npm `firebase` package (modular v12 SDK) — no CDN script tags.
// Config comes from Vite's import.meta.env, populated from .env at build/dev time.

import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as analyticsIsSupported } from 'firebase/analytics';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app = null;
let auth = null;
let googleProvider = null;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });

  // Analytics can fail in unsupported environments (SSR, some in-app
  // browsers, ad-blockers) — never let it block auth from working.
  analyticsIsSupported()
    .then((supported) => {
      if (supported) getAnalytics(app);
    })
    .catch(() => {});
}

// Embedded in-app browsers (WhatsApp, Instagram, Facebook, Line, etc.),
// generic mobile, and Safari (desktop + iOS) all routinely break the
// popup flow in practice:
//  - In-app WebViews: Google outright blocks OAuth per its own
//    disallowed-user-agent policy.
//  - Safari (ITP - Intelligent Tracking Prevention): frequently closes or
//    silently fails the third-party popup/storage handshake Google's
//    popup flow depends on, without a clear error.
//  - Mobile browsers generally: popup blockers and small-viewport popup
//    handling are inconsistent across vendors.
// Redirect avoids all three failure modes, so we default to it whenever
// any of these apply instead of waiting for the popup to fail first.
function isRestrictedBrowserEnv() {
  const ua = navigator.userAgent || navigator.vendor || '';
  const isEmbedded = /FBAN|FBAV|Instagram|Line\/|WhatsApp|MicroMessenger|; ?wv\)/i.test(ua);
  const isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod/i.test(ua);
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
  return isEmbedded || isMobile || isSafari;
}

let signInInFlight = false;

/**
 * Starts the Google sign-in flow. Resolves on popup success; on redirect
 * flows the page navigates away, so callers should not expect this promise
 * to resolve in that case.
 */
export function signInWithGoogle() {
  if (!isConfigured) {
    return Promise.reject({ code: 'not-configured' });
  }
  if (signInInFlight) {
    // A tap/click already started a flow (popup opening or redirect in
    // progress) — never let a second one interleave and produce two
    // competing requests.
    return Promise.reject({ code: 'already-in-progress' });
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.reject({ code: 'offline' });
  }

  signInInFlight = true;
  const release = () => { signInInFlight = false; };

  if (isRestrictedBrowserEnv()) {
    return signInWithRedirect(auth, googleProvider).catch((err) => {
      release();
      throw err;
    });
    // Note: on success the page navigates away before release() would run,
    // which is fine — a fresh page load resets signInInFlight naturally.
  }

  return signInWithPopup(auth, googleProvider)
    .then((result) => {
      release();
      return result;
    })
    .catch((err) => {
      const fallbackCodes = [
        'auth/popup-blocked',
        'auth/cancelled-popup-request',
        'auth/operation-not-supported-in-this-environment',
      ];
      if (err && fallbackCodes.includes(err.code)) {
        return signInWithRedirect(auth, googleProvider).catch((redirectErr) => {
          release();
          throw redirectErr;
        });
      }
      release();
      throw err;
    });
}

export function signOutUser() {
  if (!auth) return Promise.resolve();
  return signOut(auth);
}

/**
 * Wires up auth state + redirect-result handling.
 * @param {(user: import('firebase/auth').User) => void} onSignedIn
 * @param {() => void} onSignedOut
 * @param {(err: any) => void} onError
 */
export function watchAuthState(onSignedIn, onSignedOut, onError) {
  if (!isConfigured) return;

  getRedirectResult(auth).catch((err) => {
    if (err && err.code) onError(err);
  });

  onAuthStateChanged(auth, (user) => {
    if (user) onSignedIn(user);
    else onSignedOut();
  });
}
