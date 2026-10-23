// @vitest-environment jsdom
import { it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ConnectionForm } from '../../src/renderer/components/ConnectionForm'
import { translator } from '../../src/renderer/i18n'
afterEach(cleanup)
it('walks from endpoints to separate credentials, preserves Back inputs and saves an encoded profile', async () => {
  const save = vi.fn(async () => {})
  render(
    <ConnectionForm
      t={translator('en')}
      onClose={() => {}}
      onSave={save}
      busy={false}
    />,
  )
  fireEvent.change(screen.getByLabelText('Connection name'), {
    target: { value: 'Local demo' },
  })
  fireEvent.change(screen.getByLabelText('AMQP host'), {
    target: { value: 'localhost' },
  })
  fireEvent.change(screen.getByLabelText('Management host'), {
    target: { value: 'localhost' },
  })
  fireEvent.change(screen.getByLabelText('AMQP port'), {
    target: { value: '25672' },
  })
  fireEvent.change(screen.getByLabelText('Management port'), {
    target: { value: '25673' },
  })
  fireEvent.click(screen.getByLabelText('Use TLS for AMQP'))
  fireEvent.click(screen.getByLabelText('Use TLS for Management'))
  fireEvent.click(screen.getByLabelText('Allow unencrypted transport'))
  fireEvent.click(screen.getByRole('button', { name: 'Next: credentials' }))
  expect(save).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Username'), {
    target: { value: 'a@b' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'p:%?' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Back to endpoints' }))
  expect((screen.getByLabelText('AMQP host') as HTMLInputElement).value).toBe(
    'localhost',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Next: credentials' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save connection' }))
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      protocolUrl: 'amqp://a%40b:p%3A%25%3F@localhost:25672/%2F',
      managementUrl: 'http://localhost:25673',
      allowInsecure: true,
    }),
  )
})
it('keeps advanced connection URL entry available', () => {
  render(
    <ConnectionForm
      t={translator('en')}
      onClose={() => {}}
      onSave={async () => {}}
      busy={false}
    />,
  )
  fireEvent.change(screen.getByLabelText('Connection setup'), {
    target: { value: 'url' },
  })
  expect(screen.getByLabelText('AMQP URL')).toBeTruthy()
  expect(screen.queryByLabelText('AMQP host')).toBeNull()
})

it('does not reuse draft credentials after switching provider', () => {
  render(
    <ConnectionForm
      t={translator('en')}
      onClose={() => {}}
      onSave={async () => {}}
      busy={false}
    />,
  )
  fireEvent.change(screen.getByLabelText('Connection name'), {
    target: { value: 'Draft' },
  })
  fireEvent.change(screen.getByLabelText('AMQP host'), {
    target: { value: 'broker' },
  })
  fireEvent.change(screen.getByLabelText('Management host'), {
    target: { value: 'broker' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Next: credentials' }))
  fireEvent.change(screen.getByLabelText('Username'), {
    target: { value: 'rabbit-only' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'rabbit-secret' },
  })
  fireEvent.change(screen.getByLabelText('Messaging system'), {
    target: { value: 'kafka' },
  })
  fireEvent.change(screen.getByLabelText('Authentication'), {
    target: { value: 'PLAIN' },
  })
  expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('')
  expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('')
})
it('keeps invalid guided endpoint errors generic and does not advance or save', () => {
  const save = vi.fn(async () => {})
  render(
    <ConnectionForm
      t={translator('en')}
      onClose={() => {}}
      onSave={save}
      busy={false}
    />,
  )
  fireEvent.change(screen.getByLabelText('Connection name'), {
    target: { value: 'Draft' },
  })
  fireEvent.change(screen.getByLabelText('AMQP host'), {
    target: { value: 'amqps://user:private-secret@broker' },
  })
  fireEvent.change(screen.getByLabelText('Management host'), {
    target: { value: 'broker' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Next: credentials' }))
  expect(screen.getByRole('alert').textContent).not.toContain('private-secret')
  expect(screen.getByLabelText('AMQP host')).toBeTruthy()
  expect(save).not.toHaveBeenCalled()
})

it('loads saved RabbitMQ credentials, endpoints, vhost and CA for editing without losing them on save', () => {
  const save = vi.fn(async () => {})
  const initial = {
    id: '968eeebb-8f80-4591-8770-449875be3a27',
    provider: 'rabbitmq' as const,
    name: 'Saved',
    protocolUrl: 'amqps://a%40b:p%3A%25%3F@broker:5671/team',
    managementUrl: 'https://admin:15671',
    allowInsecure: false,
    caPem: 'test-ca',
  }
  render(
    <ConnectionForm
      t={translator('en')}
      onClose={() => {}}
      onSave={save}
      busy={false}
      initial={initial}
    />,
  )
  expect((screen.getByLabelText('AMQP host') as HTMLInputElement).value).toBe(
    'broker',
  )
  expect(
    (screen.getByLabelText('Management host') as HTMLInputElement).value,
  ).toBe('admin')
  fireEvent.click(screen.getByRole('button', { name: 'Next: credentials' }))
  expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe(
    'a@b',
  )
  expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe(
    'p:%?',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save connection' }))
  expect(save).toHaveBeenCalledWith(initial)
})
it('loads Kafka brokers, TLS, authentication and credentials for editing', () => {
  const initial = {
    id: '968eeebb-8f80-4591-8770-449875be3a27',
    provider: 'kafka' as const,
    name: 'Saved Kafka',
    brokers: ['broker:9093'],
    tls: true,
    allowInsecure: false,
    sasl: {
      mechanism: 'SCRAM-SHA-256' as const,
      username: 'user',
      password: 'secret',
    },
  }
  const save = vi.fn(async () => {})
  render(
    <ConnectionForm
      t={translator('en')}
      onClose={() => {}}
      onSave={save}
      busy={false}
      initial={initial}
    />,
  )
  expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe(
    'secret',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Save connection' }))
  expect(save).toHaveBeenCalledWith(initial)
})
