import type { Binding } from '../service/providers/provider'
// Include binding arguments: identical keys on a headers exchange may describe different routes.
export const bindingKey = (binding: Binding) =>
  JSON.stringify([binding.source, binding.routing_key, binding.arguments])
