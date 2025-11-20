# GGI Backend Test

Backend service for the GGI test project, implementing an AI chat API and subscription bundles with clean architecture.

## Overview

This backend exposes:

- **Chat API** simulating AI responses, tracking free usage and subscription-based quotas.
- **Subscription API** for creating, canceling, and billing subscription bundles.

The implementation focuses on:

- Clear separation of concerns (domain, application, infrastructure, interface).
- Testable, framework-agnostic domain logic.
- Fastify-based HTTP interface with Zod validation.

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript (strict mode)
- **Framework:** Fastify
- **ORM:** Prisma (PostgreSQL)
- **Validation:** Zod
- **Testing:** Vitest
- **Linting/Formatting:** ESLint + Prettier

## Architecture

The codebase follows a Clean Architecture / Hexagonal-style layout:

- `src/core/`
  - Cross-cutting concerns and base types, e.g. `DomainError`.
- `src/modules/`
  - Feature modules (`chat`, `subscriptions`).
  - Each module is split into four layers:
    - `domain/` – Entities, value objects, domain services, repositories (interfaces only).
    - `application/` – Use cases (orchestrate domain and repositories, no framework code).
    - `infrastructure/` – Technical adapters (Prisma repositories, DB persistence).
    - `interface/http/` – Fastify route handlers, validation, HTTP-specific concerns.
- `src/server/`
  - `app.ts` Fastify app wiring, route registration, global error handler.
  - `index.ts` bootstraps the HTTP server.

Domain and application layers do **not** depend on Fastify or Prisma directly – they only depend on TypeScript interfaces and `DomainError`. Infrastructure and HTTP layers depend on these abstractions.

## Setup

### Prerequisites

- Node.js (LTS)
- PostgreSQL instance (local or remote)

### Install dependencies

```bash
npm install
```

### Environment variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Update `DATABASE_URL` to point to your PostgreSQL database, and (optionally) `PORT`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/gci_backend?schema=public"
PORT=3000
```

## Database & Migrations

Prisma is configured under `prisma/`:

- `prisma/schema.prisma` – database schema and models (`User`, `ChatMessage`, `MonthlyUsage`, `SubscriptionBundle`).
- `prisma.config.ts` – Prisma configuration with migration path and datasource.

Generate migrations and apply them to your database:

```bash
# Create and apply migrations (interactive)
npx prisma migrate dev --name init

# Regenerate Prisma client (if schema changes)
npx prisma generate
```

> Note: `prisma migrate dev --create-only` can be used to generate SQL without applying it.

## Running the Server

### Development

```bash
npm run dev
```

This uses `ts-node-dev` to run `src/server/index.ts` with auto-reload.

### Production build

```bash
npm run build
npm start
```

- `npm run build` – compiles TypeScript into `dist/`.
- `npm start` – runs `dist/server/index.js`.

Health checks:

- `GET /` – simple HTML landing page.
- `GET /health` – API health.
- `GET /chat/health`
- `GET /subscriptions/health`

## Authentication (Mocked)

The API uses a simple header-based mock authentication:

- **Header:** `x-user-id`
- If missing or empty, requests fail with `400` and error code `VALIDATION`.

There is no real auth/identity provider; `x-user-id` is treated as the user key for usage and subscriptions.

## REST API Endpoints

### Chat

#### `POST /chat/ask`

Simulate an AI answer, enforcing monthly free and subscription quotas.

- **Headers:**
  - `x-user-id: <string>` (required)
- **Body:**
  ```json
  { "question": "What is the GGI backend test?" }
  ```
- **Response:**
  ```json
  {
    "answer": "Mocked AI answer: What is the GGI backend test?",
    "tokenCount": 21,
    "usageType": "free" | "bundle" | "enterprise",
    "bundleId": "..." // present for bundle/enterprise usage
  }
  ```

#### `GET /chat/usage`

Return per-user usage summary for the current month.

- **Headers:**
  - `x-user-id: <string>` (required)
- **Response:**
  ```json
  {
    "monthKey": "2025-11",
    "free": { "quota": 3, "used": 1, "remaining": 2 },
    "bundles": [
      {
        "id": "sub_123",
        "tier": "BASIC",
        "maxMessages": 1000,
        "remainingMessages": 997
      }
    ]
  }
  ```

### Subscriptions

#### `POST /subscriptions`

Create a new subscription bundle for the current user.

- **Headers:**
  - `x-user-id: <string>` (required)
- **Body:**
  ```json
  {
    "tier": "BASIC",         // BASIC | PRO | ENTERPRISE
    "billingCycle": "MONTHLY", // MONTHLY | YEARLY
    "maxMessages": 1000,      // null for unlimited
    "price": 19.99,
    "autoRenew": true,
    "startDate": "2025-11-01T00:00:00.000Z" // optional
  }
  ```
- **Response:** `201 Created` with the domain subscription bundle representation.

#### `POST /subscriptions/:id/cancel`

Cancel an active subscription.

- **Headers:**
  - `x-user-id: <string>` (required)
- **Response:** `200 OK` with updated subscription entity.

Domain errors:

- `SUBSCRIPTION_NOT_FOUND` → `404`.
- `SUBSCRIPTION_USER_MISMATCH` → `500` by default (can be later mapped to 403).

#### `POST /subscriptions/billing/run`

Run a billing cycle for all subscriptions due for billing.

- **Response:**
  ```json
  {
    "successful": [ /* updated subscriptions */ ],
    "failed": [
      {
        "subscription": { /* subscription state */ },
        "reason": "Simulated payment failure"
      }
    ]
  }
  ```

## Error Handling

All errors are normalized into:

```json
{
  "error": {
    "code": "QUOTA_EXCEEDED | VALIDATION | ...",
    "message": "...",
    "details": { "...": "..." } // optional
  }
}
```

Mapping examples:

- `QUOTA_EXCEEDED` → `429` (rate/usage limit).
- `VALIDATION` → `400`.
- `*NOT_FOUND*` → `404`.
- Default → `500`.

## Testing

### Commands

- Run all tests:

  ```bash
  npm test
  ```

- Watch mode:

  ```bash
  npm run test:watch
  ```

### Coverage

Current tests include:

- **ChatUsageService**
  - Free quota behavior and month reset.
  - Bundle selection (highest remaining quota).
  - Enterprise unlimited handling (no counter increment).
  - `QUOTA_EXCEEDED` error when no quota remains.
- **BillingService**
  - Successful renewal advances period and keeps subscription active.
  - Failed renewal marks subscription as past due and disables auto-renew.
- **Integration (domain level)**
  - Create subscription → Ask questions → free quota exhausted → subsequent question consumes bundle quota.

Tests use **in-memory repositories** and do not require a real database.

## Linting & Formatting

- Lint:

  ```bash
  npm run lint
  ```

- Format (via Prettier, recommended):

  ```bash
  npx prettier "src/**/*.ts" --write
  ```

Ensure that before committing you:

1. Run `npm run build` (TypeScript build).
2. Run `npm test` (Vitest suite).
3. Optionally run `npm run lint` and Prettier to keep code style consistent.

