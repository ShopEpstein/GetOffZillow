// api/streetview.js
// Proxies Google Street View Static API — keeps key server-side
// Falls back to Mapbox satellite if no Google key configured

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lng, address } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });

  const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY;

  // ── TRY GOOGLE STREET VIEW FIRST ──
  if (GOOGLE_KEY) {
    try {
      const url = `https://maps.googleapis.com/maps/api/streetview?size=800x500&location=${lat},${lng}&fov=90&pitch=0&key=${GOOGLE_KEY}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(Buffer.from(buf));
      }
    } catch(e) { console.warn('Google SV failed:', e.message); }
  }

  // ── FALLBACK: Mapbox Satellite (free, no key needed for basic) ──
  try {
    const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || '';
    if (MAPBOX_TOKEN) {
      const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lng},${lat},18,0/800x500?access_token=${MAPBOX_TOKEN}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const buf = await resp.arrayBuffer();
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.status(200).send(Buffer.from(buf));
      }
    }
  } catch(e) { console.warn('Mapbox fallback failed:', e.message); }

  // ── FINAL FALLBACK: return 404 so client shows helpful message ──
  return res.status(404).json({ error: 'Street view not available. Add GOOGLE_MAPS_KEY or MAPBOX_TOKEN to Vercel environment variables.' });
}
