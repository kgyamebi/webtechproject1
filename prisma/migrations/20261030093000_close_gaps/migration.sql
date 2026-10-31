ALTER TABLE "Module" ADD COLUMN "gate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SubmissionNote" ADD COLUMN "quote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OfficeSlot" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT '';

CREATE TABLE "RubricLevel" (
  "id" TEXT NOT NULL,
  "criterionId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "points" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "RubricLevel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutcomeLink" (
  "outcomeId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  CONSTRAINT "OutcomeLink_pkey" PRIMARY KEY ("outcomeId","assignmentId")
);

CREATE TABLE "CourseQuestion" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "reply" TEXT NOT NULL DEFAULT '',
  "repliedByName" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RubricLevel_criterionId_position_idx" ON "RubricLevel"("criterionId", "position");
CREATE INDEX "CourseQuestion_courseId_createdAt_idx" ON "CourseQuestion"("courseId", "createdAt");

ALTER TABLE "RubricLevel" ADD CONSTRAINT "RubricLevel_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "RubricCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutcomeLink" ADD CONSTRAINT "OutcomeLink_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutcomeLink" ADD CONSTRAINT "OutcomeLink_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseQuestion" ADD CONSTRAINT "CourseQuestion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
