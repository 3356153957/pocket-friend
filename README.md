# Pocket Friend

Pocket Friend is a web demo for a nearby companion matching experience. It includes a Vite/React mobile-style client, a lightweight location gateway, an independent device-status admin console, and shared matching/domain logic.

Tag: `#adventurex2026`

## What It Contains

- `apps/mobile`: the user-facing Pocket Friend prototype, rendered as a phone-style web app with onboarding, preference quiz, map-based matching, settings, and heartbeat reporting.
- `apps/gateway`: a small Node.js HTTP gateway for optional Jacoo location integration.
- `apps/admin`: a protected device-status and photo admin service for web clients and board devices.
- `packages/nearby-core`: shared nearby matching primitives and testable domain logic.
- `scripts`: production/admin deployment helpers and deployment tests.
- `docs`: project notes, implementation plans, and photo pixelation automation docs.

## Tech Stack

- Node.js `>=22.18`
- npm workspaces
- TypeScript
- Vite
- React
- Tailwind CSS
- AMap JavaScript API

## Libraries Used

Root workspace:

- `typescript`: TypeScript compiler and project references.
- `@types/node`: Node.js type definitions.
- `@types/react`: React type definitions shared by the workspace.

`@pf/mobile`:

- `react`: UI component model.
- `react-dom`: browser rendering for the React app.
- `@amap/amap-jsapi-loader`: loads the AMap JavaScript API in the browser.
- `lucide-react`: icon set used by the web UI.
- `vite`: local dev server and web build pipeline.
- `@vitejs/plugin-react`: React support for Vite.
- `tailwindcss`: utility-first CSS styling.
- `@tailwindcss/vite`: Tailwind integration for Vite.
- `@amap/amap-jsapi-types`: TypeScript definitions for AMap.
- `@types/react-dom`: React DOM type definitions.

`@pf/gateway`:

- No external runtime libraries. It uses Node.js built-in web APIs and `node --experimental-strip-types`.

`@pf/admin`:

- No external runtime libraries. It uses Node.js built-ins, including `node:crypto`, plus built-in web APIs.

`@pf/nearby-core`:

- No external runtime libraries.

## Getting Started

Install dependencies:

```bash
npm install
```

Copy environment defaults and fill in local values:

```bash
cp .env.example .env
```

Run the mobile web app:

```bash
npm run dev:mobile
```

Run the optional location gateway:

```bash
npm run dev:gateway
```

Run the admin service:

```bash
npm run dev:admin
```

## Environment Variables

Public mobile/browser values:

- `EXPO_PUBLIC_AMAP_KEY`
- `EXPO_PUBLIC_AMAP_SECURITY_JS_CODE`
- `VITE_ADMIN_URL`

Gateway-only values:

- `PF_ENABLE_JACOO`
- `JACOO_BASE_URL`
- `JACOO_API_KEY`
- `PF_ALLOWED_ORIGIN`
- `PORT`

Admin-only values:

- `ADMIN_HOST`
- `ADMIN_PORT`
- `PF_ADMIN_USERNAME`
- `PF_ADMIN_PASSWORD`
- `PF_DEVICE_HEARTBEAT_TOKEN`
- `PF_WEB_ORIGIN`

Do not commit real secrets. `.env` is intentionally ignored.

## Useful Commands

```bash
npm test
npm run test:deploy
npm run typecheck
npm run build:web
npm run build:sites
```

## Deployment

The repository includes GitHub Actions and Node deployment helpers for the production mobile site and the admin service. See:

- `.github/workflows/deploy-production.yml`
- `scripts/deploy-production.mjs`
- `scripts/deploy-admin.mjs`
- `ops/`

