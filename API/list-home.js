// api/list-home.js
// Handles listing creation. Photos are uploaded client-side directly to Supabase Storage.
// This endpoint just saves the listing metadata + photo URLs to the listings table.

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const {
    agent_id, address, city, state, zip,
    price, beds, baths, sqft, description,
    commission_rate, property_type, photos, website_url,
    auth_token
  } = req.body;

  if (!agent_id || !address || !city || !price) {
    return res.status(400).json({ error: 'Missing required fields: agent_id, address, city, price' });
  }

  try {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${auth_token || SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        agent_id,
        address,
        city,
        state: state || 'FL',
        zip: zip || null,
        price: parseFloat(price),
        beds: beds ? parseInt(beds) : null,
        baths: baths ? parseFloat(baths) : null,
        sqft: sqft ? parseInt(sqft) : null,
        description: description || null,
        commission_rate: commission_rate || '2.5%',
        property_type: property_type || 'Single Family',
        photos: photos || [],
        website_url: website_url || null,
        status: 'active'
      })
    });

    const data = await insertRes.json();
    if (!insertRes.ok) throw new Error(data.message || 'Listing creation failed');

    return res.status(200).json({ success: true, listing: data[0] });

  } catch (err) {
    console.error('list-home error:', err);
    return res.status(500).json({ error: err.message });
  }
}
