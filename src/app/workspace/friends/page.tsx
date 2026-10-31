import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
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
    </div>
  );
}
