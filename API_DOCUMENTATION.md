# API documentation

Random Connect uses Next.js server actions and two event-stream routes. Every action calls `requireUser` first. A missing session redirects to login. Invalid input is ignored or returned as a short reason. Database errors are not shown to the other person in the chat.

## Preferences and queue

| Action | Who | What it does |
| --- | --- | --- |
| `saveConnectPreferencesAction` | Adult | Saves availability, language, mode, and study intent. |
| `joinConnectQueueAction` | Adult who is available, not suspended, and not already in a chat | Adds one queue row and tries to match. Redirects to the chat or to the waiting page. |
| `cancelConnectQueueAction` | Signed-in user | Deletes that person's queue row. |

Modes are `SURPRISE`, `SAME_CAMPUS`, `STUDY`, `INTERESTS`, `CAREER`, and `GLOBAL`. Same Campus needs the same primary institution. Global Connect needs two different institutions. Study Buddy needs a shared subject or the same study intent. Shared Interests and Career Connect need a shared tag of that kind. Surprise Me has no tag requirement. All of them still apply the age, block, and suspension rules.

## Chat

| Action or route | Who | What it does |
| --- | --- | --- |
| `GET /api/connect/queue/stream` | The waiting user | Sends `waiting`, `matched` with a session id, or `idle`. |
| `GET /api/connect/session/[id]/stream` | A participant | Sends new messages and `ended`. A non-participant gets an error event and the stream closes. |
| `sendConnectMessageAction` | A participant in an open chat | Stores one message. The same `clientKey` does not create a second row. |
| `endConnectSessionAction` | A participant | Closes the chat, removes both holds, and notifies the other person without quoting the messages. |
| `nextPromptAction` | A participant | Advances the optional prompt. The prompt list is fixed. The app is not reading the conversation. |

## Trust

| Action | Who | What it does |
| --- | --- | --- |
| `connectFriendAction` | A participant | Uses the existing friend-request rules. A request does not reveal the alias as a legal name. |
| `connectBlockAction` | A participant | Writes a block, removes friend requests between the pair, and closes the chat as `RESTRICTED`. |
| `connectReportAction` | A participant, at most five reports an hour | Creates a `Report` and a `ModerationCase`. The reason must be 5 to 500 characters. |
| `deleteFinishedConnectHistoryAction` | The signed-in user | Removes that user's participant rows for finished chats. |

## Moderation

| Action or page | Who | What it does |
| --- | --- | --- |
| `/workspace/moderate` | `PLATFORM_ADMIN` | Lists cases and three counts: people waiting, open chats, and connect reports in 24 hours. Anyone else gets a 404. |
| `moderateCaseAction` | `PLATFORM_ADMIN` | Writes a `ModerationAction`. `SUSPEND` creates an `AccountRestriction` for the other person in the reported session. `REINSTATE` removes it. |

The counts are queries. They are not sample numbers. Message text is not included in those counts. A moderator who opens a case can read the report reason, which may describe the chat.
