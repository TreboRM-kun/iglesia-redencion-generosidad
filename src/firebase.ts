import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAuth, type Auth } from 'firebase/auth'
import { getDatabase, type Database } from 'firebase/database'

// Replace these placeholders only in your local environment or in a deployment
// build. Never put service-account private keys or credentials here.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'TU_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'TU_PROYECTO.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://TU_PROYECTO-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'TU_PROYECTO',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:000000000000:web:0000000000000000000000',
}

export const firebaseConfigured = [
  import.meta.env.VITE_FIREBASE_API_KEY,
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  import.meta.env.VITE_FIREBASE_DATABASE_URL,
  import.meta.env.VITE_FIREBASE_PROJECT_ID,
  import.meta.env.VITE_FIREBASE_APP_ID,
].every(value => typeof value === 'string' && value.trim().length > 0)
export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true'

const app = initializeApp(firebaseConfig)
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY
if (firebaseConfigured && !demoMode && recaptchaSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
}

let authInstance: Auth | undefined
let databaseInstance: Database | undefined

export function getFirebaseAuth(): Auth {
  if (demoMode) throw new Error('Firebase está deshabilitado en el modo de prueba local.')
  if (!authInstance) authInstance = getAuth(app)
  return authInstance
}

export function getFirebaseDatabase(): Database {
  if (demoMode) throw new Error('Firebase está deshabilitado en el modo de prueba local.')
  if (!databaseInstance) databaseInstance = getDatabase(app)
  return databaseInstance
}
