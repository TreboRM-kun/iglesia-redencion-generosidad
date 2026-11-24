import { describe, expect, it } from 'vitest'
import { csvCell } from './csv'

describe('csvCell', () => {
  it('quotes cells and escapes embedded quotes', () => {
    expect(csvCell('O"Connor')).toBe('"O""Connor"')
  })

  it('prevents spreadsheet formulas in contributor-provided fields', () => {
    expect(csvCell('=HYPERLINK("https://example.com")')).toBe(
      `"'=HYPERLINK(""https://example.com"")"`,
    )
    expect(csvCell('  @SUM(1,2)')).toBe('"\'  @SUM(1,2)"')
  })
})
