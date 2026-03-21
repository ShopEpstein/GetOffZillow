// api/forgot-password.js
// Triggers Supabase password reset email

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        email,
        gotrue_meta_security: {}
      })
    });

    // Always return 200 — don't reveal whether email exists
    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(200).json({ success: true }); // still 200 for security
  }
}
