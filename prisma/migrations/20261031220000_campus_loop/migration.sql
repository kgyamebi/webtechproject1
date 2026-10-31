CREATE TYPE "PresenceWord" AS ENUM ('AVAILABLE', 'IN_CLASS', 'FOCUSING');

ALTER TABLE "Profile" ADD COLUMN "presence" "PresenceWord" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "Profile" ADD COLUMN "shareReadReceipts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Profile" ADD COLUMN "shareTyping" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Profile" ADD COLUMN "quietHoursOn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Profile" ADD COLUMN "quietStartMinute" INTEGER NOT NULL DEFAULT 1380;
ALTER TABLE "Profile" ADD COLUMN "quietEndMinute" INTEGER NOT NULL DEFAULT 420;
ALTER TABLE "Profile" ADD COLUMN "shareDeadlineLine" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Message" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Message" ADD COLUMN "pinnedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "visibleAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Message" ADD COLUMN "notified" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Message" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "Message" ADD COLUMN "attachmentPath" TEXT;
ALTER TABLE "Message" ADD COLUMN "attachmentName" TEXT;

CREATE INDEX "Message_conversationId_visibleAt_idx" ON "Message"("conversationId", "visibleAt");

ALTER TABLE "Message" ADD CONSTRAINT "Message_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TypingPulse" (
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TypingPulse_pkey" PRIMARY KEY ("conversationId","userId")
);

CREATE TABLE "MessagePoll" (
  "messageId" TEXT NOT NULL,
  CONSTRAINT "MessagePoll_pkey" PRIMARY KEY ("messageId")
);

CREATE TABLE "MessagePollOption" (
  "id" TEXT NOT NULL,
  "pollId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  CONSTRAINT "MessagePollOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessagePollVote" (
  "optionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "MessagePollVote_pkey" PRIMARY KEY ("optionId","userId")
);

CREATE TABLE "StoryCircle" (
  "storyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "StoryCircle_pkey" PRIMARY KEY ("storyId","userId")
);

CREATE TABLE "CommunityHighlight" (
  "communityId" TEXT NOT NULL,
  "imagePath" TEXT NOT NULL,
  "caption" TEXT NOT NULL DEFAULT '',
  "savedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityHighlight_pkey" PRIMARY KEY ("communityId")
);

CREATE TABLE "DeskSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "assignmentTitle" TEXT NOT NULL,
  "showFriends" BOOLEAN NOT NULL DEFAULT false,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeskSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewOptIn" (
  "quizId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewOptIn_pkey" PRIMARY KEY ("questionId","userId")
);

CREATE TABLE "OfficeQueueEntry" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "studentName" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL DEFAULT '',
  "reason" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'waiting',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfficeQueueEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentThanks" (
  "assignmentId" TEXT NOT NULL,
  "fromUserId" TEXT NOT NULL,
  "toUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentThanks_pkey" PRIMARY KEY ("assignmentId","fromUserId")
);

CREATE TABLE "TaskOffer" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userName" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "finishedLabel" TEXT NOT NULL,
  "freeStart" TIMESTAMP(3) NOT NULL,
  "freeEnd" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WalkCheck" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "friendId" TEXT NOT NULL,
  "place" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "arrivedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "alertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalkCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssignmentDecision" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeekShare" (
  "userId" TEXT NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeekShare_pkey" PRIMARY KEY ("userId","weekStart")
);

CREATE INDEX "MessagePollOption_pollId_idx" ON "MessagePollOption"("pollId");
CREATE INDEX "DeskSession_assignmentId_endsAt_idx" ON "DeskSession"("assignmentId", "endsAt");
CREATE INDEX "DeskSession_courseId_endsAt_idx" ON "DeskSession"("courseId", "endsAt");
CREATE INDEX "DeskSession_userId_idx" ON "DeskSession"("userId");
CREATE INDEX "ReviewOptIn_quizId_idx" ON "ReviewOptIn"("quizId");
CREATE INDEX "OfficeQueueEntry_courseId_createdAt_idx" ON "OfficeQueueEntry"("courseId", "createdAt");
CREATE INDEX "AssignmentThanks_toUserId_idx" ON "AssignmentThanks"("toUserId");
CREATE INDEX "TaskOffer_courseId_freeStart_idx" ON "TaskOffer"("courseId", "freeStart");
CREATE INDEX "WalkCheck_friendId_dueAt_idx" ON "WalkCheck"("friendId", "dueAt");
CREATE INDEX "WalkCheck_userId_idx" ON "WalkCheck"("userId");
CREATE INDEX "AssignmentDecision_assignmentId_createdAt_idx" ON "AssignmentDecision"("assignmentId", "createdAt");

ALTER TABLE "TypingPulse" ADD CONSTRAINT "TypingPulse_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TypingPulse" ADD CONSTRAINT "TypingPulse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessagePoll" ADD CONSTRAINT "MessagePoll_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessagePollOption" ADD CONSTRAINT "MessagePollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "MessagePoll"("messageId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessagePollVote" ADD CONSTRAINT "MessagePollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "MessagePollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryCircle" ADD CONSTRAINT "StoryCircle_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryCircle" ADD CONSTRAINT "StoryCircle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityHighlight" ADD CONSTRAINT "CommunityHighlight_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeskSession" ADD CONSTRAINT "DeskSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeskSession" ADD CONSTRAINT "DeskSession_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewOptIn" ADD CONSTRAINT "ReviewOptIn_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewOptIn" ADD CONSTRAINT "ReviewOptIn_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewOptIn" ADD CONSTRAINT "ReviewOptIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfficeQueueEntry" ADD CONSTRAINT "OfficeQueueEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfficeQueueEntry" ADD CONSTRAINT "OfficeQueueEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentThanks" ADD CONSTRAINT "AssignmentThanks_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentThanks" ADD CONSTRAINT "AssignmentThanks_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentThanks" ADD CONSTRAINT "AssignmentThanks_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskOffer" ADD CONSTRAINT "TaskOffer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskOffer" ADD CONSTRAINT "TaskOffer_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalkCheck" ADD CONSTRAINT "WalkCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WalkCheck" ADD CONSTRAINT "WalkCheck_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentDecision" ADD CONSTRAINT "AssignmentDecision_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentDecision" ADD CONSTRAINT "AssignmentDecision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeekShare" ADD CONSTRAINT "WeekShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
