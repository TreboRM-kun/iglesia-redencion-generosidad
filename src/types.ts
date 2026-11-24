export type Reason = 'Diezmo' | 'Ofrenda' | 'Donación'
export type Currency = 'BS' | 'USD'
export type Method = 'Efectivo' | 'Pago móvil' | 'Transferencia'
export type ContributionStatus = 'pending' | 'approved'

export interface ContributionForm {
  name: string
  phone: string
  reason: Reason
  amount: string
  currency: Currency
  method: Method
  reference: string
  receipt: File | null
}

export interface ContributionInput {
  name: string
  phone: string
  reason: Reason
  amount: number
  currency: Currency
  method: Method
  reference: string | null
  receipt?: string
}

export interface Contribution {
  id: string
  createdAt: number
  date: string
  status?: ContributionStatus
  name: string
  phone: string
  reason: Reason
  amount: number
  currency: Currency
  method: Method
  reference: string | null
  receiptId?: string
  receiptData?: string
}
