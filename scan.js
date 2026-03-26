export const config = {
  api: {
    bodyParser: { sizeLimit: '4mb' },
  },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' })
    }
  }

  const { url } = body
  if (!url) return res.status(400).json({ error: 'url is required' })

  // Clean the URL
  const cleanUrl = url.startsWith('http') ? url : `https://${url}`

  try {
    // Fetch the website HTML
    const siteRes = await fetch(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CreativeOS/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!siteRes.ok) {
      return res.status(400).json({ error: `Could not fetch ${cleanUrl} — status ${siteRes.status}` })
    }

    const html = await siteRes.text()

    // Strip HTML tags, get readable text — limit to 8000 chars
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8000)

    // Now ask Claude to extract brand intelligence from the page text
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are a brand analyst. Extract brand intelligence from website content. Be specific and factual — only state what you can actually see on the page. Do not invent or assume.`,
        messages: [{
          role: 'user',
          content: `Website URL: ${cleanUrl}\n\nPage content:\n${text}\n\nExtract the following as a JSON object with these exact keys:\n{\n  "brand_name": "brand name if found",\n  "category": "what they sell",\n  "price_points": "price range and positioning based on any prices visible",\n  "tagline": "any tagline or hero copy",\n  "products": "key products or collections mentioned",\n  "tone": "tone of copy — formal, playful, luxury, etc",\n  "target_signals": "any signals about who the customer is",\n  "channels": "any social/channel mentions"\n}\n\nReturn ONLY the JSON object, no other text.`
        }],
      }),
    })

    const raw = await claudeRes.text()
    let claudeData
    try { claudeData = JSON.parse(raw) } catch (e) {
      return res.status(500).json({ error: `Claude parse error: ${raw.substring(0, 200)}` })
    }

    if (!claudeRes.ok) {
      return res.status(claudeRes.status).json({ error: claudeData?.error?.message || 'Claude error' })
    }

    const extracted = claudeData.content?.[0]?.text || ''

    let parsed = {}
    try {
      // Extract JSON from response
      const match = extracted.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
    } catch (e) {
      parsed = { raw: extracted }
    }

    return res.status(200).json({ data: parsed, url: cleanUrl })

  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(408).json({ error: `Website took too long to respond — try again or enter details manually` })
    }
    return res.status(500).json({ error: err.message || 'Failed to scan website' })
  }
}
