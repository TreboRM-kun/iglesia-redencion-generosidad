import { get, push, ref, remove, runTransaction, serverTimestamp, update } from 'firebase/database'
import { getFirebaseDatabase } from '../firebase'
import { normalizeReference } from '../utils/reference'
import type { Contribution, ContributionInput } from '../types'

function isPermissionDenied(error: unknown): boolean {
  return typeof error === 'object' && error !== null &&
    'code' in error && error.code === 'PERMISSION_DENIED'
}

export async function submitContribution(input: ContributionInput): Promise<void> {
  const needsReference = input.method === 'Pago móvil' || input.method === 'Transferencia'
  const normalizedRef = needsReference && input.reference ? normalizeReference(input.reference) : null
  if (needsReference && !normalizedRef) throw new Error('La referencia es obligatoria.')

  if (input.receipt && (!/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(input.receipt) ||
      input.receipt.length > 2800000)) {
    throw new Error('El comprobante no cumple el límite WebP de 2 MB.')
  }

  const database = getFirebaseDatabase()
  const id = normalizedRef ?? push(ref(database, 'contribuciones')).key
  if (!id) throw new Error('No se pudo generar el identificador del aporte.')

  const record: Record<string, unknown> = {
    name: input.name.trim(),
    phone: input.phone.trim(),
    reason: input.reason,
    amount: input.amount,
    currency: input.currency,
    method: input.method,
    reference: normalizedRef,
    normalizedRef,
    status: 'pending',
    createdAt: serverTimestamp(),
  }
  if (input.receipt) record.receiptId = id

  const updates: Record<string, unknown> = {
    [`contribuciones/${id}`]: record,
  }
  if (input.receipt) updates[`comprobantes/${id}`] = input.receipt

  try {
    await update(ref(database), updates)
  } catch (error) {
    if (isPermissionDenied(error)) {
      throw new Error('Esta referencia ya fue registrada o el envío no pasó la validación. Verifique el código e intente nuevamente.')
    }
    throw error
  }
}

export async function approveContribution(id: string): Promise<void> {
  await update(ref(getFirebaseDatabase()), {
    [`contribuciones/${id}/status`]: 'approved',
  })
}

function isRecord(value: unknown): value is Record<string, Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiresReference(method: Contribution['method']): boolean {
  return method === 'Pago móvil' || method === 'Transferencia'
}

export async function updateContribution(
  original: Contribution,
  input: ContributionInput,
): Promise<void> {
  const needsReference = requiresReference(input.method)
  const normalizedRef = needsReference && input.reference ? normalizeReference(input.reference) : null
  if (!input.name.trim()) throw new Error('El nombre es obligatorio.')
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('El monto debe ser mayor que cero.')
  if (needsReference && !normalizedRef) throw new Error('La referencia es obligatoria.')

  const database = getFirebaseDatabase()
  const contributionsRef = ref(database, 'contribuciones')
  const newId = normalizedRef ?? (
    requiresReference(original.method)
      ? push(contributionsRef).key
      : original.id
  )
  if (!newId) throw new Error('No se pudo generar el identificador del aporte.')

  let receiptValue: unknown
  let copiedReceipt = false
  if (newId !== original.id && original.receiptId) {
    const oldReceipt = await get(ref(database, `comprobantes/${original.receiptId}`))
    if (oldReceipt.exists()) {
      const newReceipt = await get(ref(database, `comprobantes/${newId}`))
      if (newReceipt.exists()) throw new Error('Ya existe un comprobante asociado al nuevo identificador.')
      receiptValue = oldReceipt.val()
      await update(ref(database), { [`comprobantes/${newId}`]: receiptValue })
      copiedReceipt = true
    }
  }

  let committed = false
  try {
    const result = await runTransaction(contributionsRef, currentValue => {
      if (!isRecord(currentValue)) return
      const currentRecord = currentValue[original.id]
      if (!currentRecord) return
      if (newId !== original.id && currentValue[newId]) return
      if (normalizedRef && Object.entries(currentValue).some(([id, record]) =>
        id !== original.id && record.normalizedRef === normalizedRef,
      )) return

      const updatedRecord: Record<string, unknown> = {
        ...currentRecord,
        name: input.name.trim(),
        phone: input.phone.trim(),
        reason: input.reason,
        amount: input.amount,
        currency: input.currency,
        method: input.method,
        reference: normalizedRef,
        normalizedRef,
        status: currentRecord.status === 'pending' ? 'pending' : 'approved',
      }
      if (currentRecord.receiptId) updatedRecord.receiptId = newId
      if (newId !== original.id) delete currentValue[original.id]
      currentValue[newId] = updatedRecord
      return currentValue
    }, { applyLocally: false })
    committed = result.committed
  } catch (error) {
    if (copiedReceipt) await remove(ref(database, `comprobantes/${newId}`))
    throw error
  }

  if (!committed) {
    if (copiedReceipt) await remove(ref(database, `comprobantes/${newId}`))
    throw new Error('No se guardaron los cambios. La transacción pudo ser modificada o la referencia ya está en uso.')
  }

  if (newId !== original.id && original.receiptId && receiptValue !== undefined) {
    await remove(ref(database, `comprobantes/${original.receiptId}`))
  }
}

export async function deleteContribution(item: Contribution): Promise<void> {
  const updates: Record<string, null> = {
    [`contribuciones/${item.id}`]: null,
  }
  if (item.receiptId) updates[`comprobantes/${item.receiptId}`] = null
  await update(ref(getFirebaseDatabase()), updates)
}
