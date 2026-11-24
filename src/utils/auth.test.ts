import { describe, expect, it } from 'vitest'
import { loginEmailForUsername } from './auth'

describe('loginEmailForUsername', () => {
  it('converts a username into the Firebase email alias', () => {
    expect(loginEmailForUsername('Finanzas', 'iglesia-redencion-generosidad'))
      .toBe('finanzas@iglesia-redencion-generosidad.firebaseapp.com')
  })

  it('normalizes accents and spaces like the attendance application', () => {
    expect(loginEmailForUsername('José Pastor', 'mi-proyecto'))
      .toBe('jose.pastor@mi-proyecto.firebaseapp.com')
  })

  it('rejects empty usernames and invalid project IDs', () => {
    expect(() => loginEmailForUsername('  ', 'mi-proyecto')).toThrow('nombre de usuario')
    expect(() => loginEmailForUsername('pastor', 'invalid project id')).toThrow('ID de proyecto')
    expect(() => loginEmailForUsername('pastor', 'iglesia-redencion-generosidad-prod')).toThrow('ID de proyecto')
  })
})
