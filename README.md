# Pocket Friend

[中文文档](README.zh-CN.md)

[![CI](https://img.shields.io/badge/CI-no_status-6b7280?style=flat&logo=github&logoColor=white)](https://github.com/3356153957/pocket-friend/actions)
[![node](https://img.shields.io/badge/node-%3E%3D22.18-339933?style=flat&logo=nodedotjs&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6?style=flat&logo=typescript&logoColor=white)](package.json)
[![React](https://img.shields.io/badge/React-19.2.3-149ECA?style=flat&logo=react&logoColor=white)](apps/mobile/package.json)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat&logo=vite&logoColor=white)](apps/mobile/package.json)
[![AMap](https://img.shields.io/badge/AMap-Web-00A1E9?style=flat)](apps/mobile/src/map)
[![npm](https://img.shields.io/badge/npm-workspaces-CB3837?style=flat&logo=npm&logoColor=white)](package.json)
[![tag](https://img.shields.io/badge/tag-%23adventurex2026-8A2BE2?style=flat&logo=github&logoColor=white)](https://github.com/3356153957/pocket-friend/releases/tag/%23adventurex2026)

Pocket Friend is a retro handheld-style web experience for an onsite companion-matching demo. Visitors answer a short magnet quiz, choose interest tags, create a small pixel profile, and enter a PALS page that can sync their profile to the onsite big-screen experience. The mobile MAP tab stays intentionally simple: it shows a pixel-island preview, while character movement and richer interactions belong to the venue display.

Tag: `#adventurex2026`

## Who It Is For

- Onsite visitors who need a quick, playful way to create their Pocket Friend profile.
- Demo operators who need a clear mobile flow that feeds the big-screen installation.
- Hackathon reviewers who want to understand the product experience, scope, and code layout quickly.
- Developers who want a small, testable TypeScript workspace with a web app, services, admin tooling, and shared matching logic.

## Main Features

- Three-question magnet quiz that derives one of four traits: Quiet Observer, Chatty Spark, Curious Explorer, or Easygoing Drifter.
- Interest-tag step after the quiz, keeping the profile flow lightweight while still requiring meaningful preferences.
- Profile and photo flow for producing a pixel portrait, with the experience standard centered on a compact `72px / 28c` avatar.
- PALS profile page for showing the visitor card, magnet trait, interests, and generated pixel portrait.
- Mobile MAP tab as a static pixel-island preview, matching the big-screen visual world without adding mobile character controls.
- Existing bottom navigation structure: `MAP`, `PALS`, and `SET`.
- Fake matching/demo logic preserved for a stable onsite walkthrough.
- Device-status admin service with basic auth, heartbeat reporting, board photo upload, photo history, and dedicated photo-read tokens.
- Production scripts for the static web experience and the independent admin service.

## Experience Flow

```text
Open Pocket Friend
  -> answer the 3-question magnet quiz
  -> receive a magnet trait
  -> choose at least 3 interest tags
  -> enter name and upload/capture a photo
  -> generate a pixel portrait
  -> view the PALS profile card
  -> keep demo matching behavior available
  -> open MAP for the pixel-island preview
  -> sync profile data to the onsite big-screen channel
```

## Product Boundaries

- The retro handheld pixel UI, bottom navigation, PALS card structure, SET page, photo flow, and demo matching behavior are preserved.
- The mobile MAP tab is a preview surface only; it does not implement character walking, hover states, or click interactions.
- Big-screen character movement and richer scene interactions are handled outside this mobile web experience.
- The public repository should document the reusable software experience without exposing private credentials, production data, or onsite-only secrets.

## Privacy

- Visitor photos taken during the demo are stored only on the self-hosted admin service and are never committed to this repository or sent to third parties beyond the configured pixelation provider.
- Photos are deleted automatically after `PF_PHOTO_RETENTION_DAYS` days (default deployment uses 7); operators can also delete them manually from the upload directory.
- Heartbeats record coarse client info (browser, OS, IP) solely to show device online status on the admin dashboard; nothing is used for tracking or profiling.
- Location sharing in the mobile demo stays in the browser session and is only used for the on-site proximity matching demo.

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
| Mobile web app | `apps/mobile` | Visitor-facing Pocket Friend software experience | `npm run dev:mobile` |
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

# Build and scan the credential-free Cloudflare Pages bundle
npm run build:cloudflare
```

## Credential-Free Cloudflare Pages Deployment

The public Cloudflare build uses Vite's `public-demo` mode. It replaces the product and photo clients with local-only modules, disables presence and AMap initialization, writes restrictive Pages headers, and scans the exact upload directory before deployment.

Build and scan locally:

```bash
npm run build:cloudflare
```

Authenticate with browser OAuth. Do not paste an API token into the repository, `.env`, command history, or Pages environment variables:

```bash
npx wrangler login
npx wrangler whoami
```

Deploy only the scanned directory:

```bash
npm run deploy:cloudflare
```

The public demo intentionally does not deploy backend services, Cloudflare Functions, Workers, databases, secrets, AMap credentials, AI generation credentials, device heartbeat, or photo storage. Bind a custom domain from the Pages project's **Custom domains** page after the default `pages.dev` address has been verified.

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
