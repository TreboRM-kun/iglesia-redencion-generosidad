import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { get, ref } from 'firebase/database'
import { getFirebaseDatabase } from '../firebase'
import type { Contribution, ContributionInput, Currency, Method, Reason } from '../types'
import { csvCell } from '../utils/csv'
import { dateInCaracas, periodStartDate, type Period } from '../utils/dates'
import { escapeHtml } from '../utils/html'
import { isContributionApproved } from '../utils/contribution-status'
import { loadReportLogoDataUrl } from '../utils/report-logo'

type EditForm = {
  name: string
  phone: string
  reason: Reason
  amount: string
  currency: Currency
  method: Method
  reference: string
}

export function AdminPortal({ contributions, user, dataError, demoMode, readOnly, onSignOut, onChangePassword, onApprove, onUpdate, onDelete }: {
  contributions: Contribution[]
  user: string
  dataError: string
  demoMode: boolean
  readOnly: boolean
  onSignOut: () => void
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>
  onApprove: (item: Contribution) => Promise<void>
  onUpdate: (item: Contribution, input: ContributionInput) => Promise<void>
  onDelete: (item: Contribution) => Promise<void>
}) {
  const [reference, setReference] = useState('')
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [period, setPeriod] = useState<Period>('día')
  const [today, setToday] = useState(() => dateInCaracas(Date.now()))
  const [editing, setEditing] = useState<Contribution | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [busyId, setBusyId] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmedPassword, setConfirmedPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => setToday(dateInCaracas(Date.now())), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const pendingContributions = useMemo(
    () => contributions.filter(item => item.status === 'pending'),
    [contributions],
  )
  const approvedContributions = useMemo(
    () => contributions.filter(isContributionApproved),
    [contributions],
  )
  const filtered = useMemo(() => {
    const startDate = periodStartDate(period, today)
    return approvedContributions.filter(item =>
      (!date || item.date === date) &&
      (!reason || item.reason === reason) &&
      (!name || item.name.toLocaleLowerCase('es').includes(name.trim().toLocaleLowerCase('es'))) &&
      (!reference || (item.reference || '').toLocaleLowerCase('es').includes(reference.trim().toLocaleLowerCase('es'))) &&
      (Boolean(date) || item.date >= startDate)
    )
  }, [approvedContributions, date, reason, name, reference, period, today])

  const totals = useMemo(() => ({
    BS: filtered.filter(item => item.currency === 'BS').reduce((sum, item) => sum + item.amount, 0),
    USD: filtered.filter(item => item.currency === 'USD').reduce((sum, item) => sum + item.amount, 0),
  }), [filtered])

  function rowsForExport() {
    return filtered.map(item => [
      item.date, item.name, item.phone || '', item.reason, item.amount.toFixed(2),
      item.currency, item.method, item.reference || '', item.createdAt ? new Date(item.createdAt).toLocaleString('es-VE') : '',
    ])
  }

  function downloadCsv() {
    const headers = ['Fecha', 'Nombre', 'Teléfono', 'Motivo', 'Monto', 'Moneda', 'Forma', 'Referencia', 'Registrado']
    const content = [headers, ...rowsForExport()].map(row => row.map(csvCell).join(',')).join('\r\n')
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' })
    downloadBlob(blob, `aportes-${period}-${today}.csv`)
  }

  async function downloadXlsx() {
    try {
      const { createXlsxReport, safeSpreadsheetText } = await import('../utils/xlsx')
      const logoDataUrl = await loadReportLogoDataUrl()
      const buffer = await createXlsxReport({
        title: 'Reporte de Aportes Validados - Iglesia Redención',
        period,
        totals,
        headers: ['Fecha', 'Nombre', 'Teléfono', 'Motivo', 'Monto', 'Moneda', 'Forma', 'Referencia', 'Registrado'],
        rows: filtered.map(item => [
          item.date,
          safeSpreadsheetText(item.name),
          safeSpreadsheetText(item.phone || ''),
          item.reason,
          item.amount,
          item.currency,
          item.method,
          safeSpreadsheetText(item.reference || ''),
          item.createdAt ? new Date(item.createdAt).toLocaleString('es-VE') : '',
        ]),
        logoDataUrl,
      })
      downloadBlob(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `aportes-${period}-${today}.xlsx`,
      )
    } catch (error) {
      console.error('No se pudo generar el reporte XLSX.', error)
      window.alert('No se pudo generar el archivo Excel. Intente nuevamente.')
    }
  }

  function downloadTxt() {
    const lines = [
      `Reporte de aportes validados - ${period}`,
      `Total Bs: ${totals.BS.toFixed(2)}`,
      `Total USD: ${totals.USD.toFixed(2)}`,
      '',
      ...rowsForExport().map(row => row.join(' | ')),
    ]
    downloadBlob(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }), `aportes-${period}-${today}.txt`)
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function downloadPdf() {
    try {
      const { jsPDF } = await import('jspdf')
      const logoDataUrl = await loadReportLogoDataUrl()
      const pdf = new jsPDF({ orientation: 'landscape' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const writeHeader = () => {
        pdf.setFontSize(16)
        pdf.text('Reporte de Aportes Validados - Iglesia Redención', 14, 16, { maxWidth: pageWidth - 58 })
        pdf.addImage(logoDataUrl, 'PNG', pageWidth - 34, 5, 20, 20)
        pdf.setFontSize(10)
        pdf.text(`Período: ${period} | Bs: ${totals.BS.toFixed(2)} | USD: ${totals.USD.toFixed(2)}`, 14, 24)
        pdf.text('Fecha | Nombre | Motivo | Monto | Moneda | Forma | Referencia', 14, 32)
        return 39
      }
      let y = writeHeader()
      for (const item of filtered) {
        const lines = pdf.splitTextToSize(
          `${item.date} | ${item.name} | ${item.reason} | ${item.amount.toFixed(2)} | ${item.currency} | ${item.method} | ${item.reference || '-'}`,
          pageWidth - 28,
        )
        const height = lines.length * 5
        if (y + height > 190) { pdf.addPage(); y = writeHeader() }
        pdf.text(lines, 14, y)
        y += height + 1
      }
      pdf.save(`aportes-${period}-${today}.pdf`)
    } catch (error) {
      console.error('No se pudo generar el reporte PDF.', error)
      window.alert('No se pudo generar el PDF. Intente nuevamente.')
    }
  }

  async function printReport() {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      window.alert('Habilite las ventanas emergentes para imprimir el reporte.')
      return
    }
    printWindow.opener = null
    try {
      const logoDataUrl = await loadReportLogoDataUrl()
      const rows = filtered.map(item => `<tr><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.reason)}</td><td>${item.amount.toFixed(2)}</td><td>${escapeHtml(item.currency)}</td><td>${escapeHtml(item.method)}</td><td>${escapeHtml(item.reference || '-')}</td></tr>`).join('')
      printWindow.document.write(`<html><head><title>Reporte de aportes validados</title><style>body{font-family:Arial}.report-header{display:flex;align-items:center;justify-content:space-between;gap:24px}.report-header h1{font-size:20px;flex:1}.report-header img{width:72px;height:72px;object-fit:contain}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;font-size:12px}h1{font-size:20px}@media print{.report-header{break-inside:avoid}}</style></head><body><header class="report-header"><h1>Reporte de Aportes Validados - Iglesia Redención</h1><img src="${logoDataUrl}" alt="Logo Iglesia Redención"></header><p>Período: ${escapeHtml(period)} — Bs: ${totals.BS.toFixed(2)} — USD: ${totals.USD.toFixed(2)}</p><table><thead><tr><th>Fecha</th><th>Nombre</th><th>Motivo</th><th>Monto</th><th>Moneda</th><th>Forma</th><th>Referencia</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`)
      printWindow.document.close()
    } catch (error) {
      console.error('No se pudo preparar el reporte para impresión.', error)
      printWindow.close()
      window.alert('No se pudo preparar el reporte para impresión. Intente nuevamente.')
    }
  }

  async function viewReceipt(item: Contribution) {
    if (!item.receiptData && item.receiptId !== item.id) {
      window.alert('No se encontró el comprobante guardado para este aporte.')
      return
    }
    const win = window.open()
    if (!win) {
      window.alert('Habilite las ventanas emergentes para ver el comprobante.')
      return
    }
    win.opener = null
    win.document.title = 'Comprobante privado'
    win.document.body.textContent = 'Cargando comprobante...'
    try {
      const receipt = item.receiptData ?? (await get(ref(getFirebaseDatabase(), `comprobantes/${item.id}`))).val()
      if (typeof receipt !== 'string' || receipt.length > 2800000 ||
          !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(receipt)) {
        throw new Error('El comprobante guardado no es una imagen WebP válida.')
      }
      const image = win.document.createElement('img')
      image.alt = 'Comprobante del aporte'
      image.style.maxWidth = '100%'
      image.src = receipt
      win.document.body.replaceChildren(image)
    } catch (error) {
      win.close()
      window.alert(error instanceof Error ? error.message : 'No se pudo cargar el comprobante.')
    }
  }

  async function runAction(item: Contribution, action: () => Promise<void>, successMessage: string) {
    setBusyId(item.id)
    setActionMessage('')
    try {
      await action()
      setActionMessage(successMessage)
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'No se pudo completar la acción.')
    } finally {
      setBusyId('')
    }
  }

  function startEditing(item: Contribution) {
    setEditing(item)
    setEditForm({
      name: item.name,
      phone: item.phone,
      reason: item.reason,
      amount: String(item.amount),
      currency: item.currency,
      method: item.method,
      reference: item.reference || '',
    })
    setActionMessage('')
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || !editForm) return
    const input: ContributionInput = {
      name: editForm.name,
      phone: editForm.phone,
      reason: editForm.reason,
      amount: Number(editForm.amount),
      currency: editForm.currency,
      method: editForm.method,
      reference: editForm.reference,
    }
    setBusyId(editing.id)
    setActionMessage('')
    try {
      await onUpdate(editing, input)
      setEditing(null)
      setEditForm(null)
      setActionMessage('Los cambios del aporte se guardaron.')
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'No se pudo actualizar el aporte.')
    } finally {
      setBusyId('')
    }
  }

  function confirmDelete(item: Contribution) {
    if (!window.confirm(`¿Eliminar definitivamente el aporte de ${item.name} por ${item.amount.toFixed(2)} ${item.currency}?`)) return
    void runAction(item, () => onDelete(item), 'El aporte y su comprobante fueron eliminados.')
  }

  function contributionActions(item: Contribution, pending: boolean) {
    if (readOnly) return null
    return (
      <div className="row-actions">
        {pending && <button className="approve-button" disabled={busyId === item.id} onClick={() => void runAction(item, () => onApprove(item), 'Aporte validado; ahora suma a los reportes.')}>Validar y sumar</button>}
        <button type="button" className="icon-action-button edit-action" aria-label={`Editar transacción de ${item.name}`} title="Editar transacción" disabled={busyId === item.id} onClick={() => startEditing(item)}>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
          </svg>
        </button>
        <button type="button" className="icon-action-button delete-action" aria-label={`Eliminar transacción de ${item.name}`} title="Eliminar transacción" disabled={busyId === item.id} onClick={() => confirmDelete(item)}>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="m19 6-1 14H6L5 6" />
            <path d="M10 11v5M14 11v5" />
          </svg>
        </button>
      </div>
    )
  }

  async function submitPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError('')
    if (newPassword.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmedPassword) {
      setPasswordError('La confirmación no coincide con la nueva contraseña.')
      return
    }

    setPasswordBusy(true)
    try {
      await onChangePassword(currentPassword, newPassword)
      setChangingPassword(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmedPassword('')
      setActionMessage('La contraseña se actualizó correctamente.')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'No se pudo cambiar la contraseña.')
    } finally {
      setPasswordBusy(false)
    }
  }

  function closePasswordChange() {
    setChangingPassword(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmedPassword('')
    setPasswordError('')
  }

  return (
    <section className="admin-page">
      <div className="admin-heading">
        <div><p className="eyebrow">PORTAL ADMINISTRATIVO</p><h1>Registro de generosidad</h1><small>{user}</small></div>
        <div>
          {!demoMode && <button hidden className="outline-button" type="button" onClick={() => { setPasswordError(''); setChangingPassword(true) }}>Cambiar contraseña</button>}
          <button className="outline-button" onClick={onSignOut}>{demoMode ? 'Volver al formulario' : 'Cerrar sesión'}</button>
        </div>
      </div>
      <p className="validation-note">{readOnly
        ? 'Acceso de solo lectura: puede consultar los aportes y reportes, pero no validar, editar ni eliminar registros.'
        : 'Los aportes pendientes no se suman a los reportes. Valide cada registro después de verificar el pago o recibir el efectivo.'}</p>
      {actionMessage && <p className="action-message" role="status">{actionMessage}</p>}
      {dataError && <p className="form-error" role="alert">{dataError}</p>}
      {pendingContributions.length > 0 && (
        <section className="pending-section" aria-labelledby="pending-title">
          <div className="section-heading">
            <div><h2 id="pending-title">Pendientes de validación</h2><p>Revise la información antes de sumarlos al registro.</p></div>
            <span className="pending-count">{pendingContributions.length}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Fecha</th><th>Nombre</th><th>Motivo</th><th>Monto</th><th>Moneda</th><th>Forma</th><th>Referencia</th><th>Comprobante</th>{!readOnly && <th>Acciones</th>}</tr></thead>
              <tbody>{pendingContributions.map(item => (
                <tr key={item.id}>
                  <td>{item.date}</td><td>{item.name}</td><td>{item.reason}</td><td>{item.amount.toFixed(2)}</td><td>{item.currency}</td><td>{item.method}</td><td>{item.reference || '-'}</td>
                  <td>{item.receiptId || item.receiptData ? <button className="link-button" onClick={() => void viewReceipt(item)}>Ver</button> : '-'}</td>
                  {!readOnly && <td>{contributionActions(item, true)}</td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
      <div className="summary-grid">
        <article><span>Bs validados</span><strong>{totals.BS.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</strong></article>
        <article><span>USD validados</span><strong>{totals.USD.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></article>
        <article><span>Aportes validados</span><strong>{filtered.length}</strong></article>
        <article><span>Pendientes por revisar</span><strong>{pendingContributions.length}</strong></article>
      </div>
      <div className="toolbar">
        <input aria-label="Buscar por referencia" placeholder="Referencia" value={reference} onChange={e => setReference(e.target.value)} />
        <input aria-label="Buscar por nombre" placeholder="Nombre" value={name} onChange={e => setName(e.target.value)} />
        <input aria-label="Filtrar por fecha" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <select aria-label="Filtrar por motivo" value={reason} onChange={e => setReason(e.target.value)}><option value="">Todos los motivos</option><option>Diezmo</option><option>Ofrenda</option><option>Donación</option></select>
      </div>
      <div className="period-row">
        <div className="period-tabs">{(['día', 'semana', 'mes', 'año'] as Period[]).map(value => <button key={value} className={period === value ? 'active' : ''} onClick={() => setPeriod(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
        <div className="export-buttons"><button onClick={downloadCsv}>CSV</button><button onClick={() => void downloadXlsx()}>XLSX</button><button onClick={downloadTxt}>TXT</button><button onClick={downloadPdf}>PDF</button><button onClick={() => void printReport()}>Imprimir</button></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Nombre</th><th>Teléfono</th><th>Motivo</th><th>Monto</th><th>Moneda</th><th>Forma</th><th>Referencia</th><th>Comprobante</th>{!readOnly && <th>Acciones</th>}</tr></thead>
          <tbody>{filtered.map(item => (
            <tr key={item.id}>
              <td>{item.date}</td><td>{item.name}</td><td>{item.phone || '-'}</td><td>{item.reason}</td><td>{item.amount.toFixed(2)}</td><td>{item.currency}</td><td>{item.method}</td><td>{item.reference || '-'}</td>
              <td>{item.receiptId || item.receiptData ? <button className="link-button" onClick={() => void viewReceipt(item)}>Ver</button> : '-'}</td>
              {!readOnly && <td>{contributionActions(item, false)}</td>}
            </tr>
          ))}</tbody>
        </table>
        {filtered.length === 0 && <p className="empty">No hay aportes validados para los filtros seleccionados.</p>}
      </div>

      {editing && editForm && (
        <div className="dialog-backdrop" role="presentation">
          <section className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-title">
            <h2 id="edit-title">Corregir aporte</h2>
            <p>Los cambios se aplicarán al registro. Si corrige la referencia, también se actualizará su identificador.</p>
            <form onSubmit={saveEdit}>
              <label>Nombre completo *<input required maxLength={100} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></label>
              <label>Teléfono<input maxLength={30} value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></label>
              <div className="field-grid">
                <label>Motivo<select value={editForm.reason} onChange={e => setEditForm({ ...editForm, reason: e.target.value as Reason })}><option>Diezmo</option><option>Ofrenda</option><option>Donación</option></select></label>
                <label>Forma de aporte<select value={editForm.method} onChange={e => setEditForm({ ...editForm, method: e.target.value as Method })}><option>Efectivo</option><option>Pago móvil</option><option>Transferencia</option></select></label>
              </div>
              <div className="field-grid">
                <label>Monto *<input type="number" min="0.01" step="0.01" required value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} /></label>
                <label>Moneda<select value={editForm.currency} onChange={e => setEditForm({ ...editForm, currency: e.target.value as Currency })}><option value="BS">Bolívares (Bs)</option><option value="USD">Dólares ($)</option></select></label>
              </div>
              {(editForm.method === 'Pago móvil' || editForm.method === 'Transferencia') && <label>Referencia *<input required maxLength={80} value={editForm.reference} onChange={e => setEditForm({ ...editForm, reference: e.target.value })} /></label>}
              <div className="edit-actions">
                <button className="outline-button" type="button" onClick={() => { setEditing(null); setEditForm(null) }}>Cancelar</button>
                <button className="submit-button" type="submit" disabled={busyId === editing.id}>{busyId === editing.id ? 'Guardando...' : 'Guardar corrección'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {changingPassword && (
        <div className="dialog-backdrop" role="presentation">
          <section className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="password-title">
            <h2 id="password-title">Cambiar contraseña</h2>
            <p>Ingrese su contraseña actual y elija una nueva de al menos 8 caracteres.</p>
            <form onSubmit={submitPasswordChange}>
              <label>Contraseña actual<input type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label>
              <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={event => setNewPassword(event.target.value)} /></label>
              <label>Confirmar nueva contraseña<input type="password" autoComplete="new-password" minLength={8} required value={confirmedPassword} onChange={event => setConfirmedPassword(event.target.value)} /></label>
              {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
              <div className="edit-actions">
                <button className="outline-button" type="button" onClick={closePasswordChange} disabled={passwordBusy}>Cancelar</button>
                <button className="submit-button" type="submit" disabled={passwordBusy}>{passwordBusy ? 'Actualizando...' : 'Actualizar contraseña'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}
