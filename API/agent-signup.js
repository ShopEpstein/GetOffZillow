// api/agent-signup.js
// Vercel serverless function — creates Supabase Auth user + agent profile + sends Brevo welcome email

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  const {
    first_name, last_name, email, password,
    phone, license_number, state, brokerage,
    bio, website, commission_rate, markets_served
  } = req.body;

  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Create auth user using service role key
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true
      })
    });

    const authData = await authRes.json();
    if (!authRes.ok) throw new Error(authData.message || 'Auth creation failed');

    const userId = authData.id;

    // 2. Insert agent profile
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
        first_name, last_name, email,
        phone: phone || null,
        license_number: license_number || null,
        state: state || null,
        brokerage: brokerage || null,
        bio: bio || null,
        website: website || null,
        commission_rate: commission_rate || '2.5%',
        markets_served: markets_served || null
      })
    });

    const profileData = await profileRes.json();
    if (!profileRes.ok) throw new Error(profileData.message || 'Profile creation failed');

    // 3. Send Brevo welcome email
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { name: 'GetOffZillow AI', email: 'campaigns@transbidlive.faith' },
        to: [{ email, name: `${first_name} ${last_name}` }],
        subject: '🎉 Welcome to GetOffZillow AI — You\'re locked in at 1%',
        htmlContent: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px">
            <div style="background:#006AFF;padding:24px;border-radius:8px 8px 0 0;text-align:center">
              <h1 style="color:white;margin:0;font-size:28px">GetOffZillow<span style="color:#00FF9D">AI</span></h1>
              <p style="color:rgba(255,255,255,0.8);margin:8px 0 0">Real Estate Without the B.S.</p>
            </div>
            <div style="background:#ffffff;padding:32px;border:1px solid #e0e0e0;border-top:none">
              <h2 style="color:#1a1a1a">Welcome, ${first_name}! 🏡</h2>
              <p style="color:#444;line-height:1.6">You're officially a GetOffZillow AI agent. Here's what that means:</p>
              <div style="background:#f0fff8;border-left:4px solid #00C853;padding:16px;border-radius:4px;margin:20px 0">
                <strong style="color:#00C853;font-size:20px">1% referral fee — locked for life.</strong><br>
                <span style="color:#444;font-size:13px">Agent Pronto charges 35%. Zillow charges 40%. You pay $100 on a $10,000 commission. That's it.</span>
              </div>
              <p style="color:#444;line-height:1.6"><strong>Your next steps:</strong></p>
              <ol style="color:#444;line-height:1.8">
                <li><a href="https://get-off-zillow.vercel.app/dashboard.html" style="color:#006AFF">Complete your agent profile</a> — add your photo, bio, and markets</li>
                <li><a href="https://get-off-zillow.vercel.app/list.html" style="color:#006AFF">Submit your first listing</a> — free, photos included</li>
                <li>Share your profile link with buyers — they contact you directly, zero middleman</li>
              </ol>
              <p style="color:#444;line-height:1.6">Questions? Reply to this email directly.</p>
              <p style="color:#444">— The GetOffZillow AI Team</p>
            </div>
            <div style="background:#f7f7f7;padding:16px;text-align:center;font-size:11px;color:#888;border-radius:0 0 8px 8px">
              GetOffZillow AI · Pensacola, FL · TransBid LLC<br>
              <a href="#" style="color:#888">Unsubscribe</a>
            </div>
          </div>
        `
      })
    });

    return res.status(200).json({
      success: true,
      agent_id: profileData[0]?.id,
      message: 'Account created! Check your email.'
    });

  } catch (err) {
    console.error('agent-signup error:', err);
    return res.status(500).json({ error: err.message });
  }
}
