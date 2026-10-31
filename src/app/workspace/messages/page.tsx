import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { createGroupAction, listFriendDesk, listMessages, startDirectMessageAction } from "@/server/social/actions";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const conversations = await listMessages();
  const desk = await listFriendDesk();

  return (
    <div className="grid gap-6">
      <h1 className="font-display text-4xl">Messages</h1>
      <p className="max-w-2xl text-sm leading-6 text-ink-soft">
        Direct messages open only between friends who have not blocked each other. Quiet Connect messages stay in that
        introduction and never appear here.
      </p>
      {conversations.length === 0 ? (
        <EmptyState title="No conversations" body="Message a friend below. The thread opens with their name." />
      ) : (
        conversations.map((conversation) => (
          <Card key={conversation.id}>
            <CardTitle>{conversation.title}</CardTitle>
            <CardText>
              {conversation.unread ? "Unread · " : ""}
              {conversation.preview}
              {conversation.muted ? " · muted" : ""}
            </CardText>
            <div className="mt-3 flex gap-4">
              <Link className="text-sm text-pine underline-offset-4 hover:underline" href={`/workspace/connect/chat/${conversation.id}`}>
                Open in Connect
              </Link>
              <Link className="text-sm text-pine underline-offset-4 hover:underline" href={`/workspace/messages/${conversation.id}`}>
                Edit and reactions
              </Link>
            </div>
          </Card>
        ))
      )}
      <Card>
        <CardTitle>Message a friend</CardTitle>
        <CardText>A direct message opens only with someone you have already accepted, and a block stops it.</CardText>
        {desk.friends.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">
            <Link href="/workspace/friends" className="text-pine underline-offset-4 hover:underline">
              Friends
            </Link>{" "}
            is empty, so there is nobody to message yet.
          </p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {desk.friends.map((friend) => (
              <li key={friend.id}>
                <form action={startDirectMessageAction}>
                  <input type="hidden" name="userId" value={friend.id} />
                  <Button type="submit" size="sm">
                    Message {friend.name}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardTitle>New group</CardTitle>
        <CardText>Choose friends by name. A block stops the group from being created.</CardText>
        <form action={createGroupAction} className="mt-4 grid gap-3">
          <Field label="Title" name="title">
            <Input id="title" name="title" required minLength={2} />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-ink">Friends in the group</legend>
            {desk.friends.length === 0 ? <p className="text-sm text-ink-soft">Accept a friend before adding anyone.</p> : null}
            {desk.friends.map((friend) => (
              <label key={friend.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="memberId" value={friend.id} />
                {friend.name}
              </label>
            ))}
          </fieldset>
          <Button type="submit">Create group</Button>
        </form>
      </Card>
    </div>
  );
}
