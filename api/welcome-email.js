// api/welcome-email.js
// Sends welcome email to new agents via Brevo
// Called from client-side signup after account creation

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) return res.status(500).json({ error: 'Email service not configured' });

  const { first_name, last_name, email } = req.body;
  if (!email || !first_name) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { name: 'GOZ Team', email: 'campaigns@transbidlive.faith' },
        to: [{ email, name: `${first_name} ${last_name || ''}`.trim() }],
        subject: `Welcome to GOZ, ${first_name} — you're locked in at 3%`,
        htmlContent: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f1eb;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:580px;margin:40px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

  <!-- HEADER -->
  <div style="background:#0D0D0D;padding:28px 32px;display:flex;align-items:center;gap:12px">
    <div style="width:36px;height:36px;background:#0D0D0D;border:1.5px solid #00FF9D;border-radius:8px;display:inline-flex;align-items:center;justify-content:center">
      <span style="font-size:18px">🏡</span>
    </div>
    <div>
      <div style="font-family:Georgia,serif;font-size:22px;color:#00FF9D;letter-spacing:3px;font-weight:700">GOZ</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:1px;text-transform:uppercase">GetOffZillow AI</div>
    </div>
  </div>

  <!-- BODY -->
  <div style="padding:36px 32px">
    <h1 style="font-size:24px;color:#0D0D0D;margin:0 0 8px;font-weight:700">Welcome, ${first_name}. You're in. 🎉</h1>
    <p style="font-size:15px;color:#6B6B6B;line-height:1.7;margin:0 0 24px">Your free agent account is live on GOZ. Here's what you need to know before your first listing.</p>

    <!-- FEE BOX -->
    <div style="background:#f0fff8;border-left:4px solid #00843d;border-radius:6px;padding:20px 24px;margin:0 0 28px">
      <div style="font-size:28px;font-weight:700;color:#00843d;font-family:Georgia,serif">3%</div>
      <div style="font-size:14px;color:#1A1A1A;font-weight:600;margin-top:2px">of your gross commission at closing</div>
      <div style="font-size:13px;color:#6B6B6B;margin-top:6px;line-height:1.6">
        Not 3% of the sale price. On a $400K sale at 2.5% commission, your gross commission is $10,000. We take $300. You keep $9,700.<br>
        <strong style="color:#0D0D0D">Listing is always free. You pay nothing until a GOZ buyer closes with you.</strong>
      </div>
    </div>

    <!-- NEXT STEPS -->
    <p style="font-size:14px;font-weight:700;color:#0D0D0D;margin:0 0 14px;text-transform:uppercase;letter-spacing:0.5px">Your next three steps:</p>
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="padding:12px 16px;background:#f7f7f7;border-radius:8px;margin-bottom:8px;display:block">
          <span style="font-weight:700;color:#006AFF">01 —</span>
          <a href="https://get-off-zillow.vercel.app/list.html" style="color:#006AFF;font-weight:600;text-decoration:none">Submit your first listing →</a>
          <div style="font-size:12px;color:#6B6B6B;margin-top:3px">Takes 3 minutes. AI writes the description for you. Photos included.</div>
        </td>
      </tr>
      <tr><td style="height:8px"></td></tr>
      <tr>
        <td style="padding:12px 16px;background:#f7f7f7;border-radius:8px;display:block">
          <span style="font-weight:700;color:#006AFF">02 —</span>
          <a href="https://get-off-zillow.vercel.app/dashboard.html" style="color:#006AFF;font-weight:600;text-decoration:none">Visit your dashboard →</a>
          <div style="font-size:12px;color:#6B6B6B;margin-top:3px">Manage listings, view buyer leads, get your invite link.</div>
        </td>
      </tr>
      <tr><td style="height:8px"></td></tr>
      <tr>
        <td style="padding:12px 16px;background:#f7f7f7;border-radius:8px;display:block">
          <span style="font-weight:700;color:#006AFF">03 —</span>
          <span style="color:#0D0D0D;font-weight:600">Invite other agents</span>
          <div style="font-size:12px;color:#6B6B6B;margin-top:3px">Your invite link is in the dashboard. Every agent you bring in grows the platform — more agents means more buyers.</div>
        </td>
      </tr>
    </table>

    <!-- REMINDER -->
    <div style="margin-top:28px;padding:16px 20px;background:#0D0D0D;border-radius:8px">
      <p style="font-size:13px;color:rgba(255,255,255,0.7);margin:0;line-height:1.7">
        <strong style="color:#00FF9D">Quick reminder on the fee:</strong> You only pay GOZ when a buyer who contacted you <em>through GOZ</em> closes a deal with you. If that never happens, your cost is zero. When it does happen, report it in your dashboard and pay via Venmo <strong style="color:white">@VinHunter</strong> or Zelle within 10 days.
      </p>
    </div>

    <p style="font-size:14px;color:#6B6B6B;margin:24px 0 0;line-height:1.7">
      Questions? Reply to this email — we read every one.<br>
      <strong style="color:#0D0D0D">— The GOZ Team</strong><br>
      <span style="font-size:12px">Pensacola, FL</span>
    </p>
  </div>

  <!-- FOOTER -->
  <div style="background:#f4f1eb;padding:20px 32px;text-align:center;font-size:11px;color:#999;border-top:1px solid #e8e3d8">
    GOZ · GetOffZillow AI · TransBid LLC · Pensacola, FL<br>
    <a href="https://get-off-zillow.vercel.app/terms.html" style="color:#999;text-decoration:none">Terms</a> ·
    <a href="https://get-off-zillow.vercel.app/privacy.html" style="color:#999;text-decoration:none">Privacy</a>
  </div>
</div>
</body>
</html>`
      })
    });

    if (!resp.ok) {
      const err = await resp.json();
      console.error('Brevo error:', err);
      return res.status(500).json({ error: 'Email send failed' });
    }

    // ── ADMIN NOTIFICATION — email you when new agent signs up ──
    try {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
        body: JSON.stringify({
          sender: { name: 'GOZ Platform', email: 'campaigns@transbidlive.faith' },
          to: [{ email: 'campaigns@transbidlive.faith', name: 'GOZ Admin' }],
          subject: `🆕 New Agent Signup — ${first_name} ${last_name || ''}`,
          htmlContent: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f4f1eb">
              <div style="background:#0D0D0D;padding:16px 20px;border-radius:8px 8px 0 0">
                <span style="font-family:Georgia,serif;color:#00FF9D;font-size:18px;letter-spacing:3px;font-weight:700">GOZ</span>
                <span style="color:rgba(255,255,255,0.4);font-size:11px;margin-left:8px">New Agent Alert</span>
              </div>
              <div style="background:white;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e0e0e0;border-top:none">
                <h2 style="margin:0 0 16px;font-size:18px;color:#0D0D0D">New agent signed up</h2>
                <table style="width:100%;border-collapse:collapse;font-size:14px">
                  <tr><td style="padding:8px 0;color:#666;width:120px">Name</td><td style="padding:8px 0;font-weight:600">${first_name} ${last_name || ''}</td></tr>
                  <tr><td style="padding:8px 0;color:#666">Email</td><td style="padding:8px 0"><a href="mailto:${email}" style="color:#006AFF">${email}</a></td></tr>
                </table>
                <div style="margin-top:20px;padding:14px;background:#f0fff8;border-radius:6px;font-size:13px;color:#444">
                  They've been sent the welcome email and redirected to list their first property.
                </div>
              </div>
            </div>`
        })
      });
    } catch(adminErr) {
      console.warn('Admin notification failed:', adminErr.message);
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('welcome-email error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
