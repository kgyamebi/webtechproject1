import Link from "next/link";

export const metadata = { title: "Help" };

const articles = [
  ["calendar", "Calendar", "Agenda is the full list. Day, week, and month move with Previous, Today, and Next, and you can keep one course in view. A personal event can repeat for up to eight weeks and stays on your calendar only."],
  ["syllabus", "Syllabus, pages, and files", "The syllabus is written on the course, with headings and the published assignments and quizzes underneath. Pages are text you read in place. Files are JPEG, PNG, WebP, or PDF under 2 MB."],
  ["rubrics", "Rubrics and notes", "A lecturer can add rating levels, or mark a criterion full, half, or none. A note can quote the answer and is copied to email when mail can be sent. There is no ink on a PDF. Push and SMS are not sent."],
  ["discussions", "Discussions", "Pin, close, and reply. When a thread has points, the lecturer releases a grade by choosing the student's name. This is separate from the campus feed."],
  ["outcomes", "Outcomes", "Mastery averages the released scores on the assignments a lecturer links. If a score is hidden, it waits. There is no predicted grade. On the gradebook, you can type other numbers and see a total. Those numbers are not saved."],
  ["attendance", "Attendance", "You see your own present, late, absent, and excused counts. The lecturer can mark a whole session present, then change a single row."],
  ["hours", "Office hours", "One student claims a published slot and can say what they need. That note stays on the slot. The host is notified in the app and by email. Either person can open the slot again."],
  ["tools", "Tools", "A tool opens a link and shows the site it leaves for. Campus+ does not collect a score from it, and it does not connect to Turnitin."],
  ["live", "Live room", "The transcript stays on the course and updates when someone sends. Voice and video use the media server when it is running. Four people can speak and twenty-four can listen, nothing is recorded, and it is not a large voice network. When that server is stopped, the room stays text."],
  ["ask", "Ask the course", "A question goes to the people teaching the course. You see your own questions. It is not a social message and it does not start a chat with another student."],
  ["learning", "Learning system", "The LMS page can create a labelled sample. It does not connect to a live Canvas."],
];

export default function HelpPage() {
  return (
    <div>
      <p className="kicker">Help</p>
      <h1 className="stage-title mt-3">How this desk works</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-ink-soft">
        These notes describe what Campus+ actually does. There is no phone queue and no 24-hour operator.
      </p>
      <nav aria-label="Help topics" className="mt-6 flex max-w-2xl flex-wrap gap-x-4 gap-y-2 text-sm">
        {articles.map(([id, title]) => (
          <a key={id} className="text-ink-soft underline-offset-4 hover:text-ink hover:underline" href={`#${id}`}>{title}</a>
        ))}
      </nav>
      <ul className="mt-8 max-w-2xl">
        {articles.map(([id, title, body]) => (
          <li key={id} id={id} className="border-t border-line py-4">
            <h2 className="font-display text-xl">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm">
        <Link className="text-ink underline-offset-4 hover:underline" href="/workspace/integrations">Open the learning-system page</Link>
      </p>
    </div>
  );
}
