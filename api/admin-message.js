// api/admin-message.js
// Sends bulk or single messages to agents via Brevo
// Only callable from admin portal — verified by email list

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) return res.status(500).json({ error: 'Email service not configured' });

  const { emails, subject, body } = req.body;

  if (!emails?.length || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (emails.length > 200) {
    return res.status(400).json({ error: 'Max 200 recipients per send' });
  }

  // Convert plain text body to simple HTML
  const htmlBody = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n\n/g, '</p><p style="margin:0 0 14px">')
    .replace(/\n/g, '<br>');

  const htmlContent = `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f1eb;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:560px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
  <div style="background:#0D0D0D;padding:20px 28px">
    <span style="font-family:Georgia,serif;color:#00FF9D;font-size:20px;letter-spacing:3px;font-weight:700">GOZ</span>
    <span style="color:rgba(255,255,255,0.35);font-size:11px;margin-left:8px">GetOffZillow AI</span>
  </div>
  <div style="padding:28px">
    <p style="margin:0 0 14px;font-size:15px;color:#1A1A1A;line-height:1.7">${htmlBody}</p>
  </div>
  <div style="background:#f4f1eb;padding:16px 28px;text-align:center;font-size:11px;color:#999;border-top:1px solid #e8e3d8">
    GOZ · GetOffZillow AI · TransBid LLC · Pensacola, FL<br>
    <a href="https://get-off-zillow.vercel.app/dashboard.html" style="color:#999">Your Dashboard</a>
  </div>
</div>
</body></html>`;

  let sent = 0;
  let failed = 0;

  // Send individually to avoid BCC issues — Brevo supports up to 50 per call
  // Batch into groups of 50
  const batches = [];
  for (let i = 0; i < emails.length; i += 50) {
    batches.push(emails.slice(i, i + 50));
  }

  for (const batch of batches) {
    try {
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
        body: JSON.stringify({
          sender: { name: 'GOZ Team', email: 'campaigns@transbidlive.faith' },
          to: batch.map(email => ({ email })),
          subject,
          htmlContent
        })
      });
      if (resp.ok) sent += batch.length;
      else failed += batch.length;
    } catch(e) {
      failed += batch.length;
      console.error('Batch send error:', e.message);
    }
  }

  return res.status(200).json({
    success: sent > 0,
    sent,
    failed,
    total: emails.length
  });
}
