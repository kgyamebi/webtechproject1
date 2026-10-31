import { Button } from "@/components/ui/button";
import { StoryComposer } from "@/components/social/story-composer";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { deleteStoryAction, listStories, muteStoriesAction } from "@/server/social/actions";

export const metadata = { title: "Stories" };

export default async function StoriesPage() {
  const stories = await listStories();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-4xl">Stories</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          An image story is visible to friends for 24 hours. There is no video. After it expires, even friends cannot open it.
        </p>
      </div>
      <Card>
        <CardTitle>Add a story</CardTitle>
        <StoryComposer />
      </Card>
      {stories.length === 0 ? <EmptyState title="No stories right now" body="Friends' stories appear until they expire." /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {stories.map((story) => (
          <Card key={story.id}>
            <CardTitle>{story.author.name}</CardTitle>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/story/${story.id}`} alt={story.caption || "Story image"} className="mt-3 max-h-72 w-full rounded-2xl object-cover" />
            <CardText>
              {story.caption} · expires {story.expiresAt.toLocaleString()}
            </CardText>
            <div className="mt-3 flex gap-2">
              <form action={muteStoriesAction}>
                <input type="hidden" name="authorId" value={story.authorId} />
                <Button type="submit" size="sm" variant="secondary">
                  Mute author
                </Button>
              </form>
              <form action={deleteStoryAction}>
                <input type="hidden" name="storyId" value={story.id} />
                <Button type="submit" size="sm" variant="ghost">
                  Delete if mine
                </Button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
