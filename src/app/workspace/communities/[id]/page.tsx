import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { commentAction, createPostAction, decideMemberAction, leaveCommunityAction, loadCommunity, saveCommunityHighlightAction } from "@/server/social/actions";

export const metadata = { title: "Community" };

export default async function CommunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadCommunity(id);
  if (!loaded) {
    notFound();
  }
  const { community, mine, restricted } = loaded;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-4xl">{community.name}</h1>
        <p className="mt-2 text-sm text-ink-soft">{community.description}</p>
      </div>
      {community.highlight ? (
        <Card>
          <CardTitle>Highlight</CardTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/media/highlight/${community.id}`} alt={community.highlight.caption || "Club highlight"} className="mt-3 max-h-72 w-full rounded-2xl object-cover" />
          <CardText>{community.highlight.caption}</CardText>
        </Card>
      ) : null}
      {mine && !mine.pending && (mine.role === "MODERATOR" || community.createdById === mine.userId) ? (
        <Card>
          <CardTitle>{community.highlight ? "Replace the highlight" : "Save one highlight"}</CardTitle>
          <CardText>One image for this club. It stays after stories expire.</CardText>
          <form action={saveCommunityHighlightAction} className="mt-3 grid gap-3">
            <input type="hidden" name="communityId" value={community.id} />
            <Field label="Image" name="image"><Input id="highlight-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" required /></Field>
            <Field label="Caption" name="caption"><Input id="highlight-caption" name="caption" maxLength={140} /></Field>
            <Button type="submit" size="sm">Save highlight</Button>
          </form>
        </Card>
      ) : null}
      {restricted ? (
        <Card>
          <CardTitle>Private community</CardTitle>
          <CardText>A moderator has to approve you before posts are visible.</CardText>
        </Card>
      ) : (
        <>
          {mine && !mine.pending ? (
            <Card>
              <CardTitle>Post to this community</CardTitle>
              <form action={createPostAction} className="mt-4 grid gap-3">
                <input type="hidden" name="audience" value="COMMUNITY" />
                <input type="hidden" name="communityId" value={community.id} />
                <Field label="Post" name="body">
                  <Textarea id="body" name="body" required maxLength={2000} />
                </Field>
                <Button type="submit">Publish</Button>
              </form>
            </Card>
          ) : null}
          {community.posts.map((post) => (
            <Card key={post.id}>
              <CardTitle>{post.author.name}</CardTitle>
              <p className="mt-2 text-sm">{post.body}</p>
              <ul className="mt-3 grid gap-2">
                {post.comments.map((comment) => (
                  <li key={comment.id} className="text-sm">
                    <span className="font-medium">{comment.author.name}</span>
                    <span className="text-ink-soft"> · {comment.body}</span>
                  </li>
                ))}
              </ul>
              {mine && !mine.pending ? (
                <form action={commentAction} className="mt-3 grid gap-2">
                  <input type="hidden" name="postId" value={post.id} />
                  <Textarea name="body" required maxLength={1000} aria-label="Comment" placeholder="Write a comment" />
                  <Button type="submit" size="sm">
                    Comment
                  </Button>
                </form>
              ) : null}
            </Card>
          ))}
        </>
      )}
      {restricted ? null : (
      <Card>
        <CardTitle>Members</CardTitle>
        <ul className="mt-3 grid gap-2 text-sm">
          {community.members.map((member) => (
            <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {member.user.name} · {member.pending ? "pending" : member.role.toLowerCase()}
              </span>
              {mine?.role === "MODERATOR" && member.pending ? (
                <span className="flex gap-2">
                  <form action={decideMemberAction}>
                    <input type="hidden" name="communityId" value={community.id} />
                    <input type="hidden" name="memberId" value={member.userId} />
                    <input type="hidden" name="decision" value="approve" />
                    <Button type="submit" size="sm">
                      Approve
                    </Button>
                  </form>
                  <form action={decideMemberAction}>
                    <input type="hidden" name="communityId" value={community.id} />
                    <input type="hidden" name="memberId" value={member.userId} />
                    <input type="hidden" name="decision" value="reject" />
                    <Button type="submit" size="sm" variant="secondary">
                      Reject
                    </Button>
                  </form>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {mine ? (
          <form action={leaveCommunityAction} className="mt-4">
            <input type="hidden" name="communityId" value={community.id} />
            <Button type="submit" variant="secondary">
              Leave
            </Button>
          </form>
        ) : null}
      </Card>
      )}
    </div>
  );
}
