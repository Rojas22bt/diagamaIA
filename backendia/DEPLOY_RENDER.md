## Despliegue del backend (`backendia`) en Render

Esta guía explica, paso a paso, cómo desplegar el servicio `backendia` en Render usando la configuración que ya existe en `backendia/render.yaml` y el `package.json` del proyecto.

### Resumen rápido
- El servicio está preparado para Node >=18.
- El build ejecuta: `npm ci && npm run build && npm run prisma:migrate:deploy` (esto ejecuta `prisma generate` en postinstall y luego aplica migraciones).
- Start command: `npm start` (ejecuta `node dist/server.js`).
- Health check: `/health`.

---

### Requisitos previos

- Cuenta en Render con acceso al repositorio (GitHub/GitLab) donde está `diagamaIA`.
- Crear (o tener) una base de datos PostgreSQL accesible desde Render. Prisma necesita la base de datos disponible al ejecutar `prisma migrate deploy`.
- No subir credenciales al repo; usar Environment Variables/Secrets en Render.

---

### Variables de entorno necesarias

Configura estas variables en el servicio de Render (Environment → Environment Variables / Secrets):

- `DATABASE_URL` — URL de conexión a PostgreSQL (ej: `postgres://user:pass@host:5432/dbname`).
- `JWT_SECRET` — secreto para firmar tokens JWT.
- `CORS_ORIGINS` — orígenes permitidos para CORS (ej: `https://tu-frontend.com` o `http://localhost:5173`).
- `NODE_ENV` — `production` (en `render.yaml` ya está establecido, pero revísalo).

Marcar `DATABASE_URL` y `JWT_SECRET` como secretos.

---

### Crear la base de datos en Render (opcional)

Si quieres usar la DB gestionada por Render:

1. En Render → New → PostgreSQL Database.
2. Elige plan y crea la DB.
3. Copia la `DATABASE_URL` proporcionada.

Importante: crea la DB antes del primer deploy, porque las migraciones se ejecutan durante el build.

---

### Crear el Web Service en Render (recomendado usar `render.yaml`)

Opción A — Usar `render.yaml` (recomendado):

1. En Render → New → Web Service.
2. Conecta el repositorio y selecciona la rama (ej. `main`).
3. Render detectará `render.yaml` y propondrá crear el servicio `backendia` con la configuración:
   - `rootDir: backendia`
   - `buildCommand: npm ci && npm run build && npm run prisma:migrate:deploy`
   - `startCommand: npm start`
   - `env: node`
   - `healthCheckPath: /health`
4. Revisa la configuración y confirma.

Opción B — Configuración manual (si no quieres usar `render.yaml`):

1. New → Web Service → repo y branch.
2. Build & Deploy:
   - Root Directory: `backendia`
   - Environment: `Node`
   - Build Command: `npm ci && npm run build && npm run prisma:migrate:deploy`
   - Start Command: `npm start`
   - Health Check Path: `/health`

---

### Notas sobre scripts y Prisma

- `package.json` contiene:
  - `postinstall`: `prisma generate` (se ejecuta tras `npm ci`).
  - `build`: `tsc` (genera `dist/server.js`).
  - `prisma:migrate:deploy`: `prisma migrate deploy` (aplica migraciones en producción).

Por tanto el flujo completo del build es:

1. `npm ci` → instala dependencias y ejecuta `postinstall` (`prisma generate`).
2. `npm run build` → compila TypeScript en `dist/`.
3. `npm run prisma:migrate:deploy` → aplica migraciones en la DB apuntada por `DATABASE_URL`.

Si `DATABASE_URL` no está presente o la DB no acepta conexiones, el build fallará en la fase de migraciones.

---

### Despliegue y verificación

1. Confirma que `DATABASE_URL` y `JWT_SECRET` están configurados en Environment variables.
2. Inicia el deploy (o espera auto-deploy si `autoDeploy: true`).
3. Revisa los logs de build:
   - Deberías ver la ejecución de `npm ci`, `prisma generate`, `tsc` y `prisma migrate deploy`.
4. Revisa los logs de runtime: busca el mensaje `Servidor escuchando en el puerto ...`.
5. Verifica el health check en la URL del servicio + `/health`.

---

### WebSockets y CORS

- Socket.IO: tu server inicializa Socket.IO sobre el servidor HTTP. Render soporta WebSockets; prueba el flujo desde tu frontend en producción.
- CORS: asegúrate de usar `CORS_ORIGINS` para incluir la URL del frontend que vaya a consumir la API.

---

### Comprobaciones locales rápidas (PowerShell)

Antes de push/deploy, prueba localmente con una DB de prueba:

```powershell
# Instalar, generar prisma y compilar
npm ci
npm run build
# Ejecuta migraciones si quieres probarlas localmente (requiere DB accesible)
npm run prisma:migrate:deploy
# Inicia el servidor
npm start
# Verifica health
curl http://localhost:3000/health
```

---

### Troubleshooting común

- Error en `prisma migrate deploy`: verifica `DATABASE_URL`, credenciales y reglas de firewall de la DB.
- `dist/server.js` no encontrado: asegúrate que `tsc` se ejecuta correctamente y que `tsconfig.json` apunta a `outDir: dist`.
- Problemas con WebSockets: verifica la URL y el namespace en el cliente. Revisa logs de Socket.IO.

---

### Checklist final antes de marcar despliegue como OK

- [ ] DB creada y `DATABASE_URL` configurada en Render.
- [ ] `JWT_SECRET` configurado como secret.
- [ ] `CORS_ORIGINS` configurado con el/los origenes del frontend.
- [ ] Servicio creado en Render (usando `render.yaml` o manualmente) con `rootDir: backendia`.
- [ ] Build y migraciones exitosas en logs.
- [ ] Health check `/health` responde 200.
- [ ] Funcionalidad WebSockets probada desde frontend.

---

### Notas adicionales / recomendaciones

- Evita poner `.env` en el repositorio. Usa las Environment Variables de Render.
- Si esperas carga de producción, considera cambiar el plan y habilitar features de auto-scaling.
- Para entornos de staging / previews, habilita Deploy Previews o crea servicios separados por rama.

Si quieres, puedo:

- Generar un pequeño `README_DEPLOY.md` alternativo con capturas y texto aún más conciso.
- Crear un script de verificación HTTP simple que compruebe `/health` y la conexión de la DB.

---

Archivo creado automáticamente por el asistente.
