import { it, expect } from 'vitest'
import { buildRabbitUrl } from '../../src/shared/rabbit-endpoint'
it('rejects dot-only virtual hosts rather than silently selecting the root', () => {
  for (const vhost of ['.', '..'])
    expect(() => buildRabbitUrl('amqps://broker', vhost, 'u', 'p')).toThrow()
})
it('encodes separate credentials and vhost without losing reserved characters', () => {
  const user = 'user@ops:%✓',
    password = 'p@ss:/?#%雪',
    vhost = 'team/a b%'
  const url = new URL(
    buildRabbitUrl('amqps://broker:5671', vhost, user, password),
  )
  expect(decodeURIComponent(url.username)).toBe(user)
  expect(decodeURIComponent(url.password)).toBe(password)
  expect(decodeURIComponent(url.pathname.slice(1))).toBe(vhost)
  expect(buildRabbitUrl('amqp://[::1]:25672', '/', 'guest', 'guest')).toContain(
    '/%2F',
  )
})
it('rejects credential-bearing, ambiguous or non-AMQP endpoints in guided mode', () => {
  for (const endpoint of [
    'https://broker',
    'amqp://u:p@broker',
    'amqp://broker/vhost',
    'amqp://broker?heartbeat=3',
    'amqp://broker#x',
    'not a URL',
  ])
    expect(() => buildRabbitUrl(endpoint, '/', 'u', 'p')).toThrow()
})
