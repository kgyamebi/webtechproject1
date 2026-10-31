# Course concepts

This file maps the code that exists to the web technologies in the brief. It does not claim topics the application does not demonstrate.

## Web architecture

The browser renders React components. Data changes happen on the server. `src/app/workspace/page.tsx` is a Server Component: it reads the session and the membership before HTML is sent. Forms such as `src/components/auth/register-form.tsx` are Client Components because they track pending and field errors. The split is the client/server boundary.

`src/proxy.ts` runs before the route. It demonstrates a server layer in front of the pages. The comments in that file explain why a cookie check is not the real authorization step.

## HTTP

- `GET /` returns the public home page.
- `POST` server actions handle registration, sign-in, profile updates, and deletion. Next.js sends those as HTTP requests to the application.
- `GET` and `POST /api/auth/*` are Better Auth's handlers (`src/app/api/auth/[...all]/route.ts`).
- `GET /api/account/export` returns JSON with `Content-Disposition: attachment` and `Cache-Control: no-store`.
- `GET /api/media/avatar/[userId]` returns image bytes or `404`.
- Unauthenticated export returns `401`.
- Missing pages use `not-found.tsx`.

## REST and JSON

The export route is a small REST resource: a `GET` for the signed-in user's own record, JSON in the body, and an error status when the session is missing. Better Auth's `/api/auth` routes are the authentication API. The application does not invent a second parallel API for the same actions.

## Asynchronous JavaScript

Server actions and route handlers are `async`. They `await` Prisma and Better Auth. The registration action redirects only after the user row and the profile row have been handled. The development mailbox page `await`s the latest messages.

## Frontend framework

React 19 components, `useActionState` for forms, and a small design system under `src/components/ui`. Tailwind tokens live in `src/app/globals.css`. Radix supplies dialog, menu, and tab behaviour. `prefers-reduced-motion` shortens animation. Focus styles use `:focus-visible`.

## Server-side logic

Validation for accounts is in `src/server/identity/schemas.ts`. Age, affiliation, and contact rules are in `src/server/identity/policy.ts`. Discovery, Quiet Connect, and friendship decisions are in `src/server/social/rules.ts`. Quiz scoring, late submissions, grade visibility, and audience checks are in `src/server/academic/rules.ts`. The server actions call those functions before they write. A failed rule does not rely on the browser.

## Databases

PostgreSQL tables, primary keys, foreign keys, unique constraints, and a transaction around profile affiliation changes are described in [DATABASE_DESIGN.md](DATABASE_DESIGN.md). Prisma Client is created once in `src/server/db/client.ts` and reused so development hot reload does not open a new pool on every save.

## Security

Sessions, password hashing, rate limits, file-signature checks, and open-redirect handling are described in [SECURITY.md](SECURITY.md). Those are the security topics this stage actually implements.

## Content management

Posts, comments, stories, course materials, and announcements are stored as plain strings and rendered as React text, so they are not injected as HTML. Materials and event links are accepted only as `http` or `https` URLs.

## Software engineering

Modules have one job. The feature register records what is done. Migrations are the change history for the database. Seed data is synthetic and named as such.

## Testing

Unit tests cover age, affiliation, discovery, Quiet Connect, quiz scoring, and grade release. A database test covers the friend-request action and simulated-course deletion when PostgreSQL is reachable. See [TESTING.md](TESTING.md).
