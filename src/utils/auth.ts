export function loginEmailForUsername(username: string, projectId: string): string {
  const normalizedUsername = username
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/^\.+|\.+$/g, '')

  if (!/[a-z0-9]/.test(normalizedUsername) || !/^[a-z0-9._-]+$/.test(normalizedUsername)) {
    throw new Error('Ingrese un nombre de usuario válido.')
  }

  const normalizedProjectId = projectId.trim().toLowerCase()
  if (normalizedProjectId.length < 6 || normalizedProjectId.length > 30 ||
      !/^[a-z0-9-]+$/.test(normalizedProjectId)) {
    throw new Error('La configuración de Firebase no contiene un ID de proyecto válido.')
  }

  return `${normalizedUsername}@${normalizedProjectId}.firebaseapp.com`
}
