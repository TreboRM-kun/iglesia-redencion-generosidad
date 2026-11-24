export function csvCell(value: string | number): string {
  const text = String(value)
  const safeText = /^\s*[=+\-@]/u.test(text) ? `'${text}` : text
  return `"${safeText.replace(/"/g, '""')}"`
}
