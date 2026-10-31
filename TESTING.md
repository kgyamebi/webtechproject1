# Testing

## Unit tests

```
npm run test
```

Vitest runs `tests/unit`. These files do not need PostgreSQL:

| File | What it checks |
| --- | --- |
| `age-policy.test.ts` | Minimum age, the 16th and 18th birthdays, future dates, discovery, Quiet Connect, and minor/adult contact |
| `affiliation.test.ts` | Email domains, domain match versus verification, and junior high closure |
| `registration.test.ts` | Password length, a password copied from the email, and the date format |
| `avatars.test.ts` | JPEG, PNG, and WebP signatures, and path traversal |
| `redirects.test.ts` | Impossible calendar dates and open redirects |
| `social-rules.test.ts` | Discovery weights, blocks, friend-request limits, Quiet Connect states, and the two-person accept |
| `academic-rules.test.ts` | Quiz scoring, late work, weighted grades, hidden marks, audiences, and simulated imports |
| `connect-rules.test.ts` | Minor exclusion, mode rules, ranking, weighted choice, session transitions, and message and report limits |

`database-flow.test.ts` needs PostgreSQL. It skips when the database or the `Course` table is missing. When the database is up it calls the friend-request action, stores a server-side quiz score that is not released, and checks that a simulated course can be removed while a native course stays.

`connect-flow.test.ts` skips when `ConnectSession` is missing. When the database is up it matches two adults, keeps one row when the same client key is sent twice, refuses an outsider, leaves a blocked pair waiting, refuses a minor, and refuses a case update from an ordinary account. A platform-admin session in that test can suspend the other person.

The age calculation uses UTC dates so the result does not change with the machine timezone. The tests pin the "today" date at 29 October 2026.

## Browser test

```
npm run test:e2e
```

Playwright loads the home page and opens registration on a desktop viewport and a Pixel 7 viewport. `tests/e2e/product.spec.ts` signs in as the seeded adult student and opens Learn, People, Friends, Quiet Connect, Messages, Feed, and the simulated LMS page. `tests/e2e/connect.spec.ts` checks that an adult can open Connect and a minor is turned away, on desktop and on a Pixel 7 width. The desktop project also signs in as Ada and Ama, matches them, delivers one message, and ends the chat. Those files skip when `GET /api/health` is not 200. The first run needs browser binaries:

```
npx playwright install chromium
```

The public smoke test does not create an account. Registration through the mailbox is still a manual check, so accounts stay "built, still being verified".

## Other checks

```
npm run lint
npm run typecheck
npm run build
```

Do not delete or skip a failing test to make the command pass. If a check cannot run because Docker or Playwright browsers are missing, record that in the project report instead of pretending it passed.
