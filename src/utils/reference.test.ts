import { describe, expect, it } from 'vitest'
import { normalizeReference } from './reference'

describe('normalización de referencias', () => {
  it('quita espacios exteriores y unifica mayúsculas', () => {
    expect(normalizeReference('  abc-123  ')).toBe('ABC-123')
  })
  it('rechaza caracteres que no pueden usarse como clave RTDB', () => {
    expect(normalizeReference('ref/123')).toBe('')
    expect(normalizeReference('ref 123')).toBe('')
  })
})
