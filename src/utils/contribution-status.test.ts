import { describe, expect, it } from 'vitest'
import { isContributionApproved } from './contribution-status'
import type { Contribution } from '../types'

const contribution: Contribution = {
  id: 'test',
  createdAt: 0,
  date: '2026-01-01',
  name: 'Persona de prueba',
  phone: '',
  reason: 'Diezmo',
  amount: 10,
  currency: 'BS',
  method: 'Efectivo',
  reference: null,
}

describe('validación de aportes', () => {
  it('solo excluye del reporte los aportes pendientes', () => {
    expect(isContributionApproved({ ...contribution, status: 'pending' })).toBe(false)
    expect(isContributionApproved({ ...contribution, status: 'approved' })).toBe(true)
    expect(isContributionApproved(contribution)).toBe(true)
  })
})
