# Security

Security is part of the product, not a later pass. This document describes the controls that exist in this stage and the ones that are still missing.

## Authentication

- Better Auth stores password hashes. The application never writes its own hash algorithm.
- Email verification is required before sign-in.
- Password reset revokes existing sessions (`revokeSessionsOnPasswordReset`).
- Sign-out deletes the server session.
- Account deletion requires the current password and the phrase `delete my account`.
- Registration, sign-in, and reset are rate limited by Better Auth. The limiter is in memory. One Node process shares it. Several server processes would not. That is acceptable for a single-server demo and is a scaling limit, not a claim of distributed protection.

Duplicate registration does not tell the visitor whether the email already exists. The check-email page uses the same wording either way. Password reset does the same.

## Authorization

The proxy cookie check is optimistic. Private pages and actions call `auth.api.getSession`.

- Profile, privacy, notification, avatar, export, and deletion actions refuse to run without a session.
- Export returns the signed-in user's profile, memberships, posts, enrolments, and notifications. Password hashes, session tokens, and verification tokens are not selected.
- A verified institution affiliation cannot be replaced by the user.
- `platformRole` cannot be set from the sign-up body.
- Avatar, story, post, and submission reads check the stored path and reject `..`. Story and post images are returned only when `viewerCanSeeContent` allows that viewer. Submission files are returned only to the student or course staff.
- Friend requests, messages, posts, course content, grades, and Quiet Connect actions call `requireUser` and then a rule function. A hidden form field is not treated as permission.
- Students cannot set their own points. Grade and essay actions require a course staff row.
- Quiz scores are computed in `src/server/academic/rules.ts`. The browser does not submit a mark.
- A grade record is shown to its owner only when `released` is true. Staff can see it before release.
- Simulated LMS disconnect deletes a course only when its source is `SIMULATED`.

## Age and contact

- Accounts under 16 are rejected.
- Accounts from 16 to 17 are minors. Discovery is forced off. Quiet Connect redirects them away, and `canUseQuietConnect` requires an adult.
- Social interaction between a minor and an adult is refused by `canSendFriendRequest`. A database test covers that write. Direct messages also require an accepted friendship, so that refusal blocks the social inbox as well. Course enrolment is separate and is allowed.
- Junior high institutions cannot be selected.

## Files

Uploads are limited to 2 MB. The handler inspects JPEG, PNG, and WebP signatures instead of trusting the filename. Assignment files may also be PDF, checked from the `%PDF` bytes. Files are stored outside `public/`. Avatar, story, post, and submission routes send `X-Content-Type-Options: nosniff`. Event and opportunity links are stored only when `safeHttpUrl` accepts `http` or `https`.

## Email secrets

Verification and reset URLs are secrets. In development, without SMTP, they are stored in `DevMailboxMessage` and shown at `/dev/mailbox`. That route calls `notFound()` when `NODE_ENV` is not `development`. Production must set SMTP. If SMTP is missing in production, the message is not stored and an error is logged; the link is not returned in the HTTP response.

## Cookies and redirects

Better Auth sets the session cookie. `safeWorkspacePath` only allows post-login redirects that start with `/workspace`, so a `next` parameter cannot send someone to another site.

## Secrets

`.env` is gitignored. `.env.example` has placeholders. `BETTER_AUTH_SECRET` and `DATABASE_URL` are read on the server. They are not referenced from client components.

## Random Connect

- Only an adult session can join the queue. The same check runs again when two people are paired.
- A block, a restriction row, an open chat, or a match from the last 12 hours removes a candidate.
- Chat messages are accepted only from a participant in an open session. The body is trimmed, limited to 500 characters, and limited to 20 messages a minute. A repeated `clientKey` updates nothing.
- The event stream checks the signed-in user before it reads messages. A person who is not in the session receives an error event and the stream closes.
- Reports are limited to five an hour. The reported person is not told who filed the report.
- `/workspace/moderate` calls `notFound()` unless `platformRole` is `PLATFORM_ADMIN`. The case action returns without writing if that check fails.
- Suspending someone writes `AccountRestriction`. The next queue attempt is refused.
- Random Connect text is stored in PostgreSQL. It is not end-to-end encrypted. A call is not stored. The media process accepts a room only with a ticket signed by the app for a participant.

## Not done yet

- No distributed rate-limit store. Message and report limits are counted in PostgreSQL for the current process's requests. Better Auth's sign-in limiter is still in memory.
- No end-to-end encryption.
- No formal penetration test.
- Chat updates use server-sent events. Call setup uses a WebSocket on the separate media process. That socket is not a general app channel.
