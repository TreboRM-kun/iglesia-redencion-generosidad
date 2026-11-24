import type { Contribution, Method } from '../types'
import { dateInCaracas } from './dates'
import { normalizeReference } from './reference'

export function createDemoContributions(now: number): Contribution[] {
  const [year, month, day] = dateInCaracas(now).split('-').map(Number)
  const todayUtc = Date.UTC(year, month - 1, day)
  const weekday = new Date(todayUtc).getUTCDay()
  const daysSinceMonday = (weekday + 6) % 7
  const daysSinceYearStart = Math.round(
    (todayUtc - Date.UTC(year, 0, 1)) / (24 * 60 * 60 * 1000),
  )
  const examples: Array<{
    daysAgo: number
    name: string
    reason: Contribution['reason']
    amount: number
    currency: Contribution['currency']
    method: Method
    reference: string | null
  }> = [
    { daysAgo: 0, name: 'Ejemplo local — Ana', reason: 'Diezmo', amount: 125, currency: 'BS', method: 'Efectivo', reference: null },
    { daysAgo: Math.min(daysSinceMonday, 2), name: 'Ejemplo local — Luis', reason: 'Ofrenda', amount: 5, currency: 'USD', method: 'Pago móvil', reference: 'DEMO-001' },
    { daysAgo: day - 1, name: 'Ejemplo local — María', reason: 'Donación', amount: 1000, currency: 'BS', method: 'Transferencia', reference: 'DEMO-002' },
    { daysAgo: 35, name: 'Ejemplo local — José', reason: 'Diezmo', amount: 10, currency: 'USD', method: 'Efectivo', reference: null },
    { daysAgo: daysSinceYearStart, name: 'Ejemplo local — Carla', reason: 'Ofrenda', amount: 500, currency: 'BS', method: 'Transferencia', reference: 'DEMO-003' },
  ]

  return examples.map((example, index) => {
    const createdAt = now - example.daysAgo * 24 * 60 * 60 * 1000
    return {
      id: `demo-sample-${index + 1}`,
      createdAt,
      date: dateInCaracas(createdAt),
      status: 'approved',
      name: example.name,
      phone: '',
      reason: example.reason,
      amount: example.amount,
      currency: example.currency,
      method: example.method,
      reference: example.reference,
    }
  })
}

export function hasDemoReference(
  contributions: Contribution[],
  method: Method,
  reference: string | null,
): boolean {
  if ((method !== 'Pago móvil' && method !== 'Transferencia') || !reference) return false
  const normalized = normalizeReference(reference)
  return Boolean(normalized) && contributions.some(item => item.reference === normalized)
}
