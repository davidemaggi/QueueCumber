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
  fireEvent.change(screen.getByLabelText('AMQP endpoint'), {
    target: { value: 'amqp://localhost:25672' },
  })
  fireEvent.change(screen.getByLabelText('Management URL'), {
    target: { value: 'http://localhost:25673' },
  })
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
  expect(
    (screen.getByLabelText('AMQP endpoint') as HTMLInputElement).value,
  ).toBe('amqp://localhost:25672')
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
  expect(screen.queryByLabelText('AMQP endpoint')).toBeNull()
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
  fireEvent.change(screen.getByLabelText('AMQP endpoint'), {
    target: { value: 'amqps://broker' },
  })
  fireEvent.change(screen.getByLabelText('Management URL'), {
    target: { value: 'https://broker' },
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
  fireEvent.change(screen.getByLabelText('AMQP endpoint'), {
    target: { value: 'amqps://user:private-secret@broker' },
  })
  fireEvent.change(screen.getByLabelText('Management URL'), {
    target: { value: 'https://broker' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Next: credentials' }))
  expect(screen.getByRole('alert').textContent).not.toContain('private-secret')
  expect(screen.getByLabelText('AMQP endpoint')).toBeTruthy()
  expect(save).not.toHaveBeenCalled()
})
