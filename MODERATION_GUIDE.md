# Moderation guide

Random Connect reports are for a platform administrator. The seeded administrator is `platform.admin@campusplus.local`. The shared development password is in the README. Do not reuse it on a public server.

## Open the queue

Sign in as that administrator and open `/workspace/moderate`. A student account receives a 404. Changing the URL does not grant access.

Each case shows the report reason, the session id, the status, and earlier actions. The three numbers at the top are counts from the database for the current moment.

## What you can do

- Mark the case reviewing, escalate it, or close it.
- Suspend the other person in the reported session. They cannot join the queue while the restriction row exists.
- Reinstate them by removing that row.
- Add a note. Notes are stored with your user id.

The reporter is not revealed to the reported person by the product. The case record does include the reporter's user id, so an administrator can see who filed it.

## What this is not

The app does not scan messages for abuse. A report exists only after a person submits one. Do not describe the queue as automatic detection.

Calls are not stored, so a case still has no audio or video to review.
