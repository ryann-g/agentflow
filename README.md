# AgentFlow

> The CRM built exclusively for real estate professionals — manage your pipeline, automate follow-ups, and close more deals from any device.

[![Status](https://img.shields.io/badge/status-live-brightgreen)](https://agent-flow.app)
[![License: BUSL 1.1](https://img.shields.io/badge/License-BUSL_1.1-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)

---

## What is AgentFlow?

AgentFlow is a lightweight, mobile-first CRM designed specifically for independent real estate agents and small brokerages. Most CRM platforms are built for large sales teams and come loaded with complexity agents don't need. AgentFlow strips that away and focuses on what actually moves deals forward: knowing who to follow up with, and when.

**Built for agents in the field, not behind a desk.**

---

## Features

### Lead Pipeline
Manage every lead through a clean, six-stage pipeline — from first contact to closed deal. Move leads between stages in one tap and track conversion across your entire funnel.

### Smart Follow-ups
Never miss a follow-up again. AgentFlow sends a daily digest to your inbox every morning with a prioritized view of overdue, today's, and upcoming actions.

### One-Click Client Actions
Call, text, email, or schedule a meeting directly from a lead's profile — no copy-pasting, no switching apps.

### CSV Import
Bring your existing leads in instantly. AgentFlow automatically detects and maps your CSV columns so you're up and running in minutes.

### Mobile-First & Installable
Fully optimized for mobile with a bottom navigation bar and 44px touch targets. Install it directly to your home screen as a Progressive Web App (PWA) with offline support.

### Secure by Default
Passwordless sign-in via Magic Link or Google OAuth — no passwords to manage or leak. Every user's data is strictly isolated at the database level.

---

## Pricing

| Plan | Price | Leads |
|---|---|---|
| **Free** | $0 / month | 10 active leads |
| **Pro** | $8 / month | Unlimited leads, pipelines & custom branding |

[→ Get started at agent-flow.app](https://agent-flow.app)

---

## Tech Stack

AgentFlow is built on a modern, production-grade stack:

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS 3.4 |
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth (Magic Link + Google OAuth) |
| Payments | PayMongo |
| Email | Resend |
| Testing | Vitest (84 tests, 99%+ coverage) + Playwright (E2E) |
| CI/CD | GitHub Actions (4-stage automated pipeline) |
| Hosting | Vercel + Supabase Cloud |
| PWA | Service worker with offline caching |

---

## Security

AgentFlow is designed with a security-first approach. User data is strictly isolated at the database level — no user can ever access another user's data. All authentication is passwordless, sensitive credentials are never exposed to the client, and all payment events are cryptographically verified before processing.

---

## Documentation

Comprehensive developer documentation lives in [`docs/`](./docs/README.md):

**Getting started**
- [**Onboarding**](./docs/getting-started/onboarding.md) — first-time dev setup, common tasks, troubleshooting
- [**Environment Variables**](./docs/getting-started/environment-variables.md) — full env matrix and per-runtime topology

**Guides**
- [**Architecture**](./docs/guides/architecture.md) — high-level overview, stack, request lifecycle
- [**Authentication**](./docs/guides/authentication.md) — Supabase + middleware + Turnstile flow
- [**Database**](./docs/guides/database.md) — schema, RLS, plan enforcement, migrations
- [**API Reference**](./docs/guides/api-reference.md) — every route handler, error envelope, rate limiting
- [**Components & Hooks**](./docs/guides/components-and-hooks.md) — UI primitive and hook catalog
- [**Security**](./docs/guides/security.md) — defense-in-depth, CSP, headers, captcha, secret rotation
- [**Deployment**](./docs/guides/deployment.md) — CI/CD, Vercel, Supabase, PayMongo, Resend, Sentry
- [**Testing**](./docs/guides/testing.md) — Vitest + Playwright patterns, auth fixture
- [**PWA**](./docs/guides/pwa.md) — manifest, service worker, install prompt

**Architecture**
- [**Architecture Decision Records**](./docs/architecture/adr/README.md) — why the code looks the way it does
- [**Architecture Diagrams**](./docs/architecture/diagrams/) — Mermaid runtime flow diagrams

For new developers, start with [**Onboarding**](./docs/getting-started/onboarding.md). For the big picture, read [**Architecture**](./docs/guides/architecture.md).

---

## Support

Have a question, found a bug, or want to request a feature?

- **Email:** ryan.gabrielle01@gmail.com
- **Issues:** [GitHub Issues](https://github.com/dream-creator/agentflow/issues)

---

## License

This software is licensed under the [Business Source License 1.1 (BUSL 1.1)](LICENSE).

| Term | Meaning |
|------|---------|
| **Licensor** | AgentFlow |
| **Licensed Work** | AgentFlow CRM — all source code, assets, and configuration in this repository |
| **Permitted Use** | Viewing, local evaluation, and non-production use only |
| **Restricted Use** | Commercial use, production deployment, redistribution, and sublicensing |
| **Change Date** | Four (4) years from the release date of each version |
| **Change License** | MIT License |

### What You Can Do

- Read and review the source code for educational or evaluation purposes
- Run the software locally in a non-production, non-commercial environment
- Inspect the architecture for research or personal learning

### What You Cannot Do

Without explicit written permission from AgentFlow, you may not:

- Deploy or host this software for any production or commercial use
- Use this software to provide a competing or similar service to third parties
- Copy, modify, sublicense, or distribute any portion of this codebase
- Remove or alter any copyright, license, or proprietary notices
- Use the AgentFlow name, logo, or branding in any derivative or competing product
- Resell, relicense, or transfer access to this software to any third party

### Change Date & Open Source Conversion

Each released version of AgentFlow has a Change Date set to four (4) years after its release. On that date, the corresponding version automatically converts to the MIT License, becoming fully open source. This conversion applies only to that specific version — newer releases will carry their own Change Dates.

### Third-Party Licenses

AgentFlow is built on top of open-source dependencies. Each dependency is governed by its own license. Key dependencies and their licenses include:

| Dependency | License |
|------------|---------|
| Next.js | MIT |
| React | MIT |
| Tailwind CSS | MIT |
| Supabase JS Client | MIT |
| PayMongo JS | Apache 2.0 |
| Resend | MIT |
| Lucide React | ISC |
| Vitest | MIT |
| Playwright | Apache 2.0 |

A full list of dependencies and their licenses can be found in `package.json`. AgentFlow's BUSL 1.1 license applies solely to original source code authored by AgentFlow and does not override or modify the licenses of any third-party packages.

### Commercial Licensing & Enterprise Access

If you are interested in using AgentFlow in a commercial context, self-hosting it within your organization, or building on top of it under a separate agreement, commercial licenses are available.

Contact us to discuss terms:

- **Email:** [ryan.gabrielle01@gmail.com](mailto:ryan.gabrielle01@gmail.com)
- **Subject line:** Commercial License Inquiry — AgentFlow

We typically respond within 1–2 business days.

Copyright © 2026 AgentFlow. All rights reserved.

<!-- test: activity widget debug -->
