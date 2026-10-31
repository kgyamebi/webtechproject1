# Deployment

Random Connect ships inside the Campus+ Next.js app. It does not add a second service.

## Before a public host

1. Create an empty PostgreSQL database. Do not point it at `npx prisma dev`.
2. Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` on that host. See [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md).
3. Raise the pool size in `src/server/db/client.ts`. The value is `1` so the local Prisma Dev proxy does not mix prepared statements. A normal server can use a larger pool. This project has not been load-tested, so do not treat a larger pool as proof of campus-scale capacity.
4. Run `npx prisma migrate deploy`. The Random Connect migration is `20261029180000_random_connect`.
5. Skip `npm run db:seed` on a real campus. The seed is fictional.
6. Set SMTP if people must receive verification mail.
7. Build with `npm run build` and start with `npm run start`.

## What you do not need to configure

There is no WebSocket service and no voice or video vendor. Those features are absent on purpose. Adding a vendor later means new environment variables, a server-side token, and a test that a real call connects. Do not substitute a recorded video.

## Backup

Back up the PostgreSQL database. Chat messages and moderation notes are in that database. Uploaded images and files are in `storage/` and are not part of the database backup.

## If matching fails locally

`GET /api/health` returns 503 when PostgreSQL is down. Start it again with `npx prisma dev --detach --name campus-plus` and put the printed URL in `.env` if the port changed. Then run `npx prisma migrate deploy`.
