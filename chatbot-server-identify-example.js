// ══════════════════════════════════════════════════════════════════
// CHATBASE IDENTITY — SERVER-SIDE EXAMPLE (Node.js / Express)
//
// This file must run on YOUR SERVER, never in the browser and never
// bundled into your website's HTML/JS. It's the only place your
// Chatbase secret key should ever appear.
//
// Setup:
//   1. npm install jsonwebtoken express
//   2. Set CHATBOT_IDENTITY_SECRET as an environment variable
//      (e.g. in a .env file that is gitignored, or your host's
//      secrets manager) — never hardcode it in this file.
//   3. Rotate your Chatbase secret key first if it was ever shared
//      or committed anywhere, since old keys should be treated as
//      compromised once exposed.
//   4. Point your existing login/session logic at getSignedInUser().
// ══════════════════════════════════════════════════════════════════

const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();
const secret = process.env.CHATBOT_IDENTITY_SECRET;

// Replace with your real "who is logged in right now" logic —
// e.g. reading a session cookie, a JWT you already issue, etc.
async function getSignedInUser(req) {
  // Example placeholder — swap for your actual auth check.
  // Return null/undefined if nobody is logged in.
  return req.session && req.session.user
    ? req.session.user
    : null;
}

router.get('/api/chat-identity', async (req, res) => {
  const user = await getSignedInUser(req);

  if (!user) {
    return res.status(401).json({ error: 'Not signed in' });
  }

  const token = jwt.sign(
    {
      user_id: user.id,
      email: user.email,
      // stripe_accounts: user.stripeAccounts, // only if you use Stripe integration
    },
    secret,
    { expiresIn: '1h' }
  );

  res.json({ token });
});

module.exports = router;

// In your main server file:
//   const chatIdentityRouter = require('./chatbot-server-identify-example');
//   app.use(chatIdentityRouter);
