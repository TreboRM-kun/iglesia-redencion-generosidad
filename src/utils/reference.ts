export function normalizeReference(value: string): string {
  const normalized = value.trim().toUpperCase()
  return /^[A-Z0-9_-]{1,80}$/.test(normalized) ? normalized : ''
}
