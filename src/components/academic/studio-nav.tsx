import Link from "next/link";

const links = [
  ["Syllabus", "syllabus"],
  ["Pages", "pages"],
  ["Files", "files"],
  ["Discussions", "discussions"],
  ["Outcomes", "outcomes"],
  ["Attendance", "attendance"],
  ["Office hours", "hours"],
  ["Tools", "tools"],
  ["Live room", "live"],
  ["Ask", "ask"],
] as const;

export function StudioNav({ courseId }: { courseId: string }) {
  return (
    <nav aria-label="Course studio" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {links.map(([label, slug]) => (
        <Link key={slug} className="text-ink-soft underline-offset-4 hover:text-ink hover:underline" href={`/workspace/learn/${courseId}/${slug}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
