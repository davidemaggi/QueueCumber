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
