import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { createXlsxReport, safeSpreadsheetText } from './xlsx'

const logoDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/r2kAAAAASUVORK5CYII='

describe('XLSX report export', () => {
  it('creates a workbook with the report heading, logo, and tabular data', async () => {
    const buffer = await createXlsxReport({
      title: 'Reporte de aportes',
      period: 'mes',
      totals: { BS: 25, USD: 10 },
      headers: ['Fecha', 'Nombre', 'Teléfono', 'Motivo', 'Monto', 'Moneda', 'Forma', 'Referencia', 'Registrado'],
      rows: [['2026-03-01', 'Ana', '', 'Ofrenda', 12.5, 'BS', 'Efectivo', '', '']],
      logoDataUrl,
    })
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const worksheet = workbook.getWorksheet('Aportes')
    expect(worksheet?.getCell('A1').value).toBe('Reporte de aportes')
    expect(worksheet?.getCell('A5').value).toBe('Fecha')
    expect(worksheet?.getCell('E6').value).toBe(12.5)
    expect(worksheet?.getImages()).toHaveLength(1)
  })

  it('protects spreadsheet text from formula interpretation', () => {
    expect(safeSpreadsheetText('=HYPERLINK("https://example.com")')).toBe(
      "'=HYPERLINK(\"https://example.com\")",
    )
    expect(safeSpreadsheetText('  @SUM(1,2)')).toBe("'  @SUM(1,2)")
    expect(safeSpreadsheetText('Ana')).toBe('Ana')
  })
})
