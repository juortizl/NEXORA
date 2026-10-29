# Plataforma de visualización y ventas inmobiliarias

Plataforma web multiproyecto para constructoras que reemplaza el PowerPoint de la sala de ventas y el Excel de inventario:
visor 3D interactivo sincronizado con el inventario, cotizador con PDF de marca, comparador de tipologías,
CRM de compradores con separaciones y bloqueo anti doble venta, modo presentación público, dashboard gerencial y
asistente para replicar la plataforma en nuevos proyectos. El proyecto semilla es **Nórtiko by Estructurar**.

## Stack

| Capa | Tecnología |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| UI | Tailwind CSS v4, componentes propios, lucide-react, recharts |
| 3D | React Three Fiber + drei (GLB importado o torre paramétrica) |
| API | tRPC v11 + TanStack Query + superjson |
| Datos | Prisma 6 · PostgreSQL en producción, SQLite en desarrollo |
| Auth | Auth.js v5 (credenciales + roles ADMIN / GERENTE_COMERCIAL / ASESOR) |
| Tiempo real | Server-Sent Events (`/api/events`) |
| Documentos | @react-pdf/renderer (cotizaciones), xlsx (exportes) |
| Pruebas | Vitest (motores de precio y cotización), Playwright (smoke E2E) |

## Requisitos

- Node.js 22+
- npm 10+
- (Opcional) PostgreSQL 16 para replicar el entorno de producción. Para desarrollo basta con SQLite.

## Puesta en marcha local

```bash
cd plataforma
cp .env.example .env          # en Windows: copy .env.example .env
npm install                   # ejecuta prisma generate en postinstall
npm run db:local:reset        # crea la BD SQLite, aplica el esquema y siembra Nórtiko
npm run dev                   # http://localhost:5000
```

Credenciales del seed (cámbialas en producción):

| Rol | Usuario | Contraseña |
| --- | --- | --- |
| Administrador | `admin@estructurar.co` | `Admin123*` |
| Gerente comercial | `gerencia@estructurar.co` | `Asesor123*` |
| Asesor | `asesor1@estructurar.co` / `asesor2@estructurar.co` | `Asesor123*` |

> El seed **borra todos los datos** antes de insertar los de demostración. Úsalo sólo en desarrollo o en el primer despliegue.

## Scripts

| Script | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build de producción y arranque (`0.0.0.0:$PORT`) |
| `npm run lint` · `npm run typecheck` | ESLint y `tsc --noEmit` |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run test:e2e` | Smoke E2E con Playwright (levanta `next dev` si no hay servidor; `E2E_SKIP_SERVER=1` para usar uno existente) |
| `npm run db:local` | Genera `schema.sqlite.prisma` y sincroniza la BD SQLite local |
| `npm run db:local:reset` | Igual que el anterior, borrando datos y volviendo a sembrar |
| `npm run db:push` · `npm run db:seed` | Sincroniza el esquema y siembra sobre `DATABASE_URL` (PostgreSQL) |
| `npm run db:studio` | Prisma Studio |
| `npm run model:optimize -- <entrada.glb> <salida.glb> [--lod]` | Optimiza un GLB (gltf-transform: draco, texturas, poda) |
| `npm run model:validate -- <archivo.glb> <slug>` | Verifica que los nodos del GLB coincidan con el inventario |

## Estructura

```
plataforma/
├─ prisma/            esquema (PostgreSQL) y seed de Nórtiko
├─ scripts/           pipeline 3D, esquema SQLite, seed condicional en despliegue
├─ e2e/               pruebas Playwright
├─ docs/              levantamiento F0 y pipeline 3D
├─ public/images/     renders de referencia (reemplazar por los oficiales)
└─ src/
   ├─ app/            rutas: login, (app)/proyectos/[slug]/*, admin, presentacion/[token], api/*
   ├─ components/     viewer, inventory, quote, compare, crm, dashboard, presentation, settings, admin, ui
   ├─ server/         routers tRPC, servicios de inventario, bus de eventos
   ├─ lib/            dominio, motor de precios, motor de cotización, utilidades
   └─ hooks/          tiempo real, hidratación, rol de sesión
```

## Módulos

- **Visor 3D** (`/proyectos/[slug]`): torre por torre, coloreado por estado / tipología / precio, corte por piso, pila de pisos, selección y deep link `?unit=`. Admite GLB propio con la convención `T1_P12_U04` o torre paramétrica automática.
- **Inventario**: tabla filtrable con cambio de estado, exportación a Excel y ficha de apartamento con historial de auditoría.
- **Cotizador**: variantes, descuento, subsidio, cuota inicial y crédito; versiones guardadas, PDF de marca y envío por WhatsApp/correo.
- **Comparador**: hasta 4 unidades lado a lado con mejores valores resaltados.
- **CRM**: pipeline kanban por etapa, compradores, tareas, documentos, separaciones con vencimiento, conversión a venta y escrituración. El bloqueo de unidades es transaccional (no hay doble venta).
- **Modo presentación** (`/presentacion/[token]`): enlace público con bloques configurables (portada, ubicación, amenidades, tipologías, visor 3D, inventario en vivo, comparador, cotizador público, galería, constructora, cierre). Navegación por teclado y pantalla completa.
- **Dashboard gerencial**: absorción, valor vendido/disponible, ventas por mes, embudo, desempeño por asesor, separaciones por vencer.
- **Configuración por proyecto**: datos, reglas de precio (piso, vista, posición, tipología) con recálculo masivo, modelo 3D, medios y auditoría.
- **Administración**: usuarios y roles, asistente de 5 pasos para crear un proyecto completo (tipologías, torres, matriz por piso, reglas de precio) que genera el inventario y la presentación por defecto.

## Pipeline 3D

Ver [`docs/pipeline-3d.md`](docs/pipeline-3d.md): convención de nombres, exportación desde Revit/SketchUp/Blender,
optimización con `npm run model:optimize` y validación contra el inventario con `npm run model:validate`.
El GLB resultante se sube a object storage (R2/S3) y la URL se registra en *Configuración → Modelo 3D*.

## Despliegue en Render

El repositorio incluye [`render.yaml`](render.yaml) (web service Node + PostgreSQL).

1. Sube el repositorio a GitHub/GitLab y en Render elige **New → Blueprint**.
2. Render crea la base `plataforma-db` y el servicio `plataforma-inmobiliaria`; `DATABASE_URL` y `AUTH_SECRET` se inyectan automáticamente.
3. Completa las variables marcadas `sync: false` (contraseñas del seed; opcionalmente las de object storage).
4. Para el **primer** despliegue pon `SEED_ON_DEPLOY=1`: el pre-deploy aplica el esquema (`prisma db push`) y siembra Nórtiko sólo si la base está vacía. Después vuelve a `0`.
5. El servidor escucha en `0.0.0.0:$PORT`; el health check es `/login`.

Consideraciones de la plataforma:

- El filesystem de Render es efímero: GLB, renders y PDFs deben vivir en object storage o URLs externas; la BD guarda sólo la URL.
- Los eventos en tiempo real usan un bus en memoria, válido para una instancia. Para escalar horizontalmente sustituye `src/server/events.ts` por Redis Pub/Sub o un servicio tipo Pusher.
- Los nombres de archivo son sensibles a mayúsculas en Linux.

## Integración continua

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) ejecuta en cada push/PR: lint, typecheck, pruebas unitarias,
build de producción y smoke E2E sobre SQLite sembrado.

## Capacitación rápida (sala de ventas)

1. **Abrir la presentación**: botón *Modo sala de ventas* o el QR desde *Presentación*. Flechas / barra espaciadora para avanzar, `G` cuadrícula, `F` pantalla completa.
2. **Mostrar el proyecto en 3D**: clic en un apartamento para ver ficha y precio; colorear por estado o precio; corte por piso para ver plantas.
3. **Cotizar**: desde el visor o la ficha, botón *Cotizar*; ajustar cuota inicial y plazo; *Guardar cotización* → *Descargar PDF* o *Enviar por WhatsApp*.
4. **Separar**: en la ficha del apartamento, *Separar* (monto y vencimiento). El inventario y la presentación se actualizan en vivo para todo el equipo.
5. **Seguimiento**: en CRM mover al comprador de etapa, agregar tareas y documentos; el gerente reasigna asesores y revisa el dashboard.
6. **Nuevo proyecto**: *Administración → Nuevo proyecto*; después subir el GLB y los renders en *Configuración*.
