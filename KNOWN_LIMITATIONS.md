# Known limitations

The home page and [FEATURE_REGISTER.md](FEATURE_REGISTER.md) use the same status words. A screen can be usable while its browser journey is still short of every edge.

## Built, with limits

- Email leaves the machine only when SMTP variables are set. Development uses `/dev/mailbox`. Production without SMTP does not store the link.
- Rate limits are stored in memory for the current Node process.
- Avatar, post, story, and submission files are on the local disk, outside `public/`. They are not replicated. A database backup does not include them.
- Stories are images only. They last 24 hours. There is no video.
- Direct messages are available to friends who have not blocked each other. They are not end-to-end encrypted. Quiet Connect and Random Connect keep their own message tables.
- Random Connect text uses server-sent events. A voice or video call needs `npm run media` on a host the browsers can reach. A Connect call holds four people. A course live room lets four people speak and twenty-four others listen; each speaker’s browser carries those listeners, and it is not a large voice network. The server does not record the call, and it does not start one when that process is stopped. The same two adults are not matched again for 12 hours. If nobody eligible is waiting, the screen stays on the queue. Clearing finished history hides those rows from you, and messages can remain for a moderation case.
- The database pool uses one connection because the local Prisma Dev proxy mixes prepared statements when two queries run together. That is not a claim that the app can serve a large campus. Raise `max` in `src/server/db/client.ts` on a normal PostgreSQL server and load-test before relying on it.
- A browser quiz records a server-side score. It cannot stop a student from looking answers up.
- Multiple-choice questions are all-or-nothing. Essays stay unmarked until a lecturer enters a score. Students do not see a grade, or the correct answers, until the lecturer releases them.
- Discovery scores are design weights, not a scientific measure of compatibility.
- The LMS button creates a labelled sample course with a note, an assignment, a quiz, and an announcement. It does not talk to Canvas, Moodle, or Google Classroom. Disconnect deletes simulated imports and leaves native courses.
- Notifications are in-app only. Email and push are not sent. The settings checkboxes decide which in-app notices are stored.
- Platform administrator is a stored role. There is no separate admin console.
- One primary institution membership is supported.
- Junior high is in the enum and is rejected at registration.
- Accounts under 16 are rejected. Under 18 cannot use Quiet Connect or Random Connect, and cannot be socially connected with adults. A minor can still be enrolled on a course with an adult lecturer. That is academic contact, not a social connection.
- Official events and opportunities can be marked only by a lecturer or a platform administrator.

## Local database on this machine

Docker Desktop's engine did not answer, and PostgreSQL refuses to start under an Administrator Windows account. Local verification used `npx prisma dev`, which listens on a port printed by `npx prisma dev ls`. Replace `DATABASE_URL` with a normal hosted Postgres URL before you deploy. Do not deploy the Prisma Dev process.

## Honest product claim

Campus+ now has working academic and social paths, including Random Connect for adults. The rules that protect minors and hidden grades are tested. A desktop browser test covers one Random Connect match, one message, and ending the chat. Report, block, and the moderator screen are enforced on the server and were not each clicked in that browser test.
