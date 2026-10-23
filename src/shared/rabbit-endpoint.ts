/** Guided input excludes URL credentials/options so separate fields are never silently overridden. */
export function buildRabbitUrl(
  endpoint: string,
  vhost: string,
  username: string,
  password: string,
): string {
  const url = new URL(endpoint.trim())
  if (
    !['amqp:', 'amqps:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    !['', '/'].includes(url.pathname) ||
    url.search ||
    url.hash ||
    !vhost ||
    ['.', '..'].includes(vhost) ||
    vhost.length > 255
  )
    throw Error('Invalid guided endpoint')
  url.username = encodeURIComponent(username)
  url.password = encodeURIComponent(password)
  url.pathname = '/' + encodeURIComponent(vhost)
  return url.toString()
}

/** Host-only guided inputs; TLS is never downgraded by a failed connection. */
export function rabbitEndpoint(
  host: string,
  port: string,
  tls: boolean,
  family: 'amqp' | 'http',
): string {
  host = host.trim()
  if (
    !host ||
    /[\s/@?#]/.test(host) ||
    host.includes('://') ||
    !/^\d+$/.test(port) ||
    Number(port) < 1 ||
    Number(port) > 65535
  )
    throw Error('Invalid host or port')
  const authority =
    host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  const protocol =
    family === 'amqp' ? (tls ? 'amqps' : 'amqp') : tls ? 'https' : 'http'
  const endpoint = `${protocol}://${authority}:${port}`
  const url = new URL(endpoint)
  if (
    !url.hostname ||
    url.username ||
    url.password ||
    (url.pathname && url.pathname !== '/')
  )
    throw Error('Invalid host')
  return endpoint
}
