// api/notify-offer.js
// Sends offer notification to agent + admin via Brevo
// Verified Brevo sender: campaigns@transbidlive.faith

const ADMIN_EMAIL = 'campaigns@transbidlive.faith';
const FROM_EMAIL  = 'campaigns@transbidlive.faith';
const FROM_NAME   = 'GetOffZillow AI';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { offer, agentEmail, agentName, agentPhone, listingAddress, listingPrice } = req.body || {};

  if (!offer) return res.status(400).json({ error: 'No offer data' });

  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) {
    console.error('BREVO_API_KEY not set');
    return res.status(200).json({ sent: false, reason: 'Email service not configured' });
  }

  const offerPrice      = offer.offer_price ? '$' + Number(offer.offer_price).toLocaleString() : 'Not specified';
  const listingPriceStr = listingPrice ? '$' + Number(listingPrice).toLocaleString() : 'See listing';
  const contingencies   = offer.contingencies || 'None';
  const financing       = offer.financing_type || 'Not specified';
  const downPct         = offer.down_payment_pct ? offer.down_payment_pct + '%' : 'Not specified';
  const closeDate       = offer.proposed_close_date || 'Flexible';
  const hasAgentStr     = offer.has_buyer_agent ? 'Yes — buyer has representation' : 'No — buyer is going direct';
  const buyerMsg        = offer.message ? `<p style="background:#f9f9f9;padding:12px;border-radius:6px;font-style:italic">"${offer.message}"</p>` : '';
  const address         = listingAddress || offer.listing_address || 'Unknown address';

  const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <div style="background:#111;padding:24px 32px">
      <span style="font-size:22px;color:#00FF9D;font-weight:900;letter-spacing:0.1em;font-family:Arial Black,Arial,sans-serif">GOZ</span>
      <span style="font-size:11px;color:rgba(255,255,255,0.4);margin-left:8px;font-family:monospace">GetOffZillow AI</span>
    </div>
    <div style="background:#006AFF;padding:16px 32px">
      <div style="font-size:20px;font-weight:700;color:white">&#127968; New Offer Received</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px">${address}</div>
    </div>
    <div style="padding:28px 32px">
      <p style="font-size:15px;color:#333;margin-bottom:20px">Hi ${agentName || 'Agent'},<br><br>You have a new offer on your listing through GetOffZillow AI.</p>
      <div style="background:#f0fff8;border:1px solid #00C853;border-radius:10px;padding:20px;margin-bottom:20px">
        <div style="font-size:36px;font-weight:900;color:#00843d">${offerPrice}</div>
        <div style="font-size:12px;color:#666;margin-top:2px">Offer price &nbsp;&middot;&nbsp; Listed at ${listingPriceStr}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:10px 0;font-size:12px;color:#999;font-weight:600;text-transform:uppercase;width:40%">Financing</td>
          <td style="padding:10px 0;font-size:14px;color:#333">${financing}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:10px 0;font-size:12px;color:#999;font-weight:600;text-transform:uppercase">Down Payment</td>
          <td style="padding:10px 0;font-size:14px;color:#333">${downPct}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:10px 0;font-size:12px;color:#999;font-weight:600;text-transform:uppercase">Close Date</td>
          <td style="padding:10px 0;font-size:14px;color:#333">${closeDate}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:10px 0;font-size:12px;color:#999;font-weight:600;text-transform:uppercase">Contingencies</td>
          <td style="padding:10px 0;font-size:14px;color:#333">${contingencies}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;font-size:12px;color:#999;font-weight:600;text-transform:uppercase">Buyer's Agent?</td>
          <td style="padding:10px 0;font-size:14px;color:#333">${hasAgentStr}</td>
        </tr>
      </table>
      <div style="background:#f9f9f9;border-radius:10px;padding:20px;margin-bottom:20px">
        <div style="font-size:11px;color:#999;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">Buyer Contact — reach out directly</div>
        <div style="font-size:18px;font-weight:700;color:#111;margin-bottom:8px">${offer.buyer_name}</div>
        <div style="margin-bottom:4px"><a href="mailto:${offer.buyer_email}" style="color:#006AFF;font-size:15px;font-weight:600;text-decoration:none">${offer.buyer_email}</a></div>
        ${offer.buyer_phone ? `<div><a href="tel:${offer.buyer_phone}" style="color:#006AFF;font-size:15px;font-weight:600;text-decoration:none">${offer.buyer_phone}</a></div>` : '<div style="font-size:12px;color:#999">No phone provided</div>'}
      </div>
      ${buyerMsg ? `<div style="margin-bottom:20px"><div style="font-size:11px;color:#999;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Message from Buyer</div>${buyerMsg}</div>` : ''}
      <div style="text-align:center;margin-top:24px">
        <a href="https://getoffzillow.com/dashboard.html" style="display:inline-block;background:#006AFF;color:white;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none">View in Dashboard &#8594;</a>
      </div>
      <p style="font-size:12px;color:#999;margin-top:24px;line-height:1.6">
        This offer was submitted through GetOffZillow AI. A formal Purchase &amp; Sale Agreement is required before any deal is binding.<br>
        Questions? <a href="mailto:campaigns@transbidlive.faith" style="color:#006AFF">campaigns@transbidlive.faith</a>
      </p>
    </div>
    <div style="background:#f4f4f4;padding:16px 32px;font-size:11px;color:#999;font-family:monospace">
      GetOffZillow AI &middot; TransBid LLC &middot; Pensacola FL &middot; Technology marketing fee paid only at closing
    </div>
  </div>
</body>
</html>`;

  const recipients = [];
  if (agentEmail) recipients.push({ email: agentEmail, name: agentName || 'Agent' });
  recipients.push({ email: ADMIN_EMAIL, name: 'GOZ Admin' });

  const results = [];
  for (const recipient of recipients) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': brevoKey,
        },
        body: JSON.stringify({
          sender: { name: FROM_NAME, email: FROM_EMAIL },
          to: [recipient],
          subject: `🏠 New Offer: ${offerPrice} — ${address}`,
          htmlContent: emailHtml,
          replyTo: { email: offer.buyer_email, name: offer.buyer_name },
        }),
      });

      const responseText = await response.text();
      if (!response.ok) {
        console.error(`Brevo error for ${recipient.email}:`, response.status, responseText);
        results.push({ email: recipient.email, sent: false, error: responseText });
      } else {
        console.log(`Email sent to ${recipient.email}`);
        results.push({ email: recipient.email, sent: true });
      }
    } catch (e) {
      console.error(`Email send error for ${recipient.email}:`, e.message);
      results.push({ email: recipient.email, sent: false, error: e.message });
    }
  }

  return res.status(200).json({
    sent: results.some(r => r.sent),
    results,
    agentNotified: !!agentEmail,
    adminNotified: true,
  });
}
