export default function handler(_request, response) {
  response.setHeader('Cache-Control', 'no-store')
  response.status(503).json({ error: 'identity_provider_required' })
}
