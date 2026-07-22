const UPSTREAM_URL = 'https://artificialanalysis.ai/api/v2/data/llms/models'

type VercelRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): VercelResponse
  json(body: unknown): VercelResponse
  send(body: string): VercelResponse
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Every visitor supplies their own key; the proxy does not use a site-owned key.
  const rawApiKey = request.headers['x-api-key']
  const apiKey = Array.isArray(rawApiKey) ? rawApiKey[0] : rawApiKey
  if (!apiKey) {
    response.status(401).json({ error: 'Missing Artificial Analysis API key' })
    return
  }

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      headers: { 'x-api-key': apiKey },
    })
    const body = await upstream.text()

    response
      .status(upstream.status)
      .setHeader('content-type', upstream.headers.get('content-type') || 'application/json')
      .send(body)
  } catch {
    response.status(502).json({ error: 'Artificial Analysis request failed' })
  }
}