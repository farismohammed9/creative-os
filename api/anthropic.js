export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' })
  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch (e) { return res.status(400).json({ error: 'Invalid JSON body' }) } }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) })
    const raw = await response.text()
    let data; try { data = JSON.parse(raw) } catch (e) { return res.status(500).json({ error: `Non-JSON from Anthropic: ${raw.substring(0,200)}` }) }
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || 'Anthropic API error' })
    return res.status(200).json(data)
  } catch (err) { return res.status(500).json({ error: err.message }) }
}
