// api/overpass.js
// Vercel Serverless Function Proxy for Smart AI Route Finder
// Bypasses browser-level CORS and Vercel Origin blocks from public Overpass servers.

export default async function handler(req, res) {
  // Allow CORS from your frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse the query from POST body or GET query param
  let query = '';
  if (req.method === 'POST') {
    // If request has been parsed as JSON or urlencoded
    if (typeof req.body === 'object') {
      query = req.body.data;
    } else {
      // Raw string query
      const bodyParams = new URLSearchParams(req.body);
      query = bodyParams.get('data') || req.body;
    }
  } else {
    query = req.query.data;
  }

  if (!query) {
    return res.status(400).json({ error: "Missing 'data' parameter in query or request body." });
  }

  const OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
  ];

  // Make server-to-server requests with a unique User-Agent
  for (const url of OVERPASS_MIRRORS) {
    try {
      console.log(`Serverless Proxy: Attempting to fetch from mirror: ${url}`);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "SmartAIRouteFinder/1.0 (ashishbavaliya535@gmail.com)"
        },
        body: "data=" + encodeURIComponent(query)
      });

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      } else {
        console.warn(`Serverless Proxy: Mirror ${url} returned status: ${response.status}`);
      }
    } catch (err) {
      console.error(`Serverless Proxy: Failed to fetch from mirror ${url}:`, err);
    }
  }

  return res.status(502).json({ error: "All upstream Overpass API mirrors failed to respond." });
}
