import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  type User,
} from 'firebase/auth'
import { get, onValue, ref } from 'firebase/database'
import { demoMode, firebaseConfig, firebaseConfigured, getFirebaseAuth, getFirebaseDatabase } from './firebase'
import { compressReceipt, receiptToDataUrl } from './utils/image'
import { normalizeReference } from './utils/reference'
import { dateInCaracas } from './utils/dates'
import { loginEmailForUsername } from './utils/auth'
import { createDemoContributions, hasDemoReference } from './utils/demo'
import { approveContribution as approveRecord, deleteContribution as deleteRecord, submitContribution as submitRecord, updateContribution as updateRecord } from './services/contributions'
import type { Contribution, ContributionForm, ContributionInput } from './types'
import redencionIcon from './img/app-icon-192.png'
import './App.css'

const AdminPortal = lazy(() =>
  import('./components/AdminPortal').then(module => ({ default: module.AdminPortal })),
)

const initialForm: ContributionForm = {
  name: '', phone: '', reason: 'Diezmo', amount: '', currency: 'BS',
  method: 'Efectivo', reference: '', receipt: null,
}
type UserRole = 'admin' | 'supervisor'
const roleLabels: Record<UserRole, string> = { admin: 'Administrador', supervisor: 'Supervisor · solo lectura' }
const demoUserLabel = 'Modo de prueba local'
type InstallHelpPlatform = 'ios' | 'android' | 'desktop'
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isInstallPromptEvent(event: Event): event is InstallPromptEvent {
  return 'prompt' in event && typeof event.prompt === 'function' && 'userChoice' in event
}

function currentInstallHelpPlatform(): InstallHelpPlatform {
  const userAgent = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(userAgent) ||
      (/macintosh/.test(userAgent) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/android/.test(userAgent)) return 'android'
  return 'desktop'
}

function isStandaloneDisplayMode(): boolean {
  const legacyNavigator = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || legacyNavigator.standalone === true
}

function Dialog({ type, title, message, buttonLabel, onClose }: {
  type: 'success' | 'error'; title: string; message: string; buttonLabel?: string; onClose: () => void
}) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className={`dialog ${type}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-icon">{type === 'success' ? '✓' : '!'}</div>
        <h2 id="dialog-title">{title}</h2>
        <p>{message}</p>
        <button type="button" onClick={onClose}>
          {buttonLabel || (type === 'success' ? 'Aceptar y recargar' : 'Cerrar y revisar')}
        </button>
      </section>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<'public' | 'admin'>('public')
  const [form, setForm] = useState<ContributionForm>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [dialog, setDialog] = useState<{
    type: 'success' | 'error'
    title: string
    message: string
    buttonLabel?: string
    reloadOnClose?: boolean
  } | null>(null)
  const [receiptName, setReceiptName] = useState('')
  const [receiptMessage, setReceiptMessage] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [authChecking, setAuthChecking] = useState(false)
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [contributions, setContributions] = useState<Contribution[]>(() =>
    demoMode ? createDemoContributions(Date.now()) : [],
  )
  const [adminDataError, setAdminDataError] = useState('')
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [appInstalled, setAppInstalled] = useState(false)
  const [installHelp, setInstallHelp] = useState<InstallHelpPlatform | null>(null)
  const [installError, setInstallError] = useState('')

  useEffect(() => {
    if (demoMode || !firebaseConfigured) return
    const auth = getFirebaseAuth()
    const database = getFirebaseDatabase()
    let active = true
    let currentUid: string | null = null
    const unsubscribe = onAuthStateChanged(auth, nextUser => {
      currentUid = nextUser?.uid ?? null
      setContributions([])
      setUser(nextUser)
      setUserRole(null)
      setAuthChecking(Boolean(nextUser))
      setAdminDataError(nextUser ? 'Verificando el acceso...' : '')
      if (!nextUser) return

      const uid = nextUser.uid
      void (async () => {
        try {
          const [adminSnapshot, supervisorSnapshot] = await Promise.all([
            get(ref(database, `admins/${uid}`)),
            get(ref(database, `supervisors/${uid}`)),
          ])
          if (!active || currentUid !== uid) return

          const role: UserRole | null = adminSnapshot.val() === true
            ? 'admin'
            : supervisorSnapshot.val() === true ? 'supervisor' : null
          if (!role) {
            setLoginError('Esta cuenta no tiene un rol autorizado en Firebase.')
            await signOut(auth)
            return
          }

          setLoginError('')
          setUserRole(role)
          setAdminDataError('Cargando registros...')
        } catch (error) {
          console.error('No se pudo verificar el rol de la cuenta.', error)
          if (!active || currentUid !== uid) return
          setLoginError('No se pudo verificar el acceso. Revise las reglas y el rol de la cuenta en Firebase.')
          try {
            await signOut(auth)
          } catch (signOutError) {
            console.error('No se pudo cerrar la sesión no autorizada.', signOutError)
          }
        } finally {
          if (active && currentUid === uid) setAuthChecking(false)
        }
      })()
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])
  useEffect(() => {
    if (demoMode || !user || !userRole) return
    const contributionsRef = ref(getFirebaseDatabase(), 'contribuciones')
    return onValue(contributionsRef, snapshot => {
      const value = snapshot.val() as Record<string, Omit<Contribution, 'id' | 'date'>> | null
      setContributions(value ? Object.entries(value).map(([id, item]) => ({
        id,
        ...item,
        date: dateInCaracas(item.createdAt),
      })) : [])
      setAdminDataError('')
    }, () => {
      setAdminDataError('No se pudieron cargar los registros. Verifique el rol asignado y las reglas de Firebase.')
    })
  }, [user, userRole])
  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const updateInstalledState = () => setAppInstalled(isStandaloneDisplayMode())
    const handleBeforeInstallPrompt = (event: Event) => {
      if (!isInstallPromptEvent(event)) return
      event.preventDefault()
      setInstallPrompt(event)
    }
    const handleAppInstalled = () => {
      setAppInstalled(true)
      setInstallPrompt(null)
      setInstallHelp(null)
    }

    updateInstalledState()
    displayMode.addEventListener('change', updateInstalledState)
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      displayMode.removeEventListener('change', updateInstalledState)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const needsReference = form.method === 'Pago móvil' || form.method === 'Transferencia'
  const update = (field: keyof ContributionForm, value: string | null | File) =>
    setForm(current => ({ ...current, [field]: value }))

  async function onReceipt(file: File | undefined) {
    if (!file) { update('receipt', null); setReceiptName(''); setReceiptMessage(''); return }
    if (file.size > 25 * 1024 * 1024) {
      setReceiptMessage('La imagen original supera el máximo de 25 MB.')
      update('receipt', null)
      return
    }
    try {
      setReceiptMessage('Comprimiendo comprobante...')
      const compressed = await compressReceipt(file)
      update('receipt', compressed)
      setReceiptName(compressed.name)
      setReceiptMessage('Comprobante listo.')
    } catch (error) {
      setReceiptMessage(error instanceof Error ? error.message : 'No se pudo comprimir el comprobante.')
      update('receipt', null)
    }
  }

  async function submitContribution(event: FormEvent) {
    event.preventDefault()
    if (!demoMode && !firebaseConfigured) {
      setDialog({ type: 'error', title: 'Configuración pendiente', message: 'Configure Firebase antes de enviar aportes.' })
      return
    }
    if (!form.name.trim()) {
      setDialog({ type: 'error', title: 'Datos incompletos', message: 'Ingrese el nombre completo.' }); return
    }
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setDialog({ type: 'error', title: 'Monto no válido', message: 'Ingrese un monto mayor que cero.' }); return
    }
    const normalizedReference = needsReference ? normalizeReference(form.reference) : null
    if (needsReference && !normalizedReference) {
      setDialog({ type: 'error', title: 'Referencia no válida', message: 'Ingrese de 1 a 80 letras, números, guiones o guiones bajos.' }); return
    }
    setSubmitting(true)
    try {
      let receipt: string | undefined
      if (form.receipt) {
        receipt = await receiptToDataUrl(form.receipt)
      }
      if (demoMode) {
        if (hasDemoReference(contributions, form.method, normalizedReference)) {
          throw new Error('Esa referencia ya aparece en los ejemplos o en esta sesión de prueba.')
        }
        const createdAt = Date.now()
        setContributions(current => [{
          id: `demo-submission-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt,
          date: dateInCaracas(createdAt),
          name: form.name.trim(),
          phone: form.phone.trim(),
          reason: form.reason,
          amount,
          currency: form.currency,
          method: form.method,
          reference: normalizedReference,
          receiptData: receipt,
          status: 'pending',
        }, ...current])
        setForm(initialForm)
        setReceiptName('')
        setReceiptMessage('')
        setDialog({
          type: 'success',
          title: 'Aporte de prueba pendiente',
          message: 'Se agregó solo a esta sesión local y no se guardó en Firebase. El administrador debe aprobarlo antes de que aparezca en los reportes.',
          buttonLabel: 'Aceptar',
        })
        return
      }
      await submitRecord({
        name: form.name,
        phone: form.phone,
        reason: form.reason,
        amount,
        currency: form.currency,
        method: form.method,
        reference: normalizedReference,
        receipt,
      })
      setDialog({
        type: 'success',
        title: 'Aporte recibido para validación',
        message: 'Gracias. El aporte quedó pendiente de revisión y solo se sumará a los reportes cuando el administrador lo apruebe.',
        reloadOnClose: true,
      })
    } catch (error) {
      setDialog({
        type: 'error',
        title: 'No se pudo registrar',
        message: error instanceof Error ? error.message : 'Ocurrió un error. Intente nuevamente.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault()
    setLoginError('')
    if (!firebaseConfigured) {
      setLoginError('Configure Firebase antes de iniciar sesión.')
      return
    }
    try {
      const email = loginEmailForUsername(loginUsername, firebaseConfig.projectId)
      setAuthChecking(true)
      await signInWithEmailAndPassword(getFirebaseAuth(), email, loginPassword)
      setLoginPassword('')
    } catch (error) {
      setAuthChecking(false)
      setLoginError(error instanceof Error && error.message.includes('usuario')
        ? error.message
        : 'Usuario o contraseña incorrectos.')
    }
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const currentUser = getFirebaseAuth().currentUser
    if (!currentUser?.email) throw new Error('No hay una cuenta iniciada para cambiar la contraseña.')

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword)
      await reauthenticateWithCredential(currentUser, credential)
      await updatePassword(currentUser, newPassword)
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : ''
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        throw new Error('La contraseña actual no es correcta.')
      }
      throw error
    }
  }

  async function installApplication() {
    setInstallError('')
    if (!installPrompt) {
      setInstallHelp(currentInstallHelpPlatform())
      return
    }
    try {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      setInstallPrompt(null)
      if (choice.outcome === 'dismissed') setInstallHelp(currentInstallHelpPlatform())
    } catch (error) {
      setInstallError(error instanceof Error ? error.message : 'El navegador no pudo iniciar la instalación.')
      setInstallHelp(currentInstallHelpPlatform())
      setInstallPrompt(null)
    }
  }

  async function approveContribution(item: Contribution) {
    if (demoMode) {
      setContributions(current => current.map(record =>
        record.id === item.id ? { ...record, status: 'approved' } : record,
      ))
      return
    }
    await approveRecord(item.id)
  }

  async function updateAdminContribution(item: Contribution, input: ContributionInput) {
    if (demoMode) {
      const needsRef = input.method === 'Pago móvil' || input.method === 'Transferencia'
      const normalizedReference = needsRef ? normalizeReference(input.reference || '') : null
      if (!input.name.trim()) throw new Error('El nombre es obligatorio.')
      if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('El monto debe ser mayor que cero.')
      if (needsRef && !normalizedReference) throw new Error('La referencia es obligatoria.')
      const others = contributions.filter(record => record.id !== item.id)
      if (hasDemoReference(others, input.method, normalizedReference)) {
        throw new Error('Esa referencia ya aparece en otro aporte de esta sesión.')
      }
      setContributions(current => current.map(record => record.id === item.id ? {
        ...record,
        name: input.name.trim(),
        phone: input.phone.trim(),
        reason: input.reason,
        amount: input.amount,
        currency: input.currency,
        method: input.method,
        reference: normalizedReference,
      } : record))
      return
    }
    await updateRecord(item, input)
  }

  async function deleteAdminContribution(item: Contribution) {
    if (demoMode) {
      setContributions(current => current.filter(record => record.id !== item.id))
      return
    }
    await deleteRecord(item)
  }

  const publicTitle = useMemo(() => tab === 'public' ? 'Registrar aporte' : 'Acceso administrativo', [tab])
  const localUsername = user?.email?.split('@')[0]?.toLocaleLowerCase('es') ?? ''
  const displayName = localUsername === 'finanzas' ? 'Finanzas'
    : localUsername === 'pastor' ? 'Pastor'
      : localUsername === 'supervisor' ? 'Supervisor'
        : localUsername
  const adminUserLabel = demoMode
    ? demoUserLabel
    : user && userRole ? `${displayName} · ${roleLabels[userRole]}` : null

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><img className="brand-logo" src={redencionIcon} alt="" /><div><strong>Iglesia Redención</strong><small>Generosidad</small></div></div>
        <nav aria-label="Navegación principal">
          <button className={tab === 'public' ? 'active' : ''} onClick={() => setTab('public')}>Aporte</button>
          <button className={tab === 'admin' ? 'active' : ''} onClick={() => setTab('admin')}>Administración</button>
          {!appInstalled && <button className="install-button" type="button" onClick={() => void installApplication()} aria-label="Instalar aplicación">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
              <path d="M5 18v3h14v-3" />
            </svg>
            <span>Instalar</span>
          </button>}
        </nav>
      </header>

      {demoMode && <div className="demo-banner" role="status">
        MODO DE PRUEBA LOCAL: no se conecta a Firebase. Los ejemplos y envíos solo viven en memoria y desaparecen al recargar o cerrar esta página.
      </div>}

      <main>
        {tab === 'public' ? (
          <div className="public-layout">
            <section className="intro-panel">
              <p className="eyebrow">IGLESIA REDENCIÓN</p>
              <h1>Sembrar con Propósito</h1>
              <p className="scripture-reference">2 Corintios 8:9</p>
              <p>Registre su Diezmo, Ofrenda o Donación de forma segura.</p>
              <div className="privacy-note"><strong>Privacidad y validación</strong><p>Los registros y comprobantes no son públicos. Cada aporte debe ser validado por un administrador antes de sumarse a los reportes.</p></div>
            </section>
            <section className="form-card">
              <h2>{publicTitle}</h2>
              <form onSubmit={submitContribution}>
                <label>Nombre completo *<input required maxLength={100} value={form.name} onChange={e => update('name', e.target.value)} placeholder="Nombre y apellido" /></label>
                <label>Teléfono opcional<input type="tel" maxLength={30} value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+58..." /></label>
                <div className="field-grid">
                  <label>Motivo<select value={form.reason} onChange={e => update('reason', e.target.value)}><option>Diezmo</option><option>Ofrenda</option><option>Donación</option></select></label>
                  <label>Forma de aporte<select value={form.method} onChange={e => update('method', e.target.value)}><option>Efectivo</option><option>Pago móvil</option><option>Transferencia</option></select></label>
                </div>
                <div className="field-grid">
                  <label>Monto *<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={e => update('amount', e.target.value)} placeholder="0.00" /></label>
                  <label>Moneda<select value={form.currency} onChange={e => update('currency', e.target.value)}><option value="BS">Bolívares (Bs)</option><option value="USD">Dólares ($)</option></select></label>
                </div>
                {needsReference && <label>Referencia *<input required maxLength={80} value={form.reference} onChange={e => update('reference', e.target.value)} placeholder="Código de la operación" /><small>Se ignoran mayúsculas y espacios exteriores. Use letras, números, guion o guion bajo; no se permiten referencias repetidas.</small></label>}
                <label className="receipt-field">Comprobante opcional<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => onReceipt(e.target.files?.[0])} />{receiptName && <strong>{receiptName}</strong>}<span>{receiptMessage}</span></label>
                <button className="submit-button" type="submit" disabled={submitting}>{submitting ? 'Registrando...' : 'Registrar aporte'}</button>
              </form>
            </section>
          </div>
        ) : !adminUserLabel ? (
          <section className="login-card">
            <p className="eyebrow">PORTAL ADMINISTRATIVO</p><h1>Acceso seguro</h1>
            {authChecking ? <p role="status">Verificando acceso...</p> : (
              <form onSubmit={login}>
                <label>Usuario<input autoComplete="username" required value={loginUsername} onChange={e => setLoginUsername(e.target.value)} placeholder="Finanzas, Pastor o Supervisor" /></label>
                <label>Contraseña<input autoComplete="current-password" type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} /></label>
                {loginError && <p className="form-error" role="alert">{loginError}</p>}
                <button className="submit-button" type="submit">Iniciar sesión</button>
              </form>
            )}
          </section>
        ) : (
          <Suspense fallback={<p role="status">Cargando el portal administrativo...</p>}>
            <AdminPortal
              contributions={contributions}
              user={adminUserLabel}
              dataError={adminDataError}
              demoMode={demoMode}
              readOnly={userRole === 'supervisor' && !demoMode}
              onSignOut={() => demoMode ? setTab('public') : void signOut(getFirebaseAuth())}
              onChangePassword={changePassword}
              onApprove={approveContribution}
              onUpdate={updateAdminContribution}
              onDelete={deleteAdminContribution}
            />
          </Suspense>
        )}
      </main>

      {dialog && <Dialog {...dialog} onClose={() => {
        const reload = dialog.reloadOnClose === true
        setDialog(null)
        if (reload) window.location.reload()
      }} />}

      {installHelp && (
        <div className="dialog-backdrop" role="presentation">
          <section className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title">
            <h2 id="install-title">Instalar Generosidad</h2>
            {installHelp === 'ios' ? (
              <>
                <p>En Safari, toca <strong>Compartir</strong> y selecciona <strong>Añadir a pantalla de inicio</strong>. Luego confirma con <strong>Añadir</strong>.</p>
                <p>Al abrirla desde el nuevo icono, la aplicación se mostrará sin la barra del navegador.</p>
              </>
            ) : installHelp === 'android' ? (
              <p>En Chrome, abre el menú <strong>⋮</strong> y selecciona <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla principal</strong>.</p>
            ) : (
              <p>En Microsoft Edge o Google Chrome, abre el menú <strong>⋯</strong> y selecciona <strong>Instalar Generosidad</strong> o <strong>Instalar esta aplicación</strong>.</p>
            )}
            {installError && <p className="form-error" role="alert">{installError}</p>}
            <button type="button" onClick={() => { setInstallHelp(null); setInstallError('') }}>Entendido</button>
          </section>
        </div>
      )}
    </div>
  )
}
