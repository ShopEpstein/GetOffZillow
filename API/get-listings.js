// api/get-listings.js
// Returns listings with agent info joined. Used by index.html and search.

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  const { city, min_price, max_price, beds, status = 'active', agent_id, id } = req.query;

  let url = `${SUPABASE_URL}/rest/v1/listings?status=eq.${status}&select=*,agents(id,first_name,last_name,email,phone,photo_url,website,brokerage,commission_rate)&order=created_at.desc&limit=50`;

  if (city) url += `&city=ilike.*${city}*`;
  if (min_price) url += `&price=gte.${min_price}`;
  if (max_price) url += `&price=lte.${max_price}`;
  if (beds) url += `&beds=gte.${beds}`;
  if (agent_id) url += `&agent_id=eq.${agent_id}`;
  if (id) url = `${SUPABASE_URL}/rest/v1/listings?id=eq.${id}&select=*,agents(id,first_name,last_name,email,phone,photo_url,website,brokerage,commission_rate)`;

  try {
    const r = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    const data = await r.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
