// api/agent-signup.js
// Sets approved: false on signup — agent goes into pending queue
// Notifies contactfire757@gmail.com when someone signs up
// Sends agent a "pending review" email on signup
// Approval welcome email sent from admin.html when you approve

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  // ── INTERNAL: send approval email when admin approves ──
  if (req.body._action === 'send_approval') {
    const { email, first_name, last_name } = req.body;
    try {
      await sendEmail(BREVO_API_KEY, {
        to: [{ email, name: `${first_name} ${last_name}` }],
        subject: `You're approved on GetOffZillow AI — go live now`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <div style="background:#111;padding:24px;border-radius:8px 8px 0 0;text-align:center;border-bottom:2px solid #00FF9D">
              <h1 style="color:#00FF9D;margin:0;font-size:28px;letter-spacing:2px">GOZ</h1>
              <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:12px">GetOffZillow AI</p>
            </div>
            <div style="background:#fff;padding:32px;border:1px solid #e0e0e0;border-top:none">
              <h2 style="color:#1a1a1a">You're approved, ${first_name}.</h2>
              <p style="color:#444;line-height:1.7">Your GetOffZillow AI agent account has been reviewed and approved. Your listings are now live and searchable by buyers.</p>
              <div style="background:#f0fff8;border-left:4px solid #00C853;padding:16px;border-radius:4px;margin:20px 0">
                <strong style="color:#00843d;font-size:15px">GOZ Fee: 3% of your commission at closing only.</strong><br>
                <span style="color:#444;font-size:13px;line-height:1.6">On a $400K sale at 2.5% — your gross commission is $10,000. GOZ charges $300. You keep $9,700. Nothing upfront. Nothing if a deal doesn't close.</span>
              </div>
              <ol style="color:#444;line-height:2.2">
                <li><a href="https://getoffzillow.com/dashboard.html" style="color:#006AFF">Sign in to your dashboard</a></li>
                <li><a href="https://getoffzillow.com/list.html" style="color:#006AFF">Post your first listing free</a> — AI writes the description</li>
                <li>Share your listing link directly with buyers</li>
              </ol>
              <p style="color:#444">Your login: <strong>${email}</strong></p>
              <p style="color:#444">Questions? Reply to this email directly.</p>
              <p style="color:#444">— Chase<br>GetOffZillow AI</p>
            </div>
            <div style="background:#f7f7f7;padding:16px;text-align:center;font-size:11px;color:#888;border-radius:0 0 8px 8px">
              GetOffZillow AI · getoffzillow.com · Pensacola, FL · TransBid LLC
            </div>
          </div>`
      });
      return res.status(200).json({ success: true });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── MAIN SIGNUP FLOW ──
  const {
    first_name, last_name, email, password,
    phone, license_number, state, brokerage,
    bio, website, commission_rate, markets_served
  } = req.body;

  if (!first_name || !last_name || !email || !password)
    return res.status(400).json({ error: 'First name, last name, email, and password are required.' });

  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  if (!SUPABASE_SERVICE_KEY)
    return res.status(500).json({ error: 'Server configuration error. Contact support.' });

  try {
    // STEP 1: Create auth user
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({ email, password, email_confirm: true })
    });
    const authData = await authRes.json();

    if (!authRes.ok) {
      if (authData.message?.toLowerCase().includes('already registered') || authData.code === 'email_exists')
        return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
      throw new Error(authData.message || 'Account creation failed');
    }

    const userId = authData.id;

    // STEP 2: Insert agent profile with approved: false
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        user_id: userId,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        license_number: license_number?.trim() || null,
        state: state || null,
        brokerage: brokerage?.trim() || null,
        bio: bio?.trim() || null,
        website: website?.trim() || null,
        commission_rate: commission_rate || '2.5%',
        markets_served: markets_served?.trim() || null,
        approved: false,
        verified: false
      })
    });

    const profileData = await profileRes.json();
    if (!profileRes.ok) console.error('Profile insert failed:', profileData);

    const agentId = Array.isArray(profileData) ? profileData[0]?.id : profileData?.id;

    // STEP 3: Get session token for immediate login
    let accessToken = null;
    try {
      const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_SERVICE_KEY },
        body: JSON.stringify({ email, password })
      });
      const tokenData = await tokenRes.json();
      if (tokenRes.ok) accessToken = tokenData.access_token;
    } catch(e) { console.error('Token fetch failed:', e); }

    // STEP 4: Notify YOU at contactfire757@gmail.com
    try {
      await sendEmail(BREVO_API_KEY, {
        to: [{ email: 'contactfire757@gmail.com', name: 'Chase' }],
        subject: `New agent signup: ${first_name} ${last_name} — needs approval`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px">
            <h2 style="color:#111;border-bottom:3px solid #00FF9D;padding-bottom:12px">New Agent Signup</h2>
            <table style="width:100%;font-size:14px;border-collapse:collapse">
              <tr style="border-bottom:1px solid #eee"><td style="padding:10px 0;color:#666;width:120px;font-weight:600">Name</td><td style="padding:10px 0"><strong>${first_name} ${last_name}</strong></td></tr>
              <tr style="border-bottom:1px solid #eee"><td style="padding:10px 0;color:#666;font-weight:600">Email</td><td style="padding:10px 0"><a href="mailto:${email}">${email}</a></td></tr>
              <tr style="border-bottom:1px solid #eee"><td style="padding:10px 0;color:#666;font-weight:600">Phone</td><td style="padding:10px 0">${phone || '—'}</td></tr>
              <tr style="border-bottom:1px solid #eee"><td style="padding:10px 0;color:#666;font-weight:600">License</td><td style="padding:10px 0">${license_number || '—'}</td></tr>
              <tr style="border-bottom:1px solid #eee"><td style="padding:10px 0;color:#666;font-weight:600">State</td><td style="padding:10px 0">${state || '—'}</td></tr>
              <tr><td style="padding:10px 0;color:#666;font-weight:600">Brokerage</td><td style="padding:10px 0">${brokerage || '—'}</td></tr>
            </table>
            <div style="margin-top:20px;padding:14px;background:#fff3e0;border-radius:8px;border-left:4px solid #E67E00">
              <p style="margin:0;font-size:13px;color:#5D3A00"><strong>Their listings are hidden until you approve.</strong></p>
            </div>
            <a href="https://getoffzillow.com/admin.html" style="display:inline-block;margin-top:20px;background:#006AFF;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Approve in Admin →</a>
          </div>`
      });
    } catch(e) { console.error('Admin notification failed:', e); }

    // STEP 5: Send agent "pending review" email
    try {
      await sendEmail(BREVO_API_KEY, {
        to: [{ email, name: `${first_name} ${last_name}` }],
        subject: `GOZ: Your account is under review`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <div style="background:#111;padding:24px;border-radius:8px 8px 0 0;text-align:center;border-bottom:2px solid #00FF9D">
              <h1 style="color:#00FF9D;margin:0;font-size:28px;letter-spacing:2px">GOZ</h1>
              <p style="color:rgba(255,255,255,0.6);margin:6px 0 0;font-size:12px">GetOffZillow AI</p>
            </div>
            <div style="background:#fff;padding:32px;border:1px solid #e0e0e0;border-top:none">
              <h2 style="color:#1a1a1a">Thanks, ${first_name} — you're in the queue.</h2>
              <p style="color:#444;line-height:1.7">Your GetOffZillow AI agent account has been created. We review all new accounts before listings go live — you'll hear from us shortly, usually within a few hours.</p>
              <div style="background:#f7f7f7;border-radius:8px;padding:16px;margin:20px 0">
                <p style="margin:0;color:#444;font-size:13px;line-height:1.7">Once approved:<br>
                • Post unlimited listings free<br>
                • Buyers contact you directly — no middleman<br>
                • GOZ charges 3% of your commission at closing only — <strong>$300 on a $10,000 commission</strong></p>
              </div>
              <p style="color:#666;font-size:13px">Questions? Reply to this email.</p>
              <p style="color:#444">— Chase<br>GetOffZillow AI</p>
            </div>
            <div style="background:#f7f7f7;padding:16px;text-align:center;font-size:11px;color:#888;border-radius:0 0 8px 8px">
              GetOffZillow AI · getoffzillow.com · Pensacola, FL · TransBid LLC
            </div>
          </div>`
      });
    } catch(e) { console.error('Pending email failed:', e); }

    return res.status(200).json({
      success: true,
      agent_id: agentId,
      user_id: userId,
      access_token: accessToken,
      pending: true,
      message: "Account created! We'll review and approve your account shortly. You'll receive an email when approved."
    });

  } catch(err) {
    console.error('agent-signup error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function sendEmail(apiKey, { to, subject, html }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      sender: { name: 'GetOffZillow AI', email: 'campaigns@transbidlive.faith' },
      to,
      subject,
      htmlContent: html
    })
  });
  if (!res.ok) throw new Error('Brevo error: ' + await res.text());
  return res.json();
}
