# Architecture

Campus+ is a modular monolith. One Next.js application talks to one PostgreSQL database. There are no microservices, no extra databases, and no message bus. That keeps the request path short enough to explain in a project viva.

## Why this stack

| Choice | Reason |
| --- | --- |
| Next.js App Router | Pages, server actions, and route handlers live in one project. The browser does not receive database credentials. |
| Better Auth | Established library for email and password, database sessions, verification, and reset. Auth.js v5 is still a beta, and its maintainers recommend Better Auth for new projects. |
| Prisma 7 and PostgreSQL 16 | Relational data, migrations, and typed queries. PostgreSQL runs in Docker for local development. |
| Zod | Server-side validation with messages a person can act on. |
| Radix UI | Dialogs, menus, and tabs handle keyboard focus so the design system does not rebuild those behaviours. |
| Vitest and Playwright | Fast tests for rules, and a browser test for the public home page. |

Supabase Auth and Storage are listed in the product brief as an option. They are not configured here. Introducing them would require a hosted project, keys, and a network dependency during the viva. Local PostgreSQL and Better Auth meet the same product requirements for this stage. File uploads use a local `storage/` directory behind a route handler. That directory is an adapter boundary: a later object store can replace `src/server/media/storage.ts` without changing the profile form.

## Request path

```
Browser
  |  HTML form or fetch
  v
Next.js proxy (cookie present or not; not a security check)
  |
  v
Server Component or Server Action
  |  auth.api.getSession reads the session from PostgreSQL
  v
Policy functions in src/server/identity/policy.ts
  |
  v
Prisma
  |
  v
PostgreSQL
```

The proxy in `src/proxy.ts` only redirects when the session cookie is missing. A person can invent a cookie. Workspace pages therefore call `auth.api.getSession` before they render private information, and every mutation does the same.

## Folders

| Path | Responsibility |
| --- | --- |
| `src/app` | Routes, layouts, and HTTP handlers |
| `src/components` | Visual components. They do not query the database. |
| `src/server/identity` | Registration, profile, privacy, and affiliation rules |
| `src/server/connect` | Random Connect eligibility, ranking, queue, and chat |
| `src/app/api/connect` | Server-sent events for the queue and an open chat |
| `src/server/media` | Image signature checks and file storage |
| `src/server/email` | SMTP, or the development mailbox |
| `src/server/db` | One shared Prisma client |
| `src/lib/auth.ts` | Better Auth configuration |
| `prisma` | Schema, migrations, and synthetic seed data |
| `tests/unit` | Rules that do not need PostgreSQL |
| `tests/e2e` | Browser journeys |

## Random Connect

Random Connect is a queue and a two-person chat for adults. It does not replace Quiet Connect or friend messages.

The browser opens `EventSource` on `/api/connect/queue/stream` while someone is waiting, and on `/api/connect/session/[id]/stream` during a chat. The server checks the session, then polls PostgreSQL about once a second and writes `text/event-stream` lines. This is server-sent events. It is not a WebSocket. Next.js route handlers in this app do not accept a WebSocket upgrade.

A match is created in one database transaction. Each person gets a `ConnectHold` row whose primary key is their user id, so a second active chat for the same person fails and the transaction rolls back. The engine then says the person is still waiting. It does not invent a partner.

Hard rules run before the score. The score adds weight for shared interests, subjects, career tags, project goals, and the same typed language. `pickWeighted` can still choose a lower score. The number is not a compatibility claim.

Voice and video run through a separate process, `npm run media`. That process checks a short-lived ticket, forwards call setup over a WebSocket, and relays media with TURN when a direct path is blocked. A Connect room keeps at most four people. A course room lets four people speak and twenty-four listen, and it does not store the call. Chat text still uses server-sent events. If the media process is stopped, the conversation stays text and the screen says so.

## Configuration

Development, test, and production are separated by environment variables, not by separate codebases. See [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md). The production build must set `NODE_ENV=production`, a real `BETTER_AUTH_SECRET`, and SMTP if verification email has to leave the machine.
