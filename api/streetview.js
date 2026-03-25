// api/streetview.js — Google Street View Static API proxy
// Accepts: lat, lng, heading (0-359), pitch (-90 to 90), fov (40-120), width, height
// check=1 returns metadata only (to verify imagery exists before showing UI)

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const {
    lat, lng,
    heading = 0,
    pitch   = 5,
    fov     = 90,
    width   = 1200,
    height  = 800,
    check   = 0
  } = req.query;

  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) return res.status(500).json({ error: 'GOOGLE_MAPS_KEY not set' });

  // Always check metadata first
  const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${key}`;

  try {
    const metaRes = await fetch(metaUrl);
    const meta    = await metaRes.json();

    if (meta.status !== 'OK') {
      return res.status(404).json({ error: 'No Street View imagery at this location', status: meta.status });
    }

    // If check=1, just confirm imagery exists — don't fetch the image
    if (String(check) === '1') {
      return res.status(200).json({ ok: true, location: meta.location });
    }

    // Clamp values to safe ranges
    const h = Math.min(359, Math.max(0,   parseInt(heading) || 0));
    const p = Math.min(45,  Math.max(-45, parseInt(pitch)   || 5));
    const f = Math.min(120, Math.max(40,  parseInt(fov)     || 90));
    const w = Math.min(1600, Math.max(400, parseInt(width)  || 1200));
    const ht = Math.min(900, Math.max(300, parseInt(height) || 800));

    const svUrl = `https://maps.googleapis.com/maps/api/streetview?size=${w}x${ht}&location=${lat},${lng}&heading=${h}&pitch=${p}&fov=${f}&key=${key}`;

    const svRes = await fetch(svUrl);
    if (!svRes.ok) return res.status(502).json({ error: 'Street View fetch failed' });

    const buffer = await svRes.arrayBuffer();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(Buffer.from(buffer));

  } catch(err) {
    console.error('streetview error:', err);
    return res.status(500).json({ error: err.message });
  }
}
