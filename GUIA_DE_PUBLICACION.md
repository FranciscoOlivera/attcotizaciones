# 🚀 GUÍA MAESTRA DE PUBLICACIÓN, CONFIGURACIÓN Y MULTIUSUARIO
## AT&T Precios Sync - Promociones Premium

Este archivo reúne en **un solo lugar** todas las configuraciones, credenciales, variables y pasos exactos que necesitas para publicar la aplicación en internet y permitir que más personas (vendedores, asesores, clientes y equipo comercial) la utilicen sin comprometer tu cuenta ni tus datos confidenciales.

---

### 1. ¿Cómo funciona la arquitectura para múltiples personas?

La aplicación está diseñada bajo el modelo **Lector Centralizado / Modo Público de Ventas**:
- **Público General (Vendedores / Asesores / Clientes):**
  - No necesitan registrarse ni iniciar sesión con Google.
  - Tienen acceso completo al **Cotizador Oficial de WhatsApp**, el **Generador de Publicidad para Facebook (1080p)** y el **Catálogo de Promociones Vigentes**.
  - Los datos y precios se descargan automáticamente desde el servidor central (`/api/sync/state`).
- **Administrador (Titular del Buzón):**
  - Solo tú tienes acceso a autorizar la lectura de Gmail y Google Sheets.
  - El cambio de buzón maestro está protegido de forma confidencial en el servidor por un **PIN Secreto de Administrador**.

---

### 2. Variables de Entorno (`.env`)

Crea o configura tu archivo `.env` en el servidor de producción (o en el panel de Secrets de tu proveedor de hosting: Google Cloud Run, Vercel, Railway, Render, etc.):

```env
# 1. PUERTO DEL SERVIDOR (Por defecto 3000)
PORT=3000

# 2. URL PÚBLICA DE LA APLICACIÓN (Tu dominio o subdominio asignado)
APP_URL=https://tu-dominio-o-app.run.app

# 3. CLAVE DE GEMINI (Opcional, para redacción con IA de copies de Facebook y WhatsApp)
GEMINI_API_KEY=tu_api_key_de_gemini

# 4. PIN SECRETO DE ADMINISTRADOR (Para proteger el cambio de buzón maestro)
# Define aquí tu PIN numérico personal privado (no se expone en el código ni a otros usuarios).
ADMIN_PIN=TU_PIN_SECRETO_AQUI

# 5. ENTORNO DE EJECUCIÓN
NODE_ENV=production
```

> **Nota de Privacidad:** El frontend nunca incluye tu PIN en su código compilado; el servidor backend es el único que lo valida de manera segura.

---

### 3. Credenciales de Google Cloud y Firebase (`firebase-applet-config.json`)

Para que la aplicación autentique tu cuenta de Gmail y Google Sheets en un nuevo dominio o para más personas, debes registrar las URLs permitidas en Google Cloud Console:

1. Ingresa a [Google Cloud Console](https://console.cloud.google.com/) -> **APIs y servicios** -> **Credenciales**.
2. Selecciona tu **ID de cliente de OAuth 2.0 (Aplicación web)**.
3. En **Orígenes de JavaScript autorizados**, agrega:
   - `http://localhost:3000` (para desarrollo local)
   - Tu URL de producción (ejemplo: `https://tu-app.run.app` o tu dominio personalizado `https://precios.tudominio.com`)
4. En **URIs de redireccionamiento autorizados**, agrega el dominio de autenticación de Firebase:
   - `https://<TU-PROJECT-ID>.firebaseapp.com/__/auth/handler`
5. Verifica que las siguientes APIs estén activadas en **APIs y servicios habilitados**:
   - **Gmail API**
   - **Google Sheets API**
   - **Google Drive API**

Tu archivo `firebase-applet-config.json` en la raíz del proyecto tiene esta estructura:
```json
{
  "projectId": "TU_PROJECT_ID",
  "appId": "TU_APP_ID",
  "apiKey": "TU_FIREBASE_API_KEY",
  "authDomain": "TU_PROJECT_ID.firebaseapp.com",
  "storageBucket": "TU_PROJECT_ID.firebasestorage.app",
  "messagingSenderId": "TU_MESSAGING_SENDER_ID",
  "measurementId": "",
  "oAuthClientId": "TU_OAUTH_CLIENT_ID.apps.googleusercontent.com",
  "recaptchaSiteKey": ""
}
```

---

### 4. Permisos de Pantalla de Consentimiento de Google (OAuth)

Si más usuarios con cuentas externas van a iniciar sesión como administradores, debes verificar el estado de la aplicación en la **Pantalla de consentimiento de OAuth**:
- **Modo "En prueba" (Testing):** Solo pueden iniciar sesión los correos que agregues explícitamente en la lista de *"Usuarios de prueba"*.
- **Modo "Producción" (Public):** Cualquier cuenta de Google permitida puede autenticarse. (Recuerda que para el buzón maestro, la app solo permite al correo asignado como titular).

Scopes requeridos en la pantalla de consentimiento:
- `https://www.googleapis.com/auth/gmail.readonly` (Lectura de listas de precios de AT&T)
- `https://www.googleapis.com/auth/gmail.send` (Envío de resúmenes de actualización)
- `https://www.googleapis.com/auth/spreadsheets` (Sincronización de base de datos a Google Sheets)

---

### 5. Datos Persistentes (`server-data.json`)

El servidor guarda automáticamente las promociones activas, los planes configurados y el historial en el archivo `server-data.json`.
- En entornos con contenedores Docker o Cloud Run, asegúrate de que el directorio donde se ejecuta el servidor tenga permisos de escritura o monta un volumen persistente para no perder la base central al reiniciar el contenedor.

---

### 6. Comandos de Compilación y Despliegue

Para poner en marcha la aplicación en producción:

```bash
# 1. Instalar dependencias
npm install

# 2. Compilar el cliente React + Tailwind
npm run build

# 3. Iniciar el servidor unificado (Express + API + Servidor de archivos estáticos)
npm run start
```

---

### 7. Resumen de Seguridad para Compartir la App

| Perfil de Usuario | ¿Necesita Login? | ¿Qué puede hacer? |
|---|---|---|
| **Vendedores / Equipo Comercial** | ❌ No | Usar Cotizador WhatsApp, calcular enganches/rentas, descargar imágenes y anuncios de Facebook en 1080p, consultar catálogo. |
| **Visitantes / Clientes** | ❌ No | Ver promociones vigentes, calcular mensualidades oficiales. |
| **Administrador Titular** | ✅ Sí (Google) | Sincronizar bandejas de Gmail, enviar correos de resumen, subir archivos Excel, cambiar buzón maestro con el PIN Secreto. |
