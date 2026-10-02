# Controles de auditoría — Desarrollador BI (Vercel)

Proyecto: Ecosistema FRAML — Fase 1
Componente: `framl-dashboard` (frontend Next.js desplegado en Vercel)
Responsable: Cristian

## 1. Protección de datos en tránsito (SSL/TLS)

**Control:** toda comunicación entre el usuario, el frontend y la base de datos viaja cifrada mediante HTTPS (TLS).

**Cómo se cumple:**

| Tramo | Mecanismo | Evidencia |
|---|---|---|
| Navegador → Vercel | Vercel emite y renueva automáticamente un certificado TLS para el dominio `*.vercel.app` y redirige HTTP a HTTPS. | Captura del candado del navegador y del detalle del certificado. |
| Navegador → Vercel | El encabezado `Strict-Transport-Security` (HSTS, 2 años) obliga al navegador a usar solo HTTPS en visitas posteriores. Definido en `next.config.ts`. | `curl -sI https://<dominio>.vercel.app` muestra el encabezado. |
| Servidor (Vercel) → Supabase | La aplicación rechaza cualquier `SUPABASE_URL` que no use `https://` (`src/lib/supabase/config.ts`, cubierto por pruebas). | `npm test` — caso "rejects non-HTTPS URLs". |

Encabezados de endurecimiento adicionales: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy`. Además se oculta `X-Powered-By`.

**Evidencias a adjuntar:**

- [x] URL del despliegue: `https://ecosistema-framl-auditoria.vercel.app`
- [x] Captura del certificado TLS en el navegador (emisor, vigencia, dominio)
- [x] Salida de `curl -sI` con el encabezado `Strict-Transport-Security`
- [x] Prueba de redirección: `curl -sI http://ecosistema-framl-auditoria.vercel.app` responde `308` hacia `https://`

**Resultados verificados (2026-10-01):**

```text
$ curl -sI https://ecosistema-framl-auditoria.vercel.app
HTTP/2 200
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), microphone=(), geolocation=()

$ curl -sI http://ecosistema-framl-auditoria.vercel.app
HTTP/1.0 308 Permanent Redirect
Location: https://ecosistema-framl-auditoria.vercel.app/

$ openssl s_client -connect ecosistema-framl-auditoria.vercel.app:443
subject=CN=*.vercel.app
issuer=C=US, O=Google Trust Services, CN=WR1
notBefore=Aug 29 19:48:09 2026 GMT
notAfter=Nov 27 19:48:08 2026 GMT
Protocol: TLSv1.3, Cipher: TLS_AES_128_GCM_SHA256
```

El certificado es emitido por una autoridad de certificación pública (Google Trust Services) y Vercel lo renueva automáticamente antes de su vencimiento. La conexión negocia TLS 1.3.

**Capturas del navegador:**

| Conexión segura | Detalle del certificado |
|---|---|
| ![Conexión segura](evidencias/01-conexion-segura.png) | ![Certificado TLS](evidencias/02-certificado-tls.png) |

## 2. Gestión de llaves

**Control:** las credenciales de la base de datos nunca se guardan en texto plano dentro del código fuente ni del repositorio.

**Cómo se cumple:**

1. **Variables de entorno en Vercel.** `SUPABASE_URL` y `SUPABASE_ANON_KEY` se configuran en *Project Settings → Environment Variables* de Vercel. En local se usan desde `.env.local`.
2. **Archivos `.env` excluidos de Git.** `.gitignore` ignora `.env*`. Solo se versiona `.env.example`, que contiene nombres de variables sin valores reales.
3. **Variables solo de servidor.** Las variables no llevan el prefijo `NEXT_PUBLIC_`, por lo que Next.js no las incluye en el JavaScript enviado al navegador. La consulta a Supabase se ejecuta en el servidor (`src/lib/supabase/server.ts`, protegido con `server-only`).
4. **Mínimo privilegio.** Solo se admite la llave `anon` / `publishable`. La aplicación rechaza llaves privilegiadas (`service_role` o `sb_secret_...`), validado por pruebas automatizadas. El acceso a los datos debe estar restringido por Row Level Security (RLS) en Supabase.

**Evidencias a adjuntar:**

- [ ] Captura de las variables en Vercel (con los valores ocultos)
- [x] Búsqueda de llaves en el código y en todo el historial de Git, sin coincidencias (2026-10-01):

  ```text
  $ git grep -nE "eyJ[A-Za-z0-9_-]{10,}|sb_secret_[A-Za-z0-9]|sb_publishable_[A-Za-z0-9]" -- . ':!*.test.ts' ':!*.md' ':!*package-lock.json'
  (sin resultados)
  $ git log --all -p | grep -E "eyJ[A-Za-z0-9_-]{20,}" | grep -v '"integrity"'
  (sin resultados)
  ```

  Se excluyen las pruebas unitarias (usan llaves ficticias generadas en tiempo de ejecución) y los hashes de integridad de `package-lock.json`, que pueden contener la secuencia `eyJ` por coincidencia.
- [x] Salida de `npm test` con todas las pruebas aprobadas (2026-10-01): `Test Files 1 passed (1) · Tests 8 passed (8)`
- [x] La llave no llega al navegador (2026-10-01): se descargaron el HTML y los 6 archivos JavaScript que sirve `https://ecosistema-framl-auditoria.vercel.app` (574 KB) y se buscaron `sb_publishable`, el identificador del proyecto Supabase y `supabase.co`, sin coincidencias. La conexión a Supabase ocurre únicamente en el servidor de Vercel.
- [x] Verificación de RLS con la llave pública (2026-10-01): una consulta de lectura a `maestro_clientes` con la llave `publishable` devuelve 0 filas, por lo que los datos de clientes (incluido `ingreso_declarado`) no son accesibles desde el dashboard.

## 3. Control de versiones

El código se versiona en GitHub (`ccastellanosf-umg/Ecosistema_FRAML_Auditoria`, conectado a Vercel para el despliegue continuo) y se replica en Azure Repos (`https://dev.azure.com/scanele/_git/Ecosistema_FRAML_Auditoria`) para el control centralizado del proyecto. La rama `main` de Azure tiene una política que impide el push directo y el push forzado: los cambios se integran únicamente mediante Pull Request aprobado, lo que constituye un control de gestión de cambios. Azure Boards está vinculado a GitHub, por lo que los commits que incluyen `AB#<id>` quedan enlazados al work item correspondiente.

En Vercel, el proyecto usa `framl-dashboard` como *Root Directory*, ya que el repositorio contiene los componentes de todo el equipo.

## 4. Seguridad de la cadena de suministro

**Control:** las dependencias de terceros (paquetes npm) se instalan de forma verificable y sin ejecutar código no autorizado.

**Cómo se cumple:**

1. **Bloqueo de scripts de instalación.** npm 11 no ejecuta los scripts `preinstall`/`postinstall` de los paquetes salvo que se aprueben explícitamente. Durante el build en Vercel se observa este control en acción: el script de `unrs-resolver` (dependencia de desarrollo de ESLint) queda bloqueado y la compilación finaliza correctamente sin él. Esto mitiga ataques en los que un paquete comprometido ejecuta código malicioso al instalarse.
2. **Versiones fijadas con verificación de integridad.** `package-lock.json` está versionado y fija la versión exacta de cada dependencia junto con su hash de integridad (SHA-512), de modo que el build instala exactamente los mismos paquetes que se probaron.
3. **Auditoría de vulnerabilidades conocidas.** `npm audit` no reporta vulnerabilidades conocidas en las dependencias.

**Observación:** el build reporta que `eslint@9` ya no tiene soporte. Es una dependencia de desarrollo, requerida por `eslint-config-next@16.3.8`, que no se incluye en la aplicación desplegada. Se actualizará cuando Next.js publique una configuración compatible con ESLint 10.

**Evidencias:**

- [x] Log de build en Vercel con el aviso `install-scripts` (script bloqueado) y despliegue exitoso
- [x] `npm audit` → `found 0 vulnerabilities` (2026-10-01)
