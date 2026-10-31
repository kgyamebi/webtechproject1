# Environment variables

Copy `.env.example` to `.env`. Never commit `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. Local Docker default is `postgresql://campus:campus@localhost:5432/campus_plus`. |
| `BETTER_AUTH_SECRET` | Yes | At least 32 characters. Used by Better Auth for signing and hashing. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. |
| `BETTER_AUTH_URL` | Yes | Public base URL, `http://localhost:3000` in development. |
| `SMTP_HOST` | No | When set, auth email is sent with Nodemailer. When empty in development, the message is stored for `/dev/mailbox`. |
| `SMTP_PORT` | No | Defaults to `587`. |
| `SMTP_SECURE` | No | `true` for TLS from the start. |
| `SMTP_USER` | No | SMTP username, if the server requires auth. |
| `SMTP_PASSWORD` | No | SMTP password. |
| `SMTP_FROM` | No | From address. Defaults to a local Campus+ sender. |
| `MEDIA_SECRET` | No | At least 16 characters. Signs call tickets and TURN passwords. When empty, voice and video stay unavailable. |
| `MEDIA_PUBLIC_HOST` | No | Address browsers use to reach the media process. Defaults to `127.0.0.1`. |
| `MEDIA_PORT` | No | Media process HTTP and WebSocket port. Defaults to `3001`. |
| `MEDIA_TURN_PORT` | No | TURN port. Defaults to `3478`. |

## Environments

- Development uses `.env` and either Docker or `npx prisma dev`. Auth mail uses the development mailbox when SMTP is empty.
- Rule tests do not need a database. `database-flow.test.ts` and `connect-flow.test.ts` use `DATABASE_URL` and skip when the tables they need are missing.
- Voice and video use `MEDIA_SECRET` on the server. The browser receives a short-lived ticket and a short-lived TURN username, not the secret. Run `npm run media` beside the app. A public campus needs `MEDIA_PUBLIC_HOST` set to an address those browsers can reach, with UDP open for the TURN port and the relay range 49152–49252.
- Production needs its own hosted `DATABASE_URL`, its own `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` set to the public `https` origin, `NODE_ENV=production`, and SMTP if people must receive verification mail. Do not deploy the development mailbox, and do not point production at `npx prisma dev`.

The Docker password `campus` is for the local container only. It is not a production credential.

## Before you deploy

1. Create an empty PostgreSQL database on the host you will use.
2. Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` in that host's environment. Do not copy `.env` into the repository.
3. Run `npx prisma migrate deploy` against that database.
4. Run the seed only if you want the fictional Riverside data in that database. Skip the seed for a real campus.
5. Set SMTP variables so verification and password reset leave the server.
6. Build with `npm run build` and start with `npm run start`. Uploaded images live in `storage/` on that machine. A host with an ephemeral disk will lose them on restart.
