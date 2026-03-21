// api/waitlist.js
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ email })
    });

    // Brevo confirmation
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
      body: JSON.stringify({
        sender: { name: 'GetOffZillow AI', email: 'campaigns@transbidlive.faith' },
        to: [{ email }],
        subject: "You're on the GetOffZillow AI waitlist 🎉",
        htmlContent: `<div style="font-family:Arial,sans-serif;padding:32px;max-width:500px">
          <h2 style="color:#006AFF">You're on the list!</h2>
          <p>We'll reach out within 24 hours with your early access link.</p>
          <p style="color:#444">Remember: <strong>1% referral fee. Locked for life.</strong> Zillow charges 40%. Do the math.</p>
          <p>— GetOffZillow AI Team</p>
        </div>`
      })
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    // Ignore duplicate email errors gracefully
    if (err.message?.includes('duplicate')) {
      return res.status(200).json({ success: true, note: 'Already on list' });
    }
    return res.status(500).json({ error: err.message });
  }
}
