const UPSTREAM_URL = 'https://artificialanalysis.ai/api/v2/data/llms/models'

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    })
  }

  // Every visitor supplies their own key; the proxy does not use a site-owned key.
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing Artificial Analysis API key' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      headers: { 'x-api-key': apiKey },
    })
    const body = await upstream.text()

    return new Response(body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
      },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Artificial Analysis request failed' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    })
  }
}