export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' })

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' })
    }
  }

  const { images = [], prompt, systemPrompt } = body
  if (!prompt) return res.status(400).json({ error: 'prompt is required' })

  const userContent = []

  for (const img of images.slice(0, 4)) {
    // images arrive as compressed base64 strings (not data URLs) from the client
    const dataUrl = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
    userContent.push({
      type: 'image_url',
      image_url: { url: dataUrl, detail: 'low' },
    })
  }

  userContent.push({ type: 'text', text: prompt })

  const messages = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: userContent })

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: 'gpt-4o', max_tokens: 2000, messages }),
    })

    const raw = await response.text()
    let data
    try { data = JSON.parse(raw) } catch (e) {
      return res.status(500).json({ error: `Non-JSON from OpenAI: ${raw.substring(0, 200)}` })
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'OpenAI API error',
      })
    }

    const text = data.choices?.[0]?.message?.content
    if (!text) return res.status(500).json({ error: 'Empty response from GPT-4o' })

    return res.status(200).json({ text })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
