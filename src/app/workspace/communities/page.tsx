import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { createCommunityAction, joinCommunityAction, listCommunities } from "@/server/social/actions";

export const metadata = { title: "Communities" };

export default async function CommunitiesPage() {
  const communities = await listCommunities();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-4xl">Communities</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          A public community can be joined directly. A private one stays closed until a member lets you in. Membership is separate from course enrolment.
        </p>
      </div>
      <Card>
        <CardTitle>Create</CardTitle>
        <form action={createCommunityAction} className="mt-4 grid gap-3">
          <Field label="Name" name="name">
            <Input id="name" name="name" required minLength={2} />
          </Field>
          <Field label="Description" name="description">
            <Textarea id="description" name="description" maxLength={500} />
          </Field>
          <Field label="Visibility" name="visibility">
            <Select id="visibility" name="visibility" defaultValue="PUBLIC">
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </Select>
          </Field>
          <Button type="submit">Create community</Button>
        </form>
      </Card>
      {communities.length === 0 ? <EmptyState title="No communities yet" body="Create a public community, or wait for an invitation to a private one." /> : null}
      {communities.map((community) => (
        <Card key={community.id}>
          <CardTitle>{community.name}</CardTitle>
          <CardText>
            {community.visibility.toLowerCase()} · {community.members.filter((member) => !member.pending).length} members
            {community.course ? ` · course ${community.course.title}` : ""}
          </CardText>
          <p className="mt-2 text-sm">{community.description}</p>
          <div className="mt-4 flex gap-3">
            <Link className="text-sm text-pine underline-offset-4 hover:underline" href={`/workspace/communities/${community.id}`}>
              Open
            </Link>
            {!community.mine ? (
              <form action={joinCommunityAction}>
                <input type="hidden" name="communityId" value={community.id} />
                <Button type="submit" size="sm" variant="secondary">
                  {community.visibility === "PRIVATE" ? "Request to join" : "Join"}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-ink-soft">{community.mine.pending ? "Request waiting" : community.mine.role.toLowerCase()}</p>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
