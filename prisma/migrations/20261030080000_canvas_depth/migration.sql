ALTER TABLE "Course" ADD COLUMN "syllabus" TEXT NOT NULL DEFAULT '';

CREATE TABLE "CoursePage" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL DEFAULT '',
  "position" INTEGER NOT NULL,
  CONSTRAINT "CoursePage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseFile" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RubricCriterion" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "RubricCriterion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RubricMark" (
  "id" TEXT NOT NULL,
  "criterionId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "comment" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "RubricMark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubmissionNote" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubmissionNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Discussion" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL DEFAULT '',
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "closed" BOOLEAN NOT NULL DEFAULT false,
  "points" INTEGER,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Discussion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscussionPost" (
  "id" TEXT NOT NULL,
  "discussionId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscussionPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscussionGrade" (
  "discussionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "points" DOUBLE PRECISION NOT NULL,
  "released" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "DiscussionGrade_pkey" PRIMARY KEY ("discussionId","studentId")
);

CREATE TABLE "Outcome" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "masteryPercent" INTEGER NOT NULL DEFAULT 70,
  "assignmentId" TEXT,
  CONSTRAINT "Outcome_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceSession" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "heldAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AttendanceMark" (
  "sessionId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  CONSTRAINT "AttendanceMark_pkey" PRIMARY KEY ("sessionId","studentId")
);

CREATE TABLE "OfficeSlot" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "hostName" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "location" TEXT NOT NULL DEFAULT '',
  "claimantId" TEXT,
  "claimantName" TEXT,
  CONSTRAINT "OfficeSlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PersonalEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  CONSTRAINT "PersonalEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseTool" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  CONSTRAINT "CourseTool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseLiveMessage" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseLiveMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CoursePage_courseId_position_idx" ON "CoursePage"("courseId", "position");
CREATE INDEX "CourseFile_courseId_createdAt_idx" ON "CourseFile"("courseId", "createdAt");
CREATE INDEX "RubricCriterion_assignmentId_position_idx" ON "RubricCriterion"("assignmentId", "position");
CREATE UNIQUE INDEX "RubricMark_criterionId_submissionId_key" ON "RubricMark"("criterionId", "submissionId");
CREATE INDEX "SubmissionNote_submissionId_createdAt_idx" ON "SubmissionNote"("submissionId", "createdAt");
CREATE INDEX "Discussion_courseId_createdAt_idx" ON "Discussion"("courseId", "createdAt");
CREATE INDEX "DiscussionPost_discussionId_createdAt_idx" ON "DiscussionPost"("discussionId", "createdAt");
CREATE INDEX "Outcome_courseId_idx" ON "Outcome"("courseId");
CREATE INDEX "AttendanceSession_courseId_heldAt_idx" ON "AttendanceSession"("courseId", "heldAt");
CREATE INDEX "OfficeSlot_courseId_startsAt_idx" ON "OfficeSlot"("courseId", "startsAt");
CREATE INDEX "PersonalEvent_userId_startsAt_idx" ON "PersonalEvent"("userId", "startsAt");
CREATE INDEX "CourseTool_courseId_idx" ON "CourseTool"("courseId");
CREATE INDEX "CourseLiveMessage_courseId_createdAt_idx" ON "CourseLiveMessage"("courseId", "createdAt");

ALTER TABLE "CoursePage" ADD CONSTRAINT "CoursePage_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseFile" ADD CONSTRAINT "CourseFile_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RubricCriterion" ADD CONSTRAINT "RubricCriterion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RubricMark" ADD CONSTRAINT "RubricMark_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "RubricCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RubricMark" ADD CONSTRAINT "RubricMark_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubmissionNote" ADD CONSTRAINT "SubmissionNote_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Discussion" ADD CONSTRAINT "Discussion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscussionPost" ADD CONSTRAINT "DiscussionPost_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "Discussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscussionPost" ADD CONSTRAINT "DiscussionPost_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DiscussionPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscussionGrade" ADD CONSTRAINT "DiscussionGrade_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "Discussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceMark" ADD CONSTRAINT "AttendanceMark_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfficeSlot" ADD CONSTRAINT "OfficeSlot_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PersonalEvent" ADD CONSTRAINT "PersonalEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseTool" ADD CONSTRAINT "CourseTool_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseLiveMessage" ADD CONSTRAINT "CourseLiveMessage_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
