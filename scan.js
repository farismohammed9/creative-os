export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
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

  let { url } = body
  if (!url) return res.status(400).json({ error: 'url is required' })

  // Normalise URL
  if (!url.startsWith('http')) url = `https://${url}`

  try {
    const siteRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
      redirect: 'follow',
    })

    if (!siteRes.ok) {
      return res.status(400).json({ error: `Could not load ${url} — got ${siteRes.status}. Check the URL is correct and publicly accessible.` })
    }

    const html = await siteRes.text()

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 6000)

    if (text.length < 50) {
      return res.status(400).json({ error: `Could not extract readable content from ${url}. The site may block scraping or require JavaScript.` })
    }

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: 'You are a brand analyst extracting factual brand intelligence from website content. Only state what is actually visible on the page. Return ONLY a valid JSON object, no markdown, no backticks, no explanation.',
        messages: [{
          role: 'user',
          content: `Website: ${url}\n\nContent:\n${text}\n\nExtract brand intelligence as JSON with these keys (use null if not found):\n{\n  "brand_name": null,\n  "category": null,\n  "products": null,\n  "price_range": null,\n  "market_position": null,\n  "copy_tone": null,\n  "tagline": null,\n  "customer_signals": null,\n  "social_channels": null\n}`,
        }],
      }),
    })

    const raw = await claudeRes.text()
    let claudeData
    try { claudeData = JSON.parse(raw) } catch (e) {
      return res.status(500).json({ error: `Claude response error: ${raw.substring(0, 150)}` })
    }

    if (!claudeRes.ok) {
      return res.status(claudeRes.status).json({ error: claudeData?.error?.message || 'Claude error' })
    }

    const extracted = claudeData.content?.[0]?.text || ''
    let parsed = {}
    try {
      const match = extracted.match(/\{[\s\S]*\}/)
      if (match) parsed = JSON.parse(match[0])
    } catch (e) {
      parsed = { raw: extracted }
    }

    // Remove null values
    Object.keys(parsed).forEach(k => { if (parsed[k] === null || parsed[k] === 'null') delete parsed[k] })

    return res.status(200).json({ data: parsed, url })

  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return res.status(408).json({ error: `${url} took too long to respond. Try entering details manually.` })
    }
    return res.status(500).json({ error: err.message })
  }
}
