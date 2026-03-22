// api/contact-agent.js
// Sends lead notification emails via Brevo — key never exposed to browser

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { agent_email, agent_name, agent_first, listing_address, listing_price,
          buyer_name, buyer_email, buyer_phone, message } = req.body;

  if (!buyer_name || !buyer_email || !agent_email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const BREVO = process.env.BREVO_API_KEY;
  if (!BREVO) return res.status(500).json({ error: 'Email service not configured' });

  const send = (payload) => fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': BREVO },
    body: JSON.stringify(payload)
  });

  // Email to agent
  await send({
    sender: { name: 'GetOffZillow AI', email: 'campaigns@transbidlive.faith' },
    to: [{ email: agent_email, name: agent_name }],
    replyTo: { email: buyer_email, name: buyer_name },
    subject: `🏡 New lead: ${buyer_name} is interested in ${listing_address}`,
    htmlContent: `<div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto">
      <div style="background:#111;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="color:#00FF9D;margin:0;font-size:20px">New Buyer Lead</h2>
        <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:12px">GetOffZillow AI — this lead costs you nothing</p>
      </div>
      <div style="background:#fff;padding:28px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:10px 0;border-bottom:1px solid #f5f5f5;color:#888;width:100px">Buyer</td><td style="padding:10px 0;border-bottom:1px solid #f5f5f5;font-weight:700">${buyer_name}</td></tr>
          <tr><td style="padding:10px 0;border-bottom:1px solid #f5f5f5;color:#888">Email</td><td style="padding:10px 0;border-bottom:1px solid #f5f5f5"><a href="mailto:${buyer_email}" style="color:#006AFF">${buyer_email}</a></td></tr>
          ${buyer_phone ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f5f5f5;color:#888">Phone</td><td style="padding:10px 0;border-bottom:1px solid #f5f5f5"><a href="tel:${buyer_phone}" style="color:#006AFF">${buyer_phone}</a></td></tr>` : ''}
          <tr><td style="padding:10px 0;border-bottom:1px solid #f5f5f5;color:#888">Property</td><td style="padding:10px 0;border-bottom:1px solid #f5f5f5">${listing_address}${listing_price ? ' — $' + Number(listing_price).toLocaleString() : ''}</td></tr>
          ${message ? `<tr><td style="padding:10px 0;color:#888;vertical-align:top">Message</td><td style="padding:10px 0;font-style:italic">"${message}"</td></tr>` : ''}
        </table>
        <div style="background:#f0fff8;border-left:4px solid #00C853;padding:14px;margin-top:20px;border-radius:4px">
          <strong style="color:#00C853">This lead cost you $0.</strong> GOZ AI only charges 3% when the deal closes.
        </div>
        <p style="margin-top:20px"><a href="mailto:${buyer_email}?subject=Re: Your inquiry about ${listing_address}" style="background:#006AFF;color:white;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px">Reply to ${buyer_name} →</a></p>
      </div>
    </div>`
  });

  // Confirmation to buyer
  await send({
    sender: { name: 'GetOffZillow AI', email: 'campaigns@transbidlive.faith' },
    to: [{ email: buyer_email, name: buyer_name }],
    subject: `✅ Your message was sent to ${agent_first || 'the agent'} — GetOffZillow AI`,
    htmlContent: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:32px">
      <h2 style="color:#006AFF">Message Sent ✅</h2>
      <p>Hi ${buyer_name},</p>
      <p style="line-height:1.6">Your message about <strong>${listing_address}</strong> was sent directly to the agent. They'll be in touch soon.</p>
      <p style="color:#888;font-size:12px;margin-top:20px">GetOffZillow AI · Pensacola, FL · No spam, ever.</p>
    </div>`
  });

  return res.status(200).json({ success: true });
}
