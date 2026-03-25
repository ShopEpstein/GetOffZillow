// api/streetview.js
// Fetches a Google Street View Static API image for a given lat/lng
// Requires GOOGLE_MAPS_KEY environment variable in Vercel

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lng, width = 1200, height = 800 } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Google Maps API key not configured' });
  }

  // First check if Street View imagery exists at this location
  const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&key=${key}`;
  
  try {
    const metaRes = await fetch(metaUrl);
    const meta = await metaRes.json();
    
    if (meta.status !== 'OK') {
      return res.status(404).json({ error: 'No Street View imagery available at this location' });
    }

    // Fetch the actual Street View image
    const svUrl = `https://maps.googleapis.com/maps/api/streetview?size=${width}x${height}&location=${lat},${lng}&fov=90&heading=235&pitch=10&key=${key}`;
    
    const svRes = await fetch(svUrl);
    
    if (!svRes.ok) {
      return res.status(502).json({ error: 'Street View fetch failed' });
    }

    const buffer = await svRes.arrayBuffer();
    
    // Return the image directly
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 24h
    res.status(200).send(Buffer.from(buffer));

  } catch (err) {
    console.error('streetview error:', err);
    return res.status(500).json({ error: err.message });
  }
}
