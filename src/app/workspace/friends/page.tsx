import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Field, Input } from "@/components/ui/field";
import { endWalkAction, arriveWalkAction, friendWalkChoices, startWalkCheckAction } from "@/server/campus-loop/actions";
import {
  blockPersonAction,
  cancelFriendRequestAction,
  listFriendDesk,
  removeFriendAction,
  respondFriendRequestAction,
  startDirectMessageAction,
  unblockPersonAction,
} from "@/server/social/actions";

export const metadata = { title: "Friends" };

export default async function FriendsPage() {
  const desk = await listFriendDesk();
  const walks = await friendWalkChoices();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-4xl">Friends</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          Accept a request to open a direct message. Decline leaves no friendship. Block stops contact in both directions.
        </p>
      </div>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">Incoming</h2>
        {desk.incoming.length === 0 ? (
          <EmptyState title="No requests waiting" body="When someone asks to connect, you can accept or decline here." />
        ) : (
          desk.incoming.map((request) => (
            <Card key={request.id}>
              <CardTitle>{request.fromUser.name}</CardTitle>
              <div className="mt-4 flex gap-2">
                <form action={respondFriendRequestAction}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <input type="hidden" name="decision" value="accept" />
                  <Button type="submit" size="sm">
                    Accept
                  </Button>
                </form>
                <form action={respondFriendRequestAction}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <input type="hidden" name="decision" value="decline" />
                  <Button type="submit" size="sm" variant="secondary">
                    Decline
                  </Button>
                </form>
                <form action={blockPersonAction}>
                  <input type="hidden" name="userId" value={request.fromUser.id} />
                  <Button type="submit" size="sm" variant="danger">
                    Block
                  </Button>
                </form>
              </div>
            </Card>
          ))
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">Sent</h2>
        {desk.outgoing.length === 0 ? <CardText>No outgoing requests.</CardText> : null}
        {desk.outgoing.map((request) => (
          <Card key={request.id}>
            <CardTitle>{request.toUser.name}</CardTitle>
            <form action={cancelFriendRequestAction} className="mt-4">
              <input type="hidden" name="requestId" value={request.id} />
              <Button type="submit" size="sm" variant="secondary">
                Cancel
              </Button>
            </form>
          </Card>
        ))}
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">Friends</h2>
        {desk.friends.length === 0 ? (
          <EmptyState title="No friends yet" body="Accept a request or find someone on People." />
        ) : (
          desk.friends.map((friend) => (
            <Card key={friend.id}>
              <CardTitle>{friend.name}</CardTitle>
              <div className="mt-4 flex flex-wrap gap-2">
                <form action={startDirectMessageAction}>
                  <input type="hidden" name="userId" value={friend.id} />
                  <Button type="submit" size="sm">
                    Message
                  </Button>
                </form>
                <form action={removeFriendAction}>
                  <input type="hidden" name="userId" value={friend.id} />
                  <Button type="submit" size="sm" variant="secondary">
                    Remove
                  </Button>
                </form>
                <form action={blockPersonAction}>
                  <input type="hidden" name="userId" value={friend.id} />
                  <Button type="submit" size="sm" variant="danger">
                    Block
                  </Button>
                </form>
              </div>
            </Card>
          ))
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">Blocked</h2>
        {desk.blocks.length === 0 ? <CardText>You have not blocked anyone.</CardText> : null}
        {desk.blocks.map((block) => (
          <Card key={block.id}>
            <CardTitle>{block.blocked.name}</CardTitle>
            <form action={unblockPersonAction} className="mt-4">
              <input type="hidden" name="userId" value={block.blocked.id} />
              <Button type="submit" size="sm" variant="secondary">
                Unblock
              </Button>
            </form>
          </Card>
        ))}
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">Walk check-in</h2>
        <p className="max-w-xl text-sm leading-6 text-ink-soft">
          Name a place and a time for one friend. They hear only if you have not arrived by then, and only inside Campus+. There is no map.
        </p>
        {walks.walks.map((walk) => (
          <Card key={walk.id}>
            <CardTitle>{walk.place}</CardTitle>
            <CardText>Due {walk.dueAt.toLocaleString()}. Your friend is not told before that time.</CardText>
            <div className="mt-3 flex gap-2">
              <form action={arriveWalkAction}>
                <input type="hidden" name="id" value={walk.id} />
                <Button type="submit" size="sm">I arrived</Button>
              </form>
              <form action={endWalkAction}>
                <input type="hidden" name="id" value={walk.id} />
                <Button type="submit" size="sm" variant="secondary">End</Button>
              </form>
            </div>
          </Card>
        ))}
        {walks.people.length > 0 ? (
          <form action={startWalkCheckAction} className="grid max-w-md gap-3">
            <label className="grid gap-1 text-sm">
              One friend
              <select name="friendId" className="h-11 rounded-xl border border-line bg-transparent px-3" required>
                {walks.people.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </label>
            <Field label="Place" name="place"><Input id="place" name="place" required maxLength={80} /></Field>
            <Field label="Tell them if I am not there by" name="dueAt"><Input id="dueAt" name="dueAt" type="datetime-local" required /></Field>
            <Button type="submit">Start check-in</Button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
