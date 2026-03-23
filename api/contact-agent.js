// api/contact-agent.js — with rate limiting + spam protection
// Rate limit: max 3 contact attempts per IP per listing per hour

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const {
    listing_id, agent_id, agent_email, agent_name,
    buyer_name, buyer_email, buyer_phone, message, property_address
  } = req.body;

  // ── VALIDATION ──
  if (!buyer_name?.trim() || !buyer_email?.trim() || !agent_email?.trim()) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(buyer_email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  // Spam pattern block
  const spamPatterns = ['http://', 'https://', 'click here', 'free money', 'casino', 'crypto', 'bitcoin'];
  const msgLower = (message || '').toLowerCase();
  if (spamPatterns.some(p => msgLower.includes(p) || (buyer_name||'').toLowerCase().includes(p))) {
    return res.status(400).json({ error: 'Message flagged. Please contact the agent directly.' });
  }

  // ── RATE LIMITING — max 3 per IP per listing per hour ──
  if (SUPABASE_SERVICE_KEY && listing_id) {
    try {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const countRes = await fetch(
        `${SUPABASE_URL}/rest/v1/leads?select=id&listing_id=eq.${listing_id}&buyer_ip=eq.${encodeURIComponent(ip)}&created_at=gte.${oneHourAgo}`,
        { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Prefer': 'count=exact', 'Range': '0-0' } }
      );
      const cr = countRes.headers.get('content-range') || '';
      const count = parseInt(cr.split('/')[1] || '0');
      if (count >= 3) return res.status(429).json({ error: 'Too many attempts. Try again in an hour.' });
    } catch(e) { console.warn('Rate limit check failed:', e.message); }
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';

  try {
    // ── EMAIL TO AGENT ──
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: 'GOZ — GetOffZillow AI', email: 'campaigns@transbidlive.faith' },
        to: [{ email: agent_email, name: agent_name || 'Agent' }],
        replyTo: { email: buyer_email, name: buyer_name },
        subject: `🏡 New lead: ${buyer_name} is interested in ${property_address || 'your listing'}`,
        htmlContent: `<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px"><div style="background:#0D0D0D;padding:20px 24px;border-radius:8px 8px 0 0"><div style="font-size:20px;color:#00FF9D;font-weight:700;letter-spacing:2px">GOZ</div><div style="font-size:12px;color:rgba(255,255,255,0.4)">New Buyer Lead — this lead costs you nothing</div></div><div style="background:white;border:1px solid #e0e0e0;border-top:none;padding:28px 24px;border-radius:0 0 8px 8px"><h2 style="margin:0 0 4px;font-size:20px">New Buyer Lead</h2><p style="margin:0 0 20px;font-size:13px;color:#666">Buyer contacted you directly through GOZ. Reply to respond.</p><div style="background:#f4f1eb;border-radius:8px;padding:16px 20px;margin-bottom:20px"><table style="width:100%;font-size:14px;border-collapse:collapse"><tr><td style="padding:6px 0;color:#666;width:80px">Buyer</td><td style="padding:6px 0;font-weight:700">${buyer_name}</td></tr><tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0"><a href="mailto:${buyer_email}" style="color:#006AFF">${buyer_email}</a></td></tr>${buyer_phone?`<tr><td style="padding:6px 0;color:#666">Phone</td><td style="padding:6px 0"><a href="tel:${buyer_phone}" style="color:#006AFF">${buyer_phone}</a></td></tr>`:''}<tr><td style="padding:6px 0;color:#666">Property</td><td style="padding:6px 0">${property_address||'—'}</td></tr></table></div>${message?`<div style="background:#f9f9f9;border-left:3px solid #006AFF;padding:14px 16px;border-radius:0 6px 6px 0;margin-bottom:20px;font-size:14px;color:#333;line-height:1.6;font-style:italic">"${message}"</div>`:''}<a href="mailto:${buyer_email}?subject=Re: Your inquiry on ${property_address||'the property'}" style="display:block;background:#006AFF;color:white;padding:13px;text-align:center;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">Reply to ${buyer_name} →</a><div style="margin-top:20px;padding:14px 16px;background:#f0fff8;border-radius:6px;font-size:12px;color:#00843d;line-height:1.5"><strong>GOZ marketing fee reminder:</strong> If this buyer closes a deal with you, you pay GOZ 3% of your gross commission — not 3% of the sale price. On a $10K commission that's $300. Report the closing in your <a href="https://get-off-zillow.vercel.app/dashboard.html" style="color:#00843d">dashboard</a>.</div></div></div>`
      })
    });

    // ── CONFIRMATION TO BUYER ──
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: 'GOZ Team', email: 'campaigns@transbidlive.faith' },
        to: [{ email: buyer_email, name: buyer_name }],
        subject: `✅ Your message was sent to ${agent_name||'the agent'} — GOZ`,
        htmlContent: `<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px"><div style="background:#0D0D0D;padding:16px 20px;border-radius:8px 8px 0 0"><div style="font-size:18px;color:#00FF9D;font-weight:700;letter-spacing:2px">GOZ</div></div><div style="background:white;border:1px solid #e0e0e0;border-top:none;padding:24px 20px;border-radius:0 0 8px 8px"><h2 style="margin:0 0 8px;font-size:18px">Message Sent ✅</h2><p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 16px">Hi ${buyer_name}, your message about <strong>${property_address||'the property'}</strong> was sent directly to the agent. They'll be in touch soon.</p><p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 16px">If you don't hear back within 24 hours, reply to this email and we'll follow up.</p><p style="color:#666;font-size:12px;margin:0">GOZ · GetOffZillow AI · Pensacola, FL</p></div></div>`
      })
    });

    // ── LOG LEAD ──
    if (SUPABASE_SERVICE_KEY && listing_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ listing_id: listing_id||null, agent_id: agent_id||null, buyer_name: buyer_name.trim(), buyer_email: buyer_email.trim().toLowerCase(), buyer_phone: buyer_phone?.trim()||null, message: message?.trim()||null, buyer_ip: ip })
      });
    }

    return res.status(200).json({ success: true });
  } catch(err) {
    console.error('contact-agent error:', err.message);
    return res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
}
