# PropPilot · CRM inmobiliario con IA (frontend)

Frontend en Angular. La API está en [PropPilot-back](https://github.com/CristianCervera/PropPilot-back).

> El proyecto está dividido en dos repositorios. Para trabajar en local, clónalos uno junto al otro
> con estos nombres de carpeta, que son los que usan los comandos de este README:
>
> ```bash
> git clone git@github.com:CristianCervera/PropPilot.git frontend
> git clone git@github.com:CristianCervera/PropPilot-back.git backend
> ```

Gestión de inmuebles, clientes y visitas con IA integrada (Claude).

| Capa | Tecnología |
|---|---|
| Frontend | Angular 22 (standalone + signals), Tailwind CSS v4, Leaflet, Angular CDK |
| Backend | NestJS 12 (TypeScript, ESM), Drizzle ORM, validación con Zod |
| Base de datos | PostgreSQL. En desarrollo, **PGlite** (Postgres embebido, sin instalar nada) |
| IA | Claude Opus 5.5 vía `@anthropic-ai/sdk` |

## Funciones de IA

- **Copiloto** (Ctrl+K desde cualquier pantalla): agente con herramientas sobre el CRM. Busca inmuebles y clientes, cruza la cartera, revisa la agenda, agenda visitas y actualiza estados. Respuestas en streaming (SSE) y conversaciones guardadas.
- **Búsqueda en lenguaje natural**: «ático con terraza en Madrid por menos de 1M» se convierte en filtros.
- **Autocompletar ficha**: pegas las notas de captación o el email del propietario y la IA rellena el formulario.
- **Generador de anuncios** con análisis de fotos (visión), varios tonos e idiomas, y post para redes.
- **Valoración** a partir de comparables de la cartera, con rango, factores y recomendación.
- **Análisis de lead**: puntuación, temperatura, siguiente acción y mensaje de WhatsApp listo para enviar.
- **Matching** cliente ↔ inmueble y mensajes personalizados por WhatsApp o email.
- **Briefing diario** en el panel de inicio.

## Idiomas (español / inglés)

El selector **ES | EN** (barra lateral y pantalla de login) cambia el idioma al instante, sin recargar.
Se recuerda en el navegador y, la primera vez, se usa el idioma del navegador.

- **Frontend**: `frontend/src/app/core/i18n.ts` (servicio, pipes `t`, `td` y `d`) y los diccionarios
  `core/i18n/es.ts` / `en.ts`. `en.ts` está tipado contra `es.ts` y las plantillas usan
  `strictTemplates`, así que una clave que falte o esté mal escrita rompe la compilación.
- **Backend**: el frontend envía `X-Lang` en cada petición. Errores, motivos del matching y todas
  las respuestas de la IA (copiloto incluido) llegan en ese idioma (`backend/src/common/i18n.ts`).
  El anuncio generado usa el idioma elegido en su propio selector.
- Los datos que introduce la agencia (títulos, descripciones, notas) no se traducen. Lo que la IA
  ya guardó (valoraciones, resúmenes de clientes) queda en el idioma en que se generó.

Para añadir un idioma: crea `core/i18n/<código>.ts` con las mismas claves, añádelo a `LANGS` y
`LOCALES` en `i18n.ts` y registra su `locale` de Angular.

## Puesta en marcha

```bash
# 1. Backend (http://localhost:3000/api)
cd backend
npm install
cp .env.example .env        # añade tu ANTHROPIC_API_KEY
npm run start:dev           # en WSL sobre /mnt/c usa: npm run start:dev:wsl

# 2. Frontend (http://localhost:4200)
cd frontend
npm install
npm start                   # en WSL sobre /mnt/c usa: npm run start:wsl
```

La primera vez se crea la base de datos en `backend/.data/pglite` con datos de demostración.
Acceso: **admin@proppilot.dev / proppilot**.

Sin `ANTHROPIC_API_KEY` todo el CRM funciona y las funciones de IA muestran un aviso.

### PostgreSQL real (producción)

Define `DATABASE_URL=postgres://…` en `backend/.env`. Las migraciones (`backend/drizzle/`) se aplican al arrancar.
Si cambias `src/db/schema.ts`, genera una migración con `npm run db:generate`.

## Tests

```bash
cd backend
npm test              # unitarios: matching, validación, auth, Claude (sin red)
npm run test:e2e      # integración: API completa sobre PGlite en memoria + seed
npm run test:all      # ambos

cd frontend
npm run test:ci       # Vitest + jsdom (npm test lo deja en modo watch)
```

Los tests no llaman a Claude ni necesitan `ANTHROPIC_API_KEY`: los de IA usan un Claude
simulado que devuelve respuestas guionizadas, incluido el bucle del copiloto con herramientas
y streaming SSE. Cada fichero e2e arranca la API con su propia base de datos en memoria
(`PGLITE_DIR=memory://`), así que no tocan `backend/.data`.

## Estructura

```
backend/src
  ai/            Claude: búsqueda, anuncios, valoración, insights, briefing
  ai/copilot/    agente con herramientas + streaming SSE
  properties/ clients/ visits/ dashboard/ matching/ auth/
  db/            esquema Drizzle, conexión (Postgres/PGlite) y seed
frontend/src/app
  core/          API, auth, modelos, formato
  shared/        iconos, tarjetas, modal, markdown, toasts
  layout/        shell con barra lateral y panel del copiloto
  features/      dashboard, properties, clients, agenda, copilot, login
```
