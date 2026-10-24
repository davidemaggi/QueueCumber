import type { Binding } from '../service/providers/provider'
// Include binding arguments: identical keys on a headers exchange may describe different routes.
export const bindingKey = (binding: Binding) =>
  JSON.stringify([binding.source, binding.routing_key, binding.arguments])
// A routing-key capture has no broker resource of its own; its name is derived
// from the keys so the same selection finds the same capture again.
export const routesResourceName = (keys: readonly string[]) => {
  const label = [...keys]
    .sort()
    .map((key) => key || '""')
    .join(', ')
  return label.length > 255 ? label.slice(0, 254) + '…' : label
}
export const sameRoutingKeys = (
  a: readonly string[] | undefined,
  b: readonly string[] | undefined,
) =>
  JSON.stringify([...(a ?? [])].sort()) ===
  JSON.stringify([...(b ?? [])].sort())
