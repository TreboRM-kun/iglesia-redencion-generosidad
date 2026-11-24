import { describe, expect, it } from 'vitest'
import type { Contribution } from '../types'

function totals(items: Contribution[]) {
  return {
    BS: items.filter(i => i.currency === 'BS').reduce((sum, i) => sum + i.amount, 0),
    USD: items.filter(i => i.currency === 'USD').reduce((sum, i) => sum + i.amount, 0),
  }
}

describe('totales separados por moneda', () => {
  it('no convierte ni mezcla bolívares y dólares', () => {
    const items = [
      { currency: 'BS', amount: 125 } as Contribution,
      { currency: 'USD', amount: 40 } as Contribution,
      { currency: 'BS', amount: 75 } as Contribution,
    ]
    expect(totals(items)).toEqual({ BS: 200, USD: 40 })
  })
})
