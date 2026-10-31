# Security and privacy

This file covers Random Connect. The rest of Campus+ is described in [SECURITY.md](SECURITY.md).

## What the other person can see

During a chat they see an alias, up to three shared tags, and the messages either of you send. They do not see your legal name, email, date of birth, or institution on that screen. A later friend request uses the normal profile privacy settings. Accepting it is a separate choice.

History uses the alias, the mode, the time, the duration, and whether a friend request exists. It does not list the other person's name.

## What is stored

Messages, reports, and moderation notes are rows in PostgreSQL. There is no end-to-end encryption. There is no call recording, because voice and video are not connected.

Clearing finished history removes your participant rows. The messages can remain so a report can still be investigated. Deleting the account cascades your user-owned rows.

Campus+ does not collect a precise location for matching, and it does not send your IP address to the other person.

## Who may act

The server checks the session on every action and on both event streams. A hidden form field is not permission. An ordinary account cannot update a moderation case. That check was exercised by `connect-flow.test.ts`.

## Limits of this design

Rate limits for chat and reports are counts in the database. They are not a distributed firewall. The local database pool uses one connection so the development proxy stays stable. That limit is written in [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md). This document does not say the system has passed a penetration test.
