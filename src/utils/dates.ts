export type Period = 'día' | 'semana' | 'mes' | 'año'

export function dateInCaracas(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return ''

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp))
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function periodStartDate(period: Period, date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1, day))

  if (period === 'semana') {
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
  } else if (period === 'mes') {
    start.setUTCDate(1)
  } else if (period === 'año') {
    start.setUTCMonth(0, 1)
  }

  return start.toISOString().slice(0, 10)
}
