# Feature register

Statuses:

- **Complete and tested** — the behaviour exists and an automated test covers the rule.
- **Built, still being verified** — the behaviour exists. A browser journey does not cover every screen yet.
- **Simulated** — stand-in data, clearly labelled. It is not a live external system.
- **Not built yet** — no working path.

The home page reads `src/lib/feature-register.ts`. If you change a status, change it there and in this file.

| Feature | Stage | Status |
| --- | --- | --- |
| Age and affiliation rules | 2 | Complete and tested |
| Accounts and sessions | 2 | Built, still being verified |
| Profile, privacy, export, deletion, avatar | 2 | Built, still being verified |
| Student discovery | 3 | Built, still being verified. Match weights and the minor/adult filter are unit tested. |
| Friend requests and blocks | 3 | Complete and tested. A database test rejects an adult-to-minor request and stores an adult request. |
| Random Connect | 4 | Built, still being verified. Eligibility and ranking are unit tested. A database test matches two adults, rejects a duplicate message, blocks a rematch, and refuses a minor and an ordinary moderator. A desktop browser test matches two seeded adults, delivers one message, and ends the chat. A voice or video call can start when the separate media server is running. A Connect call is limited to four people and is not recorded. A course live room lets four people speak and twenty-four listen. A desktop browser test places a voice call between two enrolled people in a course live room. |
| Quiet Connect | 4 | Built, still being verified. The state machine and two-person accept rule are unit tested. Adults only. |
| Messaging | 5 | Built, still being verified. Direct messages require a friendship and no block. |
| Posts, stories, communities | 6 | Built, still being verified. Stories are images and expire after 24 hours. |
| Courses and assignments | 7 | Built, still being verified. Lecturers create courses. Students join with a code. |
| Quizzes and gradebook | 8 | Built, still being verified. Objective scores are calculated on the server and unit tested. Students see a mark only after release. |
| Academic workspace | 9 | Built, still being verified. The home page lists upcoming deadlines. |
| External LMS connector | 10 | Simulated sample course with a note, assignment, quiz, and announcement. Disconnect removes that course and leaves native courses. The removal rule is tested. |
| Events and opportunities | 11 | Built, still being verified. Official flags are limited to lecturers and platform administrators. |
