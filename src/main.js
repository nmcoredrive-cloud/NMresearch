// src/main.js
// Vite entry point. Wires the Google sign-in modal (markup already in
// index.html) to the modular Firebase Auth logic in ./firebase-auth.js.
//
// The rest of the site's interactions (mobile nav, membership payment
// modal, AI chat panel, etc.) are plain inline <script> blocks already in
// index.html and are left exactly as they were — this file only owns
// authentication. The auth-related buttons in index.html call
// window.openAuthModal / window.signInWithGoogle / window.signOutUser /
// window.closeAuthModal via onclick="", so those are exposed below.

import { isConfigured, signInWithGoogle, signOutUser, watchAuthState } from './firebase-auth.js';

function $(id) {
  return document.getElementById(id);
}

function setAuthLoading(isLoading) {
  const btn = $('googleSignInBtn');
  const label = $('googleBtnLabel');
  if (!btn || !label) return;
  btn.disabled = isLoading;
  label.innerHTML = isLoading ? '<span class="auth-spinner"></span>' : 'Continue with Google';
}

function showAuthError(err) {
  const box = $('authError');
  if (!box) return;
  let msg = 'Something went wrong. Please try again.';
  let canRetry = true;

  if (err && err.code === 'not-configured') {
    msg = "Google Sign-In isn't configured yet — check the VITE_FIREBASE_* values in your .env file.";
    canRetry = false;
  } else if (err && err.code === 'already-in-progress') {
    // A flow is already running (e.g. a double-tap) — nothing went wrong,
    // just don't show a scary error for it.
    return;
  } else if (err && err.code === 'offline') {
    msg = "You're offline — check your connection and try again.";
  } else if (err && err.code === 'auth/popup-closed-by-user') {
    msg = 'Sign-in was closed before finishing.';
  } else if (err && err.code === 'auth/network-request-failed') {
    msg = 'Network error — check your connection and try again.';
  } else if (err && err.code === 'auth/unauthorized-domain') {
    msg = 'This domain is not authorized in Firebase yet — add it under Authentication → Settings → Authorized domains.';
    canRetry = false;
  } else if (err && err.code === 'auth/operation-not-allowed') {
    msg = 'Google sign-in is not enabled for this project yet — enable it under Authentication → Sign-in method.';
    canRetry = false;
  } else if (err && err.code === 'auth/too-many-requests') {
    msg = 'Too many attempts — please wait a moment and try again.';
  } else if (err && err.code === 'auth/user-disabled') {
    msg = 'This account has been disabled. Contact NM Group for help.';
    canRetry = false;
  } else if (err && err.code === 'auth/internal-error') {
    msg = 'A temporary error occurred. Please try again.';
  }

  box.innerHTML = '';
  const msgEl = document.createElement('div');
  msgEl.textContent = msg;
  box.appendChild(msgEl);

  if (canRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'auth-retry-btn';
    retryBtn.textContent = 'Try again';
    retryBtn.onclick = () => {
      clearAuthError();
      handleGoogleSignInClick();
    };
    box.appendChild(retryBtn);
  }

  box.classList.add('show');
  setAuthLoading(false);
}

function clearAuthError() {
  const box = $('authError');
  if (box) {
    box.textContent = '';
    box.classList.remove('show');
  }
}

function showSignedInUI(user) {
  $('authSignedOut')?.classList.remove('show');
  $('authProfile')?.classList.add('show');
  if ($('authAvatar')) $('authAvatar').src = user.photoURL || '';
  if ($('authName')) $('authName').textContent = user.displayName || 'Researcher';
  if ($('authEmail')) $('authEmail').textContent = user.email || '';

  const chip = $('navUserChip');
  const btn = $('navAuthBtn');
  if (chip && btn) {
    if ($('navUserAvatar')) $('navUserAvatar').src = user.photoURL || '';
    if ($('navUserName')) $('navUserName').textContent = (user.displayName || 'Account').split(' ')[0];
    chip.classList.add('show');
    btn.style.display = 'none';
  }

  const mLabel = $('mnavAuthLabel');
  const mDesc = $('mnavAuthDesc');
  if (mLabel && mDesc) {
    mLabel.textContent = user.displayName || 'My Account';
    mDesc.textContent = user.email || 'Signed in';
  }
  setAuthLoading(false);
}

function showSignedOutUI() {
  $('authSignedOut')?.classList.add('show');
  $('authProfile')?.classList.remove('show');

  const chip = $('navUserChip');
  const btn = $('navAuthBtn');
  if (chip && btn) {
    chip.classList.remove('show');
    btn.style.display = '';
  }

  const mLabel = $('mnavAuthLabel');
  const mDesc = $('mnavAuthDesc');
  if (mLabel && mDesc) {
    mLabel.textContent = 'Sign In';
    mDesc.textContent = 'Continue with your Google account';
  }
}

function openAuthModal() {
  // Mirror the site's real logo into the modal instead of hardcoding it
  const siteLogo = document.querySelector('.nav-logo-img img');
  const modalLogo = $('authModalLogo');
  if (siteLogo && modalLogo && !modalLogo.src) modalLogo.src = siteLogo.src;

  $('authOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
  $('authOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
  clearAuthError();
}

function handleGoogleSignInClick() {
  clearAuthError();
  if (!isConfigured) {
    showAuthError({ code: 'not-configured' });
    return;
  }
  setAuthLoading(true);
  signInWithGoogle().catch((err) => showAuthError(err));
  // Note: on redirect flows the page navigates away here, so there is
  // nothing more to do — watchAuthState() picks the result back up after
  // the redirect returns.
}

function handleSignOutClick() {
  signOutUser();
}

watchAuthState(showSignedInUI, showSignedOutUI, showAuthError);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAuthModal();
});

// The existing HTML markup calls these via onclick="..." — expose them
// globally so nothing in index.html needs to change.
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.signInWithGoogle = handleGoogleSignInClick;
window.signOutUser = handleSignOutClick;

if (!isConfigured && import.meta.env.DEV) {
  console.warn(
    '[NM Group] Firebase is not configured — copy .env.example to .env and fill in your project values.'
  );
}
