// api/register.mjs
// Handles the "Researcher Registration" form.
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
  const designation = sanitize(body.designation);
  const degree = sanitize(body.degree);
  const field = sanitize(body.field);
  const experience = sanitize(body.experience);
  const publications = sanitizeMultiline(body.publications);
  const contact = sanitize(body.contact);
  const whatsapp = sanitize(body.whatsapp);
  const email = sanitize(body.email);
  const affiliation = sanitize(body.affiliation);

  if (!name || !designation || !degree || !field || !contact || !email || !affiliation) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, message: 'Invalid email address.' });
  }

  const html = buildEmailHtml('New Researcher Registration', [
    ['Name', name],
    ['Designation', designation],
    ['Degree', degree],
    ['Research Field', field],
    ['Research Experience', experience || 'Not specified'],
    ['Publications', publications || 'None listed'],
    ['Contact Number', contact],
    ['WhatsApp Number', whatsapp || 'Not provided'],
    ['Email', email],
    ['Affiliation', affiliation],
  ]);

  const result = await sendEmail({
    subject: 'NM Group Website — New Researcher Registration',
    html,
    replyTo: email,
  });

  if (!result.ok) {
    console.error('register.mjs sendEmail failed:', result.error);
    return res.status(502).json({ success: false, message: 'Email delivery failed.' });
  }

  return res.status(200).json({ success: true });
}
