# Pocket Friend

[中文文档](README.zh-CN.md)

Pocket Friend is a small web experience for nearby companion matching. It presents the product as a phone-style app: users complete a short onboarding flow, choose their vibe and interests, see nearby matches on a map, and keep a lightweight presence heartbeat for the device-status admin panel.

Tag: `#adventurex2026`

## Who It Is For

- Teams exploring lightweight social matching around a physical pendant or companion device.
- Hackathon reviewers who want to run the demo quickly and understand the project structure.
- Developers who want a small, testable TypeScript workspace with a web app, service endpoints, admin tooling, and shared matching logic.

## Main Features

- Mobile-style Pocket Friend prototype with onboarding, preference quiz, matching map, home, and settings tabs.
- Nearby matching model with distance privacy, shared-interest explanations, and simulated demo players.
- Browser location sampling with accuracy-aware fallbacks.
- AMap-based map rendering with satellite/standard layer switching and accessible marker selection.
- Device-status admin service with basic auth, heartbeat reporting, board photo upload, photo history, and dedicated photo-read tokens.
- Lightweight gateway service for backend location and service integrations.
- Production scripts for static web deployment and the independent admin service.

## Quick Start

Install Node.js `>=22.18`, then install dependencies:

```bash
npm install
```

Create local environment values:

```bash
cp .env.example .env
```

Run the mobile web app:

```bash
npm run dev:mobile
```

Run the backend services when needed:

```bash
npm run dev:gateway
npm run dev:admin
```

## Project Layout

```text
apps/mobile/          Vite + React Pocket Friend web app
apps/gateway/         Node.js gateway service
apps/admin/           Device-status and photo admin service
packages/nearby-core/ Shared location, matching, distance, and presence logic
scripts/              Build and deployment helpers
ops/                  Production service and static-server assets
docs/                 Project notes and implementation plans
```

## Services

| Service | Path | Purpose | Default command |
| --- | --- | --- | --- |
| Mobile web app | `apps/mobile` | User-facing Pocket Friend prototype | `npm run dev:mobile` |
| Gateway | `apps/gateway` | Backend integration gateway and health endpoint | `npm run dev:gateway` |
| Admin | `apps/admin` | Device heartbeat, board photo upload, status dashboard | `npm run dev:admin` |
| Shared core | `packages/nearby-core` | Pure domain logic used by app and tests | covered by `npm test` |

## Environment

Public browser values:

- `EXPO_PUBLIC_AMAP_KEY`
- `EXPO_PUBLIC_AMAP_SECURITY_JS_CODE`
- `VITE_ADMIN_URL`

Gateway-only values:

- `PF_ALLOWED_ORIGIN`
- `PORT`

Admin-only values:

- `ADMIN_HOST`
- `ADMIN_PORT`
- `PF_ADMIN_USERNAME`
- `PF_ADMIN_PASSWORD`
- `PF_DEVICE_HEARTBEAT_TOKEN`
- `PF_WEB_ORIGIN`

Keep real secrets out of Git. `.env` is ignored; `.env.example` should only contain placeholders.

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
- `@types/react`: React type definitions shared across workspaces.

`@pf/mobile`:

- `react`: UI component model.
- `react-dom`: browser rendering for React.
- `@amap/amap-jsapi-loader`: browser loader for the AMap JavaScript API.
- `lucide-react`: icon set used by the interface.
- `vite`: development server and production build pipeline.
- `@vitejs/plugin-react`: React support for Vite.
- `tailwindcss`: utility-first CSS styling.
- `@tailwindcss/vite`: Tailwind integration for Vite.
- `@amap/amap-jsapi-types`: TypeScript definitions for AMap.
- `@types/react-dom`: React DOM type definitions.

`@pf/gateway`, `@pf/admin`, and `@pf/nearby-core`:

- No external runtime libraries. They use Node.js built-ins, built-in web APIs, and TypeScript executed with `node --experimental-strip-types`.

## Common Commands

```bash
# Run all unit and contract tests
npm test

# Run deployment-script tests
npm run test:deploy

# Check TypeScript project references
npm run typecheck

# Build the mobile web app
npm run build:web

# Build and prepare the static site bundle
npm run build:sites
```

## Public Repository Boundaries

This repository is meant to be safe to share. Do not commit:

- Real `.env` files or local credentials.
- API keys, passwords, tokens, private keys, or certificates.
- Personal location data, uploaded photos, logs, or production database files.
- Machine-specific deployment notes that expose hostnames, IPs, or secrets.

## Deployment

The repository includes GitHub Actions and Node.js deployment helpers for the production mobile site and the admin service:

- `.github/workflows/deploy-production.yml`
- `scripts/deploy-production.mjs`
- `scripts/deploy-admin.mjs`
- `ops/`

