// api/community.mjs
// Handles the "Join Research Community" form.
import {
  sanitize,
  isValidEmail,
  buildEmailHtml,
  sendEmail,
  rejectIfSpamOrBadMethod,
} from '../lib/mailer.mjs';

export default async function handler(req, res) {
  if (rejectIfSpamOrBadMethod(req, res)) return;

  const body = req.body || {};
  const name = sanitize(body.name);
  const email = sanitize(body.email);
  const contact = sanitize(body.contact);
  const affiliation = sanitize(body.affiliation);
  const field = sanitize(body.field);

  if (!name || !email || !contact) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email address.' });
  }

  const html = buildEmailHtml('New Research Community Request', [
    ['Name', name],
    ['Email', email],
    ['Contact Number', contact],
    ['Affiliation', affiliation || 'Not provided'],
    ['Area of Interest', field || 'Not specified'],
  ]);

  const result = await sendEmail({
    subject: 'NM Group Website — New Research Community Request',
    html,
    replyTo: email,
  });

  if (!result.ok) {
    console.error('community.mjs sendEmail failed:', result.error);
    return res.status(502).json({ success: false, message: 'Email delivery failed.' });
  }

  return res.status(200).json({ success: true });
}
