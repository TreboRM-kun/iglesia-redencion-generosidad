import { describe, expect, it } from 'vitest'
import { createDemoContributions, hasDemoReference } from './demo'
import { dateInCaracas, periodStartDate } from './dates'

describe('datos locales de demostración', () => {
  const examples = createDemoContributions(Date.UTC(2026, 10, 24, 16))

  it('proporciona ejemplos identificados como ficticios en varias fechas y monedas', () => {
    expect(examples).toHaveLength(5)
    expect(examples.every(item => item.name.startsWith('Ejemplo local'))).toBe(true)
    expect(examples.every(item => item.status === 'approved')).toBe(true)
    expect(new Set(examples.map(item => item.currency))).toEqual(new Set(['BS', 'USD']))
    expect(new Set(examples.map(item => item.date)).size).toBeGreaterThan(1)
    const today = dateInCaracas(Date.UTC(2026, 10, 24, 16))
    expect(examples.filter(item => item.date >= periodStartDate('semana', today))).toHaveLength(2)
    expect(examples.filter(item => item.date >= periodStartDate('mes', today))).toHaveLength(3)
    expect(examples.filter(item => item.date >= periodStartDate('año', today))).toHaveLength(5)
  })

  it('reconoce referencias repetidas sin distinguir mayúsculas ni espacios exteriores', () => {
    expect(hasDemoReference(examples, 'Pago móvil', ' demo-001 ')).toBe(true)
    expect(hasDemoReference(examples, 'Transferencia', 'NEW-001')).toBe(false)
    expect(hasDemoReference(examples, 'Efectivo', 'DEMO-001')).toBe(false)
  })
})
