import { Button } from "@/components/ui/button";
import { shareWeekCardAction, weekCard } from "@/server/campus-loop/actions";

export const metadata = { title: "Your week" };

export default async function WeekPage() {
  const card = await weekCard();

  return (
    <div className="grid max-w-xl gap-4">
      <h1 className="font-display text-4xl">Your week</h1>
      <p className="text-sm leading-6 text-ink-soft">
        Week of {card.start.toLocaleDateString()}. This stays private until you share one card with friends.
        {card.sunday ? " It is Sunday, so the desk points here." : ""}
      </p>
      <ul className="grid gap-2 text-sm">
        {card.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {card.shared ? (
        <p className="text-sm text-ink-soft">This week’s card is already on the feed for friends.</p>
      ) : (
        <form action={shareWeekCardAction}>
          <Button type="submit">Share one card</Button>
        </form>
      )}
    </div>
  );
}
