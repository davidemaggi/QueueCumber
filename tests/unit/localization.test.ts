import { it, expect } from 'vitest'
import en from '../../src/renderer/locales/en.json'
import itCopy from '../../src/renderer/locales/it.json'
it('keeps every shipped locale complete with nonempty text', () => {
  expect(Object.keys(itCopy).sort()).toEqual(Object.keys(en).sort())
  for (const dictionary of [en, itCopy])
    for (const text of Object.values(dictionary))
      expect(text.trim().length).toBeGreaterThan(0)
})
