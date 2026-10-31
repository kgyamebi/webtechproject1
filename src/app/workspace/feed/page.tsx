import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { commentAction, createPostAction, deletePostAction, listFeed, reactPostAction } from "@/server/social/actions";

export const metadata = { title: "Feed" };

export default async function FeedPage() {
  const posts = await listFeed();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-4xl">Feed</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          Friends see a Friends post. A university post is limited to people at your institution. Comments and reactions stay on this page.
        </p>
      </div>
      <Card>
        <CardTitle>New post</CardTitle>
        <form action={createPostAction} className="mt-4 grid gap-3">
          <Field label="Audience" name="audience" hint="Connections means friends. University means the same institution.">
            <Select id="audience" name="audience" defaultValue="CONNECTIONS">
              <option value="CONNECTIONS">Friends</option>
              <option value="UNIVERSITY">My university</option>
            </Select>
          </Field>
          <Field label="Post" name="body">
            <Textarea id="body" name="body" required maxLength={2000} />
          </Field>
          <Field label="Image" name="image" hint="Optional JPEG, PNG, or WebP under 2 MB.">
            <input id="image" name="image" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
          </Field>
          <Button type="submit">Publish</Button>
        </form>
      </Card>
      {posts.length === 0 ? <EmptyState title="Nothing in the feed" body="Posts from friends, courses, and communities you can see will show up here." /> : null}
      {posts.map((post) => (
        <Card key={post.id}>
          <CardTitle>{post.author.name}</CardTitle>
          <CardText>
            {post.audience.toLowerCase()}
            {post.community ? ` · ${post.community.name}` : ""}
          </CardText>
          <p className="mt-3 text-sm leading-6">{post.body}</p>
          {post.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/media/post/${post.id}`} alt="" className="mt-3 max-h-80 rounded-2xl object-cover" />
          ) : null}
          <p className="mt-2 text-xs text-ink-soft">
            {post.reactions.length} reaction{post.reactions.length === 1 ? "" : "s"}
            {post.viewerReacted ? " · including yours" : ""}
          </p>
          <div className="mt-3 flex gap-2">
            <form action={reactPostAction}>
              <input type="hidden" name="postId" value={post.id} />
              <Button type="submit" size="sm" variant="secondary">
                {post.viewerReacted ? "Remove reaction" : "React"}
              </Button>
            </form>
            {post.mine ? (
              <form action={deletePostAction}>
                <input type="hidden" name="postId" value={post.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Delete
                </Button>
              </form>
            ) : null}
          </div>
          <ul className="mt-4 grid gap-2">
            {post.comments.map((comment) => (
              <li key={comment.id} className="text-sm">
                <span className="font-medium">{comment.author.name}</span>
                <span className="text-ink-soft"> · {comment.body}</span>
              </li>
            ))}
          </ul>
          <form action={commentAction} className="mt-3 grid gap-2">
            <input type="hidden" name="postId" value={post.id} />
            <Textarea name="body" required maxLength={1000} aria-label="Comment" placeholder="Write a comment" />
            <Button type="submit" size="sm">
              Comment
            </Button>
          </form>
        </Card>
      ))}
    </div>
  );
}
