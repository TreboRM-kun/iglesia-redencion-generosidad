import { describe, expect, it } from 'vitest'
import { dateInCaracas, periodStartDate } from './dates'

describe('fechas de reportes en Caracas', () => {
  it('usa la fecha local de Venezuela incluso cerca de la medianoche UTC', () => {
    expect(dateInCaracas(Date.UTC(2026, 0, 1, 3, 59))).toBe('2025-12-31')
    expect(dateInCaracas(Date.UTC(2026, 0, 1, 4, 0))).toBe('2026-01-01')
  })

  it('calcula el inicio de semana, mes y año', () => {
    expect(periodStartDate('semana', '2026-11-24')).toBe('2026-11-23')
    expect(periodStartDate('mes', '2026-11-24')).toBe('2026-11-01')
    expect(periodStartDate('año', '2026-11-24')).toBe('2026-01-01')
  })
})
