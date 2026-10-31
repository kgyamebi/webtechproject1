# Database design

PostgreSQL is the system of record. Prisma schema: `prisma/schema.prisma`.

Migrations:

- `prisma/migrations/20261029140000_foundation/migration.sql` — accounts, profiles, institutions.
- `prisma/migrations/20261029160000_product/migration.sql` — social, academic, campus, notification, and simulated LMS tables.

Apply them with `npx prisma migrate deploy` against the `DATABASE_URL` you will actually use. `npm run db:migrate` is the command for later schema changes during development.

## Auth tables

Better Auth owns these tables. Campus+ does not hash passwords itself.

| Model | Purpose |
| --- | --- |
| `User` | Account identity, date of birth, and platform role |
| `Session` | Database session. Logging out or resetting a password can revoke it. |
| `Account` | Credential row. The password hash lives here, provider `credential`. |
| `Verification` | Email verification and password-reset tokens |

`User.platformRole` is `USER` or `PLATFORM_ADMIN`. It is not accepted from the registration form (`input: false` in the auth config). A platform administrator is not automatically a lecturer, and a lecturer is not automatically a platform administrator.

`User.dateOfBirth` is required. It is used for age rules and is included in the person's own data export. It is not rendered on a public profile page. There is no public profile page yet.

## Campus+ tables

| Model | Purpose |
| --- | --- |
| `Profile` | Biography, programme, department, privacy, notification choices, avatar path. One row per user. |
| `Institution` | University, technical university, college, other tertiary, or senior high. Junior high exists in the enum so the model can grow, and registration rejects it. |
| `InstitutionMembership` | The person's role and affiliation status at one institution. |
| `DevMailboxMessage` | Development-only copy of auth emails. Not written when SMTP is configured, and not written in production. |

## Affiliation

`AffiliationStatus` has four values:

| Status | Meaning |
| --- | --- |
| `PENDING` | Chosen an institution, or the verified email domain is not on its list |
| `DOMAIN_MATCHED` | The verified email domain is listed on the institution |
| `VERIFIED` | An administrator confirmed the affiliation. The user cannot replace it from the profile form. |
| `REJECTED` | Not accepted. A later domain check does not overwrite this. |

`DOMAIN_MATCHED` is set only after email verification, in `syncAffiliationAfterVerification`. Matching a domain does not create a course enrolment. Enrolment is a separate `Enrollment` row, created by a join code or by a lecturer.

`Institution.emailDomains` is a PostgreSQL text array. The comparison is case-insensitive and happens in application code.

## Relationships

```
Institution 1---* InstitutionMembership *---1 User 1---1 Profile
User 1---* Session
User 1---* Account
```

Deleting a user cascades to sessions, accounts, the profile, and memberships. Account deletion goes through Better Auth so the session is removed as part of the same operation.

## Indexes and constraints

- `User.email` is unique.
- `Session.token` is unique.
- `Account` is unique on `(providerId, accountId)`.
- `InstitutionMembership` is unique on `(userId, institutionId)`.
- Index on `(userId, isPrimary)` for the workspace query.
- Index on `Verification.identifier` and `DevMailboxMessage.createdAt`.

Profile updates that change an affiliation run in `prisma.$transaction` so the old membership and the new one are not left half-applied.

## Seed data

`prisma/seed.ts` inserts fictional institutions and users. It hashes the shared development password with Better Auth's `hashPassword`, then writes the credential account directly. It does not call the public sign-up endpoint, because that endpoint sends mail and expects a browser session.

Do not run the seed against production.

## Product tables

The second migration adds the tables the workspace writes.

| Area | Models |
| --- | --- |
| Discovery and friends | `FriendRequest`, `Block`, `Report`, `DiscoverySkip`, `DiscoveryHide` |
| Quiet Connect | `QuietProfile`, `QuietIntroduction`, `QuietMessage` |
| Messages | `Conversation`, `ConversationMember`, `Message`, `MessageReaction` |
| Posts and stories | `Post`, `Comment`, `PostReaction`, `Story`, `StoryMute` |
| Communities | `Community`, `CommunityMember` |
| Courses | `Course`, `CourseStaff`, `Enrollment`, `Module`, `Material`, `MaterialCompletion`, `Announcement`, `StudyGroup`, `StudyGroupMember` |
| Assessment | `Assignment`, `Submission`, `Quiz`, `Question`, `QuestionOption`, `QuizAttempt`, `AttemptAnswer`, `GradeCategory`, `GradeRecord` |
| Campus | `CampusEvent`, `EventSave`, `Opportunity`, `OpportunitySave`, `Notification` |
| Simulated LMS | `LmsConnection`, `SyncRecord`. The only provider is `SIMULATED`. |

`FriendRequest` is unique on the direction `(fromUserId, toUserId)`. The action also looks for the reverse pair. `Submission` is unique on `(assignmentId, studentId)`. `Course.joinCode` is unique. `Course.source` is `NATIVE` or `SIMULATED`. Deleting a user cascades through these relations.

Profile tag columns (`interests`, `skills`, `subjects`, `projectGoals`, `careerInterests`) explain discovery matches and Random Connect ranking. They are not used as a secret ranking, and they are not protected characteristics.

## Random Connect

Migration `20261029180000_random_connect` adds:

| Model | Role |
| --- | --- |
| `ConnectPreference` | Availability, language, default mode, and study intent. One row per user. |
| `ConnectQueueEntry` | One waiting row per user. Deleted when a match is created or the person leaves. Rows older than 30 minutes are removed on the next match attempt. |
| `ConnectSession` | The chat. Status moves from `MATCH_FOUND` to `SESSION_ACTIVE`, then to `COMPLETED`, `CANCELLED`, or `RESTRICTED`. |
| `ConnectParticipant` | The two people, stored with an alias such as `Guest A1B2`. |
| `ConnectHold` | One active session per user. The primary key is `userId`. |
| `ConnectMessage` | Chat text. `(sessionId, clientKey)` is unique so a retried send does not duplicate the row. |
| `AccountRestriction` | A row means the person cannot join Random Connect. |
| `ModerationCase` | One case per report. |
| `ModerationAction` | The note, status change, suspension, or reinstatement, with the staff user who did it. |

`Report` is the existing table. A Random Connect report uses `targetType` `CONNECT_SESSION`. Deleting a user cascades their queue, hold, preference, participant rows, and restriction. Messages stay attached to the session so a report can still be read. Clearing personal history deletes that user's participant rows for finished sessions and leaves the messages.
