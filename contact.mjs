// api/contact.mjs
// Handles the "Send a Message" contact form. Replaces the old FormSubmit.co
// AJAX call, which depended on an unreliable third-party activation step.
import {
  sanitize,
  sanitizeMultiline,
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
  const subject = sanitize(body.subject);
  const domain = sanitize(body.domain);
  const message = sanitizeMultiline(body.message);

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email address.' });
  }

  const html = buildEmailHtml('New Contact Message', [
    ['Name', name],
    ['Email', email],
    ['Subject', subject],
    ['Research Domain', domain || 'Not specified'],
    ['Message', message],
  ]);

  const result = await sendEmail({
    subject: 'NM Group Website — New Contact Message',
    html,
    replyTo: email,
  });

  if (!result.ok) {
    console.error('contact.mjs sendEmail failed:', result.error);
    return res.status(502).json({ success: false, message: 'Email delivery failed.' });
  }

  return res.status(200).json({ success: true });
}
