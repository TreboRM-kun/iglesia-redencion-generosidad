# Generosidad — Iglesia Redención

Aplicación independiente en React + TypeScript + Vite para registrar Diezmos, Ofrendas y Donaciones sin inicio de sesión público. Los aportes quedan pendientes hasta que un administrador autorizado los valide; solo entonces se suman a los reportes. Los administradores pueden corregir o eliminar transacciones.

## Desarrollo local

```powershell
npm install
copy .env.example .env.local
npm run dev
npm test
npm run build
```

Complete `.env.local` con la configuración web pública del proyecto Firebase separado. Esta configuración no contiene contraseñas ni secretos privados.

## Prueba local sin guardar registros

En esta copia, `.env.local` tiene `VITE_DEMO_MODE=true`. Inicie la aplicación:

```powershell
npm run dev
```

Abra `http://localhost:5173`. En este modo no se conecta a Firebase: aparecen ejemplos claramente identificados, se pueden simular aportes y revisarlos en Administración sin iniciar sesión. Los aportes simulados quedan pendientes hasta que se validen; también puede probar su edición y eliminación. Todo vive únicamente en la memoria de la página; al recargar o cerrar la pestaña, los cambios y aportes simulados desaparecen y vuelven los ejemplos iniciales. No use esta vista para registrar aportes reales.

El modo de prueba solo está activado en el archivo local ignorado por Git; no se incluye en el despliegue de GitHub Pages. Para conectarlo a Firebase, cambie `VITE_DEMO_MODE=false` y complete las variables Firebase indicadas abajo.

## Crear y configurar Firebase

La aplicación está preparada para el proyecto Firebase separado `iglesia-redencion-generosidad`.

1. Use el proyecto `iglesia-redencion-generosidad`; no lo conecte al sistema de asistencias.
2. Active **Authentication > Sign-in method > Email/Password**.
3. Cree tres cuentas en **Authentication > Users**, con los usuarios `finanzas`, `pastor` y `supervisor`. Use como correo interno `usuario@ID_DEL_PROYECTO.firebaseapp.com` (por ejemplo, `finanzas@iglesia-redencion-generosidad.firebaseapp.com`) y asigne una contraseña temporal distinta a cada cuenta. No necesitan una bandeja de correo; el acceso se hace con el nombre de usuario. Copie el **UID** de cada cuenta.
4. Active **Realtime Database** en modo bloqueado inicialmente y publique `database.rules.json` desde Firebase Console o Firebase CLI:
   ```powershell
   firebase login
   firebase use --add
   firebase deploy --only database
   ```
5. En la pestaña **Data** de Realtime Database, agregue `admins/UID: true` para Finanzas y Pastor, y `supervisors/UID: true` para Supervisor. Reemplace `UID` con el UID real. Finanzas y Pastor pueden validar, editar y eliminar; Supervisor solo puede consultar.
6. Copie desde Firebase Console la configuración web a `.env.local`.
7. Para reducir envíos abusivos, registre la aplicación web en **App Check** con reCAPTCHA v3, agregue la clave del sitio como `VITE_RECAPTCHA_V3_SITE_KEY` y luego habilite la aplicación forzada para Realtime Database. Primero verifique que los envíos legítimos funcionan.
8. No cree Firebase Storage ni active facturación. Los comprobantes se comprimen en el navegador y se guardan como datos WebP en Realtime Database; cuentan para su cuota gratuita.

El portal permite cambiar la contraseña desde la sesión iniciada, solicitando la contraseña actual y una nueva de al menos 8 caracteres. Como los usuarios internos no tienen bandeja de correo, no se puede enviar un restablecimiento automático; si alguien pierde su contraseña, un administrador deberá cambiarla desde Firebase Authentication. No publique ni agregue contraseñas al repositorio.

## Validación, correcciones y referencias

En pagos móviles y transferencias, el identificador de `contribuciones/$id` es la referencia normalizada (sin espacios exteriores y en mayúsculas). El envío público solo puede crear aportes pendientes y nunca leer, aprobar, editar ni borrar registros. La regla de Realtime Database impide volver a registrar una referencia existente.

Los administradores pueden validar, corregir o eliminar cualquier aporte. Si se corrige una referencia bancaria, el sistema comprueba que no esté en uso y actualiza también el identificador del registro y la ruta de su comprobante. Los registros antiguos sin estado explícito se consideran validados para conservar los reportes históricos.

## Registros y privacidad

- Público: solo puede crear registros con estado pendiente. No puede leer, aprobar, modificar ni eliminar registros o comprobantes.
- Administradores: pueden leer, validar, corregir y eliminar registros y comprobantes si su UID aparece bajo `admins` en Realtime Database.
- Supervisor: puede consultar registros, comprobantes y reportes, sin permiso para validar, corregir ni eliminar.
- Comprobantes: opcional, JPEG/PNG/WebP hasta 25 MB original, comprimido a WebP máximo 2 MB y guardado separado para no descargar imágenes al abrir la tabla.
- Los registros reciben una marca de tiempo del servidor. Los reportes usan la fecha de Venezuela (America/Caracas).
- Los reportes, totales y exportaciones incluyen únicamente aportes validados por un administrador. La validación debe hacerse después de verificar la transferencia o recibir el efectivo.
- Los reportes se pueden exportar como CSV, XLSX, TXT o PDF, o imprimir; los formatos visuales incluyen el logo de la iglesia.
- El sitio no verifica por sí mismo que el dinero haya llegado a la cuenta de la iglesia; esa comprobación corresponde al administrador.

## Recursos gráficos

Las imágenes originales de la iglesia se conservan en `src/img`. La aplicación usa el icono de Redención en la barra superior y como favicon, `lg1.png` en los reportes y `bg1.jpeg` como fondo limitado al área visible bajo la barra superior.

## Instalación como aplicación

La aplicación incluye un manifiesto, iconos y un service worker para poder instalarse como PWA. En Android y Windows, el botón usa la solicitud nativa del navegador cuando está disponible; en iPhone/iPad muestra los pasos para instalarla desde Safari. Al abrir la versión instalada, el botón se oculta.

La instalación requiere una conexión segura HTTPS (GitHub Pages la proporciona). Para probar localmente el service worker, ejecute `npm run build` y luego `npm run preview`; el servidor de desarrollo no registra el service worker para evitar que interfiera con HMR.

## GitHub Pages

1. Use el repositorio público [TreboRM-kun/iglesia-redencion-generosidad](https://github.com/TreboRM-kun/iglesia-redencion-generosidad).
2. Active Pages en **Settings > Pages > Source: GitHub Actions**.
3. Agregue los valores `VITE_FIREBASE_*` y, si habilitó App Check, `VITE_RECAPTCHA_V3_SITE_KEY` como variables o secrets de Actions.
4. Después de agregar la configuración de Firebase, haga push a `main`; `.github/workflows/deploy-pages.yml` construirá y publicará `dist`.
5. En Firebase Authentication agregue el dominio `USUARIO.github.io` como dominio autorizado.

Cada push a `main` inicia un despliegue automático. Sin las variables de Firebase configuradas, el sitio no podrá guardar aportes reales.
