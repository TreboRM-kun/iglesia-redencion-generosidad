const ORIGINAL_LIMIT = 25 * 1024 * 1024
const COMPRESSED_LIMIT = 2 * 1024 * 1024

export async function compressReceipt(file: File): Promise<File> {
  if (file.size > ORIGINAL_LIMIT) throw new Error('La imagen original supera el máximo de 25 MB.')
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Seleccione una imagen JPEG, PNG o WebP.')
  }
  if (file.size <= COMPRESSED_LIMIT && file.type === 'image/webp') return file

  const url = URL.createObjectURL(file)
  const image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('No se pudo abrir la imagen para comprimirla.'))
      image.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }

  const scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight))
  let width = Math.max(1, Math.round(image.naturalWidth * scale))
  let height = Math.max(1, Math.round(image.naturalHeight * scale))

  for (let dimensionAttempt = 0; dimensionAttempt < 5; dimensionAttempt++) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('El navegador no pudo preparar la compresión.')
    context.drawImage(image, 0, 0, width, height)
    for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42]) {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(result => result ? resolve(result) : reject(new Error('No se pudo comprimir la imagen.')), 'image/webp', quality)
      )
      if (blob.size <= COMPRESSED_LIMIT) {
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp', lastModified: Date.now() })
      }
    }
    width = Math.max(1, Math.round(width * 0.8))
    height = Math.max(1, Math.round(height * 0.8))
  }
  throw new Error('No se pudo reducir la imagen a 2 MB. Elija una imagen más pequeña.')
}

export function receiptToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('No se pudo leer el comprobante.'))
    reader.onerror = () => reject(new Error('No se pudo leer el comprobante.'))
    reader.readAsDataURL(file)
  })
}
