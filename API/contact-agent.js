// api/contact-agent.js
// Buyer fills out contact form → email sent to agent via Brevo + lead saved to DB

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  const {
    agent_id, listing_id, agent_email, agent_name,
    listing_address, buyer_name, buyer_email, buyer_phone, message
  } = req.body;

  if (!buyer_name || !buyer_email || !agent_email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Save lead to DB
    await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        agent_id: agent_id || null,
        listing_id: listing_id || null,
        buyer_name,
        buyer_email,
        buyer_phone: buyer_phone || null,
        message: message || null
      })
    });

    // 2. Email the agent directly
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { name: 'GetOffZillow AI', email: 'campaigns@transbidlive.faith' },
        to: [{ email: agent_email, name: agent_name || 'Agent' }],
        replyTo: { email: buyer_email, name: buyer_name },
        subject: `🏡 New Lead from GetOffZillow AI — ${buyer_name} is interested in ${listing_address || 'your listing'}`,
        htmlContent: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <div style="background:#006AFF;padding:20px 24px;border-radius:8px 8px 0 0">
              <h2 style="color:white;margin:0">New Buyer Lead 🔔</h2>
              <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px">GetOffZillow AI — Zero lead tax charged to you</p>
            </div>
            <div style="background:#fff;padding:28px;border:1px solid #e0e0e0;border-top:none">
              <table style="width:100%;border-collapse:collapse">
                <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#888;width:130px">Buyer Name</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-weight:700">${buyer_name}</td></tr>
                <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#888">Email</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0"><a href="mailto:${buyer_email}" style="color:#006AFF">${buyer_email}</a></td></tr>
                ${buyer_phone ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#888">Phone</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0"><a href="tel:${buyer_phone}" style="color:#006AFF">${buyer_phone}</a></td></tr>` : ''}
                ${listing_address ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#888">Listing</td><td style="padding:10px 0;border-bottom:1px solid #f0f0f0">${listing_address}</td></tr>` : ''}
                ${message ? `<tr><td style="padding:10px 0;color:#888;vertical-align:top">Message</td><td style="padding:10px 0">${message}</td></tr>` : ''}
              </table>
              <div style="background:#f0fff8;border-left:4px solid #00C853;padding:14px;margin-top:20px;border-radius:4px">
                <strong style="color:#00C853">This lead is yours — 100% free.</strong><br>
                <span style="font-size:12px;color:#444">GetOffZillow AI charged you $0 to receive this lead. Reply directly to ${buyer_name} at ${buyer_email}. No middleman.</span>
              </div>
              <p style="margin-top:20px"><a href="mailto:${buyer_email}" style="background:#006AFF;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700">Reply to ${buyer_name} →</a></p>
            </div>
            <div style="background:#f7f7f7;padding:12px;text-align:center;font-size:11px;color:#888;border-radius:0 0 8px 8px">
              GetOffZillow AI · Pensacola, FL · TransBid LLC
            </div>
          </div>
        `
      })
    });

    // 3. Confirmation email to buyer
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { name: 'GetOffZillow AI', email: 'campaigns@transbidlive.faith' },
        to: [{ email: buyer_email, name: buyer_name }],
        subject: `✅ Your message was sent to ${agent_name || 'your agent'} — GetOffZillow AI`,
        htmlContent: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <div style="background:#006AFF;padding:20px 24px;border-radius:8px 8px 0 0">
              <h2 style="color:white;margin:0">Message Sent ✅</h2>
            </div>
            <div style="background:#fff;padding:28px;border:1px solid #e0e0e0;border-top:none">
              <p>Hi ${buyer_name},</p>
              <p style="color:#444;line-height:1.6">Your message has been sent directly to <strong>${agent_name || 'the agent'}</strong>${listing_address ? ` regarding <strong>${listing_address}</strong>` : ''}. They'll contact you directly — no platform middleman, no lead tax, no games.</p>
              <p style="color:#444;line-height:1.6">Expect to hear back within a few hours.</p>
              <p style="color:#444">— GetOffZillow AI</p>
            </div>
          </div>
        `
      })
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('contact-agent error:', err);
    return res.status(500).json({ error: err.message });
  }
}
