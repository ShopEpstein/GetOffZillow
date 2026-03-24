// /api/og.js — GetOffZillow AI
// Serves proper Open Graph meta tags for listing shares
// Bots (iMessage, Slack, WhatsApp, Twitter, Google) get OG HTML
// Real browsers get a 302 redirect to listing.html instantly

const SUPABASE_URL = 'https://pneixwmkphakoxmzkblx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuZWl4d21rcGhha294bXprYmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNjE2NDAsImV4cCI6MjA4OTYzNzY0MH0.SDwzNkVCehQQqDkmj_516iFD-jphjGF1u43l19SAN_0';

// Known crawler / bot user-agent patterns
const BOT_PATTERNS = [
  'facebookexternalhit', 'twitterbot', 'linkedinbot', 'whatsapp',
  'slackbot', 'telegrambot', 'discordbot', 'imessage', 'applebot',
  'googlebot', 'bingbot', 'iframely', 'embedly', 'outbrain',
  'pinterest', 'tumblr', 'vkshare', 'w3c_validator', 'curl',
  'wget', 'python-requests', 'go-http-client', 'preview',
];

function isBot(ua) {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return BOT_PATTERNS.some(p => lower.includes(p));
}

function parsePhotos(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    if (raw.startsWith('[')) {
      try { const p = JSON.parse(raw); return Array.isArray(p) ? p.filter(Boolean) : []; } catch(e) {}
    }
    if (raw.startsWith('{') && raw.endsWith('}')) {
      return raw.slice(1,-1).split(',')
        .map(s => s.trim().replace(/^"|"$/g,''))
        .filter(s => s.startsWith('http'));
    }
    if (raw.startsWith('http')) return [raw];
  }
  return [];
}

export default async function handler(req, res) {
  const { id } = req.query;
  const ua = req.headers['user-agent'] || '';
  const baseUrl = 'https://www.getoffzillow.com';
  const fallbackUrl = id ? `${baseUrl}/listing.html?id=${id}` : `${baseUrl}/index.html`;

  // No ID — just redirect home
  if (!id) {
    res.redirect(302, baseUrl);
    return;
  }

  // Real browser — redirect immediately, no OG needed
  if (!isBot(ua)) {
    res.redirect(302, fallbackUrl);
    return;
  }

  // Bot — fetch listing and return OG HTML
  try {
    const apiRes = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${encodeURIComponent(id)}&select=id,address,city,state,price,beds,baths,sqft,commission_rate,photos,description&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Accept': 'application/json',
        }
      }
    );

    const listings = await apiRes.json();
    const listing = listings?.[0];

    if (!listing) {
      res.redirect(302, fallbackUrl);
      return;
    }

    const photos = parsePhotos(listing.photos);
    const photo = photos[0] || 'https://www.getoffzillow.com/og-default.jpg';

    const price = listing.price ? '$' + Number(listing.price).toLocaleString('en-US') : '';
    const addr = [listing.address, listing.city, listing.state].filter(Boolean).join(', ');
    const specs = [
      listing.beds  ? listing.beds + ' bed'  : null,
      listing.baths ? listing.baths + ' bath' : null,
      listing.sqft  ? Number(listing.sqft).toLocaleString() + ' sqft' : null,
    ].filter(Boolean).join(' · ');
    const comm = listing.commission_rate ? ` · ${listing.commission_rate} commission shown publicly` : '';

    const title = `${addr} — ${price} | GetOffZillow AI`;
    const description = [specs + comm, listing.description].filter(Boolean).join(' — ').slice(0, 200);
    const canonical = `${baseUrl}/listing.html?id=${id}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escHtml(title)}</title>

<!-- Open Graph -->
<meta property="og:type"        content="website" />
<meta property="og:url"         content="${escHtml(canonical)}" />
<meta property="og:title"       content="${escHtml(title)}" />
<meta property="og:description" content="${escHtml(description)}" />
<meta property="og:image"       content="${escHtml(photo)}" />
<meta property="og:image:width"  content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:site_name"   content="GetOffZillow AI" />

<!-- Twitter Card -->
<meta name="twitter:card"        content="summary_large_image" />
<meta name="twitter:title"       content="${escHtml(title)}" />
<meta name="twitter:description" content="${escHtml(description)}" />
<meta name="twitter:image"       content="${escHtml(photo)}" />

<!-- iMessage / Apple -->
<meta name="apple-mobile-web-app-title" content="GetOffZillow AI" />

<!-- Instant redirect for any real browser that lands here -->
<meta http-equiv="refresh" content="0;url=${escHtml(canonical)}" />
<link rel="canonical" href="${escHtml(canonical)}" />
</head>
<body>
<script>window.location.replace("${escJs(canonical)}");</script>
<a href="${escHtml(canonical)}">View listing →</a>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(html);

  } catch (err) {
    console.error('og.js error:', err);
    res.redirect(302, fallbackUrl);
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escJs(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E');
}
