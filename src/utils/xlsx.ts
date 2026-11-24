import ExcelJS from 'exceljs'

export type XlsxCell = string | number

export function safeSpreadsheetText(value: string): string {
  return /^\s*[=+\-@]/u.test(value) ? `'${value}` : value
}

export async function createXlsxReport({
  title,
  period,
  totals,
  headers,
  rows,
  logoDataUrl,
}: {
  title: string
  period: string
  totals: { BS: number; USD: number }
  headers: string[]
  rows: XlsxCell[][]
  logoDataUrl: string
}): Promise<ArrayBuffer> {
  const logoMatch = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/u.exec(logoDataUrl)
  if (!logoMatch) {
    throw new Error('El logo del reporte no tiene un formato PNG válido.')
  }

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Aportes', {
    views: [{ state: 'frozen', ySplit: 5 }],
  })

  worksheet.mergeCells('A1:H2')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = title
  titleCell.font = { bold: true, color: { argb: 'FF18352D' }, size: 16 }
  titleCell.alignment = { vertical: 'middle', wrapText: true }
  worksheet.getRow(1).height = 28
  worksheet.getRow(2).height = 28

  worksheet.mergeCells('A3:I3')
  const totalsCell = worksheet.getCell('A3')
  totalsCell.value = `Período: ${period} | Total Bs: ${totals.BS.toFixed(2)} | Total USD: ${totals.USD.toFixed(2)}`
  totalsCell.font = { color: { argb: 'FF53665D' }, italic: true }

  const imageId = workbook.addImage({ base64: logoMatch[1], extension: 'png' })
  worksheet.addImage(imageId, { tl: { col: 8, row: 0 }, ext: { width: 72, height: 72 } })

  worksheet.addRow([])
  const headerRow = worksheet.addRow(headers)
  headerRow.font = { bold: true, color: { argb: 'FF18352D' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF0EA' } }
  headerRow.alignment = { vertical: 'middle' }
  headerRow.height = 22

  worksheet.addRows(rows)
  worksheet.columns = [
    { width: 14 }, { width: 26 }, { width: 16 }, { width: 16 }, { width: 14 },
    { width: 10 }, { width: 18 }, { width: 22 }, { width: 24 },
  ]
  worksheet.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5 + rows.length, column: headers.length },
  }

  for (let rowNumber = 6; rowNumber < 6 + rows.length; rowNumber++) {
    worksheet.getCell(rowNumber, 5).numFmt = '#,##0.00'
  }

  return workbook.xlsx.writeBuffer()
}
