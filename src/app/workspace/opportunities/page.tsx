import { Button } from "@/components/ui/button";
import { Card, CardText, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { createOpportunityAction, listOpportunities, saveOpportunityAction } from "@/server/campus/actions";

export const metadata = { title: "Opportunities" };

export default async function OpportunitiesPage() {
  const rows = await listOpportunities();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-4xl">Opportunities</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
          Scholarships, internships, and other listings people have published here. An official flag is limited to staff. Deadlines appear only when someone entered them.
        </p>
      </div>
      <Card>
        <CardTitle>Share one</CardTitle>
        <form action={createOpportunityAction} className="mt-4 grid gap-3">
          <Field label="Title" name="title">
            <Input id="title" name="title" required />
          </Field>
          <Field label="Kind" name="kind">
            <Select id="kind" name="kind" defaultValue="internship">
              <option value="internship">Internship</option>
              <option value="scholarship">Scholarship</option>
              <option value="job">Job</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Link" name="url">
            <Input id="url" name="url" type="url" required />
          </Field>
          <Field label="Description" name="description">
            <Textarea id="description" name="description" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="official" /> Official listing
          </label>
          <p className="text-sm text-ink-soft">Official is stored only when you are a lecturer or a platform administrator. Otherwise the listing is saved without that flag.</p>
          <Button type="submit">Publish</Button>
        </form>
      </Card>
      {rows.length === 0 ? (
        <EmptyState title="No listings yet" body="Publish a scholarship, internship, or job with an http or https link. Official stays off unless you are staff." />
      ) : null}
      {rows.map((row) => (
        <Card key={row.id}>
          <CardTitle>{row.title}</CardTitle>
          <CardText>
            {row.kind}
            {row.official ? " · official" : ""}
          </CardText>
          <p className="mt-2 text-sm">{row.description}</p>
          <a className="mt-2 inline-block text-sm text-pine underline-offset-4 hover:underline" href={row.url}>
            Open listing
          </a>
          <form action={saveOpportunityAction} className="mt-3">
            <input type="hidden" name="opportunityId" value={row.id} />
            <Button type="submit" size="sm" variant="secondary">
              {row.saved ? "Unsave" : "Save"}
            </Button>
          </form>
        </Card>
      ))}
    </div>
  );
}
