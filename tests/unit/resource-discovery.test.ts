import { it, expect, vi } from 'vitest'
import { RabbitMQ } from '../../src/service/providers/rabbitmq'
import { profile } from '../fixtures/broker'
it('finds filtered resources past an empty source page and keeps unknown counts distinct from zero', async () => {
  const broker = new RabbitMQ(profile)
  vi.spyOn(broker, 'request').mockImplementation(async (path) => {
    const page = new URL('http://test/' + path).searchParams.get('page')
    return {
      items: path.startsWith('queues/')
        ? page === '1'
          ? [{ name: 'unknown', type: 'classic' }]
          : [
              { name: 'empty-stream', type: 'stream', messages: 0 },
              { name: 'busy', type: 'classic', messages: 8 },
            ]
        : [],
      page_count: 2,
    }
  })
  const empty = await broker.listResources('', 1, {
    kind: 'stream',
    messages: 'empty',
  })
  expect(empty.page).toBe(2)
  expect(empty.resources.map((r) => r.name)).toEqual(['empty-stream'])
  expect(empty.hasMore).toBe(false)
  expect(
    (
      await broker.listResources('', 1, { kind: 'queue', messages: 'nonempty' })
    ).resources.map((r) => r.name),
  ).toEqual(['busy'])
})
it('keeps routing discovery within the vhost, excludes owned observation queues and preserves stream context', async () => {
  const broker = new RabbitMQ(profile)
  const owned =
    'queuecumber.968eeebb-8f80-4591-8770-449875be3a27.968eeebb-8f80-4591-8770-449875be3a27'
  vi.spyOn(broker, 'request').mockImplementation(async (path) =>
    path.startsWith('queues/')
      ? [
          { name: 'events', type: 'stream' },
          { name: owned, type: 'classic' },
        ]
      : [
          {
            source: 'routes',
            destination: 'events',
            destination_type: 'queue',
            routing_key: 'events.*',
          },
          {
            source: 'routes',
            destination: owned,
            destination_type: 'queue',
            routing_key: 'internal',
          },
          {
            source: '',
            destination: 'events',
            destination_type: 'queue',
            routing_key: 'events',
          },
        ],
  )
  expect(await broker.routingBindings()).toEqual([
    expect.objectContaining({
      vhost: '/',
      destinationKind: 'stream',
      routing_key: 'events.*',
    }),
    expect.objectContaining({ source: '', routing_key: 'events' }),
  ])
})
