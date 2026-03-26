export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured in Vercel environment variables' })

  const { images = [], prompt, systemPrompt } = req.body

  if (!prompt) return res.status(400).json({ error: 'prompt is required' })

  // Build GPT-4o vision message content
  const userContent = []

  // Add images first (GPT-4o handles up to 10)
  for (const img of images.slice(0, 8)) {
    // Accept either a full data URL or raw base64
    const dataUrl = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`
    userContent.push({
      type: 'image_url',
      image_url: {
        url: dataUrl,
        detail: 'high', // high detail for creative/fashion analysis
      },
    })
  }

  // Add the text prompt
  userContent.push({ type: 'text', text: prompt })

  const messages = []
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }
  messages.push({ role: 'user', content: userContent })

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2000,
        messages,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'OpenAI API error',
        details: data,
      })
    }

    const text = data.choices?.[0]?.message?.content
    if (!text) return res.status(500).json({ error: 'Empty response from GPT-4o' })

    return res.status(200).json({ text })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
