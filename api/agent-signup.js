// api/agent-signup.js v2
// FIXED: Returns access_token so client can auto-login after signup
// FIXED: Better error handling on profile insert (checks .error not .message)
// FIXED: Handles duplicate email gracefully

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  const {
    first_name, last_name, email, password,
    phone, license_number, state, brokerage,
    bio, website, commission_rate, markets_served
  } = req.body;

  if (!first_name || !last_name || !email || !password) {
    return res.status(400).json({ error: 'First name, last name, email, and password are required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Server configuration error: missing service key. Contact support.' });
  }

  try {
    // ── STEP 1: Create auth user ──
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
        email_confirm: true  // skip email confirmation — agents can use immediately
      })
    });

    const authData = await authRes.json();

    // Handle duplicate email
    if (!authRes.ok) {
      if (authData.message?.toLowerCase().includes('already registered') ||
          authData.code === 'email_exists') {
        return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
      }
      throw new Error(authData.message || authData.msg || 'Account creation failed');
    }

    const userId = authData.id;

    // ── STEP 2: Insert agent profile ──
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
        markets_served: markets_served?.trim() || null
      })
    });

    const profileData = await profileRes.json();

    if (!profileRes.ok) {
      // Auth user was created but profile failed — log but don't crash
      // Agent can still sign in and complete profile later
      console.error('Profile insert failed:', profileData);
      // Still return success with userId so client can proceed
      return res.status(200).json({
        success: true,
        agent_id: null,
        user_id: userId,
        warning: 'Account created but profile incomplete. Please complete your profile after signing in.',
        message: 'Account created!'
      });
    }

    const agentId = Array.isArray(profileData) ? profileData[0]?.id : profileData?.id;

    // ── STEP 3: Get a session token for immediate login ──
    // Sign in right after creating the account so user lands on dashboard
    let accessToken = null;
    try {
      const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY
        },
        body: JSON.stringify({ email, password })
      });
      const tokenData = await tokenRes.json();
      if (tokenRes.ok) {
        accessToken = tokenData.access_token;
      }
    } catch (tokenErr) {
      // Non-fatal — user can still sign in manually
      console.error('Auto-login token fetch failed:', tokenErr);
    }

    // ── STEP 4: Send Brevo welcome email ──
    try {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': BREVO_API_KEY
        },
        body: JSON.stringify({
          sender: { name: 'GetOffZillow AI', email: 'campaigns@transbidlive.faith' },
          to: [{ email, name: `${first_name} ${last_name}` }],
          subject: `🎉 Welcome to GetOffZillow AI — You're locked in at 3%`,
          htmlContent: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px">
              <div style="background:#006AFF;padding:24px;border-radius:8px 8px 0 0;text-align:center">
                <h1 style="color:white;margin:0;font-size:28px">GetOffZillow<span style="color:#00FF9D">AI</span></h1>
                <p style="color:rgba(255,255,255,0.8);margin:8px 0 0">Real Estate Without the B.S.</p>
              </div>
              <div style="background:#ffffff;padding:32px;border:1px solid #e0e0e0;border-top:none">
                <h2 style="color:#1a1a1a">Welcome, ${first_name}! 🏡</h2>
                <p style="color:#444;line-height:1.6">You're officially a GetOffZillow AI agent.</p>
                <div style="background:#f0fff8;border-left:4px solid #00C853;padding:16px;border-radius:4px;margin:20px 0">
                  <strong style="color:#00C853;font-size:20px">1% marketing fee — locked for life.</strong><br>
                  <span style="color:#444;font-size:13px">Agent Pronto charges 35%. Zillow charges 40%. You pay $100 on a $10,000 commission. That's it.</span>
                </div>
                <p style="color:#444;line-height:1.6"><strong>Your next steps:</strong></p>
                <ol style="color:#444;line-height:1.8">
                  <li><a href="https://get-off-zillow.vercel.app/dashboard.html" style="color:#006AFF">Sign in to your dashboard</a></li>
                  <li><a href="https://get-off-zillow.vercel.app/list.html" style="color:#006AFF">Submit your first listing</a> — free, photos included</li>
                  <li>Share your public profile with buyers — direct contact, no middleman</li>
                </ol>
                <p style="color:#444;line-height:1.6">Your login: <strong>${email}</strong></p>
                <p style="color:#444;line-height:1.6">Questions? Reply to this email directly.</p>
                <p style="color:#444">— The GetOffZillow AI Team</p>
              </div>
              <div style="background:#f7f7f7;padding:16px;text-align:center;font-size:11px;color:#888;border-radius:0 0 8px 8px">
                GetOffZillow AI · Pensacola, FL · TransBid LLC
              </div>
            </div>
          `
        })
      });
    } catch (emailErr) {
      // Non-fatal — account still created
      console.error('Welcome email failed:', emailErr);
    }

    return res.status(200).json({
      success: true,
      agent_id: agentId,
      user_id: userId,
      access_token: accessToken,  // ← NEW: allows auto-login on client
      message: 'Account created successfully!'
    });

  } catch (err) {
    console.error('agent-signup error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
