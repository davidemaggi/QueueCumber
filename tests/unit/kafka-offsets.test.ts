import { it, expect } from 'vitest'
import { kafkaOffsetSchema, kafkaSelectionSchema } from '../../src/shared/kafka'
it('rejects malformed or overflowing 64-bit offsets without throwing out of safeParse', () => {
  for (const value of ['', 'word', '1.5', '-1', '01', '9223372036854775808'])
    expect(kafkaOffsetSchema.safeParse(value).success).toBe(false)
  expect(kafkaOffsetSchema.parse('9223372036854775807')).toBe(
    '9223372036854775807',
  )
  expect(
    kafkaSelectionSchema.safeParse([
      { partition: 0, from: 'first' },
      { partition: 0, from: 'next' },
    ]).success,
  ).toBe(false)
  expect(
    kafkaSelectionSchema.safeParse(
      Array.from({ length: 129 }, (_, partition) => ({
        partition,
        from: 'next',
      })),
    ).success,
  ).toBe(false)
})
