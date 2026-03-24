// api/ai-listing.js
// Proxies Claude API calls for the AI Listing Writer — keeps API key server-side

export default async function handler(req, res) {
  // CORS headers so the browser can call this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { propertyInfo, emphasis } = req.body;

  if (!propertyInfo || !propertyInfo.trim()) {
    return res.status(400).json({ error: 'propertyInfo is required' });
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'AI service not configured' });
  }

  const prompt = `You are a professional real estate copywriter. Write a compelling property listing description based on this info:

Property info: ${propertyInfo.trim()}
${emphasis ? `Emphasis: ${emphasis.trim()}` : ''}

Write ONLY the property description (2-3 paragraphs, 150-200 words). No headlines, no asterisks, no bullet points. Just clean, compelling prose that would make a buyer want to schedule a showing. Be specific, honest, and highlight genuine value. Don't use fluff words like "stunning" or "breathtaking". Write like a pro agent who knows the local market.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return res.status(502).json({ error: 'AI service error', detail: err });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    if (!text) return res.status(502).json({ error: 'Empty response from AI' });

    return res.status(200).json({ description: text });

  } catch (e) {
    console.error('ai-listing handler error:', e);
    return res.status(500).json({ error: 'Server error', detail: e.message });
  }
}
