/**
 * The product UI reads this list so unfinished areas are described honestly.
 * Keep it aligned with FEATURE_REGISTER.md.
 */

export const FEATURE_STATUSES = [
  "complete-and-tested",
  "implemented-not-fully-tested",
  "simulated",
  "not-implemented",
] as const;

export type FeatureStatus = (typeof FEATURE_STATUSES)[number];

export type FeatureEntry = {
  id: string;
  name: string;
  stage: number;
  status: FeatureStatus;
  summary: string;
  href?: string;
};

export const featureRegister: FeatureEntry[] = [
  {
    id: "accounts",
    name: "Accounts and sessions",
    stage: 2,
    status: "implemented-not-fully-tested",
    summary: "Register, verify email, sign in, recover a password, and sign out.",
    href: "/register",
  },
  {
    id: "identity-rules",
    name: "Age and affiliation rules",
    stage: 2,
    status: "complete-and-tested",
    summary: "Minimum age, adult and minor bands, and email-domain affiliation.",
  },
  {
    id: "profile",
    name: "Profile, privacy, and export",
    stage: 2,
    status: "implemented-not-fully-tested",
    summary: "Edit a profile, upload an image, choose privacy, export data, or delete the account.",
    href: "/workspace/profile",
  },
  {
    id: "discovery",
    name: "Student discovery",
    stage: 3,
    status: "implemented-not-fully-tested",
    summary: "Rule-based recommendations, skips, and hiding profiles. Minors and adults are kept apart.",
    href: "/workspace/people",
  },
  {
    id: "friends",
    name: "Friend requests and blocks",
    stage: 3,
    status: "complete-and-tested",
    summary: "Requests, friendships, blocking, and reporting. An adult cannot request a minor.",
    href: "/workspace/friends",
  },
  {
    id: "random-connect",
    name: "Random Connect",
    stage: 4,
    status: "implemented-not-fully-tested",
    summary:
      "Adults can queue, match, send a text message, and end the chat. Those paths are tested. Report, block, and the moderator screen are enforced on the server and are not each clicked in a browser test. A voice or video call can start when the separate media server is running. A Connect call is limited to four people and is not recorded. A course live room lets four people speak and twenty-four listen. A desktop browser test places a voice call between two enrolled people in a course live room.",
    href: "/workspace/connect",
  },
  {
    id: "quiet-connect",
    name: "Quiet Connect",
    stage: 4,
    status: "implemented-not-fully-tested",
    summary: "Opt-in introductions for adults, with consent before any identity reveal.",
    href: "/workspace/quiet",
  },
  {
    id: "messaging",
    name: "Messaging",
    stage: 5,
    status: "implemented-not-fully-tested",
    summary: "Direct messages and groups, with replies, reactions, pins, search, polls, voice notes, files, and a short unsend window.",
    href: "/workspace/messages",
  },
  {
    id: "social",
    name: "Posts, stories, and communities",
    stage: 6,
    status: "implemented-not-fully-tested",
    summary: "Feed, comments, 24-hour image stories, and community membership.",
    href: "/workspace/feed",
  },
  {
    id: "courses",
    name: "Courses and assignments",
    stage: 7,
    status: "implemented-not-fully-tested",
    summary: "Enrolment, materials, submissions, and feedback.",
    href: "/workspace/learn",
  },
  {
    id: "quizzes",
    name: "Quizzes and gradebook",
    stage: 8,
    status: "implemented-not-fully-tested",
    summary: "Question types, server-side scoring, and released grades.",
    href: "/workspace/learn",
  },
  {
    id: "workspace",
    name: "Academic workspace",
    stage: 9,
    status: "implemented-not-fully-tested",
    summary: "Deadlines, calendar, and a combined academic home.",
    href: "/workspace",
  },
  {
    id: "lms",
    name: "External LMS connector",
    stage: 10,
    status: "simulated",
    summary: "A labelled sample course with a note, assignment, quiz, and announcement. Disconnect removes it and leaves real courses.",
    href: "/workspace/integrations",
  },
  {
    id: "opportunities",
    name: "Events and opportunities",
    stage: 11,
    status: "implemented-not-fully-tested",
    summary: "Listings students can save. Official flags are limited to staff.",
    href: "/workspace/events",
  },
];

export const statusLabel: Record<FeatureStatus, string> = {
  "complete-and-tested": "Complete and tested",
  "implemented-not-fully-tested": "Built, still being verified",
  simulated: "Simulated",
  "not-implemented": "Not built yet",
};
