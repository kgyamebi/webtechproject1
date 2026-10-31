# Campus+

Learn together. Meet your people. Build your future.

Campus+ is a university project for an academic and social platform. The workspace includes discovery, friends, Random Connect, Quiet Connect, messages, posts, stories, communities, courses, assignments, quizzes, a gradebook, a calendar, events, opportunities, in-app notifications, and a simulated LMS import. The home page and [FEATURE_REGISTER.md](FEATURE_REGISTER.md) say which of those paths are fully tested and which are simulated.

## Stack

- Next.js 16 and React render the interface and the server actions.
- TypeScript keeps the data shapes explicit.
- Tailwind CSS holds the visual tokens.
- PostgreSQL stores the data. Prisma is the typed database client.
- Better Auth handles passwords, sessions, email verification, and password reset. Campus+ does not implement that cryptography.
- Vitest tests the business rules and, when PostgreSQL is reachable, the friend-request and simulated-import writes. Playwright checks the public home page and a signed-in walk through the workspace.

Supabase is not used. There are no Supabase credentials in this environment, and the project has to run in a viva without a cloud account. The reasons are written in [ARCHITECTURE.md](ARCHITECTURE.md).

## Run it locally

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set `BETTER_AUTH_SECRET` to at least 32 random characters.
3. Start PostgreSQL. `npm run db:up` uses Docker. If Docker cannot start, `npx prisma dev --detach --name campus-plus` starts a local server and prints a `DATABASE_URL`. Put that URL in `.env`.
4. Apply migrations: `npx prisma migrate deploy`
5. Load synthetic people and a sample course: `npm run db:seed`
6. Start the app: `npm run dev`
7. Open `http://localhost:3000`

The seed password for every synthetic account is `Campus-seed-2026`. These people are fictional. Do not point the seed script at a production database.

In development, verification and reset links are stored at `/dev/mailbox` when SMTP is not configured. That page returns 404 when `NODE_ENV` is production.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run test` | Unit tests |
| `npm run test:e2e` | Browser smoke test |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run build` | Production build |
| `npm run db:migrate` | Create and apply a Prisma migration |
| `npm run db:seed` | Insert synthetic institutions, people, one course, and sample campus rows |

## Read next

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DATABASE_DESIGN.md](DATABASE_DESIGN.md)
- [SECURITY.md](SECURITY.md)
- [COURSE_CONCEPTS.md](COURSE_CONCEPTS.md)
- [TESTING.md](TESTING.md)
- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)
- [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md)
- [FEATURE_REGISTER.md](FEATURE_REGISTER.md)
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- [SECURITY_AND_PRIVACY.md](SECURITY_AND_PRIVACY.md)
- [MODERATION_GUIDE.md](MODERATION_GUIDE.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
