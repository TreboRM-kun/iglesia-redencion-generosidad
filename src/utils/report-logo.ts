import reportLogoUrl from '../img/lg1.png'

export { reportLogoUrl }

export async function loadReportLogoDataUrl(): Promise<string> {
  const response = await fetch(reportLogoUrl)
  if (!response.ok) {
    throw new Error(`No se pudo cargar el logo del reporte: ${response.status}`)
  }

  const blob = await response.blob()
  const reader = new FileReader()
  return new Promise((resolve, reject) => {
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el logo del reporte.'))
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('El logo del reporte no se pudo convertir a una imagen.'))
        return
      }
      resolve(reader.result)
    }
    reader.readAsDataURL(blob)
  })
}
